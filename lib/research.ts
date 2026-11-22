import { issuerCode } from "./pinned-stocks";
import { db } from "./db";
import { dartAnnual, findCorp } from "./dart";
import { financialScores } from "./financial-score";
import { DartApiError, dartCacheError } from "./dart-errors";
import { isTimeoutError } from "./request-timeout";
import { decodeResearch, deriveResearch, dividendHistory, retirementData, researchFresh, type ResearchSnapshot, type DartRow } from "./research-model";

const pending = new Map<string, Promise<ResearchSnapshot>>();
export async function readResearch(code: string) {
  const client = db();
  if (!client) return null;
  const result = await client.from("dart_financial_cache").select("note").eq("code", code).maybeSingle();
  if (result.error) throw dartCacheError("DART 평가 근거 조회", result.error);
  return decodeResearch(result.data?.note);
}
export async function readResearchMap(codes?: string[]): Promise<Map<string, ResearchSnapshot>> {
  const client = db();
  if (!client) return new Map();
  if (codes && !codes.length) return new Map();
  let query = client.from("dart_financial_cache").select("code,note");
  if (codes) query = query.in("code", codes);
  const result = await query;
  if (result.error) throw dartCacheError("DART 평가 근거 조회", result.error);
  return new Map((result.data || []).flatMap(row => {
    const snapshot = decodeResearch(row.note);
    return snapshot ? [[row.code, snapshot] as const] : [];
  }));
}
export async function updateResearch(code: string, force = false, source: "all"|"dividend"|"financial"|"retirement" = "all"): Promise<ResearchSnapshot> {
  const existing = pending.get(code);
  if (existing) { if (!force) return existing; await existing.catch(()=>null); return updateResearch(code,force,source); }
  const work = collect(code, force, source).finally(() => pending.delete(code));
  pending.set(code, work);
  return work;
}
async function collect(code: string, force: boolean, source: "all"|"dividend"|"financial"|"retirement"): Promise<ResearchSnapshot> {
  const client = db();
  if (!client) throw Error("Supabase 설정 누락");
  const stored = await readResearch(code);
  if (!force && researchFresh(stored)) return stored!;
  if (!process.env.DART_API_KEY?.trim()) throw new DartApiError("DART 설정", "CONFIG");
  const corp = await findCorp(code);
  if (!corp) throw Error("DART 기업 고유번호 미확인");
  const price = await client.from("stock_latest").select("*").eq("code", code).maybeSingle();
  if (price.error) throw Error("종목 데이터 조회 실패");
  if (!price.data) throw Error("시세를 먼저 수집해 주세요.");
  const year = new Date().getUTCFullYear() - 1;
  const errors: string[] = [];
  const issues: unknown[] = [];
  async function optional<T>(label: string, operation: () => Promise<T>): Promise<T | null> {
    try {
      try { return await operation(); }
      catch (error) {
        // A single bounded retry handles slow DART responses; key/quota/no-data errors are not retried.
        if (!isTimeoutError(error)) throw error;
        return await operation();
      }
    }
    catch (error) {
      issues.push(error);
      errors.push(label + ": " + (error instanceof Error ? error.message : "조회 실패"));
      return null;
    }
  }
  const prior = stored?.year === year ? stored : null;
  const all = source === "all";
  const wantFinancial = all || source === "financial";
  const wantDividend = all || source === "dividend";
  const wantRetirement = all || source === "retirement";
  const preferred = issuerCode(code) !== code;
  const stamp = new Date().toISOString();
  const [financial, treasury, shares, reports] = await Promise.all([
    wantFinancial ? optional("재무평가", () => financialScores(code,true)) : null,
    wantRetirement ? optional("소각", () => dartAnnual("tesstkAcqsDspsSttus",corp,year)) : null,
    wantRetirement ? optional("발행주식", () => dartAnnual("stockTotqySttus",corp,year)) : null,
    (async () => {
      const reports: {year:number;rows:DartRow[]}[] = [];
      if (!wantDividend) return reports;
      const attempted = new Set<number>();
      async function read(y:number) {
        attempted.add(y);
        const rows = await optional(y+"년 배당",()=>dartAnnual("alotMatter",corp,y));
        if(rows) reports.push({year:y,rows});
      }
      await Promise.all([read(year),read(year-2)]);
      for (let y=year;y>=year-4;y--) {
        if(issues.some(e=>e instanceof DartApiError && e.stopBatch)) break;
        if(!attempted.has(y) && dividendHistory(reports,year,preferred).some(d=>d.year===y && d.dps===null)) await read(y);
      }
      return reports;
    })(),
  ]);
  const fatal=issues.find(e=>e instanceof DartApiError && e.stopBatch);
  if(fatal) throw fatal;
  const dates = {...prior?.sourceDates};
  if(prior && !prior.sourceDates) for(const key of ["financial","dividend","retirement"] as const) dates[key]=prior.checkedAt;
  const dividendFailed=errors.some(e=>e.includes("년 배당"));
  const retirementFailed=errors.some(e=>/^(소각|발행주식):/.test(e));
  const useDividends=wantDividend && !(dividendFailed && prior);
  const useRetirement=wantRetirement && !(retirementFailed && prior);
  if(financial) dates.financial=stamp;
  if(useDividends && !dividendFailed) dates.dividend=stamp;
  if(useRetirement && !retirementFailed) dates.retirement=stamp;
  const previousErrors = (prior?.errors || []).filter(e=>!all && !(source==="financial"?e.includes("재무평가"):source==="dividend"?e.includes("배당"):/소각|발행주식/.test(e)));
  const snapshot: ResearchSnapshot = {
    version:1, year, checkedAt:stamp, sourceDates:dates,
    basis:financial?.note ?? prior?.basis ?? "재무자료 수집 대기",
    dividends:useDividends ? dividendHistory(reports,year,preferred) : prior?.dividends ?? dividendHistory([],year,preferred),
    ...(useRetirement ? retirementData(treasury||[],shares||[],preferred) : {retired:prior?.retired??null,issued:prior?.issued??null,retirementReceipt:prior?.retirementReceipt??null,shareReceipt:prior?.shareReceipt??null}),
    fundamentals:financial?.fundamentals ?? prior?.fundamentals ?? [],
    base:financial ? {profit_score:financial.profit_score??null,balance_score:financial.balance_score??null,growth_score:financial.growth_score??null} : prior?.base ?? {},
    errors:[...previousErrors,...errors],
  };
  const {error: cacheError} = await client.from("dart_financial_cache").upsert({
    code,
    profit_score: "profit_score" in snapshot.base ? snapshot.base.profit_score : price.data.profit_score ?? null,
    balance_score: "balance_score" in snapshot.base ? snapshot.base.balance_score : price.data.balance_score ?? null,
    growth_score: "growth_score" in snapshot.base ? snapshot.base.growth_score : price.data.growth_score ?? null,
    note: JSON.stringify(snapshot), checked_at: snapshot.checkedAt,
  }, {onConflict: "code"});
  if (cacheError) throw dartCacheError("DART 평가 근거 저장", cacheError);
  const {error} = await client.from("stock_latest").update(deriveResearch(price.data, snapshot).fields).eq("code", code);
  if (error) throw Error("추가 평가 저장 실패: stock_latest 컬럼을 확인해 주세요.");
  return snapshot;
}

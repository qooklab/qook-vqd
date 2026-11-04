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
export async function updateResearch(code: string, force = false): Promise<ResearchSnapshot> {
  const existing = pending.get(code);
  if (existing) return existing;
  const work = collect(code, force).finally(() => pending.delete(code));
  pending.set(code, work);
  return work;
}
async function collect(code: string, force: boolean): Promise<ResearchSnapshot> {
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
  // Independent sources run concurrently. All financial years use the same CFS/OFS basis.
  const [financial, latestDividend, olderDividend, treasury, shares] = await Promise.all([
    optional("재무평가", () => financialScores(code, true)),
    optional(`${year}년 배당`, () => dartAnnual("alotMatter", corp, year)),
    optional(`${year - 2}년 배당`, () => dartAnnual("alotMatter", corp, year - 2)),
    optional(`${year}년 소각`, () => dartAnnual("tesstkAcqsDspsSttus", corp, year)),
    optional(`${year}년 발행주식`, () => dartAnnual("stockTotqySttus", corp, year)),
  ]);
  // Invalid keys, blocked access and quota failures must remain actionable, not cached as no-data.
  const fatal = issues.find(e => e instanceof DartApiError && e.stopBatch);
  if (fatal) throw fatal;
  const reports = [
    latestDividend ? {year, rows: latestDividend} : null,
    olderDividend ? {year: year - 2, rows: olderDividend} : null,
  ].filter((r): r is {year: number; rows: DartRow[]} => r !== null);
  const snapshot: ResearchSnapshot = {
    version: 1, year, checkedAt: new Date().toISOString(),
    basis: financial?.note || "DART 재무평가 조회 지연 · 기존 점수 유지",
    dividends: dividendHistory(reports, year, code === "005935"),
    ...retirementData(treasury || [], shares || [], code === "005935"),
    fundamentals: financial?.fundamentals || [],
    base: financial ? {
      profit_score: financial.profit_score ?? null,
      balance_score: financial.balance_score ?? null,
      growth_score: financial.growth_score ?? null,
    } : {},
    errors,
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

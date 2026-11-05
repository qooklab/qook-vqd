import { firstExclusion, selectCandidates, type ScreenJob } from "./market-model";
import { calculate } from "./stocks";
import { deriveResearch, numeric, researchFresh, type ResearchSnapshot } from "./research-model";

export const stageLabels = {selected:"최종 30 후보", passed:"조건 통과 · 순위 밖", excluded:"조건 제외", failed:"시세 수집 실패", pending:"시세 수집 대기"} as const;
export type MarketStage = keyof typeof stageLabels;
export function marketDataRows(job: ScreenJob, stored: Record<string, any>[], research: Map<string, ResearchSnapshot>) {
  const quotes = new Map(job.quotes.map(q => [q.code, q]));
  const failures = new Map(job.failures.map(f => [f.code, f]));
  const latest = new Map(stored.map(r => [r.code, r]));
  const candidates = selectCandidates(job.quotes, job.listings);
  const ranks = new Map(candidates.map((q, i) => [q.code, i + 1]));
  const screenScores = new Map(candidates.map(q=>[q.code,q.screenScore]));
  return job.listings.map(stock => {
    const quote = quotes.get(stock.code), cached = latest.get(stock.code);
    const snapshot = research.get(stock.code) || null;
    const exclusion = firstExclusion(stock), failure = failures.get(stock.code);
    const rank = ranks.get(stock.code) ?? null;
    let stage: MarketStage = "pending", reason = "규모·ROE 통과 · 현재 회차 시세 수집 대기";
    if (exclusion) {stage="excluded";reason=exclusion;}
    else if (quote) {
      if (rank !== null) {stage=rank<=30?"selected":"passed";reason=rank<=30?"공통 조건 통과 · 가격 점수·시가총액 순으로 선정":"공통 조건 통과 · 선정 순위 30위 밖";}
      else {stage="excluded";reason=[quote.per===null?"PER 미확인":quote.per<=0?"PER 0 이하":quote.per>15?"PER 15 초과":"",quote.pbr===null?"PBR 미확인":quote.pbr<=0?"PBR 0 이하":quote.pbr>1.5?"PBR 1.5 초과":""].filter(Boolean).join(" · ") || "유효 시세 미확인";}
    } else if (failure) {stage="failed";reason="시세 수집 실패 · 재시도 필요";}
    // Screening always uses this run's quotes. Older detailed data never changes screening status.
    const useQuote=!!quote&&(!cached?.updated_at||Date.parse(quote.updated_at)>=Date.parse(cached.updated_at));
    const raw:Record<string,any> = {...cached,...(useQuote?quote:{}),code:stock.code};
    for (const key of ["price","per","pbr","dividend_yield","margin_score","dividend_history_score","buyback_score","profit_score","balance_score","growth_score","moat_score"]) raw[key]=numeric(raw[key]);
    const derived = deriveResearch(raw, snapshot);
    const score = calculate({...raw,...derived.fields});
    return {code:stock.code,name:stock.name,market:stock.market,group:stock.group,cap:stock.cap,roe:stock.roe,referenceDate:stock.referenceDate,stage,reason,rank,
      provisional:job.status!=="complete",price:numeric(raw.price),per:numeric(raw.per),pbr:numeric(raw.pbr),
      quoteAt:useQuote?quote!.updated_at:cached?.updated_at||null,quoteSource:useQuote?"current":cached?.updated_at?"previous":"none",
      screenScore:screenScores.get(stock.code)??null,
      assessed:score.possible?score.assessed:null,possible:score.possible,values:score.vals,evidence:derived.evidence,
      researchState:score.complete?"complete":score.possible>0?"partial":"none",researchAt:snapshot?.checkedAt||null,
      researchStale:snapshot?!researchFresh(snapshot):false,researchIssues:snapshot?.errors.length||0,
      detailAvailable:!!cached};
  });
}
export type MarketDataRow = ReturnType<typeof marketDataRows>[number];
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  // A company name or external value must not become a spreadsheet formula.
  if (/^[\s]*[=+@-]/.test(text) && typeof value !== "number") text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}

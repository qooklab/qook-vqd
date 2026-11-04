import { scorePER, scorePBR } from "./stocks";
export type Listing = {code: string; name: string; market: "KOSPI" | "KOSDAQ"; group: string; preferred: string; spac: string; halted: string; liquidation: string; managed: string; cap: number | null; roe: number | null; referenceDate: string};
export type ScreenQuote = {code: string; name: string; price: number; per: number | null; pbr: number | null; volume: number | null; updated_at: string};
export const SCREEN_POLICY = {version: 1, minCap: 1000, minRoe: 5, maxPer: 15, maxPbr: 1.5, limit: 30} as const;
export function firstExclusion(stock: Listing): string | null {
  if (stock.group !== "ST") return "주권(ST) 외 증권";
  if (stock.preferred !== "0") return "우선주·종류 미확인";
  if (stock.spac !== "N") return "스팩·구분 미확인";
  if (stock.halted !== "N" || stock.liquidation !== "N" || stock.managed !== "N") return "거래정지·정리매매·관리·상태 미확인";
  if (stock.cap === null || stock.cap < SCREEN_POLICY.minCap) return "시가총액 1,000억원 미만·미확인";
  if (stock.roe === null || stock.roe < SCREEN_POLICY.minRoe) return "ROE 5% 미만·미확인";
  return null;
}
export function selectCandidates(quotes: ScreenQuote[], listings: Listing[]) {
  const lookup = new Map(listings.map(s => [s.code,s]));
  return quotes.filter(q => lookup.has(q.code) && firstExclusion(lookup.get(q.code)!) === null && q.price > 0 && q.per !== null && q.per > 0 && q.per <= SCREEN_POLICY.maxPer && q.pbr !== null && q.pbr > 0 && q.pbr <= SCREEN_POLICY.maxPbr)
    .map(q => ({...q, cap: lookup.get(q.code)!.cap!, roe: lookup.get(q.code)!.roe!, market: lookup.get(q.code)!.market, screenScore: scorePER(q.per)! + scorePBR(q.pbr)!}))
    .sort((a,b) => b.screenScore - a.screenScore || b.cap - a.cap || a.code.localeCompare(b.code));
}
export function decodeJob(note: unknown): ScreenJob | null {
  if (typeof note !== "string") return null;
  try {const j=JSON.parse(note);return j.kind === "market-screen-v1" && Array.isArray(j.listings) && Array.isArray(j.quotes) && Array.isArray(j.failures) && Number.isInteger(j.cursor) ? j : null;} catch {return null;}
}
export type ScreenJob = {kind: "market-screen-v1"; runId: string; sourceAt: string; startedAt: string; completedAt: string | null; status: "running" | "complete" | "partial"; listings: Listing[]; cursor: number; quotes: ScreenQuote[]; failures: {code: string; error: string; attempts: number}[]; attempted: number; leaseUntil: string | null; cooldownUntil: string | null; message: string | null; published?: {runId: string; completedAt: string; selected: ScreenQuote[]}};
export function eligibleListings(job: ScreenJob) {return job.listings.filter(s => firstExclusion(s) === null);}
export function publicScreen(job: ScreenJob) {
  const exclusions: Record<string, number>={};
  job.listings.forEach(s => {const reason=firstExclusion(s);if(reason)exclusions[reason]=(exclusions[reason]||0)+1;});
  const candidates=selectCandidates(job.quotes,job.listings);
  return {runId:job.runId,sourceAt:job.sourceAt,startedAt:job.startedAt,completedAt:job.completedAt,status:job.status,masterCount:job.listings.length,stockCount:job.listings.filter(s=>s.group==="ST").length,eligible:eligibleListings(job).length,processed:job.cursor,collected:job.quotes.length,failed:job.failures.length,exclusions,candidateCount:candidates.length,selected:candidates.slice(0,SCREEN_POLICY.limit),failures:job.failures.slice(0,20),cooldownUntil:job.cooldownUntil,message:job.message,policy:SCREEN_POLICY};
}

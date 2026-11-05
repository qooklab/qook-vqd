import { db } from "./db";
import { readMarketJob } from "./market-screen";
import { decodeResearch, type ResearchSnapshot } from "./research-model";
import { marketDataRows } from "./market-data-model";

/** Read persisted data only: opening the explorer never starts KIS or DART collection. */
export async function readMarketData() {
  const job=await readMarketJob();
  if(!job)return {run:null,rows:[]};
  const client=db();
  if(!client)throw Error("데이터 연결 설정을 확인해 주세요.");
  const stored:Record<string,any>[]=[], research=new Map<string,ResearchSnapshot>();
  // Bound each query below Supabase's default 1,000-row response limit.
  for(let offset=0;offset<job.listings.length;offset+=200){
    const codes=job.listings.slice(offset,offset+200).map(s=>s.code);
    const [prices,snapshots]=await Promise.all([
      client.from("stock_latest").select("*").in("code",codes),
      client.from("dart_financial_cache").select("code,note").in("code",codes),
    ]);
    if(prices.error||snapshots.error)throw Error("저장된 평가 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    stored.push(...prices.data||[]);
    for(const row of snapshots.data||[]){const snapshot=decodeResearch(row.note);if(snapshot)research.set(row.code,snapshot);}
  }
  return {run:{runId:job.runId,status:job.status,sourceAt:job.sourceAt,completedAt:job.completedAt},rows:marketDataRows(job,stored,research)};
}
export type MarketData = Awaited<ReturnType<typeof readMarketData>>;

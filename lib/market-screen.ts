import {randomUUID} from "node:crypto";
import {db} from "./db";
import {quote, KisApiError} from "./kis";
import {downloadMarket} from "./market-master";
import {decodeJob, eligibleListings, publicScreen, selectCandidates, type ScreenJob} from "./market-model";
import {stocks} from "./stocks";
const JOB_CODE = "__market_screen_v1";
const PAGE_SIZE = 20;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function readStored() {
  const client=db();if(!client)throw Error("Supabase 설정 누락");
  const result=await client.from("dart_financial_cache").select("note,checked_at").eq("code",JOB_CODE).maybeSingle();
  if(result.error)throw Error("전 종목 선별 저장소 조회 실패");
  return {client,job:decodeJob(result.data?.note),stamp:result.data?.checked_at as string|undefined};
}
export async function readMarketJob() {return (await readStored()).job;}
export async function ensureMarketJob() {
  const stored=await readStored();
  if(stored.job)return stored.job;
  const listings=await downloadMarket();
  const now=new Date().toISOString();
  const job:ScreenJob={kind:"market-screen-v1",runId:randomUUID(),sourceAt:now,startedAt:now,completedAt:null,status:"running",listings,cursor:0,quotes:[],failures:[],attempted:0,leaseUntil:null,cooldownUntil:null,message:null};
  const insert=await stored.client.from("dart_financial_cache").upsert({code:JOB_CODE,note:JSON.stringify(job),checked_at:now},{onConflict:"code",ignoreDuplicates:true});
  if(insert.error)throw Error("전 종목 선별 작업 생성 실패");
  return (await readStored()).job || job;
}
export async function restartMarketJob(retryOnly: boolean) {
  const {client,job,stamp}=await readStored();
  if(!job)return ensureMarketJob();
  if(job.leaseUntil && Date.parse(job.leaseUntil)>Date.now())throw Error("수집 중입니다. 현재 묶음이 끝난 뒤 다시 시도해 주세요.");
  const now=new Date().toISOString();
  const next:ScreenJob=retryOnly?{...job,status:"running",completedAt:null,failures:job.failures.map(f=>({...f,attempts:0})),message:null,cooldownUntil:null}:{...job,runId:randomUUID(),listings:await downloadMarket(),sourceAt:now,startedAt:now,completedAt:null,status:"running",cursor:0,quotes:[],failures:[],attempted:0,leaseUntil:null,cooldownUntil:null,message:null};
  const result=await client.from("dart_financial_cache").update({note:JSON.stringify(next),checked_at:now}).eq("code",JOB_CODE).eq("checked_at",stamp!).select("code").maybeSingle();
  if(result.error||!result.data)throw Error("다른 요청이 선별 작업을 변경했습니다. 다시 확인해 주세요.");
  return next;
}
/** One persisted, leased batch per invocation; a tab may close without losing completed batches. */
export async function processMarketBatch() {
  const {client,job,stamp}=await readStored();
  if(!job||job.status!=="running"||!stamp)return;
  const started=Date.now();
  if(job.leaseUntil&&Date.parse(job.leaseUntil)>started)return;
  if(job.cooldownUntil&&Date.parse(job.cooldownUntil)>started)return;
  const leaseStamp=new Date(Math.max(Date.now(),Date.parse(stamp)+1)).toISOString();
  const working:ScreenJob={...job,leaseUntil:new Date(started+55000).toISOString(),message:null,cooldownUntil:null};
  const lock=await client.from("dart_financial_cache").update({note:JSON.stringify(working),checked_at:leaseStamp}).eq("code",JOB_CODE).eq("checked_at",stamp).select("code").maybeSingle();
  if(lock.error)throw Error("전 종목 수집 잠금 실패");
  if(!lock.data)return;
  const eligible=eligibleListings(working);
  if(!process.env.KIS_APP_KEY||!process.env.KIS_APP_SECRET){working.status="partial";working.message="KIS 환경변수를 확인해 주세요.";}
  else for(let i=0;i<PAGE_SIZE&&Date.now()-started<32000;i++) {
    const initial=working.cursor<eligible.length;
    const retry=initial?null:working.failures.find(f=>f.attempts<2);
    const stock=initial?eligible[working.cursor]:retry?eligible.find(s=>s.code===retry.code):null;
    if(!stock)break;
    if(i>0)await sleep(750);
    working.attempted++;
    try {
      const result=await quote(stock.code);
      if(result.price===null||result.price<=0)throw Error("현재가 미확인");
      working.quotes=working.quotes.filter(q=>q.code!==stock.code);
      working.quotes.push({code:stock.code,name:stock.name,...result,price:result.price,updated_at:new Date().toISOString()});
      working.failures=working.failures.filter(f=>f.code!==stock.code);
    } catch(error) {
      const message=error instanceof Error?error.message:"시세 수집 실패";
      const previous=working.failures.find(f=>f.code===stock.code);
      working.failures=working.failures.filter(f=>f.code!==stock.code);
      working.failures.push({code:stock.code,error:message.slice(0,240),attempts:(previous?.attempts||0)+1});
      if(error instanceof KisApiError && (error.stage==="token"||[401,403].includes(error.status))){working.status="partial";working.message="KIS 인증 상태 확인 필요 · "+message;}
      else if(/EGW00201|초당|too many|429/i.test(message)){working.cooldownUntil=new Date(Date.now()+30000).toISOString();working.message="호출 제한으로 30초 대기 후 이어서 수집합니다.";}
    }
    if(initial)working.cursor++;
    if(working.status==="partial"||working.cooldownUntil)break;
  }
  if(working.status==="running"&&working.cursor>=eligible.length&&!working.failures.some(f=>f.attempts<2)){
    working.status=working.failures.length?"partial":"complete";
    working.completedAt=new Date().toISOString();
    if(working.failures.length)working.message="일부 시세 조회 실패 · 현재 후보는 잠정 결과입니다. 실패 종목 재시도로 이어서 수집할 수 있습니다.";
  }
  if(working.status==="complete"){
    const candidates=selectCandidates(working.quotes,working.listings).slice(0,30);
    working.published={runId:working.runId,completedAt:working.completedAt!,selected:candidates};
    if(candidates.length){const saved=await client.from("stock_latest").upsert(candidates.map(({code,name,price,per,pbr,volume,updated_at})=>({code,name,price,per,pbr,volume,updated_at})),{onConflict:"code"});if(saved.error)throw Error("선별 후보 저장 실패");}
  }
  working.leaseUntil=null;
  const saved=await client.from("dart_financial_cache").update({note:JSON.stringify(working),checked_at:new Date().toISOString()}).eq("code",JOB_CODE).eq("checked_at",leaseStamp);
  if(saved.error)throw Error("전 종목 수집 진행률 저장 실패");
}
export async function watchlist() {
  const job=await readMarketJob().catch(()=>null);
  if(job?.status==="complete")return {published:true,run:publicScreen(job),stocks:selectCandidates(job.quotes,job.listings).slice(0,30).map(q=>[q.name,q.code] as const)};
  if(job?.published)return {published:true,run:publicScreen(job),stocks:job.published.selected.map(q=>[q.name,q.code] as const)};
  return {published:false,run:job?publicScreen(job):null,stocks:[...stocks] as (readonly [string,string])[]};
}

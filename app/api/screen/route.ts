import {after,NextRequest,NextResponse} from "next/server";
import {ensureMarketJob,processMarketBatch,restartMarketJob} from "@/lib/market-screen";
import {publicScreen} from "@/lib/market-model";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
function continueCollection(status:string){if(status==="running")after(async()=>{try{await processMarketBatch();}catch(error){console.error("Market screening batch failed",error instanceof Error?error.message:"unknown");}});}
export async function GET(){
  try{const job=await ensureMarketJob();continueCollection(job.status);return NextResponse.json(publicScreen(job),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"전 종목 수집 실패"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
export async function POST(request:NextRequest){
  if(!process.env.CRON_SECRET||request.headers.get("authorization")!=="Bearer "+process.env.CRON_SECRET)return NextResponse.json({error:"인증키를 확인해 주세요."},{status:401});
  const body=await request.json().catch(()=>({}));
  try{const job=await restartMarketJob(body.retryOnly===true);continueCollection(job.status);return NextResponse.json(publicScreen(job),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"수집 재시작 실패"},{status:409});}
}

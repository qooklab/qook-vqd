import { NextResponse } from "next/server";
import { readMarketData } from "@/lib/market-data";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
  const code=new URL(request.url).searchParams.get("code")||undefined;
  if(code&&!/^[0-9A-Z]{6}$/.test(code))return NextResponse.json({error:"올바른 종목코드가 필요합니다."},{status:400});
  try{return NextResponse.json(await readMarketData(code),{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({error:"전체 종목 데이터를 불러오지 못했습니다. 데이터 연결 상태를 확인하거나 잠시 후 다시 시도해 주세요."},{status:503,headers:{"Cache-Control":"no-store"}});}
}

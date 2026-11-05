import { NextResponse } from "next/server";
import { readMarketData } from "@/lib/market-data";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(){
  try{return NextResponse.json(await readMarketData(),{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({error:"전체 종목 데이터를 불러오지 못했습니다. 데이터 연결 상태를 확인하거나 잠시 후 다시 시도해 주세요."},{status:503,headers:{"Cache-Control":"no-store"}});}
}

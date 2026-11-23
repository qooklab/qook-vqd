import {NextResponse} from "next/server";
import {unstable_cache} from "next/cache";
import {chartHistory} from "@/lib/kis";
import {resolveStock} from "@/lib/resolve-stock";
export const maxDuration=60;
const history=unstable_cache(chartHistory,["kis-chart-v1"],{revalidate:900});
export async function GET(req:Request){
  const params=new URL(req.url).searchParams;
  const code=params.get("code")??"",period=params.get("period")??"D";
  if(!/^[A-Z0-9]{6}$/.test(code)||!["D","W","M"].includes(period)) return NextResponse.json({error:"종목·기간 확인 필요"},{status:400});
  try {
    if(!await resolveStock(code)) return NextResponse.json({error:"미등록 종목"},{status:404});
    return NextResponse.json(await history(code,period),{headers:{"Cache-Control":"public, s-maxage=900"}});
  } catch {return NextResponse.json({error:"KIS 기간별 시세를 불러오지 못했습니다."},{status:503});}
}
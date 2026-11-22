import { NextResponse } from "next/server";
import {readPins, savePins} from "@/lib/pin-settings";
import {resolveStock} from "@/lib/resolve-stock";

export async function POST(req: Request) {
  if(!process.env.CRON_SECRET || req.headers.get("authorization") !== "Bearer "+process.env.CRON_SECRET)
    return NextResponse.json({error:"인증키를 확인하세요."},{status:401});
  const body=await req.json().catch(()=>null);
  if (!body || !/^[0-9A-Z]{6}$/.test(body.code) || typeof body.pin !== "boolean")
    return NextResponse.json({error:"종목 정보를 확인하세요."},{status:400});
  try {
    const {pins,revision}=await readPins();
    if (revision !== body.revision) throw Error("고정 목록이 변경되었습니다. 새로고침 후 다시 시도하세요.");
    const next=pins.filter(([,code])=>code!==body.code);
    if (body.pin) {
      const stock=await resolveStock(body.code);
      if(!stock || next.length>=30) throw Error("등록 종목과 최대 30개 제한을 확인하세요.");
      next.push(stock);
    }
    await savePins(next,revision);
    return NextResponse.json({ok:true});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"저장 실패"},{status:409}); }
}

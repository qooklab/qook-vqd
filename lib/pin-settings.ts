import { db } from "./db";
import { pinnedStocks, type StockPair } from "./pinned-stocks";

const key = "__watchlist_pins_v1";
export async function readPins() {
  const client = db();
  if (!client) return {pins: [...pinnedStocks] as StockPair[], revision: null as string | null};
  const {data,error} = await client.from("dart_financial_cache").select("note,checked_at").eq("code",key).maybeSingle();
  if (error) throw Error("고정 종목 설정 조회 실패");
  return {pins: data ? JSON.parse(data.note) as StockPair[] : [...pinnedStocks], revision: data?.checked_at as string ?? null};
}
export async function savePins(pins: StockPair[], revision: string | null) {
  const client = db();
  if (!client) throw Error("데이터 연결 필요");
  const row = {note: JSON.stringify(pins), checked_at: new Date().toISOString()};
  const result = revision
    ? await client.from("dart_financial_cache").update(row).eq("code",key).eq("checked_at",revision).select("code").maybeSingle()
    : await client.from("dart_financial_cache").insert({...row,code:key}).select("code").single();
  if(result.error || !result.data) throw Error("설정을 저장하지 못했습니다. 새로고침 후 다시 시도하세요.");
}

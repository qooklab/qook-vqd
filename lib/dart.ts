import { db } from "./db";
import { verifiedCorpCodes } from "./dart-corp-codes";
import { stocks } from "./stocks";
import { DartApiError, dartCacheError } from "./dart-errors";
import { withUpstreamTimeout } from "./request-timeout";
import { inflateRawSync } from "node:zlib";
let map: Map<string, string> | null = null;
export async function findCorp(code: string) {
  // Registered stocks have issuer IDs verified from FSS. Do not download the full directory.
  const verified = verifiedCorpCodes[code];
  if (verified) return verified;
  const key = process.env.DART_API_KEY?.trim();
  const client = db();
  let cachePrimed = false;
  if (client) {
    const lookup = await client
      .from("dart_corp_cache")
      .select("corp_code,checked_at")
      .eq("stock_code", code)
      .maybeSingle();
    if (lookup.error)
      throw dartCacheError("DART 기업코드 캐시 조회", lookup.error);
    if (
      lookup.data?.corp_code &&
      Date.now() - new Date(lookup.data.checked_at).getTime() < 30 * 86400000
    )
      return lookup.data.corp_code;
  }
  if (!key) throw new DartApiError("DART 설정", "CONFIG");
  if (!map) {
    const u = new URL("https://opendart.fss.or.kr/api/corpCode.xml");
    u.searchParams.set("crtfc_key", key);
    const b = await withUpstreamTimeout(
      "DART 기업목록 조회",
      20000,
      async (signal) => {
        const response = await fetch(u, { cache: "no-store", signal });
        if (!response.ok)
          throw new DartApiError(
            "DART 기업목록 조회",
            "HTTP_" + response.status,
          );
        return Buffer.from(await response.arrayBuffer());
      },
    );
    // DART returns XML with an error status instead of a ZIP for invalid keys / quota errors.
    if (b.length < 4 || b.readUInt32LE(0) !== 0x04034b50) {
      const body = b.toString("utf8");
      const status = body.match(/<status>\s*([^<]+)\s*<\/status>/)?.[1];
      if (status) throw new DartApiError("DART 기업목록 조회", status);
      throw new DartApiError("DART 기업목록 조회", "INVALID_ARCHIVE");
    }
    let xml = "";
    // Locate ZIP central directory entry. Compressed size in local header may be zero.
    for (let i = 0; i + 46 <= b.length; i++) {
      if (b.readUInt32LE(i) !== 0x02014b50) continue;
      const nameLen = b.readUInt16LE(i + 28),
        extraLen = b.readUInt16LE(i + 30),
        commentLen = b.readUInt16LE(i + 32);
      if (i + 46 + nameLen > b.length) break;
      const name = b.subarray(i + 46, i + 46 + nameLen).toString("utf8");
      if (!name.toLowerCase().endsWith(".xml")) {
        i += 45 + nameLen + extraLen + commentLen;
        continue;
      }
      const p = b.readUInt32LE(i + 42);
      if (p + 30 > b.length || b.readUInt32LE(p) !== 0x04034b50)
        throw Error("DART ZIP 파일 헤더 손상");
      const start = p + 30 + b.readUInt16LE(p + 26) + b.readUInt16LE(p + 28);
      const size = b.readUInt32LE(i + 20),
        method = b.readUInt16LE(i + 10);
      if (start + size > b.length) throw Error("DART ZIP 압축 데이터 손상");
      const data = b.subarray(start, start + size);
      if (method !== 8 && method !== 0)
        throw Error("DART ZIP 압축 방식 미지원: " + method);
      xml = (method === 8 ? inflateRawSync(data) : data).toString("utf8");
      break;
    }
    if (!xml) throw Error("DART ZIP 안에 기업목록 XML 파일이 없습니다");
    const nextMap = new Map<string, string>();
    for (const x of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
      const stock = x[1].match(/<stock_code>\s*(\d{6})\s*<\/stock_code>/)?.[1];
      const corp = x[1].match(/<corp_code>\s*(\d{8})\s*<\/corp_code>/)?.[1];
      if (stock && corp) nextMap.set(stock, corp);
    }
    if (nextMap.size < 100)
      throw new DartApiError("DART 기업목록 해석", "INVALID_ARCHIVE");
    map = nextMap;
    if (client) {
      const checked_at = new Date().toISOString();
      const entries = stocks.flatMap(([, ticker]) => {
        const corp_code = nextMap.get(ticker === "005935" ? "005930" : ticker);
        return corp_code ? [{ stock_code: ticker, corp_code, checked_at }] : [];
      });
      if (entries.length) {
        const saved = await client
          .from("dart_corp_cache")
          .upsert(entries, { onConflict: "stock_code" });
        if (saved.error)
          throw dartCacheError("DART 기업코드 캐시 저장", saved.error);
        cachePrimed = true;
      }
    }
  }
  const corp = map.get(code === "005935" ? "005930" : code) || null;
  if (corp && client && !cachePrimed) {
    const saved = await client.from("dart_corp_cache").upsert(
      {
        stock_code: code,
        corp_code: corp,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "stock_code" },
    );
    if (saved.error)
      throw dartCacheError("DART 기업코드 캐시 저장", saved.error);
  }
  return corp;
}
export async function dartFinancials(
  corpCode: string,
  year: number,
  reprtCode = "11014",
  fsDiv: "CFS" | "OFS" = "CFS",
) {
  const key = process.env.DART_API_KEY?.trim();
  if (!key) throw new DartApiError("DART 설정", "CONFIG");
  const stage =
    "DART " +
    year +
    "년 " +
    (fsDiv === "CFS" ? "연결" : "별도") +
    " 재무제표 조회";
  const u = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
  for (const [k, v] of Object.entries({
    crtfc_key: key,
    corp_code: corpCode,
    bsns_year: String(year),
    reprt_code: reprtCode,
    fs_div: fsDiv,
  }))
    u.searchParams.set(k, v);
  let j: unknown;
  try {
    j = await withUpstreamTimeout(stage, 12000, async (signal) => {
      const r = await fetch(u, { cache: "no-store", signal });
      if (!r.ok) throw new DartApiError(stage, "HTTP_" + r.status);
      return r.json();
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new DartApiError(stage, "INVALID_RESPONSE");
    throw error;
  }
  if (
    !j ||
    typeof j !== "object" ||
    !("status" in j) ||
    typeof j.status !== "string"
  )
    throw new DartApiError(stage, "INVALID_RESPONSE");
  if (j.status !== "000") throw new DartApiError(stage, j.status);
  if (
    !("list" in j) ||
    !Array.isArray(j.list) ||
    !j.list.every(
      (row) => row && typeof row === "object" && !Array.isArray(row),
    )
  )
    throw new DartApiError(stage, "INVALID_RESPONSE");
  if (j.list.length === 0) throw new DartApiError(stage, "013");
  return j.list as Record<string, string>[];
}

/** Annual-report endpoints; preserve missing-data, auth and quota errors. */
export async function dartAnnual(endpoint: "alotMatter" | "tesstkAcqsDspsSttus" | "stockTotqySttus", corpCode: string, year: number) {
  const key = process.env.DART_API_KEY?.trim();
  if (!key) throw new DartApiError("DART 설정", "CONFIG");
  const stage = `DART ${year}년 ${endpoint} 조회`;
  const url = new URL(`https://opendart.fss.or.kr/api/${endpoint}.json`);
  for (const [k, v] of Object.entries({crtfc_key: key, corp_code: corpCode, bsns_year: String(year), reprt_code: "11011"})) url.searchParams.set(k, v);
  let data: unknown;
  try {
    data = await withUpstreamTimeout(stage, 10000, async signal => {
      const response = await fetch(url, {cache: "no-store", signal});
      if (!response.ok) throw new DartApiError(stage, "HTTP_" + response.status);
      return response.json();
    });
  } catch (error) {
    if (error instanceof SyntaxError) throw new DartApiError(stage, "INVALID_RESPONSE");
    throw error;
  }
  const result = data as {status?: string; list?: Record<string, string>[]};
  if (!result || typeof result.status !== "string") throw new DartApiError(stage, "INVALID_RESPONSE");
  if (result.status !== "000") throw new DartApiError(stage, result.status);
  if (!Array.isArray(result.list) || !result.list.every(r => r && typeof r === "object" && !Array.isArray(r))) throw new DartApiError(stage, "INVALID_RESPONSE");
  return result.list;
}


import { db } from "./db";
import { withUpstreamTimeout } from "./request-timeout";
import { inflateRawSync } from "node:zlib";
let map: Map<string, string> | null = null;
export async function findCorp(code: string) {
  const key = process.env.DART_API_KEY;
  if (!key) return null;
  const client = db();
  if (client) {
    const lookup = await client
      .from("dart_corp_cache")
      .select("corp_code,checked_at")
      .eq("stock_code", code)
      .maybeSingle();
    if (lookup.error) throw Error("DART 기업코드 캐시 테이블 미설정");
    if (
      lookup.data?.corp_code &&
      Date.now() - new Date(lookup.data.checked_at).getTime() < 30 * 86400000
    )
      return lookup.data.corp_code;
  }
  if (!map) {
    const u = new URL("https://opendart.fss.or.kr/api/corpCode.xml");
    u.searchParams.set("crtfc_key", key);
    const { response, b } = await withUpstreamTimeout(
      "DART 기업목록 조회",
      20000,
      async (signal) => {
        const response = await fetch(u, { cache: "no-store", signal });
        if (!response.ok) throw Error("DART corpCode HTTP " + response.status);
        return { response, b: Buffer.from(await response.arrayBuffer()) };
      },
    );
    // DART returns XML with an error status instead of a ZIP for invalid keys / quota errors.
    if (b.length < 4 || b.readUInt32LE(0) !== 0x04034b50) {
      const body = b.toString("utf8");
      const status = body.match(/<status>\s*([^<]+)\s*<\/status>/)?.[1];
      const message = body.match(/<message>\s*([^<]+)\s*<\/message>/)?.[1];
      if (status)
        throw Error(
          "DART 기업목록 API " + status + ": " + (message || "API 오류"),
        );
      throw Error(
        "DART 기업목록 응답이 ZIP이 아닙니다 (HTTP " +
          response.status +
          ", content-type " +
          (response.headers.get("content-type") || "unknown") +
          ")",
      );
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
    map = new Map();
    for (const x of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
      const stock = x[1].match(/<stock_code>(\d{6})<\/stock_code>/)?.[1];
      const corp = x[1].match(/<corp_code>(\d{8})<\/corp_code>/)?.[1];
      if (stock && corp) map.set(stock, corp);
    }
    if (map.size < 100) throw Error("DART 기업코드 목록이 비어 있습니다");
  }
  const corp = map.get(code === "005935" ? "005930" : code) || null;
  if (corp && client) {
    const saved = await client.from("dart_corp_cache").upsert(
      {
        stock_code: code,
        corp_code: corp,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "stock_code" },
    );
    if (saved.error) throw Error("DART 기업코드 캐시 저장 실패");
  }
  return corp;
}
export async function dartFinancials(
  corpCode: string,
  year: number,
  reprtCode = "11014",
) {
  const key = process.env.DART_API_KEY;
  if (!key) throw Error("DART_API_KEY missing");
  const u = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
  for (const [k, v] of Object.entries({
    crtfc_key: key,
    corp_code: corpCode,
    bsns_year: String(year),
    reprt_code: reprtCode,
    fs_div: "CFS",
  }))
    u.searchParams.set(k, v);
  const j = await withUpstreamTimeout(
    "DART " + year + "년 재무제표 조회",
    12000,
    async (signal) => {
      const r = await fetch(u, { cache: "no-store", signal });
      if (!r.ok) throw Error(`DART HTTP ${r.status}`);
      return r.json();
    },
  );
  if (j.status !== "000") throw Error(`DART ${j.status}: ${j.message}`);
  return j.list as Record<string, string>[];
}
// DART corp_code (8 digits) differs from the stock ticker (6 digits).

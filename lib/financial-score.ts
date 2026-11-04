import { db } from "./db";
import { isTimeoutError, UpstreamTimeoutError } from "./request-timeout";
import { findCorp, dartFinancials, dartFinancialIndustry } from "./dart";
import { stocks } from "./stocks";
import { DartApiError, isDartNoData, dartCacheError } from "./dart-errors";
type Row = Record<string, string>;
export const financials = new Set([
  "105560",
  "055550",
  "086790",
  "138040",
  "316140",
  "024110",
  "000810",
  "032830",
  "071050",
  "138930",
  "175330",
  "139130",
]);
function number(value: string | undefined) {
  if (typeof value !== "string") return null;
  let normalized = value.trim().replace(/,/g, "").replace(/\s/g, "");
  if (/^\(\d+(?:\.\d+)?\)$/.test(normalized))
    normalized = "-" + normalized.slice(1, -1);
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
const normalizeName = (value: string) =>
  value.normalize("NFKC").replace(/\s/g, "");
function metric(rows: Row[], ids: string[], names: string[], section: string) {
  const candidates = rows.filter((x) => x.sj_div === section),
    normalized = names.map(normalizeName);
  const matches = [
    ...candidates.filter((x) => ids.includes(x.account_id)),
    ...candidates.filter(
      (x) =>
        typeof x.account_nm === "string" &&
        normalized.includes(normalizeName(x.account_nm)),
    ),
  ];
  for (const row of matches) {
    const value = number(row.thstrm_amount);
    if (value !== null) return value;
  }
  return null;
}
export type FinancialScoreResult = {
  profit_score?: number;
  balance_score?: number;
  growth_score?: number;
  note: string;
  fundamentals?: { year: number; roe: number | null; receipt: string | null }[];
};
const hasScores = (value: Record<string, unknown>) =>
  ["profit_score", "balance_score", "growth_score"].some(
    (k) =>
      typeof value[k] === "number" &&
      Number.isInteger(value[k]) &&
      Number(value[k]) >= 0 &&
      Number(value[k]) <= 10,
  );
type YearResult =
  | { year: number; rows: Row[]; error?: never }
  | { year: number; error: unknown; rows?: never };
export async function financialScores(
  code: string,
  force = false,
): Promise<FinancialScoreResult> {
  const client = db();
  if (!client) throw Error("Supabase 설정 누락");
  const y = new Date().getUTCFullYear() - 1,
    tag = `[dart-score-v2:${y}] `;
  const { data: cached, error: cacheError } = await client
    .from("dart_financial_cache")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (cacheError) throw dartCacheError("DART 평가 캐시 조회", cacheError);
  const age = cached?.checked_at
    ? Date.now() - new Date(cached.checked_at).getTime()
    : NaN;
  if (
    !force &&
    cached &&
    hasScores(cached) &&
    typeof cached.note === "string" &&
    cached.note.startsWith(tag) &&
    age >= 0 &&
    age < 7 * 86400000
  )
    return {
      profit_score: cached.profit_score ?? undefined,
      balance_score: cached.balance_score ?? undefined,
      growth_score: cached.growth_score ?? undefined,
      note: "캐시 재사용 · " + cached.note.slice(tag.length),
    };
  const corp = await findCorp(code);
  if (!corp) return { note: "DART 기업 고유번호 미확인" };
  let financialIndustry: boolean | null = financials.has(code) ? true : stocks.some(s => s[1] === code) ? false : null;
  if(financialIndustry === null) {
    try { financialIndustry = await dartFinancialIndustry(corp); }
    catch(error) { if(error instanceof DartApiError && error.stopBatch)throw error; }
  }
  const fetchYears = (division: "CFS" | "OFS") =>
    Promise.all(
      [y - 2, y - 1, y].map(async (year): Promise<YearResult> => {
        try {
          return {
            year,
            rows: await dartFinancials(corp, year, "11011", division),
          };
        } catch (error) {
          return { year, error };
        }
      }),
    );
  let division: "CFS" | "OFS" = "CFS";
  let data = await fetchYears(division);
  let failures = data.filter(
    (r): r is Extract<YearResult, { error: unknown }> => "error" in r,
  );
  // Only "no data" justifies changing the reporting basis. Never mix CFS/OFS across years.
  if (failures.length && failures.every((r) => isDartNoData(r.error))) {
    division = "OFS";
    data = await fetchYears(division);
    failures = data.filter(
      (r): r is Extract<YearResult, { error: unknown }> => "error" in r,
    );
  }
  if (failures.length) {
    const providerError = failures.find(
      (r) => r.error instanceof DartApiError && !isDartNoData(r.error),
    );
    if (providerError) throw providerError.error;
    if (
      failures.some((r) => isTimeoutError(r.error)) &&
      failures.every((r) => isTimeoutError(r.error) || isDartNoData(r.error))
    )
      throw new UpstreamTimeoutError("DART 재무제표 조회", 12000);
    return {
      note: failures
        .map(
          (r) =>
            r.year +
            "년 " +
            (r.error instanceof Error ? r.error.message : "조회 실패"),
        )
        .join(" / ")
        .slice(0, 500),
    };
  }
  const years = data.map((r) => r.rows!);
  const profits = years.map(
    (rows) =>
      metric(
        rows,
        ["dart_OperatingIncomeLoss"],
        ["영업이익", "영업이익(손실)"],
        "IS",
      ) ??
      metric(
        rows,
        ["dart_OperatingIncomeLoss"],
        ["영업이익", "영업이익(손실)"],
        "CIS",
      ),
  );
  const result: FinancialScoreResult = {
    note: `DART ${division === "CFS" ? "연결" : "별도"} 사업보고서 ${y - 2}–${y}년 기준`,
    fundamentals: years.map((rows, i) => {
      const income = metric(rows, ["ifrs-full_ProfitLoss", "ifrs_ProfitLoss"], ["당기순이익", "당기순이익(손실)"], "IS") ?? metric(rows, ["ifrs-full_ProfitLoss", "ifrs_ProfitLoss"], ["당기순이익", "당기순이익(손실)"], "CIS");
      const equity = metric(rows, ["ifrs-full_Equity", "ifrs_Equity"], ["자본총계"], "BS");
      const previous = metric(rows.map(r => ({...r, thstrm_amount: r.frmtrm_amount})), ["ifrs-full_Equity", "ifrs_Equity"], ["자본총계"], "BS");
      return {year: y - 2 + i, roe: income !== null && equity !== null && previous !== null && equity > 0 && previous > 0 ? income / ((equity + previous) / 2) * 100 : null, receipt: rows.find(r => /^\d{14}$/.test(r.rcept_no || ""))?.rcept_no || null};
    }),
  };
  if (profits.every((x) => x !== null)) {
    const positive = profits.filter((x) => x !== null && x > 0).length;
    result.profit_score = [0, 3, 6, 10][positive];
    const start = profits[0]!,
      end = profits[2]!;
    if (start > 0 && end > 0) {
      const g = Math.sqrt(end / start) - 1;
      result.growth_score =
        g >= 0.15 ? 10 : g >= 0.1 ? 8 : g >= 0.05 ? 6 : g >= 0 ? 4 : 2;
    } else if (end <= 0) result.growth_score = 0;
  }
  if (financialIndustry === false) {
    const rows = years[2],
      debt = metric(
        rows,
        ["ifrs-full_Liabilities", "ifrs_Liabilities"],
        ["부채총계"],
        "BS",
      ),
      equity = metric(
        rows,
        ["ifrs-full_Equity", "ifrs_Equity"],
        ["자본총계"],
        "BS",
      );
    if (debt !== null && equity !== null && equity > 0) {
      const r = debt / equity;
      result.balance_score =
        r <= 0.5 ? 10 : r <= 1 ? 8 : r <= 1.5 ? 6 : r <= 2 ? 4 : r <= 3 ? 2 : 0;
    }
  } else result.note += financialIndustry === true ? " · 금융업 재무 건전성은 미평가" : " · 업종 분류 미확인으로 재무 건전성 미평가";
  if (!hasScores(result))
    return { ...result, note: result.note + " · 점수 계산에 필요한 계정과목 누락" };
  const { error: saveError } = await client.from("dart_financial_cache").upsert(
    {
      code,
      profit_score: result.profit_score ?? null,
      balance_score: result.balance_score ?? null,
      growth_score: result.growth_score ?? null,
      note: tag + result.note,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "code" },
  );
  if (saveError) throw dartCacheError("DART 평가 캐시 저장", saveError);
  return result;
}


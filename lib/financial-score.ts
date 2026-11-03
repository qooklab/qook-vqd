import { db } from "./db";
import { isTimeoutError, UpstreamTimeoutError } from "./request-timeout";
import { findCorp, dartFinancials } from "./dart";
type Row = Record<string, string>;
const financials = new Set([
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
  if (!value) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
function metric(rows: Row[], ids: string[], names: string[], section: string) {
  const candidates = rows.filter((x) => x.sj_div === section);
  const row =
    candidates.find((x) => ids.includes(x.account_id)) ||
    candidates.find((x) => names.includes(x.account_nm?.trim()));
  return number(row?.thstrm_amount);
}
export type FinancialScoreResult = {
  profit_score?: number;
  balance_score?: number;
  growth_score?: number;
  note: string;
};
export async function financialScores(
  code: string,
  force = false,
): Promise<FinancialScoreResult> {
  const client = db();
  if (!client) throw Error("Supabase 설정 누락");
  const { data: cached, error: cacheError } = await client
    .from("dart_financial_cache")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (cacheError)
    throw Error("DART 캐시 테이블 미설정: supabase/dart_cache.sql 실행 필요");
  if (
    !force &&
    cached?.checked_at &&
    Date.now() - new Date(cached.checked_at).getTime() < 7 * 86400000
  )
    return {
      profit_score: cached.profit_score ?? undefined,
      balance_score: cached.balance_score ?? undefined,
      growth_score: cached.growth_score ?? undefined,
      note: "캐시 재사용 · " + (cached.note || ""),
    };
  const corp = await findCorp(code);
  if (!corp) return { note: "DART 기업 고유번호 미확인" };
  const y = new Date().getUTCFullYear() - 1;
  const data = await Promise.all(
    [y - 2, y - 1, y].map(async (year) => {
      try {
        return await dartFinancials(corp, year, "11011");
      } catch (error) {
        return {
          error:
            year +
            "년 " +
            (error instanceof Error ? error.message : "조회 실패"),
          timeout: isTimeoutError(error),
        };
      }
    }),
  );
  const failures = data.filter(
    (x): x is { error: string; timeout: boolean } => !Array.isArray(x),
  );
  if (failures.length && failures.every((x) => x.timeout))
    throw new UpstreamTimeoutError("DART 재무제표 조회", 12000);
  if (failures.length)
    return {
      note: failures
        .map((x) => x.error)
        .join(" / ")
        .slice(0, 300),
    };
  const years = data as Row[][];
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
    note: "DART 연결 사업보고서 3개년 기준",
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
  if (!financials.has(code)) {
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
  }
  if (
    result.profit_score === undefined &&
    result.balance_score === undefined &&
    result.growth_score === undefined
  )
    result.note = "DART 재무제표 수신, 점수 계산에 필요한 계정과목 누락";
  const { error: saveError } = await client
    .from("dart_financial_cache")
    .upsert(
      {
        code,
        profit_score: result.profit_score ?? null,
        balance_score: result.balance_score ?? null,
        growth_score: result.growth_score ?? null,
        note: result.note,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "code" },
    );
  if (saveError) throw Error("DART 평가 캐시 저장 실패");
  return result;
}

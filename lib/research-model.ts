export type DartRow = Record<string, string>;
export type ResearchSnapshot = {
  version: 1;
  year: number;
  checkedAt: string;
  basis: string;
  dividends: {year: number; dps: number | null; receipt: string | null}[];
  retired: number | null;
  issued: number | null;
  retirementReceipt: string | null;
  shareReceipt: string | null;
  fundamentals: {year: number; roe: number | null; receipt: string | null}[];
  base: {profit_score?: number | null; balance_score?: number | null; growth_score?: number | null};
  errors: string[];
};
export const numeric = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let text = value.normalize("NFKC").trim().replace(/[,\s]/g, "");
  if (/^\(\d+(?:\.\d+)?\)$/.test(text)) text = "-" + text.slice(1, -1);
  return /^-?\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
};
const norm = (value: string = "") => value.normalize("NFKC").replace(/\s/g, "");
const receipt = (row?: DartRow) => /^\d{14}$/.test(row?.rcept_no || "") ? row!.rcept_no : null;
export function shareClass(value: string, preferred: boolean) {
  const text = norm(value);
  return preferred ? /우선주/.test(text) : /보통주/.test(text);
}
export function dividendHistory(reports: {year: number; rows: DartRow[]}[], year: number, preferred: boolean) {
  const values = new Map<number, {year: number; dps: number | null; receipt: string | null}>();
  // Newer reports take precedence for their overlapping (possibly restated) years.
  for (const report of [...reports].sort((a, b) => a.year - b.year)) {
    const matches = report.rows.filter(r => /주당현금배당금/.test(norm(r.se)) && shareClass(r.stock_knd, preferred));
    // Multiple different preferred classes cannot be mapped to one ticker safely.
    if (matches.length !== 1) continue;
    const row = matches[0];
    ["thstrm", "frmtrm", "lwfr"].forEach((key, i) => {
      const dps = numeric(row[key]);
      values.set(report.year - i, {year: report.year - i, dps: dps !== null && dps >= 0 ? dps : null, receipt: receipt(row)});
    });
  }
  return Array.from({length: 5}, (_, i) => values.get(year - 4 + i) || {year: year - 4 + i, dps: null, receipt: null});
}
export function retirementData(rows: DartRow[], shares: DartRow[], preferred: boolean) {
  const typed = rows.filter(r => shareClass(r.stock_knd, preferred));
  let totals = typed.filter(r => norm(r.acqs_mth1) === "총계");
  if (!totals.length) totals = typed.filter(r => norm(r.acqs_mth3) === "총계");
  const row = totals.length === 1 ? totals[0] : undefined;
  const issuedRows = shares.filter(r => shareClass(r.se, preferred));
  const share = issuedRows.length === 1 ? issuedRows[0] : undefined;
  const retired = numeric(row?.change_qy_incnr);
  const issued = numeric(share?.istc_totqy);
  return {retired: retired !== null && retired >= 0 ? retired : null, issued: issued !== null && issued > 0 ? issued : null, retirementReceipt: receipt(row), shareReceipt: receipt(share)};
}
export function decodeResearch(note: unknown): ResearchSnapshot | null {
  if (typeof note !== "string" || !note.startsWith("{\"version\":1,")) return null;
  try {
    const value = JSON.parse(note);
    if (value.version !== 1 || !Number.isInteger(value.year) || !Number.isFinite(Date.parse(value.checkedAt)) || !Array.isArray(value.dividends) || !Array.isArray(value.fundamentals) || !Array.isArray(value.errors) || !value.base) return null;
    return value as ResearchSnapshot;
  } catch { return null; }
}
export function researchFresh(snapshot: ResearchSnapshot | null, now = Date.now()) {
  if (!snapshot) return false;
  const year = new Date(now).getUTCFullYear() - 1;
  const age = now - Date.parse(snapshot.checkedAt);
  return snapshot.year === year && age >= 0 && age < (snapshot.errors.length ? 15 * 60000 : 7 * 86400000);
}
export function deriveResearch(row: Record<string, any>, snapshot: ResearchSnapshot | null) {
  const price = numeric(row.price), per = numeric(row.per), pbr = numeric(row.pbr);
  const fair = price !== null && price > 0 && per !== null && per > 0 && pbr !== null && pbr > 0 ? Math.min(price / per * 12, price / pbr) : null;
  const margin = fair !== null && price !== null ? (1 - price / fair) * 100 : null;
  const fields: Record<string, number | null> = {
    buy_price: fair === null ? null : Math.floor(fair * .8),
    margin_score: margin === null ? null : margin >= 30 ? 15 : margin >= 20 ? 12 : margin >= 10 ? 9 : margin >= 0 ? 6 : margin >= -10 ? 3 : 0,
  };
  const evidence = [
    "KIS 수집 시점 PER · 5배 이하 10 / 8 이하 8 / 12 이하 6 / 18 이하 4 / 초과 2점. 0 이하 미평가.",
    "KIS 수집 시점 PBR · 0.5배 이하 10 / 0.8 이하 8 / 1 이하 6 / 1.5 이하 4 / 초과 2점. 0 이하 미평가.",
    fair === null ? "시세·양수 PER·양수 PBR이 모두 필요합니다. 적자·자본잠식 여부를 별도 확인하세요." : `자체 모형 추정가 ${Math.round(fair).toLocaleString("ko-KR")}원 · 할인율 ${margin!.toFixed(1)}%. 추정 EPS×12와 추정 BPS 중 작은 값. 모형 매수기준은 추정가의 80%. 확정 적정가가 아닙니다.`,
    "배당 자료 수집 대기 · 최근 완료 사업연도 주당 현금배당금이 필요합니다.",
    "배당 자료 수집 대기 · 최근 5개 완료 사업연도 전체 이력이 필요합니다.",
    "소각 자료 수집 대기 · 실제 소각 수량을 확인해야 합니다.",
    snapshot?.basis || "DART 3년 영업이익 자료 수집 대기",
    "DART 최근 사업연도 부채/자본 · 금융업은 일반기업 산식 적용 제외",
    snapshot?.basis || "DART 3년 영업이익 자료 수집 대기",
    "3년 ROE 자료 수집 대기 · 경쟁우위 자체를 확인하는 정성평가는 아닙니다.",
  ];
  if (snapshot) {
    Object.assign(fields, snapshot.base);
    const dps = snapshot.dividends.find(d => d.year === snapshot.year)?.dps ?? null;
    fields.dividend_yield = dps !== null && price !== null && price > 0 ? dps / price * 100 : null;
    evidence[3] = dps === null ? `${snapshot.year}년 주식 종류별 주당 현금배당금 미확인. '-'는 0원으로 처리하지 않습니다.` : `${snapshot.year}년 주당배당 ${dps.toLocaleString("ko-KR")}원 ÷ 최근 수집가${fields.dividend_yield !== null ? ` = ${fields.dividend_yield.toFixed(2)}%` : " 미수집"}. 과거 실적 기준이며 예상 배당률이 아닙니다.`;
    const dividends = snapshot.dividends.map(d => d.dps);
    const known = dividends.length === 5 && dividends.every(d => d !== null);
    const paid = known ? dividends.filter(d => d! > 0).length : 0;
    const maintained = known && dividends.every((d, i) => i === 0 || d! >= dividends[i - 1]!);
    fields.dividend_history_score = !known ? null : paid === 5 ? maintained ? 10 : 8 : paid === 4 ? 6 : paid === 3 ? 4 : paid > 0 ? 2 : 0;
    evidence[4] = `${snapshot.dividends.map(d => `${d.year}: ${d.dps === null ? "미확인" : d.dps.toLocaleString("ko-KR") + "원"}`).join(" / ")}. 5년 모두 확인 시 평가. 주식분할·특별배당에 따른 주당금액 변동은 별도 검토하세요.`;
    const ratio = snapshot.retired !== null && snapshot.issued !== null ? snapshot.retired / (snapshot.issued + snapshot.retired) * 100 : null;
    fields.buyback_score = snapshot.retired === 0 ? 0 : ratio === null ? null : ratio >= 3 ? 10 : ratio >= 2 ? 8 : ratio >= 1 ? 6 : ratio > 0 ? 4 : 0;
    evidence[5] = snapshot.retired === null ? `${snapshot.year}년 해당 주식 종류의 소각 총계 미확인. 공시 부재는 0점으로 보지 않습니다.` : `${snapshot.year}년 실제 소각 ${snapshot.retired.toLocaleString("ko-KR")}주${ratio === null ? " · 발행주식 수 미확인" : ` · 기말 발행주식+연간 소각 대비 ${ratio.toFixed(2)}%`}. 취득·소각 결정 공시만으로 점수를 주지 않습니다. 분할·병합 시 비율은 별도 검토하세요.`;
    const roes = snapshot.fundamentals.map(f => f.roe);
    const minimum = roes.length === 3 && roes.every(r => r !== null) ? Math.min(...roes as number[]) : null;
    fields.moat_score = minimum === null ? null : minimum >= 15 ? 5 : minimum >= 10 ? 4 : minimum >= 5 ? 3 : minimum > 0 ? 1 : 0;
    evidence[9] = minimum === null ? "3년 순이익·기초/기말 자본 자료 부족. 경쟁력 점수는 3년 ROE의 대리지표이며 시장지위·브랜드·전환비용 평가는 포함하지 않습니다." : `경쟁력 대리지표: ${snapshot.fundamentals.map(f => `${f.year} ROE ${f.roe!.toFixed(1)}%`).join(" / ")}. 3년 최저 ROE ${minimum.toFixed(1)}% 기준. 순이익÷평균 총자본. 경제적 해자 자체를 검증한 점수가 아닙니다.`;
  }
  if (fields.balance_score == null && ["105560","055550","086790","138040","316140","024110","000810","032830","071050","138930","175330","139130"].includes(row.code)) evidence[7] = "금융업은 일반기업 부채비율로 평가하지 않습니다. 은행 BIS/CET1·보험 K-ICS 등 업종 지표 확인 전까지 미평가입니다.";
  return {fields, evidence, fair, margin};
}

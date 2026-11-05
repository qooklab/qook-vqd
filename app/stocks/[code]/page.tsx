import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { criteria, calculate } from "@/lib/stocks";
import { Header, Footer } from "../../site-chrome";
import { readResearch, updateResearch } from "@/lib/research";
import { deriveResearch, researchFresh } from "@/lib/research-model";
import { resolveStock } from "@/lib/resolve-stock";
import StockRefresh from "../../stock-refresh";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const money = (value: unknown) =>
  value == null ? "—" : Number(value).toLocaleString("ko-KR") + " 원";
export default async function Detail({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const found = await resolveStock(code);
  if (!found) notFound();
  const client = db();
  const response = client
    ? await client
        .from("stock_latest")
        .select("*")
        .eq("code", code)
        .maybeSingle()
    : null;
  let researchError = "";
  let snapshot = await readResearch(code).catch((error: unknown) => {
    researchError = error instanceof Error ? error.message : "평가 근거 조회 실패";
    return null;
  });
  const {watchlist} = await import("@/lib/market-screen");
  const isWatched=(await watchlist()).stocks.some(s=>s[1]===code);
  if (isWatched && response?.data && !researchError && !researchFresh(snapshot)) {
    try { snapshot = await updateResearch(code); }
    catch (error) { researchError = error instanceof Error ? error.message : "추가 평가 조회 실패"; }
  }
  const derived = deriveResearch({...response?.data, code}, snapshot);
  const raw = {...response?.data, ...derived.fields};
  const score = calculate(raw);
  const evaluated = score.vals.filter((v) => v != null).length;
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content" className="dashboard detail-dashboard">
        <div className="detail-actions">
          <Link className="back-link" href="/market">
            ← 전체 종목 데이터
          </Link>
          <Link className="text-link" href="/methodology">
            평가 기준 알아보기 →
          </Link>
        </div>
        <section className="detail-hero">
          <div className="detail-hero-title">
            <span className="stock-icon">{found[0].slice(0, 1)}</span>
            <div>
              <span className="section-overline">KRX · {code}</span>
              <h1>{found[0]}</h1>
              <span className="detail-code">VALUE, QUALITY & DIVIDEND</span>
            </div>
          </div>
          <span
            className={`detail-state ${raw.price != null ? "is-collected" : ""}`}
          >
            <span className="status-dot" />
            {raw.price != null ? "시세 수집 완료" : "시세 수집 대기"}
          </span>
        </section>
        {(!client || response?.error) && (
          <div className="notice" role="status">
            <strong>
              {response?.error ? "데이터 조회 지연" : "데이터 연결 대기"}
            </strong>
            <span>현재 시세와 평가 데이터를 표시할 수 없습니다.</span>
          </div>
        )}
        {researchError && <div className="notice" role="status"><strong>추가 평가 확인 필요</strong><span>{researchError}</span></div>}
        <div className="stats detail-stats">
          <div className="stat-card">
            <div className="stat-label">
              최근 수집가 <span>PRICE</span>
            </div>
            <div className="stat-value detail-value">
              {raw.price != null ? money(raw.price) : "미수집"}
            </div>
            <div className="stat-foot">KIS API · 수집 시점 기준</div>
          </div>
          <div className="stat-card score-card">
            <div className="stat-label">
              확인 점수 <span>VQD SCORE</span>
            </div>
            <div className="stat-value">
              {score.possible > 0 ? (
                <>
                  {score.assessed}
                  <small>/ 100</small>
                </>
              ) : (
                <span className="detail-value">미평가</span>
              )}
            </div>
            <div className="stat-foot">
              {score.complete
                ? "전체 평가 완료"
                : score.possible > 0
                  ? "일부 평가"
                  : "평가 데이터 대기"}{" "}
              · 평가 가능 배점 {score.possible}/100
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              모형 매수기준 <span>MODEL ENTRY</span>
            </div>
            <div className="stat-value detail-value">
              {raw.buy_price != null ? money(raw.buy_price) : "미산정"}
            </div>
            <div className="stat-foot">
              자체 모형 추정가의 80% · 확정 적정가 아님
            </div>
          </div>
        </div>
        <StockRefresh code={code}/>
        <section className="detail-section">
          <div className="section-heading">
            <div>
              <span className="section-overline">평가 내역</span>
              <h2>가치를 구성하는 10가지 기준</h2>
            </div>
            <span className="section-meta">{evaluated} / 10 항목 평가</span>
          </div>
          <div className="detail-layout">
            <aside className="coverage-panel">
              <span className="section-overline">평가 범위</span>
              <div className="coverage-value">
                {score.possible}
                <small>%</small>
              </div>
              <strong>전체 100점 중 {score.possible}점 배점 평가</strong>
              <div className="stat-track">
                <div style={{ width: `${score.possible}%` }} />
              </div>
              <p>
                미평가 항목은 0점을 의미하지 않습니다. 수집된 항목과 평가 범위를
                먼저 확인하세요.
              </p>
              <Link href="/methodology" className="text-link">
                점수 해석 가이드 →
              </Link>
            </aside>
            <div>
              <div className="detail-table-wrap">
                <table className="detail-table">
                  <caption className="sr-only">
                    10개 평가 항목의 배점과 획득 점수
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">평가 항목</th>
                      <th scope="col">배점</th>
                      <th scope="col">획득 점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map(([label, max], i) => (
                      <tr key={label}>
                        <th scope="row">
                          <span className="criterion-index">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {label}{i === 9 && <small> · 수익성 대리지표</small>}
                        </th>
                        <td>
                          {max}
                          <small> 점</small>
                        </td>
                        <td>
                          {score.vals[i] == null ? (
                            <span className="detail-unrated">미평가</span>
                          ) : (
                            <div className="criterion-result">
                              <span
                                className="criterion-track"
                                aria-hidden="true"
                              >
                                <span
                                  style={{
                                    width: `${(score.vals[i]! / max) * 100}%`,
                                  }}
                                />
                              </span>
                              <strong className="detail-score">
                                {score.vals[i]}
                                <small> 점</small>
                              </strong>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="detail-summary">
                <span>
                  확인 점수 합계
                  <small>평가 가능 배점 {score.possible} / 100</small>
                </span>
                <strong>
                  {score.possible > 0 ? (
                    <>
                      {score.assessed}
                      <small> / 100점</small>
                    </>
                  ) : (
                    "미평가"
                  )}
                </strong>
              </div>
            </div>
          </div>
        </section>
        <section className="research-evidence" aria-labelledby="evidence-title">
          <div className="section-heading"><h2 id="evidence-title">산정 근거와 데이터 출처</h2><span className="section-meta">{snapshot ? `${snapshot.year}년 사업보고서 기준` : "추가 공시 수집 대기"}</span></div>
          <p>시세·PER·PBR은 KIS 수집값입니다. 배당과 소각은 완료 사업연도 실적이며, 올해 예상치나 실시간 공시를 뜻하지 않습니다.</p>
          <div className="evidence-grid">{criteria.map(([label], i) => <details key={label}>
            <summary>{String(i + 1).padStart(2, "0")} · {label} <span>{score.vals[i] === null ? "미평가 사유" : "계산 근거"}</span></summary>
            <p>{derived.evidence[i]}</p>
          </details>)}</div>
          {snapshot && <>
            <p>재무·배당 확인: {new Date(snapshot.checkedAt).toLocaleString("ko-KR", {timeZone: "Asia/Seoul"})} · {snapshot.errors.length ? "일부 조회 실패 · 15분 후 재확인" : "정상 결과 7일 재사용"}{!researchFresh(snapshot) ? " · 갱신 지연으로 이전 자료 표시" : ""}</p>
            <div className="evidence-sources">{[...new Set([...snapshot.dividends.map(d => d.receipt), ...snapshot.fundamentals.map(f => f.receipt), snapshot.retirementReceipt, snapshot.shareReceipt])].filter((r): r is string => typeof r === "string" && /^\d{14}$/.test(r)).map(r => <a key={r} href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${r}`} target="_blank" rel="noreferrer">DART 공시 {r} ↗</a>)}</div>
            {snapshot.errors.length > 0 && <div className="notice"><strong>일부 자료 미확인</strong><span>{snapshot.errors.join(" / ")}</span></div>}
          </>}
          <Link className="text-link" href="/methodology">전체 계산 기준 보기 →</Link>
        </section>
        <div className="detail-updated">
          최근 수집 ·{" "}
          {raw.updated_at
            ? new Date(raw.updated_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })
            : "수집 대기"}
        </div>
        <Footer />
      </main>
    </div>
  );
}


import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { stocks, criteria, calculate } from "@/lib/stocks";
import { Header, Footer } from "../../site-chrome";
export const dynamic = "force-dynamic";
const money = (value: unknown) =>
  value == null ? "—" : Number(value).toLocaleString("ko-KR") + " 원";
export default async function Detail({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const found = stocks.find((x) => x[1] === code);
  if (!found) notFound();
  const client = db();
  const response = client
    ? await client
        .from("stock_latest")
        .select("*")
        .eq("code", code)
        .maybeSingle()
    : null;
  const raw = response?.data || {};
  const score = calculate(raw);
  const evaluated = score.vals.filter((v) => v != null).length;
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content" className="dashboard detail-dashboard">
        <div className="detail-actions">
          <Link className="back-link" href="/">
            ← 전체 종목
          </Link>
          <Link className="text-link" href="/methodology">
            평가 기준 알아보기 ↗
          </Link>
        </div>
        <div className="eyebrow">
          EQUITY RESEARCH <span>02 / STOCK DETAIL</span>
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
              적정매수가 <span>FAIR ENTRY</span>
            </div>
            <div className="stat-value detail-value">
              {raw.buy_price != null ? money(raw.buy_price) : "미산정"}
            </div>
            <div className="stat-foot">
              검증 가능한 산정 근거가 있는 경우 표시
            </div>
          </div>
        </div>
        <section className="detail-section">
          <div className="section-heading">
            <div>
              <span className="section-overline">VALUATION BREAKDOWN</span>
              <h2>가치를 구성하는 10가지 기준</h2>
            </div>
            <span className="section-meta">{evaluated} / 10 항목 평가</span>
          </div>
          <div className="detail-layout">
            <aside className="coverage-panel">
              <span className="section-overline">ASSESSMENT COVERAGE</span>
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
                점수 해석 가이드 ↗
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
                          {label}
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

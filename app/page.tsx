import Link from "next/link";
import { db } from "@/lib/db";
import { stocks, calculate } from "@/lib/stocks";
import ManualRefresh from "./manual-refresh";
import StockTable, { type StockRow } from "./stock-table";
import { Header, Footer } from "./site-chrome";
export const dynamic = "force-dynamic";
export default async function Home() {
  const client = db();
  const result = client ? await client.from("stock_latest").select("*") : null;
  const rows = stocks
    .map(([name, code]) => {
      const raw = result?.data?.find((x) => x.code === code) || {};
      return { name, code, ...raw, ...calculate(raw) };
    })
    .sort((a, b) => b.assessed - a.assessed);
  const collected = rows.filter((r) => r.price != null).length;
  const completed = rows.filter((r) => r.complete).length;
  const updated = rows
    .map((r) => r.updated_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content" className="dashboard">
        <div className="eyebrow">
          RESEARCH TERMINAL <span>01 / OVERVIEW</span>
        </div>
        <section className="hero">
          <div>
            <div className="hero-kicker">VALUE. QUALITY. DIVIDEND.</div>
            <h1>
              가치에 집중하는
              <br />
              <span>투자의 기준.</span>
            </h1>
            <p>
              좋은 기업을 합리적인 가격에.
              <br />
              국내 우량 배당주의 가격과 펀더멘털을 함께 살펴봅니다.
            </p>
          </div>
          <div className="hero-aside">
            <span className="hero-aside-label">THE VQD FRAMEWORK</span>
            <div className="framework-line">
              <span>01</span>
              <strong>Value</strong>
              <small>가격의 합리성</small>
            </div>
            <div className="framework-line">
              <span>02</span>
              <strong>Quality</strong>
              <small>기업의 지속성</small>
            </div>
            <div className="framework-line">
              <span>03</span>
              <strong>Dividend</strong>
              <small>주주환원의 가치</small>
            </div>
            <Link href="/methodology" className="hero-method-link">
              투자 철학과 평가 기준 <span>↗</span>
            </Link>
          </div>
        </section>
        <section className="overview" aria-label="데이터 수집 현황">
          <div className="overview-heading">
            <span className="section-overline">UNIVERSE SNAPSHOT</span>
            <span className="section-meta">
              {updated
                ? "최근 수집 " +
                  new Date(updated).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })
                : "아직 수집된 데이터가 없습니다"}
            </span>
          </div>
          <div className="stats">
            <div className="stat-card">
              <div className="stat-label">
                모니터링 종목 <span>01</span>
              </div>
              <div className="stat-value">
                {rows.length}
                <small>종목</small>
              </div>
              <div className="stat-foot">국내 주요 상장기업</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                시세 수집 완료 <span>02</span>
              </div>
              <div className="stat-value">
                {collected}
                <small>/ {rows.length}</small>
              </div>
              <div className="stat-foot">
                <div className="stat-track">
                  <div
                    style={{
                      width: `${rows.length ? (collected / rows.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span>
                  수집률 {Math.round((collected / rows.length) * 100)}%
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                전체 평가 완료 <span>03</span>
              </div>
              <div className="stat-value">
                {completed}
                <small>종목</small>
              </div>
              <div className="stat-foot">10개 항목 · 100점 배점 기준</div>
            </div>
          </div>
        </section>
        {!client && (
          <div className="notice" role="status">
            <strong>데이터 연결 대기</strong>
            <span>
              현재 등록 종목만 표시합니다. 데이터 연결 후 시세와 평가가
              표시됩니다.
            </span>
          </div>
        )}
        {result?.error && (
          <div className="notice" role="status">
            <strong>데이터를 불러오지 못했습니다</strong>
            <span>
              잠시 후 다시 확인해 주세요. 현재 등록 종목만 표시합니다.
            </span>
          </div>
        )}
        <section className="holdings" aria-labelledby="universe-title">
          <div className="section-heading">
            <div>
              <span className="section-overline">THE RESEARCH UNIVERSE</span>
              <h2 id="universe-title">
                종목 리서치 <span className="count-badge">{rows.length}</span>
              </h2>
            </div>
            <Link className="text-link" href="/methodology">
              점수 읽는 방법 ↗
            </Link>
          </div>
          <StockTable rows={rows as StockRow[]} />
        </section>
        <details className="refresh-disclosure">
          <summary>
            <span>
              <span className="section-overline">DATA MANAGEMENT</span>
              <strong>데이터 수동 갱신</strong>
            </span>
            <span className="disclosure-hint">
              관리자 도구 <b aria-hidden="true">＋</b>
            </span>
          </summary>
          <ManualRefresh />
        </details>
        <Footer />
      </main>
    </div>
  );
}

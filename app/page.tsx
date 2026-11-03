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
        <section className="workspace-heading" aria-labelledby="page-title">
          <div>
            <span className="workspace-kicker">Value · Quality · Dividend</span>
            <h1 id="page-title">종목 리서치</h1>
            <p>가격과 기업의 질, 주주환원을 같은 기준으로 살펴보세요.</p>
          </div>
          <div className="workspace-context">
            <span className="collection-status">
              <span className="status-dot" aria-hidden="true" />
              {collected > 0
                ? "시세 " + collected + "종목 수집"
                : "시세 수집 대기"}
            </span>
            <span className="section-meta">
              {updated
                ? "최근 수집 " +
                  new Date(updated).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })
                : "수집된 데이터가 아직 없습니다"}
            </span>
            <Link className="text-link" href="/methodology">
              평가 기준 알아보기 →
            </Link>
          </div>
        </section>
        <section className="overview" aria-label="데이터 수집 현황">
          <div className="stats">
            <div className="stat-card">
              <div className="stat-label">모니터링 종목</div>
              <div className="stat-value">
                {rows.length}
                <small>종목</small>
              </div>
              <div className="stat-foot">국내 주요 상장기업</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">시세 수집 완료</div>
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
              <div className="stat-label">전체 평가 완료</div>
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
              <h2 id="universe-title">
                모니터링 종목 <span className="count-badge">{rows.length}</span>
              </h2>
            </div>
            <Link className="text-link" href="/methodology">
              점수 읽는 방법 →
            </Link>
          </div>
          <StockTable rows={rows as StockRow[]} />
        </section>
        <details className="refresh-disclosure">
          <summary>
            <span>
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

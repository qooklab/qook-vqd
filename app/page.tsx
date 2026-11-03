import Link from "next/link";
import { db } from "@/lib/db";
import { stocks, calculate } from "@/lib/stocks";
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
            <div className="workspace-kicker">국내 주식 / Research</div>
            <h1 id="page-title">
              종목 리서치<span className="title-period">.</span>
            </h1>
            <p>가격, 기업의 질, 주주환원을 한 기준으로.</p>
          </div>
          <div className="workspace-context">
            <span className="section-meta">
              {updated
                ? "최근 수집 " +
                  new Date(updated).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })
                : "데이터 수집 대기"}
            </span>
            <Link className="manage-link" href="/manage">
              데이터 관리 <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
        <section className="summary-strip" aria-label="데이터 수집 현황">
          <div>
            <span>관찰 종목</span>
            <strong>
              {rows.length}
              <small>종목</small>
            </strong>
          </div>
          <div>
            <span>시세 수집</span>
            <strong>
              {collected}
              <small>/ {rows.length}</small>
            </strong>
          </div>
          <div>
            <span>전체 평가 완료</span>
            <strong>
              {completed}
              <small>종목</small>
            </strong>
          </div>
          <span className="summary-note">확인된 데이터만 평가합니다.</span>
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
                전체 종목 <span className="count-badge">{rows.length}</span>
              </h2>
            </div>
            <Link className="text-link" href="/methodology">
              점수 읽는 방법 →
            </Link>
          </div>
          <StockTable rows={rows as StockRow[]} />
        </section>
        <Footer />
      </main>
    </div>
  );
}

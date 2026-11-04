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
        <section className="research-hero" aria-labelledby="page-title">
          <div className="hero-eyebrow"><span className="signal-dot" /> INDEPENDENT EQUITY RESEARCH <span>SEOUL, KR</span></div>
          <div className="hero-composition">
            <div className="hero-copy">
              <span className="hero-index">01 — THE RESEARCH</span>
              <h1 id="page-title">가격 너머의<br />가치를 보다<span className="title-period">.</span></h1>
              <p>가격, 기업의 질, 주주환원.<br />좋은 기업을 알아보는 세 가지 관점.</p>
              <a className="hero-cta" href="#universe-title">종목 살펴보기 <span aria-hidden="true">↘</span></a>
            </div>
            <div className="value-instrument" aria-hidden="true">
              <div className="instrument-caption"><span>Q / VQD</span><span>RESEARCH INSTRUMENT — 001</span></div>
              <svg viewBox="0 0 460 460" className="instrument-dial">
                <circle cx="230" cy="230" r="196" fill="none" stroke="currentColor" strokeWidth="0.7" />
                {Array.from({length: 72}, (_, i) => {
                  const a = i * Math.PI / 36;
                  const major = i % 6 === 0;
                  return <line key={i} x1={230 + Math.sin(a) * (major ? 178 : 185)} y1={230 - Math.cos(a) * (major ? 178 : 185)} x2={230 + Math.sin(a) * 191} y2={230 - Math.cos(a) * 191} stroke="currentColor" strokeWidth={major ? 1.5 : 0.7} />;
                })}
                <circle cx="230" cy="230" r="145" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth=".7" />
                <path d="M230 72V388M72 230H388" stroke="currentColor" strokeOpacity=".15" strokeWidth=".7" />
                <circle cx="230" cy="230" r="104" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth=".7" />
                <path className="instrument-arc" d="M230 34a196 196 0 0 1 169.7 294" fill="none" stroke="var(--accent)" strokeWidth="3" />
                <g className="instrument-needle"><path d="M230 230L321 139" stroke="var(--accent)" strokeWidth="2" /><circle cx="321" cy="139" r="7" fill="var(--accent)" /></g>
                <circle cx="230" cy="230" r="5" fill="var(--accent)" />
                <text x="230" y="125" textAnchor="middle">VALUE</text>
                <text x="112" y="289" textAnchor="middle">QUALITY</text>
                <text x="342" y="289" textAnchor="middle">DIVIDEND</text>
                <text x="230" y="270" textAnchor="middle" className="dial-wordmark">vqd.</text>
              </svg>
              <div className="instrument-caption"><span>THREE LENSES. ONE STANDARD.</span><span>↗</span></div>
            </div>
          </div>
          <div className="hero-baseline">
            <span>VALUE, QUALITY &amp; DIVIDEND</span>
            <span>{updated ? "최근 수집 " + new Date(updated).toLocaleString("ko-KR", {timeZone: "Asia/Seoul"}) : "데이터 수집 대기"}</span>
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

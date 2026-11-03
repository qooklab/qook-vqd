import Link from "next/link";

export function Header() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/" aria-label="Qook VQD 홈">
          <span className="brand-mark">Q.</span>
          <span>
            Qook<span className="brand-accent">VQD</span>
            <small>INVESTMENT RESEARCH</small>
          </span>
        </Link>
        <nav aria-label="주 메뉴">
          <Link href="/">종목 리서치</Link>
          <Link href="/methodology">
            평가 기준 <span aria-hidden="true">↗</span>
          </Link>
        </nav>
        <span className="market-tag">
          <span className="status-dot" /> KOREA EQUITIES
        </span>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <span>
        © Qook VQD <span className="footer-divider">/</span> VALUE, QUALITY &
        DIVIDEND
      </span>
      <span>
        수집 시점 기준 데이터 · 투자 판단의 책임은 투자자에게 있습니다.
      </span>
    </footer>
  );
}

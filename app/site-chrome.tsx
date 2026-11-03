"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const path = usePathname();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/" aria-label="Qook VQD 홈">
          <span className="brand-mark" aria-hidden="true">
            Q.
          </span>
          <span>
            Qook<span className="brand-accent">VQD</span>
          </span>
        </Link>
        <nav aria-label="주 메뉴">
          <Link
            href="/"
            aria-current={
              path === "/" || path.startsWith("/stocks/") ? "page" : undefined
            }
          >
            종목 리서치
          </Link>
          <Link
            href="/methodology"
            aria-current={path === "/methodology" ? "page" : undefined}
          >
            평가 기준
          </Link>
        </nav>
        <span className="market-tag">국내 주식</span>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <span>© Qook VQD · Value, Quality & Dividend</span>
      <span>
        수집 시점 기준 데이터 · 투자 판단의 책임은 투자자에게 있습니다.
      </span>
    </footer>
  );
}

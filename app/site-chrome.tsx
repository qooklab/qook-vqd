"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExperienceControls } from "./site-experience";

export function Header() {
  const path = usePathname();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/" aria-label="Qook VQD 홈">
          <span>
            qook<span className="brand-accent">VQD</span>
          </span>
        </Link>
        <nav aria-label="주 메뉴">
          <Link href="/screen" aria-current={path === "/screen" ? "page" : undefined}>전 종목 선별</Link>
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
          <Link
            href="/manage"
            aria-current={path === "/manage" ? "page" : undefined}
          >
            데이터 관리
          </Link>
        </nav>
        <ExperienceControls />
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


"use client";
import Link from "next/link";
import { Header, Footer } from "./site-chrome";
export default function ErrorView({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content" className="dashboard">
        <section className="recovery-view" aria-labelledby="error-title">
          <span className="recovery-symbol" aria-hidden="true">
            !
          </span>
          <h1 id="error-title">화면을 불러오지 못했습니다.</h1>
          <p>
            잠시 후 다시 시도해 주세요.
            <br />
            문제가 계속되면 전체 종목으로 돌아가 다른 화면을 확인할 수 있습니다.
          </p>
          <div className="recovery-actions">
            <button type="button" onClick={() => reset()}>
              다시 시도
            </button>
            <Link href="/">전체 종목으로</Link>
          </div>
        </section>
        <Footer />
      </main>
    </div>
  );
}

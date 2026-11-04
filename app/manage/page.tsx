import Link from "next/link";
import { Header, Footer } from "../site-chrome";
import ManualRefresh from "../manual-refresh";
import {watchlist} from "@/lib/market-screen";
export const dynamic = "force-dynamic";
export const metadata = { title: "데이터 관리 | Qook VQD" };
export default async function Manage() {
  const universe = await watchlist();
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content" className="dashboard manage-dashboard">
        <section className="workspace-heading">
          <div>
            <div className="workspace-kicker">리서치 / Data</div>
            <h1>
              데이터 관리<span className="title-period">.</span>
            </h1>
            <p>선택한 종목의 시세와 재무정보를 업데이트합니다.</p>
          </div>
          <Link href="/" className="text-link">
            종목 목록으로 ↗
          </Link>
        </section>
        <div className="management-surface">
          <ManualRefresh list={universe.stocks} />
        </div>
        <Footer />
      </main>
    </div>
  );
}


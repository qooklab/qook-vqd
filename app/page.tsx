import SoxCard from "./sox-card";
import Pipeline from "./pipeline";
import Link from "next/link";
import { db } from "@/lib/db";
import { calculate } from "@/lib/stocks";
import StockTable, { type StockRow } from "./stock-table";
import { Header, Footer } from "./site-chrome";
import { after } from "next/server";
import { readResearchMap, updateResearch } from "@/lib/research";
import { deriveResearch, researchFresh } from "@/lib/research-model";
import ResearchProgress from "./research-progress";
import { watchlist } from "@/lib/market-screen";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function Home() {
  const universe = await watchlist();
  const client = db();
  const result = client ? await client.from("stock_latest").select("*").in("code", universe.stocks.map(s => s[1])) : null;
  let researchError = "";
  const research = await readResearchMap(universe.stocks.map(s => s[1])).catch((error: unknown) => {
    researchError = error instanceof Error ? error.message : "평가 근거 조회 실패";
    return new Map();
  });
  const tracked = new Set(universe.stocks.map(s => s[1]));
  const pending = (result?.data || []).filter(r => tracked.has(r.code) && !researchFresh(research.get(r.code) || null));
  if (client && !researchError && process.env.DART_API_KEY && pending.length) {
    after(async () => {
      await Promise.allSettled(pending.slice(0, 3).map(r => updateResearch(r.code)));
    });
  }
  const rows = universe.stocks
    .map(([name, code]) => {
      const raw = result?.data?.find((x) => x.code === code) || {};
      const enriched = {...raw, ...deriveResearch({...raw, code}, research.get(code) || null).fields};
      return { reason: universe.reasons[code], name, code, ...enriched, ...calculate(enriched) };
    })
    .sort((a, b) => b.assessed - a.assessed);
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content" className="dashboard">
        <Pipeline universe={universe} rows={rows} available={!!client&&!result?.error&&!researchError} />
        <SoxCard />
        {pending.length > 0 && !researchError && process.env.DART_API_KEY && <ResearchProgress remaining={pending.length} />}
        {researchError && <div className="notice" role="status"><strong>평가 근거 확인 필요</strong><span>{researchError}</span></div>}
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
                관찰 종목 <span className="count-badge">{rows.length}</span>
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


import {db} from "@/lib/db";
import {readResearchMap} from "@/lib/research";
import {deriveResearch} from "@/lib/research-model";
import {calculate,stocks} from "@/lib/stocks";
import {readMarketJob} from "@/lib/market-screen";
import Link from "next/link";
import { Header, Footer } from "../site-chrome";
import ManualRefresh from "../manual-refresh";
import {watchlist} from "@/lib/market-screen";
export const dynamic = "force-dynamic";
export const metadata = { title: "데이터 관리 | Qook VQD" };
export default async function Manage() {
  const universe = await watchlist();
  const codes=universe.stocks.map(s=>s[1]);
  const [job,research,prices]=await Promise.all([readMarketJob().catch(()=>null),readResearchMap(codes),db()?.from("stock_latest").select("*").in("code",codes)]);
  if(prices?.error) throw Error("평가 현황 조회 실패");
  const missing:string[][]=Array.from({length:10},()=>[]);
  for(const [,code] of universe.stocks) {
    const row=prices?.data?.find(r=>r.code===code)??{};
    const {fields}=deriveResearch({...row,code},research.get(code)??null);
    calculate({...row,...fields}).vals.forEach((v:number|null,i:number)=>{if(v==null) missing[i].push(code);});
  }
  const catalog=new Map<string,string>(stocks.map(([name,code])=>[code,name]));
  for(const item of job?.listings??[]) if(item.group==="ST") catalog.set(item.code,item.name);
  const choices=Array.from(catalog,([code,name])=>[name,code] as const);
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
          <ManualRefresh list={universe.stocks} settings={{pins:universe.pins, revision:universe.revision, choices, missing}} />
        </div>
        <Footer />
      </main>
    </div>
  );
}


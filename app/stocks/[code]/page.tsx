import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {stocks,criteria,calculate} from '@/lib/stocks';
export const dynamic='force-dynamic';
const money=(value:unknown)=>value==null?'—':Number(value).toLocaleString('ko-KR')+'원';
export default async function Detail({params}:{params:Promise<{code:string}>}){
 const {code}=await params;
 const found=stocks.find(x=>x[1]===code);
 if(!found)notFound();
 const client=db();
 const response=client?await client.from('stock_latest').select('*').eq('code',code).maybeSingle():null;
 const raw=response?.data||{};
 const score=calculate(raw);
 return <div className="site-shell">
  <header className="topbar"><div className="topbar-inner"><Link className="brand" href="/"><span className="brand-mark">Q</span><span>Qook<span className="brand-accent">VQD</span></span></Link><div className="topbar-right"><span className="market-tag"><span className="status-dot"/> KOREA EQUITIES</span></div></div></header>
  <main className="dashboard detail-dashboard">
   <Link className="back-link" href="/">← 전체 종목으로 돌아가기</Link>
   <div className="eyebrow"><span className="eyebrow-line"/> INVESTMENT INTELLIGENCE <span className="eyebrow-muted">/ STOCK DETAIL</span></div>
   <section className="detail-hero"><div className="detail-hero-title"><span className="stock-icon">{found[0].slice(0,1)}</span><div><span className="section-overline">STOCK ANALYSIS</span><h1>{found[0]}</h1><span className="detail-code">KRX · {code}</span></div></div><span className="detail-state">{raw.price!=null?'시세 수집 완료':'시세 미수집'}</span></section>
   <div className="stats detail-stats"><div className="stat-card"><div className="stat-label">최근 수집가 <span>↗</span></div><div className="stat-value detail-value">{raw.price!=null?money(raw.price):'미수집'}</div><div className="stat-foot">KIS API 기준</div></div><div className="stat-card"><div className="stat-label">확인 점수 <span>↗</span></div><div className="stat-value detail-value">{score.assessed}<small> / {score.possible}점</small></div><div className="stat-foot">데이터 확인된 항목 기준</div></div><div className="stat-card"><div className="stat-label">적정매수가 <span>↗</span></div><div className="stat-value detail-value">{raw.buy_price!=null?money(raw.buy_price):'미산정'}</div><div className="stat-foot">미산정 값은 추정하지 않음</div></div></div>
   <section className="detail-section"><div className="section-heading"><div><span className="section-overline">VALUATION BREAKDOWN</span><h2>평가 항목별 점수</h2></div><span className="section-meta">10개 기준 · 확인된 항목만 평가</span></div>
    <div className="detail-table-wrap"><table className="detail-table"><thead><tr><th>평가항목</th><th>배점</th><th>획득 점수</th></tr></thead><tbody>{criteria.map(([label,max],i)=><tr key={label}><td><span className="criterion-index">{String(i+1).padStart(2,'0')}</span><strong>{label}</strong></td><td>{max}점</td><td>{score.vals[i]==null?<span className="detail-unrated">미평가</span>:<span className="detail-score">{score.vals[i]}점</span>}</td></tr>)}</tbody></table></div>
    <div className="detail-summary"><span>확인 점수 합계</span><strong>{score.assessed} / {score.possible}점</strong></div>
   </section>
   <div className="detail-updated">마지막 갱신: {raw.updated_at?new Date(raw.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'수집 전'}</div>
   <footer className="footer"><span>© Qook VQD · VALUE, QUALITY & DIVIDEND</span><span>투자 판단을 위한 참고 정보이며 투자 권유가 아닙니다.</span></footer>
  </main>
 </div>;
}
import Link from 'next/link';
import {db} from '@/lib/db';
import {stocks,calculate} from '@/lib/stocks';
import ManualRefresh from './manual-refresh';
export const dynamic='force-dynamic';
const number=(value:unknown)=>value==null?'—':Number(value).toLocaleString('ko-KR');
export default async function Home(){
 const client=db();
 const result=client?await client.from('stock_latest').select('*'):null;
 const rows=stocks.map(([name,code])=>{const raw=result?.data?.find(x=>x.code===code)||{};return {name,code,...raw,...calculate(raw)};}).sort((a,b)=>b.assessed-a.assessed);
 const collected=rows.filter(r=>r.price!=null).length;
 const completed=rows.filter(r=>r.complete).length;
 const updated=rows.map(r=>r.updated_at).filter(Boolean).sort().reverse()[0];
 return <div className="site-shell">
  <header className="topbar"><div className="topbar-inner"><Link className="brand" href="/"><span className="brand-mark">Q</span><span>Qook<span className="brand-accent">VQD</span></span></Link><div className="topbar-right"><span className="market-tag"><span className="status-dot"/> KOREA EQUITIES</span><span className="topbar-caption">VALUE · QUALITY · DIVIDEND</span></div></div></header>
  <main className="dashboard">
   <div className="eyebrow"><span className="eyebrow-line"/> INVESTMENT INTELLIGENCE <span className="eyebrow-muted">/ OVERVIEW</span></div>
   <section className="hero"><div><div className="hero-kicker">THE DISCIPLINE OF VALUE INVESTING</div><h1>좋은 기업을,<br/><span>합리적인 가격에.</span></h1><p>국내 우량 배당주를 한눈에 분석하고, 나만의 투자 기준으로 관리하세요.</p><div className="hero-pills"><span>VALUE</span><span>QUALITY</span><span>DIVIDEND</span></div></div><div className="hero-decoration" aria-hidden="true"><div className="hero-ring ring-one"/><div className="hero-ring ring-two"/><span>V<span>Q</span>D</span></div></section>
   <section className="overview" aria-label="포트폴리오 현황"><div className="section-heading"><div><span className="section-overline">AT A GLANCE</span><h2>포트폴리오 현황</h2></div><span className="section-meta">{updated?'최근 수집 '+new Date(updated).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'데이터 수집 대기 중'}</span></div><div className="stats"><div className="stat-card"><div className="stat-label">모니터링 종목 <span>↗</span></div><div className="stat-value">{rows.length}<small>종목</small></div><div className="stat-foot">국내 주요 상장기업</div></div><div className="stat-card"><div className="stat-label">시세 수집 완료 <span>↗</span></div><div className="stat-value">{collected}<small> / {rows.length}</small></div><div className="stat-foot"><div className="stat-track"><div style={{width:`${rows.length?collected/rows.length*100:0}%`}}/></div></div></div><div className="stat-card"><div className="stat-label">100점 평가 완료 <span>↗</span></div><div className="stat-value">{completed}<small>종목</small></div><div className="stat-foot">미확인 항목은 미평가 처리</div></div></div></section>
   {!client&&<div className="notice">Supabase 환경변수가 없어 종목 목록만 표시하고 있어요.</div>}
   <ManualRefresh/>
   <section className="holdings" aria-label="종목 분석 현황"><div className="section-heading"><div><span className="section-overline">STOCK UNIVERSE</span><h2>종목 분석 현황 <span className="count-badge">{rows.length}</span></h2></div><span className="section-meta">종목을 누르면 상세 평가를 확인할 수 있어요</span></div>
    <div className="tablewrap"><table className="stock-table"><thead><tr><th>종목명</th><th>최근 수집가</th><th>PER</th><th>PBR</th><th>평가 점수</th><th>적정매수가</th><th>업데이트</th></tr></thead><tbody>{rows.map(r=><tr key={r.code}><td><Link className="stock-link" href={`/stocks/${r.code}`}><span className="stock-icon">{r.name.slice(0,1)}</span><span><strong>{r.name}</strong><small>{r.code}</small></span><span className="stock-arrow">↗</span></Link></td><td className="price-cell">{r.price!=null?number(r.price)+'원':<span className="empty-label">미수집</span>}</td><td>{r.per??'—'}</td><td>{r.pbr??'—'}</td><td><span className={r.complete?'score-pill complete':'score-pill'}>{r.assessed} <span>/ {r.possible}</span></span></td><td>{r.buy_price!=null?number(r.buy_price)+'원':'—'}</td><td className="updated-cell">{r.updated_at?new Date(r.updated_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'—'}</td></tr>)}</tbody></table></div>
    <div className="mobile-stock-list">{rows.map(r=><Link href={`/stocks/${r.code}`} className="mobile-stock-card" key={r.code}><div className="mobile-stock-top"><span className="stock-icon">{r.name.slice(0,1)}</span><div className="mobile-stock-name"><strong>{r.name}</strong><small>{r.code}</small></div><div className="mobile-stock-price"><strong>{r.price!=null?number(r.price)+'원':'미수집'}</strong><small>최근 수집가</small></div></div><div className="mobile-stock-bottom"><span>PER <b>{r.per??'—'}</b></span><span>PBR <b>{r.pbr??'—'}</b></span><span>평가 <b>{r.assessed}/{r.possible}</b></span><span className="mobile-chevron">↗</span></div></Link>)}</div>
   </section>
   <footer className="footer"><span>© Qook VQD · VALUE, QUALITY & DIVIDEND</span><span>시세는 KIS API 수집 시점 기준이며 투자 권유가 아닙니다.</span></footer>
  </main></div>;
}
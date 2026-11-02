import Link from 'next/link';
import {criteria} from '@/lib/stocks';
export const metadata={title:'분석 철학과 평가 기준 | Qook VQD',description:'오일전문가 저평가 우량 배당주 관점으로 설계한 Qook VQD의 10가지 평가 기준과 점수 해석 안내'};
const groups=[
 {name:'VALUE',ko:'저평가',desc:'좋은 기업이라도 너무 비싸게 사지 않는 것을 중시합니다. PER·PBR과 안전마진으로 가격의 합리성을 확인합니다.',indexes:[0,1,2]},
 {name:'DIVIDEND',ko:'배당·주주환원',desc:'현재 배당수익률뿐 아니라 배당의 지속성과 자사주 소각 등 주주환원 정책도 함께 살펴봅니다.',indexes:[3,4,5]},
 {name:'QUALITY',ko:'우량 기업',desc:'이익의 안정성, 재무 건전성, 성장성, 경쟁력을 통해 장기 보유할 수 있는 사업인지 검토합니다.',indexes:[6,7,8,9]}
];
const explanations=[
 '주가수익비율(PER)이 낮을수록 유리하게 평가하되, 적자 기업은 별도로 검토합니다.',
 '주가순자산비율(PBR)을 확인합니다. 업종별 자산 구조 차이를 함께 고려해야 합니다.',
 '추정 내재가치 대비 현재 가격에 충분한 여유가 있는지 확인합니다.',
 '현재 배당수익률을 비교합니다. 일시적인 고배당인지도 검토해야 합니다.',
 '배당금의 유지·증가 여부와 배당 중단 이력을 살펴봅니다.',
 '자사주 매입보다 실제 소각과 주식 수 감소 여부를 중요하게 봅니다.',
 '여러 해에 걸친 영업이익·순이익의 변동성과 적자 여부를 확인합니다.',
 '부채 부담과 현금흐름, 금융업의 경우 업종별 건전성 지표를 확인합니다.',
 '이익이 지속적으로 증가하는지, 일회성 이익에 의존하지 않는지 살펴봅니다.',
 '시장 지위·브랜드·전환비용 등 장기 경쟁우위를 정성적으로 검토합니다.'
];
export default function Methodology(){
 return <div className="site-shell"><header className="topbar"><div className="topbar-inner"><Link className="brand" href="/"><span className="brand-mark">Q</span><span>Qook<span className="brand-accent">VQD</span></span></Link><span className="market-tag">INVESTMENT FRAMEWORK</span></div></header>
 <main className="dashboard methodology-page"><Link href="/" className="back-link">← 대시보드로 돌아가기</Link>
 <div className="eyebrow"><span className="eyebrow-line"/> INVESTMENT PHILOSOPHY <span className="eyebrow-muted">/ METHODOLOGY</span></div>
 <section className="method-intro"><span className="section-overline">WHY WE INVEST THIS WAY</span><h1>저평가된 좋은 기업을 찾고,<br/><span>배당과 주주환원으로 기다린다.</span></h1><p>Qook VQD는 ‘오일전문가 저평가 우량 배당주’라는 투자 관점을 바탕으로 가격·기업의 질·주주환원을 함께 살펴보는 개인 투자 분석 도구입니다.</p><div className="method-note">이 페이지의 100점 배점과 구체적인 계산 규칙은 Qook VQD에서 자체 설계한 기준이며, ‘오일전문가’가 직접 공인하거나 발표한 공식 점수표라는 뜻은 아닙니다.</div></section>
 <section className="method-section"><div className="section-heading"><div><span className="section-overline">THREE PILLARS</span><h2>투자 판단의 세 가지 축</h2></div></div><div className="method-grid">{groups.map((g,i)=><article className="method-card" key={g.name}><span className="method-index">0{i+1} / {g.name}</span><h3>{g.ko}</h3><p>{g.desc}</p><div className="method-total">{g.indexes.reduce((sum,index)=>sum+criteria[index][1],0)}<small> / 100점</small></div></article>)}</div></section>
 <section className="method-section"><div className="section-heading"><div><span className="section-overline">SCORING FRAMEWORK</span><h2>10가지 평가 항목</h2></div><span className="section-meta">합계 100점</span></div><div className="method-criteria">{criteria.map(([label,max],i)=><article className="method-criterion" key={label}><div className="method-criterion-head"><span className="method-criterion-number">{String(i+1).padStart(2,'0')}</span><strong>{label}</strong><span className="method-criterion-points">{max}점</span></div><p>{explanations[i]}</p></article>)}</div></section>
 <section className="method-section"><div className="section-heading"><div><span className="section-overline">HOW TO READ THE SCORE</span><h2>점수를 해석하는 방법</h2></div></div><div className="method-guidance"><p><strong>20 / 100점</strong>은 100점 만점 기준 현재 확인된 점수입니다. 예를 들어 PER과 PBR만 수집되어 20점 배점이 평가된 경우, <strong>평가 가능 20점 / 전체 100점</strong>으로 별도 표시합니다.</p><p>데이터가 없는 항목은 0점으로 단정하지 않고 <strong>미평가</strong>로 둡니다. 따라서 일부 항목만 수집된 종목의 점수를 전체 평가 완료 종목과 직접 비교하면 안 됩니다.</p><p>현재 자동 계산되는 값은 PER·PBR 및 배당수익률(데이터가 있는 경우)입니다. 안전마진·배당 이력·재무 건전성 등은 검증된 추가 데이터가 있어야 점수가 채워집니다. 적정매수가 역시 검증 가능한 산정 근거가 없으면 미산정으로 표시합니다.</p></div></section>
 <div className="method-footer-action"><Link href="/">종목 분석 보러 가기 →</Link></div>
 <footer className="footer"><span>© Qook VQD · VALUE, QUALITY & DIVIDEND</span><span>투자 참고용 자체 평가 체계 · 투자 권유 아님</span></footer>
 </main></div>;
}
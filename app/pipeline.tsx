import FlowCanvas from "./flow-canvas";
import Link from "next/link";
import type {watchlist} from "@/lib/market-screen";
import {SCREEN_POLICY as policy} from "@/lib/market-model";
import {criteria} from "@/lib/stocks";
import {RecentViews} from "./recent-views";

const number=(value:number|undefined)=>value===undefined?"—":value.toLocaleString("ko-KR");
const date=(value:string)=>new Date(value).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});
export default function Pipeline({universe,rows,available}:{
  universe:Awaited<ReturnType<typeof watchlist>>;
  rows:{vals:(number|null)[];complete:boolean}[];available:boolean;
}){
  const {run,history}=universe;
  const assessed=rows.filter(r=>r.complete).length;
  const partial=rows.filter(r=>!r.complete && r.vals.some(v=>v!=null)).length;
  const states={running:"수집 중",partial:"일부 수집",complete:"선별 완료"};
  return <section className="pipeline" aria-labelledby="pipeline-title">
    <header><div><h1 id="pipeline-title">종목 리서치 대시보드</h1><p>{run?states[run.status]+" · 종목 목록 기준 "+date(run.sourceAt):"시장 수집 기록 대기"}</p></div><Link href="/manage">데이터 관리 ↗</Link></header>
    <div className="flow-map">
      <FlowCanvas/>
      <div className="flow-labels">
        <a href="/market"><span>시장 데이터 수집</span><strong>{number(run?.collected)}<small>종목</small></strong></a>
        <a href="/screen"><span>선별 기준 통과</span><strong>{number(run?.candidateCount)}<small>종목</small></strong></a>
        <a href="#universe-title"><span>상세 평가 완료</span><strong>{available?assessed:"—"}<small>종목</small></strong></a>
      </div>
    </div>
    <details><summary>단계별 데이터와 선별 기준</summary><ol className="pipeline-flow">
      <li><h2>시장 데이터 수집</h2><strong>{number(run?.collected)}<small>종목 시세 확보</small></strong>
        <progress aria-label="시세 확보율" max={run?.eligible||1} value={run?.collected??0}/>
        <p>상장 주권 {number(run?.stockCount)}개 중 시세 조회 대상 {number(run?.eligible)}개 · 실패 {number(run?.failed)}개</p>
        <p>KIS 종목 목록에서 시가총액·ROE를 읽고, 대상 종목의 현재가·PER·PBR·거래량을 수집합니다.</p><Link href="/market">전체 데이터 보기 →</Link></li>
      <li><h2>후보 선별</h2><strong>{number(run?.candidateCount)}<small>종목 조건 통과</small></strong>
        <p>보통주 · 시가총액 {number(policy.minCap)}억원 이상 · ROE {policy.minRoe}% 이상 · 양수 PER {policy.maxPer} 이하 · 양수 PBR {policy.maxPbr} 이하</p>
        <p>가격 점수와 시가총액 순으로 선별합니다. 현재 {rows.length}개 추적 중 · 고정 {universe.pins.length}개 · {universe.published?"자동 선별":"초기 목록"} {rows.length-universe.pins.length}개</p>
        <Link href="/screen">선별 결과 보기 →</Link></li>
      <li><h2>상세 평가</h2><strong>{available?assessed:"—"}<small>/ {rows.length}종목 평가 완료</small></strong>
        <progress aria-label="상세 평가 완료율" max={rows.length||1} value={available?assessed:0}/>
        <p>{available?`일부 평가 ${partial}개 · 미평가 ${rows.length-assessed-partial}개`:"평가 현황 조회 대기"}</p>
        <p>KIS 시세와 DART의 5년 배당·자사주 소각·3년 재무 자료로 10개 항목을 평가합니다.</p><Link href="/methodology">100점 평가 기준 →</Link></li>
    </ol></details>
    <details><summary>평가 항목별 데이터 확보 현황</summary><div className="coverage-grid">{criteria.map(([label,points],i)=>{
      const count=rows.filter(r=>r.vals[i]!=null).length;
      return <div key={label}><span>{label} · {points}점</span><b>{available?count:"—"} / {rows.length}</b><progress aria-label={label+" 평가 종목 수"} value={available?count:0} max={rows.length||1}/></div>;
    })}</div></details>
    <details><summary>시장 선별 기록 · 최근 {history.length}회</summary>{history.length?history.map(h=><details key={h.id}><summary>{date(h.at)} · {{complete:"완료",partial:"일부 수집",interrupted:"재시작 전 중단"}[h.status]} · 조건 통과 {h.passed}개</summary><p>대상 {h.eligible}개 · 수집 {h.collected}개 · 실패 {h.failed}개</p><p>당시 자동 선별 후보 {h.selected.length}개</p><ul>{h.selected.map(s=><li key={s.code}><Link href={`/stocks/${s.code}`}>{s.name} · {s.code}</Link></li>)}</ul></details>):<p>선별 회차가 종료되면 수집 결과와 당시 후보가 저장됩니다.</p>}</details>
    <RecentViews/>
  </section>;
}
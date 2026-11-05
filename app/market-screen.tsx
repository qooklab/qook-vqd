"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import type {publicScreen} from "@/lib/market-model";
type Status=ReturnType<typeof publicScreen>;
const fmt=(value:number)=>value.toLocaleString("ko-KR");
export default function MarketScreen(){
  const [data,setData]=useState<Status|null>(null),[error,setError]=useState(""),[active,setActive]=useState(true),[secret,setSecret]=useState(""),[busy,setBusy]=useState(false),[tick,setTick]=useState(0);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>{
    if(!active)return;
    let alive=true;let timer:ReturnType<typeof setTimeout>;
    async function read(){
      controller.current=new AbortController();
      try{const response=await fetch("/api/screen",{cache:"no-store",signal:controller.current.signal});const json=await response.json();if(!response.ok)throw Error(json.error||"수집 상태 조회 실패");if(alive){setData(json);setError("");if(json.status!=="running")setActive(false);}}
      catch(error){if(alive&&!(error instanceof Error&&error.name==="AbortError"))setError(error instanceof Error?error.message:"상태 조회 실패");}
      finally{if(alive)timer=setTimeout(read,5000);}
    }
    void read();return()=>{alive=false;clearTimeout(timer);controller.current?.abort();};
  },[active,tick]);
  async function restart(retryOnly:boolean){
    if(!secret||busy)return;setBusy(true);setError("");
    try{const response=await fetch("/api/screen",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+secret},body:JSON.stringify({retryOnly})});const json=await response.json();if(!response.ok)throw Error(json.error||"재수집 실패");setData(json);setActive(true);setTick(t=>t+1);}
    catch(error){setError(error instanceof Error?error.message:"재수집 실패");}finally{setBusy(false);}
  }
  return <div className="market-screen"><div className="universe-context"><strong>선정되지 않은 종목도 확인하세요.</strong><Link href="/market">전체 결과·탈락 사유·개별 조회 ↗</Link></div>
    <section className="screen-policy" aria-labelledby="policy-heading"><div className="section-heading"><h2 id="policy-heading">먼저 기준을 공개합니다.</h2><span className="section-meta">자체 선별 기준 v1</span></div>
      <div className="screen-rules"><span>코스피·코스닥 주권(ST) 보통주</span><span>시가총액 ≥ 1,000억원</span><span>KIS 제공 ROE ≥ 5%</span><span>0 &lt; PER ≤ 15</span><span>0 &lt; PBR ≤ 1.5</span></div>
      <p>ETF·ETN·외국주권(FS)·예탁증서(DR)·스팩·우선주 및 거래정지·정리매매·관리종목은 제외합니다. KONEX는 포함하지 않습니다. ROE·시가총액은 종목 마스터 제공값이며 기업별 재무 기준일이 다를 수 있습니다.</p>
      <p>조건 통과 종목에 동일한 <strong>PER 10점 + PBR 10점</strong>을 적용합니다. 동점은 시가총액 내림차순·종목코드순으로 정렬합니다. 최대 30개를 선정하며 부족한 수를 임의로 채우지 않습니다. 배당은 후보 선정 후 DART에서 검증합니다.</p>
    </section>
    {error&&<div className="notice" role="alert"><strong>수집 확인 필요</strong><span>{error}</span></div>}
    {!data&&!error&&<div className="notice" role="status">공식 종목 마스터와 선별 진행률을 불러오는 중입니다.</div>}
    {data&&<>
      <section className="screen-status" aria-labelledby="screen-status-title"><div className="section-heading"><h2 id="screen-status-title">{data.status==="complete"?"전 종목 1차 선별 완료":data.status==="partial"?"일부 미수집 · 잠정 후보":"전 종목 1차 선별 중"}</h2><span className="screen-state">{data.status==="complete"?"COMPLETE":"IN PROGRESS"}</span></div>
        <div className="screen-funnel"><div><small>주권(ST) 종목</small><strong>{fmt(data.stockCount)}</strong></div><span aria-hidden="true">→</span><div><small>규모·ROE 통과</small><strong>{fmt(data.eligible)}</strong></div><span aria-hidden="true">→</span><div><small>시세 확인</small><strong>{fmt(data.collected)}<em>/{fmt(data.eligible)}</em></strong></div><span aria-hidden="true">→</span><div><small>가격조건 통과</small><strong>{fmt(data.candidateCount)}</strong></div></div>
        <progress aria-label="선별 시세 수집 진행률" value={data.collected} max={data.eligible||1}/>
        <p role="status">{data.status==="complete"?"전체 대상의 시세 확인이 끝났습니다. 아래 후보가 관찰 목록에 반영됩니다.":data.status==="partial"?`실패 ${data.failed}종목을 확인하기 전에는 전체 상위 후보로 확정하지 않습니다.`:"서버에서 묶음별로 수집 중입니다. 완료 전의 순위는 잠정 결과입니다."} {data.message}</p>
        {data.status==="running"&&<div className="screen-actions"><button onClick={()=>setActive(v=>!v)}>{active?"자동 진행 일시정지":"저장된 지점부터 이어서"}</button><span>{active?"5초마다 진행률 확인":"현재 서버 묶음 처리 후 멈춥니다."}</span></div>}
        <p className="section-meta">마스터 수집 {new Date(data.sourceAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} · 시세 수집 시작 {new Date(data.startedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}{data.completedAt?" · 완료 "+new Date(data.completedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):""}</p>
        <p>한 시점의 동시 시세가 아니라 위 수집 기간에 확인한 값입니다. 화면을 닫아도 완료된 묶음은 저장되며, 다시 열면 이어서 진행합니다.</p>
        <details><summary>모집단과 제외 내역</summary><p>마스터의 6자리 영문·숫자 코드 {fmt(data.masterCount)}개 중 주권(ST) {fmt(data.stockCount)}개를 확인했습니다. 순차 제외 사유별 수는 다음과 같습니다.</p><ul>{Object.entries(data.exclusions).map(([reason,count])=><li key={reason}>{reason}: {fmt(count)}</li>)}</ul></details>
        {data.failures.length>0&&<details><summary>미수집 종목 {data.failed}개 확인</summary>{data.failures.map(f=><p key={f.code}>{f.code} · {f.error}</p>)}{data.failed>20&&<p>처음 20개만 표시합니다.</p>}</details>}
      </section>
      <section className="screen-results" aria-labelledby="candidate-heading"><div className="section-heading"><h2 id="candidate-heading">{data.status==="complete"?"1차 선별 후보":"잠정 후보"} <span className="count-badge">{data.selected.length}</span></h2><Link className="text-link" href="/">관찰 목록과 상세 평가 →</Link></div><p>이 점수는 20점 기준의 1차 가격 점수입니다. 기존 100점 DART 상세 평가와 구분합니다. 배당·재무 검증을 마친 매수 추천 목록을 뜻하지 않습니다.</p>
        <div className="screen-table-wrap"><table className="screen-table"><caption className="sr-only">코스피·코스닥 공통 기준 선별 후보. 미완료 시 잠정 결과.</caption><thead><tr><th>순서</th><th>종목</th><th>시장</th><th>PER</th><th>PBR</th><th>ROE</th><th>시가총액(억)</th><th>1차 점수</th></tr></thead><tbody>{data.selected.map((s,i)=><tr key={s.code}><td>{String(i+1).padStart(2,"0")}</td><th scope="row">{data.status==="complete"?<Link href={`/stocks/${s.code}`}>{s.name} ↗</Link>:s.name}<small>{s.code}</small></th><td>{s.market}</td><td>{s.per?.toFixed(2)}</td><td>{s.pbr?.toFixed(2)}</td><td>{s.roe.toFixed(2)}%</td><td>{fmt(s.cap)}</td><td><strong>{s.screenScore}</strong> /20</td></tr>)}</tbody></table></div>
        {data.selected.length===0&&<p className="empty-state">아직 조건을 통과한 후보가 없습니다. 수집 진행률과 제외 내역을 확인하세요.</p>}
      </section>
    </>}
    <details className="screen-admin"><summary>관리자 재수집</summary><p>최신 마스터로 새로 수집하거나 실패 종목만 다시 확인합니다. 인증키는 서버로 전송할 때만 사용하고 저장하지 않습니다.</p><label>수동 갱신 인증키<input type="password" value={secret} autoComplete="off" onChange={e=>setSecret(e.target.value)} placeholder="CRON_SECRET"/></label><div className="screen-actions"><button disabled={!secret||busy} onClick={()=>restart(true)}>실패 종목만 재시도</button><button disabled={!secret||busy} onClick={()=>restart(false)}>최신 마스터로 전체 재수집</button></div></details>
    <p className="screen-source">종목·규모·ROE: <a href="https://github.com/koreainvestment/open-trading-api/tree/main/stocks_info" target="_blank" rel="noreferrer">한국투자증권 종목정보파일</a> · 시세·PER·PBR: KIS Open API. 조건이 공개된 자체 1차 선별입니다.</p>
  </div>;
}

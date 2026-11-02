'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {stocks} from '@/lib/stocks';
type Outcome={code:string;name:string;ok:boolean;error?:string};
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const isRateLimit=(status:number,error:string)=>status===429||error.includes('EGW00201')||error.includes('초당 거래건수');
export default function ManualRefresh(){
 const router=useRouter();
 const [selected,setSelected]=useState<string[]>([]);
 const [secret,setSecret]=useState('');
 const [running,setRunning]=useState(false);
 const [done,setDone]=useState(0);
 const [outcomes,setOutcomes]=useState<Outcome[]>([]);
 const [filter,setFilter]=useState('');
 const visible=stocks.filter(([name,code])=>name.toLowerCase().includes(filter.toLowerCase())||code.includes(filter));
 async function run(mode:'price'|'financial'='price'){
  if(!selected.length||!secret||running)return;
  setRunning(true);setDone(0);setOutcomes([]);
  const results:Outcome[]=[];
  try{
   for(const code of selected){
    const name=stocks.find(x=>x[1]===code)?.[0]||code;
    // The KIS gateway enforces a per-second request limit shared across app keys.
    // Space requests out, even when a previous request failed.
    if(results.length>0)await sleep(1500);
    let outcome:Outcome={code,name,ok:false,error:'알 수 없는 오류'};
    let stop=false;
    for(let attempt=0;attempt<4;attempt++){
     try{
      const res=await fetch('/api/refresh',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+secret},body:JSON.stringify({code,mode}),cache:'no-store'});
      const json=await res.json().catch(()=>({error:'서버 응답을 읽지 못했습니다'}));
      const error=String(json.error||'요청 실패');
      if(res.ok){outcome={code,name,ok:true};break;}
      if(isRateLimit(res.status,error)&&attempt<3){
       await sleep(2500*Math.pow(2,attempt));
       continue;
      }
      outcome={code,name,ok:false,error:isRateLimit(res.status,error)?error+' (자동 재시도 후 실패)':error};
      // Stop for invalid credentials or a persistent upstream server failure.
      stop=res.status===401||res.status===503||error.includes('KIS token HTTP')||error.includes('KIS quote HTTP 500')&&!isRateLimit(res.status,error);
      break;
     }catch(e){
      outcome={code,name,ok:false,error:String(e)};
      break;
     }
    }
    results.push(outcome);
    setOutcomes([...results]);
    setDone(results.length);
    if(stop)break;
   }
  }finally{setDone(results.length);setRunning(false);router.refresh();}
 }
 const toggle=(code:string)=>setSelected(v=>v.includes(code)?v.filter(x=>x!==code):[...v,code]);
 return <section className="manual-panel">
  <h2>선택 종목 수동 갱신</h2>
  <p>국내 전체 시장에서 현재 등록된 30종목을 선택해 최신 시세를 가져옵니다. 종목은 1.5초 간격으로 조회하고 호출 제한 시 자동 재시도합니다. 진행률을 표시합니다.</p>
  <div className="manual-controls">
   <input aria-label="종목 검색" placeholder="종목명 또는 코드 검색" value={filter} onChange={e=>setFilter(e.target.value)} disabled={running}/>
   <button type="button" onClick={()=>setSelected(stocks.map(x=>x[1]))} disabled={running}>30종목 전체 선택</button>
   <button type="button" onClick={()=>setSelected([])} disabled={running}>선택 해제</button>
  </div>
  <div className="manual-list">{visible.map(([name,code])=><label key={code}><input type="checkbox" checked={selected.includes(code)} disabled={running} onChange={()=>toggle(code)}/>{name} <small>{code}</small></label>)}</div>
  <div className="manual-controls"><input aria-label="수동 갱신 인증키" type="password" autoComplete="off" placeholder="CRON_SECRET 입력 (저장되지 않음)" value={secret} disabled={running} onChange={e=>setSecret(e.target.value)}/><button type="button" onClick={()=>run('price')} disabled={running||selected.length===0||!secret}>{running?'갱신 중…':`선택한 ${selected.length}종목 갱신`}</button><button type="button" onClick={()=>run('financial')} disabled={running||selected.length===0||!secret}>{running?'처리 중…':'선택 종목 DART 재무평가'}</button></div>
  <p><small>DART 재무평가는 시세 API 호출 없이 이익 안정성·재무 건전성·성장률을 계산합니다. 평가할 수 없는 종목은 실패 사유를 표시합니다.</small></p>
  {(running||outcomes.length>0)&&<div role="status" aria-live="polite"><progress max={selected.length||1} value={done}/><p>{done}/{selected.length} 완료 · 성공 {outcomes.filter(x=>x.ok).length} · 실패 {outcomes.filter(x=>!x.ok).length}{!running&&done<selected.length?' · 오류로 조기 중단':''}</p></div>}
  {outcomes.some(x=>!x.ok)&&<div className="manual-errors"><strong>오류 내역</strong>{outcomes.filter(x=>!x.ok).map(x=><p key={x.code}>{x.name}: {x.error}</p>)}</div>}
  <p><small>보안: CRON_SECRET은 이 화면에서만 사용하며 브라우저 저장소에 보관하지 않습니다. 공용 PC에서는 사용하지 마세요. 이 기능은 선택한 종목만 갱신하며 국내 전체 상장종목 검색은 아직 지원하지 않습니다.</small></p>
 </section>;
}

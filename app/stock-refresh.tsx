"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function StockRefresh({code}:{code:string}){
  const router=useRouter();
  const [secret,setSecret]=useState(""),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  async function run(mode:"price"|"research"){
    if(!secret||busy)return;
    setBusy(mode);setMessage("");setError("");
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000);
    try{
      const response=await fetch("/api/refresh",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+secret},body:JSON.stringify({code,mode}),signal:controller.signal});
      const json=await response.json().catch(()=>({error:"서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요."}));
      if(!response.ok||!json.ok)throw Error(json.error||"조회 실패");
      setMessage(mode==="price"?"주가·PER·PBR 갱신 완료":json.detail||"DART 조회 완료");router.refresh();
    }catch(e){setError(e instanceof Error&&e.name==="AbortError"?"응답이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.":e instanceof Error?e.message:"조회 실패");}
    finally{clearTimeout(timer);setBusy("");}
  }
  return <section className="stock-refresh"><div><h2>이 종목만 개별 조회</h2><p>선별 여부와 관계없이 조회합니다. 주가와 DART는 각각 갱신하며, DART 조회에 필요한 시세가 없으면 먼저 가져옵니다. 공시 정상 결과는 7일간 재사용합니다.</p></div><label>수동 갱신 인증키<input type="password" autoComplete="off" placeholder="CRON_SECRET" value={secret} onChange={e=>setSecret(e.target.value)} disabled={!!busy}/></label><div className="screen-actions"><button disabled={!secret||!!busy} onClick={()=>run("price")}>{busy==="price"?"주가 조회 중…":"주가·PER·PBR 조회"}</button><button disabled={!secret||!!busy} onClick={()=>run("research")}>{busy==="research"?"DART 조회 중…":"DART 배당·재무 조회"}</button></div><p>인증키는 이 화면에서만 사용하며 저장하지 않습니다. 자동 선정 30개 목록에는 영향을 주지 않습니다.</p>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>;
}

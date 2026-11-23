"use client";
import ChartScrubber from "./chart-scrubber";
import {useEffect,useMemo,useState} from "react";
import type {Candle} from "@/lib/kis";
import "./price-chart.css";
type History={bars:Candle[];today:string;checkedAt:string};
const fmt=(v:number)=>v.toLocaleString("ko-KR");
const dateLabel=(s:string)=>s.slice(0,4)+"."+s.slice(4,6)+"."+s.slice(6);
export default function PriceChart({code,entry}:{code:string;entry:number|null}){
  const [period,setPeriod]=useState("D"),[months,setMonths]=useState(3),[attempt,retry]=useState(0);
  const [data,setData]=useState<History|null>(null),[error,setError]=useState(false),[selected,select]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    setData(null);setError(false);select(null);
    fetch("/api/chart?code="+code+"&period="+period,{signal:controller.signal}).then(async response=>{
      if(!response.ok) throw Error();
      const history:History=await response.json();
      if(!controller.signal.aborted)setData(history);
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[code,period,attempt]);
  const [showMA,setMA]=useState(true),[showBand,setBand]=useState(true),[stopText,setStop]=useState("");
  useEffect(()=>{try{setStop(localStorage.getItem("vqd-stop-"+code)??"");}catch{}},[code]);
  const stop=Number(stopText)>0 && Number.isFinite(Number(stopText))?Number(stopText):null;
  const unit=period==="D"?"일":period==="W"?"주":"개월";
  const indicators=useMemo(()=>{
    const series=data?.bars??[];
    return new Map(series.map((bar,i)=>{
      function mean(n:number){return i+1<n?null:series.slice(i+1-n,i+1).reduce((sum,b)=>sum+b.close,0)/n;}
      const mid=mean(20);
      const deviation=mid===null?null:Math.sqrt(series.slice(i-19,i+1).reduce((sum,b)=>sum+(b.close-mid)**2,0)/20);
      return [bar.date,{ma5:mean(5),ma20:mid,ma60:mean(60),upper:mid===null?null:mid+2*deviation!,lower:mid===null?null:mid-2*deviation!}] as const;
    }));
  },[data]);
  const cutoff=new Date((data?.today??"2000-01-01")+"T00:00:00Z");
  const day=cutoff.getUTCDate();
  cutoff.setUTCDate(1);cutoff.setUTCMonth(cutoff.getUTCMonth()-months+1);cutoff.setUTCDate(0);cutoff.setUTCDate(Math.min(day,cutoff.getUTCDate()));
  const first=cutoff.toISOString().slice(0,10).replace(/-/g,"");
  const bars=(data?.bars??[]).filter(b=>b.date>=first);
  const active=bars.find(b=>b.date===selected)??bars[bars.length-1];
  const model=entry!==null&&entry>0?entry:null;
  const values=bars.flatMap(b=>{const v=indicators.get(b.date)!;return [...(showMA?[v.ma5,v.ma20,v.ma60]:[]),...(showBand?[v.upper,v.lower]:[])].filter((n):n is number=>n!==null);});
  if(stop!==null)values.push(stop);
  const floor=Math.min(...values,...bars.map(b=>b.low),model??Infinity),ceil=Math.max(...values,...bars.map(b=>b.high),model??-Infinity);
  const range=Math.max(1,ceil-floor), y=(v:number)=>155-(v-floor)/range*127;
  const step=440/Math.max(1,bars.length),x=(i:number)=>8+(i+.5)*step;
  const maxVol=Math.max(1,...bars.map(b=>b.volume??0));
  const index=active?data!.bars.findIndex(b=>b.date===active.date):-1;
  const prev=index>0?data!.bars[index-1]:null;
  function points(key:"ma5"|"ma20"|"ma60"|"upper"|"lower",reverse=false){
    const coords=bars.flatMap((b,i)=>{const v=indicators.get(b.date)![key];return v===null?[]:[x(i)+","+y(v)];});
    return (reverse?coords.reverse():coords).join(" ");
  }
  const selectedValues=active?indicators.get(active.date):null;
  const averages=[["ma5",5,"#bc7100"],["ma20",20,"#19834b"],["ma60",60,"#80439e"]] as const;
  function choosePeriod(value:string){if(value!==period){setData(null);setPeriod(value);}}
  return <section className="price-history"><h2>주가 차트</h2>
    <div className="chart-controls"><div>{[["D","일봉"],["W","주봉"],["M","월봉"]].map(([k,label])=><button key={k} aria-pressed={period===k} onClick={()=>choosePeriod(k)}>{label}</button>)}</div>
    <div role="group" aria-label="보조지표">
        <button aria-pressed={showMA} onClick={()=>setMA(!showMA)}>이동평균</button>
        <button aria-pressed={showBand} onClick={()=>setBand(!showBand)}>볼린저밴드</button>
    </div><div>{[1,3,6,12].map(n=><button key={n} aria-pressed={months===n} onClick={()=>{select(null);setMonths(n);}}>{n===12?"1년":n+"개월"}</button>)}</div></div>
    {error?<p role="status">시세 조회 실패 <button onClick={()=>retry(attempt+1)}>다시 조회</button></p>:!data?<p role="status">주가 이력을 불러오는 중…</p>:!active?<p>이 기간에 표시할 시세가 없습니다.</p>:<>
      <p><strong>{dateLabel(active.date)} · {fmt(active.close)}원</strong> {prev&&<span>{period==="D"?"전일":period==="W"?"전주":"전월"} 대비 {((active.close/prev.close-1)*100).toFixed(2)}%</span>}</p>
      <p>시가 {fmt(active.open)} · 고가 {fmt(active.high)} · 저가 {fmt(active.low)} · 거래량 {active.volume===null?"미제공":fmt(active.volume)+"주"}</p>
      <div className="chart-controls">

        <label>내 손절선(원) <input className="stop-price" type="number" min="1" placeholder="미설정" value={stopText} onChange={e=>{setStop(e.target.value);try{localStorage.setItem("vqd-stop-"+code,e.target.value);}catch{}}}/></label>
      </div>
      {showMA&&<p>{averages.map(([key,n,color])=><span key={key} style={{marginRight:12,color}}>{n}{unit} 평균 {selectedValues?.[key]!=null?fmt(Math.round(selectedValues[key]!)):"—"}</span>)}</p>}
      {showBand&&<p>볼린저밴드(20봉) · 하단 {selectedValues?.lower!=null?fmt(Math.round(selectedValues.lower)):"—"} · 상단 {selectedValues?.upper!=null?fmt(Math.round(selectedValues.upper)):"—"}</p>}
      <svg viewBox="0 0 530 220" role="img" aria-label="수정주가 캔들과 거래량" onPointerDown={e=>{
        const svg=e.currentTarget,point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
        const matrix=svg.getScreenCTM();if(matrix)select(bars[Math.min(bars.length-1,Math.max(0,Math.floor((point.matrixTransform(matrix.inverse()).x-8)/step)))].date);
      }}>
        {[ceil,(floor+ceil)/2,floor].map((v,i)=><g key={i}><line x1="8" x2="449" y1={y(v)} y2={y(v)} stroke="#d9deda"/><text x="453" y={y(v)+4}>{fmt(Math.round(v))}</text></g>)}
        {showBand&&<polygon fill="#8595a9" opacity=".22" points={points("upper")+" "+points("lower",true)}/>}
        {bars.map((b,i)=>{const color=b.close>=b.open?"#b43c39":"#346bac";return <g key={b.date} fill={color}><line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={color}/><rect x={x(i)-step*.32} y={Math.min(y(b.open),y(b.close))} width={step*.64} height={Math.max(1,Math.abs(y(b.open)-y(b.close)))}/>{b.volume!==null&&<rect x={x(i)-step*.32} y={199-b.volume/maxVol*30} width={step*.64} height={b.volume/maxVol*30} opacity=".65"/>}</g>})}
        {showMA&&averages.map(([key,,color])=><polyline key={key} points={points(key)} stroke={color} fill="none" strokeWidth="1.7"/>)}
        {stop!==null&&<line x1="8" x2="449" y1={y(stop)} y2={y(stop)} stroke="#b43c39" strokeDasharray="7 3"/>}
        {model!==null&&<line x1="8" x2="449" y1={y(model)} y2={y(model)} stroke="#396448" strokeWidth="1.6" strokeDasharray="5 3"/>}
        <line x1={x(bars.indexOf(active))} x2={x(bars.indexOf(active))} y1="12" y2="199" stroke="#495147" strokeDasharray="2 4"/>
        <text x="8" y="216">{dateLabel(bars[0].date)}</text><text x="448" y="216" textAnchor="end">{dateLabel(bars[bars.length-1].date)}</text>
      </svg>
      <ChartScrubber label="확인할 봉 선택" start={x(0)/530} end={x(bars.length-1)/530} max={bars.length-1} value={bars.indexOf(active)} onSelect={i=>select(bars[i].date)}/>
      <p>점선 · 현재 모형 매수기준 {model===null?"미산정":fmt(model)+"원"}</p>
      <small>한국투자증권 · KRX 수정주가 · 조회 {new Date(data.checkedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</small>
    </>}
  </section>;
}
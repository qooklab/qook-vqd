"use client";
import ChartScrubber from "./chart-scrubber";
import {useEffect,useRef,useState} from "react";
const source="https://www.tradingview.com/symbols/NASDAQ-SOX/";
type Point={date:string;value:number};
const periods=[[1,"1M"],[3,"3M"],[6,"6M"],[12,"12M"],[36,"36M"]] as const;
const fmt=(v:number)=>v.toLocaleString("ko-KR",{maximumFractionDigits:2});
function readCsv(csv:string){
  const rows=new Map<string,number>();
  for(const line of csv.trim().split(/\r?\n/)){
    const [date,text]=line.trim().split(",");
    const value=Number(text);
    if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(value)&&value>0)rows.set(date,value);
  }
  return Array.from(rows,([date,value])=>({date,value})).sort((a,b)=>a.date.localeCompare(b.date));
}
export default function SoxCard(){
  const host=useRef<HTMLDivElement>(null);
  const [period,setPeriod]=useState(12),[data,setData]=useState<Point[]>([]),[message,setMessage]=useState(""),[pick,setPick]=useState<number|null>(null);
  useEffect(()=>{
    if(!host.current||data.length)return;
    const widget=document.createElement("div");widget.className="tradingview-widget-container__widget";widget.style.height="100%";
    const script=document.createElement("script");script.async=true;script.src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.textContent=JSON.stringify({autosize:true,symbol:"NASDAQ:SOX",interval:"D",range:periods.find(([n])=>n===period)?.[1],timezone:"America/New_York",locale:"kr",theme:"light",style:"2",hide_side_toolbar:true,allow_symbol_change:false,withdateranges:true,studies:["STD;SMA"]});
    const node=document.createElement("div");node.className="tradingview-widget-container";node.style.height="100%";node.append(widget,script);host.current.append(node);
    return ()=>{node.remove();};
  },[period,data]);
  const last=data[data.length-1],prev=data[data.length-2];
  const cutoff=new Date((last?.date??"2000-01-01")+"T00:00:00Z");
  const day=cutoff.getUTCDate();cutoff.setUTCDate(1);cutoff.setUTCMonth(cutoff.getUTCMonth()-period+1);cutoff.setUTCDate(0);cutoff.setUTCDate(Math.min(day,cutoff.getUTCDate()));
  const visible=data.filter(p=>p.date>=cutoff.toISOString().slice(0,10));
  const low=Math.min(...visible.map(p=>p.value)),high=Math.max(...visible.map(p=>p.value));
  const avg=data.length>=20?data.slice(-20).reduce((s,p)=>s+p.value,0)/20:null;
  const percent=(a:number,b:number)=>((a/b-1)*100).toFixed(2)+"%";
  const pos=pick!==null&&visible[pick]?pick:visible.length-1;
  return <section className="price-history"><h2>필라델피아 반도체지수 (SOX)</h2>
    <div className="chart-controls"><div>{periods.map(([n])=><button key={n} aria-pressed={period===n} onClick={()=>{setPeriod(n);setPick(null);}}>{n>=12?n/12+"년":n+"개월"}</button>)}</div></div>
    {!last?<><div ref={host} style={{height:360,marginTop:12}}/><a href={source} target="_blank" rel="noopener nofollow">SOX 지수 차트 · TradingView</a></>:<>
      <p><strong>{fmt(last.value)}</strong> · {last.date} 종가 · 전일 대비 {prev?percent(last.value,prev.value):"—"}</p>
      <svg role="img" aria-label="선택 기간 SOX 종가" viewBox="0 0 500 160" onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();setPick(Math.max(0,Math.min(visible.length-1,Math.round((((e.clientX-r.left)/r.width*500-5)/490)*(visible.length-1)))));}}>
        <polyline fill="none" stroke="#934547" strokeWidth="2" points={visible.map((p,i)=>(5+490*i/Math.max(1,visible.length-1))+","+(150-140*(p.value-low)/(high-low||1))).join(" ")}/>
      </svg>
      <ChartScrubber label="SOX 기준일 선택" start={5/500} end={visible.length>1?495/500:5/500} max={visible.length-1} value={pos} onSelect={i=>setPick(i)}/>
      <p>{visible[pos].date} · {fmt(visible[pos].value)}</p><p>기간 최고 {fmt(high)} · 최저 {fmt(low)} · 기간 등락률 {percent(last.value,visible[0].value)} · 20거래일 평균 대비 {avg?percent(last.value,avg):"—"}</p>
      <button onClick={()=>{setData([]);setMessage("");}}>공식 위젯 보기</button>
    </>}
    <details><summary>FRED 일별 자료로 기간 통계 보기</summary><p><a href="https://fred.stlouisfed.org/graph/fredgraph.csv?id=NASDAQSOX">FRED SOX CSV 받기</a> · 파일을 선택하면 이 브라우저에서 계산합니다.</p><input type="file" accept=".csv,text/csv" aria-label="SOX 일별 CSV" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const csv=await file.text();if(!csv.split(/\r?\n/)[0].includes("NASDAQSOX"))throw Error();const parsed=readCsv(csv);if(!parsed.length)throw Error();setData(parsed);setPick(null);setMessage("");}catch{setMessage("NASDAQSOX 일별 CSV를 확인하세요.");}}}/>{message&&<p role="status">{message}</p>}</details>
  </section>;
}
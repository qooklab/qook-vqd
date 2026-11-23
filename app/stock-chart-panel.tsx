"use client";
import dynamic from "next/dynamic";
import {useEffect,useRef,useState} from "react";
import "./stock-chart-panel.css";

const PriceChart = dynamic(() => import("./price-chart"), {
  loading: () => <p role="status">차트를 준비하고 있어요…</p>,
});

function TradingChart({code}:{code:string}) {
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const container=host.current;
    if(!container)return;
    const widget=document.createElement("div");
    widget.className="tradingview-widget-container__widget";
    widget.style.height="100%";
    const script=document.createElement("script");
    script.src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async=true;
    script.textContent=JSON.stringify({autosize:true,symbol:"KRX:"+code,interval:"D",timezone:"Asia/Seoul",theme:"light",locale:"kr",allow_symbol_change:false});
    container.append(widget,script);
    return ()=>container.replaceChildren();
  },[code]);
  return <div className="tv-stock-chart"><div className="tradingview-widget-container" ref={host}/></div>;
}

export default function StockChartPanel({code,name,entry}:{code:string;name:string;entry:number|null}) {
  const [open,setOpen] = useState(true);
  const [view,setView]=useState("tv");
  return <div className="stock-chart-panel">
    <button type="button" aria-expanded={open} aria-controls="stock-price-plot"
      onClick={()=>setOpen(value=>!value)}>
      <span>{name} 주가 차트 {open?"접기":"보기"}</span>
      <span aria-hidden="true">{open?"−":"+"}</span>
    </button>
    <div id="stock-price-plot" hidden={!open}>
      <div className="chart-switch" role="group" aria-label="차트 선택">
        <button aria-pressed={view==="tv"} onClick={()=>setView("tv")}>TradingView</button>
        <button aria-pressed={view==="basic"} onClick={()=>setView("basic")}>기본 차트</button>
      </div>
      {view==="basic" && <PriceChart code={code} entry={entry}/>}
      {view==="tv" && <><TradingChart code={code}/>
      <p>위젯에서 시세가 표시되지 않으면 기본 차트를 선택하거나 TradingView에서 열어 주세요.</p>
      <a className="text-link" href={`https://www.tradingview.com/chart/?symbol=KRX%3A${encodeURIComponent(code)}`} target="_blank" rel="noopener noreferrer">TradingView에서 {name} 차트 열기 ↗</a></>}
    </div>
  </div>;
}

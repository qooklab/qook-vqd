"use client";
import dynamic from "next/dynamic";
import {useState} from "react";
import "./stock-chart-panel.css";

const PriceChart = dynamic(() => import("./price-chart"), {
  loading: () => <p role="status">차트를 준비하고 있어요…</p>,
});

export default function StockChartPanel({code,name,entry}:{code:string;name:string;entry:number|null}) {
  const [open,setOpen] = useState(true);
  return <div className="stock-chart-panel">
    <button type="button" aria-expanded={open} aria-controls="stock-price-plot"
      onClick={()=>setOpen(value=>!value)}>
      <span>{name} 주가 차트 {open?"접기":"보기"}</span>
      <span aria-hidden="true">{open?"−":"+"}</span>
    </button>
    <div id="stock-price-plot" hidden={!open}>
      <a className="text-link" href={`https://www.tradingview.com/symbols/KRX-${encodeURIComponent(code)}/`} target="_blank" rel="noopener noreferrer">TradingView에서 {name} ({code}) 열기 ↗</a>
      <PriceChart key={code} code={code} entry={entry}/>
    </div>
  </div>;
}

"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type Visit={code:string;name:string;at:string};
const key="vqd:recent-stocks:v1";
function read():Visit[] {
  try {
    const rows:unknown=JSON.parse(localStorage.getItem(key)??"[]");
    return Array.isArray(rows)?rows.filter(row=>row && typeof row.name==="string" && /^[A-Z0-9]{6}$/.test(row.code) && Number.isFinite(Date.parse(row.at))).slice(0,30):[];
  } catch {return [];}
}
export function RememberStock({code,name}:{code:string;name:string}) {
  useEffect(()=>{
    const rows=[{code,name,at:new Date().toISOString()},...read().filter(row=>row.code!==code)].slice(0,30);
    try {localStorage.setItem(key,JSON.stringify(rows));} catch {}
  },[code,name]);
  return null;
}
export function RecentViews(){
  const [rows,setRows]=useState<Visit[]>([]);
  useEffect(()=>{const sync=()=>setRows(read());sync();window.addEventListener("pageshow",sync);window.addEventListener("storage",sync);return ()=>{window.removeEventListener("pageshow",sync);window.removeEventListener("storage",sync);};},[]);
  return <details><summary>최근 조회 종목 · 이 브라우저 {rows.length}개</summary>{rows.length?<ul>{rows.map(row=><li key={row.code}><Link href={`/stocks/${row.code}`}>{row.name}</Link> · {new Date(row.at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</li>)}</ul>:<p>종목 상세를 열면 최근 조회한 순서로 표시됩니다.</p>}</details>;
}
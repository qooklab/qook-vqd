'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
export type StockRow={name:string;code:string;price:number|null;per:number|null;pbr:number|null;assessed:number;possible:number;complete:boolean;buy_price:number|null;updated_at:string|null};
type Key='name'|'price'|'per'|'pbr'|'assessed'|'buy_price'|'updated_at';
const cols:{key:Key;label:string}[]=[{key:'name',label:'종목명'},{key:'price',label:'최근 수집가'},{key:'per',label:'PER'},{key:'pbr',label:'PBR'},{key:'assessed',label:'평가 점수'},{key:'buy_price',label:'적정매수가'},{key:'updated_at',label:'업데이트'}];
const fmt=(v:number|null)=>v==null?'—':v.toLocaleString('ko-KR');
export default function StockTable({rows}:{rows:StockRow[]}){
 const [sort,setSort]=useState<Key>('assessed');
 const [direction,setDirection]=useState<'asc'|'desc'>('desc');
 const ordered=useMemo(()=>[...rows].sort((a,b)=>{
  const av=a[sort],bv=b[sort];
  if(av==null&&bv==null)return a.name.localeCompare(b.name,'ko');
  if(av==null)return 1;if(bv==null)return -1;
  const comparison=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'ko');
  return (direction==='asc'?comparison:-comparison)||a.name.localeCompare(b.name,'ko');
 }),[rows,sort,direction]);
 const change=(key:Key)=>{if(sort===key)setDirection(v=>v==='asc'?'desc':'asc');else{setSort(key);setDirection(key==='name'?'asc':'desc');}};
 return <><div className="sort-mobile"><label htmlFor="stock-sort">정렬 기준</label><select id="stock-sort" value={sort} onChange={e=>change(e.target.value as Key)}>{cols.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select><button type="button" onClick={()=>setDirection(v=>v==='asc'?'desc':'asc')} aria-label="정렬 방향 전환">{direction==='asc'?'↑ 오름차순':'↓ 내림차순'}</button></div>
 <div className="tablewrap"><table className="stock-table"><thead><tr>{cols.map(c=><th key={c.key} aria-sort={sort===c.key?(direction==='asc'?'ascending':'descending'):'none'}><button type="button" className="sort-header" onClick={()=>change(c.key)}>{c.label}<span aria-hidden="true">{sort===c.key?(direction==='asc'?' ↑':' ↓'):' ↕'}</span></button></th>)}</tr></thead><tbody>{ordered.map(r=><tr key={r.code}><td><Link className="stock-link" href={`/stocks/${r.code}`}><span className="stock-icon">{r.name.slice(0,1)}</span><span><strong>{r.name}</strong><small>{r.code}</small></span><span className="stock-arrow">↗</span></Link></td><td className="price-cell">{r.price!=null?fmt(r.price)+'원':<span className="empty-label">미수집</span>}</td><td>{r.per??'—'}</td><td>{r.pbr??'—'}</td><td><span className={r.complete?'score-pill complete':'score-pill'}>{r.assessed} <span>/ {r.possible}</span></span></td><td>{r.buy_price!=null?fmt(r.buy_price)+'원':'—'}</td><td className="updated-cell">{r.updated_at?new Date(r.updated_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'—'}</td></tr>)}</tbody></table></div>
 <div className="mobile-stock-list">{ordered.map(r=><Link href={`/stocks/${r.code}`} className="mobile-stock-card" key={r.code}><div className="mobile-stock-top"><span className="stock-icon">{r.name.slice(0,1)}</span><div className="mobile-stock-name"><strong>{r.name}</strong><small>{r.code}</small></div><div className="mobile-stock-price"><strong>{r.price!=null?fmt(r.price)+'원':'미수집'}</strong><small>최근 수집가</small></div></div><div className="mobile-stock-bottom"><span>PER <b>{r.per??'—'}</b></span><span>PBR <b>{r.pbr??'—'}</b></span><span>평가 <b>{r.assessed}/{r.possible}</b></span><span className="mobile-chevron">↗</span></div></Link>)}</div></>;
}

import {createHash} from 'node:crypto';
import {db} from './db';
let token:{value:string;expires:number}|null=null;
let pending:Promise<string>|null=null;
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const BASE='https://openapi.koreainvestment.com:9443';
export class KisApiError extends Error {
 constructor(public stage:'token'|'quote',public status:number,public detail:string){super(`KIS ${stage} HTTP ${status}: ${detail}`);this.name='KisApiError';}
}
async function apiError(r:Response,stage:'token'|'quote'):Promise<never>{
 const body=await r.text().catch(()=>'');
 let detail='';
 try{const data=JSON.parse(body);detail=[data.msg_cd,data.msg1||data.message].filter(x=>typeof x==='string').join(' · ');}catch{}
 // Do not return raw upstream HTML, request headers, or credentials.
 if(!detail)detail=r.status>=500?'한국투자증권 API 서버 오류 또는 일시적인 접속 장애':'API 응답 오류';
 throw new KisApiError(stage,r.status,detail.slice(0,180));
}
async function issueToken(key:string,secret:string){
 const r=await fetch(`${BASE}/oauth2/tokenP`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',appkey:key,appsecret:secret}),cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!r.ok)return apiError(r,'token');
 const j=await r.json();
 if(!j.access_token)throw Error('KIS token response missing access_token');
 const expires=Date.now()+Math.max(60,(Number(j.expires_in)||86400)-300)*1000;
 token={value:j.access_token,expires};
 return token;
}
async function getToken():Promise<string>{
 const key=process.env.KIS_APP_KEY,secret=process.env.KIS_APP_SECRET;
 if(!key||!secret)throw Error('KIS credentials missing');
 if(token&&Date.now()<token.expires)return token.value;
 const client=db();
 if(!client)throw Error('Supabase token cache requires database configuration');
 // Hash key so the app key itself is never stored in the cache table.
 const id=createHash('sha256').update(key).digest('hex');
 const read=async()=>{
  const {data,error}=await client.from('kis_token_cache').select('access_token,expires_at').eq('id',id).maybeSingle();
  if(error)throw Error('KIS token cache unavailable: apply supabase/kis_token_cache.sql');
  if(data?.access_token&&data.expires_at&&new Date(data.expires_at).getTime()>Date.now()+120000){
   token={value:data.access_token,expires:new Date(data.expires_at).getTime()-60000};
   return token.value;
  }
  return null;
 };
 const existing=await read();if(existing)return existing;
 for(let attempt=0;attempt<12;attempt++){
  const {data:locked,error}=await client.rpc('acquire_kis_token_lease',{p_id:id,p_lease_seconds:30});
  if(error)throw Error('KIS token lease unavailable: apply supabase/kis_token_cache.sql');
  if(locked){
   try{
    const cached=await read();if(cached)return cached;
    const fresh=await issueToken(key,secret);
    const {error:saveError}=await client.from('kis_token_cache').update({access_token:fresh.value,expires_at:new Date(fresh.expires).toISOString(),lock_until:null,updated_at:new Date().toISOString()}).eq('id',id);
    if(saveError)throw Error('KIS token cache save failed');
    return fresh.value;
   }finally{await client.from('kis_token_cache').update({lock_until:null}).eq('id',id);}
  }
  await wait(1500);
  const shared=await read();if(shared)return shared;
 }
 throw Error('KIS token issuance busy; retry shortly');
}
async function accessToken(){
 if(token&&Date.now()<token.expires)return token.value;
 if(!pending)pending=getToken().finally(()=>{pending=null;});
 return pending;
}

export async function quote(code:string){
 const key=process.env.KIS_APP_KEY,secret=process.env.KIS_APP_SECRET;
 if(!key||!secret)throw Error('KIS credentials missing');
 const u=new URL(`${BASE}/uapi/domestic-stock/v1/quotations/inquire-price`);
 u.searchParams.set('FID_COND_MRKT_DIV_CODE','J');
 u.searchParams.set('FID_INPUT_ISCD',code);
 const r=await fetch(u,{headers:{authorization:`Bearer ${await accessToken()}`,appkey:key,appsecret:secret,tr_id:'FHKST01010100','content-type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!r.ok)return apiError(r,'quote');
 const j=await r.json();
 if(j.rt_cd!=='0'||!j.output)throw Error(`KIS quote response: ${String(j.msg_cd||'')}: ${String(j.msg1||'unknown error').slice(0,150)}`);
 const x=j.output;
 return {price:Number(x.stck_prpr)||null,per:Number(x.per)||null,pbr:Number(x.pbr)||null,volume:Number(x.acml_vol)||null};
}


export type Candle = {date:string;open:number;high:number;low:number;close:number;volume:number|null};
export async function chartHistory(code:string, period:string) {
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const start=new Date(today+"T00:00:00Z");
  start.setUTCDate(start.getUTCDate()-(period==='M'?2250:period==='W'?820:480));
  const first=start.toISOString().slice(0,10).replace(/-/g,"");
  let end=today.replace(/-/g,"");
  const bars=new Map<string,Candle>();
  const authorization="Bearer "+await accessToken();
  for(let page=0;page<4 && end>=first;page++){
    if(page) await wait(350);
    const url=new URL(BASE+"/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice");
    url.search=new URLSearchParams({FID_COND_MRKT_DIV_CODE:"J",FID_INPUT_ISCD:code,FID_INPUT_DATE_1:first,FID_INPUT_DATE_2:end,FID_PERIOD_DIV_CODE:period,FID_ORG_ADJ_PRC:"0"}).toString();
    const response=await fetch(url,{headers:{authorization,appkey:process.env.KIS_APP_KEY!,appsecret:process.env.KIS_APP_SECRET!,tr_id:"FHKST03010100"},cache:"no-store",signal:AbortSignal.timeout(8000)});
    if(!response.ok) return apiError(response,"quote");
    const data=await response.json();
    if(data.rt_cd!=="0" || !Array.isArray(data.output2)) throw Error("기간별 시세 조회 실패");
    const dates:string[]=[];
    for(const row of data.output2){
      const date=String(row.stck_bsop_date??"");
      if(!/^\d{8}$/.test(date)||date>end) continue;
      dates.push(date);
      const [open,high,low,close]=[row.stck_oprc,row.stck_hgpr,row.stck_lwpr,row.stck_clpr].map(Number);
      if(date<first||![open,high,low,close].every(v=>Number.isFinite(v)&&v>0)||high<Math.max(open,close)||low>Math.min(open,close)) continue;
      const volume=row.acml_vol==null||String(row.acml_vol).trim()===""?null:Number(row.acml_vol);
      bars.set(date,{date,open,high,low,close,volume:volume!==null && Number.isFinite(volume)&&volume>=0?volume:null});
    }
    if(dates.length<100) break;
    const earliest=dates.sort()[0];
    const day=new Date(earliest.slice(0,4)+"-"+earliest.slice(4,6)+"-"+earliest.slice(6)+"T00:00:00Z");
    day.setUTCDate(day.getUTCDate()-1);
    end=day.toISOString().slice(0,10).replace(/-/g,"");
  }
  return {bars:Array.from(bars.values()).sort((a,b)=>a.date.localeCompare(b.date)),checkedAt:new Date().toISOString(),today};
}

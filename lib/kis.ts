let token:{value:string;expires:number}|null=null;
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
async function accessToken(){
 const key=process.env.KIS_APP_KEY,secret=process.env.KIS_APP_SECRET;
 if(!key||!secret)throw Error('KIS credentials missing');
 if(token&&Date.now()<token.expires)return token.value;
 const r=await fetch(`${BASE}/oauth2/tokenP`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',appkey:key,appsecret:secret}),cache:'no-store'});
 if(!r.ok)return apiError(r,'token');
 const j=await r.json();
 if(!j.access_token)throw Error('KIS token response missing access_token');
 token={value:j.access_token,expires:Date.now()+Math.max(60,(Number(j.expires_in)||3600)-120)*1000};
 return token.value;
}
export async function quote(code:string){
 const key=process.env.KIS_APP_KEY,secret=process.env.KIS_APP_SECRET;
 if(!key||!secret)throw Error('KIS credentials missing');
 const u=new URL(`${BASE}/uapi/domestic-stock/v1/quotations/inquire-price`);
 u.searchParams.set('FID_COND_MRKT_DIV_CODE','J');
 u.searchParams.set('FID_INPUT_ISCD',code);
 const r=await fetch(u,{headers:{authorization:`Bearer ${await accessToken()}`,appkey:key,appsecret:secret,tr_id:'FHKST01010100','content-type':'application/json'},cache:'no-store'});
 if(!r.ok)return apiError(r,'quote');
 const j=await r.json();
 if(j.rt_cd!=='0'||!j.output)throw Error(`KIS quote response: ${String(j.msg_cd||'')}: ${String(j.msg1||'unknown error').slice(0,150)}`);
 const x=j.output;
 return {price:Number(x.stck_prpr)||null,per:Number(x.per)||null,pbr:Number(x.pbr)||null,volume:Number(x.acml_vol)||null};
}

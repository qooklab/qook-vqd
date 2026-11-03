import {inflateRawSync} from 'node:zlib';
let map:Map<string,string>|null=null;
export async function findCorp(code:string){
 const key=process.env.DART_API_KEY;if(!key)return null;
 if(!map){
  const u=new URL('https://opendart.fss.or.kr/api/corpCode.xml');u.searchParams.set('crtfc_key',key);
  const response=await fetch(u,{cache:'no-store'});if(!response.ok)throw Error('DART corpCode HTTP '+response.status);
  const b=Buffer.from(await response.arrayBuffer());let xml='';
  for(let i=0;i<b.length-46;i++){if(b.readUInt32LE(i)!==0x02014b50)continue;
   const n=b.readUInt16LE(i+28),name=b.subarray(i+46,i+46+n).toString();
   if(!name.endsWith('.xml'))continue;
   const p=b.readUInt32LE(i+42),start=p+30+b.readUInt16LE(p+26)+b.readUInt16LE(p+28);
   const data=b.subarray(start,start+b.readUInt32LE(i+20));
   xml=(b.readUInt16LE(i+10)===8?inflateRawSync(data):data).toString();break;
  }
  if(!xml)throw Error('DART 기업목록 ZIP 파싱 실패');
  map=new Map();
  for(const x of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)){
   const stock=x[1].match(/<stock_code>(\d{6})<\/stock_code>/)?.[1];
   const corp=x[1].match(/<corp_code>(\d{8})<\/corp_code>/)?.[1];
   if(stock&&corp)map.set(stock,corp);
  }
  if(map.size<100)throw Error('DART 기업코드 목록이 비어 있습니다');
 }
 return map.get(code==='005935'?'005930':code)||null;
}
export async function dartFinancials(corpCode:string,year:number,reprtCode='11014'){const key=process.env.DART_API_KEY;if(!key)throw Error('DART_API_KEY missing');const u=new URL('https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json');for(const [k,v] of Object.entries({crtfc_key:key,corp_code:corpCode,bsns_year:String(year),reprt_code:reprtCode,fs_div:'CFS'}))u.searchParams.set(k,v);const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error(`DART HTTP ${r.status}`);const j=await r.json();if(j.status!=='000')throw Error(`DART ${j.status}: ${j.message}`);return j.list as Record<string,string>[];}
// DART corp_code (8 digits) differs from the stock ticker (6 digits).

import {inflateRawSync} from "node:zlib";
import type {Listing} from "./market-model";
import {withUpstreamTimeout} from "./request-timeout";
export const MASTER_SOURCES = {KOSPI:"https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",KOSDAQ:"https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip"} as const;
const specs = {"KOSPI":[2,1,4,4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9,5,5,1,1,1,2,1,1,1,2,2,2,3,1,3,12,12,8,15,21,2,7,1,1,1,1,1,9,9,9,5,9,8,9,3,1,1,1],"KOSDAQ":[2,1,4,4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9,5,5,1,1,1,2,1,1,1,2,2,2,3,1,3,12,12,8,15,21,2,7,1,1,1,1,9,9,9,5,9,8,9,3,1,1,1]};
export function unzipMaster(buffer: Buffer, expected: string): Buffer {
  if(buffer.length>4000000)throw Error("종목 마스터 압축 크기 초과");
  for(let i=0;i+46<=buffer.length;i++) {
    if(buffer.readUInt32LE(i)!==0x02014b50)continue;
    const nl=buffer.readUInt16LE(i+28),el=buffer.readUInt16LE(i+30),cl=buffer.readUInt16LE(i+32);
    const name=buffer.subarray(i+46,i+46+nl).toString("utf8");
    if(name!==expected){i+=45+nl+el+cl;continue;}
    const offset=buffer.readUInt32LE(i+42),size=buffer.readUInt32LE(i+20),plainSize=buffer.readUInt32LE(i+24),method=buffer.readUInt16LE(i+10);
    if(plainSize>8000000||offset+30>buffer.length||buffer.readUInt32LE(offset)!==0x04034b50)throw Error("종목 마스터 ZIP 헤더 오류");
    const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28);
    if(start+size>buffer.length)throw Error("종목 마스터 ZIP 데이터 손상");
    const payload=buffer.subarray(start,start+size);
    if(method!==0&&method!==8)throw Error("종목 마스터 ZIP 압축 방식 미지원");
    return method===8?inflateRawSync(payload,{maxOutputLength:8000000}):payload;
  }
  throw Error("종목 마스터 ZIP 안에 "+expected+" 파일이 없습니다.");
}
const number=(s:string)=>s.trim()!==""&&/^-?\d+(?:\.\d+)?$/.test(s.trim())?Number(s):null;
export function parseMaster(bytes: Uint8Array, market: "KOSPI" | "KOSDAQ"): Listing[] {
  const text=new TextDecoder("euc-kr",{fatal:true}).decode(bytes),widths=specs[market],length=widths.reduce((a,b)=>a+b,0);
  const result:Listing[]=[];const seen=new Set<string>();
  for(const line of text.split(/\r?\n/)) {
    if(!line.trim())continue;
    if(line.length<21+length)throw Error(market+" 종목 마스터 길이가 공식 형식과 다릅니다.");
    const code=line.slice(0,9).trim(),name=line.slice(21,-length).trim();
    if(!/^[0-9A-Z]{6}$/.test(code))continue; // Seven-character ETN and warrant identifiers are outside the stock-code universe.
    if(!name||seen.has(code))throw Error(market+" 종목명·중복 코드 오류");seen.add(code);
    const tail=line.slice(-length);let offset=0;const fields=widths.map(width=>{const value=tail.slice(offset,offset+width).trim();offset+=width;return value;});
    const k=market==="KOSPI";
    result.push({code,name,market,group:fields[0],preferred:fields[k?54:49],spac:fields[k?19:14],halted:fields[k?34:29],liquidation:fields[k?35:30],managed:fields[k?36:31],cap:number(fields[k?65:59]),roe:number(fields[k?63:57]),referenceDate:fields[k?64:58]});
  }
  if(result.length<500)throw Error(market+" 종목 마스터 건수가 비정상적으로 적습니다.");
  return result;
}
export async function downloadMarket(): Promise<Listing[]> {
  const results=await Promise.all(Object.entries(MASTER_SOURCES).map(async([market,url])=>withUpstreamTimeout(market+" 종목 마스터",20000,async signal=>{
    const response=await fetch(url,{cache:"no-store",signal});if(!response.ok)throw Error(market+" 종목 마스터 HTTP "+response.status);
    const buffer=Buffer.from(await response.arrayBuffer());return parseMaster(unzipMaster(buffer,market.toLowerCase()+"_code.mst"),market as "KOSPI"|"KOSDAQ");
  })));
  const listings=results.flat();if(new Set(listings.map(s=>s.code)).size!==listings.length)throw Error("시장 간 중복 종목코드");return listings;
}


import {findCorp,dartFinancials} from './dart';
type Row=Record<string,string>;
const financials=new Set(['105560','055550','086790','138040','316140','024110','000810','032830','071050','138930','175330','139130']);
function number(value:string|undefined){if(!value)return null;const n=Number(value.replace(/,/g,''));return Number.isFinite(n)?n:null;}
function metric(rows:Row[],ids:string[],names:string[],section:string){
 const row=rows.find(x=>x.sj_div===section&&(ids.includes(x.account_id)||names.includes(x.account_nm)));
 return number(row?.thstrm_amount);
}
export type FinancialScoreResult={profit_score?:number;balance_score?:number;growth_score?:number;note:string};
export async function financialScores(code:string):Promise<FinancialScoreResult>{
 const corp=await findCorp(code);if(!corp)return {note:'DART 기업 고유번호 미확인'};
 const y=new Date().getUTCFullYear()-1;
 const data=await Promise.all([y-2,y-1,y].map(year=>dartFinancials(corp,year,'11011').catch(()=>null)));
 if(data.some(x=>!x))return {note:'최근 3개년 연결 사업보고서 부족'};
 const years=data as Row[][];
 const profits=years.map(rows=>metric(rows,['dart_OperatingIncomeLoss'],['영업이익','영업이익(손실)'],'IS')??metric(rows,['dart_OperatingIncomeLoss'],['영업이익','영업이익(손실)'],'CIS'));
 const result:{profit_score?:number;balance_score?:number;growth_score?:number;note:string}={note:'DART 연결 사업보고서 3개년 기준'};
 if(profits.every(x=>x!==null)){
  const positive=profits.filter(x=>(x !== null && x > 0)).length;
  result.profit_score=[0,3,6,10][positive];
  const start=profits[0]!,end=profits[2]!;
  if(start>0&&end>0){const g=Math.sqrt(end/start)-1;result.growth_score=g>=.15?10:g>=.1?8:g>=.05?6:g>=0?4:2;}
  else if(end<=0)result.growth_score=0;
 }
 if(!financials.has(code)){
  const rows=years[2],debt=metric(rows,['ifrs-full_Liabilities','ifrs_Liabilities'],['부채총계'],'BS'),equity=metric(rows,['ifrs-full_Equity','ifrs_Equity'],['자본총계'],'BS');
  if(debt!==null&&equity!==null&&equity>0){const r=debt/equity;result.balance_score=r<=.5?10:r<=1?8:r<=1.5?6:r<=2?4:r<=3?2:0;}
 }
 return result;
}

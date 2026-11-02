import {NextRequest,NextResponse} from 'next/server';
import {stocks} from '@/lib/stocks';
import {db} from '@/lib/db';
import {quote} from '@/lib/kis';
import {financialScores} from '@/lib/financial-score';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(req:NextRequest){
 const expected=process.env.CRON_SECRET;
 if(!expected||req.headers.get('authorization')!==`Bearer ${expected}`)return NextResponse.json({error:'인증 실패: CRON_SECRET 확인'},{status:401,headers:{'Cache-Control':'no-store'}});
 const body=await req.json().catch(()=>null);
 const code=body?.code;
 if(typeof code!=='string'||!/^\d{6}$/.test(code))return NextResponse.json({error:'올바른 6자리 종목코드를 입력하세요'},{status:400});
 const found=stocks.find(x=>x[1]===code);
 if(!found)return NextResponse.json({error:'등록되지 않은 종목입니다'},{status:400});
 const client=db();
 if(!client)return NextResponse.json({error:'Supabase 환경변수 누락'},{status:503});
 if(!process.env.KIS_APP_KEY||!process.env.KIS_APP_SECRET)return NextResponse.json({error:'KIS API 환경변수 누락'},{status:503});
 try{
  const q=await quote(code);
  if(q.price==null)throw Error('API 응답에 가격이 없습니다');
  const scores=await financialScores(code).catch(()=>null);
  const extra:Record<string,number>={};
  if(scores)for(const field of ['profit_score','balance_score','growth_score'] as const){if(typeof scores[field]==='number')extra[field]=scores[field]!;}
  const {error}=await client.from('stock_latest').upsert({code,name:found[0],...q,...extra,updated_at:new Date().toISOString()},{onConflict:'code'});
  if(error)throw error;
  return NextResponse.json({ok:true,code,price:q.price,dartNote:scores?.note||'DART 자료 미확인',updated_at:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Manual refresh failed',code,e);return NextResponse.json({error:'수집 실패: '+(e instanceof Error?e.message:'알 수 없는 오류')},{status:502});}
}

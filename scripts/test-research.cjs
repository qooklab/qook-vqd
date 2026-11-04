const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks = {}) {
  const name = path.resolve(__dirname, '..', file), mod = new Module(name, module);
  mod.filename = name; mod.paths = Module._nodeModulePaths(path.dirname(name));
  const original = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, name);
  return mod.exports;
}
const model = load('lib/research-model.ts');
const dartErrors = load('lib/dart-errors.ts');
function snapshot(patch = {}) {
  const year = new Date().getUTCFullYear() - 1;
  return {version: 1, year, checkedAt: new Date().toISOString(), basis: 'DART 연결 3년', dividends: Array.from({length: 5}, (_, i) => ({year: year-4+i, dps: 100+i*25, receipt: null})), retired: 200, issued: 9800, retirementReceipt: null, shareReceipt: null, fundamentals: [0,1,2].map(i => ({year:year-2+i,roe:12+i,receipt:null})), base: {profit_score:10,balance_score:8,growth_score:6}, errors: [], ...patch};
}
const quote = {code:'000270',price:1000,per:6,pbr:.5};
test('unknown amounts are never converted to a zero payout or zero cancellation', () => {
  for (const value of [null, undefined, '', ' ', '-', 'N/A', '1,000원']) assert.equal(model.numeric(value), null);
  assert.equal(model.numeric('0'),0); assert.equal(model.numeric('(1,000)'),-1000);
  assert.equal(model.retirementData([],[],false).retired,null);
});
test('latest report revisions win and share classes cannot leak across tickers', () => {
  const row = (stock_knd, thstrm, frmtrm, lwfr) => ({se:'주당 현금배당금(원)', stock_knd, thstrm, frmtrm, lwfr});
  const reports = [{year:2023,rows:[row('보통주','100','90','80')]},{year:2025,rows:[row('보통주','150','140','110'),row('우선주','170','160','130')]}];
  assert.deepEqual(model.dividendHistory(reports,2025,false).map(x=>x.dps),[80,90,110,140,150]);
  assert.deepEqual(model.dividendHistory(reports,2025,true).map(x=>x.dps),[null,null,130,160,170]);
  reports[1].rows.push(row('우선주2','9','9','9'));
  assert.equal(model.dividendHistory(reports,2025,true)[4].dps,null);
});
test('a newer missing value does not turn into a positive dividend-history score', () => {
  const s=snapshot(); s.dividends[2].dps=null;
  assert.equal(model.deriveResearch(quote,s).fields.dividend_history_score,null);
  s.dividends=s.dividends.map(x=>({...x,dps:0}));
  assert.equal(model.deriveResearch(quote,s).fields.dividend_history_score,0);
});
test('treasury totals are not counted again together with detail and subtotal rows', () => {
  const rows=[{stock_knd:'보통주',acqs_mth1:'배당가능이익',acqs_mth3:'장내직접취득',change_qy_incnr:'200'},{stock_knd:'보통주',acqs_mth3:'소계',change_qy_incnr:'200'},{stock_knd:'보통주',acqs_mth1:'총계',change_qy_incnr:'200'},{stock_knd:'우선주',acqs_mth1:'총계',change_qy_incnr:'900'}];
  const result=model.retirementData(rows,[{se:'보통주',istc_totqy:'9,800'}],false);
  assert.equal(result.retired,200); assert.equal(result.issued,9800);
  assert.equal(model.deriveResearch(quote,snapshot(result)).fields.buyback_score,8);
  rows[2].change_qy_incnr='-'; assert.equal(model.retirementData(rows,[],false).retired,null);
});
test('valuation and dividend yield follow current price while cached source facts stay unchanged', () => {
  const s=snapshot(); const old=model.deriveResearch(quote,s);
  assert.equal(old.fair,2000); assert.equal(old.fields.buy_price,1600); assert.equal(old.fields.margin_score,15);
  assert.equal(old.fields.dividend_yield,20);
  const next=model.deriveResearch({...quote,price:2000,per:12,pbr:1},s);
  assert.equal(next.fair,2000); assert.equal(next.fields.dividend_yield,10); assert.equal(next.fields.margin_score,6);
  assert.equal(s.dividends[4].dps,200);
});
test('losses and nonpositive equity ratios do not invent a fair entry price', () => {
  for(const [per,pbr] of [[-1,.5],[6,0],[null,.5],[0,.5]]) {
    const result=model.deriveResearch({...quote,per,pbr},null);
    assert.equal(result.fields.margin_score,null); assert.equal(result.fields.buy_price,null);
  }
});
test('profitability proxy requires all three years and shows that it is not a moat assessment', () => {
  const s=snapshot(); let r=model.deriveResearch(quote,s);
  assert.equal(r.fields.moat_score,4); assert.match(r.evidence[9],/해자 자체를 검증한 점수가 아닙니다/);
  s.fundamentals[1].roe=null; assert.equal(model.deriveResearch(quote,s).fields.moat_score,null);
});
test('cache expires on version/year boundary; partial source failures have a short cooldown', () => {
  const now=Date.now();
  assert.equal(model.researchFresh(snapshot(),now),true);
  assert.equal(model.researchFresh(snapshot({checkedAt:new Date(now-8*86400000).toISOString()}),now),false);
  assert.equal(model.researchFresh(snapshot({year:2000}),now),false);
  assert.equal(model.researchFresh(snapshot({checkedAt:new Date(now-16*60000).toISOString(),errors:['timeout']}),now),false);
  assert.equal(model.decodeResearch('[dart-score-v2] legacy'),null);
  assert.equal(model.decodeResearch(JSON.stringify(snapshot())).version,1);
});
function serviceHarness({cached=null, annualError=null}={}) {
  const writes=[], calls=[], row={...quote,profit_score:6};
  let note=cached ? JSON.stringify(cached) : null;
  const client={from:table=>({
    select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='stock_latest' ? row : {note},error:null})})}),
    upsert:async data=>{writes.push({table,data});if(table==='dart_financial_cache')note=data.note;return {error:null};},
    update:data=>({eq:async()=>{writes.push({table,data});return {error:null};}})
  })};
  const research=load('lib/research.ts',{
    './db':{db:()=>client},'./dart-errors':dartErrors,'./research-model':model,
    './financial-score':{financialScores:async()=>({profit_score:10,balance_score:8,growth_score:6,note:'DART 연결',fundamentals:snapshot().fundamentals})},
    './dart':{findCorp:async()=> '00106641',dartAnnual:async(endpoint,corp,year)=>{
      calls.push(endpoint); if(annualError) throw annualError;
      if(endpoint==='alotMatter')return [{se:'주당 현금배당금(원)',stock_knd:'보통주',thstrm:'100',frmtrm:'90',lwfr:'80'}];
      if(endpoint==='tesstkAcqsDspsSttus')return [{stock_knd:'보통주',acqs_mth1:'총계',change_qy_incnr:'200'}];
      return [{se:'보통주',istc_totqy:'9800'}];
    }}
  });
  return {research,writes,calls};
}
test('collection persists source evidence and all new fields without requiring a database migration', async()=>{
  const old=process.env.DART_API_KEY; process.env.DART_API_KEY='test';
  try {
    const h=serviceHarness(); const [a,b]=await Promise.all([h.research.updateResearch('000270'),h.research.updateResearch('000270')]);
    assert.equal(a,b); assert.equal(h.calls.length,4);
    const cached=h.writes.find(w=>w.table==='dart_financial_cache');
    assert.equal(model.decodeResearch(cached.data.note).retired,200);
    const latest=h.writes.find(w=>w.table==='stock_latest').data;
    for(const key of ['dividend_yield','dividend_history_score','buyback_score','moat_score','margin_score','buy_price'])assert.equal(typeof latest[key],'number');
    const again=await h.research.updateResearch('000270'); assert.equal(again.retired,200); assert.equal(h.calls.length,4);
  } finally {if(old===undefined)delete process.env.DART_API_KEY;else process.env.DART_API_KEY=old;}
});
test('quota errors do not persist a fake empty research result',async()=>{
  const old=process.env.DART_API_KEY; process.env.DART_API_KEY='test';
  try {
    const h=serviceHarness({annualError:new dartErrors.DartApiError('DART','020')});
    await assert.rejects(h.research.updateResearch('000270'),e=>e.status==='020');
    assert.equal(h.writes.length,0);
  } finally {if(old===undefined)delete process.env.DART_API_KEY;else process.env.DART_API_KEY=old;}
});
test('ROE uses annual net profit and average beginning/end total equity on a consistent basis',async()=>{
  const financial=load('lib/financial-score.ts',{
    './db':{db:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})})})},
    './dart-errors':dartErrors,'./request-timeout':load('lib/request-timeout.ts'),
    './dart':{findCorp:async()=> '00106641',dartFinancials:async()=>[
      {sj_div:'IS',account_id:'dart_OperatingIncomeLoss',thstrm_amount:'100'},
      {sj_div:'IS',account_id:'ifrs-full_ProfitLoss',thstrm_amount:'150'},
      {sj_div:'BS',account_id:'ifrs-full_Equity',thstrm_amount:'1,100',frmtrm_amount:'900'},
      {sj_div:'BS',account_id:'ifrs-full_Liabilities',thstrm_amount:'500'},
    ]}
  });
  const r=await financial.financialScores('000270');
  assert.deepEqual(r.fundamentals.map(f=>f.roe),[15,15,15]);
});
test('new authenticated research mode runs DART collection without requesting KIS or exposing a secret', async()=>{
  let calls=0; const secret=process.env.CRON_SECRET;process.env.CRON_SECRET='test-secret';
  const route=load('app/api/refresh/route.ts',{
    '@/lib/stocks':{stocks:[['기아','000270']]},'@/lib/db':{db:()=>({})},
    '@/lib/kis':{quote:async()=>{throw Error('KIS should not be called');}},
    '@/lib/financial-score':{},'@/lib/research':{updateResearch:async()=>{calls++;return snapshot();}},
    '@/lib/request-timeout':load('lib/request-timeout.ts'),'@/lib/dart-errors':dartErrors,
  });
  try {
    const request=auth=>new Request('http://localhost/api/refresh',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer test-secret'}:{})},body:JSON.stringify({code:'000270',mode:'research'})});
    assert.equal((await route.POST(request(false))).status,401);assert.equal(calls,0);
    const response=await route.POST(request(true));assert.equal(response.status,200);assert.equal(calls,1);
    assert.equal((await response.json()).ok,true);
  } finally {if(secret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=secret;}
});

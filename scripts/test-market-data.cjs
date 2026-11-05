const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(file,mocks={}){const name=path.resolve(__dirname,'..',file),mod=new Module(name,module);mod.filename=name;mod.paths=Module._nodeModulePaths(path.dirname(name));const original=mod.require.bind(mod);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith('.')&&fs.existsSync(path.resolve(path.dirname(name),id+'.ts'))?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(name),id+'.ts')),mocks):original(id);mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,name);return mod.exports;}
const {marketDataRows,csvCell}=load('lib/market-data-model.ts');
const listing=(code,patch={})=>({code,name:'종목 '+code,market:'KOSPI',group:'ST',preferred:'0',spac:'N',halted:'N',liquidation:'N',managed:'N',cap:1000,roe:5,referenceDate:'20260630',...patch});
const quote=(code,patch={})=>({code,name:'종목 '+code,price:10000,per:5,pbr:.5,volume:100,updated_at:'2026-11-04T00:00:00Z',...patch});
const job=(listings,quotes=[])=>({kind:'market-screen-v1',runId:'test',sourceAt:'2026-11-04T00:00:00Z',status:'complete',listings,quotes,failures:[],cursor:listings.length});
test('every listing is represented and missing data stays unknown rather than zero',()=>{
 const listings=[listing('111111'),listing('222222',{roe:2}),listing('333333'),listing('444444'),listing('555555'),listing('666666',{group:'EF'})];
 const j=job(listings,[quote('111111'),quote('333333',{per:18})]);j.failures=[{code:'444444',error:'upstream key secret must not leak',attempts:2}];
 const rows=marketDataRows(j,[],new Map());assert.equal(rows.length,6);
 assert.deepEqual(rows.map(r=>r.stage),['selected','excluded','excluded','failed','pending','excluded']);
 assert.equal(rows[4].price,null);assert.equal(rows[4].assessed,null);assert.equal(rows[4].possible,0);assert.ok(rows[4].values.every(v=>v===null));
 assert.match(rows[2].reason,/PER 15/);assert.doesNotMatch(JSON.stringify(rows),/secret must not leak/);
});
test('rank 31 is retained, provisional candidates are labelled and no 100-point score is fabricated',()=>{
 const listings=Array.from({length:31},(_,i)=>listing(String(100000+i)));const j=job(listings,listings.map(l=>quote(l.code)));j.status='partial';
 const rows=marketDataRows(j,[],new Map());assert.equal(rows[30].stage,'passed');assert.equal(rows[30].rank,31);assert.equal(rows[0].screenScore,20);assert.equal(rows[0].provisional,true);assert.equal(rows[0].researchState,'partial');assert.ok(rows[0].possible<100);
});
test('a newer individual quote is displayed without changing screening decisions or score',()=>{
 const j=job([listing('111111'),listing('222222')],[quote('111111')]);
 const stored=[{...quote('111111',{per:30,pbr:2,price:20000}),updated_at:'2026-11-05T00:00:00Z'},quote('222222')];
 const rows=marketDataRows(j,stored,new Map());assert.equal(rows[0].price,20000);assert.equal(rows[0].screenScore,20);assert.equal(rows[0].stage,'selected');assert.equal(rows[0].quoteSource,'previous');assert.equal(rows[1].stage,'pending');assert.equal(rows[1].screenScore,null);
});
test('CSV escapes quotes, multiline names, formula prefixes, missing values and preserves numeric zero',()=>{
 assert.equal(csvCell(null),'""');assert.equal(csvCell(0),'"0"');assert.equal(csvCell('a"b\nc'),'"a""b\nc"');assert.equal(csvCell('=1+2'),'"\'=1+2"');assert.equal(csvCell('  @SUM(A1)'),'"\'  @SUM(A1)"');assert.equal(csvCell(-3),'"-3"');
});
test('non-selected stocks resolve from master while unknown codes and non-stock securities do not',async()=>{
 const {resolveStock}=load('lib/resolve-stock.ts',{'./stocks':{stocks:[]},'./market-screen':{readMarketJob:async()=>job([listing('123456',{roe:0}),listing('ABC123',{group:'EF'})])}});
 assert.deepEqual(await resolveStock('123456'),['종목 123456','123456']);assert.equal(await resolveStock('ABC123'),undefined);assert.equal(await resolveStock('../bad'),undefined);assert.equal(await resolveStock('999999'),undefined);
});
test('data reader requests bounded chunks and never collects external quotes or truncates at 1000 rows',async()=>{
 const listings=Array.from({length:1105},(_,i)=>listing(String(100000+i)));let max=0,calls=0;
 const {readMarketData}=load('lib/market-data.ts',{'./market-screen':{readMarketJob:async()=>job(listings)},'./db':{db:()=>({from:()=>({select:()=>({in:async(_,codes)=>{max=Math.max(max,codes.length);calls++;return {data:[],error:null};}})})})}});
 const result=await readMarketData();assert.equal(result.rows.length,1105);assert.equal(max,200);assert.equal(calls,12);assert.equal(result.rows[0].evidence,undefined);
 const detail=await readMarketData('100000');assert.equal(detail.rows.length,1);assert.equal(detail.rows[0].evidence.length,10);assert.equal(calls,14);
});
test('DART-only request for an unselected stock bootstraps missing price after authentication',async()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test-secret';let quoted=0,research=0,saved=0;
 const route=load('app/api/refresh/route.ts',{'next/server':{NextResponse:{json:(body,init={})=>new Response(JSON.stringify(body),init)}},'@/lib/resolve-stock':{resolveStock:async()=>['제외종목','123456']},'@/lib/db':{db:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async row=>{assert.equal(row.code,'123456');saved++;return {error:null};}})})},'@/lib/kis':{quote:async()=>{quoted++;return {price:10000,per:5,pbr:.5};}},'@/lib/financial-score':{},'@/lib/request-timeout':{isTimeoutError:()=>false},'@/lib/dart-errors':{DartApiError:class extends Error{}},'@/lib/research':{updateResearch:async()=>{research++;return {year:2025,errors:[],checkedAt:'2026-11-05'};}}});
 try{const request=auth=>new Request('http://localhost/api/refresh',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer test-secret'}:{})},body:JSON.stringify({code:'123456',mode:'research'})});assert.equal((await route.POST(request(false))).status,401);assert.equal(quoted,0);assert.equal((await route.POST(request(true))).status,200);assert.equal(quoted,1);assert.equal(saved,1);assert.equal(research,1);}finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});

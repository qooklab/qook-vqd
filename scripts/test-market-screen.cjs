const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {deflateRawSync}=require('node:zlib');
function load(file,mocks={}){const name=path.resolve(__dirname,'..',file),mod=new Module(name,module);mod.filename=name;mod.paths=Module._nodeModulePaths(path.dirname(name));const original=mod.require.bind(mod);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith('.')&&fs.existsSync(path.resolve(path.dirname(name),id+'.ts'))?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(name),id+'.ts')),mocks):original(id);mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,name);return mod.exports;}
const model=load('lib/market-model.ts'),master=load('lib/market-master.ts');
const listing=(code='111111',patch={})=>({code,name:'Example '+code,market:'KOSPI',group:'ST',preferred:'0',spac:'N',halted:'N',liquidation:'N',managed:'N',cap:1000,roe:5,referenceDate:'20260630',...patch});
const quote=(code='111111',patch={})=>({code,name:'Example '+code,price:10000,per:5,pbr:.5,volume:100,updated_at:'2026-11-04T00:00:00Z',...patch});
const job=(listings)=>({kind:'market-screen-v1',runId:'test',sourceAt:'2026-11-04T00:00:00Z',startedAt:'2026-11-04T00:00:00Z',completedAt:null,status:'running',listings,cursor:0,quotes:[],failures:[],attempted:0,leaseUntil:null,cooldownUntil:null,message:null});
test('every security passes the same exclusion rules and unknown data are not zero',()=>{
 assert.equal(model.firstExclusion(listing()),null);
 for(const patch of [{group:'EF'},{preferred:'1'},{spac:'Y'},{halted:'Y'},{managed:'Y'},{liquidation:'Y'},{halted:''},{cap:null},{cap:999},{roe:null},{roe:4.99}])assert.ok(model.firstExclusion(listing('111111',patch)),JSON.stringify(patch));
});
test('screen ranks by the same 20-point price score with deterministic ties, not the old 30-name list',()=>{
 const rows=[listing('000270',{cap:1000}),listing('999999',{cap:2000}),listing('888888',{cap:2000})],quotes=rows.map(s=>quote(s.code));
 assert.deepEqual(model.selectCandidates(quotes,rows).map(q=>q.code),['888888','999999','000270']);
 assert.equal(model.selectCandidates(quotes,rows)[0].screenScore,20);
 for(const patch of [{per:null},{per:0},{per:-1},{per:15.01},{pbr:null},{pbr:0},{pbr:1.51},{price:0}])assert.equal(model.selectCandidates([quote('111111',patch)],[listing()]).length,0);
});
test('partial status is preserved, missing rows are not fabricated to fill 30 places',()=>{
 const j=job([listing()]);j.cursor=1;j.status='partial';j.failures=[{code:'111111',error:'timeout',attempts:2}];
 const s=model.publicScreen(j);assert.equal(s.status,'partial');assert.equal(s.selected.length,0);assert.equal(s.failed,1);assert.equal(s.eligible,1);
 assert.equal(model.decodeJob(JSON.stringify(j)).runId,'test');assert.equal(model.decodeJob('not json'),null);
});
const widths={KOSPI:[2,1,4,4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9,5,5,1,1,1,2,1,1,1,2,2,2,3,1,3,12,12,8,15,21,2,7,1,1,1,1,1,9,9,9,5,9,8,9,3,1,1,1],KOSDAQ:[2,1,4,4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9,5,5,1,1,1,2,1,1,1,2,2,2,3,1,3,12,12,8,15,21,2,7,1,1,1,1,9,9,9,5,9,8,9,3,1,1,1]};
function masterText(market){return Array.from({length:500},(_,i)=>{const k=market==='KOSPI',values={0:'ST',[k?54:49]:'0',[k?19:14]:'N',[k?34:29]:'N',[k?35:30]:'N',[k?36:31]:'N',[k?65:59]:'1000',[k?63:57]:'5',[k?64:58]:'20260630'};return String(900000+i).padEnd(9)+'KR7900000000'+'Example'+widths[market].map((w,n)=>(values[n]||'').padStart(w)).join('');}).join('\n')+'\n';}
function zip(name,raw){const body=deflateRawSync(raw),local=Buffer.alloc(30),central=Buffer.alloc(46),n=Buffer.from(name);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt16LE(n.length,26);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(body.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(n.length,28);return Buffer.concat([local,n,body,central,n]);}
test('both official fixed-width layouts parse common-share flags and market units correctly',()=>{
 for(const market of ['KOSPI','KOSDAQ']){const result=master.parseMaster(Buffer.from(masterText(market)),market);assert.equal(result.length,500);assert.equal(result[0].preferred,'0');assert.equal(result[0].roe,5);assert.equal(result[0].cap,1000);assert.equal(result[0].referenceDate,'20260630');assert.equal(model.firstExclusion(result[0]),null);}
 assert.throws(()=>master.parseMaster(Buffer.from('invalid'), 'KOSPI'),/길이/);
 const mixed=masterText('KOSPI').replace('900000','0126Z0');assert.equal(master.parseMaster(Buffer.from(mixed),'KOSPI')[0].code,'0126Z0');
 const duplicate=masterText('KOSPI').replace('900001','900000');assert.throws(()=>master.parseMaster(Buffer.from(duplicate),'KOSPI'),/중복/);
});
test('ZIP parser rejects HTML, wrong files and truncated input without extracting arbitrary files',()=>{
 const raw=Buffer.from(masterText('KOSPI')),z=zip('kospi_code.mst',raw);assert.deepEqual(master.unzipMaster(z,'kospi_code.mst'),raw);
 assert.throws(()=>master.unzipMaster(Buffer.from('<html>error</html>'),'kospi_code.mst'));
 assert.throws(()=>master.unzipMaster(z,'other.mst'));
 assert.throws(()=>master.unzipMaster(z.subarray(0,z.length-50),'kospi_code.mst'));
});
function database(seed){let row={code:'__market_screen_v1',note:JSON.stringify(seed),checked_at:'2026-01-01T00:00:00.000Z'};const published=[];
 return {published,get:()=>JSON.parse(row.note),from(table){
  if(table==='stock_latest')return {upsert:async rows=>{published.push(...rows);return {error:null};}};
  function query(op,value){const conditions=[];let executed=false,result;const run=()=>{if(executed)return result;executed=true;const matches=conditions.every(([key,val])=>row?.[key]===val);if(op==='update'&&matches)row={...row,...value};result={data:matches?{...row}:null,error:null};return result;};const q={eq:(k,v)=>{conditions.push([k,v]);return q;},select:()=>q,maybeSingle:async()=>run(),then:(resolve,reject)=>Promise.resolve(run()).then(resolve,reject)};return q;}
  return {select:()=>query('select'),update:v=>query('update',v),upsert:async v=>{if(!row)row=v;return {error:null};}};
 }};
}
function service(seed,quoteImpl){const client=database(seed);let calls=0;const code=load('lib/market-screen.ts',{'./db':{db:()=>client},'./kis':{KisApiError:class KisApiError extends Error{},quote:async code=>{calls++;return quoteImpl?quoteImpl(code):{price:100,per:5,pbr:.5,volume:100};}},'./market-master':{downloadMarket:async()=>seed.listings}});return {...client,code,calls:()=>calls};}
test('a persisted batch only publishes candidates after all eligible quotes succeed',async()=>{
 const oldKey=process.env.KIS_APP_KEY,oldSecret=process.env.KIS_APP_SECRET;process.env.KIS_APP_KEY='test';process.env.KIS_APP_SECRET='test';
 try{const h=service(job([listing()]));await h.code.processMarketBatch();assert.equal(h.get().status,'complete');assert.equal(h.published.length,1);assert.equal(h.get().published.selected[0].code,'111111');assert.equal((await h.code.watchlist()).published,true);}
 finally{if(oldKey===undefined)delete process.env.KIS_APP_KEY;else process.env.KIS_APP_KEY=oldKey;if(oldSecret===undefined)delete process.env.KIS_APP_SECRET;else process.env.KIS_APP_SECRET=oldSecret;}
});
test('lease blocks overlapping workers and failures remain provisional rather than publishing a false top list',async()=>{
 const oldKey=process.env.KIS_APP_KEY,oldSecret=process.env.KIS_APP_SECRET;process.env.KIS_APP_KEY='test';process.env.KIS_APP_SECRET='test';
 try{
  const locked=job([listing()]);locked.leaseUntil=new Date(Date.now()+60000).toISOString();const h=service(locked);await h.code.processMarketBatch();assert.equal(h.calls(),0);
  const failed=job([listing()]);failed.cursor=1;failed.failures=[{code:'111111',error:'timeout',attempts:1}];const f=service(failed,()=>{throw Error('timeout');});await f.code.processMarketBatch();assert.equal(f.get().status,'partial');assert.equal(f.published.length,0);assert.equal((await f.code.watchlist()).published,false);
  const race=service(job([listing()]));await Promise.all([race.code.processMarketBatch(),race.code.processMarketBatch()]);assert.equal(race.calls(),1);
 }finally{if(oldKey===undefined)delete process.env.KIS_APP_KEY;else process.env.KIS_APP_KEY=oldKey;if(oldSecret===undefined)delete process.env.KIS_APP_SECRET;else process.env.KIS_APP_SECRET=oldSecret;}
});
test('the previously published universe stays available while a new scan is running',async()=>{const j=job([listing()]);j.published={runId:'old',completedAt:'2026-01-01T00:00:00Z',selected:[quote()]};const h=service(j);const result=await h.code.watchlist();assert.equal(result.published,true);assert.equal(result.stocks[0][1],'111111');});
test('new financial or unclassified issuers never receive an industrial debt-ratio score',async()=>{
 for(const industry of [true,null,false]) {
  const financial=load('lib/financial-score.ts',{'./db':{db:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})})})},'./dart':{findCorp:async()=>'10000000',dartFinancialIndustry:async()=>industry,dartFinancials:async()=>[{sj_div:'IS',account_id:'dart_OperatingIncomeLoss',thstrm_amount:'100'},{sj_div:'BS',account_id:'ifrs-full_Equity',thstrm_amount:'1000'},{sj_div:'BS',account_id:'ifrs-full_Liabilities',thstrm_amount:'500'}]}});
  const result=await financial.financialScores('999999',true);
  assert.equal(result.balance_score,industry===false?10:undefined);
 }
});

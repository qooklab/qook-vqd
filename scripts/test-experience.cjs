const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), Module=require('node:module'), ts=require('typescript');
function load(file) {
  const name=path.resolve(__dirname,'..',file), mod=new Module(name,module);mod.filename=name;mod.paths=Module._nodeModulePaths(path.dirname(name));
  mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,name);
  return mod.exports;
}
const {shouldAnimateNavigation:animate}=load('lib/navigation-effects.ts');
const {InteractionSound}=load('lib/interaction-sound.ts');
const nav={href:'https://example.com/methodology',current:'https://example.com/',button:0,modified:false,prevented:false,download:false,target:'',reduced:false};
test('only ordinary same-origin route changes are intercepted',()=>{
  assert.equal(animate(nav),true);
  for(const patch of [{modified:true},{button:1},{prevented:true},{download:true},{target:'_blank'},{reduced:true},{href:'https://external.com/other'},{href:'mailto:person@example.com'},{href:'https://example.com/#universe-title'},{href:'https://example.com/?q=ki'},{href:'https://example.com/methodology#rules'}])assert.equal(animate({...nav,...patch}),false,JSON.stringify(patch));
});
function fakeAudio({blocked=false}={}) {
  const nodes=[], events=[];
  class AudioContext {
    state='suspended'; currentTime=0;destination={};
    async resume(){if(blocked)throw Error('autoplay blocked');this.state='running';events.push('resume');}
    async suspend(){this.state='suspended';events.push('suspend');}
    async close(){this.state='closed';events.push('close');}
    createOscillator(){const node={type:'',frequency:{setValueAtTime:(v)=>events.push(['hz',v]),exponentialRampToValueAtTime:()=>{}},connect:()=>{},disconnect:()=>{},start:()=>events.push('start'),stop:()=>events.push('stop')};nodes.push(node);return node;}
    createGain(){return {gain:{setValueAtTime:()=>{},exponentialRampToValueAtTime:v=>events.push(['gain',v])},connect:()=>{},disconnect:()=>{}};}
  }
  return {AudioContext,nodes,events};
}
test('no sound runs before a user gesture; click and navigation cues remain short and quiet',async()=>{
  const previous=global.window,fake=fakeAudio();global.window={AudioContext:fake.AudioContext};
  try {
    const engine=new InteractionSound();engine.play('press');assert.equal(fake.nodes.length,0);
    assert.equal(await engine.unlock(),true);engine.play('press');assert.equal(fake.nodes.length,1);
    engine.play('navigate');assert.equal(fake.nodes.length,3);
    assert.ok(fake.events.filter(e=>Array.isArray(e)&&e[0]==='gain').every(e=>e[1]<=.035));
    engine.suspend();engine.play('press');assert.equal(fake.nodes.length,3);
    await engine.unlock();engine.play('toggle');assert.equal(fake.nodes.length,5);
    engine.close();assert.ok(fake.events.includes('close'));
  }finally{global.window=previous;}
});
test('hover is throttled and audio API denial never breaks navigation',async()=>{
  const previous=global.window,fake=fakeAudio();global.window={AudioContext:fake.AudioContext};
  try {
    const engine=new InteractionSound();await engine.unlock();engine.play('hover');engine.play('hover');assert.equal(fake.nodes.length,1);engine.close();
    global.window={AudioContext:fakeAudio({blocked:true}).AudioContext};assert.equal(await new InteractionSound().unlock(),false);
    global.window={};assert.equal(await new InteractionSound().unlock(),false);
  }finally{global.window=previous;}
});

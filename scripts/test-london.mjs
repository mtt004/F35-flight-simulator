import fs from'node:fs/promises';import path from'node:path';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{browserSession,startFlight,snapshot}from'../tests/helpers/browser.mjs';import{takeoffWithKeyboard}from'../tests/helpers/flight-controls.mjs';
const file=path.resolve(process.argv[2]||'dist/index.html');const report={date:new Date().toISOString(),sourceSha256:createHash('sha256').update(await fs.readFile(file)).digest('hex'),status:'FAIL',checks:[],limits:['Cloud software-renderer functional test; not Galaxy A51 performance.','Configured runway spawn; takeoff uses real keyboard controls/physics. Other geography/rebase checks use explicit state fixtures, not a continuous corridor flight.']};let session;
async function check(name,f){try{report.checks.push({name,status:'PASS',details:await f()});}catch(e){report.checks.push({name,status:'FAIL',error:String(e),evidence:e.evidence});}}
try{session=await browserSession({file});report.environment=session.environment;const p=session.page;await p.selectOption('#worldMode','LONDON');await startFlight(p,{start:'RUNWAY'});
await check('London starts on mapped Heathrow runway and advances physics',async()=>{const a=await snapshot(p);await p.waitForFunction(n=>stepCount>n+10,a.stepCount);const b=await snapshot(p);assert.equal(await p.evaluate(()=>worldMode),'LONDON');assert.ok(!b.crashed);assert.ok(b.stepCount>a.stepCount);const data=await p.evaluate(()=>({rwy:airports[0].rwyLen,h:heightAt(airports[0].x,airports[0].z),e:airports[0].elev,world:__F35B_SIM__.world}));assert.equal(data.rwy,3902);assert.ok(Math.abs(data.h-data.e)<.01);return{before:a,after:b,data};});
await check('actual keyboard runway takeoff',async()=>{
 const previousProfile=await p.evaluate(()=>L.profile);
 const renderState=()=>({profile:L.profile,quality:qlLevel,buffer:[renderer.domElement.width,renderer.domElement.height],shadows:renderer.shadowMap.enabled,frameEMA,flightT});
 const before=await p.evaluate(renderState);
 // Exercise the existing user-facing Performance profile on CPU rasterizers.
 // Keep the real keyboard pilot, physics, flight thresholds and stage deadlines.
 await p.locator('#btnSet').click();
 await p.locator('#lightningProfile').selectOption('BATTERY');
 await p.locator('#btnDrawerClose').click();
 await p.waitForFunction(()=>L.profile==='BATTERY'&&qlLevel===0&&!renderer.shadowMap.enabled);
 const fixture=await p.evaluate(renderState),started=Date.now();
 try{
  const pilot=await takeoffWithKeyboard(p,{timeout:180000});
  return {...pilot,renderFixture:{reason:'Control-function check on cloud software renderer; Balanced visual/benchmark/endurance gates run separately',before,fixture,after:await p.evaluate(renderState),wallSeconds:(Date.now()-started)/1000}};
 }finally{
  await p.evaluate(()=>{paused=true;});
  await p.locator('#btnSet').click();
  await p.locator('#lightningProfile').selectOption(previousProfile);
  await p.locator('#btnDrawerClose').click();
  await p.waitForFunction(profile=>L.profile===profile,previousProfile);
 }
});
await p.evaluate(()=>{paused=true;});
await check('London save identity survives restore',async()=>{await p.evaluate(()=>{savePrefs(true);});const before=await p.evaluate(()=>structuredClone(SAVED.flight));assert.equal(before.worldMode,'LONDON');await p.evaluate(()=>{continueSavedFlight();paused=true;});const after=await p.evaluate(()=>({mode:worldMode,pos:[P.pos.x+OX,P.pos.y,P.pos.z+OZ]}));assert.equal(after.mode,'LONDON');assert.ok(Math.hypot(after.pos[0]-before.pos[0],after.pos[2]-before.pos[2])<.01);return after;});
await check('London mission menu restricts unsupported legacy-only worlds',async()=>{const options=await p.evaluate(()=>Object.fromEntries([...document.querySelector('#selScen').options].map(o=>[o.value,o.disabled])));assert.ok(options['TRAFFIC INTERCEPT']);assert.ok(options['OFFSHORE RECOVERY']);assert.equal(options['CONVENTIONAL TAKEOFF'],false);return options;});
await check('profile switches retain landmarks and bounded scene resources',async()=>{const states=[];for(const profile of['BATTERY','BALANCED','HIGH','BALANCED']){states.push(await p.evaluate(v=>{L.profile=v;applyQuality();let landmarks=0;worldGroup.getObjectByName('London OS offline scenery')?.traverse(o=>{if(o.userData.landmark)landmarks++;});return{profile:v,mode:worldMode,landmarks,stats:LightningLondon.stats(),buffer:[renderer.domElement.width,renderer.domElement.height]};},profile));}assert.ok(states.every(s=>s.mode==='LONDON'&&s.landmarks===9&&s.buffer[0]>0));assert.ok(states.every(s=>s.stats.buildingTiles<=100));return states;});
await check('context restoration leaves a rendered London world',async()=>{const supported=await p.evaluate(()=>{const e=renderer.getContext().getExtension('WEBGL_lose_context');if(!e)return false;e.loseContext();setTimeout(()=>e.restoreContext(),300);return true;});assert.ok(supported);await p.waitForTimeout(1800);assert.equal(await p.evaluate(()=>renderer.getContext().isContextLost()),false);assert.equal(await p.evaluate(()=>worldMode),'LONDON');return await snapshot(p);});
await check('no JavaScript/shader errors or remote requests',async()=>{assert.deepEqual(session.errors,[]);return{errors:session.errors,warnings:session.warnings,requests:session.requests.length};});
report.status=report.checks.every(x=>x.status==='PASS')?'PASS':'FAIL';}catch(e){report.failure=String(e);}finally{if(session)await session.close();await fs.mkdir('benchmarks/london-v0.3',{recursive:true});await fs.writeFile('benchmarks/london-v0.3/functional.json',JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify({status:report.status,checks:report.checks.map(c=>({name:c.name,status:c.status,error:c.error})),failure:report.failure}));if(report.status!=='PASS')process.exitCode=1;


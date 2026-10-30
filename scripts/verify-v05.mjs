import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {browserSession,startFlight} from '../tests/helpers/browser.mjs';
import {repositoryRoot} from '../tests/helpers/source.mjs';
import {createGpuTimer} from './gpu-timing.mjs';
import {frameStatistics,pairedChanges} from './v05-statistics.mjs';

const files={before:path.resolve(process.argv[2]||'dist/v04-baseline.html'),after:path.resolve(process.argv[3]||'dist/index.html')};
const seconds=Number(process.env.V05_BENCH_SECONDS||10),repeats=Number(process.env.V05_BENCH_REPEATS||3);
assert.ok(Number.isFinite(seconds)&&seconds>=1&&seconds<=60,'V05_BENCH_SECONDS must be 1..60');
assert.ok(Number.isInteger(repeats)&&repeats>=1&&repeats<=7,'V05_BENCH_REPEATS must be 1..7');
// Fixed-pose fixtures isolate rendering. Real takeoff, streaming and sustained
// flight are separate mandatory checks; no FPS claim is made from a screenshot.
const scenes=[
 {name:'01-heathrow-runway',pos:[-1800,35,-480],cam:[-1850,42,-480],look:[0,30,-530],aircraft:true},
 {name:'02-heathrow-departure',pos:[-1200,500,2300],cam:[-1200,500,2300],look:[700,30,200]},
 {name:'03-london-skyline',pos:[24000,610,-3600],cam:[23600,610,-2400],look:[25000,25,-5000]},
 {name:'04-westminster-low',pos:[23000,180,-3000],cam:[22980,180,-3100],look:[23280,45,-3507]},
 {name:'05-tower-bridge',pos:[26400,220,-3700],cam:[26300,220,-3700],look:[26670,30,-4260]},
 {name:'06-shard-city',pos:[25600,250,-3650],cam:[25380,210,-3670],look:[25903,140,-4132]},
 {name:'07-canary-wharf',pos:[29700,450,-3000],cam:[29700,450,-3000],look:[30550,100,-4300]},
 {name:'08-residential-roofs',pos:[15000,180,-1800],cam:[14700,220,-1400],look:[15600,20,-2500]},
 {name:'09-high-altitude',pos:[23000,5000,-2000],cam:[21000,5000,2000],look:[25500,0,-4600]},
 {name:'10-cockpit',pos:[-4200,220,-415],cockpit:true,aircraft:true},
 {name:'11-night-london',pos:[25000,600,-2000],cam:[24000,500,-2800],look:[26000,100,-4800],hour:23.3},
 {name:'12-heavy-weather',pos:[25000,600,-2000],cam:[24000,500,-2800],look:[26000,100,-4800],weather:'ts'},
 // Additional unmeasured sensitive-region captures supplement the twelve timings.
 {name:'13-sunset',pos:[25000,600,-2000],cam:[24000,500,-2800],look:[26000,100,-4800],hour:18.1,captureOnly:true},
 {name:'14-gherkin',pos:[26300,300,-4500],cam:[26080,250,-4450],look:[26304.3,100,-5255],captureOnly:true},
 {name:'15-aircraft-exterior',pos:[-1200,500,2300],cam:[-1220,504,2310],look:[-1200,500,2300],aircraft:true,captureOnly:true},
 {name:'16-london-eye',pos:[23609,200,-3500],cam:[23400,180,-3500],look:[23609.5,70,-3938.7],captureOnly:true},
 {name:'17-st-pauls',pos:[25057,210,-4700],cam:[24800,200,-4700],look:[25057.4,70,-5144.6],captureOnly:true},
 {name:'18-buckingham',pos:[22067,160,-3300],cam:[21800,170,-3300],look:[22067.2,35,-3687.9],captureOnly:true},
 {name:'19-battersea',pos:[21884,200,-1000],cam:[21600,180,-1100],look:[21884,70,-1513],captureOnly:true}
];
const hash=b=>createHash('sha256').update(b).digest('hex'),out=path.resolve('benchmarks/london-v0.5');
const durationStatistics=values=>{const a=values.filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b),q=p=>a.length?a[Math.max(0,Math.ceil(a.length*p)-1)]:null;return{p50:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1)??null};};
await fs.mkdir(out,{recursive:true});
const report={schema:1,status:'FAIL',date:new Date().toISOString(),secondsPerRun:seconds,repeats,
 sourceCommit:process.env.GITHUB_SHA||null,baselineSourceCommit:'ca330131115ee983a6457efa33ff513ac34803ad',
 method:'Same Chromium process, separate contexts, sequential rendering (the other page has no animation loop). Fixed poses, seed4201, simulation clock120, profileBALANCED Q1, camera58deg, actual1152x648 drawing buffer. Complete streaming convergence before captures. The local shadow system keeps its existing four-Hz update schedule during timed rendering. AB/BA alternation across repeated paired measurements. Timings exclude shader/resource instrumentation; a separate untimed diagnostic pass records those counters. Physics paused: these are rendering observations, not control or real-time-flight evidence.',
 limits:['SwiftShader software renderer, NOT Mali-G72 or Galaxy A51.','Three repeated runs give descriptive paired variability, not a reliable hardware-performance confidence interval.','CPU submission includes browser/driver overhead; GPU timings are reported only when nonblocking extension results are valid.','Texture residency is an estimate from dimensions and mip flags; not a driver memory measurement.','Long tasks are observable main-thread stalls, not identified garbage collections.','Input latency, Android PSS, thermals, battery and physical-device acceptance remain unavailable.'],
 sources:{},environment:null,scenarios:[],shots:[],checks:[],errors:[],warnings:[]};
for(const[label,file]of Object.entries(files)){const b=await fs.readFile(file);report.sources[label]={file:path.relative(repositoryRoot,file),bytes:b.length,sha256:hash(b)};}
assert.equal(report.sources.before.sha256,'f1f6a9e9b19c0bc8210b5bab4ef91e9b03c854f0b895cda0c965ae6779a45aad','Baseline must be the exact published v0.4 browser HTML');

function seedScript(){
 let seed=4201;window.__v05ResetRandom=()=>{seed=4201;};
 Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
 localStorage.setItem('f35b_anchor_overhaul_v3',JSON.stringify({worldMode:'LONDON',seed:4201,tutorialSeen:true,settings:{quality:'MED',volume:0},simHours:13.2}));
 localStorage.setItem('lightning_options_v1',JSON.stringify({profile:'BALANCED',diagnostics:false}));
}

// Test-only instrumentation. Wrappers are installed after timings and restored
// in a finally block, so their allocations do not contaminate primary samples.
function installResourceProbe(){
 const gl=renderer.getContext(),saved=new Map(),counts={createShader:0,createProgram:0,compileShader:0,linkProgram:0,texImage2D:0,texSubImage2D:0,bufferData:0,bufferSubData:0,bufferUploadBytes:0,textureUploadEstimatedBytes:0,textureUploadUnknownEvents:0,framebufferTexture2D:0,bindFramebuffer:0};
 const bytes=v=>typeof v==='number'?Math.max(0,v):v?.byteLength||0;
 for(const name of Object.keys(counts).filter(n=>typeof gl[n]==='function')){
  saved.set(name,gl[name]);gl[name]=function(...args){counts[name]++;
   if(name==='bufferData')counts.bufferUploadBytes+=bytes(args[1]);
   if(name==='bufferSubData')counts.bufferUploadBytes+=bytes(args[2]);
   if(name==='texImage2D'||name==='texSubImage2D'){
    const source=args.at(-1);if(source?.byteLength)counts.textureUploadEstimatedBytes+=source.byteLength;
    else if(source?.width&&source?.height)counts.textureUploadEstimatedBytes+=source.width*source.height*4;
    else counts.textureUploadUnknownEvents++;
   }
   return saved.get(name).apply(this,args);
  };
 }
 let observer=null,longTasks=[];
 if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
  observer=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({start:e.startTime,duration:e.duration});});observer.observe({type:'longtask'});
 }
 window.__v05Probe={counts,stop(){for(const[name,fn]of saved)gl[name]=fn;observer?.disconnect();return{counts,longTasks,longTasksSupported:!!observer};}};
}

function sceneState(){
 const geometry=new Set(),textures=new Set(),materials=new Set();let geometryAttributeBytes=0,indexBytes=0,textureEstimatedRGBABytes=0;
 scene.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)for(const m of[o.material].flat())materials.add(m);});
 for(const g of geometry){for(const a of Object.values(g.attributes||{}))geometryAttributeBytes+=a.array?.byteLength||0;indexBytes+=g.index?.array?.byteLength||0;}
 for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const u of Object.values(m.uniforms||{}))if(u?.value?.isTexture)textures.add(u.value);}
 for(const t of textures){const images=Array.isArray(t.image)?t.image:[t.image];for(const i of images){const w=i?.width||i?.videoWidth||0,h=i?.height||i?.videoHeight||0;textureEstimatedRGBABytes+=w*h*4*(t.generateMipmaps?4/3:1);}}
 return{build:globalThis.__LIGHTNING_BUILD__,world:worldMode,position:P.pos.toArray(),camera:camera.position.toArray(),lookDirection:camera.getWorldDirection(new THREE.Vector3()).toArray(),fov:camera.fov,
  simulationTime:simT,flightTime:flightT,simulationHour:simHours,weather:wxPreset,quality:qlLevel,profile:L.profile,governorFrozen:true,
  viewport:[innerWidth,innerHeight],devicePixelRatio,drawingBuffer:[renderer.domElement.width,renderer.domElement.height],
  renderer:{...renderer.info.render,...renderer.info.memory,programs:renderer.info.programs?.length??null},
  memory:{heapBytes:performance.memory?.usedJSHeapSize??null,heapLimitBytes:performance.memory?.jsHeapSizeLimit??null,sceneGeometryObjects:geometry.size,geometryAttributeBytes,indexBytes,sceneTextureObjects:textures.size,textureEstimatedRGBABytes},
  scenery:LightningLondon.stats(),shadows:LightningLondonLighting.stats(),landmarkCount:worldGroup.getObjectByName('LondonLandmarks')?.children.length??0,
  contextLost:renderer.getContext().isContextLost()};
}

let session,pages={};
const save=()=>fs.writeFile(path.join(out,'paired-render.json'),JSON.stringify(report,null,2)+'\n');
try{
 session=await browserSession({file:files.before});
 report.environment={...session.environment,browserVersion:session.browser.version(),sameBrowserProcess:true};
 // The initial helper page is stopped before opening the second context.
 await session.page.evaluate(()=>{paused=true;loop=()=>{};});await session.context.close();
 for(const label of ['before','after']){
  const context=await session.browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.addInitScript(seedScript);const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push({label,error:String(e)}));
  page.on('console',msg=>{if(msg.type()==='error')report.errors.push({label,error:msg.text()});if(msg.type()==='warning')report.warnings.push({label,warning:msg.text()});});
  await page.route('**/*',async route=>{const u=route.request().url();if(u.startsWith(session.origin+'/')||u.startsWith('data:')||u.startsWith('blob:'))await route.continue();else{report.errors.push({label,error:'External dependency: '+u});await route.abort();}});
  await page.goto(session.origin+'/'+path.relative(repositoryRoot,files[label]).split(path.sep).map(encodeURIComponent).join('/'),{waitUntil:'load',timeout:180000});
  await page.waitForFunction(()=>window.__F35B_SIM__,null,{timeout:120000});
  await startFlight(page,{start:'RUNWAY'});
  await page.evaluate(()=>{paused=true;window.__v05OriginalLoop=loop;window.__v05OriginalUpdateCamera=updateCamera;loop=()=>{};updateCamera=()=>{};});
  await page.waitForTimeout(100);
  await page.evaluate('window.__v05CreateGpuTimer='+createGpuTimer.toString());
  await page.evaluate('window.__v05SceneState='+sceneState.toString());
  await page.evaluate('window.__v05InstallProbe='+installResourceProbe.toString());
  await page.evaluate(()=>{window.__v05Gpu=__v05CreateGpuTimer(renderer.getContext());});
  pages[label]={page,context};
  await fs.mkdir(path.resolve('screenshots/london-v0.5',label),{recursive:true});
 }
 for(const[index,settings]of scenes.entries()){
  const sceneReport={name:settings.name,settings,runs:{before:[],after:[]},states:{},warm:{},resources:{}};
  for(const label of ['before','after']){
   const p=pages[label].page;
   await p.bringToFront();
   await p.evaluate(()=>__v05InstallProbe());
   await p.evaluate(s=>{
    paused=true;window.__v05ResetRandom();L.profile='BALANCED';S.quality='MED';qlLevel=1;applyQl();worldMode='LONDON';startType='AIR';scenario='FREE FLIGHT';newWorld(4201);
    simT=120;simHours=s.hour??13.2;flightT=0;OX=OZ=0;worldGroup.position.set(0,0,0);P.pos.fromArray(s.pos);P.vel.set(120,0,0);P.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);P.om.set(0,0,0);gearD=gearT=0;parkBrake=false;
    wxPreset=s.weather||'cavok';applyWx();camMode=s.cockpit?1:2;applyVisibility();updateAttitudeData();updateAcSurfaces(0);clearVapour();
    if(s.cockpit){camera.position.copy(P.pos).add(new THREE.Vector3(0,.8,-2.18).applyQuaternion(P.quat));camera.quaternion.copy(P.quat);drawPCD();}
    else{camera.position.fromArray(s.cam);camera.lookAt(new THREE.Vector3(...s.look));}
    camera.fov=58;camera.updateProjectionMatrix();sky.position.copy(camera.position);water.position.x=camera.position.x;water.position.z=camera.position.z;waterMat.uniforms.uOffset.value.set(water.position.x+OX,water.position.z+OZ);updateWeather(0);
    // Force the same shadow snapshot rather than depend on startup wall-clock.
    LightningLondonLighting.update(THREE,renderer,scene,sunLight,sunDir,P.pos,heightAt(P.pos.x,P.pos.z),1,dayF,s.warm,true);
    if(!s.aircraft){ac.visible=false;cockpitGrp.visible=false;}else applyVisibility();
    ensureRegionalFeatures(0,true);chunkTimer=0;chunkBudget=999;ensureChunks(1);processChunksTimed(5000);
    terrainMat.uniforms.uOrigin.value.set(0,0);terrainMat.uniforms.uSun.value.copy(sunDir);terrainMat.uniforms.uFog.value.copy(scene.fog.color);terrainMat.uniforms.uFogD.value=scene.fog.density;terrainMat.uniforms.uDay.value=dayF;terrainMat.uniforms.uWet.value=wx.wet?1:0;terrainMat.uniforms.uTime.value=simT;
    waterMat.uniforms.uSun.value.copy(sunDir);waterMat.uniforms.uFog.value.copy(scene.fog.color);waterMat.uniforms.uFogD.value=scene.fog.density;waterMat.uniforms.uNight.value=nightF;
    LightningVisuals.updateAircraft({distance:camera.position.distanceTo(P.pos),quality:1,night:nightF});LightningVisuals.updateCockpit({roll:0,pitch:0,throttle:.2,night:nightF});
    window.__v05Warm={time:s.warm,turns:0,stable:0,lastTiles:-1};
   },{...settings,warm:10000+index*1000});
   const warmStart=Date.now();let done=false;
   while(Date.now()-warmStart<120000){
    const state=await p.evaluate(()=>{const w=__v05Warm;w.time+=.05;w.turns++;LightningLondon.update(P.pos.x,P.pos.z,P.pos.y,1,nightF,w.time);const s=LightningLondon.stats();const quiet=!s.pendingBuildings&&!(s.queuedBuildings||0)&&!(s.pendingPrepared||0)&&!s.imagery?.pending;w.stable=quiet&&s.buildingTiles===w.lastTiles?w.stable+1:0;w.lastTiles=s.buildingTiles;return{done:w.stable>=12,turns:w.turns,stats:s};});
    if(state.done){sceneReport.warm[label]={wallMs:Date.now()-warmStart,turns:state.turns,stats:state.stats};done=true;break;}
    await p.waitForTimeout(5);
   }
   assert.ok(done,`${label} ${settings.name}: scenery did not converge`);
   // All uploads/compilation get untimed warm frames; captures occur immediately
   // after an explicit render at the canvas's intrinsic framebuffer dimensions.
   await p.evaluate(()=>{for(let i=0;i<3;i++)renderer.render(scene,camera);});
   const capture=await p.evaluate(()=>{renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);return{png:renderer.domElement.toDataURL('image/png'),state:__v05SceneState()};});
   assert.deepEqual(capture.state.drawingBuffer,[1152,648]);assert.equal(capture.state.quality,1);assert.equal(capture.state.landmarkCount,9);assert.equal(capture.state.contextLost,false);
   sceneReport.states[label]=capture.state;
   sceneReport.resources[label]=await p.evaluate(()=>__v05Probe.stop());
   const png=Buffer.from(capture.png.split(',')[1],'base64'),shotPath=path.resolve('screenshots/london-v0.5',label,settings.name+'.png');await fs.writeFile(shotPath,png);
   report.shots.push({label,name:settings.name,file:path.relative(repositoryRoot,shotPath),sha256:hash(png),bytes:png.length,state:capture.state});
  }
  const comparable=s=>({drawingBuffer:s.drawingBuffer,quality:s.quality,profile:s.profile,position:s.position,camera:s.camera,lookDirection:s.lookDirection,fov:s.fov,simulationTime:s.simulationTime,simulationHour:s.simulationHour,weather:s.weather,landmarks:s.landmarkCount,shadow:s.shadows});
  assert.deepEqual(comparable(sceneReport.states.before),comparable(sceneReport.states.after),settings.name+': uncontrolled rendering settings');
  if(!settings.captureOnly)for(let repeat=0;repeat<repeats;repeat++){
   const order=repeat%2?['after','before']:['before','after'];
   for(const label of order){
    const p=pages[label].page;
    await p.bringToFront();
    const raw=await p.evaluate(async duration=>{
     const intervals=[],submissions=[],start=performance.now();let previous=null;
     __v05Gpu.reset();
     while(performance.now()-start<duration*1000||intervals.length<2){
      await new Promise(resolve=>requestAnimationFrame(resolve));const now=performance.now();if(previous!==null)intervals.push(now-previous);previous=now;
      const begin=performance.now();__v05Gpu.begin();try{LightningLondonLighting.update(THREE,renderer,scene,sunLight,sunDir,P.pos,heightAt(P.pos.x,P.pos.z),1,dayF,performance.now()/1000,true);renderer.render(scene,camera);}finally{__v05Gpu.end();}submissions.push(performance.now()-begin);
     }
     return{intervals,submissions,elapsedMs:performance.now()-start,gpu:__v05Gpu.summary(),state:__v05SceneState()};
    },seconds);
    assert.ok(raw.intervals.length>=2,label+' insufficient frames');
    assert.deepEqual(raw.state.drawingBuffer,[1152,648]);assert.equal(raw.state.quality,1);
    sceneReport.runs[label].push({repeat,order:order.join('/'),...frameStatistics(raw.intervals),cpuSubmissionMs:frameStatistics(raw.submissions).frameMs,raw});
   }
  }
  sceneReport.paired={medianFps:pairedChanges(sceneReport.runs.before.map((r,i)=>[r.medianFps,sceneReport.runs.after[i].medianFps])),p95FrameMs:pairedChanges(sceneReport.runs.before.map((r,i)=>[r.frameMs.p95,sceneReport.runs.after[i].frameMs.p95]))};
  report.scenarios.push(sceneReport);await save();
  console.log(settings.name,settings.captureOnly?'captured':JSON.stringify(sceneReport.paired));
 }
 report.productionLoopObservations={method:'Separate 30-wall-second instrumented observations execute the saved production loop on native RAF timestamps. Both start parked on the same runway with throttle0 and parking brake. The loop variable remains a no-op so its internal RAF scheduling does not start a second loop. Function spans are inclusive and must not be added together. Physics, weather, UI, terrain and normal governor all run. The timing correction changes simulated progression, scenery clocks and potentially work/trajectory, so these observations are NOT a controlled FPS speedup comparison.',runs:{}};
 for(const label of ['before','after']){
  const p=pages[label].page;await p.bringToFront();
  const observation=await p.evaluate(async()=>{
   paused=true;window.__v05ResetRandom();L.profile='BALANCED';S.quality='MED';qlLevel=1;applyQl();worldMode='LONDON';startType='RUNWAY';scenario='FREE FLIGHT';newWorld(4201);placeAt('RUNWAY');
   simT=0;flightT=0;simHours=13.2;wxPreset='cavok';applyWx();P.vel.set(0,0,0);P.om.set(0,0,0);thr=thrT=0;parkBrake=true;gearD=gearT=1;AP.mode='OFF';camMode=0;updateCamera=window.__v05OriginalUpdateCamera;snapCameraToAircraft();running=true;crashed=false;paused=false;physAcc=0;last=performance.now();cadence.reset();
   const startState=__v05SceneState(),simStart=simT,flightStart=flightT;let start=performance.now();
   const phases={},callCounts={},frameRows=[],intervals=[],restore=[];let current={},lastRender=null,rendered=false;
   const wrap=(name,get,set)=>{const original=get();phases[name]=[];callCounts[name]=0;set(function(...args){const t=performance.now();try{return original.apply(this,args);}finally{current[name]=(current[name]||0)+performance.now()-t;callCounts[name]++;}});restore.push(()=>set(original));};
   wrap('physics',()=>physics,f=>{physics=f;});wrap('ensureChunks',()=>ensureChunks,f=>{ensureChunks=f;});wrap('processChunksTimed',()=>processChunksTimed,f=>{processChunksTimed=f;});wrap('ensureVisuals',()=>ensureVisuals,f=>{ensureVisuals=f;});wrap('updateLiving',()=>updateLiving,f=>{updateLiving=f;});wrap('updateWeather',()=>updateWeather,f=>{updateWeather=f;});wrap('updateAcSurfaces',()=>updateAcSurfaces,f=>{updateAcSurfaces=f;});wrap('updateCamera',()=>updateCamera,f=>{updateCamera=f;});wrap('drawHMDS',()=>drawHMDS,f=>{drawHMDS=f;});wrap('drawPCD',()=>drawPCD,f=>{drawPCD=f;});wrap('london',()=>LightningLondon.update,f=>{LightningLondon.update=f;});
   const originalRender=renderer.render;phases.render=[];callCounts.render=0;renderer.render=function(...args){const t=performance.now();if(lastRender!==null)intervals.push(t-lastRender);lastRender=t;rendered=true;try{return originalRender.apply(this,args);}finally{current.render=(current.render||0)+performance.now()-t;callCounts.render++;}};restore.push(()=>{renderer.render=originalRender;});
   let diagnostic=null;
   if(globalThis.LightningDiagnostics)LightningDiagnostics.start(4096);start=performance.now();last=start;cadence.reset();
   try{
    while(performance.now()-start<30000){const now=await new Promise(resolve=>requestAnimationFrame(resolve));current={};rendered=false;const begin=performance.now();window.__v05OriginalLoop(now);if(rendered){for(const name of Object.keys(phases))phases[name].push(current[name]||0);frameRows.push({wall:performance.now()-start,simT,flightT,debtSeconds:physAcc,quality:qlLevel,drawingBuffer:[renderer.domElement.width,renderer.domElement.height],cpuWorkMs:performance.now()-begin,position:[P.pos.x+OX,P.pos.y,P.pos.z+OZ],crashed});}}
   }finally{paused=true;for(const fn of restore.reverse())fn();if(globalThis.LightningDiagnostics){diagnostic=LightningDiagnostics.summary();LightningDiagnostics.stop();}updateCamera=()=>{};}
   const elapsedSeconds=(performance.now()-start)/1000;
   return{elapsedSeconds,simulatedSeconds:simT-simStart,flightSeconds:flightT-flightStart,simulationToWallRatio:(simT-simStart)/elapsedSeconds,debtSeconds:physAcc,phases,callCounts,frameRows,intervals,diagnostic,startState,endState:__v05SceneState(),instrumentation:'Function wrappers and optional bounded v0.5 diagnostics enabled. No overhead-corrected performance claim.'};
  });
  observation.frameStatistics=frameStatistics(observation.intervals);
  observation.phaseStatistics=Object.fromEntries(Object.entries(observation.phases).map(([name,values])=>[name,{calls:observation.callCounts[name],totalMs:values.reduce((a,b)=>a+b,0),perPresentedFrameMs:durationStatistics(values)}]));
  assert.ok(observation.frameRows.length>=2,label+' production loop did not present enough frames');
  assert.equal(observation.endState.contextLost,false,label+' lost graphics context');
  report.productionLoopObservations.runs[label]=observation;await save();
 }
 assert.equal(report.errors.length,0,'JavaScript, shader, network or WebGL errors captured');
 for(const[label,file]of Object.entries(files))assert.equal(hash(await fs.readFile(file)),report.sources[label].sha256,'Build changed during run');
 report.checks.push({name:'matched-settings-and-complete-scenes',status:'PASS'},{name:'source-bytes-unchanged',status:'PASS'},{name:'no-javascript-shader-network-errors',status:'PASS'});
 report.status='MEASURED';
}catch(e){report.error=String(e);process.exitCode=1;}
finally{
 for(const{page}of Object.values(pages))await page.evaluate(()=>{window.__v05Gpu?.dispose();window.__v05Probe?.stop();}).catch(()=>{});
 if(session)await session.close();await save();
}
console.log(JSON.stringify({status:report.status,scenarios:report.scenarios.length,error:report.error,report:path.relative(repositoryRoot,path.join(out,'paired-render.json'))}));

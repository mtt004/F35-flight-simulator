import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractFunction} from '../helpers/source.mjs';

const source=fs.readFileSync('src/simulator.js','utf8');
const runtime=fs.readFileSync('src/ui/runtime.js','utf8');
// Execute the production frame loop: unrelated rendering/flight systems are
// substitutes so assertions isolate scheduling rather than GPU speed.
function fixture({diagnostics=false}={}){
 const c=vm.createContext({console});c.window=c;
 vm.runInContext(fs.readFileSync('src/vendor/three-r128.min.js','utf8'),c);
 vm.runInContext(`
 let now=0,frameStart=0,lastWorkMs=0,frameEMA=16.7,stepsLast=0;
 const performance={now:()=>now},requestAnimationFrame=()=>{},document={hidden:false};
 const cadence={ready:()=>true,reset(){}},workSamples=[];
 const FDT=1/120;let last=0,physAcc=0,syncT=0,pcdT=0,saveT=15;
 let simT=0,running=true,paused=false,crashed=false,replayActive=false,contextLost=false,crashAfter=Infinity,physicsCalls=0;
 const worldElapsed={weather:0,living:0,regional:0,chunks:0,traffic:0},visualSteps=[];
 const physics=dt=>{simT+=dt;if(++physicsCalls>=crashAfter)crashed=true;};
 const marks=[];globalThis.LightningDiagnostics={enabled:${diagnostics},beginFrame:(...a)=>marks.push(['begin',...a]),mark:n=>marks.push(n),endFrame:(t,debt)=>marks.push(['end',t,debt])};
 const lerp=(a,b,t)=>a+(b-a)*t,ql=()=>1;
 const P={pos:new THREE.Vector3(),vel:new THREE.Vector3()},OX=0,OZ=0,FPM=196.85;
 let chunkBudget=0,vapourCount=0,vsFpm=0,camMode=0,qlLevel=1,ailIn=0,elIn=0,thr=0,nightF=0,dayF=1;
 const wx={wet:false},sunDir=new THREE.Vector3(0,1,0),worldMode='LONDON';
 const sky={position:new THREE.Vector3()},water={position:new THREE.Vector3()};
 const camera={position:new THREE.Vector3()},scene={fog:{color:new THREE.Color(),density:0}};
 const uniform=()=>({value:{set(){},copy(){}}}),uniforms=()=>new Proxy({},{get:(o,k)=>o[k]??(o[k]=uniform())});
 const waterMat={uniforms:uniforms()},terrainMat={uniforms:uniforms()};
 const renderer={render(){}};const LightningVisuals={updateAircraft(){},updateCockpit(){}};
 let londonCalls=0;const LightningLondon={update(){londonCalls++;}};
 const noop=()=>{};
 const drawBootBg=noop,pollGamepad=noop,gyroSample=noop,updateWeather=dt=>worldElapsed.weather+=dt,updateReplay=noop,rebaseOrigin=noop;
 const ensureRegionalFeatures=dt=>worldElapsed.regional+=dt,ensureChunks=dt=>worldElapsed.chunks+=dt,processChunksTimed=noop,updateLiving=dt=>worldElapsed.living+=dt,updateAcSurfaces=dt=>visualSteps.push(dt),updateVapour=()=>0;
 const syncTouch=noop,updateInfoPan=noop,drawPCD=noop,savePrefs=noop,governor=noop,audioUpdate=noop,updateCamera=noop;
 const drawHMDS=noop,drawInfoMap=noop,updateDbg=noop,updateLightningMeter=noop,$=()=>({classList:{contains:()=>false,add:noop,remove:noop,toggle:noop},setAttribute:noop});
 const closeTransientMenus=noop,fmtT=String,flightT=0,landings=0,fuel=2000,wxPreset='cavok';let helpResume=false,missionBannerT=0;
 const updateTrafficAwareness=dt=>worldElapsed.traffic+=dt,updateTrafficTargetMarker=noop,updateSurfaceEffects=noop,updateCanopyRain=noop;
 ${extractFunction(source,'operationsVisualUpdate')}
 ${extractFunction(source,'togglePause')}
 ${extractFunction(source,'showHelp')}
 ${extractFunction(source,'closeHelp')}
 ${extractFunction(source,'ensureVisuals')}
 ${extractFunction(source,'loop')}
 ${extractFunction(runtime,'resumeLightning')}
 this.frame=t=>{now=t;loop(t);};
 this.state=()=>({simT,physAcc,stepsLast,physicsCalls,londonCalls,marks:marks.slice(),worldElapsed:{...worldElapsed},visualSteps:visualSteps.slice()});
 this.pause=v=>{paused=v;};this.hidden=v=>{document.hidden=v;};this.lost=v=>{contextLost=v;};
 this.resume=()=>resumeLightning();this.crashAfter=n=>{crashAfter=n;};
 this.toggleAt=t=>{now=t;togglePause();};this.helpAt=t=>{now=t;showHelp();};this.closeHelpAt=t=>{now=t;closeHelp();};
 `,c);
 return c;
}

for(const fps of [60,30,10,2])test(`actual frame loop preserves 120 Hz time progression at ${fps} rendered FPS`,()=>{
 const f=fixture();for(let i=1;i<=fps*10;i++)f.frame(i*1000/fps);
 const s=f.state();assert.ok(Math.abs(s.simT-10)<1/120+1e-9,JSON.stringify(s));
 assert.ok(s.physAcc<1/120+1e-9);assert.equal(s.physicsCalls,1200);
});

for(const fps of [60,30,10,2])test(`world-state clocks follow executed physics at ${fps} rendered FPS`,()=>{
 const f=fixture();for(let i=1;i<=fps*4;i++)f.frame(i*1000/fps);
 const s=f.state();for(const [name,elapsed] of Object.entries(s.worldElapsed))assert.ok(Math.abs(elapsed-s.simT)<1e-9,name+': '+elapsed+' != '+s.simT);
 assert.ok(Math.max(...s.visualSteps)<=.05,'visual interpolation keeps its stable bound');
});

test('weather and traffic consume only executed time while catch-up debt remains',()=>{
 const f=fixture();f.frame(5000);const s=f.state();
 assert.ok(Math.abs(s.simT-1)<1e-9);for(const elapsed of Object.values(s.worldElapsed))assert.ok(Math.abs(elapsed-1)<1e-9);
});

test('pause and help transitions between frames exclude suspended wall time',()=>{
 for(const help of [false,true]){
  const f=fixture();f.frame(100);
  if(help){f.helpAt(110);f.closeHelpAt(5100);}else{f.toggleAt(110);f.toggleAt(5100);}
  f.frame(5200);assert.ok(Math.abs(f.state().simT-.2)<1e-9,JSON.stringify(f.state()));
  assert.ok(f.state().physAcc<1/120);
 }
});

test('jitter and a long stall retain bounded catch-up debt instead of dropping time',()=>{
 const f=fixture();f.frame(5000);let s=f.state();
 assert.equal(s.stepsLast,120);assert.ok(Math.abs(s.simT+s.physAcc-5)<1e-9);
 let now=5000;for(const dt of [17,33,250,16,50,17,17,17,17,17]){now+=dt;f.frame(now);assert.ok(f.state().stepsLast<=120);}
 s=f.state();assert.ok(s.physAcc<1/120+1e-9);assert.ok(Math.abs(s.simT+s.physAcc-now/1000)<1e-9);
});

test('paused frames clear debt and resume does not catch up hidden/context-loss time',()=>{
 const f=fixture();f.frame(100);f.pause(true);f.frame(5000);assert.equal(f.state().physAcc,0);
 f.pause(false);f.frame(5100);assert.ok(Math.abs(f.state().simT-.2)<1e-9);
 f.hidden(true);f.frame(20000);f.hidden(false);f.resume();f.frame(20100);assert.ok(Math.abs(f.state().simT-.3)<1e-9);
 f.lost(true);f.frame(30000);f.lost(false);f.resume();f.frame(30100);assert.ok(Math.abs(f.state().simT-.4)<1e-9);
});

test('a crash stops further physics steps in the same catch-up frame',()=>{
 const f=fixture();f.crashAfter(1);f.frame(500);assert.equal(f.state().physicsCalls,1);
 f.frame(1000);assert.equal(f.state().physicsCalls,1);assert.equal(f.state().physAcc,0);
});

test('London scenery is processed exactly once per rendered frame, including pause',()=>{
 const f=fixture();f.frame(34);assert.equal(f.state().londonCalls,1);
 f.pause(true);f.frame(68);assert.equal(f.state().londonCalls,2);
});

test('diagnostic phase hooks are opt-in and expose retained physics debt',()=>{
 const disabled=fixture();disabled.frame(34);assert.equal(disabled.state().marks.length,0);
 const f=fixture({diagnostics:true});f.frame(5000);const s=f.state();
 assert.deepEqual(Array.from(s.marks.filter(v=>typeof v==='string')),['physics','terrain','visuals','camera','london','ui','render']);
 assert.equal(s.marks[0][0],'begin');assert.equal(s.marks.at(-1)[0],'end');assert.ok(s.marks.at(-1)[2]>3.9);
});

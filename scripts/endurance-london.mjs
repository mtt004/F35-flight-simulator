import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {browserSession,startFlight} from '../tests/helpers/browser.mjs';
import {assessEndurance} from './endurance-policy.mjs';

const file=path.resolve(process.argv[2]||'dist/index.html');
const seconds=Number(process.env.LONDON_ENDURANCE_SECONDS||1200);
if(!Number.isFinite(seconds)||seconds<60||seconds>1800)throw Error('Endurance duration must be 60..1800 seconds');
const output='benchmarks/london-v0.3/endurance.json';
const report={status:'RUNNING',completed:false,date:new Date().toISOString(),
 sourceSha256:createHash('sha256').update(await fs.readFile(file)).digest('hex'),
 requestedWallSeconds:seconds,samples:[],
 method:'Configured airborne Heathrow fixture, then unmodified physics/autopilot/streaming in London. No position/velocity/attitude reassignment after fixture. Heading reverses at global x 28000 or -1000 m. This is a cloud stability observation, not a control-only runway round trip or physical-device acceptance.',
 limits:['Cloud software GPU, NOT Galaxy A51.','Frame intervals include software rendering and runtime overhead.','Heap and renderer counters do not qualify Android PSS, battery, temperature or GPU residency.']};
const session=await browserSession({file});report.environment=session.environment;const p=session.page;
const sample=()=>p.evaluate(()=>({wall:performance.now(),flightT,simT,crashed,paused,
 globalPosition:[P.pos.x+OX,P.pos.y,P.pos.z+OZ],velocity:P.vel.toArray(),quaternion:P.quat.toArray(),fuel,
 quality:qlLevel,profile:L.profile,world:__F35B_SIM__.world,
 calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
 geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
 heapBytes:performance.memory?.usedJSHeapSize??null,
 landmarks:worldGroup.getObjectByName('LondonLandmarks')?.children.length??0,
 contextLost:renderer.getContext().isContextLost(),contextLosses:__londonEndurance.contextLosses}));
const save=async()=>{await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');};
try{
 await p.selectOption('#worldMode','LONDON');await startFlight(p,{start:'AIR'});
 await p.evaluate(()=>{
  P.pos.set(-1300,900,-700);P.vel.set(140,0,0);P.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);P.om.set(0,0,0);
  gearD=gearT=0;parkBrake=false;camMode=0;AP.mode='HDG';AP.alt=900;AP.hdg=90;AP.spd=140;paused=false;snapCameraToAircraft();
  window.__londonEndurance={intervals:[],last:0,contextLosses:0};
  renderer.domElement.addEventListener('webglcontextlost',()=>__londonEndurance.contextLosses++);
  const render=renderer.render.bind(renderer);renderer.render=(...args)=>{
   const b=__londonEndurance,t=performance.now();if(b.last)b.intervals.push(t-b.last);b.last=t;return render(...args);
  };
 });
 const start=Date.now();report.samples.push(await sample());await save();
 while(Date.now()-start<seconds*1000){
  await p.waitForTimeout(Math.min(30000,seconds*1000-(Date.now()-start)));
  await p.evaluate(()=>{const x=P.pos.x+OX;if(x>28000)AP.hdg=270;else if(x< -1000)AP.hdg=90;});
  const state=await sample();report.samples.push(state);report.elapsedWallSeconds=(Date.now()-start)/1000;
  console.log(JSON.stringify({wallSeconds:report.elapsedWallSeconds,flightSeconds:state.flightT,position:state.globalPosition,crashed:state.crashed,calls:state.calls,quality:state.quality}));await save();
 }
 const raw=await p.evaluate(()=>__londonEndurance.intervals);const sorted=raw.slice().sort((a,b)=>a-b);
 const q=v=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*v))],worst=sorted.slice(-Math.max(1,Math.ceil(sorted.length*.01)));
 report.frames=raw.length;report.rawFrameMs=raw;
 report.frameMs={p50:q(.5),p95:q(.95),p99:q(.99)};
 report.medianFps=1000/q(.5);report.onePercentLowFps=1000/(worst.reduce((a,b)=>a+b,0)/worst.length);
 report.stuttersOver100ms=raw.filter(v=>v>100).length;
 report.thirtyFpsAcceptance=report.medianFps>=30&&report.frameMs.p95<=40;
 report.errors=session.errors;report.warnings=session.warnings;report.completed=true;
 report.assessment=assessEndurance(report.samples);
 report.status=report.assessment.issues.length||session.errors.length?'OBSERVED_FAILURE':report.assessment.recoveredContextLosses?'COMPLETED_WITH_RECOVERED_CONTEXT_LOSS':'COMPLETED_WITHOUT_OBSERVED_FLIGHT_FAILURE';
}catch(e){report.status='FAILED';report.error=String(e);report.errors=session.errors;}
finally{await save();await session.close();}
console.log(JSON.stringify({status:report.status,completed:report.completed,seconds:report.elapsedWallSeconds,medianFps:report.medianFps,p95:report.frameMs?.p95}));
if(!report.completed||report.status==='FAILED'||report.status==='OBSERVED_FAILURE')process.exitCode=1;

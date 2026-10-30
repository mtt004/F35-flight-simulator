// Repeated paired CPU streaming experiment. Uses async event-loop turns rather
// than GPU frames; update-work durations and convergence wall time are reported
// separately. These numbers are neither FPS nor a physical-device benchmark.
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const read=file=>fs.readFileSync(file,'utf8');
const baselineSource=execFileSync('git',['show',(process.env.LIGHTNING_BASELINE_REF||'ca330131115ee983a6457efa33ff513ac34803ad')+':src/terrain/london.js'],{encoding:'utf8'}),currentSource=read('src/terrain/london.js');
const dataBytes=gunzipSync(fs.readFileSync('scenery-packs/london/data.json.gz')).toString(),heightData=JSON.parse(gunzipSync(fs.readFileSync('scenery-packs/london-heights/heights.json.gz')));
const manifest=JSON.parse(read('scenery-packs/london-geometry/manifest.json')),assets=Object.fromEntries(Object.keys(manifest.outputs).filter(n=>n.endsWith('.bin.gz')).map(n=>[n,fs.readFileSync('scenery-packs/london-geometry/'+n).toString('base64')]));
const summary=values=>{const sorted=values.slice().sort((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];return{samples:values.length,total:values.reduce((n,v)=>n+v,0),p50:q(.5),p95:q(.95),p99:q(.99),max:sorted.at(-1)};};
const poses=[['initial-city',26000,-4000,600],['detailed-crossing-out',28500,-4000,600],['detailed-crossing-back',26000,-4000,600],['coarse-crossing',31000,-4000,600],['return-city',26000,-4000,600],['evict',-100000,600,100],['revisit',26000,-4000,600]];
async function run(label,source,usePrepared){
 const c=vm.createContext({console,performance,DecompressionStream,Blob,Response,atob});c.window=c;
 for(const file of ['src/vendor/three-r128.min.js','src/terrain/architecture.js','src/terrain/landmarks.js'])vm.runInContext(read(file),c);
 if(usePrepared)vm.runInContext(read('src/terrain/prepared-geometry.js'),c);vm.runInContext(source,c);
 c.__LONDON_HEIGHTS__=heightData;c.__LONDON_DATA__=JSON.parse(dataBytes);if(usePrepared)c.__LONDON_GEOMETRY__={manifest,assets};
 const a=c.LightningLondon;let t=performance.now();a.load(c.__LONDON_DATA__);const loadMs=performance.now()-t;
 c.LightningArchitecture=undefined;c.LightningLandmarks=undefined;t=performance.now();a.create(c.THREE,new c.THREE.Group());const createMs=performance.now()-t;
 let generationCalls=0,generationMs=0;const original=a.buildBuildings;a.buildBuildings=(...args)=>{const start=performance.now(),g=original(...args);generationMs+=performance.now()-start;generationCalls++;return g;};
 const scenarios=[];let time=0;
 for(const[name,x,z,alt]of poses){
  const work=[],beforeCalls=generationCalls,beforeGeneration=generationMs,start=performance.now(),cpuStart=process.cpuUsage();let idle=0,turns=0;
  while(idle<20&&turns<50000){
   const before=generationCalls,b=performance.now();a.update(x,z,alt,2,0,time);work.push(performance.now()-b);time+=1/60;turns++;
   await new Promise(resolve=>setImmediate(resolve));
   const stats=a.stats();if(generationCalls===before&&!stats.pendingBuildings&&!stats.pendingPrepared&&!stats.queuedBuildings&&!stats.prepared?.active&&!stats.prepared?.queued)idle++;else idle=0;
  }
  if(idle<20)throw Error(label+' did not converge: '+name);
  const stats=a.stats(),cpu=process.cpuUsage(cpuStart);scenarios.push({name,turns,convergenceWallMs:performance.now()-start,processCpuMs:{user:cpu.user/1000,system:cpu.system/1000,total:(cpu.user+cpu.system)/1000},updateWorkMs:summary(work),generationCalls:generationCalls-beforeCalls,generationMs:generationMs-beforeGeneration,stats});
 }
 a.dispose();return{label,loadMs,createMs,generationCalls,generationMs,scenarios};
}
const rounds=[];
for(let i=0;i<3;i++){
 // Alternate order to reduce a systematic warm-cache/JIT/order advantage.
 const order=i%2?['prepared','baseline']:['baseline','prepared'],pair={round:i+1,order};
 for(const label of order){pair[label]=await run(label,label==='baseline'?baselineSource:currentSource,label==='prepared');console.log('round',i+1,label,pair[label].generationCalls,'runtime batches');}
 rounds.push(pair);
}
const comparisons=poses.map(([name])=>{
 const pairs=rounds.map(r=>{const before=r.baseline.scenarios.find(s=>s.name===name),after=r.prepared.scenarios.find(s=>s.name===name);return{round:r.round,before,after,processCpuRatio:after.processCpuMs.total/before.processCpuMs.total,updateWorkRatio:after.updateWorkMs.total/before.updateWorkMs.total,convergenceWallRatio:after.convergenceWallMs/before.convergenceWallMs};});
 return{name,medianProcessCpuRatio:summary(pairs.map(p=>p.processCpuRatio)).p50,medianUpdateWorkRatio:summary(pairs.map(p=>p.updateWorkRatio)).p50,medianConvergenceWallRatio:summary(pairs.map(p=>p.convergenceWallRatio)).p50,pairs};
});
const report={status:'MEASURED',environment:{node:process.version,renderer:'CPU-only Node VM; no WebGL, GPU, rAF or A51',method:'Three rounds in alternating order. Both versions yield one setImmediate event-loop turn after each scenery update. Same positions, heights, original renderable data and quality. Update-work times exclude asynchronous completion callbacks; total process CPU includes native gzip and async completion work on all process threads. Convergence wall times include async waits. Not a browser frame-pacing or physical-device claim.',baselineSourceSha256:createHash('sha256').update(baselineSource).digest('hex'),finalSourceSha256:createHash('sha256').update(currentSource).digest('hex')},comparisons,rounds};
fs.writeFileSync('benchmarks/london-v0.5/cpu-paired.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(comparisons.map(({pairs,...row})=>row),null,2));

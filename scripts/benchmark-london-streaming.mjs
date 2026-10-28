import fs from'node:fs';import {gunzipSync} from'node:zlib';import vm from'node:vm';import {performance} from'node:perf_hooks';
const c=vm.createContext({console,performance});c.window=c;
vm.runInContext(fs.readFileSync('src/vendor/three-r128.min.js','utf8'),c);
vm.runInContext(fs.readFileSync(process.argv[2]||'src/terrain/london.js','utf8'),c);
let d=JSON.parse(gunzipSync(fs.readFileSync('scenery-packs/london/data.json.gz')));
const a=c.LightningLondon;let p=performance.now();a.load(d);const load=performance.now()-p;p=performance.now();a.create(c.THREE,new c.THREE.Group());const create=performance.now()-p;
let samples=[];for(let i=0;i<600;i++){p=performance.now();a.update(26000,-4000,600,2,0,i/60);samples.push(performance.now()-p);}samples.sort((a,b)=>a-b);const report={environment:'Node VM with real OS data and bundled Three geometry; CPU only, not GPU or A51',loadMs:load,createMs:create,p50:samples[300],p95:samples[570],p99:samples[594],max:samples[599],total:samples.reduce((a,b)=>a+b,0),stats:a.stats(),samples};fs.mkdirSync('benchmarks/london-v0.3',{recursive:true});fs.writeFileSync('benchmarks/london-v0.3/streaming-cpu.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,samples:undefined}));

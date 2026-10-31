// CPU construction experiment only. This does not measure GPU or Galaxy A51 FPS.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
const source=process.argv[2]||'src/terrain/london.js',output=process.argv[3]||'benchmarks/london-v0.5/streaming.json';
const c=vm.createContext({console,performance});c.window=c;
for(const file of ['src/vendor/three-r128.min.js','src/terrain/architecture.js','src/terrain/landmarks.js',source])vm.runInContext(fs.readFileSync(file,'utf8'),c);
c.__LONDON_HEIGHTS__=JSON.parse(gunzipSync(fs.readFileSync('scenery-packs/london-heights/heights.json.gz')));
const data=JSON.parse(gunzipSync(fs.readFileSync('scenery-packs/london/data.json.gz'))),a=c.LightningLondon;
let start=performance.now();a.load(data);const loadMs=performance.now()-start;
// Exclusions/classification were applied by load. No canvas/WebGL operations
// enter this construction experiment; streaming retains the classified records.
c.LightningArchitecture=undefined;c.LightningLandmarks=undefined;
start=performance.now();a.create(c.THREE,new c.THREE.Group());const createMs=performance.now()-start;
let builds=0,vertices=0;const build=a.buildBuildings;
a.buildBuildings=(...args)=>{builds++;const geometry=build(...args);vertices+=geometry.attributes.position.count;return geometry;};
const poses=[['initial-city',26000,-4000,600,600],['detailed-transition',28500,-4000,600,600],['coarse-transition',31000,-4000,600,600],['return-city',26000,-4000,600,600],['evict',-100000,600,100,30],['revisit',26000,-4000,600,600]];
const results=[];let time=0;
for(const [name,x,z,alt,frames] of poses){
 const samples=[],before=builds;
 for(let i=0;i<frames;i++){start=performance.now();a.update(x,z,alt,2,0,time);samples.push(performance.now()-start);time+=1/60;}
 const sorted=samples.slice().sort((a,b)=>a-b),q=n=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*n))];
 results.push({name,frames,buildCalls:builds-before,p50:q(.5),p95:q(.95),p99:q(.99),max:sorted.at(-1),total:sorted.reduce((a,b)=>a+b,0),stats:a.stats(),samples});
}
const report={environment:'Node VM CPU-only, bundled r128, real London footprints and measured heights. Canvas materials and authored airport/landmark creation excluded. Not GPU or A51 FPS.',source,gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,loadMs,createMs,builds,vertices,results};
fs.mkdirSync(new URL('../benchmarks/london-v0.5/',import.meta.url),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,results:results.map(({samples,...result})=>result)},null,2));

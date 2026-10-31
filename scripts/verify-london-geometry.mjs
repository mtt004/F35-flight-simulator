// Exhaustive Category A check against the pre-optimisation runtime's 8-feature
// batches and final merge. CPU measurements here cannot establish device FPS.
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifestBytes=fs.readFileSync('scenery-packs/london-geometry/manifest.json'),manifest=JSON.parse(manifestBytes);
for(const[file,hash]of Object.entries(manifest.sourceHashes))if(sha(fs.readFileSync(file))!==hash)throw Error('Source hash differs: '+file);
const c=vm.createContext({console,performance});c.window=c;
for(const file of ['src/vendor/three-r128.min.js','src/terrain/architecture.js','src/terrain/landmarks.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const source=execFileSync('git',['show',(process.env.LIGHTNING_BASELINE_REF||'ca330131115ee983a6457efa33ff513ac34803ad')+':src/terrain/london.js'],{encoding:'utf8'});vm.runInContext(source,c);
// This published v0.4 source blob was independently fetched from release source
// ca330131115ee983a6457efa33ff513ac34803ad. A local snapshot branch is allowed
// for reproduction only when its complete source bytes have that same Git ID.
const sourceBytes=Buffer.from(source),baselineBlob=createHash('sha1').update(Buffer.from('blob '+sourceBytes.length+'\0')).update(sourceBytes).digest('hex');
if(baselineBlob!=='df4173a1d315b9d7f4f7d976831a2e2abf46b89d')throw Error('Baseline does not match the verified published v0.4 London renderer');
c.__LONDON_HEIGHTS__=JSON.parse(gunzipSync(fs.readFileSync('scenery-packs/london-heights/heights.json.gz')));
const data=JSON.parse(gunzipSync(fs.readFileSync('scenery-packs/london/data.json.gz')));c.LightningLondon.load(data);
const cells=new Map();for(const b of data.buildings){const q=b.bounds,x=(q.x0+q.x1)/2,z=(q.z0+q.z1)/2;if(c.LightningLandmarks.excludes(x,z))continue;const k=Math.floor(x/1200)+','+Math.floor(z/1200);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(b);}
const samples=[],errors=[];let checked=0,bytes=0,attributes=0,vertices=0;
for(const[key,list]of cells)for(const lod of [0,2]){
 const tile=manifest.tiles[key+':'+lod],compressed=fs.readFileSync('scenery-packs/london-geometry/'+tile.file),pin=manifest.outputs[tile.file];
 if(compressed.length!==pin.bytes||sha(compressed)!==pin.sha256)throw Error('Compressed tile hash differs: '+tile.file);
 const t=performance.now(),parts=[];for(let i=0;i<list.length;i+=8)parts.push(c.LightningLondon.buildBuildings(c.THREE,list.slice(i,i+8),lod,c.LightningLondon.height));
 const expected=new c.THREE.BufferGeometry(),box=new c.THREE.Box3();
 for(const name of Object.keys(parts[0].attributes)){const array=new Float32Array(parts.reduce((n,p)=>n+p.attributes[name].array.length,0));let at=0;for(const part of parts){array.set(part.attributes[name].array,at);at+=part.attributes[name].array.length;}expected.setAttribute(name,new c.THREE.BufferAttribute(array,parts[0].attributes[name].itemSize));}
 for(const part of parts){box.union(part.boundingBox);part.dispose();}const sphere=box.getBoundingSphere(new c.THREE.Sphere()),generationMs=performance.now()-t;
 const decodeStart=performance.now(),raw=gunzipSync(compressed);const decodeMs=performance.now()-decodeStart;
 if(raw.length!==tile.bytes)errors.push(key+':'+lod+' byte length');
 for(const a of tile.attributes){attributes++;const attr=expected.attributes[a.name],actual=raw.subarray(a.offset,a.offset+a.length*4);if(attr.itemSize!==a.itemSize||!Buffer.from(attr.array.buffer).equals(actual))errors.push(key+':'+lod+' attribute '+a.name);}
 for(const[name,want,actual]of [['box.min',box.min.toArray(),tile.box.min],['box.max',box.max.toArray(),tile.box.max],['sphere.center',sphere.center.toArray(),tile.sphere.center]])if(JSON.stringify(want)!==JSON.stringify(actual))errors.push(key+':'+lod+' '+name);
 if(sphere.radius!==tile.sphere.radius)errors.push(key+':'+lod+' sphere.radius');
 bytes+=tile.bytes;vertices+=tile.vertices;checked++;samples.push({key,lod,vertices:tile.vertices,bytes:tile.bytes,generationMs,decodeMs});expected.dispose();
}
const summarize=name=>{const a=samples.map(s=>s[name]).sort((a,b)=>a-b);return{total:a.reduce((s,x)=>s+x,0),p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)};};
const report={status:errors.length?'FAIL':'PASS',method:'Every prepared Float32 attribute and merged-box culling bound checked against pre-optimisation r128 runtime, in eight-building parts. Node CPU diagnostic only; not GPU or Galaxy A51 FPS. Generation versus native gzip timings are descriptive, not controlled paired browser evidence.',baselineRef:process.env.LIGHTNING_BASELINE_REF||'ca330131115ee983a6457efa33ff513ac34803ad',baselineSourceCommit:'ca330131115ee983a6457efa33ff513ac34803ad',baselineSourceBlob:baselineBlob,baselineSourceSha256:sha(sourceBytes),manifestSha256:sha(manifestBytes),inputHashes:manifest.inputPins,sourceHashes:manifest.sourceHashes,cells:cells.size,checked,attributes,bytes,vertices,errors,generationMs:summarize('generationMs'),nativeGzipMs:summarize('decodeMs'),samples};
fs.mkdirSync('benchmarks/london-v0.5',{recursive:true});fs.writeFileSync('benchmarks/london-v0.5/prepared-equivalence.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,samples:undefined},null,2));if(errors.length)process.exitCode=1;

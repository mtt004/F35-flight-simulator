// Reuse the exact bundled r128 generator offline. No re-triangulation library,
// quantization, geometry simplification or texture/material changes are involved.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceFiles=['src/vendor/three-r128.min.js','src/terrain/architecture.js','src/terrain/landmarks.js','src/terrain/london.js','src/terrain/prepared-geometry.js','scripts/build-london-geometry.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export function serializeGeometry(T,geometry){
 const chunks=[],attributes=[];let offset=0;
 for(const[name,a]of Object.entries(geometry.attributes)){
  if(!(a.array instanceof Float32Array)&&a.array.constructor.name!=='Float32Array')throw Error('Prepared attributes must be Float32');
  const bytes=Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
  chunks.push(bytes);attributes.push({name,itemSize:a.itemSize,offset,length:a.array.length});offset+=bytes.length;
 }
 // Runtime finishGeometry unions each part's Float32-position bounding box,
 // then derives a conservative sphere from that box. Reproduce that culling
 // volume, rather than buildBuildings' tighter actual-vertex sphere.
 const box=geometry.boundingBox,sphere=box.getBoundingSphere(new T.Sphere());
 return{raw:Buffer.concat(chunks),metadata:{bytes:offset,vertices:geometry.attributes.position.count,attributes,box:{min:Array.from(box.min.toArray()),max:Array.from(box.max.toArray())},sphere:{center:Array.from(sphere.center.toArray()),radius:sphere.radius}}};
}

export function buildPreparedGeometry(base=root,output=path.join(base,'scenery-packs/london-geometry')){
 const read=name=>fs.readFileSync(path.join(base,name));
 const input=(folder,name)=>{const manifest=JSON.parse(read('scenery-packs/'+folder+'/manifest.json')),bytes=read('scenery-packs/'+folder+'/'+name),pin=manifest.outputs?.[name];if(!pin||pin.bytes!==bytes.length||pin.sha256!==sha(bytes))throw Error(folder+'/'+name+': source integrity mismatch');return{manifest,bytes,sha256:pin.sha256};};
 const vectors=input('london','data.json.gz'),heights=input('london-heights','heights.json.gz');
 if(heights.manifest.inputSha256!==vectors.sha256)throw Error('Prepared geometry height data use different footprints');
 const sourceHashes=Object.fromEntries(sourceFiles.map(name=>[name,sha(read(name))]));
 const c=vm.createContext({console,performance});c.window=c;
 for(const name of sourceFiles.slice(0,4))vm.runInContext(read(name).toString('utf8'),c,{filename:name});
 const data=JSON.parse(gunzipSync(vectors.bytes));c.__LONDON_HEIGHTS__=JSON.parse(gunzipSync(heights.bytes));c.LightningLondon.load(data);
 const cells=[];c.LightningLondon.forEachBuildingTile((key,buildings)=>cells.push({key,buildings}));cells.sort((a,b)=>a.key.localeCompare(b.key,'en'));
 fs.mkdirSync(output,{recursive:true});
 const manifest={schemaVersion:1,generator:'three-r128-exact-v1',endianness:'LE',inputPins:{vectorData:vectors.sha256,heightData:heights.sha256},sourceHashes,tiles:{},outputs:{}};
 const store=(name,bytes)=>{fs.writeFileSync(path.join(output,name),bytes);manifest.outputs[name]={bytes:bytes.length,sha256:sha(bytes)};};
 for(const{key,buildings}of cells)for(const lod of[0,2]){
  const geometry=c.LightningLondon.buildBuildings(c.THREE,buildings,lod,c.LightningLondon.height),{raw,metadata}=serializeGeometry(c.THREE,geometry),file='cell-'+key.replace(',','_')+'-'+lod+'.bin.gz';
  // Node gzip writes a zero mtime; identical inputs generate identical archives.
  store(file,gzipSync(raw,{level:6}));manifest.tiles[key+':'+lod]={file,...metadata};geometry.dispose();
 }
 store('NOTICE.txt',Buffer.from('Exact prepared building geometry derived from the licensed London vector and LiDAR packs.\nContains OS data © Crown copyright and database right 2026.\nContains Environment Agency LiDAR data licensed under OGL v3.0.\nSee the accompanying scenery pack notices and LICENSE-OGL-3.0.txt.\n'));
 store('LICENSE-OGL-3.0.txt',read('scenery-packs/london/LICENSE-OGL-3.0.txt'));
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const started=performance.now(),manifest=buildPreparedGeometry();
 console.log(JSON.stringify({tiles:Object.keys(manifest.tiles).length,compressedBytes:Object.values(manifest.outputs).reduce((n,p)=>n+p.bytes,0),decodedBytes:Object.values(manifest.tiles).reduce((n,t)=>n+t.bytes,0),elapsedMs:performance.now()-started}));
}

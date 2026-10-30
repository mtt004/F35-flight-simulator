import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';

function fixture(){
 const c=vm.createContext({console,DecompressionStream,Blob,Response,atob,performance});c.window=c;
 for(const file of ['src/vendor/three-r128.min.js','src/terrain/london.js','src/terrain/prepared-geometry.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const buildings=[{id:'pitched',arch:0,h:12,p:[[0,0],[18,0],[18,25],[0,25],[0,0]]},{id:'courtyard',arch:4,h:25,p:[[40,0],[65,0],[65,30],[40,30]],holes:[[[45,5],[50,5],[50,10],[45,10]]]}];
 const data=c.__LONDON_DATA__={terrain:{x:-10000,z:-10000,step:100000,nx:2,nz:2,values:[20,20,20,20]},surfaces:[],roads:[],buildings};c.LightningLondon.load(data);
 const expected=c.LightningLondon.buildBuildings(c.THREE,buildings,0,c.LightningLondon.height),chunks=[],attributes=[];let offset=0;
 expected.boundingSphere=expected.boundingBox.getBoundingSphere(new c.THREE.Sphere());
 for(const[name,a]of Object.entries(expected.attributes)){const bytes=Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);chunks.push(bytes);attributes.push({name,itemSize:a.itemSize,offset,length:a.array.length});offset+=bytes.length;}
 const raw=Buffer.concat(chunks),file='cell-0-0-0.bin.gz';
 const tile={file,bytes:raw.length,vertices:expected.attributes.position.count,attributes,box:{min:expected.boundingBox.min.toArray(),max:expected.boundingBox.max.toArray()},sphere:{center:expected.boundingSphere.center.toArray(),radius:expected.boundingSphere.radius}};
 const pack={manifest:{schemaVersion:1,generator:'three-r128-exact-v1',tiles:{'0,0:0':tile}},assets:{[file]:gzipSync(raw).toString('base64')}};
 return{c,data,expected,pack,tile,raw,api:c.LightningPreparedGeometry};
}
test('prepared geometry restores exact float attributes and bounds without recomputation',async()=>{
 const f=fixture();assert.equal(f.api.configure(f.c.THREE,f.pack),true);assert.equal(f.api.has('0,0',1),true);
 const g=await f.api.request('0,0',1).promise;
 for(const[name,a]of Object.entries(f.expected.attributes)){const b=g.attributes[name];assert.equal(b.itemSize,a.itemSize);assert.ok(Buffer.from(a.array.buffer).equals(Buffer.from(b.array.buffer,b.array.byteOffset,b.array.byteLength)),name);}
 assert.deepEqual(Array.from(g.boundingBox.min.toArray()),Array.from(f.expected.boundingBox.min.toArray()));
 assert.deepEqual(Array.from(g.boundingSphere.center.toArray()),Array.from(f.expected.boundingSphere.center.toArray()));
 assert.equal(g.boundingSphere.radius,f.expected.boundingSphere.radius);g.dispose();
 assert.equal(f.api.stats().active,0);assert.equal(f.api.stats().queued,0);
});
test('prepared requests serialize decompression and cancellation clears queued work',async()=>{
 const f=fixture();f.api.configure(f.c.THREE,f.pack);
 const first=f.api.request('0,0',0),second=f.api.request('0,0',0),cancelled=second.promise.catch(e=>e.message);
 assert.equal(f.api.stats().active,1);assert.equal(f.api.stats().queued,1);second.cancel();
 const g=await first.promise;g.dispose();assert.match(await cancelled,/cancel/i);
 assert.equal(f.api.stats().active,0);assert.equal(f.api.stats().queued,0);assert.equal(f.api.stats().decoded,1);
});
test('reset abandons an in-progress prepared decode without retaining its output',async()=>{
 const f=fixture();f.api.configure(f.c.THREE,f.pack);const request=f.api.request('0,0',0),cancelled=request.promise.catch(e=>e.message);
 f.api.reset();assert.match(await cancelled,/cancel/i);assert.equal(f.api.stats().active,0);assert.equal(f.api.stats().queued,0);assert.equal(f.api.stats().decoded,0);
});
test('corrupt prepared bytes reject so the caller can use the runtime geometry path',async()=>{
 const f=fixture();f.pack.assets[f.tile.file]=gzipSync(f.raw.subarray(0,4)).toString('base64');f.api.configure(f.c.THREE,f.pack);
 await assert.rejects(f.api.request('0,0',0).promise,/length|bytes/i);assert.equal(f.api.stats().failures,1);
});
test('unsupported decompression and unknown schemas leave runtime fallback available',()=>{
 const f=fixture();f.c.DecompressionStream=undefined;assert.equal(f.api.configure(f.c.THREE,f.pack),false);assert.equal(f.api.has('0,0',0),false);
 f.c.DecompressionStream=DecompressionStream;f.pack.manifest.schemaVersion=2;assert.equal(f.api.configure(f.c.THREE,f.pack),false);
});
test('London streaming installs prepared attributes without runtime triangulation',async()=>{
 const f=fixture(),a=f.c.LightningLondon;f.c.__LONDON_GEOMETRY__=f.pack;const group=a.create(f.c.THREE,new f.c.THREE.Group());
 const build=a.buildBuildings;let calls=0;a.buildBuildings=(...args)=>{calls++;return build(...args);};
 for(let i=0;i<100;i++){a.update(600,600,100,2,0,i/60);await new Promise(resolve=>setTimeout(resolve,1));if(a.stats().buildingTiles===1)break;}
 assert.equal(a.stats().buildingTiles,1);assert.equal(calls,0,'prepared geometry replaces main-thread triangulation');
 const g=group.children.at(-1).geometry;
 for(const[name,attr]of Object.entries(f.expected.attributes))assert.ok(Buffer.from(attr.array.buffer).equals(Buffer.from(g.attributes[name].array.buffer,g.attributes[name].array.byteOffset,g.attributes[name].array.byteLength)),name);
 a.dispose();assert.equal(a.stats().buildingTiles,0);
});
test('London streaming falls back to existing geometry after a failed prepared decode',async()=>{
 const f=fixture(),a=f.c.LightningLondon;f.pack.assets[f.tile.file]='AAAA';f.c.__LONDON_GEOMETRY__=f.pack;a.create(f.c.THREE,new f.c.THREE.Group());
 const build=a.buildBuildings;let calls=0;a.buildBuildings=(...args)=>{calls++;return build(...args);};
 for(let i=0;i<100;i++){a.update(600,600,100,2,0,i/60);await new Promise(resolve=>setTimeout(resolve,1));if(a.stats().buildingTiles===1)break;}
 assert.equal(a.stats().buildingTiles,1);assert.ok(calls>0);assert.equal(f.api.stats().failures,1);
});
test('offline serializer uses the exact merged-tile culling sphere and deterministic bytes',async()=>{
 const f=fixture(),{serializeGeometry}=await import('../../scripts/build-london-geometry.mjs');
 const first=serializeGeometry(f.c.THREE,f.expected),second=serializeGeometry(f.c.THREE,f.expected);
 assert.ok(first.raw.equals(f.raw));assert.ok(first.raw.equals(second.raw));
 assert.deepEqual(first.metadata,second.metadata);
 assert.deepEqual(first.metadata.sphere,{center:Array.from(f.expected.boundingSphere.center.toArray()),radius:f.expected.boundingSphere.radius});
});

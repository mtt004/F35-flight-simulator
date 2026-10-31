import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup(count=80,tiles=1){
 let clock=0;
 const c=vm.createContext({console,performance:{now:()=>clock}});c.window=c;
 vm.runInContext(fs.readFileSync('src/vendor/three-r128.min.js','utf8'),c);
 vm.runInContext(fs.readFileSync('src/terrain/london.js','utf8'),c);
 const a=c.LightningLondon,T=c.THREE;
 const data={terrain:{x:-10000,z:-10000,step:100000,nx:2,nz:2,values:[20,20,20,20]},surfaces:[],roads:[],buildings:Array.from({length:count*tiles},(_,i)=>{const x=Math.floor(i/count)*1200+20+(i%count)*2;return{id:i,p:[[x,20],[x+1,20],[x+1,21],[x,21]],h:20};})};
 a.load(data);const group=a.create(T,new T.Group());
 const build=a.buildBuildings;let calls=0,disposed=0;
 a.buildBuildings=(...args)=>{calls++;clock+=2;const g=build(...args);g.addEventListener('dispose',()=>disposed++);return g;};
 return{a,data,T,c,group,get calls(){return calls;},get disposed(){return disposed;}};
}
test('building work advances in bounded batches between planning updates and ignores duplicate frame calls',()=>{
 const s=setup();s.a.update(600,600,100,2,0,0);
 assert.ok(s.calls>0&&s.calls<=3,'one update respects a soft 6ms generation budget');
 assert.ok(s.a.stats().pendingBuildings>0);assert.equal(s.a.stats().buildingTiles,0);
 const n=s.calls;s.a.update(600,600,100,2,0,0);assert.equal(s.calls,n);
 s.a.update(600,600,100,2,0,1/60);assert.ok(s.calls>n,'partial tile continues before 0.2 second planning interval');
 for(let i=2;i<20;i++)s.a.update(600,600,100,2,0,i/60);
 assert.equal(s.a.stats().buildingTiles,1);assert.equal(s.a.stats().pendingBuildings,0);
 assert.equal(s.disposed,s.calls,'all merged intermediate geometries are disposed');
});
test('reload cancels pending geometry and clears old tile caches',()=>{
 const s=setup();s.a.update(600,600,100,2,0,0);assert.ok(s.calls>0);
 s.a.load({...s.data,buildings:[]});assert.equal(s.disposed,s.calls);
 assert.equal(s.a.stats().pendingBuildings,0);assert.equal(s.a.stats().buildingTiles,0);
 s.a.create(s.T,new s.T.Group());s.a.update(600,600,100,2,0,1);assert.equal(s.a.stats().buildingTiles,0);
});
test('streaming tile cache is bounded and evicts geometry after camera movement',()=>{
 const s=setup(1,120);
 for(let i=0;i<500;i++)s.a.update(65000,600,100,2,0,i/60);
 assert.ok(s.a.stats().buildingTiles>0);assert.ok(s.a.stats().buildingTiles<=100);
 for(let i=500;i<520;i++)s.a.update(-100000,600,100,2,0,i/60);
 assert.equal(s.a.stats().buildingTiles,0);assert.equal(s.a.stats().pendingBuildings,0);
});
test('authored landmark exclusions keep generic footprints out of rendering and collision',()=>{
 const s=setup(1);s.c.LightningLandmarks={excludes:()=>true};s.a.load(s.data);
 assert.equal(s.a.stats().buildings,0);assert.equal(s.a.stats().rawBuildings,1);
 assert.equal(s.a.collides(20.5,30,20.5),false);
});

test('LOD replacement retains the visible old mesh until all attributes are ready',()=>{
 const s=setup();for(let i=0;i<10;i++)s.a.update(600,600,100,2,0,i/60);
 const old=s.group.children.at(-1);let removed=0;old.geometry.addEventListener('dispose',()=>removed++);
 s.a.update(8000,600,100,2,0,1);assert.ok(s.a.stats().pendingBuildings>0);
 assert.ok(s.group.children.includes(old));assert.equal(removed,0);
 for(let i=1;i<10;i++)s.a.update(8000,600,100,2,0,1+i/60);
 assert.ok(!s.group.children.includes(old));assert.equal(removed,1);
 const merged=s.group.children.at(-1).geometry;
 for(const name of ['position','normal','color','uv'])assert.ok([...merged.getAttribute(name).array].every(Number.isFinite));
});
test('detailed LOD transitions reuse the exact visible geometry without reconstruction',()=>{
 const s=setup();for(let i=0;i<10;i++)s.a.update(600,600,100,2,0,i/60);
 const old=s.group.children.at(-1),calls=s.calls,disposed=s.disposed;
 for(let i=0;i<20;i++)s.a.update(i%2?600:3600,600,100,2,0,1+i*.25);
 assert.equal(s.calls,calls,'both detailed LODs produce the same attributes');
 assert.equal(s.disposed,disposed);assert.equal(s.group.children.at(-1),old);
 assert.equal(s.a.stats().pendingBuildings,0);
});
test('detailed LOD crossing preserves an in-progress detailed tile job',()=>{
 const s=setup();s.a.update(600,600,100,2,0,0);const pending=s.a.stats().pendingBuildings;
 s.a.update(3600,600,100,2,0,1);
 assert.ok(s.a.stats().pendingBuildings<pending,'existing partial attributes advance instead of being discarded');
 assert.equal(s.disposed,0,'an equivalent LOD must not abandon partial geometries');
});
test('shared landmark material updates once per call without a scene traversal',()=>{
 const s=setup(1),material=new s.T.MeshBasicMaterial();
 let calls=0,traversals=0;
 s.c.LightningArchitecture={classify:()=>4,material:()=>new s.T.MeshBasicMaterial(),update:m=>{if(m===material)calls++;}};
 s.c.LightningLandmarks={build:()=>{const g=new s.T.Group();g.name='LondonLandmarks';for(let i=0;i<20;i++)g.add(new s.T.Mesh(new s.T.BoxGeometry(),material));return g;}};
 const group=s.a.create(s.T,new s.T.Group()),landmarks=group.getObjectByName('LondonLandmarks'),traverse=landmarks.traverse;
 landmarks.traverse=function(...args){traversals++;return traverse.apply(this,args);};
 s.a.update(600,600,100,2,.4,0);
 assert.equal(calls,1,'one shared material needs one uniform update');
 assert.equal(traversals,0,'immutable landmark membership is known at creation');
});
test('camera movement disposes abandoned partial tile geometries',()=>{
 const s=setup();s.a.update(600,600,100,2,0,0);assert.equal(s.disposed,0);
 s.a.update(-100000,600,100,2,0,1);assert.equal(s.disposed,s.calls);
 assert.equal(s.a.stats().pendingBuildings,0);assert.equal(s.a.stats().buildingTiles,0);
});
test('offline preparation visits precisely the renderable building cells in stable order',()=>{
 const s=setup(2,3),first=[],second=[];
 s.a.forEachBuildingTile((key,list)=>first.push([key,list.map(b=>b.id)]));
 s.a.forEachBuildingTile((key,list)=>second.push([key,list.map(b=>b.id)]));
 assert.deepEqual(first,second);assert.equal(first.length,3);assert.equal(first.flatMap(v=>v[1]).length,6);
 s.c.LightningLandmarks={excludes:(x)=>x<1200};s.a.load(s.data);
 const remaining=[];s.a.forEachBuildingTile((key,list)=>remaining.push(...list));assert.equal(remaining.length,4);
});

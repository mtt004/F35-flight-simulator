import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c=vm.createContext({console});c.window=c;
for(const p of ['src/vendor/three-r128.min.js','src/terrain/architecture.js','src/terrain/london.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
const A=c.LightningArchitecture,T=c.THREE,L=c.LightningLondon;
test('architectural classes are deterministic and varied with footprint and height',()=>{
 const b=(h,w,d)=>({id:'123',h,p:[[0,0],[w,0],[w,d],[0,d]]});
 assert.equal(A.classify(b(9,8,30)),0);assert.equal(A.classify(b(155,40,40)),3);assert.equal(A.classify(b(12,120,80)),5);
 assert.equal(A.classify(b(30,80,40)),A.classify(b(30,80,40)));
});
test('textured buildings expose finite physical UV and class attributes in every LOD',()=>{
 for(const lod of [0,1,2]){
  const b={id:'terrace',h:10,arch:0,p:[[0,0],[12,0],[12,24],[0,24]]},g=L.buildBuildings(T,[b],lod,()=>4);
  for(const k of ['position','normal','uv','architecture'])assert.ok([...g.attributes[k].array].every(Number.isFinite),k);
  assert.equal(g.boundingBox.max.y,14);assert.ok(Math.max(...g.attributes.uv.array)>1);
  if(lod<2)assert.ok([...g.attributes.position.array].some((y,i)=>i%3===1&&y>4&&y<14),'pitched roof has depth');g.dispose();
 }
});
test('roof silhouette never extends collision height and courtyard stays open',()=>{
 const b={id:'court',arch:4,h:18,p:[[0,0],[30,0],[30,30],[0,30]],holes:[[[10,10],[20,10],[20,20],[10,20]]]},g=L.buildBuildings(T,[b],0,()=>5),p=g.attributes.position;
 assert.equal(g.boundingBox.max.y,23);
 for(let i=0;i<p.count;i+=3)if([0,1,2].every(k=>p.getY(i+k)===23)){
  const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
  assert.ok(!(x>10&&x<20&&z>10&&z<20));
 }
 g.dispose();
});

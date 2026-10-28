import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const c=vm.createContext({console});c.window=c;
vm.runInContext(fs.readFileSync('src/vendor/three-r128.min.js','utf8'),c);
vm.runInContext(fs.readFileSync('src/terrain/london.js','utf8'),c);
const T=c.THREE,a=c.LightningLondon;
const ring=(x,z,w,d)=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
const close=r=>[...r,r[0]];
for(const closed of [false,true])for(const holes of [0,1,2]){
 test(`roof area preserves ${holes} courtyards with ${closed?'closed':'open'} input rings`,()=>{
  const outer=ring(0,0,20,20),inner=[ring(2,2,4,4),ring(12,12,4,4)].slice(0,holes);
  const f={id:'roof',h:10,p:closed?close(outer):outer,holes:inner.map(r=>closed?close(r):r)};
  const original=JSON.stringify(f),g=a.buildBuildings(T,[f],1,()=>0),p=g.attributes.position;
  let area=0;
  for(let i=0;i<p.count;i+=3){
   if([0,1,2].every(k=>p.getY(i+k)===10)){
    const x=[0,1,2].map(k=>p.getX(i+k)),z=[0,1,2].map(k=>p.getZ(i+k));
    area+=Math.abs((x[1]-x[0])*(z[2]-z[0])-(x[2]-x[0])*(z[1]-z[0]))/2;
    const cx=(x[0]+x[1]+x[2])/3,cz=(z[0]+z[1]+z[2])/3;
    for(const h of inner)assert.ok(!(cx>h[0][0]&&cx<h[2][0]&&cz>h[0][1]&&cz<h[2][1]),'roof triangle fills courtyard');
   }
  }
  assert.equal(area,400-16*holes);
  // baseHeight memoization is allowed; ring coordinates must remain untouched.
  delete f.baseY;assert.equal(JSON.stringify(f),original);g.dispose();
 });
}

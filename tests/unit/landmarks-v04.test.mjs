import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../src/terrain/landmarks.js',import.meta.url),'utf8');
const scene={console};scene.window=scene;vm.createContext(scene);
vm.runInContext(fs.readFileSync(new URL('../../src/vendor/three-r128.min.js',import.meta.url),'utf8'),scene);
vm.runInContext(source,scene);
const landmarks=scene.LightningLandmarks,T=scene.THREE;
const group=landmarks.build(T,()=>0);
const mesh=id=>group.children.find(m=>m.userData.landmark===id);
const world=(id,x,y,z,rotation=0)=>{
  const p=landmarks.locations[id];
  return [p[0]+Math.cos(rotation)*x+Math.sin(rotation)*z,y+4,p[1]-Math.sin(rotation)*x+Math.cos(rotation)*z];
};
const hit=(id,x,y,z,rotation=0)=>landmarks.collides(...world(id,x,y,z,rotation),()=>0);

test('Battersea uses the published National Grid anchor and clears its complete authored footprint',()=>{
  assert.deepEqual(Array.from(landmarks.locations.battersea),[528884-507000,176000-177513]);
  assert.equal(group.children.length,9);
  const p=landmarks.locations.battersea;
  for(const [dx,dz] of [[0,0],[-89,-90],[89,90]]) assert.ok(landmarks.excludes(p[0]+dx,p[1]+dz));
  assert.equal(landmarks.excludes(p[0]+120,p[1]+120),false);
});

test('Battersea halls, wash towers and each tapered stack are collision solids at the visible pose',()=>{
  for(const x of [-59,59]) assert.equal(hit('battersea',x,20,0,.13),true);
  for(const x of [-43,43]) for(const z of [-68,68]) {
    assert.equal(hit('battersea',x,50,z,.13),true);
    assert.equal(hit('battersea',x,95,z,.13),true);
    assert.equal(hit('battersea',x+5,95,z,.13),false);
    assert.equal(hit('battersea',x,104,z,.13),false);
  }
  assert.equal(hit('battersea',0,60,0,.13),false,'air above boiler roofs remains clear');
  assert.equal(hit('battersea',90,20,0,.13),false);
});

test('Westminster courts stay open while the central spire and river facade are solid',()=>{
  assert.equal(hit('westminster',0,12,-83),false);
  assert.equal(hit('westminster',0,12,46),false);
  assert.equal(hit('westminster',26,12,46),true);
  assert.equal(hit('westminster',0,75,0),true);
  assert.equal(hit('westminster',0,92,0),false);
});

test('Tower Bridge retains the shipping opening and both road arches below 42m walkways',()=>{
  assert.equal(hit('towerbridge',0,25,0,-.09),false);
  assert.equal(hit('towerbridge',0,20,41,-.09),false);
  assert.equal(hit('towerbridge',9,25,41,-.09),true);
  assert.equal(hit('towerbridge',7.8,43,0,-.09),true);
  assert.equal(hit('towerbridge',0,70,41,-.09),false);
});

test('St Pauls physical height and east-west footprint preserve cross-shaped air gaps',()=>{
  const b=mesh('stpauls').geometry.boundingBox;
  assert.ok(Math.abs(b.max.y-115)<.01);
  assert.ok(b.max.x-b.min.x>(b.max.z-b.min.z)*1.4);
  assert.equal(hit('stpauls',0,60,0,1.35),true);
  assert.equal(hit('stpauls',30,12,0,1.35),true);
  assert.equal(hit('stpauls',30,12,45,1.35),false);
});

test('authored skin coordinates and material classes cover all nine bounded merged meshes under 30k triangles',()=>{
  let triangles=0;const classes=new Set();
  for(const m of group.children) {
    assert.equal(m.material.type,'MeshStandardMaterial');
    const g=m.geometry;
    triangles+=g.attributes.position.count/3;
    for(const name of ['position','normal','color','uv','architecture']) {
      const a=g.attributes[name];
      assert.equal(a.count,g.attributes.position.count);
      assert.ok(Array.from(a.array).every(Number.isFinite));
    }
    for(const v of g.attributes.architecture.array)classes.add(v);
    assert.ok(g.boundingSphere.radius<250,m.name);
  }
  assert.ok(classes.has(3)&&classes.has(4)&&classes.has(5)&&classes.has(12));
  assert.ok(triangles<30000,`${triangles} triangles`);
  const spiral=mesh('gherkin').geometry.attributes.color.array;
  assert.ok(new Set(Array.from(spiral).map(n=>n.toFixed(3))).size>8,'spiralling atrium glass bands vary the authored skin');
});

test('shared architecture material factory is used when installed',()=>{
  const expected=new T.MeshStandardMaterial({vertexColors:true});let calls=0;
  scene.LightningArchitecture={landmarkMaterial(t){assert.equal(t,T);calls++;return expected;}};
  const next=landmarks.build(T,()=>0);
  assert.equal(calls,1);
  assert.ok(next.children.every(m=>m.material===expected));
});

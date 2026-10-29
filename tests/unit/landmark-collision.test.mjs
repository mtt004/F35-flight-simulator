import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../src/terrain/landmarks.js', import.meta.url), 'utf8'), context);
const landmarks = context.window.LightningLandmarks;
const hit = (id,x,y,z,height=()=>0) => {
  const p=landmarks.locations[id];
  return landmarks.collides(p[0]+x,y+4,p[1]+z,height);
};

test('all eight geographic anchors and public entry points are available', () => {
  assert.equal(Object.keys(landmarks.locations).length,8);
  assert.equal(typeof landmarks.build,'function');
  assert.equal(typeof landmarks.collides,'function');
  assert.equal(landmarks.locations.shard[0],25903.2);
  assert.equal(landmarks.locations.towerbridge[1],-4263.1);
});

test('tall buildings contain their interiors despite overlapping decorative components', () => {
  assert.equal(hit('shard',0,100,0),true);
  assert.equal(hit('gherkin',0,100,0),true);
  assert.equal(hit('canary',0,100,0),true);
  assert.equal(hit('westminster',0,12,0),true);
  assert.equal(hit('stpauls',0,60,0),true);
});

test('tapered towers reject points outside their upper cross sections', () => {
  assert.equal(hit('shard',28,20,0),true);
  assert.equal(hit('shard',28,240,0),false);
  assert.equal(hit('shard',0,100,30),false);
  assert.equal(hit('gherkin',25,65,0),true);
  assert.equal(hit('gherkin',25,150,0),false);
  assert.equal(hit('gherkin',0,181,0),false);
  assert.equal(hit('shard',0,311,0),false);
  assert.equal(hit('canary',0,237,0),false);
});

test('Eye wheel remains hollow between its narrow spokes and supports', () => {
  assert.equal(hit('eye',0,132,0),true);
  assert.equal(hit('eye',0,72,0),true);
  assert.equal(hit('eye',14,96,0),false);
  assert.equal(hit('eye',40,72,12),false);
  assert.equal(hit('eye',0,136,0),false);
});

test('Tower Bridge has open air under its high walkways', () => {
  assert.equal(hit('towerbridge',0,10,0),true);
  assert.equal(hit('towerbridge',8,44,0),true);
  assert.equal(hit('towerbridge',0,25,0),false);
  assert.equal(hit('towerbridge',8,30,0),false);
  assert.equal(hit('towerbridge',9,30,58),true);
});

test('Buckingham courtyard is open and its rotated wings are solid', () => {
  const rotate = (x,z) => [Math.cos(-.35)*x+Math.sin(-.35)*z,-Math.sin(-.35)*x+Math.cos(-.35)*z];
  let p=rotate(0,10);
  assert.equal(hit('buckingham',p[0],12,p[1]),false);
  p=rotate(45,10);
  assert.equal(hit('buckingham',p[0],12,p[1]),true);
  p=rotate(0,-36);
  assert.equal(hit('buckingham',p[0],12,p[1]),true);
});

test('terrain offset is finite, clamped to four metres and applied consistently', () => {
  const [x,z]=landmarks.locations.shard;
  assert.equal(landmarks.collides(x,3.9,z,()=>-100),false);
  assert.equal(landmarks.collides(x,104,z,()=>0),true);
  assert.equal(landmarks.collides(x,104,z,()=>80),true);
  assert.equal(landmarks.collides(x,50,z,()=>80),false);
  assert.equal(landmarks.collides(x,104,z,()=>NaN),true);
  assert.equal(landmarks.collides(x,350,z,()=>80),true);
});

test('far away, above landmark ceilings and nonfinite queries are clear', () => {
  assert.equal(landmarks.collides(0,100,0),false);
  for(const [x,z] of Object.values(landmarks.locations)) assert.equal(landmarks.collides(x,1000,z),false);
  assert.equal(landmarks.collides(NaN,10,0),false);
  assert.equal(landmarks.collides(0,Infinity,0),false);
});

test('Three r128 builds eight merged, finite, outward-facing meshes below the triangle budget', () => {
  const sceneContext={console};
  sceneContext.window=sceneContext;
  vm.createContext(sceneContext);
  vm.runInContext(fs.readFileSync(new URL('../../src/vendor/three-r128.min.js',import.meta.url),'utf8'),sceneContext);
  vm.runInContext(fs.readFileSync(new URL('../../src/terrain/landmarks.js',import.meta.url),'utf8'),sceneContext);
  const T=sceneContext.THREE;
  const group=sceneContext.LightningLandmarks.build(T,()=>0);
  assert.equal(group.children.length,8);
  let triangles=0;
  for(const mesh of group.children) {
    assert.equal(mesh.type,'Mesh');
    assert.equal(mesh.material.type,'MeshLambertMaterial');
    assert.equal(mesh.material.vertexColors,true);
    assert.equal(mesh.position.lengthSq(),0,'merged vertices already have global coordinates');
    const geometry=mesh.geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
    assert.equal(p.count,n.count);
    assert.equal(p.count,geometry.attributes.color.count);
    triangles+=p.count/3;
    for(const name of ['position','normal','color']) {
      for(const value of geometry.attributes[name].array) assert.ok(Number.isFinite(value));
    }
    assert.ok(Number.isFinite(geometry.boundingSphere.radius));
    assert.ok(geometry.boundingSphere.radius>0);
    const anchor=landmarks.locations[mesh.userData.landmark];
    assert.ok(Math.abs(geometry.boundingSphere.center.x-anchor[0])<200);
    assert.ok(Math.abs(geometry.boundingSphere.center.z-anchor[1])<200);
    for(let i=0;i<p.count;i+=3) {
      const a=new T.Vector3().fromBufferAttribute(p,i);
      const b=new T.Vector3().fromBufferAttribute(p,i+1);
      const c=new T.Vector3().fromBufferAttribute(p,i+2);
      const face=b.sub(a).cross(c.sub(a));
      const normal=new T.Vector3().fromBufferAttribute(n,i)
        .add(new T.Vector3().fromBufferAttribute(n,i+1))
        .add(new T.Vector3().fromBufferAttribute(n,i+2));
      assert.ok(face.dot(normal)>=-.0001,`${mesh.name}: vertex normals follow outward triangle winding`);
    }
  }
  assert.ok(triangles<30000,`triangle budget: ${triangles}`);
});

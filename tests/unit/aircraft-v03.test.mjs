import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function environment() {
  const paint = Object.fromEntries(['clearRect','fillRect','fillText','beginPath','moveTo','lineTo','closePath','stroke','strokeRect'].map(k => [k, () => {}]));
  const env = vm.createContext({ console, document: { createElement: () => ({ getContext: () => ({ ...paint }) }) } });
  env.window = env;
  for (const file of ['src/vendor/three-r128.min.js','src/aircraft/detail.js','src/cockpit/detail.js']) vm.runInContext(await readFile(file,'utf8'), env);
  const T = env.THREE, aircraft = new T.Group(), cockpit = new T.Group();
  const original = new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial()); original.name = 'F35B blended faceted fuselage';
  const surfaces = { nozzle: new T.Group(), lfDoor: new T.Group() }; surfaces.nozzle.position.set(0,.01,6.31);
  aircraft.add(original,surfaces.nozzle,surfaces.lfDoor);
  for(let i=0;i<3;i++) {
    const pivot = new T.Group(); pivot.position.z=i*.34;
    const segment = new T.Mesh(new T.CylinderGeometry(.52-i*.018,.58-i*.02,.46,18,1),new T.MeshStandardMaterial({side:T.DoubleSide}));
    segment.geometry.rotateX(Math.PI/2);segment.position.z=.23;pivot.add(segment);surfaces.nozzle.add(pivot);surfaces['nozSeg'+i]=pivot;
  }
  aircraft.userData.gear=[];aircraft.userData.wheels=[];
  for(const [x,len] of [[0,.95],[1.75,1.14],[-1.75,1.14]]) {
    const pivot=new T.Group(),wheel=new T.Group();pivot.position.set(x,-.35,x===0?-4.34:1.92);wheel.position.y=-len;pivot.add(wheel);aircraft.add(pivot);
    aircraft.userData.gear.push(pivot);aircraft.userData.wheels.push(wheel);
  }
  const api=env.LightningVisuals;api.buildAircraftDetail(T,aircraft,surfaces);api.buildCockpitDetail(T,cockpit);
  return {T,aircraft,cockpit,api,surfaces,original};
}

test('near inlet and exhaust core survive low quality while the V2 body restores its legacy LOD',async()=>{
  const {aircraft,api,original}=await environment();
  const core=aircraft.getObjectByName('Lightning near airframe core');assert.ok(core,'inlet geometry needs an independent low-cost near group');
  const cowl=core.getObjectByName('Lightning inlet cowls and lips'),duct=core.getObjectByName('Lightning inlet ducts');assert.ok(cowl&&duct);
  for(const mesh of [cowl,duct]) {mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;assert.ok(box.max.z-box.min.z>.5,'inlet is still a planar patch');}
  api.updateAircraft({distance:30,quality:0});assert.equal(core.visible,true);assert.equal(original.visible,true);assert.equal(aircraft.getObjectByName('Lightning adaptive fuselage').parent.visible,false);
  api.updateAircraft({distance:146,quality:0});assert.equal(core.visible,false);
  api.updateAircraft({distance:130,quality:0});assert.equal(core.visible,false);
  api.updateAircraft({distance:100,quality:0});assert.equal(core.visible,true);
});

test('gear braces and torque links inherit the original retraction and wheel pivots',async()=>{
  const {T,aircraft}=await environment();
  for(let i=0;i<3;i++) {
    const pivot=aircraft.userData.gear[i],wheel=aircraft.userData.wheels[i];
    const braces=pivot.getObjectByName('Lightning gear braces'),links=wheel.getObjectByName('Lightning wheel torque links');assert.ok(braces&&links,'gear detail is missing or detached');
    aircraft.updateMatrixWorld(true);const before=links.getWorldPosition(new T.Vector3());pivot.rotation.x=.8;wheel.rotation.x=.7;aircraft.updateMatrixWorld(true);
    assert.ok(before.distanceTo(links.getWorldPosition(new T.Vector3()))>.1,'gear links did not follow retraction');assert.equal(braces.parent,pivot);assert.equal(links.parent,wheel);
  }
});

test('console controls and rudder pedals have raised geometry in the shared material batches',async()=>{
  const {T,cockpit}=await environment();const positions=[];let draws=0;
  cockpit.traverse(o=>{if(o.geometry)draws++;if(o.isInstancedMesh)for(let i=0;i<o.count;i++){const matrix=new T.Matrix4();o.getMatrixAt(i,matrix);positions.push(new T.Vector3().setFromMatrixPosition(matrix));}});
  assert.ok(positions.filter(p=>Math.abs(p.x)>.5&&p.y>.36&&p.y<.5&&p.z< -2.7).length>=12,'raised console switches/guards are missing');
  assert.ok(positions.filter(p=>Math.abs(p.x)>.1&&Math.abs(p.x)<.3&&p.y<.1&&p.z< -3.5).length>=2,'rudder pedal blocks are missing');
  assert.ok(draws<=15,`cockpit draw budget ${draws}`);
});

for(const quality of [0,1]) test(`engine bore reaches recessed turbine closure at quality ${quality}`,async()=>{
  const {T,aircraft,api,surfaces}=await environment();api.updateAircraft({distance:30,quality});aircraft.updateMatrixWorld(true);
  const body=aircraft.getObjectByName('Lightning adaptive fuselage');const targets=[...surfaces.nozzle.children, ...(quality?[body]:[])];
  const hits=new T.Raycaster(new T.Vector3(0,.21,7.90),new T.Vector3(0,0,-1),0,1.5).intersectObjects(targets,true).filter(hit=>hit.object.visible&&hit.object.material.opacity!==0);
  assert.ok(hits.length,'engine bore has no opaque recessed closure');assert.equal(hits[0].object.name,'Lightning opaque turbine cavity','an end-cap blocks the recessed engine bore');
  surfaces.nozzle.rotation.x=Math.PI/2;aircraft.updateMatrixWorld(true);const closure=surfaces.nozzle.getObjectByName('Lightning opaque turbine cavity');assert.ok(closure.getWorldPosition(new T.Vector3()).y<-.3,'core left the animated nozzle pivot');
});

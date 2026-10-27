import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';

async function modelEnvironment() {
 const paint=Object.fromEntries(['clearRect','fillRect','fillText','beginPath','moveTo','lineTo','closePath','stroke','strokeRect'].map(k=>[k,()=>{}]));
 const env=vm.createContext({console,document:{createElement:()=>({width:0,height:0,getContext:()=>({...paint})})}});env.window=env;
 for(const f of['src/vendor/three-r128.min.js','src/aircraft/detail.js'])vm.runInContext(await fs.readFile(f,'utf8'),env,{filename:f});
 const T=env.THREE,aircraft=new T.Group(),surfaces={lfDoor:new T.Group(),nozzle:new T.Group()};
 const original=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial());original.name='F35B blended faceted fuselage';aircraft.add(original,surfaces.lfDoor,surfaces.nozzle);
 env.LightningVisuals.buildAircraftDetail(T,aircraft,surfaces);
 return {T,api:env.LightningVisuals,aircraft,surfaces,original};
}

test('adaptive aircraft surface keeps public-sized envelope with outward triangle winding',async()=>{
 const {T,aircraft}=await modelEnvironment();const body=aircraft.getObjectByName('Lightning adaptive fuselage');assert.ok(body,'higher-detail fuselage was not constructed');
 const g=body.geometry;g.computeBoundingBox();const b=g.boundingBox;
 assert.ok(Math.abs(b.min.z+8.24)<.002 && Math.abs(b.max.z-7.34)<.002);
 assert.ok(b.min.x>=-1.67 && b.max.x<=1.67 && b.min.y>=-.90 && b.max.y<=1.09);
 assert.ok(g.attributes.position.count>=3000 && g.attributes.position.count<=4000);
 const p=g.attributes.position,ix=g.index.array,a=new T.Vector3(),bb=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),centre=new T.Vector3();let inward=0,checked=0;
 for(let i=0;i<ix.length;i+=3){a.fromBufferAttribute(p,ix[i]);bb.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);n.copy(bb).sub(a).cross(new T.Vector3().copy(c).sub(a));centre.copy(a).add(bb).add(c).multiplyScalar(1/3);if(Math.abs(centre.x)<.05)continue;checked++;if(n.x*centre.x<0)inward++;}
 assert.equal(inward,0,`${inward}/${checked} side triangles wind inward`);
});

test('adaptive LOD restores the original fuselage and follows the animated nozzle parent',async()=>{
 const {T,api,aircraft,surfaces,original}=await modelEnvironment();const body=aircraft.getObjectByName('Lightning adaptive fuselage'),nozzle=surfaces.nozzle.getObjectByName('Lightning articulated exhaust detail');assert.ok(body&&nozzle);
 api.updateAircraft({distance:30,quality:1});assert.equal(body.parent.visible,true);assert.equal(original.visible,false);assert.equal(nozzle.visible,true);
 surfaces.nozzle.rotation.x=Math.PI/2;aircraft.updateMatrixWorld(true);const q=nozzle.getWorldQuaternion(new T.Quaternion());assert.ok(q.angleTo(surfaces.nozzle.quaternion)<1e-8);
 api.updateAircraft({distance:150,quality:1});assert.equal(body.parent.visible,false);assert.equal(original.visible,true);assert.equal(nozzle.visible,false);
 api.updateAircraft({distance:30,quality:0});assert.equal(original.visible,true);assert.equal(body.parent.visible,false);
 api.updateAircraft({distance:30,quality:1});assert.equal(original.visible,false);
});

test('exhaust has opaque recessed closure and bounded authored surface budgets',async()=>{
 const {api,aircraft,surfaces}=await modelEnvironment();const cavity=surfaces.nozzle.getObjectByName('Lightning opaque turbine cavity');assert.ok(cavity,'nozzle scenery leak has no opaque closure');
 assert.equal(cavity.material.transparent,false);assert.ok(cavity.position.z<.6);assert.ok(cavity.geometry.boundingSphere || (cavity.geometry.computeBoundingSphere(),cavity.geometry.boundingSphere));
 let vertices=0,triangles=0,draws=0,textures=new Set();aircraft.traverse(o=>{if(!o.geometry||o.name==='F35B blended faceted fuselage')return;draws++;vertices+=o.geometry.attributes.position.count;triangles+=o.geometry.index?o.geometry.index.count/3:0;for(const a of Object.values(o.geometry.attributes))assert.ok([...a.array].every(Number.isFinite));if(o.material.map)textures.add(o.material.map);});
 assert.ok(draws<=10,`aircraft detail draw budget ${draws}`);assert.ok(vertices<6500,`aircraft detail vertex budget ${vertices}`);assert.ok(triangles<10000,`aircraft detail triangle budget ${triangles}`);assert.equal(textures.size,1);
 assert.equal(api.aircraftDetailInfo.modelVersion,2);assert.equal(api.aircraftDetailInfo.geometryVertices,vertices);assert.equal(api.aircraftDetailInfo.geometryTriangles,triangles);
});

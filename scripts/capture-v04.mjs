import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {browserSession,startFlight} from '../tests/helpers/browser.mjs';

const file=path.resolve(process.argv[2]||'dist/index.html'),label=process.argv[3]||'after';
assert.ok(['before','after'].includes(label),'Use before or after');
const scenes=[
 {name:'01-westminster-low',pos:[23000,180,-3000],cam:[22980,180,-3100],look:[23280,45,-3507]},
 {name:'02-central-2000ft',pos:[24000,610,-3600],cam:[23600,610,-2400],look:[25000,25,-5000]},
 {name:'03-tower-bridge',pos:[26400,220,-3700],cam:[26300,220,-3700],look:[26670,30,-4260]},
 {name:'04-shard-city',pos:[25600,250,-3650],cam:[25380,210,-3670],look:[25903,140,-4132]},
 {name:'05-canary-wharf',pos:[29700,450,-3000],cam:[29700,450,-3000],look:[30550,100,-4300]},
 {name:'06-heathrow',pos:[-1200,500,2300],cam:[-1200,500,2300],look:[700,30,200]},
 {name:'07-residential',pos:[15000,180,-1800],cam:[14700,220,-1400],look:[15600,20,-2500]},
 {name:'08-high-altitude',pos:[23000,5000,-2000],cam:[21000,5000,2000],look:[25500,0,-4600]},
 {name:'09-sunset',pos:[25000,600,-2000],cam:[24000,500,-2800],look:[26000,100,-4800],hour:18.1},
 {name:'10-night',pos:[25000,600,-2000],cam:[24000,500,-2800],look:[26000,100,-4800],hour:23.3}
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const out=path.resolve('screenshots/london-v0.4',label);await fs.mkdir(out,{recursive:true});
const sourceBytes=await fs.readFile(file),session=await browserSession({file}),p=session.page;
const report={status:'FAIL',sourceSha256:hash(sourceBytes),sourceBytes:sourceBytes.length,environment:session.environment,
 method:'Actual WebGL framebuffer. London selected in both versions; paused physics and stopped RAF; fixed poses, cameras, 58 degree field of view, seed4201, Balanced Q1, CAVOK, 1280x720. Aircraft and HUD hidden for unobstructed scenery, preserving the scene assets and materials. Before uses verified v0.3 source with original landmarks fetched at GitHub ref4f07, blob9922aa69ab1c83ac387428f89d2a8cd57034f354. After uses recovered v0.4. Geometry warmed450 calls at60Hz simulation timestamps; six asynchronous70ms imagery turns before each render. These controlled scenery captures are not flight lifecycle or physical-device performance evidence.',shots:[]};
try{
 await p.selectOption('#worldMode','LONDON');await startFlight(p,{start:'RUNWAY'});
 await p.evaluate(()=>{paused=true;updateCamera=()=>{};loop=()=>{};});
 await p.addStyleTag({content:'body>:not(canvas.gl):not(#sceneryBadge){visibility:hidden!important}'});
 for(const [index,sceneSettings]of scenes.entries()){
  const settings={...sceneSettings,warm:10000+index*1000};
  await p.evaluate(s=>{
   paused=true;simHours=s.hour||13.2;simT=120;wxPreset='cavok';applyWx();L.profile='BALANCED';qlLevel=1;S.quality='MED';applyQl();
   OX=OZ=0;worldGroup.position.set(0,0,0);P.pos.fromArray(s.pos);P.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
   P.vel.set(120,0,0);P.om.set(0,0,0);camMode=2;gearD=0;updateAcSurfaces(0);applyVisibility();updateWeather(0);
   ensureRegionalFeatures(0,true);chunkTimer=0;ensureChunks(1);chunkBudget=999;processChunksTimed(2000);
   for(let i=0;i<450;i++)LightningLondon.update(P.pos.x,P.pos.z,P.pos.y,1,nightF,s.warm+i/60);
   camera.position.fromArray(s.cam);camera.lookAt(new THREE.Vector3(...s.look));camera.fov=58;camera.updateProjectionMatrix();sky.position.copy(camera.position);
   terrainMat.uniforms.uOrigin.value.set(0,0);terrainMat.uniforms.uSun.value.copy(sunDir);terrainMat.uniforms.uFog.value.copy(scene.fog.color);terrainMat.uniforms.uFogD.value=scene.fog.density;terrainMat.uniforms.uDay.value=dayF;terrainMat.uniforms.uWet.value=0;
   waterMat.uniforms.uSun.value.copy(sunDir);waterMat.uniforms.uFog.value.copy(scene.fog.color);waterMat.uniforms.uFogD.value=scene.fog.density;waterMat.uniforms.uNight.value=nightF;
   LightningVisuals.updateAircraft({distance:camera.position.distanceTo(P.pos),quality:1,night:nightF});LightningVisuals.updateCockpit({roll:0,pitch:0,throttle:.2,night:nightF});updateAttitudeData();drawHMDS();
  },settings);
  for(let i=0;i<6;i++){await p.waitForTimeout(70);await p.evaluate(({time})=>globalThis.LightningImagery?.update(P.pos.x,P.pos.z,P.pos.y,1,time),{time:settings.warm+8+i*.3});}
  const state=await p.evaluate(()=>{ac.visible=false;if(cockpitGrp)cockpitGrp.visible=false;renderer.render(scene,camera);return{world:worldMode,scenery:LightningLondon.stats(),camera:camera.position.toArray(),fov:camera.fov,aircraft:P.pos.toArray(),hour:simHours,quality:qlLevel,profile:L.profile,renderer:{...renderer.info.render,...renderer.info.memory}};});
  assert.equal(state.world,'LONDON');assert.equal(state.quality,1);assert.equal(state.profile,'BALANCED');
  assert.deepEqual(session.errors,[],'JavaScript or shader error');
  const imagePath=path.join(out,settings.name+'.png');await p.screenshot({path:imagePath});
  const bytes=await fs.readFile(imagePath);report.shots.push({name:settings.name,...state,file:path.basename(imagePath),sha256:hash(bytes),bytes:bytes.length});
  console.log(label,settings.name,state.scenery.imagery||'v0.3 vector ground');
 }
 if(label==='after'){
  const before=await p.evaluate(()=>{const t=scene.userData.londonEnvironment,p=new Uint8Array(t.width*t.height*4);renderer.readRenderTargetPixels(t,0,0,t.width,t.height,p);window.captureOldEnvironment=t;return p.reduce((a,b)=>a+b,0);});
  await p.evaluate(()=>{const e=renderer.getContext().getExtension('WEBGL_lose_context');if(!e)throw Error('Context loss extension unavailable');e.loseContext();setTimeout(()=>e.restoreContext(),300);});
  await p.waitForTimeout(1700);
  const restored=await p.evaluate(()=>{const t=scene.userData.londonEnvironment,p=new Uint8Array(t.width*t.height*4);renderer.readRenderTargetPixels(t,0,0,t.width,t.height,p);return{lost:renderer.getContext().isContextLost(),replaced:t!==window.captureOldEnvironment,pixelSum:p.reduce((a,b)=>a+b,0)};});
  assert.equal(restored.lost,false);assert.equal(restored.replaced,true);assert.ok(before>0);assert.equal(restored.pixelSum,before);report.environmentRestore={beforePixelSum:before,...restored};
 }
 assert.equal(hash(await fs.readFile(file)),report.sourceSha256,'HTML changed during capture');assert.deepEqual(session.errors,[]);
 report.status='PASS';
}catch(error){report.failure=String(error);throw error;}
finally{report.errors=session.errors;report.warnings=session.warnings;await session.close();await fs.writeFile(path.join(out,'settings.json'),JSON.stringify(report,null,2)+'\n');}

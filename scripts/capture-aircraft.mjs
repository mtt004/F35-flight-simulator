import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {browserSession,startFlight,captureScene,snapshot} from '../tests/helpers/browser.mjs';
const file=path.resolve(process.argv[2]||'dist/index.html'),label=process.argv[3]||'v020-after';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid capture label');
const output=path.resolve('screenshots/aircraft-v0.2',label);await mkdir(output,{recursive:true});
const report={date:new Date().toISOString(),source:file,sourceSha256:createHash('sha256').update(await readFile(file)).digest('hex'),method:'Real WebGL simulator. Fixed seed4201/hour13.2; configured normal spawns, paused for geometry inspection. Test-only camera override, no rigid-body pose changes. These captures do not prove a flight lifecycle.',shots:[],status:'FAIL'};
let session;
try{
 session=await browserSession({file});report.environment=session.environment;const{page}=session;await startFlight(page,{start:'PARK'});
 const scenes=[{name:'front-quarter',start:'PARK',offset:[12,4,-14],look:[0,.15,-1],fov:43},{name:'rear-quarter',start:'PARK',offset:[4,3,16],look:[0,.1,4],fov:42},{name:'lower-side',start:'AIR',offset:[13,-3,1],look:[0,-.1,0],fov:48},{name:'cockpit',start:'PARK',camera:1}];
 for(const shot of scenes){
  await captureScene(page,shot);
  const details=await page.evaluate(s=>{
   paused=true;document.getElementById('pauseOv').classList.remove('on');
   if(!window.__qaCaptureCamera)window.__qaCaptureCamera=updateCamera;
   if(s.name==='cockpit'){updateCamera=window.__qaCaptureCamera;camMode=1;updateAcSurfaces(0);updateCamera(0);}
   else{camMode=2;updateCamera=()=>{};updateAcSurfaces(0);camera.position.copy(P.pos).add(new THREE.Vector3(...s.offset).applyQuaternion(P.quat));camera.lookAt(P.pos.clone().add(new THREE.Vector3(...s.look).applyQuaternion(P.quat)));camera.fov=s.fov;camera.updateProjectionMatrix();applyVisibility();}
   if(window.LightningVisuals)LightningVisuals.updateAircraft({distance:camera.position.distanceTo(P.pos),quality:1,night:nightF});
   renderer.render(scene,camera);
   return{camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov},model:window.LightningVisuals?.aircraftDetailInfo||null};
  },shot);
  await page.screenshot({path:path.join(output,shot.name+'.png')});report.shots.push({settings:shot,details,state:await snapshot(page)});
  await page.evaluate(()=>{updateCamera=window.__qaCaptureCamera;paused=false;});
 }
 report.errors=session.errors;report.warnings=session.warnings;if(session.errors.length)throw Error('JavaScript/shader errors: '+JSON.stringify(session.errors));report.status='PASS';
}catch(error){report.failure=String(error);process.exitCode=1;}finally{if(session)await session.close();await writeFile(path.join(output,'capture-settings.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,shots:report.shots.length,sourceSha256:report.sourceSha256,failure:report.failure}));

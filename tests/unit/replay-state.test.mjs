import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { extractFunction } from '../helpers/source.mjs';
const source=await readFile('src/simulator.js','utf8'),three=await readFile('src/vendor/three-r128.min.js','utf8');
function environment(wasPaused){
 const context=vm.createContext({console,wasPaused});context.window=context;vm.runInContext(three,context);
 vm.runInContext(`
 const P={pos:new THREE.Vector3(9,10,11),vel:new THREE.Vector3(12,13,14),quat:new THREE.Quaternion(),om:new THREE.Vector3(1,2,3)};
 let camMode=2,paused=wasPaused,replayActive=false,replayClock=0,replayWall=0,replayRestore=null,now=1000;
 let ias=150,mach=.45,gNz=1.2,nozzle=40,gearD=.8,thr=.7;
 const REPLAY_HZ=12,replayFrames=Array.from({length:30},()=>({p:[100,200,300],q:[0,1,0,0],v:[40,50,60],om:[0,0,0],ias:80,mach:.2,g:.5,n:0,gear:0,thr:.2}));
 const performance={now:()=>now},_q1=new THREE.Quaternion(),_q2=new THREE.Quaternion();
 const lerp=(a,b,t)=>a+(b-a)*t;const closeTransientMenus=()=>{},toast=()=>{},missionBanner=()=>{},snapCameraToAircraft=()=>{},updateAttitudeData=()=>{},updateAcSurfaces=()=>{},updateCamera=()=>{},drawHMDS=()=>{};
 const scene={},camera={},renderer={render(){}};const classes=new Set(['on']);const pauseElement={classList:{remove(k){classes.delete(k)},toggle(k,on){if(on)classes.add(k);else classes.delete(k)}},setAttribute(){}};
 const $=id=>id==='pauseOv'?pauseElement:{classList:{remove(){},add(){}}};const document={getElementById:$};
 ${['startReplay','stopReplay','updateReplay'].map(n=>extractFunction(source,n)).join('\n')}
 this.begin=()=>startReplay();this.play=()=>{now+=500;updateReplay(.1);};this.stop=()=>stopReplay();
 this.state=()=>JSON.stringify({p:P.pos.toArray(),v:P.vel.toArray(),q:P.quat.toArray(),om:P.om.toArray(),camMode,paused,ias,mach,gNz,nozzle,gearD,thr});
 this.pauseVisible=()=>classes.has('on');`,context);
 return context;
}
for(const wasPaused of [false,true])test('replay restores all mutated live state and original pause mode: '+wasPaused,()=>{
 const env=environment(wasPaused),before=env.state();env.begin();env.play();assert.notEqual(env.state(),before,'Actual replay must change the sampled frame');env.stop();assert.equal(env.state(),before);assert.equal(env.pauseVisible(),wasPaused);
});

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
 let physAcc=.5,last=500;const cadence={reset(){}};
 let ias=150,mach=.45,gNz=1.2,nozzle=40,gearD=.8,thr=.7,pitchDeg=0,hdgDeg=0,rollDeg=0,bank=0;
 const D2R=Math.PI/180,R2D=180/Math.PI,norm360=a=>((a%360)+360)%360;const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const _fwd=new THREE.Vector3(),_up=new THREE.Vector3(),_rgt=new THREE.Vector3();
 const REPLAY_HZ=12,replayFrames=Array.from({length:30},()=>({p:[100,200,300],q:[0,1,0,0],v:[40,50,60],om:[0,0,0],ias:80,mach:.2,g:.5,n:0,gear:0,thr:.2}));
 const performance={now:()=>now},_q1=new THREE.Quaternion(),_q2=new THREE.Quaternion();
 const lerp=(a,b,t)=>a+(b-a)*t;const closeTransientMenus=()=>{},toast=()=>{},missionBanner=()=>{},snapCameraToAircraft=()=>{},applyVisibility=()=>{},updateAcSurfaces=()=>{},updateCamera=()=>{},drawHMDS=()=>{};
 const scene={},camera={},renderer={render(){}};const classes=new Set(['on']);const pauseElement={classList:{remove(k){classes.delete(k)},toggle(k,on){if(on)classes.add(k);else classes.delete(k)}},setAttribute(){}};
 const $=id=>id==='pauseOv'?pauseElement:{classList:{remove(){},add(){}}};const document={getElementById:$};
 ${['updateAttitudeData','startReplay','stopReplay','updateReplay'].map(n=>extractFunction(source,n)).join('\n')}
 updateAttitudeData();
 this.begin=()=>startReplay();this.play=()=>{now+=500;updateReplay(.1);};this.stop=()=>stopReplay();this.finishNaturally=()=>{now+=4000;updateReplay(.1);};this.clock=()=>({active:replayActive,wall:replayWall,clock:replayClock,last,debt:physAcc,now});
 this.state=()=>JSON.stringify({p:P.pos.toArray(),v:P.vel.toArray(),q:P.quat.toArray(),om:P.om.toArray(),camMode,paused,ias,mach,gNz,nozzle,gearD,thr,pitchDeg,hdgDeg,rollDeg,bank,forward:_fwd.toArray(),up:_up.toArray(),right:_rgt.toArray()});
 this.pauseVisible=()=>classes.has('on');`,context);
 return context;
}
for(const wasPaused of [false,true])test('replay restores all mutated live state and original pause mode: '+wasPaused,()=>{
 const env=environment(wasPaused),before=env.state();env.begin();env.play();assert.notEqual(env.state(),before,'Actual replay must change the sampled frame');env.stop();assert.equal(env.state(),before);assert.equal(env.pauseVisible(),wasPaused);
});
test('a second replay start cannot replace the original live-flight snapshot',()=>{
 const env=environment(true),before=env.state();env.begin();env.play();env.begin();env.play();env.stop();assert.equal(env.state(),before);
});
test('a replay request after natural completion starts a fresh replay with a new wall clock',()=>{
 const env=environment(true);env.begin();const first=env.clock();env.finishNaturally();assert.equal(env.clock().active,false);env.begin();const next=env.clock();assert.equal(next.active,true);assert.ok(next.wall>first.wall);assert.equal(next.clock,0);
});
test('replay transitions reset live-frame time even when playback runs between renders',()=>{
 const env=environment(false);env.begin();let c=env.clock();assert.equal(c.debt,0);assert.equal(c.last,c.now);
 env.play();env.stop();c=env.clock();assert.equal(c.debt,0);assert.equal(c.last,c.now);
});

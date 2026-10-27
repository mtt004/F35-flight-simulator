import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { extractFunction } from '../helpers/source.mjs';

const source = await readFile('src/simulator.js','utf8');
const three = await readFile('src/vendor/three-r128.min.js','utf8');
function validFlight() { return {seed:4201,pos:[150,2000,-350],vel:[70,2,-125],quat:[0,0,0,1],om:[.01,.02,-.03],fuel:2200,thr:.65,thrT:.7,gearD:0,gearT:0,stolMode:'CONV',camMode:2,simT:120,flightT:80}; }
function environment(flight) {
  const context=vm.createContext({console, saved:structuredClone(flight)}); context.window=context;
  vm.runInContext(three,context);
  const helper=source.includes('function validSavedFlight(')?extractFunction(source,'validSavedFlight'):'';
  vm.runInContext(`
    const P={pos:new THREE.Vector3(9,10,11),vel:new THREE.Vector3(12,13,14),quat:new THREE.Quaternion(),om:new THREE.Vector3(1,2,3)};
    const S={},SAVE_KEY='test',MAX_FUEL=8000;let SEED=4201,OX=40,OZ=50,running=false,paused=true,crashed=false,SAVED={tutorialSeen:true,flight:saved};
    let fuel=3000,thr=.2,thrT=.2,N1=55,N2=59,abSpool=0,gearD=1,gearT=1,parkBrake=true,stolMode='CONV',lfDoor=0,lfSpool=0,nozzle=0,simT=0,flightT=0,simHours=13.2,camMode=0,hovAlt=0;
    let replayActive=false;let wxPreset='cavok',startType='PARK',scenario='FREE FLIGHT',stored=null;
    const worldGroup={position:new THREE.Vector3(1,2,3)};
    const elements={continue:{style:{},setAttribute(){}},selFuel:{value:'.55'}};
    const $=id=>elements[id];const selectedFuel=()=>3000,selectedAirport=()=>({icao:'TEST'}),clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),surfaceH=()=>0;
    const toast=message=>{globalThis.message=message},clearVapour=()=>{},updateAttitudeData=()=>{},ensureRegionalFeatures=()=>{},applyVisibility=()=>{};
    function newWorld(seed){SEED=seed;P.pos.set(0,0,0);}function startSortie(){running=true;paused=false;}
    const localStorage={setItem(key,value){stored=value}};
    ${helper}
    ${extractFunction(source,'continueSavedFlight')}
    ${extractFunction(source,'savePrefs')}
    this.state=()=>JSON.stringify({seed:SEED,origin:[OX,OZ],pos:P.pos.toArray(),vel:P.vel.toArray(),quat:P.quat.toArray(),om:P.om.toArray(),running,paused,fuel,flightT,thr,camMode,world:worldGroup.position.toArray()});
    this.restore=()=>continueSavedFlight();this.record=()=>JSON.parse(JSON.stringify(SAVED));
    this.mutate=script=>eval(script);this.write=()=>savePrefs(true);
  `,context);
  return {state:context.state,restore:context.restore,mutate:context.mutate,write:context.write,record:()=>JSON.parse(JSON.stringify(context.record())),get message(){return context.message;}};
}

// Removing any vector gate or seed/quaternion validity check must allow corrupt
// input to mutate live Three.js state and fail these non-mutation assertions.
const invalid=[
 ['short velocity',{vel:[]}],['short angular rate',{om:[0,0]}],['missing velocity',{vel:undefined}],
 ['numeric-string position',{pos:['150',2000,-350]}],['null quaternion',{quat:[0,null,0,1]}],
 ['nonfinite velocity',{vel:[Infinity,0,0]}],['NaN angular rate',{om:[NaN,0,0]}],
 ['zero quaternion',{quat:[0,0,0,0]}],['overflow quaternion',{quat:[1e308,0,0,1]}],
 ['invalid seed',{seed:'4201'}],['out of range seed',{seed:1000000}],
 ['extreme position',{pos:[1e30,2000,0]}],['extreme velocity',{vel:[1e20,0,0]}],
 ['extreme angular rate',{om:[0,1e20,0]}],['extra vector components',{vel:[1,2,3,4]}],
];
for(const [name,patch] of invalid)test('restore rejects '+name+' without changing the flight',()=>{
 const env=environment({...validFlight(),...patch});const before=env.state();env.restore();
 assert.equal(env.state(),before);assert.match(env.message,/SAVED FLIGHT|SAVED DATA/i);
});
test('valid existing save restores numeric state and normalizes orientation',()=>{
 const f=validFlight();f.quat=[0,0,0,2];const env=environment(f);env.restore();const state=JSON.parse(env.state());
 assert.deepEqual(state.pos,[150,2000,-350]);assert.deepEqual(state.vel,[70,2,-125]);assert.deepEqual(state.om,[.01,.02,-.03]);
 assert.deepEqual(state.quat,[0,0,0,1]);assert.equal(state.fuel,2200);assert.equal(state.running,true);assert.equal(state.paused,false);
 assert.deepEqual(env.record().flight.quat,[0,0,0,2]);
});
test('valid save in another seeded world restores its absolute coordinates',()=>{
 const env=environment({...validFlight(),seed:777});env.restore();const state=JSON.parse(env.state());
 assert.equal(state.seed,777);assert.deepEqual(state.origin,[0,0]);assert.deepEqual(state.pos,[150,2000,-350]);
});
for(const mutation of ['P.quat.set(0,NaN,0,1)','P.om.set(0,Infinity,0)'])test('save retains last valid flight when live orientation/rates are invalid: '+mutation,()=>{
 const f=validFlight(),env=environment(f);env.mutate('running=true;'+mutation);env.write();assert.deepEqual(env.record().flight,f);
});

test('saving during replay preserves the last live-flight save',()=>{
 const f=validFlight(),env=environment(f);env.mutate('running=true;replayActive=true;');env.write();assert.deepEqual(env.record().flight,f);
});

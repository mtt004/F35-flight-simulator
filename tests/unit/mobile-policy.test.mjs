import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={}; vm.createContext(c);
vm.runInContext(fs.readFileSync('src/rendering/mobile-policy.js','utf8'),c);
const {bufferSize,QualityGovernor,FrameCadence,validatePack,cleanOptions}=c.Lightning;
test('Balanced bounds physical buffer independent of DPR and preserves aspect',()=>{
 for(const [w,h,d] of [[800,360,3],[2400,1080,1],[1080,2400,2.75]]){
  const r=bufferSize(w,h,d,'BALANCED',1);assert.ok(r.height<=648);assert.ok(r.width*r.height<=1200000);assert.ok(Math.abs(r.width/r.height-w/h)<.02);
 }
});
test('profile validation rejects nonfinite controls and unknown fields',()=>{
 const o=cleanOptions({profile:'banana',zoom:Infinity,stickX:900,opacity:-2,gyro:true,evil:'x'});
 assert.equal(o.profile,'BALANCED');assert.equal(o.zoom,1);assert.equal(o.stickX,30);assert.equal(o.opacity,.25);assert.equal(o.evil,undefined);
});
test('governor needs sustained overload and delays recovery',()=>{
 const g=new QualityGovernor(2);for(let i=0;i<2;i++)assert.equal(g.sample(45,40),2);
 assert.equal(g.sample(45,40),1);for(let i=0;i<4;i++)assert.equal(g.sample(33.3,10),1);assert.equal(g.sample(33.3,10),2);
});
test('30 FPS cadence services exactly 30 frames at 60 Hz',()=>{
 const g=new FrameCadence(30);let n=0;for(let i=0;i<60;i++)n+=g.ready(i*1000/60)?1:0;assert.equal(n,30);
 g.reset();assert.equal(g.ready(90000),true);assert.equal(g.ready(90001),false);
});
test('pack parser accepts palettes but forbids executable or malformed assets',()=>{
 const p=validatePack({schema:1,id:'hampshire-inspired',name:'Hampshire inspired',palette:['#344f31','#a1a070','#747d60'],referenceOnly:true});
 assert.equal(p.palette.length,3);assert.throws(()=>validatePack({schema:1,id:'x',name:'x',palette:['url(js)']}));assert.throws(()=>validatePack({schema:1,id:'x',name:'x',palette:['#ffffff','#aaaaaa','#000000'],script:'x'}));
});

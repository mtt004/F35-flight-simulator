import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(){let time=0,calls=0;const c=vm.createContext({performance:{now:()=>{calls++;return time;}}});c.window=c;vm.runInContext(fs.readFileSync('src/rendering/diagnostics.js','utf8'),c);return{d:c.LightningDiagnostics,set:v=>time=v,get calls(){return calls;}};}
test('disabled profiling does not sample clocks or retain frames',()=>{const s=setup();s.d.beginFrame(0,0);s.d.mark('physics');s.d.endFrame(0,0,{});assert.equal(s.calls,0);assert.equal(s.d.summary().frames,0);});
test('profiling bounds retained rows and distinguishes cadence, work and simulation debt',()=>{const s=setup();s.d.start(2);for(let i=0;i<3;i++){s.set(i*100);s.d.beginFrame(i*100,i*.1);s.set(i*100+2);s.d.mark('physics');s.set(i*100+7);s.d.mark('render');s.d.endFrame(i*.1+.1,.25,{info:{render:{calls:42,triangles:100},memory:{textures:4,geometries:3},programs:[{}]}});}const r=s.d.summary();assert.equal(r.frames,3);assert.equal(r.retainedFrames,2);assert.equal(r.sections.physics.p50Ms,2);assert.equal(r.sections.render.p50Ms,5);assert.equal(r.frameMs.p50,100);assert.equal(r.workMs.p50,7);assert.equal(r.simulation.debtSeconds,.25);assert.equal(r.renderer.calls,42);s.d.stop();assert.equal(s.d.enabled,false);});
test('profiling resets cadence history and rejects invalid limits',()=>{const s=setup();s.d.start(3);s.d.beginFrame(100,0);s.d.endFrame(0,0,{});s.d.start(3);assert.equal(s.d.summary().frames,0);assert.throws(()=>s.d.start(Infinity));});

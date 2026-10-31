import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForGpuIdle} from '../../scripts/gpu-timing.mjs';

function mock(states){
 const calls=[];
 return {calls,SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,WAIT_FAILED:4,
  fenceSync(...a){calls.push(['fence',...a]);return{};},flush(){calls.push(['flush']);},
  clientWaitSync(sync,flags,timeout){calls.push(['poll',flags,timeout]);return states.shift()??0;},
  isContextLost(){return false;},deleteSync(){calls.push(['delete']);}};
}
test('GPU boundary yields while queued work completes and never blocks polling',async()=>{
 const gl=mock([0,0,3]),r=await waitForGpuIdle(gl,1000,0);
 assert.equal(r.signalled,true);assert.equal(r.polls,3);
 assert.deepEqual(gl.calls.filter(c=>c[0]==='poll'),Array(3).fill(['poll',0,0]));
 assert.equal(gl.calls.at(-1)[0],'delete');
});
test('GPU boundary fails closed and releases its fence on timeout',async()=>{
 const gl=mock([]);await assert.rejects(waitForGpuIdle(gl,0,0),/timed out/);
 assert.equal(gl.calls.at(-1)[0],'delete');
});
test('GPU boundary fails closed on lost or failed context',async()=>{
 const gl=mock([4]);await assert.rejects(waitForGpuIdle(gl),/fence failed/);
 assert.equal(gl.calls.at(-1)[0],'delete');
});
test('GPU boundary requires an actual usable WebGL2 fence',async()=>{
 await assert.rejects(waitForGpuIdle({}),/WebGL2/);
 const gl=mock([]);gl.fenceSync=()=>null;
 await assert.rejects(waitForGpuIdle(gl),/create benchmark/);
});

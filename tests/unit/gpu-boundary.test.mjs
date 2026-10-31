import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForGpuIdle,createGpuSubmissionQueue} from '../../scripts/gpu-timing.mjs';

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
test('bounded submission pipeline drains oldest work before permitting a third frame',async()=>{
 const gl=mock([0,3,3,3]),q=createGpuSubmissionQueue(gl);
 await q.beforeFrame();q.afterFrame();await q.beforeFrame();q.afterFrame();
 assert.throws(()=>q.afterFrame(),/limit exceeded/);
 await q.beforeFrame();q.afterFrame();const r=await q.drain();q.dispose();
 assert.equal(r.queueDepth,2);assert.equal(r.maxPendingObserved,2);assert.equal(r.signalled,true);
 assert.equal(gl.calls.filter(c=>c[0]==='fence').length,3);
 assert.equal(gl.calls.filter(c=>c[0]==='delete').length,3);
 assert.ok(gl.calls.filter(c=>c[0]==='poll').every(c=>c[1]===0&&c[2]===0));
});
test('bounded pipeline fails closed on GPU timeout and cleans remaining fences',async()=>{
 const gl=mock([]),q=createGpuSubmissionQueue(gl,2,0);q.afterFrame();q.afterFrame();
 await assert.rejects(q.beforeFrame(),/timed out/);q.dispose();q.dispose();
 assert.equal(gl.calls.filter(c=>c[0]==='delete').length,2);
 assert.throws(()=>q.afterFrame(),/disposed/);
});
test('bounded pipeline rejects unusable hardware and invalid depth',()=>{
 assert.throws(()=>createGpuSubmissionQueue({}),/WebGL2/);
 assert.throws(()=>createGpuSubmissionQueue(mock([]),0),/depth/);
 const gl=mock([]);gl.fenceSync=()=>null;const q=createGpuSubmissionQueue(gl);
 assert.throws(()=>q.afterFrame(),/create GPU/);q.dispose();
});
test('bounded pipeline cleans failed GPU waits without discarding a success claim',async()=>{
 const gl=mock([4]),q=createGpuSubmissionQueue(gl);q.afterFrame();
 await assert.rejects(q.drain(),/fence failed/);q.dispose();
 assert.equal(gl.calls.filter(c=>c[0]==='delete').length,1);
});

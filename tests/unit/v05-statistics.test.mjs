import test from 'node:test';import assert from 'node:assert/strict';
import {frameStatistics,pairedChanges} from '../../scripts/v05-statistics.mjs';
test('frame reporting uses slowest one percent mean and retains empty results as null',()=>{
 const intervals=[...Array(99).fill(20),100];const r=frameStatistics(intervals);
 assert.equal(r.medianFps,50);assert.equal(r.onePercentLowFps,10);assert.equal(r.frameMs.p99,20);assert.equal(r.frameMs.max,100);
 assert.equal(frameStatistics([]).medianFps,null);assert.equal(frameStatistics([NaN,Infinity,0,-1]).samples,0);
});
test('paired reporting uses matching runs, not unmatched pooled medians',()=>{
 const r=pairedChanges([[10,20],[20,20],[40,20]]);assert.equal(r.pairs,3);
 assert.deepEqual(r.percentChanges,[-50,0,100]);assert.equal(r.medianPercentChange,0);
 assert.equal(pairedChanges([[0,4]]).pairs,0);
});

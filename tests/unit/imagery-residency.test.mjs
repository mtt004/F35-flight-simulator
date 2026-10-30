import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c=vm.createContext({console});c.window=c;vm.runInContext(fs.readFileSync('src/terrain/imagery.js','utf8'),c);
const entries=Array.from({length:12},(_,i)=>({id:String(i),extent:[i*100,0,(i+1)*100,100]}));
const settle=()=>new Promise(r=>setImmediate(r));
test('resident and pending imagery are bounded and old asynchronous loads cannot return after eviction',async()=>{
 const pending=[],disposed=[];const cache=new c.LightningImagery.Residency(entries,e=>new Promise(resolve=>pending.push({id:e.id,resolve})),t=>disposed.push(t),4);
 cache.update(50,50,4);await settle();assert.equal(pending.length,2);assert.equal(cache.stats().pending,2);
 cache.update(1150,50,4);assert.equal(pending.length,2,'cancelled decodes still count against concurrency');
 pending[0].resolve('old0');pending[1].resolve('old1');await settle();assert.deepEqual(disposed.sort(),['old0','old1']);assert.equal(cache.stats().resident,0);
 cache.update(1150,50,4);await settle();assert.equal(pending.length,4);pending[2].resolve('new0');pending[3].resolve('new1');await settle();assert.equal(cache.stats().resident,2);
 cache.update(1150,50,4);await settle();for(const p of pending.slice(4))p.resolve(p.id);await settle();assert.equal(cache.stats().resident,4);
 cache.update(50,50,2);await settle();assert.ok(cache.stats().resident<=2);cache.dispose();assert.equal(cache.stats().resident,0);for(const p of pending.slice(6))p.resolve('late');await settle();assert.equal(cache.stats().resident,0);
});
test('failed detail leaves overview usable and does not retry forever',async()=>{
 let calls=0;const cache=new c.LightningImagery.Residency(entries,()=>{calls++;return Promise.reject(Error('corrupt image'));},()=>{},4);
 cache.update(50,50,4);await settle();cache.update(50,50,4);await settle();cache.update(50,50,4);await settle();assert.equal(calls,4);assert.equal(cache.stats().failed,4);assert.equal(cache.stats().resident,0);
});
test('imagery churn counters distinguish eviction, reload and stale decode without increasing residency',async()=>{
 const cache=new c.LightningImagery.Residency(entries,e=>Promise.resolve({id:e.id}),()=>{},2);
 cache.update(50,50,2);await settle();cache.update(50,50,2);await settle();
 assert.equal(cache.stats().loads,2);assert.equal(cache.stats().selectionPasses,1);
 cache.update(1150,50,2);await settle();assert.equal(cache.stats().evictions,2);
 cache.update(50,50,2);await settle();assert.equal(cache.stats().reloads,2);
 assert.equal(cache.stats().resident,2);assert.equal(cache.stats().peakPending,2);
 cache.dispose();assert.equal(cache.stats().resident,0);
});

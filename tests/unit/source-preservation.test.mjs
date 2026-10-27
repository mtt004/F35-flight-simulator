import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';import{appSource,baselineFile,extractFunction}from'../helpers/source.mjs';
const baseline=await appSource(),current=await readFile('src/simulator.js','utf8');
test('original uploaded bytes retain their recorded SHA-256',async()=>{assert.equal(createHash('sha256').update(await readFile(baselineFile)).digest('hex'),'cf3b450a2aaf6fe03d95207a7a9b9a33f1179bf7868b03b805cda1a8d55f3435');});
test('core flight, STOVL and terrain collision implementations remain byte identical',()=>{
 for(const n of ['physics','aeroForces','engineUpdate','stolUpdate','fcsUpdate','groundContact','massProperties','fuelDistribution','hoverTrimPower','toggleStol','apUpdate','rawHeight','heightAt','surfaceH','recordReplay','updateReplay'])assert.equal(extractFunction(current,n),extractFunction(baseline,n),n);
});

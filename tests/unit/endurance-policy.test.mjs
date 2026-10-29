import test from 'node:test';import assert from 'node:assert/strict';
import {assessEndurance} from '../../scripts/endurance-policy.mjs';
const state=t=>({flightT:t,simT:t,paused:false,crashed:false,globalPosition:[t*140,900,0],velocity:[140,0,0],quaternion:[0,0,0,1],fuel:6000,world:{mode:'LONDON'},landmarks:9,contextLost:false,contextLosses:0});
test('live advancing London flight qualifies',()=>assert.deepEqual(assessEndurance([state(0),state(10)]).issues,[]));
test('paused or frozen physics cannot qualify a rendering-only endurance run',()=>{assert.ok(assessEndurance([state(0),{...state(10),paused:true}]).issues.length);assert.ok(assessEndurance([state(10),state(10)]).issues.length);assert.ok(assessEndurance([state(10),state(9)]).issues.length);});
test('nonfinite state, wrong world, crashes and missing landmarks fail endurance',()=>{for(const patch of [{globalPosition:[NaN,900,0]},{velocity:[Infinity,0,0]},{quaternion:[0,0,0,NaN]},{quaternion:[0,0,0,0]},{fuel:NaN},{fuel:-1},{world:{mode:'LEGACY'}},{crashed:true},{landmarks:0}])assert.ok(assessEndurance([state(0),{...state(10),...patch}]).issues.length);});
test('restored context losses are reported while an unrecovered final loss fails',()=>{const recovered=assessEndurance([state(0),{...state(10),contextLosses:1}]);assert.deepEqual(recovered.issues,[]);assert.equal(recovered.recoveredContextLosses,1);assert.ok(assessEndurance([state(0),{...state(10),contextLost:true,contextLosses:1}]).issues.length);});


test('v0.4 requires the complete nine-landmark scene',()=>{
 const full=t=>({...state(t),landmarks:9});
 assert.deepEqual(assessEndurance([full(0),full(10)]).issues,[]);
 assert.ok(assessEndurance([full(0),{...full(10),landmarks:8}]).issues.includes('Landmarks missing'));
});

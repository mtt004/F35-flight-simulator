// Functional test pilots. Commands go through existing keyboard/touch controls.
// These never assign aircraft position, velocity, attitude, force, or engine state.
import assert from 'node:assert/strict';

const flightSnapshot = () => ({time:flightT,crashed,position:[P.pos.x+OX,P.pos.y,P.pos.z+OZ],velocity:P.vel.toArray(),
    radarAltitude:ralt,ias,pitch:pitchDeg,roll:rollDeg,gear:gearD,wheelsOn,landings,throttle:thr,targetThrottle:thrT,
    mode:stolMode,nozzle,liftFan:lfSpool,liftDoor:lfDoor,hoverTrim:hoverTrimPower(DRY+fuel).throttle,
    touchdown:{sink:stats.tdVs,score:stats.tdScore,grade:stats.tdGrade},paused});
export async function liveFlightState(page) { return page.evaluate(flightSnapshot); }
async function until(page,predicate,arg,timeout) {await page.waitForFunction(predicate,arg,{timeout});const s=await liveFlightState(page);assert.equal(s.crashed,false,'Aircraft crashed');return s;}

export async function takeoffWithKeyboard(page,{timeout=150000}={}) {
  const trace=[{event:'runway-start',state:await liveFlightState(page)}];
  // Read-only telemetry records the actual physics trajectory even if the pilot
  // times out before reaching its next milestone.
  await page.evaluate(`window.__qaTakeoffSnapshot=${flightSnapshot.toString()};
    window.__qaTakeoffSamples=[window.__qaTakeoffSnapshot()];
    window.__qaTakeoffTimer=setInterval(()=>{const s=window.__qaTakeoffSnapshot(),last=window.__qaTakeoffSamples.at(-1);if(s.time-last.time>=.25||s.crashed&&!last.crashed)window.__qaTakeoffSamples.push(s);},100);`);
  try {
  assert.ok(trace[0].state.gear>.9,'Runway takeoff requires gear down');
  await page.keyboard.press('p');trace.push({event:'parking-brake-release',state:await liveFlightState(page)});
  await page.keyboard.down('Shift');
  try{await until(page,()=>crashed||thrT>=.99,null,timeout);}finally{await page.keyboard.up('Shift');}
  trace.push({event:'full-throttle-command',state:await liveFlightState(page)});
  await until(page,()=>crashed||ias>=135,null,timeout);
  trace.push({event:'rotation-at-135-knots',state:await liveFlightState(page)});
  await page.keyboard.down('ArrowDown');
  try{await until(page,()=>crashed||pitchDeg>=12||ralt>6,null,timeout);}finally{await page.keyboard.up('ArrowDown');}
  trace.push({event:'release-pitch-at-12-degrees-or-6m',state:await liveFlightState(page)});
  await until(page,()=>crashed||(!wheelsOn&&ralt>=12),null,timeout);
  trace.push({event:'airborne-at-least-12m-AGL',state:await liveFlightState(page)});
  assert.ok(trace.at(-1).state.position.every(Number.isFinite));
  return {trace,samples:await page.evaluate(()=>window.__qaTakeoffSamples),method:'Configured runway spawn; P releases brake, Shift commands full throttle, ArrowDown starts rotation at135IAS and releases by12°pitch or6mAGL; actual physics must reach12mAGL off wheels. No rigid-state assignment. This is takeoff only, not a full circuit.'};
  }catch(error){error.evidence={trace,samples:await page.evaluate(()=>window.__qaTakeoffSamples).catch(()=>[]),final:await liveFlightState(page).catch(()=>null)};throw error;}
  finally {await page.keyboard.up('Shift').catch(()=>{});await page.keyboard.up('ArrowDown').catch(()=>{});await page.evaluate(()=>clearInterval(window.__qaTakeoffTimer)).catch(()=>{});}
}

export async function landHoverWithTouchThrottle(page,{timeout=180000}={}) {
  const initial=await liveFlightState(page),trace=[];
  try {
  assert.equal(initial.mode,'HOVER');assert.ok(initial.radarAltitude>15&&initial.gear>.9);
  const started=Date.now(),slider=await page.locator('#tthr').boundingBox();assert.ok(slider,'Throttle slider unavailable');
  while(Date.now()-started<timeout){
    const s=await liveFlightState(page);assert.equal(s.crashed,false,'Aircraft crashed during hover landing');
    if(s.wheelsOn&&s.landings>initial.landings){
      const target=.2,x=slider.x+slider.width*.5,y=slider.y+slider.height*(1-target);
      await page.touchscreen.tap(x,y);
      return {initial,trace,touchdown:s,method:'HOVER scenario start followed by actual descent. Every0.25simseconds a logged feedback test pilot taps the existing throttle slider. Desired descent ≤3m/s, slowing near ground; throttle = trim +(desiredVy-currentVy)*.035, bounded .3…1. No position/velocity/attitude/force assignment.'};
    }
    const desiredVy=-Math.min(3,Math.max(.35,(s.radarAltitude-2)*.18));
    const target=Math.min(1,Math.max(.3,s.hoverTrim+(desiredVy-s.velocity[1])*.035));
    const x=slider.x+slider.width*.5,y=slider.y+slider.height*(1-target);
    await page.touchscreen.tap(x,y);trace.push({state:s,desiredVy,commandThrottle:target});
    await until(page,t=>crashed||flightT>=t,s.time+.25,Math.min(30000,timeout));
  }
  const error=new Error('Hover descent did not reach a scored wheels-on touchdown within wall-time limit');
  error.evidence={initial,trace,final:await liveFlightState(page)};throw error;
  }catch(error){error.evidence=error.evidence||{initial,trace,final:await liveFlightState(page).catch(()=>null)};throw error;}
}

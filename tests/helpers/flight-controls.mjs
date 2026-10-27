// Functional test pilots. Commands go through existing keyboard/touch controls.
// These never assign aircraft position, velocity, attitude, force, or engine state.
import assert from 'node:assert/strict';

const flightSnapshot = () => ({time:flightT,crashed,position:[P.pos.x+OX,P.pos.y,P.pos.z+OZ],velocity:P.vel.toArray(),
    radarAltitude:ralt,ias,pitch:pitchDeg,roll:rollDeg,gear:gearD,wheelsOn,landings,throttle:thr,targetThrottle:thrT,
    rates:P.om.toArray(),forwardSpeed:P.vel.dot(new THREE.Vector3(0,0,-1).applyQuaternion(P.quat)),rightSpeed:P.vel.dot(new THREE.Vector3(1,0,0).applyQuaternion(P.quat)),
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

// QA quality targets, not aircraft certification limits.
export const landingCriteria={maxAbsRecordedSinkMps:3,maxAbsPitchDeg:10,maxAbsRollDeg:8,maxHorizontalSpeedMps:5,minimumScore:70};
function assertLandingQuality(s){
  assert.ok(Math.abs(s.touchdown.sink)<=landingCriteria.maxAbsRecordedSinkMps,'Recorded touchdown sink exceeds 3 m/s');
  assert.ok(Math.abs(s.pitch)<=landingCriteria.maxAbsPitchDeg,'Touchdown pitch exceeds 10 degrees');
  assert.ok(Math.abs(s.roll)<=landingCriteria.maxAbsRollDeg,'Touchdown roll exceeds 8 degrees');
  assert.ok(Math.hypot(s.velocity[0],s.velocity[2])<=landingCriteria.maxHorizontalSpeedMps,'Vertical landing horizontal speed exceeds 5 m/s');
  assert.ok(s.touchdown.score>=landingCriteria.minimumScore,'Touchdown score below 70');
}
function attitudeKeys(s,targetPitch,targetRoll=0){
  // Input signs read from physics(): ArrowDown => +el => +pitch moment;
  // ArrowRight => +ail => -body-Z rate => +displayed roll.
  const pitchDemand=(targetPitch-s.pitch)*.08-s.rates[0]*.8;
  const rollDemand=(targetRoll-s.roll)*.08+s.rates[2]*.8;
  return [pitchDemand>.08?'ArrowDown':pitchDemand<-.08?'ArrowUp':null,
    rollDemand>.08?'ArrowRight':rollDemand<-.08?'ArrowLeft':null].filter(Boolean);
}
async function setKeys(page,active,wanted){
  for(const key of [...active])if(!wanted.includes(key)){await page.keyboard.up(key);active.delete(key);}
  for(const key of wanted)if(!active.has(key)){await page.keyboard.down(key);active.add(key);}
}
async function clearKeys(page,active){for(const key of active)await page.keyboard.up(key).catch(()=>{});active.clear();}
async function throttleTap(page,slider,target){await page.touchscreen.tap(slider.x+slider.width*.5,slider.y+slider.height*(1-target));}

export async function landHoverWithTouchThrottle(page,{timeout=180000}={}) {
  const initial=await liveFlightState(page),trace=[],active=new Set();let touchdown=null,integral=0,lastTime=initial.time;
  const controlParameters={velocityPGain:.035,velocityIGain:.008,integralMin:-.08,integralMax:.08,simulationCadence:.2,maxDesiredDescent:2.2};
  try {
    assert.equal(initial.mode,'HOVER');assert.ok(initial.radarAltitude>15&&initial.gear>.9);
    const started=Date.now(),slider=await page.locator('#tthr').boundingBox();assert.ok(slider,'Throttle slider unavailable');
    while(Date.now()-started<timeout){
      const s=await liveFlightState(page);assert.equal(s.crashed,false,'Aircraft crashed during hover landing');
      if(s.wheelsOn&&s.landings>initial.landings){
        touchdown=s;await throttleTap(page,slider,.2);assertLandingQuality(s);
        return {initial,trace,touchdown:s,qualityCriteria:landingCriteria,controlParameters,method:'Configured HOVER start followed by actual descent. Every 0.2 simulated seconds, throttle feedback uses existing touch slider and pitch/roll feedback uses logged actual keyboard inputs. Pitch/roll targets also oppose observed horizontal body velocity. No rigid-state assignment.'};
      }
      const desiredVy=-Math.min(2.2,Math.max(.35,(s.radarAltitude-1.5)*.16));
      const targetPitch=Math.max(-10,Math.min(10,s.forwardSpeed*1.3));
      const targetRoll=Math.max(-8,Math.min(8,-s.rightSpeed*1.3));
      const keys=attitudeKeys(s,targetPitch,targetRoll);
      const velocityError=desiredVy-s.velocity[1],dt=Math.max(0,Math.min(.5,s.time-lastTime));lastTime=s.time;
      const previousIntegral=integral;
      integral=Math.max(controlParameters.integralMin,Math.min(controlParameters.integralMax,integral+velocityError*controlParameters.velocityIGain*dt));
      const unsaturated=s.hoverTrim+velocityError*controlParameters.velocityPGain+integral;
      // Conditional integration avoids winding up against the slider endpoints.
      if(unsaturated>1&&velocityError>0||unsaturated<.3&&velocityError<0)integral=previousIntegral;
      const target=Math.min(1,Math.max(.3,s.hoverTrim+velocityError*controlParameters.velocityPGain+integral));
      await setKeys(page,active,keys);await throttleTap(page,slider,target);
      trace.push({state:s,desiredVy,velocityError,integral,commandThrottle:target,targetPitch,targetRoll,keyboard:keys});
      await until(page,t=>crashed||flightT>=t,s.time+.2,Math.min(30000,timeout));
    }
    throw new Error('Hover descent did not reach a quality scored touchdown within wall-time limit');
  }catch(error){error.evidence={initial,trace,touchdown,qualityCriteria:landingCriteria,controlParameters,integral,final:await liveFlightState(page).catch(()=>null)};throw error;}
  finally{await clearKeys(page,active);}
}

export async function convertHoverWithControls(page,{timeout=150000}={}){
  const initial=await liveFlightState(page),trace=[],active=new Set();let conversionCommand=null,conventional=null,leveling=false,stableSince=null;
  const controlParameters={accelerationIAS:105,levelPitchTarget:8,minLevelPitch:4,maxLevelPitch:13,maxAbsPitchRollRate:.12,minVerticalVelocity:-2,minLevelAGL:50,minLevelIAS:95,stableSeconds:.6};
  const started=Date.now(),slider=await page.locator('#tthr').boundingBox();
  try{
    assert.equal(initial.mode,'HOVER');assert.ok(slider);
    while(Date.now()-started<timeout){
      const s=await liveFlightState(page);assert.equal(s.crashed,false,'Aircraft crashed during forward conversion');
      if(!conversionCommand&&s.ias>=105)leveling=true;
      const ready=leveling&&s.pitch>=4&&Math.abs(s.pitch-8)<=5&&Math.abs(s.rates[0])<=.12&&Math.abs(s.roll)<=8&&Math.abs(s.rates[2])<=.12&&s.velocity[1]>=-2&&s.radarAltitude>=50&&s.ias>=95;
      if(!conversionCommand){stableSince=ready?(stableSince??s.time):null;if(stableSince!==null&&s.time-stableSince>=.6){await page.keyboard.press('v');conversionCommand=s;}}
      if(conversionCommand&&s.mode==='CONV'&&!conventional)conventional=s;
      if(conventional&&s.time>=conventional.time+5){
        assert.ok(s.radarAltitude>=25,'Conversion did not retain 25m AGL');
        assert.ok(s.velocity[1]>=-5,'Conversion descent exceeds 5m/s');
        assert.ok(s.ias>=100,'Conversion endpoint below 100IAS');
        assert.ok(Math.abs(s.roll)<=15&&Math.abs(s.pitch)<=25,'Conversion attitude exceeds QA bounds');
        return {initial,trace,conversionCommand,conventional,endpointRecovery:s,controlParameters,qualityCriteria:{minimumAGL:25,maximumDescentMps:5,minimumIAS:100,assessmentDelaySeconds:5,maxAbsRoll:15,maxAbsPitch:25},method:'Existing touch throttle and keyboard pitch/roll controls accelerate from configured hover to105IAS, then level within4–13 degrees pitch with bounded rates for0.6simsec,vy≥−2,AGL≥50,IAS≥95 before actual V conversion command, then assess recovery at the five-simulated-second endpoint after CONV; continuous interval bounds are not asserted. No rigid-state assignment.'};
      }
      const targetPitch=conversionCommand||leveling?8:-16,targetRoll=Math.max(-8,Math.min(8,-s.rightSpeed));
      const keys=attitudeKeys(s,targetPitch,targetRoll);
      const target=conversionCommand?1:Math.min(1,Math.max(.5,s.hoverTrim+.04+(initial.radarAltitude-s.radarAltitude)*.012-s.velocity[1]*.035));
      await setKeys(page,active,keys);await throttleTap(page,slider,target);
      trace.push({state:s,phase:conversionCommand?'convert-and-recover':leveling?'level-before-conversion':'hover-acceleration',stableSince,readyForConversion:ready,commandThrottle:target,targetPitch,targetRoll,keyboard:keys,conversionKey:conversionCommand&&s===conversionCommand?'V':null});
      await until(page,t=>crashed||flightT>=t,s.time+.2,Math.min(30000,timeout));
    }
    throw new Error('Control-only conversion pilot did not reach the bounded recovery endpoint before wall-time limit');
  }catch(error){error.evidence={initial,trace,conversionCommand,conventional,controlParameters,final:await liveFlightState(page).catch(()=>null)};throw error;}
  finally{await clearKeys(page,active);}
}

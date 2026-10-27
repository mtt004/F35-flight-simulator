import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { browserSession, startFlight } from '../tests/helpers/browser.mjs';
import { takeoffWithKeyboard, landHoverWithTouchThrottle, convertHoverWithControls } from '../tests/helpers/flight-controls.mjs';
import { repositoryRoot } from '../tests/helpers/source.mjs';

const args = process.argv.slice(2);
const pilotBudgetArg=args.find(a=>a.startsWith('--pilot-budget='));
const pilotBudgetSeconds=pilotBudgetArg?Number(pilotBudgetArg.split('=')[1]):null;
if(pilotBudgetSeconds!==null&&(!Number.isFinite(pilotBudgetSeconds)||pilotBudgetSeconds<=0))throw Error('Pilot budget must be positive seconds');
const pilotDeadline=pilotBudgetSeconds===null?Infinity:Date.now()+pilotBudgetSeconds*1000;
const pilotTimeout=maximum=>Math.max(1,Math.min(maximum,pilotDeadline-Date.now()));
const source = path.resolve(args.find(a => !a.startsWith('--')) || 'dist/index.html');
const nameArg = args.find(a => a.startsWith('--label='));
const label = nameArg ? nameArg.slice(8) : 'flight-lifecycle';
if (!/^[a-z0-9-]+$/i.test(label)) throw Error('Report label must contain letters, digits or hyphens');
const hash = createHash('sha256').update(await readFile(source)).digest('hex');
const output = path.join(repositoryRoot, 'benchmarks/next', label + '-' + hash.slice(0,12) + '.json');
const report = { date: new Date().toISOString(), source: path.relative(repositoryRoot, source), sourceSha256: hash,
  referenceMainCommit: 'c53506ad59e7aad46904c3a648b0f06d6015dafd', pilotBudgetSeconds, environment: null, segments:[], checks: [], status: 'NOT TESTED',
  limitations: ['Cloud Chromium/SwiftShader functional tests; not Galaxy A51 evidence.',
    'Normal UI start/scenario selection may position an aircraft at its configured spawn; tests label such starts. No lifecycle is inferred from teleporting aircraft state.',
    'Replay stop is observed synchronously using a wrapper that calls the original function unchanged, before any later live physics step.',
    'No Android installation, gyro, battery or thermal claim.'] };
let session;
let page;
const readState = () => ({ running, paused, crashed, replayActive, simT, flightT, stepCount,
  pos: [P.pos.x + OX, P.pos.y, P.pos.z + OZ], localPos: P.pos.toArray(), vel: P.vel.toArray(), quat: P.quat.toArray(), om: P.om.toArray(),
  fuel, thr, thrT, N1, N2, abSpool, gearD, gearT, parkBrake, stolMode, lfDoor, lfSpool, nozzle,
  camMode, ias, mach, gNz, ralt, pitchDeg, rollDeg, hdgDeg, wheelsOn, landings,
  replayFrames: replayFrames.length, touchdown: { sink: stats.tdVs, score: stats.tdScore, grade: stats.tdGrade },
  seed: SEED, weather: wxPreset,
  bank, basis:{forward:_fwd.toArray(),up:_up.toArray(),right:_rgt.toArray()},
  view:{aircraft:{position:ac.position.toArray(),quaternion:ac.quaternion.toArray(),visible:ac.visible},
    cockpit:{position:cockpitGrp.position.toArray(),quaternion:cockpitGrp.quaternion.toArray(),visible:cockpitGrp.visible},
    glassVisible:AC_SURF.cockpitGlass?.visible,
    camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,
      trackPosition:camTrackPos.toArray(),filteredPosition:camPos.toArray(),lookPosition:camLook.toArray()},
    pauseMenu:{visible:document.getElementById('pauseOv').classList.contains('on'),ariaHidden:document.getElementById('pauseOv').getAttribute('aria-hidden')},
    replayButtonActive:document.getElementById('btnReplay').classList.contains('replay-live')} });
async function state() { return page.evaluate(readState); }
function closeNumber(a, b, tolerance = 1e-8, field = '') { assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= tolerance, `${field}: ${a} != ${b}`); }
function sameVector(a,b,field) { assert.equal(a.length,b.length,field); a.forEach((v,i) => closeNumber(v,b[i],1e-8,`${field}[${i}]`)); }
// Independent quaternion-vector rotation; do not call the simulator's attitude or
// camera update functions to make evidence self-consistent before asserting it.
function rotated(vector, q) {
  const [x,y,z,w]=q,[vx,vy,vz]=vector;
  const tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);
  return [vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx];
}
function assertGeometry(s, label) {
  const forward=rotated([0,0,-1],s.quat),up=rotated([0,1,0],s.quat),right=rotated([1,0,0],s.quat);
  const degrees=180/Math.PI,clamp=v=>Math.max(-1,Math.min(1,v));
  closeNumber(s.pitchDeg,Math.asin(clamp(forward[1]))*degrees,1e-8,label+'.pitch from quaternion');
  closeNumber(s.rollDeg,-Math.asin(clamp(right[1]))*degrees,1e-8,label+'.roll from quaternion');
  closeNumber(s.hdgDeg,((Math.atan2(forward[0],-forward[2])*degrees)%360+360)%360,1e-8,label+'.heading from quaternion');
  closeNumber(s.bank,s.rollDeg/degrees,1e-8,label+'.bank radians');
  for(const [field,expected]of Object.entries({forward,up,right}))sameVector(s.basis[field],expected,label+'.basis.'+field);
  for(const field of ['aircraft','cockpit']) {
    sameVector(s.view[field].position,s.localPos,label+'.'+field+'.position');
    sameVector(s.view[field].quaternion,s.quat,label+'.'+field+'.quaternion');
  }
  assert.equal(s.view.aircraft.visible,!s.crashed&&s.camMode!==1,label+'.aircraft visibility');
  assert.equal(s.view.cockpit.visible,!s.crashed&&s.camMode===1,label+'.cockpit visibility');
  assert.equal(s.view.glassVisible,s.crashed||s.camMode!==1,label+'.glass visibility');
  for(const v of [...s.view.camera.position,...s.view.camera.quaternion,s.view.camera.fov])assert.ok(Number.isFinite(v),label+'.finite camera');
  closeNumber(Math.hypot(...s.view.camera.quaternion),1,1e-8,label+'.unit camera quaternion');
  return {expectedBasis:{forward,up,right},expectedAngles:{pitch:Math.asin(clamp(forward[1]))*degrees,roll:-Math.asin(clamp(right[1]))*degrees}};
}
async function check(name, fn) {
  const started = Date.now();
  try { const details = await fn(); report.checks.push({ name, status: 'PASS', wallSeconds: (Date.now()-started)/1000, details }); console.log('PASS',name); }
  catch(error) { report.checks.push({ name, status: 'FAIL', wallSeconds: (Date.now()-started)/1000, error: String(error), evidence:error.evidence || null, state: page ? await state().catch(() => null) : null }); console.log('FAIL',name,String(error)); }
  await mkdir(path.dirname(output), {recursive:true}); await writeFile(output, JSON.stringify(report,null,2)+'\n');
}
async function advanceSim(seconds, timeout = 90000) {
  const target = (await state()).flightT + seconds;
  await page.waitForFunction(t => crashed || flightT >= t, target, {timeout});
  assert.equal((await state()).crashed,false,'Aircraft crashed while advancing physics');
}
async function attachObservers(target) {
  await target.evaluate(`window.__flightQaState = ${readState.toString()}`);
  target.on('pageerror', e => session.errors.push(String(e)));
  await target.route('**/*', async route => {
    const url = route.request().url();
    if(url.startsWith(session.origin+'/') || url.startsWith('blob:') || url.startsWith('data:')) await route.continue();
    else { session.errors.push('External dependency: '+url); await route.abort(); }
  });
}
try {
  session = await browserSession({file:source,mobile:true}); page=session.page; report.environment=session.environment;
  await page.setViewportSize({width:640,height:360});
  await attachObservers(page);
  await page.evaluate(() => { const select=document.getElementById('lightningProfile'); if(select){select.value='BATTERY';select.dispatchEvent(new Event('change',{bubbles:true}));} });
  report.runSettings={viewport:[640,360],profile:'BATTERY',softwareRenderer:true};
  if(!args.includes('--flight-only')) {
  await check('normal save → UI respawn → new launch UI Continue restores exact saved state', async () => {
    await startFlight(page,{start:'AIR'}); await advanceSim(1);
    await page.keyboard.press('c'); await page.keyboard.press('Escape');
    const saved=await page.evaluate(() => {savePrefs(true); return JSON.parse(JSON.stringify(SAVED.flight));});
    report.validSavedPayload=await page.evaluate(()=>JSON.parse(localStorage.getItem(SAVE_KEY)));
    assert.ok(saved.pos.every(Number.isFinite));
    await page.locator('#btnRestart').click(); await advanceSim(.2); await page.keyboard.press('Escape');
    const respawned=await state(); assert.ok(Math.abs(respawned.flightT-saved.flightT)>.1,'Respawn did not reset flight time');
    const previousPage=page;
    page=await session.context.newPage(); await page.setViewportSize({width:640,height:360});
    await page.goto(previousPage.url(),{waitUntil:'load',timeout:120000});
    await page.waitForFunction(() => window.__F35B_SIM__,null,{timeout:120000}); await attachObservers(page);
    await page.evaluate(() => document.getElementById('continue').addEventListener('click',()=>{window.__qaContinued=window.__flightQaState();}));
    await page.locator('#continue').click();
    const restored=await page.evaluate(() => window.__qaContinued);
    await previousPage.close();
    assert.ok(restored.running&&!restored.paused&&!restored.crashed);
    for(const field of ['pos','vel','quat','om']) sameVector(saved[field],restored[field],field);
    for(const field of ['fuel','thr','thrT','N1','N2','abSpool','gearD','gearT','lfDoor','lfSpool','nozzle','simT','flightT','camMode']) closeNumber(saved[field],restored[field],1e-8,field);
    assert.equal(restored.stolMode,saved.stolMode); assert.equal(restored.parkBrake,saved.parkBrake);
    return {saved,respawned,restored,method:'Saved via actual savePrefs; pause Restart button, separate same-origin page retaining localStorage, actual Continue button click. Captured in same click after restore before physics.'};
  });
  await check('natural replay completion restores paused live flight and every playback-mutated field', async () => {
    if((await state()).paused)await page.keyboard.press('Escape');
    await advanceSim(2.2); await page.keyboard.press('g');
    await page.keyboard.down('Shift'); await advanceSim(1.6); await page.keyboard.up('Shift');
    await page.keyboard.down('ArrowDown');
    try {await advanceSim(.5);}finally{await page.keyboard.up('ArrowDown');}
    await page.keyboard.press('Escape');
    await page.evaluate(()=>savePrefs(true));
    const prepared=await state(); assert.ok(prepared.replayFrames>=24,'Replay has less than 2 seconds of actual physics data'); assert.equal(prepared.paused,true);
    await page.evaluate(() => {
      const originalStop=stopReplay;
      window.__qaReplayAttempts=[];
      document.getElementById('btnReplay').addEventListener('click',()=>{const observed=window.__flightQaState();window.__qaReplayAttempts.push(observed);if(!replayActive)window.__qaReplayStarted=observed;},true);
      stopReplay=function(...args){const result=originalStop.apply(this,args);window.__qaReplayStopped=window.__flightQaState();return result;};
    });
    await page.locator('#btnReplay').click();
    await page.waitForFunction(() => replayActive,null,{timeout:15000});
    await page.waitForTimeout(350); const playback=await state();
    const before=await page.evaluate(()=>window.__qaReplayStarted);
    assert.ok(playback.replayActive,'Playback not active');
    report.replaySaveEvidence=await page.evaluate(()=>{const before=JSON.stringify(SAVED.flight);savePrefs(true);return{before,after:JSON.stringify(SAVED.flight),stored:JSON.stringify(JSON.parse(localStorage.getItem(SAVE_KEY)).flight),replayActive};});
    // Reopen the actual pause menu during playback, then click Replay again.
    // Observe snapshot identity/clock; the second call must not replace the live
    // flight restore snapshot with a playback pose.
    await page.keyboard.press('Escape');
    const doubleBefore=await page.evaluate(()=>({restore:JSON.stringify(replayRestore),wall:replayWall,clock:replayClock}));
    await page.locator('#btnReplay').click();
    const doubleAfter=await page.evaluate(()=>({restore:JSON.stringify(replayRestore),wall:replayWall,clock:replayClock,attempts:window.__qaReplayAttempts.length}));
    report.replayDoubleClickEvidence={before:doubleBefore,after:doubleAfter,method:'Keyboard Escape reopens actual pause menu during playback; actual visible Replay button is clicked a second time.'};
    assert.equal(doubleAfter.attempts,2,'Second actual Replay UI click was not observed');
    assert.equal(doubleAfter.restore,doubleBefore.restore,'Second Replay click replaced original live snapshot');
    assert.equal(doubleAfter.wall,doubleBefore.wall,'Second Replay click reset replay start time');
    assert.ok(doubleAfter.clock>=doubleBefore.clock,'Second Replay click reset replay clock');
    await page.waitForFunction(() => window.__qaReplayStopped,null,{timeout:90000});
    const after=await page.evaluate(() => window.__qaReplayStopped);
    const changed={};
    for(const field of ['thr','gearD','nozzle','ias','mach','gNz','paused','pitchDeg','rollDeg','hdgDeg']) if(before[field]!==after[field])changed[field]={before:before[field],after:after[field]};
    const evidence={prepared,before,playback,after,changed,method:'Real recorded frames and keyboard pitch input; actual UI replay button; capture-phase Replay UI listener and unchanged-call stop wrapper capture synchronous pre-start and post-stop state. No camera input follows pre-start capture. Natural completion is observed before the next live physics step. Geometry assertions independently rotate canonical axes by the rigid quaternion.'};
    // Preserve full failure evidence before assertions, including several mutations.
    report.replayEvidence=evidence;
    for(const field of ['pos','vel','quat','om'])sameVector(before[field],after[field],field);
    for(const field of ['thr','gearD','nozzle','ias','mach','gNz','camMode','fuel','flightT','simT','pitchDeg','rollDeg','hdgDeg','bank'])closeNumber(before[field],after[field],1e-8,field);
    assert.equal(after.paused,before.paused,'Replay changed the pre-playback pause state'); assert.equal(after.replayActive,false);
    evidence.geometry={before:assertGeometry(before,'before replay'),after:assertGeometry(after,'after replay')};
    for(const field of ['forward','up','right'])sameVector(before.basis[field],after.basis[field],'restored basis.'+field);
    // This comparison is valid only because the pilot supplies no camera/head-look
    // input between the synchronous pre-start and post-stop observations.
    for(const field of ['position','quaternion'])sameVector(before.view.camera[field],after.view.camera[field],'restored camera.'+field);
    closeNumber(before.view.camera.fov,after.view.camera.fov,1e-8,'restored camera fov');
    sameVector(after.view.camera.trackPosition,after.localPos,'restored camera tracks live aircraft');
    for(const field of ['filteredPosition','lookPosition'])assert.ok(after.view.camera[field].every(Number.isFinite),'restored camera '+field+' finite');
    assert.deepEqual(after.view.aircraft,before.view.aircraft,'restored aircraft transform/visibility');
    assert.deepEqual(after.view.cockpit,before.view.cockpit,'restored cockpit transform/visibility');
    assert.equal(after.view.glassVisible,before.view.glassVisible);
    assert.equal(after.view.pauseMenu.visible,true,'Paused live view must be restored synchronously');
    assert.equal(after.view.pauseMenu.ariaHidden,'false','Pause accessibility state must be restored');
    assert.equal(after.view.replayButtonActive,false,'Replay UI state must clear');
    return evidence;
  });
  await check('autosave during real replay preserves last valid live-flight record',async()=>{
    const e=report.replaySaveEvidence;assert.ok(e&&e.replayActive,'Replay save was not observed');
    assert.equal(e.before,e.after);assert.equal(e.before,e.stored);return e;
  });
  for(const kind of ['empty-velocity','numeric-string-position','zero-quaternion'])await check(`malformed save ${kind} is rejected before world/state mutation with recovery UI`,async()=>{
    assert.ok(report.validSavedPayload,'Normal save prerequisite unavailable');
    const payload=structuredClone(report.validSavedPayload);payload.flight.seed=4302;
    if(kind==='empty-velocity')payload.flight.vel=[];
    if(kind==='numeric-string-position')payload.flight.pos[0]=String(payload.flight.pos[0]);
    if(kind==='zero-quaternion')payload.flight.quat=[0,0,0,0];
    await page.evaluate(p=>localStorage.setItem(SAVE_KEY,JSON.stringify(p)),payload);
    const old=page;page=await session.context.newPage();await page.setViewportSize({width:640,height:360});
    await page.goto(old.url(),{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__F35B_SIM__,null,{timeout:120000});await attachObservers(page);await old.close();
    await page.evaluate(()=>{
      const capture=()=>({state:window.__flightQaState(),world:window.__F35B_SIM__.world,origin:[OX,OZ]});
      document.getElementById('continue').addEventListener('click',()=>{window.__qaRejectedBefore=capture();},true);
      document.getElementById('continue').addEventListener('click',()=>{window.__qaRejectedAfter=capture();window.__qaRejectedMessage=document.getElementById('toast').textContent;});
    });
    await page.locator('#continue').click();
    const result=await page.evaluate(()=>({before:window.__qaRejectedBefore,after:window.__qaRejectedAfter,message:window.__qaRejectedMessage}));
    assert.deepEqual(result.after,result.before);assert.equal(result.after.state.running,false);assert.match(result.message,/INVALID SAVED FLIGHT.*START NEW OR CLEAR SAVED DATA/);
    assert.ok(await page.locator('#start').isVisible());assert.ok(await page.locator('#resetSave').isVisible());
    // Reset Saved Data lives inside the advanced drawer, not on the boot menu.
    // Exercise the offered Start New recovery first, then clear via Settings.
    await page.locator('#start').click();
    if(await page.locator('#helpOv').isVisible())await page.locator('#btnHelpTopClose').click();
    await advanceSim(.15);assert.ok((await state()).running);
    await page.locator('#btnSet').click();await page.locator('#resetSave').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem(SAVE_KEY)),null);
    await page.locator('#btnDrawerClose').click();
    return {...result,recovery:'Actual Start New, then Settings → Reset Saved Data buttons succeeded'};
  });
  }
  let hasScenario=!args.includes('--flight-only');
  async function freshScenario(scenarioName) {
    assert.ok(Date.now()<pilotDeadline,'Shared control-pilot wall budget exhausted');
    if(hasScenario){await session.close();report.segments.push({errors:[...session.errors],warnings:[...session.warnings]}); session=await browserSession({file:source,mobile:true});page=session.page;}
    hasScenario=true;
    await page.setViewportSize({width:640,height:360});await attachObservers(page);
    await page.evaluate(() => {const e=document.getElementById('lightningProfile');e.value='BATTERY';e.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.locator('#selFuel').selectOption('0.35');
    await page.locator('#selScen').selectOption(scenarioName);await page.locator('#start').click();
    await page.waitForFunction(() => running&&!paused,null,{timeout:30000});
  }
  if(args.includes('--extended')) {
    await check('actual controlled hover acceleration and conversion meets five-second recovery endpoint', async () => {
      await freshScenario('HOVER PRACTICE');
      return convertHoverWithControls(page,{timeout:pilotTimeout(pilotBudgetSeconds===null?150000:100000)});
    });
  } else report.checks.push({name:'complete hover forward-conversion scenario',status:'NOT TESTED',reason:'Extended automated flight control is opt-in (--extended); basic save/replay tests do not establish a complete flight lifecycle.'});
  if(args.includes('--takeoff')) await check('actual runway acceleration and liftoff through keyboard inputs',async()=>{
    await freshScenario('CONVENTIONAL TAKEOFF');
    await page.waitForFunction(()=>wheelsOn||crashed,null,{timeout:30000});
    return takeoffWithKeyboard(page);
  });
  else report.checks.push({name:'conventional runway takeoff',status:'NOT TESTED',reason:'Run with --takeoff; no takeoff is inferred from an airborne spawn.'});
  if(args.includes('--hover-landing')) await check('actual controlled hover descent to quality scored vertical touchdown',async()=>{
    await freshScenario('HOVER PRACTICE');await advanceSim(2);
    return landHoverWithTouchThrottle(page,{timeout:pilotTimeout(180000)});
  });
  else report.checks.push({name:'vertical landing from hover scenario',status:'NOT TESTED',reason:'Run with --hover-landing; a configured hover spawn does not establish a landing.'});
  report.errors=[...report.segments.flatMap(s=>s.errors),...session.errors]; report.warnings=[...report.segments.flatMap(s=>s.warnings),...session.warnings];
  report.status=report.checks.some(c=>c.status==='FAIL')||report.errors.length?'FAIL':'PASS';
} catch(error) {report.status='BLOCKED';report.blocker=String(error);process.exitCode=1;}
finally {if(session)await session.close();await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({report:path.relative(repositoryRoot,output),status:report.status,passed:report.checks.filter(c=>c.status==='PASS').length,failed:report.checks.filter(c=>c.status==='FAIL').length,sourceSha256:hash},null,2));
if(report.status!=='PASS')process.exitCode=1;

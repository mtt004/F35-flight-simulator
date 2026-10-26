import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { browserSession, snapshot, startFlight } from '../tests/helpers/browser.mjs';
import { repositoryRoot, baselineFile } from '../tests/helpers/source.mjs';

const file = path.resolve(process.argv[2] || baselineFile);
const label = file.includes('/legacy/') ? 'baseline' : 'final';
const reportFile = path.join(repositoryRoot, `benchmarks/${label}/browser-tests.json`);
const report = { date: new Date().toISOString(), source: path.relative(repositoryRoot, file), environment: null,
  checks: [], status: 'NOT TESTED', note: 'Real Galaxy A51 installation, PSS, battery and thermals are NOT TESTED.' };
let session;
async function check(name, fn) {
  try { const details = await fn(); report.checks.push({ name, status: 'PASS', details }); }
  catch (error) { report.checks.push({ name, status: 'FAIL', error: String(error) }); }
}
try {
  session = await browserSession({ file, mobile: true }); report.environment = session.environment;
  const { page } = session;
  await check('built-in equation validation', async () => {
    const result = await page.evaluate(() => window.__F35B_SIM__.runValidation());
    assert.equal(result.passed, result.total, JSON.stringify(result.tests.filter(t => !t.pass)));
    return result;
  });
  await check('flight starts offline and executes fixed physics steps', async () => {
    await startFlight(page); const a = await snapshot(page); await page.waitForTimeout(1500); const b = await snapshot(page);
    assert.ok(b.running && !b.paused && !b.crashed); assert.ok(b.stepCount > a.stepCount);
    assert.ok([...b.position, ...b.velocity, ...b.quaternion, b.fuel].every(Number.isFinite));
    return { before: a, after: b };
  });
  await check('pause stops flight time and resume restarts it', async () => {
    await page.keyboard.press('Escape'); const a = await snapshot(page); assert.ok(a.paused);
    await page.waitForTimeout(500); const b = await snapshot(page); assert.equal(a.flightT, b.flightT);
    await page.locator('#btnResume').click();
    await page.waitForFunction(t => !paused && flightT > t, b.flightT, {timeout:15000}); const c = await snapshot(page);
    assert.ok(!c.paused && c.flightT > b.flightT); return { pausedTime: b.flightT, resumedTime: c.flightT };
  });
  await check('camera and instrumentation controls respond', async () => {
    const a = await snapshot(page); await page.keyboard.press('c'); const b = await snapshot(page); assert.notEqual(a.camMode, b.camMode);
    const before = await page.evaluate(() => S.hmds); await page.keyboard.press('h');
    assert.notEqual(await page.evaluate(() => S.hmds), before); return { camera: b.camMode };
  });
  await check('touch stick receives pointer input and releases cleanly', async () => {
    const rect = await page.locator('#tstick').boundingBox(); assert.ok(rect);
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * .7, rect.y + rect.height * .4); await page.mouse.up();
    const axes = await page.evaluate(() => ({ el: tch.el, ail: tch.ail })); assert.equal(axes.el, 0); assert.equal(axes.ail, 0); return axes;
  });
  await check('save retains finite state and settings', async () => {
    await page.evaluate(() => savePrefs(true));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(SAVE_KEY)));
    assert.ok(saved.flight.pos.every(Number.isFinite)); assert.equal(saved.seed, 4201); return { seed: saved.seed, flight: !!saved.flight };
  });
  await check('STOVL hover and conversion stay finite', async () => {
    await page.evaluate(() => { startType = 'HOVER'; scenario = 'HOVER PRACTICE'; respawn(); });
    await page.waitForTimeout(1200); const hover = await snapshot(page);
    assert.ok(!hover.crashed && hover.stolMode === 'HOVER' && hover.nozzle > 80);
    await page.keyboard.press('v'); await page.waitForTimeout(1200); const converted = await snapshot(page);
    assert.ok([...converted.position, ...converted.velocity, ...converted.quaternion].every(Number.isFinite));
    assert.ok(!converted.crashed); return { hover, converted };
  });
  await check('context loss is recoverable', async () => {
    const supported = await page.evaluate(() => {
      const ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (!ext) return false;
      window.__qaContext = ext; ext.loseContext(); setTimeout(() => ext.restoreContext(), 300); return true;
    });
    assert.ok(supported, 'WEBGL_lose_context unavailable'); await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => renderer.getContext().isContextLost()), false);
    assert.ok((await snapshot(page)).renderer.calls > 0);
  });
  await check('no unexpected JavaScript or shader errors and no remote resources', async () => {
    assert.deepEqual(session.errors, []); return { requests: session.requests.length, errors: session.errors, warnings: session.warnings };
  });
  report.status = report.checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) { report.status = 'BLOCKED'; report.blocker = String(error); process.exitCode = 1; }
finally {
  if (session) await session.close();
  await mkdir(path.dirname(reportFile), { recursive: true }); await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ report: path.relative(repositoryRoot, reportFile), status: report.status, passed: report.checks.filter(x => x.status === 'PASS').length, total: report.checks.length, blocker: report.blocker }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { browserSession, snapshot, startFlight, captureScene } from '../tests/helpers/browser.mjs';
import { repositoryRoot, baselineFile } from '../tests/helpers/source.mjs';

const args = process.argv.slice(2);
const file = path.resolve(args.find(a => !a.startsWith('--') && !/^\d+$/.test(a)) || baselineFile);
const label = file.includes('/legacy/') ? 'baseline' : 'final';
const seconds = Number(args[args.indexOf('--seconds') + 1]) || 30;
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 7200) throw new Error('Benchmark seconds must be 1…7200');
const scenarios = [
  { name: 'runway-takeoff', start: 'RUNWAY', scenarioName: 'CONVENTIONAL TAKEOFF', camera: 0 },
  { name: 'high-altitude', start: 'AIR', camera: 0, altitude: 9000 },
  { name: 'countryside', start: 'AIR', scenarioName: 'LOW-LEVEL NAVIGATION', camera: 0 },
  { name: 'airport-approach', start: 'AIR', scenarioName: 'ILS APPROACH', camera: 1 },
  { name: 'heavy-weather', start: 'AIR', weather: 'bkn', camera: 0 },
  { name: 'stovl-hover', start: 'HOVER', scenarioName: 'HOVER PRACTICE', camera: 0 },
  { name: 'night-approach', start: 'AIR', hour: 23.3, scenarioName: 'NIGHT LANDING', camera: 1 },
];
if (args.includes('--sustained')) scenarios.splice(0, scenarios.length, { name: 'sustained-flight', start: 'AIR', camera: 0, altitude: 5000 });
const sourceSha256=createHash('sha256').update(await readFile(file)).digest('hex');
const report = { sourceSha256, host:{cpu:os.cpus()[0]?.model,logicalCpuCount:os.cpus().length,platform:os.platform(),arch:os.arch()}, date: new Date().toISOString(), source: path.relative(repositoryRoot, file), status: 'NOT TESTED', secondsPerScenario: seconds,
  methodology: '1280×720 CSS viewport, DPR 1, fixed seed 4201, MED baseline/default final. Frame durations are intervals between actual renderer.render calls after 3s warm-up. CPU render submission duration is synchronous JS wall time, not GPU execution time. 1% low = 1000 / mean slowest ceil(1%) frame intervals. Browser heap is not Android PSS.',
  realDeviceStatus: 'NOT TESTED', androidPssMb: null, gpuTimeMs: null, battery: null, thermal: null, inputLatencyMs: null, scenarios: [] };
const outDir = path.join(repositoryRoot, `benchmarks/${label}`), shotDir = path.join(repositoryRoot, `screenshots/${label === 'baseline' ? 'before' : 'after'}`);
let session;
const percentile = (array, p) => array.length ? array[Math.min(array.length - 1, Math.ceil(array.length * p) - 1)] : null;
try {
  session = await browserSession({ file }); report.environment = session.environment;
  const { page } = session;
  await startFlight(page, { start: 'PARK' });
  await mkdir(shotDir, { recursive: true }); await mkdir(outDir, { recursive: true });
  const visualScenes = [
    { name: 'parked', start: 'PARK', camera: 2 },
    { name: 'cockpit', start: 'PARK', camera: 1 },
    { name: 'chase', start: 'AIR', camera: 0 },
    { name: 'hover', start: 'HOVER', camera: 2 },
    { name: 'sunset', start: 'AIR', camera: 0, hour: 18.3 },
    { name: 'overcast', start: 'AIR', camera: 0, weather: 'bkn' },
    { name: 'night', start: 'AIR', camera: 1, hour: 23.3 },
  ];
  for (const scene of visualScenes) {
    await captureScene(page, scene); await page.screenshot({ path: path.join(shotDir, scene.name + '.png') });
  }
  await writeFile(path.join(shotDir, 'capture-settings.json'), JSON.stringify({ sourceSha256, environment: report.environment, seed: 4201, scenes: visualScenes, note: 'Actual simulator captures, 1.5 seconds after respawn. Aircraft is not frozen; compare silhouette/materials rather than exact pixel positions.' }, null, 2) + '\n');
  await page.evaluate(() => {
    const original = renderer.render.bind(renderer);
    window.__benchmark = { active: false, previous: null, intervals: [], submissions: [], frames: 0 };
    renderer.render = (...args) => {
      const b = window.__benchmark, now = performance.now();
      if (b.active && b.previous !== null) b.intervals.push(now - b.previous);
      if (b.active) b.previous = now;
      const start = performance.now(); original(...args);
      if (b.active) { b.submissions.push(performance.now() - start); b.frames++; }
    };
  });
  for (const scenario of scenarios) {
    await captureScene(page, scenario);
    if (scenario.name === 'runway-takeoff') await page.evaluate(() => { parkBrake = false; thrT = 1; });
    if (scenario.altitude) await page.evaluate(y => { P.pos.y = y; AP.mode = 'HDG'; AP.alt = y; AP.hdg = hdgDeg; AP.spd = 150; }, scenario.altitude);
    await page.waitForTimeout(3000);
    const before = await snapshot(page);
    await page.evaluate(() => Object.assign(window.__benchmark, { active: true, previous: null, intervals: [], submissions: [], frames: 0 }));
    await page.waitForTimeout(seconds * 1000);
    const samples = await page.evaluate(() => { window.__benchmark.active = false; return { ...window.__benchmark, heapBytes: performance.memory?.usedJSHeapSize ?? null }; });
    const after = await snapshot(page), sorted = samples.intervals.slice().sort((a, b) => a - b), sum = sorted.reduce((a, b) => a + b, 0);
    const worst = sorted.slice(-Math.max(1, Math.ceil(sorted.length * .01))), worstMean = worst.reduce((a,b) => a+b, 0) / worst.length;
    const item = { name: scenario.name, settings: scenario, status: after.crashed ? 'CRASHED DURING SCENARIO' : sorted.length ? 'MEASURED' : 'NO FRAMES',
      frames: samples.frames, meanFps: sorted.length * 1000 / sum, medianFps: 1000 / percentile(sorted, .5), onePercentLowFps: 1000 / worstMean,
      frameMs: { p50: percentile(sorted, .5), p95: percentile(sorted, .95), p99: percentile(sorted, .99) },
      renderSubmissionMs: { mean: samples.submissions.reduce((a,b) => a+b, 0) / samples.submissions.length },
      stuttersOver100ms: sorted.filter(x => x > 100).length, heapBytes: samples.heapBytes, before, after, samples };
    report.scenarios.push(item);
    await writeFile(path.join(outDir, scenario.name + '.json'), JSON.stringify(item, null, 2) + '\n');
    console.log(scenario.name, item.meanFps.toFixed(2), 'FPS', item.status);
  }
  report.errors = session.errors; report.warnings = session.warnings;
  report.status = session.errors.length || report.scenarios.some(s => s.status !== 'MEASURED') ? 'FAIL' : 'MEASURED';
} catch (error) { report.status = 'BLOCKED'; report.blocker = String(error); process.exitCode = 1; }
finally {
  if (session) await session.close();
  await mkdir(outDir, { recursive: true }); await writeFile(path.join(outDir, 'benchmark-report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ report: path.relative(repositoryRoot, path.join(outDir, 'benchmark-report.json')), status: report.status, scenarios: report.scenarios.length, blocker: report.blocker }, null, 2));
if (!['MEASURED'].includes(report.status)) process.exitCode = 1;

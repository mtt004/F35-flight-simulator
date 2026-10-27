import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadPlaywright, snapshot } from '../tests/helpers/browser.mjs';

// Exercise the distributable through file:// with networking disabled, without a web server.
const file = path.resolve(process.argv[2] || 'dist/Lightning-F35B.html');
const report = { date: new Date().toISOString(), sourceSha256: createHash('sha256').update(await readFile(file)).digest('hex'),
  environment: 'Cloud Chromium; file URL; browser network offline; NOT Galaxy A51', status: 'FAIL', remoteRequests: [], errors: [] };
const playwright = await loadPlaywright();
const browser = await playwright.chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined,
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try {
  const context = await browser.newContext({offline:true, viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page = await context.newPage();
  page.on('pageerror',error=>report.errors.push(String(error)));
  page.on('request',request=>{if(/^https?:/.test(request.url()))report.remoteRequests.push(request.url());});
  await page.goto(pathToFileURL(file).href,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__F35B_SIM__,null,{timeout:120000});
  report.validation = await page.evaluate(()=>{const r=window.__F35B_SIM__.runValidation();return {passed:r.passed,total:r.total};});
  await page.locator('#start').click();
  await page.evaluate(()=>{if(document.getElementById('helpOv').classList.contains('on'))document.getElementById('btnHelpTopClose').click();});
  await page.waitForFunction(()=>running&&!paused&&renderer.info.render.calls>0,null,{timeout:120000});
  const first = await snapshot(page);
  await page.waitForFunction(steps=>stepCount>steps+10,first.stepCount,{timeout:120000});
  report.flight = await snapshot(page);
  if(report.validation.passed!==report.validation.total || !report.validation.total)throw Error('Internal validation failed');
  if(report.flight.crashed || !report.flight.position.every(Number.isFinite))throw Error('Invalid active flight');
  if(report.remoteRequests.length || report.errors.length)throw Error('Network dependency or JavaScript error');
  report.status='PASS';
} catch(error) { report.failure=String(error); process.exitCode=1; }
finally { await browser.close(); await mkdir('benchmarks/final',{recursive:true}); await writeFile('benchmarks/final/offline-file-test.json',JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify({status:report.status,validation:report.validation,remoteRequests:report.remoteRequests.length,errors:report.errors,failure:report.failure}));

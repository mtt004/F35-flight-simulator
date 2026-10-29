import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { repositoryRoot, baselineFile } from './source.mjs';

export async function loadPlaywright() {
  try { return (await import('playwright')).default; }
  catch (first) {
    if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw first;
    return createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'runtime.cjs'))('playwright');
  }
}
export async function browserSession({ file = baselineFile, mobile = false } = {}) {
  const root = repositoryRoot, absFile = path.resolve(file);
  if (path.relative(root, absFile).startsWith('..')) throw new Error('Simulator must be inside project');
  const server = createServer(async (req, res) => {
    try {
      const target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (path.relative(root, target).startsWith('..')) { res.writeHead(403).end(); return; }
      const info = await stat(target);
      if (!info.isFile()) { res.writeHead(404).end(); return; }
      const ext = path.extname(target);
      res.setHeader('Content-Type', ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' || ext === '.mjs' ? 'text/javascript; charset=utf-8' : 'application/octet-stream');
      res.end(await readFile(target));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    const playwright = await loadPlaywright();
    browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
      hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], warnings = [], requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.type() === 'warning') warnings.push(msg.text()); });
    await page.route('**/*', async route => {
      const url = route.request().url(); requests.push(url);
      if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) await route.continue();
      else { errors.push('External network dependency: ' + url); await route.abort(); }
    });
    await page.addInitScript(() => {
      // Linux sandbox cannot expose gamepad device-monitor sockets; no gamepad testing claimed.
      Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
      localStorage.setItem('f35b_anchor_overhaul_v3', JSON.stringify({ worldMode:'LEGACY', seed: 4201, tutorialSeen: true, settings: { quality: 'MED', volume: 0 }, simHours: 13.2 }));
    });
    const url = origin + '/' + path.relative(root, absFile).split(path.sep).map(encodeURIComponent).join('/');
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__F35B_SIM__, null, { timeout: 120000 });
    const environment = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.gl');
      const gl = canvas?.getContext('webgl2');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return { userAgent: navigator.userAgent, webglVersion: gl?.getParameter(gl.VERSION),
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
        viewport: [innerWidth, innerHeight], devicePixelRatio, drawingBuffer: [canvas?.width, canvas?.height],
        hardware: 'Cloud Linux Chromium using SwiftShader software rasterizer; NOT Galaxy A51', realDevice: false };
    });
    return { browser, context, page, origin, errors, warnings, requests, environment,
      async close() { await browser.close(); await new Promise(resolve => server.close(resolve)); } };
  } catch (error) {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    throw error;
  }
}
export async function snapshot(page) {
  return page.evaluate(() => ({ running, paused, crashed, simT, flightT, stepCount,
    position: P.pos.toArray(), velocity: P.vel.toArray(), quaternion: P.quat.toArray(), fuel,
    stolMode, nozzle, gearD, camMode, frameEMA, graphicsLevel: qlLevel, settings: { ...S },
    drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
    renderer: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries },
    replaySeconds: window.__F35B_SIM__.operations.replaySeconds }));
}
export async function startFlight(page, { scenario = 'FREE FLIGHT', start = 'PARK', hour = 13.2, weather = 'cavok' } = {}) {
  await page.evaluate(({ scenarioName, startName, hourValue, weatherName }) => {
    document.querySelector('#selScen').value = scenarioName;
    document.querySelector('#selScen').dispatchEvent(new Event('change', { bubbles: true }));
    scenario = scenarioName; startType = startName; simHours = hourValue; wxPreset = weatherName; applyWx();
  }, { scenarioName: scenario, startName: start, hourValue: hour, weatherName: weather });
  await page.locator('#start').click();
  await page.waitForFunction(() => running && !paused);
}
export async function captureScene(page, options) {
  await page.evaluate(({ start = 'PARK', camera = 0, hour = 13.2, weather = 'cavok', scenarioName = 'FREE FLIGHT' }) => {
    scenario = scenarioName; startType = start; simHours = hour; wxPreset = weather;
    applyWx(); respawn(); camMode = camera; snapCameraToAircraft(); applyVisibility();
  }, options);
  await page.waitForTimeout(1500);
}

# Uploaded simulator: baseline audit

Inspection date: 27 October 2026 (Europe/Istanbul). Preserved source: `legacy/F35B_Offline_Open_World_Simulator_Advanced_Physics_Overhaul.html`.

- Original SHA-256: `cf3b450a2aaf6fe03d95207a7a9b9a33f1179bf7868b03b805cda1a8d55f3435`.
- 948,542 bytes; 4,088 lines. Two inline scripts: bundled Three.js r128 (603,446 characters including license) and simulator application (313,875 characters).
- Diagnostic version: `5.3.0-realism-review-airmass-twin-spool`.
- Local resource CSP denies network connections and all assets are inline/procedurally created. No remote assets are required by the uploaded base package.

## Systems observed in source

This is a source audit, not a claim of successful runtime testing. The application contains ISA atmospheric equations; nonlinear wind-relative aerodynamic forces; fuel/mass/inertia modelling; engine fan/core spool state; fixed 120 Hz physics stepping; STOVL fan/nozzle transitions; yaw/pitch/roll control surfaces; hover assistance; terrain and ground collision; ILS/autoland; generated airports; seeded noise/terrain; spatial feature bins; instanced traffic; weather-driven forces and rain/cloud rendering; multiple camera modes; touchscreen/gamepad/gyroscope input; procedural Web Audio; persisted settings/flight state; mission scoring; replay; and a 36-check `runValidation()` diagnostic (count determined from source registrations; runtime count must be confirmed).

Body coordinates are X right, Y up, Z aft; forward is −Z. World coordinates use a moving origin (`OX`, `OZ`); global terrain/airport sampling adds these offsets to the local aircraft position. The renderer and physics share many lexical globals in a single classic script. The renderer is explicitly WebGL2, with no WebGL1 fallback.

Main loop: `requestAnimationFrame(loop)`, wall delta capped at 50 ms, `physAcc` bounded to eight fixed 1/120 s steps, followed by weather, terrain queue, world visuals, aircraft surfaces, effects, cameras, HUD and `renderer.render`. Physics is fixed-step but stalls beyond the delta/accumulator caps lose simulated time. The baseline has no explicit 30 FPS render cap. The quality governor adjusts graphics level using an EMA and separate slow/fast thresholds. UI/HUD uses an independent 2D canvas.

Resource management includes shared-geometry flags, `disposeGroup`, released terrain chunks, pooled effects and bounded regional records. These are deliberate safeguards, but no memory-growth benchmark has run here. Save compatibility uses `f35b_anchor_overhaul_v3`. Saved vectors/quaternions are checked before restoring; saved settings are broadly merged and do not receive comprehensive schema validation.

## Actual verification in this environment

`node --test tests/unit/flight-math.test.mjs` passed **7/7** equation/regression tests against the preserved source. With `SIMULATOR_SOURCE=src/simulator.js`, both baseline and current source passed **14/14** at the extraction checkpoint. These execute production functions for ISA, deterministic noise, lift/recovery, wave drag, fuel/inertia, hover mass envelope and yaw damping. They do not launch a browser and do not validate complete takeoff/landing dynamics.

Browser startup, `runValidation()`, scene captures, performance, touch interaction, context recovery and sustained flight are **NOT TESTED locally**. The installed Playwright package is 1.62.1 but its Chromium executable is absent. `playwright install chromium` retried Chrome for Testing 151.0.7922.34 and repeatedly received a zero-MiB/invalid ZIP response; browser launch therefore failed. Exact blocker text is saved in `benchmarks/baseline/browser-tests.json` and `benchmark-report.json`. These files deliberately contain no invented FPS, memory, screenshots or thermal data.

## Reproducible runtime checks

After installing Node dependencies and Chromium:

```sh
npm ci
npx playwright install --with-deps chromium
node scripts/test-browser.mjs
node scripts/run-benchmarks.mjs --seconds 30
node scripts/build-web.mjs
node scripts/test-browser.mjs dist/index.html
node scripts/run-benchmarks.mjs dist/index.html --seconds 30
node scripts/run-benchmarks.mjs dist/index.html --sustained --seconds 1200
```

The runtime suite invokes the actual `window.__F35B_SIM__.runValidation()`, starts a flight, verifies fixed-step activity and finite state, checks pause/resume, cameras/instruments, a real pointer stick interaction, saving, STOVL hover/conversion, context loss/recovery and JavaScript/shader errors. Remote resource requests are blocked. Benchmarks record actual `renderer.render` timestamps, synchronous render-submission wall time, frame percentiles, 1% lows, stutters, browser heap if available and snapshots. GPU timing, Android PSS, battery and thermal metrics remain null unless measured externally. Desktop SwiftShader results are never Galaxy A51 results.

## Confirmed limitations / risks

- No baseline screenshots or runtime performance measurements are available in this cloud container yet.
- Detailed F-35B aerodynamic/control-law data are not public; the existing source itself labels its coefficient model an engineering approximation.
- No explicit application handler was observed for visibility/blur or `webglcontextlost`/`webglcontextrestored`; Three.js itself has restoration support. App lifecycle still needs dedicated verification.
- Gyroscope calibration uses `gyro.b || 45`, so a legitimate zero beta angle is treated as missing. This is a source-confirmed edge-case defect.
- The 36 original self-checks include some constant/tautological checks and a simplified rate probe; a passing result would not prove complete flight lifecycle correctness.
- Real-device installation, Android sensor orientation, multitouch concurrency, 20-minute thermals, battery use and total Android PSS require device evidence.

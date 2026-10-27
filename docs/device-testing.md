# Device and endurance testing

The Galaxy A51 SM-A515F is the target, not the current test host. No physical Android phone has been connected to this Work session.

## Available environments

- Cloud Linux/Chromium153/ANGLE SwiftShader, 1280×720 CSS/DPR1. Source hashes and reported renderer/host metadata are in benchmarks. CPU rasterization does not predict Mali-G72 throughput.
- GitHub Actions API33 x86_64 emulator is configured to install and launch the actual bundled flight, run36 internal checks and require finite live state/draw calls/advancing physics. Final actual outcome is in the release evidence, not inferred from this configuration.
- Native Android PSS, battery, temperature, real sensor handling and physical touch latency are NOT TESTED.

## Reproduce browser measurements

`npm ci`; `npx playwright install --with-deps chromium`; `npm run build`.
Run baseline and final one at a time: `node scripts/run-benchmarks.mjs <html> --seconds 30`.
Sustained: `node scripts/run-benchmarks.mjs dist/index.html --sustained --seconds 1200`.
If using an already installed compatible browser, set CHROMIUM_PATH. The cloud session used npm-packaged @sparticuz/chromium153.0.0 after direct browser-CDN download failed; no product dependency on it was added.

Measurements are actual intervals between renderer calls. Render-submission timing is synchronous JS work, not GPU time. Browser heap is not Android PSS. Original50ms physics delta clamp remains, so overloaded software rendering can advance simulated time more slowly than wall time. A sustained renderer test is therefore not a real-time flight-model accuracy or device-thermal test.

## Physical A51 acceptance (remaining)

Install the tagged APK, enable airplane mode, launch a complete flight, test multi-touch/gyro calibration/JSON picker, switch all profiles and instrument/camera layouts, background/resume, and fly20minutes. Capture actual frame intervals, PSS via adb dumpsys meminfo, OS/WebView versions, battery/thermal observations and source/APK checksums. Targets:30FPS and provisional600MB PSS, subject to evidence. Store results without inferring absent metrics. Tracked in GitHub issue2.

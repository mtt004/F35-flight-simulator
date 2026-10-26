# Project Lightning — F-35B Mobile Simulator

Experimental offline F-35B-inspired simulator targeting Samsung Galaxy A51. Preserves the owner-supplied six-DOF/STOVL sandbox, adds mobile graphics profiles, authored aircraft/cockpit detailing, airport materials/markings, procedural palettes and a restricted Kotlin Android host.

## Build and test

Node22+ and Java17. `npm ci`, `npm test`, `npm run build`. Open `dist/Lightning-F35B.html` offline in a WebGL2 browser. `bash scripts/build-android.sh` uses Android SDK35/build-tools35.0.0 and Gradle8.9 to produce `dist/Lightning-F35B-Android.apk`. See [Android build](docs/android-build.md) and [installation](docs/android-installation.md).

Browser runtime QA: `npx playwright install --with-deps chromium`, then `node scripts/test-browser.mjs dist/index.html`. Matched benchmarks: `node scripts/run-benchmarks.mjs <legacy-or-dist-html> --seconds 30`; sustained: add `--sustained --seconds 1200`. Test results identify actual hardware; cloud results do not establish A51 performance.

## Engineering record

- [Architecture](docs/architecture.md), [plan](docs/implementation-plan.md), [development log](docs/development-log.md)
- [Preserved original/checksum](docs/original-source.md), [baseline audit](docs/baseline-audit.md)
- [Research](research/), [dependency pins](docs/dependencies.md), [asset licences](LICENSES.md)
- [Benchmarks](benchmarks/), [controls](docs/controls.md), [known limitations](docs/known-issues.md)

Status is experimental/PARTIAL until all requested release/device gates pass. Accurate geographic scenery and the full requested visual reconstruction remain unfinished. No Galaxy A51 testing is claimed.

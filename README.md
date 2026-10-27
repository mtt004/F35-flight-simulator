# Project Lightning — F-35B Mobile Simulator

Experimental offline F-35B-inspired simulator targeting Samsung Galaxy A51. Preserves the owner-supplied six-DOF/STOVL sandbox, adds mobile graphics profiles, authored aircraft/cockpit detailing, airport materials/markings, procedural palettes and a restricted Kotlin Android host.

## Download the experimental build

[Android APK](https://github.com/mtt004/F35-flight-simulator/releases/download/v0.1.0-experimental/Lightning-F35B-Android.apk) · [Offline browser ZIP](https://github.com/mtt004/F35-flight-simulator/releases/download/v0.1.0-experimental/Lightning-F35B-Web.zip) · [Release and checksums](https://github.com/mtt004/F35-flight-simulator/releases/tag/v0.1.0-experimental)

The private repository requires authorized GitHub sign-in. APK0.1.0-experimental is debug-signed, AndroidAPI26+/WebGL2, and passed actual API33 emulator installation and live-flight checks. Physical GalaxyA51 is NOT TESTED. See the [delivery audit](docs/final-audit.md) for exact source/hash/testing and incomplete scope.

## Build and test

Node22+ and Java17. `npm ci`, `npm test`, `npm run build`. Open `dist/Lightning-F35B.html` offline in a WebGL2 browser. `bash scripts/build-android.sh` uses Android SDK35/build-tools35.0.0 and Gradle8.9 to produce `dist/Lightning-F35B-Android.apk`. See [Android build](docs/android-build.md) and [installation](docs/android-installation.md).

Browser runtime QA: `npx playwright install --with-deps chromium`, then `node scripts/test-browser.mjs dist/index.html`. Direct offline-file QA: `node scripts/test-offline.mjs dist/Lightning-F35B.html` opens the distributable from disk with browser networking disabled, validates internal checks and requires live rendering/physics. Matched benchmarks: `node scripts/run-benchmarks.mjs <legacy-or-dist-html> --seconds 30`; sustained: add `--sustained --seconds 1200`. Test results identify actual hardware; cloud results do not establish A51 performance.

## Engineering record

- [Architecture](docs/architecture.md), [plan](docs/implementation-plan.md), [development log](docs/development-log.md)
- [Preserved original/checksum](docs/original-source.md), [baseline audit](docs/baseline-audit.md)
- [Research](research/), [dependency pins](docs/dependencies.md), [asset licences](LICENSES.md)
- [Benchmarks](benchmarks/), [controls](docs/controls.md), [known limitations](docs/known-issues.md)

Status is experimental/PARTIAL against the full overhaul. Available APK/browser release gates passed; physical-device and remaining-feature gates are incomplete. Accurate geographic scenery and the full requested visual reconstruction remain unfinished. No Galaxy A51 testing is claimed.

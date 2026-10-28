# Project Lightning — F-35B Mobile Simulator

Experimental offline F-35B-inspired simulator targeting Samsung Galaxy A51. Preserves the owner-supplied six-DOF/STOVL sandbox, adds mobile graphics profiles, authored aircraft/cockpit detailing, airport materials/markings, procedural palettes and a restricted Kotlin Android host.

## Download the experimental build

[Android APK](https://github.com/mtt004/F35-flight-simulator/releases/download/v0.2.0-experimental/Lightning-F35B-Android.apk) · [Offline browser ZIP](https://github.com/mtt004/F35-flight-simulator/releases/download/v0.2.0-experimental/Lightning-F35B-Web.zip) · [Release and checksums](https://github.com/mtt004/F35-flight-simulator/releases/tag/v0.2.0-experimental)

The private repository requires authorized GitHub sign-in. APK0.2.0-experimental is debug-signed, AndroidAPI26+/WebGL2, and passed actual API33 emulator installation and live-flight checks. Physical GalaxyA51 is NOT TESTED. See the [v0.2 delivery audit](docs/delivery-v0.2.md) for exact source/hash/testing and incomplete scope.

## Build and test

Node22+ and Java17. `npm ci`, `npm test`, `npm run build`. Open `dist/Lightning-F35B.html` offline in a WebGL2 browser. `bash scripts/build-android.sh` uses Android SDK35/build-tools35.0.0 and Gradle8.9 to produce `dist/Lightning-F35B-Android.apk`. See [Android build](docs/android-build.md) and [installation](docs/android-installation.md).

The current APK uses an ephemeral debug certificate; upgrading an earlier build may require uninstalling it, which deletes local saves. See installation instructions before upgrading.

Browser runtime QA: `npx playwright install --with-deps chromium`, then `node scripts/test-browser.mjs dist/index.html`. Direct offline-file QA: `node scripts/test-offline.mjs dist/Lightning-F35B.html` opens the distributable from disk with browser networking disabled, validates internal checks and requires live rendering/physics. Matched benchmarks: `node scripts/run-benchmarks.mjs <legacy-or-dist-html> --seconds 30`; sustained: add `--sustained --seconds 1200`. Test results identify actual hardware; cloud results do not establish A51 performance.

## Engineering record

- [Architecture](docs/architecture.md), [plan](docs/implementation-plan.md), [development log](docs/development-log.md)
- [Preserved original/checksum](docs/original-source.md), [baseline audit](docs/baseline-audit.md)
- [Research](research/), [dependency pins](docs/dependencies.md), [asset licences](LICENSES.md)
- [Benchmarks](benchmarks/), [controls](docs/controls.md), [known limitations](docs/known-issues.md), [28-decision acceptance map](docs/acceptance-matrix.md)

Status is experimental/PARTIAL against the full overhaul. Available APK/browser release gates passed; physical-device and remaining-feature gates are incomplete. V0.3 development adds the real London corridor; the full requested visual reconstruction and mobile performance acceptance remain unfinished. No Galaxy A51 testing is claimed.

## London V0.3 development

Select London in Flight Setup for the offline Heathrow–Docklands corridor. Existing saved worlds default to Legacy; London saves retain their coordinate identity. London uses licensed OS outlines/elevation and original simplified landmarks. Building heights are estimates; ground colours are vector-derived artwork, not aerial imagery.

Before `npm run build`, generate the pinned scenery:

```sh
python3 -m venv .tmp/london-venv
.tmp/london-venv/bin/pip install -r scripts/london-requirements.txt
.tmp/london-venv/bin/python scripts/build-london.py
.tmp/london-venv/bin/python scripts/build-london-ground.py
```

Initial preprocessing downloads verified OS archives (~382 MB); generated browser/APK play fully offline. Source pins refuse changed downloads. GitHub workflows regenerate the same assets and retain the manifest/licences.

This experimental milestone does not establish Galaxy A51 frame rate, battery/thermal behavior or commercial-simulator realism. See the [V0.3 delivery audit](docs/delivery-v0.3.md), [twelve screenshot comparisons](docs/visual-comparison-v0.3.md) and [measured performance](docs/performance-v0.3.md) for actual checks and limits.

Current release-candidate fixes and build-bound verification: [recovery validation](docs/recovery-validation-v0.3.md). The verified release also retains exact licensed raw inputs for reproducible rebuilds after upstream editions change.

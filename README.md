# Project Lightning — F-35B Mobile Simulator

Experimental offline F-35B-inspired simulator targeting Samsung Galaxy A51. London V0.4 adds real 10 m Sentinel-2 ground imagery, EA LiDAR-derived building heights and nine original textured landmarks to the Heathrow–Docklands corridor. The original six-DOF/STOVL sandbox and separate Legacy world remain available. Android uses a restricted offline Kotlin WebView host.

## Candidate builds

[Releases and checksums](https://github.com/mtt004/F35-flight-simulator/releases) contain published APK and offline browser ZIP assets. The V0.4 candidate is `v0.4.0-candidate.1`; publication requires the release workflow's browser/offline checks, full twenty-minute London endurance run, APK verification and actual Android emulator installation/launch to pass. A candidate tag does not establish that those gates have passed. Repository and release access may require authorized GitHub sign-in.

Physical Galaxy A51 installation, frame rate, gyroscope, battery, thermals and sustained device stability are **NOT TESTED**. Cloud browser and Android emulator results do not establish A51 performance. The APK uses an ephemeral debug certificate; updating may require uninstalling the previous build, deleting local saves.

## Build and test

Use Node 22+, Python 3.12 and Java 17. Generate every scenery pack before testing or building. Source scripts and OS/Sentinel SHA pins are committed; a fresh height build records the 2022 EA dataset input hashes with its output pack. The complete tile set and compressed heights are generated inputs, rather than a complete committed binary pack.

```sh
npm ci
python3 -m venv .tmp/london-venv
.tmp/london-venv/bin/pip install -r scripts/london-requirements.txt
.tmp/london-venv/bin/python scripts/build-london.py
.tmp/london-venv/bin/python scripts/build-london-ground.py
.tmp/london-venv/bin/python scripts/build-london-imagery.py
.tmp/london-venv/bin/python scripts/build-london-heights.py
.tmp/london-venv/bin/python scripts/test-london-heights.py
npm test
npm run build
```

Initial preprocessing downloads verified OS archives (approximately 382 MB), SHA-pinned Sentinel source rasters (approximately 751 MB) and several GB of EA LiDAR rasters from the 2022 composite edition. OS/Sentinel byte changes are refused. A height rebuild retaining `sources.json` also rejects upstream byte changes; a fresh build records the dataset input pins and includes them in the release pack. CI uses the same pinned dependencies and regenerates all packs before tests; disposable runners delete only generated raster caches after preprocessing. The separate released source-data ZIP preserves the exact OS archives for rebuilding after provider editions change. See [V0.4 maintenance](docs/v0.4.md) for cache paths and provenance.

Open `dist/Lightning-F35B.html` offline in a WebGL2 browser. `bash scripts/build-android.sh` uses Android SDK 35/build-tools 35.0.0 and Gradle 8.9 to produce `dist/Lightning-F35B-Android.apk` (Android API 26+). See [Android build](docs/android-build.md) and [installation](docs/android-installation.md).

For browser QA, install Chromium with `npx playwright install --with-deps chromium`, then run `node scripts/test-browser.mjs dist/index.html` and `node scripts/test-offline.mjs dist/Lightning-F35B.html`. `node scripts/endurance-london.mjs dist/index.html` performs the full twenty-minute cloud observation. Results identify the tested environment.

## London data and limits

Select London in Flight Setup for the offline Heathrow–Docklands corridor. Existing saved worlds default to Legacy; London saves retain their coordinate identity. The 2022-edition height pipeline previously produced 38,914 EA LiDAR-derived building heights and 1,086 explicitly marked footprint-estimate fallbacks; each generated manifest records that build’s actual counts. Measured heights retain roof, footprint, vegetation and survey-date uncertainty. Sentinel imagery has a 10 m source resolution; it cannot show sub-metre aerial detail. Outer imagery edges use different summer 2025 acquisition dates. Landmark geometry and material artwork are authored for this game.

Status remains experimental/PARTIAL against the full simulator overhaul. See [architecture](docs/architecture.md), [development log](docs/development-log.md), [known limitations](docs/known-issues.md), [asset licences](LICENSES.md), [controls](docs/controls.md), [preserved original](docs/original-source.md) and [benchmarks](benchmarks/).

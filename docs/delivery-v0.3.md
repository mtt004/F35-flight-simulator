# V0.3 experimental London delivery audit

This document records the earlier candidate. The execution-date continuation,
new airport architecture, integrity fixes and current source-bound checks are
in [release recovery validation](recovery-validation-v0.3.md). Its newer build
identity supersedes earlier hashes and counts below.

Execution date: 28 October 2026. This is a visibly improved, playable geographic milestone, not completion of the requested commercial-quality reconstruction or Galaxy A51 acceptance. Final release binary identity and installation checks must be read from the published `build-manifest.json`, `android-verification.json`, `android-installation.json` and `SHA256SUMS.txt`; this source document does not invent a future binary hash.

## What was wrong with V2

The immutable V2 source is `488ea110cb57e5e0ba59605547f6da0687706f41`. Its `src/simulator.js` `rawHeight`/`heightAt`, feature-region generation and `buildCityGrp` derive terrain and settlement positions mathematically. `buildCityGrp` constructs box/roof instances, not recorded building footprints. `src/terrain/scenery.js:5` defines Hampshire/Cappadocia only as three-colour arrays. Its shader adds palette/strata variation rather than imagery. `src/aircraft/detail.js` quality gating hides adaptive detail at the lowest level. Original evidence remains in `screenshots/aircraft-v0.2/v020-after/` and the V2 delivery/flight-integrity reports. The reported V2 cloud endurance failure is not a phone benchmark.

The reconstructed V2 browser baseline has SHA-256 `8529330d53723356463319a96469da80fb9fc87a48ce5449abd1f47b59ed56f4`. Twelve controlled V2/London captures retain fixed camera, weather, time, quality, viewport and poses. V2 has no London; some identical absolute London camera positions lie below V2's unrelated synthetic mountains. Those frames demonstrate geographic incompatibility, not fair above-ground V2 rendering quality. Consult the preserved original V2 aircraft screenshots and high-altitude/relative-camera pairs as well.

## Shipped implementation

- `e0bb4e5`: original offline London terrain/building renderer checkpoint.
- `08493f5`: reproducible pinned OS data pipeline and eight authored landmarks.
- `760f4d5`: aircraft/cockpit geometry and processing sources.
- `278501e`: actual simulator London/Legacy integration, world-aware saves, origin/replay correction and asset regeneration in CI.
- `6a73edd`: incremental city streaming, curated building exclusions, mission policy, corrected horizon and repeatable QA/release packaging.
- Subsequent evidence/workflow commits retain screenshots/reports and add final offline/release gates without changing the tested product source.

London adds a 39 × 15 km Heathrow–Docklands corridor using OS Terrain 50 and OpenMap Local. Terrain sampling/collision matches near mesh triangles; three tiled resolutions use skirts and bounded caches. Real water, islands, roads, footprints, parks and woodland define the ground layout. The original vector-derived texture is not aerial imagery. Height assumptions, source pins, licences, coordinate transforms and exact output hashes are in `docs/london-data.md` and the bundled manifest.

40,000 recorded building footprints are selected deterministically; 39,989 remain after clearing overlaps around authored landmarks. Three urban geometry levels preserve silhouette. Heights of generic buildings are assumed 10/18/26 m (12 m near Heathrow), so the non-landmark skyline is not a surveyed reconstruction. Westminster/Big Ben, London Eye, Shard, Tower Bridge, St Paul's, Canary Wharf, Gherkin and Buckingham Palace are original authored approximations, not placeholder cubes or manufacturer-accuracy claims.

Heathrow has two map-aligned runways with public endpoint-derived lengths/headings, markings/lights, taxiway/apron surfaces, authored terminals/tower/support structures. Terminal, taxiway and accessory detail remains simplified. Aircraft receives intake ducts/lips, gear fittings and open nozzle geometry; cheap core details remain at minimum quality. Cockpit gains raised controls/relief while preserving display clearance. London atmosphere blends the distant horizon consistently. Three r128 and the core flight model are retained.

Legacy mode and old-save compatibility are preserved. London saves carry world identity. Traffic Intercept and Offshore Recovery are marked Legacy only because they require absent procedural traffic/deck objects. The safe-STOVL landing qualification remains unresolved (issue #7); it is not reported fixed.

## Verification and evidence

Local tests: 83 Node tests, 10 project-configuration self-tests and 13 Android metadata/evidence tests passed. Actual browser suite: 9/9. London functional suite: 7/7, including keyboard/physics runway takeoff, world-aware save restore, profile switching, context restoration and error checks. A first takeoff attempt under concurrent CPU rendering timed out; its raw failure trace is retained beside the isolated passing run. It was not erased or reclassified as passed.

Network-disabled direct file startup passed all 36 internal checks with actual rendering/advancing physics, no remote requests or page errors. Product HTML SHA-256 is `9c4853a5eba204ad582e832a3a1f5b0274ec3a317b3a558ee3da10dfc1f5bf64`.

Source `6a73edd` passed GitHub browser run [40709469799](https://github.com/mtt004/F35-flight-simulator/actions/runs/40709469799), including saved-flight/replay actual-UI regression, and Android run [40709469768](https://github.com/mtt004/F35-flight-simulator/actions/runs/40709469768), including genuine API 33 x86_64 installation and advancing flight. Final release runs repeat these mandatory gates and bind raw XML, installed APK hash and source identity to the deliverables. A successful emulator test is not Galaxy A51 performance evidence.

The twelve actual WebGL before/after pairs are in [visual comparison](visual-comparison-v0.3.md). A separate agent reviewed code and images, reproduced collision/streaming/mission issues and rechecked the corrected high-altitude artifact: [independent review](independent-review-v0.3.md). This is independent agent review, not a second human sign-off or independent device lab.

[Performance report](performance-v0.3.md): cloud software rendering is approximately 0.9–3.3 median FPS in the retained London tests, with repeated long frame intervals. The 30 FPS goal fails in that environment. A two-minute live city fixture remains uncrashed but is not a full route or long endurance test. No physical Galaxy A51 was available; FPS/frame pacing, thermal/battery, gyro/multitouch and native memory acceptance are NOT TESTED.

## Deliverables and reproducibility

PR: [#8](https://github.com/mtt004/F35-flight-simulator/pull/8). The verified release workflow creates an immutable `v0.3.0-experimental` prerelease only after its tests, actual emulator installation, source/binary identity, checksums and archive/XML verification pass. Until that succeeds this is a development candidate, not a published release.

The release packages the actual APK, single-HTML offline browser ZIP, London scenery ZIP, evidence ZIP, build/install metadata and SHA256SUMS. The evidence includes all twelve comparison pairs, raw benchmarks, licences, source manifest and Android XML. Regenerate scenery with the pinned Python scripts, then `npm ci`, `npm test`, `npm run build`, and `bash scripts/build-android.sh`. Initial source download is about 393 MB; gameplay uses no network service. Debug signing is ephemeral; later installations may require uninstalling and losing local saves.

## Remaining visual and functional limits

This is still stylized: estimated-height flat roofs, repeating windows, sparse close street furniture, simplified terminals/landmark ornament, map-derived ground, approximate aircraft/CAD proportions and inherited cloud/weather materials. No aerial-texture pipeline, modern Three migration, KTX2/glTF asset pipeline, physically exact scattering, full terrain SSE quadtree/geomorphing, complete control-only Heathrow return circuit or fresh 20-minute London endurance has been accepted. Coverage outside the declared pack is explicitly synthetic fallback.

Next priorities are physical A51 profiling and responsive frame pacing, measured urban/fragment budgets, detailed licensed roof/facade/ground materials, worker-assisted geometry, more accurate airport surfaces and control-only route/STOVL qualification. The visible London milestone does not claim Infinite Flight or MSFS parity.

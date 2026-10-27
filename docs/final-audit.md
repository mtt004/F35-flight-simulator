# Project Lightning — delivery audit

Date:27 October2026. Scope is **PARTIAL** against the full owner directive. This is a working experimental implementation, not a declaration that all28 design goals or A51 performance targets are satisfied. Final release/install identity is recorded in the handover section after actual verification.

## Evidence already verified

- Correct private repository `mtt004/F35-flight-simulator`, repository id1434920630; admin/push access verified. No other repository used and privacy preserved.
- Unmodified original in legacy,948542bytes, SHA-256 `cf3b450a2aaf6fe03d95207a7a9b9a33f1179bf7868b03b805cda1a8d55f3435` (local Git blob identity matched remote original blob1dff09f38337536f26fb6c712a0090bb4fce049a).
-28 Node checks pass;16 core flight/STOVL/collision/replay functions remain byte-identical. This does not establish real aircraft fidelity.
- Baseline and current browser suites each9/9 PASS, including36/36 internal checks. Current offline HTML is980436bytes/SHA `d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198`; ZIP contents match.
- Current source has seven actual before/after screenshot pairs and seven source-identified exploratory cloud benchmarks. CPU software-renderer FPS is not phone FPS.
- Actual APK compiled and passed archive/content/package/signature verification in Actions. The first release attempt failed before installation because the emulator's default userdata partition exceeded free disk. This failure was retained; a smaller supported partition was configured for retry.
- Research includes all six requested tools; source classes and uncertainties recorded. No acquired aircraft model, satellite imagery or audio recordings were redistributed.
- Kotlin host restricts origin and file/content access, declares no permissions/native bridge, and bundles identical HTML. Signing uses ephemeral debug identity; no key or credential committed.
- Fresh independent review is in docs/independent-review.md; inherited corrupt-save gap remains tracked, not silently marked fixed.

## Design coverage

| # | Requested decision | Implemented evidence / remaining scope |
|---|---|---|
|1|Mixed Infinite Flight/MSFS style|Restrained mobile UI/material/detail changes; full reconstruction incomplete.|
|2|Balanced visual priority|Aircraft, cockpit, airports, controls and material changes included.|
|3|High-detail adaptive F-35B|Close-detail authored atlas/line LOD added; baseline procedural silhouette retained; high-detail asset pipeline incomplete.|
|4|Subtle authentic finish|Low-contrast authored markings/material studies; no manufacturer/CAD validation.|
|5|Detailed functional cockpit|Added furnishing/controls/lighting, corrected display occlusion, preserved live PCD; stylized geometry remains.|
|6|Switchable instruments|Military/minimal/landing selector and original HMDS/PCD pages retained.|
|7|Precision/cinematic cameras|Added tracking modes/distance/shake; original5 camera types retained.|
|8|Varied biomes|Seeded baseline world retained; palette/strata shading extended. Major terrain reconstruction incomplete.|
|9|Hampshire and Cappadocia|Research and explicitly inspired appearance presets only. Geographic data packs NOT IMPLEMENTED.|
|10|Civilian airport detail|Runway textures/designators, terminal glazing and hangar doors added; baseline civilian navigation retained.|
|11|Balanced natural/built world|Existing trees/towns/roads/rail retained; broader reconstruction incomplete.|
|12|Adaptive world LOD|Original terrain streaming/LOD and new close aircraft detail gating retained.|
|13|Advanced layered clouds|Original layered particle-cloud/storm system retained; new advanced atmospheric reconstruction incomplete.|
|14|Weather graphics/physics|Existing coupling retained and sampled by browser tests; no external meteorological validation.|
|15|Natural lighting|Baseline PBR/ACES/sun/sky retained; contact-shadow edge softened. Advanced illumination incomplete.|
|16|Night operations|Baseline runway/airport night systems retained; cockpit illumination added.|
|17|Detailed water/coasts|Original shader water/coastlines retained; additional reflection/scenery reconstruction incomplete.|
|18|Balanced effects|Existing exhaust/vapour/downwash/touchdown pools retained; adaptive quality applied.|
|19|Hybrid audio|Procedural baseline audio retained. Recorded hybrid sound NOT IMPLEMENTED.|
|20|Refined flight realism|Equations reviewed/tested and preserved; no unsupported real-aircraft calibration claim.|
|21|STOVL improvement|Original fan/nozzle transition preserved; added door detail follows animation. Browser hover/transition sampled; complete lifecycle certification incomplete.|
|22|Free flight/exploration|Existing working seeded sandbox retained.|
|23|Civilian AI|Original instanced/route civilian traffic retained.|
|24|Custom mobile controls|Existing scale/handedness/sensitivity/dead-zone plus new offsets/opacity. Arbitrary relocation of every button incomplete.|
|25|Optional gyro|Original gyro toggle/calibration retained; valid zero-beta calibration fixed. Physical sensor test NOT TESTED.|
|26|30FPS default/higher optional|Cadence profiles implemented; performance target NOT certified on A51.|
|27|Heat/graphics balance|Budgets/hysteresis/profiles and diagnostics implemented; phone thermal/battery/PSS NOT TESTED.|
|28|APK/browser/source|Browser works offline and APK compiles/signature-verifies. Final installation/release results recorded below when observed.|

## Risks and limits

See docs/known-issues.md, independent-review.md, device-testing.md and GitHub issues2–5. In particular: corrupt manually malformed saved vectors can poison restoration; severe software-renderer overload hits the inherited50ms simulation delta clamp; cloud heap is not Android PSS; ephemeral debug keys complicate upgrades. No stable1.0 or photorealism claim is justified.

## Reproducibility and record

Source/build instructions: README, docs/android-build.md and architecture.md. Actual raw evidence: benchmarks/, screenshots/, Android verification/install JSON and instrumentation XML in the release artifact. GitHub Actions are pinned by action SHA and dependency lockfiles/toolchain versions are committed. Successful compilation cannot substitute for installation/live-game tests. The final handover must cite the exact release source commit, main commit, APK bytes/hash/signing and actual environment.

## Available short cloud measurements

These are actual short, sequential cloud software-renderer runs. Different execution times and CPU resource scheduling limit causal comparison. They do not establish A51 performance. Ten seconds per scene after warm-up is exploratory, not a statistically replicated GPU benchmark.

| Scenario | Baseline mean FPS | Current mean FPS | Current p95 frame ms |
|---|---:|---:|---:|
|runway-takeoff|4.77|5.83|355.8|
|high-altitude|5.89|7.69|238.9|
|countryside|4.36|4.45|440.9|
|airport-approach|4.49|4.81|505.7|
|heavy-weather|4.68|5.08|382.7|
|stovl-hover|5.13|6.78|304.6|
|night-approach|3.09|4.04|601.4|

## Tracked follow-up work

- Device/A51 validation: https://github.com/mtt004/F35-flight-simulator/issues/2
- Accurate geographic packs: https://github.com/mtt004/F35-flight-simulator/issues/3
- Corrupt save rejection: https://github.com/mtt004/F35-flight-simulator/issues/4
- Remaining visual/audio reconstruction: https://github.com/mtt004/F35-flight-simulator/issues/5

Source/research/evidence checkpoint: ceb209d39be636ac33effb14314e987fce3fdd48 on feature/mobile-graphics-overhaul. Release build source: ca0decc9d8917ca3ca6168ef68fb11a3ccdab8c9 (same product HTML; later checkpoint adds documentation/evidence). PR: https://github.com/mtt004/F35-flight-simulator/pull/1.

## Retrieved APK checkpoint (before installation success)

Actions artifact12711166312 from release run40451484190/sourceca0decc9 was downloaded and checked locally. APK archive integrity passed; bundled HTML exactly matched the current980436-byte browser build. APK package com.mtt004.lightning, version0.1.0-experimental/code1, minAPI26/target35, no permissions. APK1581529bytes/SHA256 `5ad4aae15c58e6474027db33452ecd6b6b1f364d5529e3fbd95fc5656be3c32e`. CI apksigner verified APK Signature Schemev2 with a2048-bit RSA Android Debug certificate. This is real APK build/signing evidence, not installation evidence. The emulator gate failed and no release was published at this checkpoint. A later final successful build, if different, supersedes these binary/hash details.

## Twenty-minute cloud endurance completed

 `d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198`.

- Requested wall duration:1200seconds; recorded first-to-last render interval coverage:1199.465seconds.
- Actual rendered frames:9176; mean7.65FPS; median8.10FPS;1% low2.46FPS.
- Frame time p50/p95/p99:123.5/254.0/332.6ms.
- First five-minute mean:6.72FPS; last five-minute mean:7.70FPS. No claim of thermal stability follows from a CPU cloud host.
- Crash at endpoint:False; recorded JavaScript/shader errors:0; warnings:0.
- Simulated time advanced:425.94seconds. The inherited50ms per-frame clamp slows simulation under severe overload; this was20minutes of continuous operation, not20minutes of real-time-accurate flight.
- Geometry counter:428→532; textures:11→14; scenery streaming changes these counts. Endpoint counters cannot prove a plateau or absence of leaks.
- Reported browser JS heap at endpoint:35.1MB. This is not process PSS, native/GPU memory or peak allocation.
- A51 FPS/PSS/battery/temperature/gyro/touch-latency:NOT TESTED.


See benchmarks/final/endurance-summary.md for environment and interpretation. No device-thermal/PSS or leak-free claim is made.

## Native test failures retained

Runs40453171144 and40454725990 installed/started the Android host but did not complete live-flight instrumentation. Attempt4 host kernel evidence establishes a RenderThread segmentation fault and disconnected emulator. The precise offending native library is not identified; this is not a proven app assertion or Galaxy A51 failure. Tests have not been waived. Selected installation/XML/kernel/memory evidence is committed under benchmarks/android/attempt-3 and attempt-4. A controlled Lavapipe software-backend retry is pending. No GitHub Release existed when this entry was written.

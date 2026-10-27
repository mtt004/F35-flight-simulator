# Independent implementation review — 27 October 2026

Reviewer: a fresh-context review agent, separate from the implementation agents. Scope: the source, browser build, Android host, build/verification scripts, workflows, saved evidence and representative actual screenshots. This review did not merge, publish, alter product code, install an APK, or run a second concurrent graphics benchmark.

## Verdict

**PARTIAL against the full owner specification.** The implementation preserves the original and adds useful, functioning browser improvements. It is not evidence of a completed MSFS/Infinite Flight-level reconstruction, accurate regional scenery, or Galaxy A51 performance. A successful experimental release still requires the final source's APK/emulator gates and artifact verification; their state must be reported from the completed workflow, not inferred from this document.

No additional new P1 startup blocker was found in the reviewed source after the corrections below. One inherited corrupt-save robustness defect remains source-confirmed at the time of review; its remediation must be recorded before calling save-corruption handling complete.

## What this reviewer actually verified

- Reran `npm test`: **28 tests passed, zero failed/skipped**. These execute flight equations, the pinned Three.js geometry/material implementation, profile policy and source-preservation checks. They are not 28 full-flight or hardware tests.
- The source-preservation suite compares 16 core physics, STOVL, terrain/collision and replay functions against the uploaded baseline. All were byte-identical. The source's fixed-step frame-delta clamp remains a documented limitation.
- Original file: 948542 bytes; SHA-256 `cf3b450a2aaf6fe03d95207a7a9b9a33f1179bf7868b03b805cda1a8d55f3435`.
- Browser HTML present: 980436 bytes, SHA-256 `d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198` at this review checkpoint. Its ZIP passed archive integrity and contained exactly those HTML bytes.
- Read the saved baseline and upgraded browser test reports: both recorded **9/9 PASS**, including real WebGL2 startup, original internal validation (36/36), flight stepping, pause/resume, controls, saves, STOVL and context recovery. Recorded environment was Linux HeadlessChrome153/ANGLE/SwiftShader, 1280×720 CSS pixels, DPR1; upgraded initial buffer1152×648. The reviewer did not rerun those graphics tests concurrently with the implementer's benchmark.
- Inspected actual before/after cockpit images: the original opaque panel hid most of its display; the upgraded display was visible. The new actual-Three ray test also passed. The parked aircraft remains visibly procedural/faceted; screenshots do not justify a photorealism or production-CAD claim.
- Read Android Kotlin/configuration and the stronger instrumentation test. The host bundles the same HTML, requests no permissions, restricts navigation/request origin, disables arbitrary file/content loading and mixed content, denies native permission requests, and adds no JS-native bridge. JSON document selection is constrained and separately schema/size-validated by the web code.
- Read workflows and release scripts: regular jobs have read-only repository permissions; release gets contents-write only, uses quoted inputs and a version-tag allowlist, refuses existing releases, and places publication after tests, signed APK verification, emulator launch, benchmarks and checksums. Debug signing remains ephemeral and unsuitable for seamless upgrades.
- Queried GitHub release run `40451484190`: setup, dependency installation, Node tests and browser build had passed; browser regression step was still in progress, with APK/emulator/release steps pending. This observation is **not** final release or installation evidence. Canonical run: https://github.com/mtt004/F35-flight-simulator/actions/runs/40451484190 . Later completed results supersede this snapshot.

## Findings corrected during review

1. **P2 — inherited profile names could produce invalid renderer dimensions.** The former `profiles[o.profile]` check accepted `constructor`/`toString` via Object.prototype. Own-property checks and an executed regression now reject them.
2. **P2 — FPS overlay concealed slow frames.** Cadence previously reused the physics50ms clamp, reporting at least20FPS even for slower rendering. `wallDt` now drives frameEMA; the physics clamp remains separate.
3. **P2 — unguarded graphics-setting writes.** Legacy quality chips now call the guarded persistence helper before applying the profile. Duplicate opacity controls synchronize persistent values.
4. **P1 — runtime initialization compatibility/race.** The implementation team reproduced missing Three r128 texture metadata and a parser/animation-frame ordering problem. The unused metadata write was removed, real-Three material initialization is tested, and simulator/runtime hooks are emitted in one inline parser task. Saved runtime reports demonstrate successful startup afterward.
5. **P1 — Android test could pass without a live flight.** The original menu-only assertion was insufficient because first-run Help pauses the simulation. Current instrumentation dismisses Help and requires internal validation, finite live state, rendering, and increasing physics step/time counters.
6. **P2 — cockpit instruments were occluded.** Structural backing/coaming was repositioned; actual-Three sightline regression and inspected screenshot support the correction.

## Remaining source-confirmed finding

**P2 — corrupt saved velocity/angular-rate arrays can poison a restored flight (inherited behavior).** `src/simulator.js`, `continueSavedFlight()`, currently validates position/quaternion only, then calls `P.vel.fromArray(f.vel || [0,0,0])` and `P.om.fromArray(f.om || [0,0,0])`. A saved record with finite position/quaternion but `vel: []` passes its gate and supplies three undefined velocity components. Numeric strings also pass `Number(v)` validation but are not converted before `fromArray`. This is a local-data robustness issue, not evidence of a remote exploit. Reject invalid/short/non-numeric vectors and degenerate quaternions before mutating the flight, with an executed regression; or explicitly retain it as an unresolved limitation.

## Evidence/claim boundaries still requiring attention

- At this checkpoint, `benchmarks/final/benchmark-report.json` identified earlier HTML SHA `db12ce35c7a1939b2901f21b394edf1baec0cfd15d1e211704b976f20754304d`, not the current HTML hash above. That dataset must be labelled as its actual source or superseded by the planned sequential rerun. Check capture-settings hashes too. Genuine measurements can still be stale for the delivered source.
- `docs/known-issues.md` still described local Chromium as absent, while later evidence shows a working serverless Chromium. Update historical failure wording separately from current capability; the missing physical A51 remains unchanged.
- Current saved short cloud measurements (roughly5–7FPS on CPU software rendering) neither establish nor disprove A51's30FPS target. The two renderers/device architectures and workloads differ. Do not translate them into Mali-G72 speedup or thermal claims.
- A completed emulator installation demonstrates that environment only. Real A51 installation, multitouch/gyro, native picker, pause/resume under OS pressure, PSS, battery and thermal behavior remain untested without explicit evidence.
- A sustained renderer test must remain source-identified and environment-labelled. A20-minute software-renderer result is not an Android thermal or leak certification.
- Geographic Hampshire/Cappadocia packs, external high-detail aircraft/CAD, recorded hybrid audio and several advanced visual techniques are unfinished. Included packs are three-colour procedural appearance presets, not geospatial scenery.
- Seven screenshot scene types are implemented; the owner's full requested twelve-scene visual evidence set is not yet complete.
- The browser suite samples a small set of real flight behaviors. It does not fully validate takeoff-to-landing, stall recovery, mission completion, replay/save round-trips, adversarial file imports, all graphics profiles or every weather/camera mode.

## Release recommendation

Experimental prerelease only, with PARTIAL scope and explicit device/feature limitations. Require the final workflow to pass and inspect the actual APK/archive/signature/source hash and release assets before claiming delivery. Keep prior failures and the exact source identity of every benchmark; do not replace them with a self-reported checklist.

## Implementer evidence update after the review checkpoint

The completed sequential rerun now identifies current HTML SHA `d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198` in `benchmarks/final/benchmark-report.json` and screenshot capture settings. Seven scenarios were measured with zero recorded JavaScript/shader errors. `docs/known-issues.md` now distinguishes the initial browser download failure from the later working serverless Chromium. The corrupt-save P2 remains documented and tracked as GitHub issue4; no resolution is claimed. This addendum is the implementer's update, not a new independent test by the reviewer.

## Follow-up review — Android host crash, renderer retry and bundled notices

The review was reopened after emulator attempt4. This addendum supersedes the earlier workflow-progress snapshot only for the evidence explicitly described here; it does not turn a pending retry into a pass.

Read `benchmarks/android/attempt-4/README.md`, preserved host-kernel event, final emulator state, and the instrumentation/diagnostic wrapper. Attempt4 (run40454725990, sourceb71f9cc78692b2db6eaeaad41f8a6e14222e1140) records a host `RenderThread` segmentation fault, followed by emulator disappearance. The selected logs show no OOM kill and memory remained available afterward. This supports a native-renderer crash classification, not attribution to a precise library, application assertion, real device, or definitive root cause.

Reviewed changes:

- Both workflows change only the emulator's software renderer option from `swiftshader_indirect` to `lavapipe`; live-flight assertions and failure gates remain. A successful retry must verify the actual selected GLES/Vulkan backends in startup logs. A supported option alone is not runtime success.
- `android/run-instrumentation.sh` retains failing Gradle/timeout exit status, applies a10-minute instrumentation deadline and bounded adb collection, and copies only bounded emulator crash evidence. No assertion was disabled or converted to a pass. Shell syntax passes.
- The Android build adds `android/LICENSE-2.0.txt`, `android/THIRD_PARTY_NOTICES.txt`, and root `LICENSES.md` under `assets/www/`. Required input files are checked before bundling. `scripts/verify-apk.py` requires exact source copies, the full known Apache2.0 bytes, Kotlin/AndroidX attribution, and records bundled licence checksums before proceeding to APK package/signature checks.
- Verified the11358-byte full Apache2.0 file SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` and appendix. Read the notices and corrected runtime-redistribution explanation. The patch does not alter simulator HTML, flight functions, native gameplay assertions, requested Android permissions, origin restrictions or the web/native trust boundary.
- Reran the current Node suite:28/28 PASS. Python verifier compilation and shell syntax checks passed. No additional heavy graphics session was launched during the implementer's ongoing benchmark.

No concrete blocking source/build regression was identified in these pending changes. **The previously built APK is not sufficient evidence of the licence correction:** a newly rebuilt APK must pass the strengthened asset/package/signature verifier. Emulator installation/live-flight remains failed/unproven until a genuine subsequent run passes. The project remains experimental/PARTIAL against the full scope.

The implementer published the reviewed source as remote commit `dd433f611b3911f49a914d65024c0e5cbe63269f` on the development/release branches and started a fresh native CI run. This commit identity was supplied by the implementer; no completion result was inferred at this review checkpoint. The subsequent final audit should record the actual run, APK checksum and completed gate results.

## Independently verified Android success checkpoint — 27 October 2026

This checkpoint supersedes the earlier Android gate's failed/pending status for the specific feature build below. Full requested scope and physical-device qualification remain **PARTIAL**.

Independently queried [Actions run40508798727](https://github.com/mtt004/F35-flight-simulator/actions/runs/40508798727), job122204936626: completed/success, including APK build, emulator install/live-flight test, evidence generation and upload. Read its decoded job log, which checks out source commit `dd433f611b3911f49a914d65024c0e5cbe63269f` and uploads artifact12736870350. Inspected the downloaded artifact under `.tmp/android-pass/` and independently checked:

- Raw instrumentation XML: `com.mtt004.lightning.OfflineLaunchTest`, **1 test, 0 failures, 0 errors, 0 skipped**. Testcase `testBundledSimulatorLoadsAndStarts` completed in16.519seconds. The test source requires original validation, active finite flight state, rendering and advancing simulation counters; this is stronger evidence than simply hiding a menu.
- Actual APK: **1593761 bytes**, independently recomputed SHA-256 `547f5b3ee3d634e6b54647c3c0a7eb6cdccf99822a5c9c38d28532557a10543f`. ZIP integrity passes. Recorded `aapt` identifies `com.mtt004.lightning`, version `0.1.0-experimental`/1, minSDK26, targetSDK35, expected launchable activity and no requested Android permissions. Recorded `apksigner` output verifies APK Signature Schemev2 with one Android Debug RSA2048 signer. This reviewer recomputed archive/hash/content checks; cryptographic signing evidence is the successful CI verifier's recorded tool output, not a new local apksigner execution.
- APK's bundled HTML is byte-identical to the artifact's browser HTML **and current local HTML**:980436bytes, SHA-256 `d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198`. Browser ZIP passes integrity and contains those exact HTML bytes.
- All three notice documents inside the actual APK match checked-in source bytes. `THIRD_PARTY_NOTICES.txt`13758bytes/SHA `8635e625afaf3f72453f8f1b5e8809f033296a90013aab16f9cdee23c8bef53f`; full Apache licence11358bytes/SHA `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`; `LICENSES.md`3978bytes/SHA `45944a73a65f1d839f6f9a2c35629b55379034e861f0f25945a4919db62da266`. The previously identified binary notice gap is corrected in this built artifact.
- `android-installation.json` agrees with the raw XML: API33 x86_64 software-renderer emulator installed/ran the game. Final emulator state is `device`. Guest log records one instrumented target-process PSS snapshot98699KB; it includes instrumentation and excludes separate WebView renderers, is not a peak/total-app measurement, and is not GalaxyA51 evidence.
- Actual startup log says `vulkan_mode_selected:lavapipe gles_mode_selected:swangle`. Therefore the successful run does **not** prove all SwiftShader-related paths were removed, nor establish that the backend change alone causally fixed the prior native crash. It establishes that this source and this selected emulator configuration passed the live-flight gate once.

The parent implementer also reports a successful separate PR Android run40508805072 and that the release run40508826040 passed its emulator gate before benchmarking/publication. Those two additional outcomes were not independently inspected in this checkpoint; their final artifacts/results must be linked by the final handover. In particular, the final release APK may have a different checksum/signing certificate because CI debug keys are ephemeral. Use the actual published release asset's hash, not this feature artifact's hash by assumption.

Physical GalaxyA51 testing, full geographic packs, the requested full visual reconstruction and remaining audit limitations are unchanged. No stable1.0 or universal device-performance claim follows from this emulator success.

## Final published artifact review — 27 October 2026

**Released experimental binaries independently verified; full project scope remains PARTIAL.** This final checkpoint supersedes the feature-only APK identity above for user delivery.

Independently queried release run [40508826040](https://github.com/mtt004/F35-flight-simulator/actions/runs/40508826040), job122205031681: completed/success, including browser regression, signed/licence-verified APK build, genuine emulator installation/live-flight, both benchmarks, evidence/checksums and immutable prerelease publication. Published release: https://github.com/mtt004/F35-flight-simulator/releases/tag/v0.1.0-experimental ; source `dd433f611b3911f49a914d65024c0e5cbe63269f`.

Reviewed `scripts/verify-release.py` and independently reran it against the downloaded successful release artifact `.tmp/final-release/dist`, saved GitHub API asset metadata, and expected source. It passed all six SHA256SUMS entries and all seven saved published asset size/digest comparisons. It explicitly separates recorded CI signing evidence from local archive verification. The current script's installation check consumes the recorded JSON; this reviewer additionally parsed the real XML directly from the evidence ZIP rather than treating that JSON as sufficient by itself.

Independent byte/content results:

- **Final APK1593761bytes**, recomputed SHA-256 `c8d2f351327ead8179105f36ae51c3996cc7bd1a8b43a41d4ab290eecc26e453`. This differs from the earlier feature APK; the final handover must use this released hash. Archive integrity passes, bundled HTML matches the current980436-byte HTML/SHA `d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198`, and all three licence assets exactly match source.
- Browser ZIP980572bytes/SHA `ce6a4d2a6b4bd5a922be18029daeaff9d5afbe0b3635509b5eaa3574a9f4d4a8`; evidence ZIP6076943bytes/SHA `6784824f616c140d7a5e5a5d14c6858caf4e65036a7290743a4f06d709fd8f3b`. Both archive integrity and cross-package HTML checks passed.
- Actual release evidence XML: **1 test,0failures,0errors,0skips**; `testBundledSimulatorLoadsAndStarts`, testcase37.585seconds. Evidence ZIP's package/installation JSON bytes exactly match the separately released JSON files. The successful emulator gate is therefore supported by raw test output, not solely a self-reported checklist.
- Signature status remains the successful CI `apksigner` record and published verification file; no local SDK signing tool was introduced. Debug signing and its ephemeral upgrade identity remain disclosed.

Read the completed published-delivery section in `docs/final-audit.md`. Its latest release-run Chrome151/two-logical-CPU measurements are correctly distinguished from earlier Chrome153 measurements, compare differing adaptive product defaults, and remain below30FPS on that CPU software renderer. They cannot certify GalaxyA51 performance. The twenty-minute cloud run likewise does not establish Android thermals, total PSS, leak absence, or real-time simulation under overload.

No new blocking release-content inconsistency was found. Remaining original acceptance gaps—physical A51 qualification, accurate geographic packs, complete visual/audio reconstruction, corrupt-save robustness, full flight-lifecycle coverage and the complete requested screenshot matrix—remain explicitly open. Final main-branch integration/documentation identity should be supplied by the implementer after committing this review and retained evidence; the published product/source identity above remains fixed.

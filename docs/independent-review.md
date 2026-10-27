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

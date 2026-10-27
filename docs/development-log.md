# Development log

## 2026-10-27 — baseline
Starting remote commit: bef85a0e73edbda4098d60eaf2c0fa2065042340.
Verified repository id 1434920630, mtt004/F35-flight-simulator, private, empty, main, admin/push access, no branches or PRs. Created initial README commit. Preserved original bytes and SHA-256. Research and browser baseline in progress.

Ruling: retain r128 this release to preserve shader and simulation compatibility; modern rendering migration needs a separate tested milestone. Ruling: use procedural authored assets to avoid unverified redistribution rights. Ruling: unavailable A51 thermal/memory testing must remain NOT TESTED.

## Source extraction, mobile graphics and Android host
Baseline remote commit9002a941a1261c414abdb49847ac90cb0359c746; feature/mobile-graphics-overhaul created. Extracted CSS/vendor/application unchanged before targeted rendering hooks; all primary physics functions preserved. Added explicit drawing-buffer/cadence profiles and hysteresis, separate HUD, restrained authored exterior/cockpit detail, shared asphalt and runway designators/terminal glazing, origin-stable terrain strata/palettes, persistent camera/control options, safe JSON palette schema and lifecycle/context recovery. Corrected source-confirmed zero-beta gyro calibration and northbound runway number00→36.

Actual local verification:23 Node equation/policy/geometry checks passed, self-contained browser package built, ZIP integrity and original SHA-256 verified. Chromium installation failed with invalid empty ZIP; local Gradle download failed Network is unreachable and SDK absent. No screenshot/APK/device-success claim. Source/build/research checkpoint pushed next to obtain real cloud CI evidence.

## Runtime and independent-review corrections
Independent review reproduced inherited profile-name startup failure; a failing Node regression now guards it. Corrected own-property validation. Separated wall cadence from the physics50ms clamp so diagnostics cannot report20FPS for a10FPS frame. Guarded settings writes and synchronized opacity controls. First real browser startup exposed a Three r128 compatibility error: Texture has no userData by default; removed the unused texture metadata assignment and reproduced/fixed it in the actual Three material test. First Android workflow failed sdkmanager not found; explicit pinned SDK setup added. Strengthened Android test so hiding boot menu cannot falsely prove gameplay; test now requires finite active state, rendering and advancing physics.

Real cloud Chromium was obtained via the npm-packaged serverless binary after the direct browser CDN download failed. After copying its supplied SwiftShader libraries beside the executable, WebGL2 worked with browser security enabled. Baseline browser regression9/9 PASS. Upgraded browser regression9/9 PASS after fixing a parser scheduling race: runtime UI hooks and simulator now share one inline script, so requestAnimationFrame cannot run between them. Added exact source-preservation tests for16 core flight/STOVL/terrain functions. Total27 Node checks pass. Replaced rectangular contact-shadow boundary with an alpha-gradient blob based on observed screenshot. Screenshots/benchmarks being captured; no A51 inference.

Android CI run40403805156 successfully compiled and signature/archive-verified the actual APK; emulator gate in progress (source0b62f4b, before later parser-bundle fix). Browser pause/resume assertion showed timing flakiness under overlapping software-renderer load; changed it to wait for actual flight-time advancement instead of assuming a500ms timer guarantees a render/physics frame. Initial concurrent graphics runs are diagnostic only and will not support a clean performance comparison; matched sequential reruns required. Benchmark reports now include exact source SHA and host metadata.

## 2026-10-27 — continuation and emulator root cause
Browser CI for424439d4 succeeded. Android APK compilation/archive/signature checks succeeded, but release40404563292 failed before app installation: emulator reported4332.99MB free and required7372.80MB for the default userdata partition. This is an emulator storage failure, not evidence of gameplay failure. Set supported2048M partition/RAM limits and no snapshots, retaining genuine installation/flight gates.

Cockpit ray casting reproduced the screenshot-confirmed display occlusion by the original panel box. Moved its structural backing behind the display and lowered the coaming. New actual-Three ray test now requires unobstructed sight from pilot eye to display centre;28 Node checks expected after full suite. No flight equations modified. Software-renderer seven-scenario sequential benchmarks captured; rebuilding after cockpit correction before final comparisons.

## Repeated emulator disk floor and focused remediation
Release40451484190 compiled and signature-verified the actual current APK; root downloaded artifact12711166312, verified ZIP integrity and exact bundled HTML, package/version/permissions and matching SHA. Emulator boot again failed, requiring7372.80MB despite2048M requested and5533.82MB free. Added GitHub-hosted-only SDK-managed unused NDK package removal after APK build, with exact package/filter/free-space evidence. No user/repository/host-library cleanup. Actual installation remains unclaimed until the next run passes.

Cloud endurance complete on current source d4ade981…:1200s requested,9176frames,7.65meanFPS/2.46FPS1%low, p95frame254ms, no crash/JS/shader errors. Simulated time advanced425.94s because inherited50ms clamp under software-renderer overload. Geometries428→532/textures11→14, finalbrowserheap35.1MB; not proof of no leaks or native/device memory. Raw samples and summary committed next.

## Native installation observed; emulator disappearance investigated
Release40453171144 reclaimed6,968,320,000bytes of unused NDK packages (17,012,506,624free afterward) and booted API33. Artifact12711986858 shows both APKs installed, MainActivity CREATED/STARTED/RESUMED/Displayed, and WebView101 logging36/36 self-tests passed. The emulator then disappeared mid-instrumentation; XML contains an empty failure plus device-notfound/expected1received0. No completed live-flight pass or app assertion cause is claimed. Guest memory did not establish guestOOM. HostOOM/native emulator crash remain hypotheses.

Moved assembleDebugAndroidTest before QEMU, bounded Gradle heap/workers and Kotlin concurrency, and added failure-preserving RSS/kernel/cgroup/emulator diagnostics and bounded emulator-owned crash-file capture. Added a clearly scoped instrumented-process PSS log only after genuine live-flight assertions. Public WebView/SwiftShader native-crash reports are alternative evidence, not proof of our rootcause. Next run must decide; test gates remain intact.

## 2026-10-27 — host renderer crash isolated

Starting remote b71f9cc78692b2db6eaeaad41f8a6e14222e1140. Fourth release test again lost emulator; new host diagnostics establish RenderThread segmentation fault, not a proven guest app assertion orOOM. Preserved selected attempt3/4 installation/XML/kernel/memory evidence in benchmarks/android. Switched only emulator software backend to documented Lavapipe and bounded dead-device diagnostics. BrowserHTML and physics bytes unchanged. Mandatory live-flight test retained; fresh build/test/release result pending.

## Direct browser-file offline verification

Executed `CHROMIUM_PATH=<packaged Chromium153> node scripts/test-offline.mjs dist/Lightning-F35B.html` with a file URL and browser networking disabled. Actual run PASS:36/36 internal checks, rendered active flight and advancing physics, finite position, zero attempted HTTP(S) requests and zero page JavaScript errors. Exact HTML SHA d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198. Script and machine-readable report are preserved; no local web server was used. This confirms the tested browser's direct offline launch, not universal file-URL persistence or a physical phone result.

## Android live-flight gate passed

Tested source dd433f611b3911f49a914d65024c0e5cbe63269f. BrowserCI runs40508799047/40508805009 and Android runs40508798727/40508805072 succeeded. Downloaded actual artifact12736870350: APK1,593,761bytes/SHA547f5b3ee3d634e6b54647c3c0a7eb6cdccf99822a5c9c38d28532557a10543f; rawXML1test/0failure/0error/0skip. Identical HTML and exact bundled licences verified. This is a checkpoint APK; final release artifact may have a different ephemeral debug key. Release40508826040 also passed its independent emulator gate and proceeded to benchmarks.

Actual backend Vulkanlavapipe/GLESswangle: successful controlled retry, not proof all SwiftShader code was avoided or native crash fully diagnosed. Raw98,699KB single instrumentedprocessPSS sample is not wholeapp/nativeGPU/peak/A51 memory. Selected success/failure records retained. No stable1.0/fullscope claim.

## Experimental release published and independently checked

Release run40508826040/source dd433f611b3911f49a914d65024c0e5cbe63269f completed all mandatory tests/build/benchmark/upload gates and published v0.1.0-experimental. Downloaded actual artifact12736489228 and matched all sixchecksums plus seven GitHub Release API sizes/digests. Actual final APK1,593,761bytes/SHA c8d2f351327ead8179105f36ae51c3996cc7bd1a8b43a41d4ab290eecc26e453 (different ephemeral certificate from feature checkpoint). Native XML1pass/0failure/0error/0skip, exactHTML/licences and browserZIP verified. Added reproducible verify-release.py and saved its actual PASS report.

Retained full latest release raw benchmarks separately under benchmarks/release-run-40508826040: Chrome151/2vCPU AMD, about2–3.5FPS CPU rasterization, below30 in this environment; prior Chrome153/endurance remain separately labelled. No A51 performance inference. End-of-implementation source is releasecommitdd433f6; subsequent commit adds only documentation, retainedQAevidence and standalone verification scripts. Final integration/mainSHA is recorded in the handover/PR. Fullscope remainsPARTIAL; issues2–5 stayopen.

## v0.2 continuation — flight/save integrity

Starting mainc53506ad59e7aad46904c3a648b0f06d6015dafd. Created feature/aircraft-and-flight-integrity without modifying releasedv0.1. Reproduced17 malformed-save failures using actual production functions/Three;2 valid legacy records passed. Actualv0.1 UI replay then reproduced changedgear/instruments andlostpause. Corrected full-vector validation before mutation, invalidcandidate writerguard, fullplayback-field/pause restoration and replay-save isolation. Targeted22/22NodeGREEN; rawRED/GREEN committed with rationale in flight-integrity-v0.2.md. No protected physics/STOVL/collision/recordReplay/updateReplay function changed. Broader geometry/version work proceeds in separate commits; realnextbrowser/native gates pending.

## Independent-review corrections and visible comparison

Source checkpoint4b52187f9008abfeaadf3827068cde0931644f08 passed Android+browserpush/PRCI. Review then reproduced stale derivedattitude/modelpose afterpausedreplay, repeatedReplayoverwritingrestoresnapshot, and nestedemptyXMLsuiteacceptance. AddedactualREDregressions andcorrectedall3;54Node+10JS+13Python checksPASS. Source-reviewreport independent-review-v0.2.md; protected16functions remainbyteidentical.

BuiltnextHTML8529330d53723356463319a96469da80fb9fc87a48ce5449abd1f47b59ed56f4 andcaptured4actualpairs againstv0.1 withsource/cameras/settings. Inspectedfront/rearquarter,underside,cockpit: boundedbody/intake/nozzlerefinement, no newblockingocclusion. Existinggear/terrain/citiesremainstylized. FreshactualUIderived/replay/corruptsave andcontrol-onlyflightQA pending; nofull-lifecycle/A51claim.

## Fresh realUI integrity gate

CorrectednextHTML8529330…passed6actualUIchecks: normalroundtrip, replayview/derivedstate, autosavereplayisolation,3corruptrecordrejections+recovery. Originalhandlercapture requiredDOMcapturelisteners innewharness; itsinitialinstrumentationFAIL isretained, then6GREEN withzeroerrors. Addednewchecks tobrowserCI/release mandatorygates. No claim ofcomplete safeSTOVLconversion followsfromaV-only mode-transitiontrace; realcontrol-onlyflightoutcomes recordedseparately. Nextproductsourcecheckpoint998f7be04faf046a71b2603a5af5748c5391017b containsreviewfixes+actualgeometrycaptures.

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

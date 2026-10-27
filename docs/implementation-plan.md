# Project Lightning implementation plan

Date: 27 October 2026. Binding spec: owner execution directive in this session (28 confirmed design decisions). User explicitly authorised implementation, pushes, private releases and safe integration; no additional design gate required.

## Architecture and decisions

Retain bundled Three.js r128 and original six-DOF physics for this experimental release; extract source and rebuild a single offline HTML. Add authored procedural visual detail and bounded mobile quality policy, with a secure Kotlin WebViewAssetLoader Android host. A full Three.js migration and external aircraft-model pipeline are deferred until compatibility/performance can be measured. Alternatives: whole-engine migration (larger regression surface), native rewrite (would discard existing systems). Both rejected for this release.

## Tasks and verification gates

- [x] Verify private repository/admin access and empty main; establish repository.
- [x] Preserve exact original and checksum in legacy; baseline checkpoint.
- [x] Extract HTML/CSS/vendor/game without changing simulation; deterministic build script and checksum regression test.
- [x] Capture original validation/browser/visual/performance evidence.
- [x] Add bounded resolution/frame cadence profiles, hysteresis and transparent runtime measurements. Test policy against overload, sustained headroom, background/resume and invalid saved values.
- [x] Improve exterior surface detailing, cockpit, airport and terrain shading without changing physics. Run original validation and screenshot matching scenes.
- [x] Add persistent camera/control/instrument options, local preset-pack validation and import; label all authored scenery accurately.
- [x] Build Kotlin Android host/API26+, local assets, fullscreen, lifecycle, origin lockdown, no native bridge. Compile/sign/verify actual APK.
- [x] v0.1 regression/offline/context-loss, cloud benchmarks/endurance and independent review completed. Actual API33 emulator installed and ran a live flight; A51 remains untested.
- [x] v0.1 source/evidence committed, PR1 merged, experimental APK/browser/evidence released and checksums independently verified.

## Review focus

Untrusted/corrupt saved settings; file import/schema bounds; WebView navigation and offline origin; background time accumulation/input reset; resource lifecycle during terrain streaming/context loss. No claims of Galaxy A51 testing until actual device evidence exists. Targets 30 FPS/600MB PSS are budgets, not measured results.

## Dependencies and interfaces

scripts/build-web.mjs produces dist/index.html, Lightning-F35B.html and browser ZIP from src. Android copies dist/index.html. npm test runs Node regression tests. Browser harness loads same distribution and baseline and reports actual cloud environment. Runtime diagnostic getters report physics/render state; any test setup uses explicitly documented controls. Separate commits per source extraction, graphics, Android/CI, evidence and review fixes.

## Acceptance honesty

All requested features remain scope, but each incomplete or unavailable gate must be marked in docs/known-issues.md and final audit. No empty placeholder regional packs. No stable v1.0 until APK/offline/playability gates and device benchmarks pass.

## v0.2 continuation — actual work, not full-scope completion

- [x] Fix issue4 saved-flight corruption and observed replay restoration/save defects; RED/GREEN plus realUI regressions.
- [x] Improve adaptive fuselage/intake/exhaust geometry; verify bounds, LOD, draw budget and actual comparison captures.
- [x] Centralize version0.2.0-experimental/code2 and bind native XML/APK/source evidence in release checks.
- [x] Exercise genuine control-only flight lifecycle; report actual passes/failures without teleporting and claiming a lifecycle.
- [x] Obtain independent review, build/test APK/browser, and publish new tag without rewriting v0.1.
- [x] Integrate PR6 after actual browser/Android CI passes (merge6f1b0d034a83af49f9ab0884b14932aa4dec1ae8).
- [x] Complete the separate v0.2 cloud wall-time endurance record; no crash/errors observed,30FPS target not met, quality0fallback. Physical-device/full-detail qualification remains open.

Starting main c53506ad59e7aad46904c3a648b0f06d6015dafd. Accurate regional geodata, full audio/world reconstruction and physicalA51 qualification remain open.

The flight exercise task means actual trials and honest outcomes: safe conversion and vertical landing failed their bounded automated attempts and remain open in issue7. See docs/delivery-v0.2.md for release provenance.

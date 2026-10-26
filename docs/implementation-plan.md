# Project Lightning implementation plan

Date: 27 October 2026. Binding spec: owner execution directive in this session (28 confirmed design decisions). User explicitly authorised implementation, pushes, private releases and safe integration; no additional design gate required.

## Architecture and decisions

Retain bundled Three.js r128 and original six-DOF physics for this experimental release; extract source and rebuild a single offline HTML. Add authored procedural visual detail and bounded mobile quality policy, with a secure Kotlin WebViewAssetLoader Android host. A full Three.js migration and external aircraft-model pipeline are deferred until compatibility/performance can be measured. Alternatives: whole-engine migration (larger regression surface), native rewrite (would discard existing systems). Both rejected for this release.

## Tasks and verification gates

- [x] Verify private repository/admin access and empty main; establish repository.
- [x] Preserve exact original and checksum in legacy; baseline checkpoint.
- [ ] Extract HTML/CSS/vendor/game without changing simulation; deterministic build script and checksum regression test.
- [ ] Capture original validation/browser/visual/performance evidence.
- [ ] Add bounded resolution/frame cadence profiles, hysteresis and transparent runtime measurements. Test policy against overload, sustained headroom, background/resume and invalid saved values.
- [ ] Improve exterior surface detailing, cockpit, airport and terrain shading without changing physics. Run original validation and screenshot matching scenes.
- [ ] Add persistent camera/control/instrument options, local preset-pack validation and import; label all authored scenery accurately.
- [ ] Build Kotlin Android host/API26+, local assets, fullscreen, lifecycle, origin lockdown, no native bridge. Compile/sign/verify actual APK.
- [ ] Run regression/offline/context-loss tests, matched cloud benchmarks and independent code review; fix confirmed regressions.
- [ ] Commit notes/research/source/evidence; create PR, integrate verified work, publish experimental release artifacts and verify checksums.

## Review focus

Untrusted/corrupt saved settings; file import/schema bounds; WebView navigation and offline origin; background time accumulation/input reset; resource lifecycle during terrain streaming/context loss. No claims of Galaxy A51 testing until actual device evidence exists. Targets 30 FPS/600MB PSS are budgets, not measured results.

## Dependencies and interfaces

scripts/build-web.mjs produces dist/index.html, Lightning-F35B.html and browser ZIP from src. Android copies dist/index.html. npm test runs Node regression tests. Browser harness loads same distribution and baseline and reports actual cloud environment. Runtime diagnostic getters report physics/render state; any test setup uses explicitly documented controls. Separate commits per source extraction, graphics, Android/CI, evidence and review fixes.

## Acceptance honesty

All requested features remain scope, but each incomplete or unavailable gate must be marked in docs/known-issues.md and final audit. No empty placeholder regional packs. No stable v1.0 until APK/offline/playability gates and device benchmarks pass.

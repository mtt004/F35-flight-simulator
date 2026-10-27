# Changelog

## 0.2.0-experimental — 27 October 2026

- Reject corrupt saved vectors/seed/orientation before world mutation; preserve the previous save when a new candidate is invalid.
- Restore live flight, attitude, displayed model/camera, pause and controls after replay; isolate autosave from replay and ignore repeated Replay starts.
- Add adaptive authored fuselage fairings, recessed intakes and articulated dark exhaust cavity; restore original body at low quality/distance. Physics/collision functions remain byte-identical.
- Centralize Android/web version metadata and require source-bound browser integrity checks, real native XML, package/signature and release checksums.
- Publish API33-emulator-tested APK and matching offline browser build. Retain control-only takeoff PASS and failed safe-conversion/vertical-landing attempts with unresolved cause.

This is an experimental incremental improvement. It does not qualify safe STOVL lifecycle, the full requested graphics reconstruction or Galaxy A51 performance. See [v0.2 delivery](docs/delivery-v0.2.md).

## 0.1.0-experimental — 27 October 2026

- Preserved the exact owner-supplied simulator/checksum; organised browser/Android source and research in the private repository.
- Added bounded30/60FPS profiles, hysteresis, separate HUD resolution, measured cadence/submission diagnostics and lifecycle/context recovery.
- Added authored close-range aircraft markings, cockpit furnishing/animated controls, unobstructed flight display, runway materials/designators and terminal/hangar details.
- Added camera tracking/distance/shake, touch offsets/opacity, instrument selector and strictly bounded palette imports.
- Added restricted offline Kotlin host, pinned Gradle/SDK/dependency/build workflows, signed-debug APK verification and real emulator-flight instrumentation.
- Corrected zero-beta gyro calibration, runway00→36, new material startup compatibility and script initialization race.
- Added real browser/equation/geometry/source-preservation checks and source-identified screenshots/benchmarks.

Full geographic scenery, extensive model/terrain/audio reconstruction and physical A51 certification remain incomplete. See docs/known-issues.md and final-audit.md. This version is experimental, not a completed1.0 overhaul.

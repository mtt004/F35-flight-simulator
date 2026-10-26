# Preserved source

- Filename: F35B_Offline_Open_World_Simulator_Advanced_Physics_Overhaul.html
- SHA-256: `cf3b450a2aaf6fe03d95207a7a9b9a33f1179bf7868b03b805cda1a8d55f3435`
- Size: 948542 bytes
- Import date: 2026-10-27 Europe/Istanbul
- Internal version: `5.3.0-realism-review-airmass-twin-spool`
- Bundled renderer: Three.js r128, MIT header present.
- Coordinates: SI units; X right, Y up, Z aft; aircraft forward is −Z. OX/OZ floating origin offsets keep global terrain generation separate from local render positions.
- Fixed physics: original accumulator loop retained; six DOF, air-mass model, twin spool engine, STOVL conversion, ground contact and navigation coupled through original state.
- Existing features inspected: seeded terrain/feature streaming, airports, roads/rail and civilian traffic, cloud and storm sprites, shader water, cockpit canvas displays/HMDS, touch/gamepad/gyro, saves and replay, missions and internal validation.
- Initial potential issue: drawing buffer initially scales to 2× CSS pixels; this can exceed the proposed A51 pixel budget. Baseline tests and screenshots recorded separately as actually executed.

This file is immutable. Product source is extracted to src; original bytes remain untouched.

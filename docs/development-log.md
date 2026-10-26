# Development log

## 2026-10-27 — baseline
Starting remote commit: bef85a0e73edbda4098d60eaf2c0fa2065042340.
Verified repository id 1434920630, mtt004/F35-flight-simulator, private, empty, main, admin/push access, no branches or PRs. Created initial README commit. Preserved original bytes and SHA-256. Research and browser baseline in progress.

Ruling: retain r128 this release to preserve shader and simulation compatibility; modern rendering migration needs a separate tested milestone. Ruling: use procedural authored assets to avoid unverified redistribution rights. Ruling: unavailable A51 thermal/memory testing must remain NOT TESTED.

## Source extraction, mobile graphics and Android host
Baseline remote commit9002a941a1261c414abdb49847ac90cb0359c746; feature/mobile-graphics-overhaul created. Extracted CSS/vendor/application unchanged before targeted rendering hooks; all primary physics functions preserved. Added explicit drawing-buffer/cadence profiles and hysteresis, separate HUD, restrained authored exterior/cockpit detail, shared asphalt and runway designators/terminal glazing, origin-stable terrain strata/palettes, persistent camera/control options, safe JSON palette schema and lifecycle/context recovery. Corrected source-confirmed zero-beta gyro calibration and northbound runway number00→36.

Actual local verification:23 Node equation/policy/geometry checks passed, self-contained browser package built, ZIP integrity and original SHA-256 verified. Chromium installation failed with invalid empty ZIP; local Gradle download failed Network is unreachable and SDK absent. No screenshot/APK/device-success claim. Source/build/research checkpoint pushed next to obtain real cloud CI evidence.

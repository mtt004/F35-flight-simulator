# Known issues and incomplete scope

Experimental implementation. No Galaxy A51 device is connected. Do not label as a full completed overhaul or stable1.0.

- Actual A51 FPS, PSS, 20-minute thermal/battery behaviour and gyroscope response: NOT TESTED.
- The first local browser/SDK downloads failed. A packaged Chromium153 with SwiftShader subsequently ran real browser tests; Android builds run in GitHub Actions. Check the final audit for the actual latest build/install/release outcomes.
- Accurate Hampshire/Farnborough and Cappadocia terrain/transport/airports: NOT IMPLEMENTED. Included appearance palettes change colours only; geography remains seeded/fictitious.
- Aircraft remains procedural F-35B-inspired, not validated production CAD. Added close detail and cockpit refinement do not replace the entire baseline model.
- Modern Three.js migration/glTF/KTX2/recorded audio, physically exact atmospheric scattering, heat shimmer and reflective scenery: NOT IMPLEMENTED. Existing procedural audio/cloud/water/weather systems retained.
- No real flight envelope validation or empirical aircraft-data calibration. Flight equations preserved; existing internal validation includes constant/limited tests, not complete flight validation.
- Original terrain collisions use the continuous height function; lower-resolution rendering approximates it. No new collider mesh is introduced.
- Original fixed-step simulation clamps frame delta at50ms. Severe overload can slow simulation time; the cap does not establish deterministic real-time playback across arbitrarily long stalls.
- Browser file:// localStorage persistence is browser dependent. HTTPS Android asset origin has stable app storage.
- Debug APK signing uses ephemeral CI identity. Future CI builds may require uninstalling, losing app data. Stable release signing requires owner-controlled secrets; no private key committed.
- Screenshot/benchmark coverage reflects only the environments actually present in reports. Cloud software rendering is not Mali-G72 evidence.

- Saved-flight corruption and normal paused-replay restoration were corrected in the v0.2 branch with production-function and actualUI regressions. Use v0.2 or later for the fix; historical v0.1 retains the recorded gap. See docs/flight-integrity-v0.2.md.
- Terrain palette's primary coordinates include the floating origin, but some secondary colour-warp terms still use render-local coordinates; long-distance rebasing may produce a subtle material phase change. Terrain height/collision remain unchanged.
- Available visual evidence covers seven paired scenes. The entire requested12-scene acceptance suite and independent manufacturer/CAD comparison are incomplete.

- Safe STOVL conversion/vertical landing remains unqualified. Actual control-only takeoff passed, but exploratory conversion/landing pilots failed stated quality criteria or timed out without touchdown. No unavoidable model defect or new regression is inferred; cause between pilot/controller and inherited model remains unresolved. Raw source-identified traces are under benchmarks/next and issue7.
- v0.2 improves close aircraft surface/exhaust geometry and save/replay integrity; cities, geographic scenery, recorded hybrid audio and the requested full visual reconstruction remain unfinished.

- Completed v0.2 cloud endurance:30FPS target not met (7.64mean), quality0hid adaptive detail, and resource counters ended above their initial values during streaming. Cache/retention/leak causes and sustained high-detail/native/device behavior remain unresolved; see benchmarks/v020-endurance-complete/summary.json.

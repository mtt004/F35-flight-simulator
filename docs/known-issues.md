# Known issues and incomplete scope

Experimental implementation. No Galaxy A51 device is connected. Do not label as a full completed overhaul or stable1.0.

- Actual A51 FPS, PSS, 20-minute thermal/battery behaviour and gyroscope response: NOT TESTED.
- The first local browser/SDK downloads failed. A packaged Chromium153 with SwiftShader subsequently ran real browser tests; Android builds run in GitHub Actions. Check the final audit for the actual latest build/install/release outcomes.
- Accurate Hampshire/Farnborough and Cappadocia terrain/transport/airports: NOT IMPLEMENTED. Included appearance palettes change colours only; geography remains seeded/fictitious.
- Aircraft remains procedural F-35B-inspired, not validated production CAD. Added close detail and cockpit refinement do not replace the entire baseline model.
- Modern Three.js migration/glTF/KTX2/recorded audio, physically exact atmospheric scattering, heat shimmer and reflective scenery: NOT IMPLEMENTED. Existing procedural audio/cloud/water/weather systems retained.
- No real flight envelope validation or empirical aircraft-data calibration. Flight equations preserved; existing internal validation includes constant/limited tests, not complete flight validation.
- Legacy terrain retains its continuous height function. London ground contact uses the same piecewise triangles as the near 100 m DEM mesh; coarser distant LODs approximate that surface. Landmark collision uses authored analytic volumes; generic buildings use footprint/estimated-height tests.
- Original fixed-step simulation clamps frame delta at50ms. Severe overload can slow simulation time; the cap does not establish deterministic real-time playback across arbitrarily long stalls.
- Browser file:// localStorage persistence is browser dependent. HTTPS Android asset origin has stable app storage.
- Debug APK signing uses ephemeral CI identity. Future CI builds may require uninstalling, losing app data. Stable release signing requires owner-controlled secrets; no private key committed.
- Screenshot/benchmark coverage reflects only the environments actually present in reports. Cloud software rendering is not Mali-G72 evidence.

- Saved-flight corruption and normal paused-replay restoration were corrected in the v0.2 branch with production-function and actualUI regressions. Use v0.2 or later for the fix; historical v0.1 retains the recorded gap. See docs/flight-integrity-v0.2.md.
- Terrain palette's primary coordinates include the floating origin, but some secondary colour-warp terms still use render-local coordinates; long-distance rebasing may produce a subtle material phase change. Terrain height/collision remain unchanged.
- V0.3 adds twelve fixed V2/London visual pairs. These establish appearance, not continuous-flight correctness or manufacturer/CAD accuracy.

- Safe STOVL conversion/vertical landing remains unqualified. Actual control-only takeoff passed, but exploratory conversion/landing pilots failed stated quality criteria or timed out without touchdown. No unavoidable model defect or new regression is inferred; cause between pilot/controller and inherited model remains unresolved. Raw source-identified traces are under benchmarks/next and issue7.
- V0.3 adds the real OS London corridor, authored landmarks and Heathrow. It remains a stylized experimental reconstruction: assumed building heights, repeated facade windows/flat roofs, simplified terminals and vector-derived ground artwork. Recorded hybrid audio and commercial-simulator visual parity remain unfinished.

- Completed v0.2 cloud endurance:30FPS target not met (7.64mean), quality0hid adaptive detail, and resource counters ended above their initial values during streaming. Cache/retention/leak causes and sustained high-detail/native/device behavior remain unresolved; see benchmarks/v020-endurance-complete/summary.json.


## V0.3 London limits

- Real coverage is 39 × 15 km, Heathrow to Docklands. Outside coverage the world smoothly blends into explicitly synthetic legacy terrain; it is not reconstructed London.
- The pack selects 40,000 OS building footprints; 11 are suppressed to avoid overlap with curated landmarks. Building heights are assumed categories, not surveyed heights. Landmarks are original authored approximations.
- The complete water geometry remains present while terrain/building tiles stream. Incremental geometry work has a soft 6 ms budget: a complex feature, final merge or garbage collection may exceed it. City cache limits are profile-dependent; no full-process/GPU memory guarantee is claimed.
- Terrain LOD uses distance/altitude thresholds and skirts; a full screen-space-error quadtree with geomorphing is not implemented. Urban LOD retains three geometry levels and old meshes during replacement; transitions can still be visible.
- Traffic Intercept and Offshore Recovery are explicitly Legacy only. They depend on procedural traffic/deck objects absent from London. Other mission qualification is bounded by existing test coverage; the unresolved safe-STOVL landing gate remains open.
- Local SwiftShader rendering is below 30 FPS, with repeated long frame intervals in city views. This is a failed performance target in the measured software environment. Galaxy A51 performance remains NOT TESTED, so mobile smoothness is not accepted.
- No complete control-only Heathrow–London–Heathrow round trip, new 20-minute London endurance, physical multitouch/gyroscope, battery or thermal test has been completed. Context restoration, genuine runway takeoff, saved flight/replay and actual emulator launch have separate recorded tests.

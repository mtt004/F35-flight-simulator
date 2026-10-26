# Known issues and incomplete scope

Experimental implementation. No Galaxy A51 device is connected. Do not label as a full completed overhaul or stable1.0.

- Actual A51 FPS, PSS, 20-minute thermal/battery behaviour and gyroscope response: NOT TESTED.
- Local Chromium binary/Android SDK absent; initial downloads failed. GitHub Actions results must be checked separately before claiming browser or APK success.
- Accurate Hampshire/Farnborough and Cappadocia terrain/transport/airports: NOT IMPLEMENTED. Included appearance palettes change colours only; geography remains seeded/fictitious.
- Aircraft remains procedural F-35B-inspired, not validated production CAD. Added close detail and cockpit refinement do not replace the entire baseline model.
- Modern Three.js migration/glTF/KTX2/recorded audio, physically exact atmospheric scattering, heat shimmer and reflective scenery: NOT IMPLEMENTED. Existing procedural audio/cloud/water/weather systems retained.
- No real flight envelope validation or empirical aircraft-data calibration. Flight equations preserved; existing internal validation includes constant/limited tests, not complete flight validation.
- Original terrain collisions use the continuous height function; lower-resolution rendering approximates it. No new collider mesh is introduced.
- Original fixed-step simulation clamps frame delta at50ms. Severe overload can slow simulation time; the cap does not establish deterministic real-time playback across arbitrarily long stalls.
- Browser file:// localStorage persistence is browser dependent. HTTPS Android asset origin has stable app storage.
- Debug APK signing uses ephemeral CI identity. Future CI builds may require uninstalling, losing app data. Stable release signing requires owner-controlled secrets; no private key committed.
- Screenshot/benchmark coverage reflects only the environments actually present in reports. Cloud software rendering is not Mali-G72 evidence.

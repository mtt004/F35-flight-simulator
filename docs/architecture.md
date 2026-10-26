# Architecture

`legacy/` preserves the exact input. `src/index.template.html`, `src/ui/base.css`, `src/vendor/three-r128.min.js` and `src/simulator.js` are extracted from it. This first release keeps simulation code together rather than splitting its shared state across a risky rewrite.

`scripts/build-web.mjs` embeds every product script/style in one HTML and writes a deterministic ZIP. No runtime network assets, package manager or server are needed to play. Open Lightning-F35B.html in a WebGL2 browser; Android bundles the same bytes through WebViewAssetLoader.

- `src/rendering/mobile-policy.js`: pure buffer bounds, frame cadence, profile validation, hysteresis and appearance schema. Render cadence is 30Hz default; original 120Hz fixed-step accumulator executes unchanged within each accepted frame, subject to its existing50ms delta clamp/8-step ceiling. Long stalls still slow simulation rather than simulating unlimited catchup.
- `src/aircraft/detail.js`, `src/cockpit/detail.js`: original procedural visual extensions and bounded animation. Existing aircraft geometry/STOVL surfaces remain.
- `src/terrain/scenery.js`: origin-stable terrain shading, palette/strata studies, shared asphalt, directional runway designators and instanced airport details. Terrain height/collision functions are unchanged.
- `src/ui/runtime.js`: settings, optional palette import, lifecycle save/pause/reset, context restoration and diagnostic overlay. Stored in a separate options key to preserve baseline saves.
- `android/`: Kotlin restricted origin shell. No Internet permission, arbitrary file URL access or native bridge. Android uses the system WebView, which must support WebGL2.

All product code loads as classic scripts, preserving original global state and diagnostic inspection. Build/runtime hooks are explicit. The geometry-level suite runs real bundled Three.js with a 2D texture stub, which cannot validate GPU shaders.

Quality: Battery540px nominal vertical, Balanced648px, High900px, Fast648px; governor scales within profile and caps total drawing-buffer area at1.2million pixels. HUD backing canvas remains separately sized (DPR capped2). CPU timing covers JavaScript plus graphics submission, not asynchronous GPU execution. Profile selection alone cannot guarantee thermal or FPS performance.

Resource ownership: shared procedural geometry/materials remain pooled. Newly created runway atlas textures are explicitly owned by their disposable materials. Original resource accounting needs real sustained-flight checks before memory safety claims.

# Aircraft and cockpit visual extension

Implemented 27 October 2026. These authored procedural additions refine the existing simulator; they are not a replacement for the original aerodynamic model or a production-CAD F-35B reconstruction.

## Runtime integration

Load `src/aircraft/detail.js` and `src/cockpit/detail.js` after Three.js and before the simulator script. Both extend `window.LightningVisuals` without replacing the namespace.

Call after the original exterior and cockpit exist:

```js
LightningVisuals.buildAircraftDetail(THREE, ac, AC_SURF);
LightningVisuals.buildCockpitDetail(THREE, cockpitGrp);
```

Call before rendering:

```js
const visualState = {
  distance: camera.position.distanceTo(P.pos), quality: qlLevel,
  night: nightF, roll: ailIn, pitch: elIn, throttle: thr
};
LightningVisuals.updateAircraft(visualState);
LightningVisuals.updateCockpit(visualState);
```

Prefer a reused state object in the main loop. The update functions allocate no geometry, textures or scene nodes. Build calls are idempotent. The original aircraft transforms, flight-control surfaces and STOVL animations remain authoritative. The new lift-door plate is a child of the existing animated door.

## Exterior changes

- One authored 512×256 atlas carries low-contrast generic identification marks, small service lettering and NO STEP labels. No real squadron crest, copyrighted livery texture or downloaded model is included.
- Upper-wing and dorsal service seams are batched into one `LineSegments` draw.
- The atlas markings use one batched mesh; the moving lift-door plate uses another. Maximum extension cost is three draws in close views, with two geometries sharing the atlas material/texture.
- Detail is enabled only at quality level 1 or above. It appears inside 115 m and remains visible until 145 m, avoiding distance-boundary flicker. Base silhouette, gear and navigation lights remain available at every quality level.
- The static original model already includes lift-system components, control surfaces, intakes, canopy and nozzle geometry; those have not been replaced or double-animated.

## Cockpit changes

- Curved forward canopy bow, display bezel rails and recessed canopy-sill fasteners.
- Seat cushions, side bolsters, harness webbing, buckles and an ejection-handle visual.
- Two console surfaces share one 512×256 authored atlas. Their illumination follows night state. These small switch legends are decorative, not additional interactive controls.
- Right side-stick tracks processed roll/pitch input. Left throttle lever tracks throttle. Inputs are bounded and non-finite values safely fall back to neutral/idle.
- Static box details are instanced by material; cockpit furnishings add 13 draws only while the cockpit parent is visible. Existing PCD pages and HUD remain the working instruments.

## Verification performed

`node --check` passed for both scripts. A Node VM loaded the actual bundled Three.js r128 and both detail scripts with a canvas drawing stub. It verified:

- Both builders return their existing groups on repeated calls.
- All generated position attributes contain finite values.
- LOD enters at 115 m and exits at 145 m; the moving plate follows group visibility.
- Exactly two atlas textures are referenced by the new geometry.
- Out-of-range and non-finite control values produce bounded neutral/idle rotations.
- 1,000 update calls produce no scene-node growth.

Result: 16 renderable nodes, 13 unique geometries, two atlas textures across both extensions. This validates scene construction and update behavior, **not** shader compilation, GPU memory usage, screenshot quality or A51 frame rate. Those require the browser/Android harness and real-device evidence.

## Limitations

No new flight-physics claims. No claim of exact F-35B interior geometry or real instrument-switch fidelity. Generic markings are deliberately labelled experimental. The extra cockpit draws and close-range visual benefit must be assessed in captured browser views and on the Galaxy A51; local VM results cannot establish those outcomes.

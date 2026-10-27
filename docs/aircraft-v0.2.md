# Adaptive aircraft surface model — v0.2 continuation

Date: 27 October 2026. Implementation: `src/aircraft/detail.js`. New regression tests: `tests/unit/aircraft-model.test.mjs`.

## Implemented behavior

The near-view exterior now uses a smoother, closed procedural fuselage loft with 76 longitudinal stations and 48 radial facets. Its 16 controlling stations retain the preserved source's envelope and centreline; intermediate dimensions use bounded cubic interpolation. The nose remains at −8.24 m and the aft station at +7.34 m in aircraft-local Z. The mesh uses outward triangle winding and single-sided physically based material. It is an authored visual approximation, not manufacturer CAD or validated aerodynamic geometry.

Smooth wing-root fairing sheets bridge the abrupt visual join between the original wing plates and upper shoulders. Paired recessed intake interiors add depth without changing the original intake surfaces, collision tests or flight forces.

The exhaust adds scalloped alloy petals, a dark inner tunnel, swept turbine vanes and an opaque recessed end face. This end face addresses the visible scenery-through-nozzle defect in the prior parked screenshot. The entire new exhaust assembly is a child of `AC_SURF.nozzle`, so existing STOVL nozzle rotation remains authoritative. The afterburner remains the original simulation-driven system.

## LOD and integration

No new simulator hook is required. Existing `buildAircraftDetail(THREE, ac, AC_SURF)` and `updateAircraft({distance, quality, night})` calls construct and update the model.

At quality level ≥1, the near model enters inside 115 m and remains enabled until 145 m. While active it hides only the original named mesh `F35B blended faceted fuselage`. When distance or quality disables the detail, that original mesh is restored and all new surface/exhaust groups are hidden. The original wing, gear, control-surface and lift-system meshes are never hidden or reparented by this extension.

Cockpit visibility is still controlled by the original `ac.visible` parent: when the simulator switches to the cockpit, the entire exterior parent is hidden, including the new model. The extension never moves the new body into the cockpit parent. It therefore adds no independent cockpit obstruction. Existing cockpit-display sightline regression remains green.

## Measured geometry and draw budget

Measured with the actual bundled Three.js r128 in a Node VM; canvas paint calls were stubbed. These are construction counts, not GPU timing, memory residency or rendered-frame measurements.

| New/detail geometry | Vertices | Triangles | Typed-array bytes |
| --- | ---: | ---: | ---: |
| Adaptive fuselage | 3,650 | 7,296 | 131,376 |
| Blended wing-root fairings | 126 | 192 | 4,176 |
| Recessed inlet interiors | 14 | 12 | 408 |
| Scalloped nozzle petals | 192 | 288 | 6,336 |
| Exhaust tunnel and turbine vanes | 168 | 120 | 4,752 |
| Opaque turbine closure | 50 | 48 | 1,888 |
| Existing markings, seams and moving-door plate | 64 | 12 | 1,320 |
| **Aircraft extension total** | **4,264** | **7,968** | **150,256** |

The extension has nine potential draws in a close exterior view, including the three prior markings/seam/door draws. The six new model draws replace one visible legacy fuselage draw, so the maximum net increase against the prior close exterior is five draws. All these counts are per ordinary render pass; driver work, transparent overdraw and other aircraft/world geometry are excluded.

No extra image atlas was added. The extension still uses its one original 512×256 markings atlas: 524,288 bytes at uncompressed RGBA8 base level, approximately 699,051 bytes including a complete mip chain, excluding browser/driver overhead. These are calculated texture budgets, not measured GPU/process memory.

## Verification

Three new tests were observed failing before implementation, then passing:

1. Higher-detail fuselage is present, finite, within its expected envelope and winds side triangles outward.
2. Near/far and quality changes restore the original fuselage, and the added exhaust follows the existing articulated nozzle parent.
3. Exhaust includes an opaque recessed closure; geometry, vertex, triangle, atlas and draw budgets are bounded and runtime metadata matches the constructed scene.

Command: `node --test tests/unit/aircraft-model.test.mjs tests/unit/visual-assets.test.mjs`.

Result: **9 passed, 0 failed**, including the six existing visual tests for finite/indexed geometry, atlas/draw budget, idempotence, LOD hysteresis, cockpit animation and flight-display sightline. `node --check src/aircraft/detail.js` also passed.

Source inspection confirms no changes to `src/simulator.js`, flight physics, collision geometry, original control-surface transforms or their update routines. Root integration owns the final whole-suite run and real browser captures.

## Remaining verification and limitations

Before/after screenshots and shader compilation for this new geometry must be captured by the browser harness against source-identified builds. At this handoff they are **NOT TESTED** for the new geometry. Galaxy A51 frame rate, GPU timing, thermals, Android PSS and sustained behavior remain **NOT TESTED**. Existing physics tests cannot establish visual realism or real aircraft accuracy.

The smooth body follows the source's approximate section envelope. Fairings and intake depths are artist-authored approximations and need inspection from front, rear and low-side views for overlap artifacts. The adaptive layer refines the existing model; it does not claim to deliver the full requested production-quality F-35B exterior or a validated aircraft skin. Wheel/landing-gear reconstruction remains future work.

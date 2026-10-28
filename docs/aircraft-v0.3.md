# Aircraft and cockpit v0.3

This authored visual pass adds open inlet cowls, rolled lips and recessed ducts; a recessed engine bore; gear braces and torque links; and raised cockpit switches, guards, rudder pedals and throttle detents. It remains an approximate visual model, without authenticated production geometry or downloaded textures.

The inexpensive inlet and exhaust core uses the existing 115/145 metre distance hysteresis on every quality setting. Quality zero still hides the V2 adaptive fuselage and markings and restores the original faceted body. The public `modelVersion: 2` contract is preserved.

The adaptive fuselage no longer has an aft centre disc. The three original articulated nozzle segment cylinders are opened in place, preserving their pivots and animation. An opaque recessed turbine closure shares a draw with the inner tunnel and vanes. The existing lift-door plate, nozzle, gear retraction and wheel transforms remain authoritative. Gear braces attach to the original gear pivots; torque links attach to the original wheel groups.

Raised console parts use the existing material instance batches. The PCD remains unobstructed, and the existing processed-input stick and throttle animation remains unchanged. No flight physics, collision, legacy source or control law changes are included.

## Verification

Five regression tests were first run against the original sources and failed for the missing independent core, gear links, raised controls and blocked engine bores. They exercise the bundled Three.js r128 geometry and transforms, including raycasts through the engine at qualities zero and one. The aircraft model, new v0.3 and visual asset suites then passed all 14 tests. The complete `npm test` run passed 67 tests plus project configuration (10/10) and Android metadata (13/13) self-tests. Geometry tests cover finite attributes, indexes, the existing authored draw and atlas budgets, LOD behavior, pivot parenting and the PCD sightline; they do not claim GPU or device performance.

The near inlet/exhaust core uses four draws. Cockpit furnishings retain 15 draws. The gear-free combined fixture remains within its existing 24-draw budget. Real landing gear adds six small authored batches, with one brace mesh per original gear pivot and one torque-link mesh per original wheel group; they follow their parents without per-frame geometry updates.

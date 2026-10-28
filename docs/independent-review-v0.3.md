# Independent v0.3 review

Review date: 2026-10-28. Scope: the London integration, geographic preprocessing,
terrain/material integration, collision, save migration, origin rebasing and the
twelve actual `screenshots/london-v0.3/after` captures. This is a separate code
and image review, not independent device testing.

## Visual judgment

The captures demonstrate a substantial geographic improvement over the project's
procedural-world approach: a continuous recognizable Thames corridor, dense
urban footprints, parks, parallel Heathrow runways, and recognizable Tower Bridge,
Shard, Gherkin, St Paul's and Docklands silhouettes. The day, sunset and night
views form a coherent stylized London scene. The city is recognizably more than
a generic generated settlement.

The result remains simplified. Most buildings share estimated heights, flat
roofs and repeated window shading; the airport uses large authored terminal
volumes; roads and ground artwork are map-derived. These are visible experimental
limitations, not evidence of aerial imagery or commercial-simulator realism.
The aircraft exterior/nozzle and raised cockpit controls are present and legible.

No blank scenery, broken Tower Bridge span, missing river segment or invalid
geometry was apparent in the low/medium-altitude captures. The regenerated
`10-high-altitude.png`, independently rechecked after the London horizon correction,
also passes: the earlier angular upper-frame band is gone, the Thames remains
continuous, and distant scenery blends consistently into the fog.
The captures also contain frozen flight telemetry, including contradictory ground
speed/parked indications. They establish appearance only, not flight correctness.

## Findings and correction status

| Finding | Evidence | Status at review |
| --- | --- | --- |
| Two London mission options could not function | London emptied route traffic, while interception acquired only `civAir[0]`; recovery generated a legacy deck that London rendering and height sampling did not support | Corrected in source: both options are marked Legacy only and disabled in London; scenario population/application normalize restored unsupported choices |
| Unbounded synchronous geometry caused streaming stalls | Actual-data CPU reproductions below | Incremental feature jobs, lazy building bases and atlas-backed roads added; the latest CPU helper substantially improves typical update time, with remaining soft-budget and host-variance limits |
| Generic footprint collision filled Buckingham's authored courtyard | At `(22063.7710,18.0081,-3678.5063)`, landmark collision was false but combined London collision was true | Corrected: clearance exclusions remove eleven generic footprints; an actual-data rerun reports the courtyard clear and the Tower Bridge opening still clear |
| High-altitude visual artifact | Angular upper-frame band in the first `10-high-altitude.png` | Corrected: independently viewed regenerated capture has no upper-frame band and passes the geographic visual gate |

## Actual-data CPU reproduction before streaming correction

Using Node, the bundled Three.js r128 and the generated OS dataset, without any
GPU renderer: 40,000 buildings, 8,838 surfaces and 85,600 roads were loaded.
Eager London initialization took 3,199 ms. Creating fixed London geometry took
266 ms. Twelve Westminster updates at `(23200,-4000)`, altitude 200 m, quality 1,
took 43–124 ms each while adding one building tile and two ground tiles.
Representative building-only tile builds took approximately 20–115 ms for
detailed LODs. These historical figures establish why a tile-count cap did not
constitute a frame-time budget. They are not final-build benchmark results.

The subsequent source revision splits work into eight-feature batches under a
soft six-millisecond loop budget, computes building bases lazily, rejects water
polygons by their bounding boxes, and uses the complete road atlas instead of
rebuilding distant road ribbons. One complex feature or final attribute merge can
still exceed the soft budget. Physical-device performance remains unestablished.

The current `benchmarks/london-v0.3/streaming-cpu.json` records 600 update ticks:

| CPU-only measurement | Latest helper result |
| --- | ---: |
| Load | 573.51 ms |
| Fixed geometry creation | 283.27 ms |
| Update median | 7.22 ms |
| Update 95th percentile | 13.06 ms |
| Update 99th percentile | 22.08 ms |
| Maximum observed update | 30.65 ms |

That helper isolates the city implementation without loading landmarks, so it
reports 40,000 buildings; the combined landmark-clearance reproduction reports
39,989. These figures cannot be treated as a full browser or APK frame-time
measurement. The integration owner also reported a rare 155 ms maximum in a
preceding host run. Host contention, garbage collection and complex-feature work
remain sources of variance; the six-millisecond budget is explicitly soft.

## Other reviewed behavior

Water is represented by permanent polygon geometry with islands retained, while
the matching mask removes underlying terrain. Shared terrain material ownership,
world disposal, the airport-proxy reset, saved-world migration, and replay-buffer
translation during rebasing appeared internally consistent. No further blocking
shader, finite-index, save-mode or disposal defect was identified in this pass.

The preprocessing verifies source byte counts and hashes, preserves polygon
holes, validates finite clipped geometry, and packages source attribution and the
OGL text. A mutable upstream source edition intentionally fails its pin check.

The Android instrumentation source requires actual WebGL draw calls and advancing
flight physics from a fresh install. This review did not execute an Android
emulator, inspect final CI results, or test a Galaxy A51. Final APK hash/install
evidence must come from the actual successful build and instrumentation run.

## Gate

The London captures, including the corrected high-altitude view, pass this review
as an experimental stylized geographic milestone. Final functional acceptance
remains conditional on the completed takeoff/regression checks and successful
final-build CI/APK evidence. The subsequent integration evidence records the isolated takeoff suite at 7/7 and
GitHub browser CI run 40709469799 at success (source 6a73eddc). These are integration
owner verification results, not additional independent device testing.
No physical Galaxy A51 or sustained thermal/battery claim is supported here.

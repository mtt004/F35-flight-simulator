# Saved flight and replay integrity — v0.2 continuation

27 October 2026. Starting main c53506ad59e7aad46904c3a648b0f06d6015dafd; prior released product dd433f611b3911f49a914d65024c0e5cbe63269f. Work branch feature/aircraft-and-flight-integrity. Original legacy file remains untouched.

## Confirmed problems and executed reproductions

The old continueSavedFlight checked only position/quaternion and accepted Number-convertible values without converting arrays. Empty velocity/rate arrays entered real Three.js vectors as undefined; null/numeric-string/zero or overflowing orientations also bypassed its gate. The original save writer checked only position/velocity and could replace a good record with invalid quaternion/rates. The actual extracted production functions and bundled Three implementation reproduced17 failing corruption cases, with2 legitimate-save cases passing. Selected RED output is benchmarks/next/save-validation-red.tap.

An actual browser replay in the released HTML also reproduced changed gearD, IAS, Mach and gNz plus paused=true becomingfalse; source inspection confirmed playback writes nozzle/throttle too. Raw source-hash/environment-identified browser RED: benchmarks/next/v010-lifecycle-red.json. Two production-function replay tests and a replay-save test failed before fixing; RED transcript replay-state-red.tap. Rendering/world side effects in Node tests are stubs; vector/quaternion transforms and save/replay functions execute real production code. Full UI/game behavior is tested separately in the browser.

## Corrections

validSavedFlight validates every vector before world or flight mutation: exact lengths, strictly finite numeric components (including sparse entries), valid integer seed1–999999, nonzero safely normalizable quaternion, and broad corruption bounds. PositionX/Z magnitude<=1e12m, Y between-12000 and1e7m; velocity components<=10000m/s; body rates<=100rad/s; quaternion norm>1e-6 and<=1e6. These guard gross corruption and floating-point hazards; they are not calibrated aircraft operating limits.

Invalid records leave world/aircraft state unchanged and show guidance to start new or clear saved data. Valid simulator-generated saves retain their format and restore absolute world coordinates; numeric-string vectors are deliberately rejected. Optional scalar fields use finite-number defaults/clamps. The writer applies the same full validation and retains the previous flight if the candidate is invalid. No existing stored record is silently deleted.

Replay captures/restores every live field actually overwritten by playback, including rendered engine/gear/nozzle values, air-data/G instruments and original pause mode. Paused replay returns to the visible pause overlay. The saver keeps the last live-flight record during replay. The original recordReplay/updateReplay implementations and all16 protected core physics/STOVL/collision functions remain unchanged.

## Verification boundary

The22 targeted Node tests passed after correcting the three reproduced replay failures and17 save-corruption failures. Actual normal save/UI-continue plus replay and malformed-record browser tests run against the rebuilt next version; results have explicit build hashes. This does not certify a complete takeoff/hover/transition/landing lifecycle, native/device stability, or GalaxyA51 performance. Those gates remain separate.

## Independent review corrections

Review reproduced a second Replay click replacing the original restoration snapshot and found stale heading/body basis after restoring a paused replay. New tests use actual production updateAttitudeData and repeated playback calls:3/3 initiallyfailed, thenpassed after an active-replay guard and derived attitude/aircraft/cockpit/camera/visibility refresh. Protected physics/record/updateReplay functions remain unchanged. The camera returns to its selected mode anchored to the restored aircraft; filters reset. Full visible-view behavior is verified by the fresh browser harness rather than the Node rendering stubs.

The release-proof parser also accepted a nested empty suite declaring an uncompleted test. Preserved actual failing self-check in xml-evidence-red.txt; now validates each declared suite/aggregate count against all descendant cases, including zero-child suites. All54Node+10JSconfig+13Pythonmetadata checks pass. This closes an evidence-validation defect; it does not imply the earlier successful native reports were false.

## Fresh browser proof on the corrected build

Actual realUI run v020-lifecycle-derived-ui-8529330d5372.json:6PASS/0FAIL, zero page/shader/network errors. ExactHTML8529330d53723356463319a96469da80fb9fc87a48ce5449abd1f47b59ed56f4. New assertions check attitude/basis against independent quaternion math, actual aircraft/cockpit transforms, selected camera position/quaternion/FOV, visibility/pause state and a repeated realReplay button click preserving the first snapshot/clock. The runner uses capture-phase DOMlisteners because original eventlisteners retain their function references; an earlier harness attempt wrongly wrapped globalstartReplay and failed to observe clicks. That test-instrumentation failure is retained with its exacthash; it is not a simulator defect.

CI and release now execute these six realUI integrity checks as mandatory gates. Actual control-only takeoff/hover-start landing and V-only transition remain separate exploratory scenarios; automatic mode conversion does not establish safe acceleration/recovery or a complete flight lifecycle. Raw trajectories record real commands/outcomes and are not fabricated teleports.

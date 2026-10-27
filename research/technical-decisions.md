# Research-backed technical decisions

27 October 2026. This file records rationale; implementation/test reports are authoritative for what shipped.

| Decision | Basis | Trade-off / reversal condition |
| --- | --- | --- |
| Preserve the bundled r128 renderer for this pass | Direct code inspection; official versioned renderer docs | Older dependency remains. Revisit after a dedicated parity-tested migration branch. |
| Keep fixed-step flight simulation independent of render cap | Existing architecture and numerical-stability reasoning | Frame pacing must still accumulate actual elapsed active time without large resume jumps. |
| Use explicit limited 3D resolution with independently sharp HUD | Official Three responsive guide; Nixon et al. abstract (see Consensus review) | Small exterior features soften; resolution and LOD must be tested together. |
| Default to bounded layered clouds, no full volumetric ray marching | Arm overdraw guidance and target GPU budget; engineering inference | Lower atmospheric fidelity than desktop simulators. Revisit only with measured headroom. |
| Author model/material/detail procedurally | Existing architecture; avoids acquiring unverified redistribution rights | Geometry is visually inspired, not a validated manufacturer CAD model. |
| Bundle local assets using synthetic HTTPS WebView origin | Official Android WebViewAssetLoader docs | Updates require a new APK. Deny external resource/navigation fallbacks. |
| Separate context loss from renderer process death | Khronos primary sources; SOFA unverified distinction | Different recovery/state-loss boundaries need separate tests. |
| Treat real regions as deferred data products unless actual elevation/transport data is imported and licensed | Primary provider/licence review | A colour/biome preset does not count as an accurate Hampshire or Cappadocia scenery pack. |
| Label software-rendered cloud benchmarks separately | Measurement validity | They can detect gross regressions but cannot certify Mali-G72 FPS, PSS or heat. |

Rejected unsupported claims: photorealism, real A51 certification, physically exact F-35B performance, delivered geospatial accuracy from a procedural seed, hybrid recorded audio when no recordings are included, and APK installation success inferred merely from compilation.

## v0.2 decisions and evidence classification

- **Saved-flight rejection before world mutation:** direct production-code inspection and reproduced RED/GREEN tests (`benchmarks/next/save-validation-red.tap`, `tests/unit/saved-flight.test.mjs`). Broad finite/vector/seed/quaternion bounds are **engineering corruption guards**, not researched aircraft operating limits; valid historical records remain accepted.
- **Replay isolation and complete restoration:** direct UI/production-function failures, then actual final-build6/6 UI checks (`benchmarks/next/v020-ci-flight-integrity.json`). Derived attitude/model/camera refresh and repeated-start guard were prompted by independently reproduced defects, not an assumed compilation pass.
- **Adaptive authored near geometry:** engineering inference from the original envelope plus direct real-Three construction measurements, source bounds and actual matched captures (`docs/aircraft-v0.2.md`). No claim of manufacturer CAD accuracy, external geometry research validation or measured mobile GPU cost follows from the vertex/draw budget.
- **Mandatory source-bound native evidence:** independent reproduction of an XML suite-count bypass drove strict descendant-case/count checks. Actual raw XML/APK/browser/licence/digest correspondence was measured against released bytes (`benchmarks/android/release-v0.2.0/`); CI signature proof and independent binary-manifest inspection have explicitly different coverage.
- **Defer flight-model changes after failed automated landings:** direct control-only traces establish failed/timed-out qualification attempts, not a uniquely identified physical-model defect. Retaining protected physics while isolating controller/assistance/timing/model causes is an **engineering risk decision**. Issue7 retains this unresolved distinction.
- **Treat cloud counters as observations only:** measured minute JS-heap/Three counts do not include native GPU/process memory; the governor hides the detailed model at quality0. A wall-time run with the original50ms delta clamp also does not imply equal simulated duration. Physical thermal/memory/FPS evidence is still required.

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

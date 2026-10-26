# Exa technical investigation

Research date: 27 October 2026, Europe/Istanbul. Queries used the Exa search/fetch connector. Evidence below is documentation, not a Galaxy A51 measurement.

| Finding | Source / evidence class | Project consequence |
| --- | --- | --- |
| Physical drawing-buffer dimensions may greatly exceed CSS dimensions on high-DPI phones. Explicitly limiting the buffer avoids unnecessary pixel work. | [Three.js responsive manual](https://threejs.org/manual/en/responsive.html), official documentation | Budget the 3D buffer separately from the HUD. Start Balanced near 600 physical vertical pixels, then measure. |
| The uploaded renderer already sets `outputEncoding = sRGBEncoding` and ACES tone mapping. The r128 property is `outputEncoding`; modern documentation uses `outputColorSpace`. | [Tagged r128 renderer documentation](https://raw.githubusercontent.com/mrdoob/three.js/r128/docs/api/en/renderers/WebGLRenderer.html), official versioned source; direct inspection of legacy lines 632–636 | Retain r128 APIs for this release. Tone mapping alone is not a newly implemented visual improvement. |
| Removing objects does not automatically release geometry, materials or textures; shared resources need lifetime management. | [Three.js cleanup](https://threejs.org/manual/en/cleanup.html), official documentation, also returned by Context7 | Review repeated world rebuilds; retain shared resources and dispose uniquely owned resources. |
| Transparent overlap can consume fragment work even with simple shaders; opaque paths permit earlier rejection. Newer Mali architecture optimisations cannot be assumed on G72. | [Arm blending](https://support.arm.com/documentation/101897/0304/Fragment-shading/Blending), [Arm overdraw](https://support.arm.com/documentation/102643/0100/High-overdraw), GPU vendor documentation | Bound cloud/effect layers; avoid default volumetric ray marching and full-screen float postprocessing. |
| Local bundled content can use a synthetic HTTPS origin via WebViewAssetLoader. File URL workarounds and permissive mixed content weaken security. | [Android local content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content), official documentation fetched | Bundle the offline HTML. Keep file/content access disabled and deny external navigation. JavaScript is necessary for this controlled application. |
| AGP 8.7 supports API 35 with Gradle 8.9 and JDK 17. | [AGP 8.7 compatibility](https://developer.android.com/build/releases/agp-8-7-0-release-notes), official documentation searched | Pin a compatible toolchain, rather than independently selecting latest versions. |
| Context restoration is asynchronous; preventing the default loss event permits restoration. GPU resources need rebuilding. | [Khronos context loss guide](https://wikis.khronos.org/webgl/HandlingContextLost), [ratified lose-context extension](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/), primary API guidance/specification | Test both events, no elapsed-time physics catch-up while lost, and successful rendered frames afterwards. |

## Rendering options considered

1. **Incremental r128 improvements — selected.** Preserves the existing shaders, simulation and offline bundle. Costs: older renderer and its maintenance debt.
2. **Modern Three.js/glTF/KTX2 migration — deferred.** Attractive asset and tooling pipeline, but many version/API changes require separate shader, colour and resource-lifecycle validation. Compression is not automatically faster for this predominantly procedural application.
3. **Native engine replacement — rejected for this pass.** Would replace core working systems and multiply parity work. No evidence establishes a net benefit on the target phone.

Aircraft and cockpit geometry should remain publicly inspired, procedurally authored visual approximations. No proprietary model, satellite image, military insignia or sound recording was acquired through this research. Independent redistribution rights must be verified before adding such assets.

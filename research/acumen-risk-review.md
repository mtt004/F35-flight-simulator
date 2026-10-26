# Acumen risk review

27 October 2026. The Acumen connector was queried about current Android/WebView and Three.js mobile-rendering developments. It returns nearest available records even when a precise issue is absent; retrieval is not proof of relevance.

## Useful lead and cross-check

Acumen returned recent Three.js r186 renderer changes, including asynchronous disposal in the newer Renderer abstraction. The [official r186 release](https://github.com/mrdoob/three.js/releases/tag/r186) was fetched through Exa. It lists asynchronous Renderer disposal, viewport/pixel-ratio fixes and geometry disposal changes. These are migration cautions, **not demonstrated defects in the bundled r128 WebGLRenderer**.

Acumen described r186 as released on 8 September 2026; the fetched GitHub release metadata reports publication on 24 September 2026. Preserve this discrepancy rather than silently trusting the knowledge-base date. No implementation depends on the contested date.

## Leads not adopted as facts

- General Android release and sideloading policy claims were not relevant enough or independently verified enough to justify changing this sideloaded A51 application.
- WebView backwards-compatibility and stale prebuilt WebView warnings are reasons to record the actual provider/version during device tests; they do not establish that this simulator is compatible with every WebView.
- No Galaxy A51/Mali-G72-specific current driver defect was established by the returned records.

## Engineering risks requiring direct evidence

| Risk | Evidence class | Verification / mitigation |
| --- | --- | --- |
| Old Three.js migration breaks shaders, material colour or animation | Code inspection + documented API evolution | Retain r128 for this release; require separate migration evidence later. |
| GPU reset or renderer-process termination on memory pressure | Platform possibility, not reproduced device incident | Context-loss browser test; Android lifecycle/process recovery tests; record whether state survives. |
| Thermal performance differs from short cloud tests | Engineering inference | Real A51 20-minute test, process PSS and thermal/battery samples remain required. |
| Dependency/download endpoints are inaccessible in Work | Environment constraint, to be recorded by build agent | Commit pinned build inputs and CI logs; never claim a compiled APK without archive/signature verification. |

Sources used for the useful lead: Acumen records pointing at https://github.com/mrdoob/three.js/releases/tag/r186; primary release independently fetched. Generic unrelated records were excluded from design decisions.

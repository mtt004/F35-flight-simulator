# Scientific rendering evidence

27 October 2026. Consensus search: “dynamic resolution level of detail mobile rendering frame pacing power consumption”. The paper below was fetched by ID before being used. Evidence available here is its abstract/metadata; the full experimental methods were not independently reviewed.

[1] Kent W. Nixon, Xiang Chen, Hu-Cheng Zhou, Yun-Xin Liu and Yi-Ran Chen (2014), [Mobile GPU Power Consumption Reduction via Dynamic Resolution and Frame Rate Scaling](https://consensus.app/papers/mobile-gpu-power-consumption-reduction-via-dynamic-nixon-chen/f43a29d07d8b54cd81ad8e62ad78344d/?utm_source=chatgpt). Venue was not supplied in the fetched record; pages 5–5; 27 citations reported by Consensus at retrieval. DOI was not provided.

Nixon et al. report energy benefits from scaling resolution and frame rate [1]. This supports investigating both controls together, rather than using native pixel density as a fixed quality requirement. Their devices, workloads and perceptual limits differ from this F-35B simulator and the Galaxy A51. No percentage saving from that paper is a prediction for this project.

## Decision and experimental boundary

- Use independently sharp DOM/canvas instruments with a lower resolution 3D layer.
- Cap Balanced rendering at 30 FPS while retaining fixed-step physics. Add hysteresis before changing scene quality or resolution.
- Prefer direct same-scene benchmarks over paper-derived performance estimates.
- Record visual quality, median/p95/p99 frame times and short stalls alongside FPS.
- PSS, battery drain, heat and input-to-photon latency require device instrumentation; browser JavaScript heap is not Android process memory.

No scientific source establishes this simulator's aerodynamic fidelity, military cockpit correctness, target-device memory ceiling or thermal acceptability. Those remain separate verification questions.

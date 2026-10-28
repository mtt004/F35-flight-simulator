# V0.3 London performance report

Measured 2026-10-28. HTML SHA-256 `9c4853a5eba204ad582e832a3a1f5b0274ec3a317b3a558ee3da10dfc1f5bf64`. Product source: `6a73eddcd76f41229bc7c4c26151f1179875077b`; subsequent evidence/workflow commits do not change product bytes.

Chrome 131 on cloud Linux with ANGLE/SwiftShader software rasterization, 1280 × 720 viewport, Balanced Q1, 1152 × 648 drawing buffer. This is **not Galaxy A51 hardware**. All scenes ran sequentially; the short offline-startup test overlapped the initial Heathrow measurement, so that row is diagnostic rather than an isolated comparison. No speedup is inferred against V2 reports made on different Chrome/host versions.

| View | Median FPS | 1% low FPS | p95 ms | p99 ms | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| heathrow | 3.18 | 2.63 | 370.8 | 379.8 | 308 | 178211 |
| london-approach | 1.52 | 0.42 | 2379.6 | 2379.6 | 266 | 384467 |
| skyline | 1.89 | 0.92 | 1087.2 | 1087.2 | 269 | 358481 |
| tower-bridge | 1.89 | 1.00 | 998.4 | 998.4 | 250 | 255934 |
| cockpit | 2.46 | 1.16 | 863.8 | 863.8 | 163 | 153136 |
| night-city | 0.89 | 0.64 | 1570.0 | 1570.0 | 98 | 273439 |
| active-city-flight-120s | 3.33 | 0.68 | 556.6 | 1113.2 | 246 | 183073 |

**Result: the 30 FPS goal fails in this software-rendered environment. Phone acceptance is untested.** City frame stalls remain significant. Ten-second fixed-view samples are small, especially at low FPS; raw frame intervals are retained in `benchmarks/london-v0.3/performance.json`. Median FPS is 1000 / median frame interval; 1% low is 1000 / mean of the slowest 1% intervals.

The first six views pause physics and fix camera/aircraft pose. The last row uses a configured central-London airborne fixture, then real autopilot/physics/streaming for 120 wall seconds. It remained uncrashed and advanced from 1.25 to 19.21 flight seconds under the inherited overload clamp. Origin rebasing means the recorded local positions are not a direct global distance trace. This is not a full Heathrow return flight, endurance qualification or real-time-speed proof.

No JavaScript/shader errors were captured. Heap samples, raw render submission times, texture/geometry counters and extension availability are in the JSON. No GPU query timings, whole Android process/GPU memory, load-time distribution, battery or thermal measurements are claimed. The final signed-APK installation evidence is generated separately by the verified release workflow.

CPU-only city streaming is separately reproducible with `node scripts/benchmark-london-streaming.mjs`: median 7.22 ms, p95 13.06 ms, p99 22.08 ms, max 30.65 ms in the retained run. It excludes rendering and landmark geometry and is not an FPS measurement. Earlier variable runs and the independent review demonstrate the budget is soft. Complex final merges and GC can still stall. No same-host whole-game before/after speedup is established.

Priorities: measure a physical A51 first; use those measurements to set density/facade/texture budgets, add worker preprocessing and feature splitting, reduce fragment cost/overdraw, and qualify a 20-minute route. Do not lower landmark identity to hide performance failure.

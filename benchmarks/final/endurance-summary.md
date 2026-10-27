# Twenty-minute cloud endurance result

Environment: Linux HeadlessChromium153/ANGLE SwiftShader CPU rasterizer;1280×720 CSS/DPR1. Actual hardware/renderer metadata and raw samples are in sustained-report.json and sustained-flight.json. This is NOT an Android/Galaxy A51 thermal test.

Source HTML SHA-256: `d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198`.

- Requested wall duration:1200seconds; recorded first-to-last render interval coverage:1199.465seconds.
- Actual rendered frames:9176; mean7.65FPS; median8.10FPS;1% low2.46FPS.
- Frame time p50/p95/p99:123.5/254.0/332.6ms.
- First five-minute mean:6.72FPS; last five-minute mean:7.70FPS. No claim of thermal stability follows from a CPU cloud host.
- Crash at endpoint:False; recorded JavaScript/shader errors:0; warnings:0.
- Simulated time advanced:425.94seconds. The inherited50ms per-frame clamp slows simulation under severe overload; this was20minutes of continuous operation, not20minutes of real-time-accurate flight.
- Geometry counter:428→532; textures:11→14; scenery streaming changes these counts. Endpoint counters cannot prove a plateau or absence of leaks.
- Reported browser JS heap at endpoint:35.1MB. This is not process PSS, native/GPU memory or peak allocation.
- A51 FPS/PSS/battery/temperature/gyro/touch-latency:NOT TESTED.

Status:MEASURED. Source-compatible/browser-stable in this observed run; mobile performance and leak certification remain open.

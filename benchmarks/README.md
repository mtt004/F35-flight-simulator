# Available cloud performance evidence

These are actual short, sequential cloud software-renderer runs. Different execution times and CPU resource scheduling limit causal comparison. They do not establish A51 performance. Ten seconds per scene after warm-up is exploratory, not a statistically replicated GPU benchmark.

| Scenario | Baseline mean FPS | Current mean FPS | Baseline p95 ms | Current p95 ms |
|---|---:|---:|---:|---:|
| runway-takeoff | 4.77 | 5.83 | 404.9 | 355.8 |
| high-altitude | 5.89 | 7.69 | 342.3 | 238.9 |
| countryside | 4.36 | 4.45 | 422.3 | 440.9 |
| airport-approach | 4.49 | 4.81 | 522.4 | 505.7 |
| heavy-weather | 4.68 | 5.08 | 432.0 | 382.7 |
| stovl-hover | 5.13 | 6.78 | 378.1 | 304.6 |
| night-approach | 3.09 | 4.04 | 863.6 | 601.4 |

Baseline source SHA: `cf3b450a2aaf6fe03d95207a7a9b9a33f1179bf7868b03b805cda1a8d55f3435`
Current source SHA: `d4ade981c06f483c2d0a5d529c290c9bae3dc12724ffb03ca7937d245f00f198`

Raw samples,1% lows, median/p99, render-submission timing, renderer counters and browser-heap readings are in each scenario JSON. Missing GPU-time/PSS/battery/thermal/input-latency metrics are null. Initial overlapping diagnostic runs are retained under diagnostic-concurrent/ and excluded from this table.

Physical Galaxy A51: NOT TESTED. Twenty-minute cloud report, when completed, is benchmarks/final/sustained-report.json; it is not an Android thermal result.

## Additional release-run environment

The final GitHub-hosted release run40508826040 uses HeadlessChrome151 on2AMD EPYC9V45 logicalCPUs/ANGLE SwiftShader. It is distinct from the earlier Chromium153 cloud measurements above and the endurance environment. Full raw data is in release-run-40508826040; both sources/HTML hashes are recorded. Initial default buffers differ1280×720baseline/1152×648final and adapt, so this is a comparison of delivered defaults, not an equal-workload GPU test.

| Scenario | Baseline mean FPS | Released mean FPS | Released p95 ms |
|---|---:|---:|---:|
| runway-takeoff | 2.54 | 3.07 | 657.7 |
| high-altitude | 2.19 | 3.50 | 625.7 |
| countryside | 1.98 | 2.36 | 787.4 |
| airport-approach | 2.22 | 2.73 | 757.0 |
| heavy-weather | 2.30 | 2.62 | 774.6 |
| stovl-hover | 2.07 | 3.04 | 595.6 |
| night-approach | 2.11 | 2.87 | 809.5 |

No JavaScript/shader errors were recorded. These CPU-rendered results are below30FPS and do not certify the A51 target. Do not combine the two environments into a single speedup estimate.

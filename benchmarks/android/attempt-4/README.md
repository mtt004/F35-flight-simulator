# Attempt 4 — emulator native segmentation fault

27 October 2026. Source b71f9cc78692b2db6eaeaad41f8a6e14222e1140. [Actions run 40454725990](https://github.com/mtt004/F35-flight-simulator/actions/runs/40454725990), job 122025277236, artifact 12713048019. The actual APK compiled and archive/signature/browser checks passed. Android instrumentation did not complete: one failed/incomplete XML testcase, zero completed assertions reported.

Host kernel log records `RenderThread[4854]: segfault` at 05:27:46 UTC. Emulator vanished from adb. Available host memory after the event was about 6.3 GB; the selected kernel log reports no OOM kill. This establishes a native renderer crash, not its precise faulty library or code path. Do not claim an app JavaScript assertion failed or an A51 failure from this result.

The workflow eventually reached its 40-minute timeout because the diagnostic adb logcat could wait indefinitely after emulator death. Diagnostic commands now have deadlines. A subsequent controlled experiment changes the supported software backend from swiftshader_indirect to lavapipe, leaving the live-flight assertions intact. No successful installation/live-flight acceptance or release is claimed here.

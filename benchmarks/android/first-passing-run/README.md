# First passing Android live-flight run

Source dd433f611b3911f49a914d65024c0e5cbe63269f. [Actions run40508798727](https://github.com/mtt004/F35-flight-simulator/actions/runs/40508798727), job122204936626, artifact12736870350. Actual APK installed and passed one instrumentation test requiring internal36/36 checks, menu/tutorial dismissal, finite active flight, nonzero WebGL calls, and advancing fixed-step/time counters. XML reports1test/0failures/0errors/0skips. Root independently downloaded the archive and matched APK bytes/hash, bundledHTML and all licence copies. This successful build is a checkpoint; the final release APK may use a different debug certificate/hash.

EmulatorAPI33/x86_64, softwaregfxstream: vulkan_mode_selected=lavapipe and gles_mode_selected=swangle. This run passed, but changing the requested backend did not eliminate all SwiftShader involvement in GLES; no unique crash-rootcause or durable fix is established from one run. Physical GalaxyA51 NOT TESTED.

The raw LightningQA PSS line is one instrumented target-process snapshot (98,699KB), excludes separate WebView renderer/nativeGPU processes and includes instrumentation. It is not whole-appPSS, peak memory orA51 evidence; it cannot certify the600MB process budget.

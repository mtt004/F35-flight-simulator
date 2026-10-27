# Android build and verification

## Selected architecture

The Android app is a Kotlin `Activity` hosting the actual browser simulator in a hardware-accelerated system WebView. All game content is bundled in the APK. AndroidX `WebViewAssetLoader` serves that content under `https://appassets.androidplatform.net/assets/www/index.html`; it does not download it. The application requests **no Android permissions**, including no internet permission. The renderer requires OpenGL ES 3.0 / WebGL2.

The host allows only its HTTPS assets path, denies all unmatched requests, disables file/content access and mixed content, rejects WebChrome permission requests, and exposes no JavaScript-to-native bridge. A constrained system document picker accepts a single `.json` / `application/json` appearance document through Android Storage Access Framework. The returned URI must use `content:` and have a JSON filename; known sizes must be 1–16384 bytes. The web importer separately enforces its size and JSON-schema checks. The selected document is data, never a WebView navigation target. No storage permission or persistent URI grant is requested. Pending callbacks are cancelled on replacement, renderer termination, selection cancellation and activity destruction. This picker has not been exercised on a device locally. Debug builds allow Android WebView inspection through ADB; no debugging port is exposed to the network by the app.

Settings use the bundled page's existing local storage. App data and settings persist across normal restarts. The host emits `lightningpause` and `lightningresume` events on Android lifecycle changes. A terminated WebView rendering process gets an explicit reload dialog; reloading loses unsaved flight progress. This is distinct from a WebGL context loss, which the web renderer handles.

## Pinned toolchain

| Component | Selected version |
|---|---|
| Android Gradle Plugin | 8.7.3 |
| Gradle distribution | 8.9 |
| Kotlin Android plugin | 2.0.21 |
| Java language/bytecode | 17 |
| CI Temurin JDK | 17.0.15+6 |
| Compile / target SDK | 35 / 35 |
| Build tools | 35.0.0 |
| Android command-line tools | 12266719 (explicitly provisioned by pinned setup-android action) |
| Minimum Android | API 26 (Android 8.0) |
| AndroidX WebKit | 1.12.1 |
| AndroidX test core / runner / JUnit extension | 1.6.1 / 1.6.2 / 1.2.1 (test APK only) |
| Application ID | `com.mtt004.lightning` |
| Version name / code | `0.1.0-experimental` / 1 |

The Gradle binary download is verified by wrapper property `distributionSha256Sum`:
`d725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab`.

The original Gradle 8.9 wrapper JAR is included, SHA-256:
`498495120a03b9a6ab5d155f5de3c8f0d986a449153702fb80fc80e134484f17`.

Official source: <https://github.com/gradle/gradle/tree/v8.9.0/gradle/wrapper>. Checksums: <https://gradle.org/release-checksums/>. The wrapper and launch scripts are Apache-2.0 licensed by Gradle (copyright/license notices are retained in the distributed files/JAR).

AGP compatibility: <https://developer.android.com/build/releases/agp-8-7-0-release-notes> specifies Gradle 8.9 and JDK 17, with API 35 support. Secure local content guidance: <https://developer.android.com/develop/ui/views/layout/webapps/load-local-content>.

These versions prioritize a documented, compatible toolchain for this experimental sideloaded build. They are not represented as the newest Android tooling. Dependency upgrades require a new compile, lint and runtime verification cycle.

## Reproduce

Install Node.js 22, Python 3, JDK 17 and the Android SDK, then set `ANDROID_HOME` to its directory. Initial dependency/tool downloads require internet; the completed game does not.

```bash
npm ci
sdkmanager 'platforms;android-35' 'build-tools;35.0.0'
npm test
bash scripts/build-android.sh
```

The Gradle task refuses to proceed without a generated browser build. It copies `dist/index.html` into generated assets under `assets/www/`; generated assets and APKs are not checked into ordinary Git history.

Outputs:

- `dist/Lightning-F35B-Android.apk`: signed debug APK.
- `dist/android-verification.json`: package, SDK, signature, archive integrity, file size and SHA-256 evidence.
- `android/app/build/reports/lint-results-debug.html`: Android lint output.

`scripts/verify-apk.py` uses Android `aapt` and `apksigner` to verify the real APK, validates its launchable activity and no-permissions policy, tests ZIP integrity, and requires bundled game bytes to match the browser build exactly. It deliberately does not label archive verification as installation success.

## CI and permanent prerelease

- `.github/workflows/ci.yml`: unit tests, browser build and actual Playwright launch/internal simulator checks.
- `.github/workflows/android-build.yml`: tests, Android compilation/lint and signed APK verification on branch pushes and PRs. Every run additionally installs and launches the actual game through an instrumentation test on an API 33 emulator with a software GPU. Successful runs produce `dist/android-installation.json` from genuine instrumentation XML; missing, skipped or failing tests block that gate.
- `.github/workflows/release.yml`: tests, browser launch, Android compilation and signing verification, an Android API 33 emulator installation/flight-launch gate, brief baseline/final cloud benchmarks, evidence ZIP, checksums, then a private GitHub prerelease.

Create a new release branch such as `release/v0.1.0-experimental` at the intended source commit to trigger the prerelease workflow. It derives the immutable tag `v0.1.0-experimental`, refuses to replace an existing release, and records source SHA in `build-manifest.json`. Do not create that branch until its source is intended for release. Version tags and manual dispatch are also supported.

All third-party Actions are pinned to commit SHAs, resolved from their published version refs during implementation. Regular workflows have read-only repository permissions. Only the release job receives `contents: write`, with its token supplied to the release step. No signing secret or private key is committed.

## Signing limitation

The delivered experimental APK uses the standard Android debug signing mechanism. The CI runner generates a private debug key in its temporary home directory. Consequently, separate CI runs may have different signing certificates. Android cannot update an installed package with a differently signed build: uninstalling first removes that app's saved data. A stable signing identity requires an owner-controlled release key stored through a secure secret service; this project does not invent or expose one.

## Local environment evidence — 27 October 2026

Command attempted: `bash android/gradlew --version` using installed OpenJDK 17.0.20. The wrapper launched, then failed downloading `https://services.gradle.org/distributions/gradle-8.9-bin.zip` with `java.net.SocketException: Network is unreachable`. No Android SDK, `adb`, emulator or physical device was present in this cloud workspace.

Therefore this local attempt did **not** compile, sign, install or run an APK. GitHub Actions must provide those build results separately. Successful Actions runs, APK hashes and release links are recorded in the final audit; the presence of a workflow alone is not evidence that it ran.

### First Actions setup failure and correction

The first Android Actions attempt failed before compilation because `sdkmanager` was absent from the runner PATH. Both Android and release workflows now provision the Android SDK explicitly through `android-actions/setup-android` at commit `9fc6c4e9069bf8d3d10b2204b1fb8f6ef7065407`, pinning command-line tools `12266719` and the required packages. This fixes an observed setup assumption; success still requires a subsequent actual run.

The emulator smoke test uses AndroidX `ActivityScenario` and `AndroidJUnitRunner`, avoiding reliance on deprecated optional `android.test` platform libraries. It verifies internal validation, tutorial dismissal, live rendering and fixed-step progression; menu closure alone is not accepted as game functionality.

### Emulator boot storage failure and correction

The release run `40404563292` reached Android compilation/signature verification but failed before the emulator could boot. The emulator log reported only `4332.99 MB` available for a default userdata allocation requiring `7372.80 MB`. This was runner storage exhaustion, not a simulator assertion or installation result.

Both Android workflows now set the AVD `disk-size` to `2048M`, with `2048M` RAM and a `256M` Java heap, and disable emulator snapshots. This test app is under3MB, so a smaller userdata partition was requested. The subsequent run below demonstrated that this image still enforced a larger effective minimum. These are emulator settings, not claims about the game's Galaxy A51 memory use. The prelaunch step records filesystem free space and the effective AVD settings. No repository, user files or runner caches are deleted.

Evidence: the pinned action's [`action.yml`](https://github.com/ReactiveCircus/android-emulator-runner/blob/a421e43855164a8197daf9d8d40fe71c6996bb0d/action.yml) declares `disk-size` in bytes or K/M/G units; its [`createAvd` implementation](https://github.com/ReactiveCircus/android-emulator-runner/blob/a421e43855164a8197daf9d8d40fe71c6996bb0d/src/emulator-manager.ts) writes `disk.dataPartition.size` to the AVD configuration. Android's [emulator command-line documentation](https://developer.android.com/studio/run/emulator-commandline) documents userdata-image handling and snapshot controls. This correction must still pass a fresh actual emulator run; instrumentation and release gates remain mandatory.

### Confirmed userdata minimum and focused SDK reclamation

Retry release run `40451484190`, job `122014980567`, passed browser validation and APK compilation/signature verification, then failed emulator boot again. At `2026-10-27T04:50:25Z`, logs showed `disk.dataPartition.size=2048M` present in the AVD configuration but the emulator still required `7372.80 MB`, with only `5533.82 MB` free. Thus the requested small partition did not lower this image's effective startup-space requirement. No installation or product-test success follows from this attempt.

The pinned hosted-runner image's [official software inventory](https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/Ubuntu2404-Readme.md) lists three preinstalled NDK versions, while this Kotlin/WebView app has no C/C++ or NDK build. Both workflows now list installed SDK packages and invoke `sdkmanager --uninstall` only for strictly matched `ndk;<numeric version>` package IDs, after the APK is built and before emulator installation. The step runs only on GitHub-hosted disposable runners. It preserves SDK platforms/build tools/emulator, Gradle dependencies, repository files, host packages and graphics libraries. Filesystem free space is measured before/after, and `dist/runner-storage.json` records the exact removed SDK package IDs and reclaimed bytes. This evidence accompanies a successful release; no guessed reclaimed-space number is claimed.

The action's public [issue 455](https://github.com/ReactiveCircus/android-emulator-runner/issues/455) corroborates API 33 userdata disk-pressure failures. Its discussion also documents emulator breakage after overly broad host-package cleanup, which this workflow avoids. Instrumentation remains a mandatory gate and a fresh run must verify the storage correction.

### Emulator process loss after successful installation

Release run `40453171144`, job `122020352039`, recovered `6,968,320,000` bytes by uninstalling the three unused SDK NDK packages, leaving `17,012,506,624` bytes free. The emulator booted. UTP logs confirm installation of both `app-debug.apk` and the instrumentation APK, and guest logcat confirms `MainActivity` was displayed and WebView 101.0.4951.61 logged `[F35B] self-test 36/36 passed` at `2026-10-27T05:12:23Z`.

The test did **not** finish: its XML contains an empty failure, with `device 'emulator-5554' not found` and `Expected 1 tests, received 0`. No guest assertion, guest Java OOM, or guest crash stack was captured. Thus installation and page initialization were observed, but live flight progression did not pass. The whole emulator disappeared; host memory pressure or a native emulator crash are plausible explanations, not established causes.

This run also compiled/dexed the instrumentation APK while the emulator was already running. Workflows now precompile `assembleDebugAndroidTest` before emulator startup, cap the Gradle heap at 1024 MB, bound workers to two (one during connected testing), disable parallel project execution, and use Kotlin's in-process compiler strategy to avoid a separate compiler daemon overlapping with QEMU. These are controlled resource reductions; a subsequent real run must demonstrate whether they resolve the failure.

`android/run-instrumentation.sh` records host memory and process RSS every five seconds, a final emulator state, final guest logcat where reachable, cgroup memory events where exposed, and filtered host kernel OOM/segfault events where permitted. It preserves Gradle's exit status and does not turn a lost emulator or failed assertion into a pass. Evidence is retained under `dist/android-host-diagnostics/` and in successful release evidence packages.

Configuration sources: [Gradle build environment](https://docs.gradle.org/current/userguide/build_environment.html) and [Kotlin compiler execution strategy](https://kotlinlang.org/docs/compiler-execution-strategy.html).

After successful live-flight progression and before activity teardown, the instrumentation test logs one `LightningQA` JSON memory sample using `Debug.getMemoryInfo(...).totalPss` in KB. This measures the current instrumented target process (including instrumentation, excluding separate WebView renderer processes). It is a single active-flight sample, not a peak or whole-application total. CI device model/API and the emulator context must accompany any reported value; it does not establish Galaxy A51 memory consumption.

Diagnostic collection also preserves emulator-created `.dmp`/`.log`/`.txt` crash evidence under `/tmp/android-runner` when present, excluding symlinks and limiting individual files to 5 MB and total copied crash evidence to 20 MB. A [separate project’s primary report](https://github.com/solidDoWant/vault-sync/issues/733), dated 21 October 2026, describes emulator 37.2.12 SwiftShader JIT segfaults around WebView attachment on hosted AMD runners. It is relevant alternative evidence, not a diagnosis of this game.

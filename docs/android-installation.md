# Install Lightning on Android

Use the actual `Lightning-F35B-Android.apk` from the repository's GitHub Release. The repository is private, so sign in to the authorized GitHub account to download its assets. A ZIP of source code is not the Android application.

1. Download `Lightning-F35B-Android.apk` and, if desired, `SHA256SUMS.txt`.
2. Open the APK using Android's package installer. Allow installation from the specific browser/file manager when Android requests it. Exact prompts depend on device software and Android's current sideloading policy.
3. Install and launch **Lightning F-35B**.
4. Hold the phone in landscape, choose a scenario, and start the flight. The APK bundles the complete base simulator and needs no internet connection.
5. Use the game's settings to select touch handedness, sensitivity, motion input, graphics and instruments. Motion input is optional; keep touch enabled until gyroscope calibration has been checked on the device.

The package targets the Samsung Galaxy A51 SM-A515F but has not been physically tested on it unless an accompanying test report explicitly says so. Android API 26 or later and a WebView with WebGL2 are required. The Android 13 environment reported for the owner's A51 is above that API minimum. This is a compatibility design target, not proof of installation or sustained performance.

## Debug signing and updates

The experimental APK is debug-signed. The package is `com.mtt004.lightning`, version `0.1.0-experimental` (version code 1). Debug signing permits sideloading but is unsuitable for a production store release. Separate CI builds may use different private debug certificates; if Android rejects an update due to signature mismatch, uninstall the old build before installing the new one. **Uninstalling deletes that application's local settings and flight saves.** Preserve any exported data first.

The application requests no internet, storage, location, microphone or camera permissions. Appearance JSON imports use Android’s system document picker for one small JSON file. The host restricts the picker request and returned document type; the game validates its JSON data. Document selection and import still require a real-device test; choosing a file never enables remote navigation. An optional gyro uses web motion events when supported by the installed WebView and device.

## Offline and lifecycle checks to perform on the A51

- Enable airplane mode, force-stop the game, then launch it and start a flight.
- Check simultaneous joystick and throttle touches, gear, brakes and STOVL.
- Background the app, return, and verify that the game remains safely paused.
- Save a flight, restart the app, and test continuation.
- Exercise conventional takeoff, hover transition, vertical landing, cockpit and external cameras.
- Run a 20-minute flight while recording frame times, battery change, thermal behaviour and memory through ADB if available.

These are device acceptance steps, not claims that they have passed. The game's diagnostic overlay and the benchmark scripts support evidence collection. Desktop software-renderer and emulator results do not establish Mali-G72 performance.

## Recoverable failures

If Android terminates the WebView graphics process, the host offers a reload. Reloading returns to the flight menu and loses unsaved progress; previously stored settings remain. A WebGL2 failure may require updating Android System WebView through the device's normal update mechanism, if an update is available. The game must still work offline after any needed system-component update is installed.

For developers with an attached Android device:

```bash
adb install -r dist/Lightning-F35B-Android.apk
adb shell am start -n com.mtt004.lightning/.MainActivity
cd android
bash ./gradlew connectedDebugAndroidTest
```

The instrumentation test runs the internal simulator validation suite, presses the actual flight-start button, dismisses the first-run tutorial through its close button, requires an unpaused live flight with finite aircraft position and nonzero WebGL draw calls, then verifies fixed-step count and simulation time advance over 1.2 seconds. It needs working WebGL2 and is separate from package/archive verification.

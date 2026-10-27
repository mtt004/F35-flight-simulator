# Licensing and attribution

The owner supplied the simulator. No new open-source licence is imposed on the owner's code. Repository remains private. All added visual geometry/texture atlases/material studies and procedural sounds are authored in code; no third-party aircraft model, satellite imagery or recorded sound has been imported.

## Bundled Three.js r128 — MIT

Copyright © 2010–2021 Three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Source: https://github.com/mrdoob/three.js/blob/r128/LICENSE

## Android runtime dependencies — Apache License 2.0

The game APK redistributes compiled Kotlin runtime/standard-library code (selected version 2.0.21) and AndroidX Jetpack code, including the direct dependency `androidx.webkit:webkit:1.12.1` and resolved AndroidX transitive runtime libraries. Their being restored by Gradle does not remove redistribution obligations.

- Kotlin: Copyright 2010–2024 JetBrains s.r.o. and Kotlin Programming Language contributors. Primary [licence](https://github.com/JetBrains/kotlin/blob/v2.0.21/license/LICENSE.txt) and [copyright](https://github.com/JetBrains/kotlin/blob/v2.0.21/license/COPYRIGHT.txt).
- AndroidX: Copyright The Android Open Source Project and respective contributors; the included `WebViewAssetLoader` source carries Copyright 2019 The Android Open Source Project. Primary [licence](https://github.com/androidx/androidx/blob/androidx-main/LICENSE.txt) and [source attribution](https://github.com/androidx/androidx/blob/androidx-main/webkit/webkit/src/main/java/androidx/webkit/WebViewAssetLoader.java).

The complete Apache 2.0 licence, including its appendix, is preserved at `android/LICENSE-2.0.txt` (SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`). `android/THIRD_PARTY_NOTICES.txt` contains runtime attribution and another complete copy. Gradle includes both files and this `LICENSES.md` in every APK under `assets/www/`; the APK verifier requires exact checked-in copies. The simulator's HTML bytes remain unchanged by this packaging step. The runtime libraries themselves have not been modified for this project.

The Kotlin compiler, Android Gradle Plugin, Android SDK/Gradle distribution, Playwright and AndroidX/JUnit instrumentation dependencies are build/test tooling. Their complete tool distributions and the separate instrumentation APK are not included in the final game APK. The source repository does redistribute the Gradle wrapper JAR and launch scripts; upstream licence notices remain in those files, and its Apache licence copy is also provided above. See `docs/dependencies.md` for pinned build/runtime versions. These third-party licences do not impose a new licence on the owner's simulator code.

## Geographic research

Potential datasets are documented in docs/scenery-data.md. No downloaded geospatial dataset is included in this release. The included appearance packs are stylized authored palettes and carry no claim of real geographic accuracy.

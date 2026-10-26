# Dependency and toolchain decisions

27 October 2026. Exact declared versions must also match the source/build files. This table describes selected inputs, not successful execution on a phone.

| Component | Version / source | Reason |
| --- | --- | --- |
| Three.js | r128, supplied embedded bundle | Preserve existing shaders and behaviour while changing scene content incrementally. MIT notice must remain in distributions. |
| Android Gradle Plugin | 8.7.3 | Pinned patch in API-35-compatible family. |
| Gradle | 8.9 | Required compatible version for AGP8.7. |
| Kotlin Android plugin | 2.0.21 | Explicit compiler pin; Android shell source uses Kotlin. |
| Java | 17 | AGP8.7 toolchain requirement. |
| Android compile/target SDK | 35 | Supported by chosen AGP; target device Android13/API33 can run apps targeting a newer SDK if minSDK permits. |
| Android minimum SDK | 26 | Packaging floor selected by Android implementer; actual modern WebView/WebGL2 support is additionally required. |
| Android build tools | 35.0.0 | Explicit build-tool pin; AGP8.7 documentation minimum/default is34.0.0. |
| AndroidX WebKit | 1.12.1 | Supplies WebViewAssetLoader; used only for bundled content origin. |

## Version-specific documentation

Context7 resolved Three.js as `/mrdoob/three.js`. Its returned current docs include `outputColorSpace`, which is **not** the retained r128 API. The [tagged r128 renderer documentation](https://raw.githubusercontent.com/mrdoob/three.js/r128/docs/api/en/renderers/WebGLRenderer.html) confirms `outputEncoding`. Current disposal/drawing-buffer guidance is conceptually useful; copy APIs only when verified against r128.

Android implementation queried Context7's `/androidx/androidx` WebViewAssetLoader documentation. Primary fallback: [Android local content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content). [Official AGP8.7 matrix](https://developer.android.com/build/releases/agp-8-7-0-release-notes) confirms Gradle8.9, JDK17 and maximum API35. Chosen versions are deliberately compatible pins, not claims to be latest.

## Gradle integrity

[Official Gradle release checksums](https://gradle.org/release-checksums/) were fetched and confirm:

- Gradle8.9 binary ZIP SHA-256: `d725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab`
- Gradle8.9 wrapper JAR SHA-256: `498495120a03b9a6ab5d155f5de3c8f0d986a449153702fb80fc80e134484f17`

No release signing identity belongs in source. A generated debug identity makes an installable development package when a genuine APK build succeeds; its certificate is unsuitable as a permanent upgrade identity.

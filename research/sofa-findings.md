# SOFA engineering review

27 October 2026. The connected SOFA identity/status was checked, current guidance requested and the hosted skill fetched. Read-only, sanitised technical queries contained no repository source, credentials or private project details. No post, reply or verification was published.

Searches:

- `WebGL context loss dispose WebView`
- `WebGL high DPI pixelRatio memory dispose`

The second query returned unrelated Delphi/UI results and supplied no applicable recommendation.

## Inspected result

[How should an Android app recover a worker-backed canvas after its WebView loses a compositor surface?](https://agents.stackoverflow.com/questions/6ebc48b1-cbeb-4e91-8351-162e930d530a), question by yunghermes, 20 September 2026; inspected its full reply by Veritas.

**Evidence class: unverified community advice.** At retrieval, the reply had zero votes and zero recorded verifications; SOFA marked its answer evidence insufficient. It must not be called production-tested evidence.

Useful distinction: a drawing loop that still advances, a lost WebGL context, a stale compositor surface and a terminated renderer process are separate failure classes. Record frame counts, WebView/GPU versions and visible screenshots to identify which actually occurred. The current simulator uses a main-thread WebGL canvas, so advice about retransferring OffscreenCanvas to a worker does not apply.

Applicable context-loss guidance was independently corroborated against [Khronos](https://wikis.khronos.org/webgl/HandlingContextLost) and the [WEBGL_lose_context specification](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/). The application should prevent the default context-loss action, pause advancing simulation during the interruption and verify rendering after restoration. Three.js owns its GPU objects, so its restoration handling must be exercised rather than layering raw-WebGL rebuild code blindly on top.

The Android process-loss path should reload bundled content with an explicit user-visible recovery boundary; `onRenderProcessGone` is not equivalent to a routine pause/resume event. Real WebView/A51 process-loss tests are still necessary.

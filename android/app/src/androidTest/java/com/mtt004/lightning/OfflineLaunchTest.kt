package com.mtt004.lightning

import android.os.Build
import android.os.Debug
import android.util.Log
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONObject
import org.json.JSONTokener
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Installs and exercises the actual bundled game; requires working emulator/device WebGL2. */
@RunWith(AndroidJUnit4::class)
class OfflineLaunchTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun evaluate(screen: MainActivity, script: String): String {
        val latch = CountDownLatch(1)
        var result = ""
        instrumentation.runOnMainSync {
            screen.webView.evaluateJavascript(script) {
                result = it
                latch.countDown()
            }
        }
        assertTrue("WebView JavaScript evaluation timed out", latch.await(90, TimeUnit.SECONDS))
        return result
    }

    private fun objectResult(screen: MainActivity, expression: String): JSONObject {
        val raw = evaluate(screen, "JSON.stringify($expression)")
        val value = JSONTokener(raw).nextValue()
        assertTrue("Expected JSON object result, received: $raw", value is String)
        return JSONObject(value as String)
    }

    private fun assertLiveFlight(state: JSONObject) {
        assertTrue("Flight is not running", state.getBoolean("running"))
        assertFalse("Flight is paused", state.getBoolean("paused"))
        assertFalse("Aircraft has crashed", state.getBoolean("crashed"))
        assertTrue("WebGL has not rendered scene draw calls", state.getJSONObject("renderer").getInt("calls") > 0)
        val position = state.getJSONArray("position")
        assertEquals("Expected a three-dimensional aircraft position", 3, position.length())
        for (axis in 0 until 3) {
            assertFalse("Non-finite aircraft position at axis $axis", position.isNull(axis))
            assertTrue("Non-finite aircraft position at axis $axis", position.getDouble(axis).isFinite())
        }
    }

    private fun runtimeObservation(screen: MainActivity): JSONObject = objectResult(screen, """
        ({snapshot: window.__F35B_SIM__.snapshot, world: window.__F35B_SIM__.world,
          prepared: window.LightningPreparedGeometry?.stats(),
          version: window.__F35B_SIM__.version, userAgent: navigator.userAgent, wall: performance.now()})
    """.trimIndent())

    @Test
    fun testBundledSimulatorLoadsAndStarts() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
        lateinit var screen: MainActivity
        scenario.onActivity { screen = it }
        // A failed run must not leave a previous run's runtime evidence available.
        val evidenceFile = screen.filesDir.resolve("lightning-runtime-evidence.json")
        evidenceFile.delete()
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(90)
        var ready = false
        while (System.nanoTime() < deadline) {
            ready = evaluate(screen, "Boolean(window.__F35B_SIM__ && window.__F35B_SIM__.snapshot)") == "true"
            if (ready) break
            Thread.sleep(250)
        }
        assertTrue("Bundled simulator diagnostic interface never became ready", ready)

        assertEquals("Offline London world was not selected", "\"LONDON\"", evaluate(screen, """
            (() => {
                const select = document.getElementById('worldMode');
                select.value = 'LONDON';
                if (window.__F35B_SIM__.world.mode !== 'LONDON') select.dispatchEvent(new Event('change', {bubbles:true}));
                return window.__F35B_SIM__.world.mode;
            })()
        """.trimIndent()))

        val validation = objectResult(screen, "(() => { const r = window.__F35B_SIM__.runValidation(); return {passed:r.passed,total:r.total}; })()")
        assertTrue("Simulator ran no internal validation tests", validation.getInt("total") > 0)
        assertEquals("Internal simulator regressions failed", validation.getInt("total"), validation.getInt("passed"))

        val menuState = evaluate(screen, """
            (() => {
                document.getElementById('start').click();
                if (document.getElementById('helpOv').classList.contains('on')) {
                    document.getElementById('btnHelpTopClose').click();
                }
                return document.getElementById('boot').style.display;
            })()
        """.trimIndent())
        assertEquals("Flight menu did not close", "\"none\"", menuState)
        assertEquals("First-run tutorial still overlays the game", "false", evaluate(screen, "document.getElementById('helpOv').classList.contains('on')"))

        // A closed menu alone is insufficient: require running physics and actual WebGL work.
        val renderDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(90)
        var firstObservation = runtimeObservation(screen)
        fun geometryReady(observation: JSONObject): Boolean {
            val prepared = observation.getJSONObject("prepared")
            val london = observation.getJSONObject("world").getJSONObject("london")
            return london.getInt("buildingTiles") > 0 &&
                (!prepared.getBoolean("supported") || prepared.getInt("decoded") > 0)
        }
        while ((firstObservation.getJSONObject("snapshot").getJSONObject("renderer").getInt("calls") == 0 ||
                !geometryReady(firstObservation)) && System.nanoTime() < renderDeadline) {
            Thread.sleep(250)
            firstObservation = runtimeObservation(screen)
        }
        assertEquals("Actual rendered world is not London", "LONDON", firstObservation.getJSONObject("world").getString("mode"))
        assertTrue("No London meshes or supported prepared-geometry decoding observed within 90 seconds", geometryReady(firstObservation))
        val initial = firstObservation.getJSONObject("snapshot")
        assertLiveFlight(initial)
        val initialSteps = initial.getLong("stepCount")
        val initialTime = initial.getDouble("simT")
        Thread.sleep(1200)
        val laterObservation = runtimeObservation(screen)
        val later = laterObservation.getJSONObject("snapshot")
        assertLiveFlight(later)
        assertTrue("Fixed-step physics did not advance during the live flight", later.getLong("stepCount") > initialSteps)
        assertTrue("Simulation time did not advance during the live flight", later.getDouble("simT") > initialTime)
        val memory = Debug.MemoryInfo()
        Debug.getMemoryInfo(memory)
        val webViewPackage = checkNotNull(WebView.getCurrentWebViewPackage()) {
            "The loaded Android WebView package could not be identified"
        }
        assertFalse("The loaded Android WebView version is missing", webViewPackage.versionName.isNullOrBlank())
        val prepared = laterObservation.getJSONObject("prepared")
        val london = laterObservation.getJSONObject("world").getJSONObject("london")
        val wallSeconds = (laterObservation.getDouble("wall") - firstObservation.getDouble("wall")) / 1000
        val simulatedSeconds = later.getDouble("simT") - initialTime
        assertTrue("Actual observation wall time did not advance", wallSeconds > 0)
        val runtime = JSONObject()
            .put("schemaVersion", 1)
            .put("metric", "offline_london_runtime")
            .put("version", laterObservation.getString("version"))
            .put("deviceModel", Build.MODEL)
            .put("androidApi", Build.VERSION.SDK_INT)
            .put("webView", JSONObject().put("packageName", webViewPackage.packageName)
                .put("versionName", webViewPackage.versionName).put("userAgent", laterObservation.getString("userAgent")))
            .put("world", laterObservation.getJSONObject("world"))
            .put("prepared", prepared)
            .put("geometryPath", if (prepared.getBoolean("supported")) "prepared" else "dynamic-fallback")
            .put("geometryPending", JSONObject().put("prepared", london.getInt("pendingPrepared"))
                .put("buildings", london.getInt("pendingBuildings")).put("queuedBuildings", london.getInt("queuedBuildings")))
            .put("initial", initial).put("later", later)
            .put("observation", JSONObject().put("wallSeconds", wallSeconds).put("simulationSeconds", simulatedSeconds)
                .put("simulationToWallRatio", simulatedSeconds / wallSeconds).put("debtSeconds", later.getDouble("simulationDebtSeconds")))
            .put("scope", "Actual offline London WebView observations; prepared means decoding was observed, not that every tile used it. Software-emulator results are not Galaxy A51 acceptance.")
        evidenceFile.writeText(runtime.toString(2), Charsets.UTF_8)
        Log.i("LightningQA", runtime.toString())
        Log.i("LightningQA", JSONObject()
            .put("metric", "instrumented_target_process_pss")
            .put("pssKB", memory.totalPss)
            .put("deviceModel", Build.MODEL)
            .put("androidApi", Build.VERSION.SDK_INT)
            .put("webViewVersion", webViewPackage.versionName)
            .put("geometryPath", runtime.getString("geometryPath"))
            .put("peakMeasurement", false)
            .put("scope", "One active-flight snapshot; includes instrumentation, excludes separate WebView renderer processes; CI emulator result is not Galaxy A51 evidence")
            .toString())
        }
    }
}

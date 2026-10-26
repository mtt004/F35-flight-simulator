package com.mtt004.lightning

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

    @Test
    fun testBundledSimulatorLoadsAndStarts() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
        lateinit var screen: MainActivity
        scenario.onActivity { screen = it }
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(90)
        var ready = false
        while (System.nanoTime() < deadline) {
            ready = evaluate(screen, "Boolean(window.__F35B_SIM__ && window.__F35B_SIM__.snapshot)") == "true"
            if (ready) break
            Thread.sleep(250)
        }
        assertTrue("Bundled simulator diagnostic interface never became ready", ready)

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
        val renderDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        var initial = objectResult(screen, "window.__F35B_SIM__.snapshot")
        while (initial.getJSONObject("renderer").getInt("calls") == 0 && System.nanoTime() < renderDeadline) {
            Thread.sleep(250)
            initial = objectResult(screen, "window.__F35B_SIM__.snapshot")
        }
        assertLiveFlight(initial)
        val initialSteps = initial.getLong("stepCount")
        val initialTime = initial.getDouble("simT")
        Thread.sleep(1200)
        val later = objectResult(screen, "window.__F35B_SIM__.snapshot")
        assertLiveFlight(later)
        assertTrue("Fixed-step physics did not advance during the live flight", later.getLong("stepCount") > initialSteps)
        assertTrue("Simulation time did not advance during the live flight", later.getDouble("simT") > initialTime)
        }
    }
}

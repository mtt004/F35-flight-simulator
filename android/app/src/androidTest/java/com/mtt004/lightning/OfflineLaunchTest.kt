package com.mtt004.lightning

import android.test.ActivityInstrumentationTestCase2
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Runs the actual bundled WebView, requiring working WebGL2 on an emulator/device. */
@Suppress("DEPRECATION")
class OfflineLaunchTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testBundledSimulatorLoadsAndStarts() {
        val screen = activity
        var status = ""
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(90)
        while (System.nanoTime() < deadline) {
            val latch = CountDownLatch(1)
            instrumentation.runOnMainSync {
                screen.webView.evaluateJavascript("Boolean(window.__F35B_SIM__)") {
                    status = it
                    latch.countDown()
                }
            }
            assertTrue("WebView evaluation timed out", latch.await(10, TimeUnit.SECONDS))
            if (status == "true") break
            Thread.sleep(250)
        }
        assertEquals("Simulator diagnostics unavailable", "true", status)
        val started = CountDownLatch(1)
        instrumentation.runOnMainSync {
            screen.webView.evaluateJavascript("document.getElementById('start').click(); document.getElementById('boot').style.display") {
                status = it
                started.countDown()
            }
        }
        assertTrue(started.await(30, TimeUnit.SECONDS))
        assertEquals("Flight menu did not close", "\"none\"", status)
    }
}

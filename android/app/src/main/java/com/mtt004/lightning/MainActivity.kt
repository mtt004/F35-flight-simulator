package com.mtt004.lightning

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.View
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/** A restricted offline host: no network permission, file access, or native JS bridge. */
class MainActivity : Activity() {
    internal lateinit var webView: WebView
        private set
    private lateinit var container: FrameLayout
    private var rendererFailed = false
    private var pendingFileSelection: ValueCallback<Array<Uri>>? = null
    private val filePickerRequest = 4170
    private val startUrl = "https://appassets.androidplatform.net/assets/www/index.html"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        container = FrameLayout(this)
        setContentView(container)
        createWebView()
        enterFullscreen()
    }

    private fun allowed(uri: Uri): Boolean = uri.scheme == "https" &&
        uri.host == "appassets.androidplatform.net" && uri.port == -1 &&
        uri.path?.startsWith("/assets/www/") == true

    private fun blockedResponse() = WebResourceResponse(
        "text/plain", "UTF-8", 403, "Offline content only", emptyMap(),
        ByteArrayInputStream("External requests are disabled".toByteArray())
    )

    @SuppressLint("SetJavaScriptEnabled")
    @Suppress("DEPRECATION")
    private fun createWebView() {
        rendererFailed = false
        webView = WebView(this)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.settings.apply {
            javaScriptEnabled = true // Only the checked-in bundled simulator can execute.
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mediaPlaybackRequiresUserGesture = true
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_NO_CACHE
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) { request.deny() }

            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: WebChromeClient.FileChooserParams
            ): Boolean {
                cancelFileSelection()
                val accepted = params.acceptTypes.orEmpty().filter { it.isNotBlank() }.map { it.lowercase() }
                if (!allowed(Uri.parse(view.url ?: "")) || params.mode != WebChromeClient.FileChooserParams.MODE_OPEN ||
                    params.isCaptureEnabled || accepted.isEmpty() ||
                    accepted.any { it != "application/json" && it != ".json" }) {
                    callback.onReceiveValue(null)
                    return true
                }
                pendingFileSelection = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/json"
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                return try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(intent, filePickerRequest)
                    true
                } catch (_: ActivityNotFoundException) {
                    cancelFileSelection()
                    true
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) =
                !allowed(request.url)

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                if (allowed(request.url)) loader.shouldInterceptRequest(request.url) ?: blockedResponse()
                else blockedResponse()

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                if (!allowed(Uri.parse(url))) view.stopLoading()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame && !isFinishing) {
                    showReload("The bundled simulator could not load. " + error.description)
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                cancelFileSelection()
                rendererFailed = true
                container.removeView(view)
                view.destroy()
                if (!isFinishing) showReload("Android stopped the graphics process. Reload to return to the flight menu. Unsaved flight progress will be lost.")
                return true
            }
        }
        container.addView(webView, FrameLayout.LayoutParams(-1, -1))
        webView.loadUrl(startUrl)
    }

    private fun cancelFileSelection() {
        val callback = pendingFileSelection
        pendingFileSelection = null
        callback?.onReceiveValue(null)
    }

    /** The user selects one JSON document; it never becomes a WebView navigation target. */
    @Deprecated("Uses the platform document-picker result API for API 26 compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != filePickerRequest) return
        val callback = pendingFileSelection ?: return
        pendingFileSelection = null
        val uri = data?.data
        val accepted = resultCode == RESULT_OK && uri?.scheme == "content" && try {
            var name: String? = null
            var size: Long? = null
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    name = cursor.getString(0)
                    if (!cursor.isNull(1)) size = cursor.getLong(1)
                }
            }
            name?.endsWith(".json", ignoreCase = true) == true &&
                (size == null || (size!! > 0L && size!! <= 16384L))
        } catch (_: Exception) { false }
        callback.onReceiveValue(if (accepted && uri != null) arrayOf(uri) else null)
    }

    private fun showReload(message: CharSequence) {
        AlertDialog.Builder(this).setTitle("Lightning F-35B").setMessage(message)
            .setPositiveButton("Reload") { _, _ ->
                if (rendererFailed) createWebView() else webView.reload()
            }
            .setNegativeButton("Close") { _, _ -> finish() }.show()
    }

    @Suppress("DEPRECATION")
    private fun enterFullscreen() {
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterFullscreen()
    }

    override fun onPause() {
        if (::webView.isInitialized && !rendererFailed) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('lightningpause'))", null)
            webView.onPause()
            webView.pauseTimers()
        }
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized && !rendererFailed) {
            webView.resumeTimers()
            webView.onResume()
            webView.evaluateJavascript("window.dispatchEvent(new Event('lightningresume'))", null)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && !rendererFailed) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('lightningpause'))", null)
        }
        AlertDialog.Builder(this).setTitle("Exit Lightning?")
            .setMessage("Your settings are retained. Save flight progress from the game before exiting.")
            .setPositiveButton("Exit") { _, _ -> finish() }
            .setNegativeButton("Stay") { _, _ -> enterFullscreen() }.show()
    }

    override fun onDestroy() {
        cancelFileSelection()
        if (::webView.isInitialized && !rendererFailed) {
            container.removeView(webView)
            webView.destroy()
        }
        super.onDestroy()
    }
}

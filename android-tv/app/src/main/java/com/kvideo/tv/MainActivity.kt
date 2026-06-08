package com.kvideo.tv

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError
import android.widget.ProgressBar
import android.widget.FrameLayout
import android.widget.TextView
import android.view.Gravity
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {

    companion object {
        /** Cloudflare 部署的 KVideo 网站，网页端已自带 PasswordGate 登录界面 */
        private const val KVIDEO_URL = "https://xixil.cc.cd"
        private const val TAG = "KVideoTV"
        // 白屏检测：如果页面10秒后还没渲染出内容，尝试重载
        private const val WHITE_SCREEN_TIMEOUT_MS = 10000L
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorView: TextView
    private lateinit var rootLayout: FrameLayout
    private var loadAttempts = 0
    private val maxLoadAttempts = 3
    private var hasContentLoaded = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var whiteScreenChecker: Runnable? = null

    inner class JSConsoleBridge {
        @JavascriptInterface
        fun log(msg: String) {
            Log.d(TAG, "[JS] $msg")
        }
        @JavascriptInterface
        fun error(msg: String) {
            Log.e(TAG, "[JS] $msg")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 全屏沉浸模式
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )

        // 根布局
        rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
        }

        // 错误提示（隐藏）
        errorView = TextView(this).apply {
            text = "加载中..."
            setTextColor(Color.parseColor("#FFCC00"))
            textSize = 18f
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
            }
            visibility = View.GONE
        }

        // 进度条
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                6
            ).apply {
                gravity = Gravity.TOP
            }
            max = 100
            progress = 0
            isIndeterminate = false
            visibility = View.GONE
        }

        // WebView
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            id = View.generateViewId()

            // 开启远程调试（可连接 Chrome devtools）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                WebView.setWebContentsDebuggingEnabled(true)
            }

            // 添加 JS 日志桥
            addJavascriptInterface(JSConsoleBridge(), "AndroidBridge")

            // 硬件加速
            setLayerType(View.LAYER_TYPE_HARDWARE, null)

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                loadWithOverviewMode = true
                useWideViewPort = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                databaseEnabled = true
                allowContentAccess = true
                allowFileAccess = false
                loadsImagesAutomatically = true
                blockNetworkImage = false
                builtInZoomControls = false
                displayZoomControls = false

                // JS 引擎设置 - 兼容旧设备
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    // 允许混合内容
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                }

                // TV UA：去掉 wv 标识，让网站识别为桌面 Chrome
                val ua = settings.userAgentString
                userAgentString = ua
                    .replace("; wv", "")
                    .replace(Regex("Version/\\d+(\\.\\d+)*"), "Chrome/120")
                    .replace("Android 10", "Android 10")
                    // 确保不包含 Android TV 标识以防被网站检测
                    .replace(Regex("(?i)smart.?tv|android.?tv|tv|leakback"), "")
                Log.d(TAG, "UA: $userAgentString")
            }

            // WebView 客户端
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    hasContentLoaded = false
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = 0
                    errorView.visibility = View.GONE
                    Log.d(TAG, "Loading: $url")

                    // 启动白屏检测定时器
                    whiteScreenChecker?.let { mainHandler.removeCallbacks(it) }
                    whiteScreenChecker = Runnable {
                        if (!hasContentLoaded && loadAttempts < maxLoadAttempts) {
                            Log.w(TAG, "白屏检测触发 - 重试第 ${loadAttempts + 1} 次")
                            loadAttempts++
                            view?.loadUrl(KVIDEO_URL)
                        } else if (!hasContentLoaded) {
                            Log.e(TAG, "白屏检测 - 已达最大重试次数")
                            showError("无法加载页面，请检查网络连接")
                        }
                    }
                    mainHandler.postDelayed(whiteScreenChecker!!, WHITE_SCREEN_TIMEOUT_MS)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Log.d(TAG, "Page finished: $url")

                    // 页面加载完后，注入 JS 来检查页面是否真的渲染了内容
                    view?.evaluateJavascript("""
                        (function() {
                            try {
                                var body = document.body;
                                var hasVisibleContent = body && 
                                    (body.innerHTML.length > 100 || 
                                     body.children.length > 1 ||
                                     document.querySelector('input') !== null ||
                                     document.querySelector('button') !== null);
                                AndroidBridge.log('hasVisibleContent: ' + hasVisibleContent);
                                return hasVisibleContent ? 'true' : 'false';
                            } catch(e) {
                                AndroidBridge.error(e.message);
                                return 'false';
                            }
                        })();
                    """.trimIndent()) { result ->
                        if (result == "\"true\"") {
                            hasContentLoaded = true
                            whiteScreenChecker?.let { mainHandler.removeCallbacks(it) }
                            Log.d(TAG, "页面内容已渲染")
                        }
                    }

                    if (progressBar.progress >= 80) {
                        progressBar.postDelayed({
                            progressBar.visibility = View.GONE
                        }, 300)
                    }
                }

                override fun onReceivedSslError(
                    view: WebView?,
                    handler: SslErrorHandler?,
                    error: SslError?
                ) {
                    Log.w(TAG, "SSL 错误: ${error?.toString()}")
                    // 信任 Cloudflare SSL 证书（某些电视证书库可能不完整）
                    handler?.proceed()
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    val description = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        error?.description?.toString() ?: "未知错误"
                    } else {
                        "未知错误"
                    }
                    Log.e(TAG, "加载错误: $description")

                    if (request?.isForMainFrame == true) {
                        if (loadAttempts < maxLoadAttempts) {
                            loadAttempts++
                            Log.d(TAG, "重试第 $loadAttempts 次...")
                            view?.postDelayed({
                                view.loadUrl(KVIDEO_URL)
                            }, 2000)
                        } else {
                            showError("页面加载失败: $description")
                        }
                    }
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false
                    // 允许在 WebView 内打开所有同源链接
                    return false
                }
            }

            // Chrome 客户端 — 进度条更新 + 控制台日志捕获
            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    progressBar.progress = newProgress
                    if (newProgress >= 95) {
                        progressBar.postDelayed({
                            progressBar.visibility = View.GONE
                        }, 200)
                    }
                }

                override fun onConsoleMessage(msg: ConsoleMessage?): Boolean {
                    val level = when (msg?.messageLevel()) {
                        ConsoleMessage.MessageLevel.ERROR -> "E"
                        ConsoleMessage.MessageLevel.WARNING -> "W"
                        else -> "D"
                    }
                    Log.d(TAG, "[CONSOLE $level] ${msg?.message()} (${msg?.sourceId()}:${msg?.lineNumber()})")
                    return true
                }
            }

            // 加载 Cloudflare 站点
            loadUrl(KVIDEO_URL)
        }

        rootLayout.addView(webView)
        rootLayout.addView(progressBar)
        rootLayout.addView(errorView)
        setContentView(rootLayout)
    }

    private fun showError(message: String) {
        errorView.apply {
            text = message
            setTextColor(Color.parseColor("#FF4444"))
            visibility = View.VISIBLE
        }
        progressBar.visibility = View.GONE
    }

    // D-pad 中心键 → Enter，适配电视遥控器输入密码
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER) {
            webView.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER) {
            webView.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    @Deprecated("Use OnBackPressedDispatcher")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        whiteScreenChecker?.let { mainHandler.removeCallbacks(it) }
        webView.destroy()
        super.onDestroy()
    }
}

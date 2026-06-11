package com.kvideo

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
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
import androidx.activity.ComponentActivity
import android.webkit.RenderProcessGoneDetail

class MainActivity : ComponentActivity() {

    companion object {
        private const val KVIDEO_URL = "https://xixil.cc.cd"
        private const val TAG = "KVideo"
        // 电视网速慢，给 25 秒超时
        private const val WHITE_SCREEN_TIMEOUT_MS = 25000L
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
    private var isTvDevice = false

    inner class JSConsoleBridge {
        @JavascriptInterface
        fun log(msg: String) {
            Log.d(TAG, "[JS] $msg")
        }
        @JavascriptInterface
        fun error(msg: String) {
            Log.e(TAG, "[JS] $msg")
            mainHandler.post {
                if (!hasContentLoaded) {
                    errorView.text = "JS: $msg"
                    errorView.visibility = View.VISIBLE
                }
            }
        }
        @JavascriptInterface
        fun pageReady() {
            Log.d(TAG, "[JS] 页面汇报就绪")
            hasContentLoaded = true
            mainHandler.post {
                whiteScreenChecker?.let { mainHandler.removeCallbacks(it) }
                errorView.visibility = View.GONE
                progressBar.postDelayed({
                    progressBar.visibility = View.GONE
                }, 500)
            }
        }
    }

    /** 检测是否为电视设备 */
    private fun isTv(context: Context): Boolean {
        val uiMode = context.resources.configuration.uiMode and
                Configuration.UI_MODE_TYPE_MASK
        return uiMode == Configuration.UI_MODE_TYPE_TELEVISION
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        isTvDevice = isTv(this)

        // 电视：全屏沉浸模式；手机：保持屏幕常亮
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (isTvDevice) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
        }

        // 根布局
        rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
        }

        // 错误提示
        errorView = TextView(this).apply {
            text = "加载中..."
            setTextColor(Color.parseColor("#FFCC00"))
            textSize = if (isTvDevice) 18f else 16f
            typeface = Typeface.MONOSPACE
            gravity = Gravity.CENTER
            setPadding(40, 60, 40, 40)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
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
                if (isTvDevice) 6 else 4
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

            // 开启远程调试
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                WebView.setWebContentsDebuggingEnabled(true)
            }

            // 添加 JS 日志桥
            addJavascriptInterface(JSConsoleBridge(), "AndroidBridge")

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                loadWithOverviewMode = true
                useWideViewPort = true
                cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK // 优先缓存加速二次加载
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                databaseEnabled = true
                allowContentAccess = true
                allowFileAccess = false
                loadsImagesAutomatically = true
                blockNetworkImage = false

                // 安全浏览可能导致空白页（老电视 WebView 常见问题）
                safeBrowsingEnabled = false

                // 电视：禁用缩放；手机：支持双指缩放
                builtInZoomControls = !isTvDevice
                displayZoomControls = false
                setSupportZoom(!isTvDevice)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                }

                // 清理 UA：去掉 wv 标识，电视版额外去掉 TV 关键词
                val ua = settings.userAgentString
                val cleanUA = if (isTvDevice) {
                    ua.replace(Regex(" wv"), "")
                        .replace(Regex("Version/\\d+(\\.\\d+)*"), "Chrome/120")
                        .replace(Regex("(?i)Leakback|SmartTV|Android TV"), "")
                } else {
                    ua.replace(Regex(" wv"), "")
                        .replace(Regex("Version/\\d+(\\.\\d+)*"), "Chrome/120")
                }
                userAgentString = cleanUA.trim()
                Log.d(TAG, "UA: $userAgentString | isTV: $isTvDevice")
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
                            loadAttempts++
                            Log.w(TAG, "白屏检测触发 - 重试第 $loadAttempts 次")
                            if (loadAttempts <= maxLoadAttempts) {
                                view?.loadUrl(KVIDEO_URL)
                            }
                        } else if (!hasContentLoaded) {
                            Log.e(TAG, "白屏检测 - 已达最大重试次数")
                            showError("无法加载页面，请检查：\n1. 网络连接是否正常\n2. 电视 WebView 是否需要更新\n3. 科学上网是否开启")
                        }
                    }
                    mainHandler.postDelayed(whiteScreenChecker!!, WHITE_SCREEN_TIMEOUT_MS)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Log.d(TAG, "Page finished: $url")

                    // 注入 JS 错误捕获 + 就绪通知
                    view?.evaluateJavascript("""
                        (function() {
                            try {
                                // 捕获全局 JS 错误
                                window.onerror = function(msg, source, line, col, error) {
                                    var errMsg = msg + ' @ ' + (source||'') + ':' + line;
                                    try { AndroidBridge.error(errMsg); } catch(e) {}
                                    return true;
                                };
                                // 捕获未处理的 Promise 错误
                                window.addEventListener('unhandledrejection', function(e) {
                                    try { AndroidBridge.error('Unhandled: ' + (e.reason || 'unknown')); } catch(er) {}
                                });
                                // 检查内容是否已渲染
                                var checkContent = function() {
                                    var body = document.body;
                                    if (body && body.innerHTML.length > 50) {
                                        try { AndroidBridge.pageReady(); } catch(e) {}
                                        return true;
                                    }
                                    return false;
                                };
                                // 立即检查
                                if (checkContent()) return;
                                // 等 React 渲染（最多等 30 秒）
                                var retries = 0;
                                var timer = setInterval(function() {
                                    if (checkContent() || retries++ > 60) {
                                        clearInterval(timer);
                                        if (retries > 60) {
                                            try { AndroidBridge.error('页面渲染超时'); } catch(e) {}
                                        }
                                    }
                                }, 500);
                            } catch(e) {
                                try { AndroidBridge.error('Inject Error: ' + e.message); } catch(er) {}
                            }
                        })();
                    """.trimIndent(), null)

                    // 进度条自动隐藏
                    if (progressBar.progress >= 80) {
                        progressBar.postDelayed({
                            progressBar.visibility = View.GONE
                        }, 300)
                    }
                }

                override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                    Log.e(TAG, "WebView 渲染进程崩溃！didCrash=${detail?.didCrash()}")
                    showError("WebView 渲染进程崩溃\n请更新 WebView 组件或重启应用")
                    return true
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
                    Log.e(TAG, "加载错误: $description (url=${request?.url})")

                    if (request?.isForMainFrame == true) {
                        if (loadAttempts < maxLoadAttempts) {
                            loadAttempts++
                            Log.d(TAG, "重试第 $loadAttempts 次...")
                            showError("加载失败 ($description)\n${maxLoadAttempts - loadAttempts + 1} 秒后重试...")
                            view?.postDelayed({
                                errorView.visibility = View.GONE
                                view.loadUrl(KVIDEO_URL)
                            }, 2000)
                        } else {
                            showError("页面加载失败: $description\n请检查网络连接")
                        }
                    }
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    return false // 允许在 WebView 内打开所有链接
                }
            }

            // Chrome 客户端
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

    // 电视遥控器 D-pad 中心键 → Enter，适配电视输入密码
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (isTvDevice && keyCode == KeyEvent.KEYCODE_DPAD_CENTER) {
            webView.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (isTvDevice && keyCode == KeyEvent.KEYCODE_DPAD_CENTER) {
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

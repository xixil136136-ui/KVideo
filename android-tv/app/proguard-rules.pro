# KVideo TV ProGuard 规则

# ==========================================
# 核心规则：不混淆我们的应用
# ==========================================
-keep class com.kvideo.** { *; }

# ==========================================
# WebView 相关 — 必须保留全部方法
# ==========================================
-keep class android.webkit.** { *; }
-keep class android.webkit.WebSettings { *; }
-keep class android.webkit.WebChromeClient { *; }
-keep class android.webkit.WebViewClient { *; }
-keep class android.webkit.ConsoleMessage { *; }
-keep class android.webkit.RenderProcessGoneDetail { *; }

# ==========================================
# JavaScript 接口 — 必须保留 @JavascriptInterface 方法
# ==========================================
-keep class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.kvideo.MainActivity$JSConsoleBridge {
    *;
}

# ==========================================
# SSL 错误处理
# ==========================================
-keep class android.net.http.SslError { *; }
-keep class android.webkit.SslErrorHandler { *; }

# ==========================================
# 生命周期 & UI
# ==========================================
-keep class android.view.ViewGroup { *; }
-keep class android.view.ViewTreeObserver { *; }
-keep class android.graphics.Typeface { *; }
-keep class android.graphics.drawable.GradientDrawable { *; }

# ==========================================
# Activity Component
# ==========================================
-keep class androidx.activity.ComponentActivity { *; }

# ==========================================
# 保留所有原生 Android 类 — 避免任何混淆导致的运行时异常
# ==========================================
-keep class android.** { *; }

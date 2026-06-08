# KVideo TV ProGuard 规则

# 保留 WebView 相关类
-keepclassmembers class * extends android.webkit.WebView {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
}
-keep class android.webkit.** { *; }

# 保留 JavaScript 接口类
-keep class com.kvideo.tv.MainActivity$JSConsoleBridge { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 保留 WebView 客户端
-keep class com.kvideo.tv.MainActivity$* { *; }

# 保留日志相关
-keep class android.util.Log { *; }

# 保留所有 WebView 设置
-keep class android.webkit.WebSettings { *; }
-keep class android.webkit.WebChromeClient { *; }
-keep class android.webkit.WebViewClient { *; }
-keep class android.webkit.ConsoleMessage { *; }

# 保留 SSL 相关
-keep class android.net.http.SslError { *; }
-keep class android.webkit.SslErrorHandler { *; }

# 保留 GradientDrawable
-keep class android.graphics.drawable.GradientDrawable { *; }

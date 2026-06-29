# ProGuard rules for KVideo NB影视
# WebView + JavaScript
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.kvideo.MainActivity$JSConsoleBridge {
    *;
}
-dontwarn android.webkit.**

# 腾讯X5 TBS内核混淆规则
-keep class com.tencent.smtt.** { *; }
-keep class com.tencent.tbs.** { *; }
-keep class com.tencent.smtt.export.external.** { *; }
-dontwarn com.tencent.smtt.**
-dontwarn com.tencent.tbs.**

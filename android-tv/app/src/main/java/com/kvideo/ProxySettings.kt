package com.kvideo

import android.content.Context
import android.content.SharedPreferences
import android.util.Log

/**
 * Persistent proxy settings for WebView routing through a proxy server.
 * Enables access to Cloudflare-hosted sites from regions that require proxied connectivity.
 */
class ProxySettings(context: Context) {

    companion object {
        private const val TAG = "KVideo.Proxy"
        private const val PREFS_NAME = "nbproxy"
        private const val KEY_ENABLED = "proxy_enabled"
        private const val KEY_HOST = "proxy_host"
        private const val KEY_PORT = "proxy_port"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    var enabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    var host: String
        get() = prefs.getString(KEY_HOST, "127.0.0.1") ?: "127.0.0.1"
        set(value) = prefs.edit().putString(KEY_HOST, value).apply()

    var port: Int
        get() = prefs.getInt(KEY_PORT, 7890)
        set(value) = prefs.edit().putInt(KEY_PORT, value).apply()

    /**
     * Apply proxy settings to the JVM-level networking stack.
     * This affects URLConnection-based requests.
     * For Chromium WebView proxy, use applyToWebView() via reflection.
     */
    fun applySystemProperties() {
        if (!enabled) {
            clearSystemProperties()
            return
        }
        System.setProperty("http.proxyHost", host)
        System.setProperty("http.proxyPort", port.toString())
        System.setProperty("https.proxyHost", host)
        System.setProperty("https.proxyPort", port.toString())
        Log.d(TAG, "System proxy set to $host:$port")
    }

    fun clearSystemProperties() {
        System.clearProperty("http.proxyHost")
        System.clearProperty("http.proxyPort")
        System.clearProperty("https.proxyHost")
        System.clearProperty("https.proxyPort")
        Log.d(TAG, "System proxy cleared")
    }

    override fun toString(): String {
        return if (enabled) "$host:$port" else "disabled"
    }
}

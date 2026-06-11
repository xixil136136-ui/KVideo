/**
 * Type declarations for Android WebView JavaScript Bridge
 * Used by KVideo Android app to communicate with the web app
 */
interface AndroidBridge {
  log(msg: string): void;
  error(msg: string): void;
  pageReady(): void;
}

declare var AndroidBridge: AndroidBridge | undefined;

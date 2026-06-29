import React from 'react';
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AutoSync } from '@/components/AutoSync'; // <-- 引入了自动同步组件
import { TVProvider } from "@/lib/contexts/TVContext";
import { TVNavigationInitializer } from "@/components/TVNavigationInitializer";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { getEnvVar, hasEnvVar } from "@/lib/env";
import { PasswordGate } from "@/components/PasswordGate";
import { siteConfig } from "@/lib/config/site-config";
import { AdKeywordsInjector } from "@/components/AdKeywordsInjector";
import { BackToTop } from "@/components/ui/BackToTop";
import { ScrollPositionManager } from "@/components/ScrollPositionManager";
import { LocaleProvider } from "@/components/LocaleProvider";
import { HideLoadingScreen } from "@/components/HideLoadingScreen";
import fs from 'fs';
import path from 'path';


// Server Component specifically for reading env/file (async for best practices)
async function AdKeywordsWrapper() {
  let keywords: string[] = [];

  try {
    // 1. Try reading from file (Docker runtime support)
    const keywordsFile = getEnvVar('AD_KEYWORDS_FILE');
    if (keywordsFile) {
      // Resolve absolute path or relative to CWD
      const filePath = path.isAbsolute(keywordsFile)
        ? keywordsFile
        : path.join(process.cwd(), keywordsFile);

      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        keywords = content.split(/[\n,]/).map((k: string) => k.trim()).filter((k: string) => k);
        console.log(`[AdFilter] Loaded ${keywords.length} keywords from file: ${filePath}`);
      } catch (fileError: unknown) {
        // Handle file not found (ENOENT) gracefully
        if ((fileError as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn('[AdFilter] Error reading keywords file:', fileError);
        }
      }
    }

    // 2. Fallback to Env var (Runtime or Build time)
    if (keywords.length === 0) {
      const envKeywords = getEnvVar('AD_KEYWORDS') || getEnvVar('NEXT_PUBLIC_AD_KEYWORDS');
      if (envKeywords) {
        keywords = envKeywords.split(/[\n,]/).map((k: string) => k.trim()).filter((k: string) => k);
      }
    }
  } catch (error) {
    console.warn('[AdFilter] Failed to load keywords:', error);
  }

  return <AdKeywordsInjector keywords={keywords} />;
}

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        {/* Apple PWA Support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NB影院" />
        <link rel="apple-touch-icon" href="/icon.png" />
        {/* Theme Color (for browser address bar) */}
        <meta name="theme-color" content="#000000" />
        {/* Mobile viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className={`antialiased`}
        suppressHydrationWarning
      >
        {/* TV/旧设备兼容：React 加载前显示加载状态，防止白屏；水合后由脚本自动移除 */}
        <div id="kv-loading" className="kv-loading">
          <div style={{textAlign:'center'}}>
            <div className="kv-spinner" />
            <div>加载中...</div>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){
            var el=document.getElementById('kv-loading');
            if(!el)return;
            // 检查 React 根节点是否已水合（body 内出现 React 特有的 DOM 结构）
            var check=function(){
              var root=document.querySelector('[id^="__next"]') || document.querySelector('[data-nextjs-root]');
              if(document.querySelector('[class*="theme"]') || document.querySelector('[class*="search"]')){
                el.classList.add('hidden');
              }else{
                setTimeout(check,200);
              }
            };
            setTimeout(check,100); // 首次检查，给 React 启动时间
            setTimeout(function(){el.classList.add('hidden')},3000); // 最晚 3 秒强制隐藏，防止永驻加载中
          })();`
        }} />
        <ThemeProvider>
          {/* 加入自动同步组件，它会在后台默默工作，我们放在 ThemeProvider 内部的最前面 */}
          <HideLoadingScreen />
          <AutoSync />
          <LocaleProvider />

          <TVProvider>
            <TVNavigationInitializer />
            <PasswordGate hasAuth={!!(hasEnvVar('ADMIN_PASSWORD') || hasEnvVar('ACCOUNTS') || hasEnvVar('ACCESS_PASSWORD'))}>
              <AdKeywordsWrapper />
              {children}
              <BackToTop />
              <ScrollPositionManager />
            </PasswordGate>
          </TVProvider>
          <ServiceWorkerRegister />
        </ThemeProvider>

        {/* ARIA Live Region for Screen Reader Announcements */}
        <div
          id="aria-live-announcer"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        {/* Google Cast SDK */}
        <script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1" async />

        {/* Scroll Performance Optimization Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                let scrollTimer;
                const body = document.body;
                
                function handleScroll() {
                  body.classList.add('scrolling');
                  clearTimeout(scrollTimer);
                  scrollTimer = setTimeout(function() {
                    body.classList.remove('scrolling');
                  }, 150);
                }
                
                let ticking = false;
                window.addEventListener('scroll', function() {
                  if (!ticking) {
                    window.requestAnimationFrame(function() {
                      handleScroll();
                      ticking = false;
                    });
                    ticking = true;
                  }
                }, { passive: true });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}

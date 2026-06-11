import React from 'react';
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AutoSync } from '@/components/AutoSync'; // <-- 引入了自动同步组件
import { TVProvider } from "@/lib/contexts/TVContext";
import { TVNavigationInitializer } from "@/components/TVNavigationInitializer";
import { Analytics } from "@vercel/analytics/react";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { getEnvVar, hasEnvVar } from "@/lib/env";
import { PasswordGate } from "@/components/PasswordGate";
import { siteConfig } from "@/lib/config/site-config";
import { AdKeywordsInjector } from "@/components/AdKeywordsInjector";
import { BackToTop } from "@/components/ui/BackToTop";
import { ScrollPositionManager } from "@/components/ScrollPositionManager";
import { LocaleProvider } from "@/components/LocaleProvider";
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
        {/* TV/旧设备兼容：在 React 加载前显示加载状态，防止白屏 */}
        <div id="kv-loading" style={{display:'flex',position:'fixed',inset:0,zIndex:99999,background:'#000',color:'#888',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif',fontSize:'16px',pointerEvents:'none' as any}}>
          <div style={{textAlign:'center' as any}}>
            <div style={{display:'inline-block',width:32,height:32,border:'3px solid #333',borderTopColor:'#fff',borderRadius:'50%',animation:'kvspin 1s linear infinite',marginBottom:12}} />
            <div>加载中...</div>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html:'@keyframes kvspin{to{transform:rotate(360deg)}}#kv-loading.hidden{opacity:0;transition:opacity .3s}'}} />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){
            var el=document.getElementById('kv-loading');
            var check=function(){
              if(document.body && document.body.innerHTML.length>100){
                el&&el.classList.add('hidden');
                setTimeout(function(){el&&el.parentNode&&el.parentNode.removeChild(el)},500);
              }else{
                setTimeout(check,300);
              }
            };
            setTimeout(check,500);
            setTimeout(function(){el&&el.classList.add('hidden')},8000);
          })();`
        }} />
        <ThemeProvider>
          {/* 加入自动同步组件，它会在后台默默工作，我们放在 ThemeProvider 内部的最前面 */}
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
          <Analytics />
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

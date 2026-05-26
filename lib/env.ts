/**
 * Cross-runtime environment variable reader.
 * Works in both Cloudflare Pages Edge Runtime and local Node.js.
 */

export function getEnvVar(name: string): string {
  // Cloudflare Pages Edge Runtime — use getRequestContext
  try {
    if (typeof EdgeRuntime !== 'undefined') {
      // Dynamic require to avoid build-time import issues
      const mod = require('@cloudflare/next-on-pages');
      const ctx = mod.getRequestContext();
      if (ctx?.env && ctx.env[name] !== undefined) {
        return String(ctx.env[name]);
      }
    }
  } catch {}
  // Local Node.js
  try {
    if (typeof process !== 'undefined' && process.env?.[name] !== undefined) {
      return process.env[name] || '';
    }
  } catch {}
  return '';
}

export function hasEnvVar(name: string): boolean {
  return getEnvVar(name).length > 0;
}

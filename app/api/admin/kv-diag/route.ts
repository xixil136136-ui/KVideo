/**
 * KV Diagnostics endpoint
 * Check if KV binding is properly accessible
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const results: Record<string, any> = {};

  // Test 1: Check global KV_ACCOUNTS
  try {
    const kvGlobal = (globalThis as any).KV_ACCOUNTS;
    results.globalKV = typeof kvGlobal;
    results.globalKVType = kvGlobal?.constructor?.name;
    results.globalKVHasGet = typeof kvGlobal?.get === 'function';
    results.globalKVHasPut = typeof kvGlobal?.put === 'function';
  } catch (e: any) {
    results.globalKV = `error: ${e.message}`;
  }

  // Test 2: Check getRequestContext
  try {
    const { getRequestContext } = require('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    results.hasContext = !!ctx;
    if (ctx) {
      results.hasEnv = !!ctx.env;
      results.envKeys = ctx.env ? Object.keys(ctx.env) : [];
      const kv = ctx.env?.KV_ACCOUNTS;
      results.ctxKVType = kv?.constructor?.name;
      results.ctxKVHasGet = typeof kv?.get === 'function';
      results.ctxKVHasPut = typeof kv?.put === 'function';

      // Test actual KV operations
      if (kv && typeof kv.put === 'function') {
        try {
          await kv.put('kv_diag_test', JSON.stringify({ ts: Date.now() }), {});
          results.kvPut = 'ok';
          const readBack = await kv.get('kv_diag_test', 'json');
          results.kvRead = readBack ? 'ok - read back successfully' : 'null - empty read';
          await kv.delete('kv_diag_test');
          results.kvDelete = 'ok';
        } catch (e2: any) {
          results.kvOpError = e2.message;
        }
      }
    }
  } catch (e: any) {
    results.requestContext = `error: ${e.message}`;
  }

  // Test 3: EdgeRuntime global
  try {
    results.edgeRuntime = typeof (globalThis as any).EdgeRuntime;
  } catch {
    results.edgeRuntime = 'undefined';
  }

  return NextResponse.json(results);
}

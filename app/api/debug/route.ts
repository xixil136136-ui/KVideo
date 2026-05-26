/**
 * Diagnostic debug endpoint
 */
export const runtime = 'edge';

export async function GET() {
  const diag: Record<string, any> = {};

  // 1. KV binding availability
  diag.hasGlobalKV = typeof (globalThis as any).KV_ACCOUNTS !== 'undefined';
  diag.globalKVType = typeof (globalThis as any).KV_ACCOUNTS;
  diag.hasProcessEnvKV = typeof process !== 'undefined' && typeof (process as any).env?.KV_ACCOUNTS !== 'undefined';
  diag.processEnvKVType = typeof (process as any).env?.KV_ACCOUNTS;

  // 2. Get the KV binding
  let kv: any = null;
  try {
    if (typeof (globalThis as any).KV_ACCOUNTS !== 'undefined') kv = (globalThis as any).KV_ACCOUNTS;
    else if (typeof process !== 'undefined' && (process as any).env?.KV_ACCOUNTS) kv = (process as any).env?.KV_ACCOUNTS;
  } catch {}

  diag.kvAvailable = !!kv;
  if (kv) {
    diag.kvMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(kv)).filter((k: string) => typeof kv[k] === 'function');
    diag.kvOwnKeys = Object.keys(kv).slice(0, 10);
    diag.kvCtor = kv.constructor?.name;
  }

  // 3. Test KV GET
  try {
    if (kv && typeof kv.get === 'function') {
      const raw = await kv.get('kvideo_admin_accounts', 'json');
      diag.kvGetResult = raw;
      diag.kvGetOk = true;
    } else {
      diag.kvGetOk = false;
    }
  } catch (e: any) {
    diag.kvGetError = e.message;
    diag.kvGetOk = false;
  }

  // 4. Test KV PUT
  const testKey = 'kvideo_diag_test_' + Date.now();
  const testVal = { ts: Date.now(), msg: 'diag' };
  try {
    if (kv && typeof kv.put === 'function') {
      await kv.put(testKey, JSON.stringify(testVal));
      diag.kvPutOk = true;
      // Read it back to verify
      const back = await kv.get(testKey, 'json');
      diag.kvPutVerify = JSON.stringify(back) === JSON.stringify(testVal);
      // Clean up
      if (typeof kv.delete === 'function') {
        await kv.delete(testKey);
        diag.kvDeleteOk = true;
      }
    } else {
      diag.kvPutOk = false;
      diag.kvPutReason = 'kv.put is not a function';
    }
  } catch (e: any) {
    diag.kvPutError = e.message;
    diag.kvPutOk = false;
  }

  return new Response(JSON.stringify(diag, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

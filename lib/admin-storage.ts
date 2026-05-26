/**
 * Admin Storage Engine
 * 
 * Supports two backends:
 * 1. Cloudflare KV (edge runtime) — via env.KV_ACCOUNTS
 * 2. Local JSON file (Node.js standalone) — runtime fallback
 */

import type { AdminAccount, AdminConfig } from '@/lib/types/admin';
import { getEnvVar } from '@/lib/env';

const ACCOUNTS_KEY = 'kvideo_admin_accounts';
const CONFIG_KEY = 'kvideo_admin_config';

// ============ Cloudflare KV Backend (Edge Runtime) ============

declare global {
  var __adminStorageDir: string | undefined;
}

function isRealKVBinding(kv: any): boolean {
  return kv && typeof kv === 'object' && typeof kv.get === 'function' && typeof kv.put === 'function';
}

function getKVBinding(): any | null {
  try {
    // @ts-ignore - Cloudflare Pages binding
    if (isRealKVBinding(KV_ACCOUNTS)) return KV_ACCOUNTS;
    // @ts-ignore - Cloudflare Workers binding via getRequestContext
    if (typeof EdgeRuntime !== 'undefined') {
      const { getRequestContext } = require('@cloudflare/next-on-pages');
      const ctx = getRequestContext();
      if (ctx && ctx.env && isRealKVBinding(ctx.env.KV_ACCOUNTS)) return ctx.env.KV_ACCOUNTS;
    }
  } catch {}
  return null;
}

// ============ Local File Backend (Node.js) ============

function getFilePath(): string {
  const dir = globalThis.__adminStorageDir || './data';
  return `${dir}/admin-accounts.json`;
}

function getConfigFilePath(): string {
  const dir = globalThis.__adminStorageDir || './data';
  return `${dir}/admin-config.json`;
}

function ensureDir(dir: string) {
  const fs = require('fs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLocalAccounts(): AdminAccount[] {
  try {
    const fs = require('fs');
    const path = getFilePath();
    ensureDir(require('path').dirname(path));
    if (!fs.existsSync(path)) return [];
    const raw = fs.readFileSync(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: AdminAccount[]) {
  const fs = require('fs');
  const path = getFilePath();
  ensureDir(require('path').dirname(path));
  fs.writeFileSync(path, JSON.stringify(accounts, null, 2), 'utf-8');
}

function readLocalConfig(): AdminConfig | null {
  try {
    const fs = require('fs');
    const path = getConfigFilePath();
    ensureDir(require('path').dirname(path));
    if (!fs.existsSync(path)) return null;
    const raw = fs.readFileSync(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocalConfig(config: AdminConfig) {
  const fs = require('fs');
  const path = getConfigFilePath();
  ensureDir(require('path').dirname(path));
  fs.writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
}

// ============ Edge Runtime Detection ============

function isEdgeRuntimeSafe(): boolean {
  try {
    // @ts-ignore - EdgeRuntime global exists only in edge runtime
    return typeof EdgeRuntime !== 'undefined';
  } catch {
    return false;
  }
}

// ============ Edge Runtime In-Memory Fallback ============

const edgeMemory: { accounts?: AdminAccount[]; config?: AdminConfig } = {};

// ============ Public API ============

/**
 * Seed initial accounts from environment variables on first run
 */
async function seedAccounts(): Promise<void> {
  const existing = await getAccounts();

  // Seed from ACCOUNTS env var (format: password:name:role,password2:name2:role2)
  const accountsEnv = getEnvVar('ACCOUNTS');
  if (accountsEnv && existing.length === 0) {
    const entries = accountsEnv.split(',').map(e => e.trim()).filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split(':');
      if (parts.length >= 2) {
        const account: AdminAccount = {
          id: `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          password: parts[0].trim(),
          name: parts[1].trim(),
          role: (parts[2]?.trim() as any) || 'viewer',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await addAccount(account);
      }
    }
  }

  // Seed admin from ADMIN_PASSWORD env var if no accounts exist
  const adminPwd = getEnvVar('ADMIN_PASSWORD') || getEnvVar('ACCESS_PASSWORD');
  if (adminPwd && (await getAccounts()).length === 0) {
    const account: AdminAccount = {
      id: 'admin-default',
      password: adminPwd,
      name: '管理员',
      role: 'super_admin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await addAccount(account);
  }

  // Save config
  const premiumPwd = getEnvVar('PREMIUM_PASSWORD');
  const adminPwdActual = getEnvVar('ADMIN_PASSWORD') || getEnvVar('ACCESS_PASSWORD');
  if (adminPwdActual || premiumPwd) {
    await saveConfig({
      adminPassword: adminPwdActual,
      premiumPassword: premiumPwd,
    });
  }
}

export async function getAccounts(): Promise<AdminAccount[]> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try {
      const raw = await kv.get(ACCOUNTS_KEY, 'json');
      if (raw) return raw as AdminAccount[];
    } catch {}
    return [];
  }
  try { return readLocalAccounts(); } catch {
    // Edge Runtime without KV binding: use in-memory fallback
    if (isEdgeRuntimeSafe() && edgeMemory.accounts) return edgeMemory.accounts;
    return [];
  }
}

export async function addAccount(account: AdminAccount): Promise<void> {
  const accounts = await getAccounts();
  accounts.push(account);
  await saveAccounts(accounts);
}

export async function updateAccount(id: string, updates: Partial<AdminAccount>): Promise<boolean> {
  const accounts = await getAccounts();
  const idx = accounts.findIndex(a => a.id === id);
  if (idx === -1) return false;
  accounts[idx] = { ...accounts[idx], ...updates, updatedAt: Date.now() };
  await saveAccounts(accounts);
  return true;
}

export async function deleteAccount(id: string): Promise<boolean> {
  const accounts = await getAccounts();
  const idx = accounts.findIndex(a => a.id === id);
  if (idx === -1) return false;
  accounts.splice(idx, 1);
  await saveAccounts(accounts);
  return true;
}

export async function verifyAccount(password: string): Promise<AdminAccount | null> {
  // Lazily seed on first verification
  await seedAccounts();

  const accounts = await getAccounts();
  const account = accounts.find(a => a.password === password);
  if (!account) return null;
  // 校验过期
  if (account.expiresAt && Date.now() > account.expiresAt) return null;
  return account;
}

/** 判断账号是否已过期 */
export function isAccountExpired(account: AdminAccount): boolean {
  return !!account.expiresAt && Date.now() > account.expiresAt;
}

async function saveAccounts(accounts: AdminAccount[]): Promise<void> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try {
      await kv.put(ACCOUNTS_KEY, JSON.stringify(accounts));
      return;
    } catch {}
  }
  try { writeLocalAccounts(accounts); } catch {
    if (isEdgeRuntimeSafe()) { edgeMemory.accounts = accounts; }
  }
}

export async function getConfig(): Promise<AdminConfig | null> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try {
      const raw = await kv.get(CONFIG_KEY, 'json');
      if (raw) return raw as AdminConfig;
    } catch {}
    return null;
  }
  try { return readLocalConfig(); } catch {
    if (isEdgeRuntimeSafe() && edgeMemory.config) return edgeMemory.config;
    return null;
  }
}

export async function saveConfig(config: AdminConfig): Promise<void> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try {
      await kv.put(CONFIG_KEY, JSON.stringify(config));
      return;
    } catch {}
  }
  try { writeLocalConfig(config); } catch { /* Edge Runtime: no fs available */ }
}

export async function updatePremiumPassword(newPassword: string): Promise<void> {
  const adminPwd = getEnvVar('ADMIN_PASSWORD') || getEnvVar('ACCESS_PASSWORD');
  const config = (await getConfig()) || {
    adminPassword: adminPwd,
    premiumPassword: '',
  };
  config.premiumPassword = newPassword;
  await saveConfig(config);
}

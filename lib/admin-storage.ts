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

function getKVBinding(): any | null {
  try {
    // @ts-ignore - Cloudflare Pages binding
    if (typeof KV_ACCOUNTS !== 'undefined') return KV_ACCOUNTS;
    // @ts-ignore - Cloudflare Workers binding via getRequestContext
    if (typeof EdgeRuntime !== 'undefined') {
      const { getRequestContext } = require('@cloudflare/next-on-pages');
      const ctx = getRequestContext();
      if (ctx && ctx.env && ctx.env.KV_ACCOUNTS) return ctx.env.KV_ACCOUNTS;
    }
    // @ts-ignore - process.env fallback
    if (typeof process !== 'undefined' && process.env?.KV_ACCOUNTS) return process.env.KV_ACCOUNTS;
  } catch {}
  return null;
}

function isEdgeRuntime(): boolean {
  try {
    // @ts-ignore
    return typeof EdgeRuntime !== 'undefined';
  } catch {
    return false;
  }
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
  try {
    // Try KV first (edge runtime)
    if (isEdgeRuntime()) {
      const kv = getKVBinding();
      if (kv) {
        const raw = await kv.get(ACCOUNTS_KEY, 'json');
        if (raw) return raw as AdminAccount[];
      }
      return [];
    }

    // Fallback: local JSON file
    return readLocalAccounts();
  } catch {
    return readLocalAccounts();
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
  return accounts.find(a => a.password === password) || null;
}

async function saveAccounts(accounts: AdminAccount[]): Promise<void> {
  try {
    // Try KV first
    if (isEdgeRuntime()) {
      const kv = getKVBinding();
      if (kv) {
        await kv.put(ACCOUNTS_KEY, JSON.stringify(accounts));
        return;
      }
    }
    writeLocalAccounts(accounts);
  } catch {
    writeLocalAccounts(accounts);
  }
}

export async function getConfig(): Promise<AdminConfig | null> {
  try {
    if (isEdgeRuntime()) {
      const kv = getKVBinding();
      if (kv) {
        const raw = await kv.get(CONFIG_KEY, 'json');
        if (raw) return raw as AdminConfig;
      }
      return null;
    }
    return readLocalConfig();
  } catch {
    return readLocalConfig();
  }
}

export async function saveConfig(config: AdminConfig): Promise<void> {
  try {
    if (isEdgeRuntime()) {
      const kv = getKVBinding();
      if (kv) {
        await kv.put(CONFIG_KEY, JSON.stringify(config));
        return;
      }
    }
    writeLocalConfig(config);
  } catch {
    writeLocalConfig(config);
  }
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

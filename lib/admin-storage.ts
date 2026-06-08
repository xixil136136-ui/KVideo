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
const DEVICE_REGISTRY_KEY = 'kvideo_device_registry';

// ============ Cloudflare KV Backend (Edge Runtime) ============

declare global {
  var __adminStorageDir: string | undefined;
}

function isRealKVBinding(kv: any): boolean {
  return kv && typeof kv === 'object' && typeof kv.get === 'function' && typeof kv.put === 'function';
}

function getKVBinding(): any | null {
  // Priority 1: Direct global (Workers runtime — KV namespace on globalThis)
  try {
    if (isRealKVBinding((globalThis as any).KV_ACCOUNTS)) return (globalThis as any).KV_ACCOUNTS;
  } catch {}
  // Priority 2: process.env (next-on-pages Pages Functions — KV via env proxy)
  try {
    if (isRealKVBinding((process.env as any).KV_ACCOUNTS)) return (process.env as any).KV_ACCOUNTS;
  } catch {}
  // Priority 3: Cloudflare request context via Symbol (next-on-pages runtime)
  try {
    const symbol = Symbol.for('__cloudflare-request-context__');
    const ctx = (globalThis as any)[symbol];
    if (ctx?.env && isRealKVBinding(ctx.env.KV_ACCOUNTS)) return ctx.env.KV_ACCOUNTS;
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

// ============ 设备注册管理 ============

const MAX_DEVICES_PER_PASSWORD = 5;

interface DeviceRegistry {
  [password: string]: string[]; // password → [deviceId1, deviceId2, ...]
}

async function getDeviceRegistry(): Promise<DeviceRegistry> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try {
      const raw = await kv.get(DEVICE_REGISTRY_KEY, 'json');
      if (raw) return raw as DeviceRegistry;
    } catch {}
    return {};
  }
  try {
    const fs = require('fs');
    const dir = globalThis.__adminStorageDir || './data';
    const path = `${dir}/device-registry.json`;
    ensureDir(require('path').dirname(path));
    if (!fs.existsSync(path)) return {};
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

async function saveDeviceRegistry(registry: DeviceRegistry): Promise<void> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try {
      await kv.put(DEVICE_REGISTRY_KEY, JSON.stringify(registry));
      return;
    } catch {}
  }
  try {
    const fs = require('fs');
    const dir = globalThis.__adminStorageDir || './data';
    const path = `${dir}/device-registry.json`;
    ensureDir(require('path').dirname(path));
    fs.writeFileSync(path, JSON.stringify(registry, null, 2), 'utf-8');
  } catch { /* Edge Runtime: no fs available */ }
}

/**
 * 注册设备到密码下
 * 返回 { success: boolean, deviceLimitReached: boolean, deviceCount: number }
 */
export async function registerDevice(password: string, deviceId: string): Promise<{
  success: boolean;
  deviceLimitReached: boolean;
  deviceCount: number;
}> {
  const registry = await getDeviceRegistry();
  const devices = registry[password] || [];

  // 设备已注册过
  if (devices.includes(deviceId)) {
    return { success: true, deviceLimitReached: false, deviceCount: devices.length };
  }

  // 检查是否已达上限
  if (devices.length >= MAX_DEVICES_PER_PASSWORD) {
    return { success: false, deviceLimitReached: true, deviceCount: devices.length };
  }

  // 注册新设备
  devices.push(deviceId);
  registry[password] = devices;
  await saveDeviceRegistry(registry);

  return { success: true, deviceLimitReached: false, deviceCount: devices.length };
}

/**
 * 注销设备
 */
export async function unregisterDevice(password: string, deviceId: string): Promise<boolean> {
  const registry = await getDeviceRegistry();
  const devices = registry[password];
  if (!devices) return false;

  const index = devices.indexOf(deviceId);
  if (index === -1) return false;

  devices.splice(index, 1);
  if (devices.length === 0) {
    delete registry[password];
  } else {
    registry[password] = devices;
  }
  await saveDeviceRegistry(registry);
  return true;
}

/**
 * 获取某密码已注册设备数量
 */
export async function getDeviceCount(password: string): Promise<number> {
  const registry = await getDeviceRegistry();
  const devices = registry[password];
  return devices ? devices.length : 0;
}

// ============ 观看进度管理 ============

const PROGRESS_KEY_PREFIX = 'kvideo_progress_';

interface WatchProgressItem {
  videoId: string | number;
  title: string;
  url: string;
  episodeIndex: number;
  source: string;
  playbackPosition: number;
  duration: number;
  progress: number;
  poster?: string;
  timestamp: number;
  type_name?: string;
}

async function kvGet(key: string): Promise<any | null> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try { return await kv.get(key, 'json'); } catch {}
  }
  try {
    const fs = require('fs');
    const dir = globalThis.__adminStorageDir || './data';
    const path = `${dir}/${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    ensureDir(require('path').dirname(path));
    if (!fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  } catch {
    if (isEdgeRuntimeSafe() && edgeMemory[key]) return edgeMemory[key];
    return null;
  }
}

async function kvPut(key: string, value: any): Promise<void> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try { await kv.put(key, JSON.stringify(value)); return; } catch {}
  }
  try {
    const fs = require('fs');
    const dir = globalThis.__adminStorageDir || './data';
    const path = `${dir}/${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    ensureDir(require('path').dirname(path));
    fs.writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
  } catch {
    if (isEdgeRuntimeSafe()) { edgeMemory[key] = value; }
  }
}

async function kvDelete(key: string): Promise<void> {
  const kv = getKVBinding();
  if (isRealKVBinding(kv)) {
    try { await kv.delete(key); return; } catch {}
  }
  try {
    const fs = require('fs');
    const dir = globalThis.__adminStorageDir || './data';
    const path = `${dir}/${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    if (fs.existsSync(path)) fs.unlinkSync(path);
  } catch {
    if (isEdgeRuntimeSafe()) { delete edgeMemory[key]; }
  }
}

/**
 * 获取某个账号的观看进度列表
 */
export async function getWatchProgress(profileId: string): Promise<WatchProgressItem[]> {
  const key = `${PROGRESS_KEY_PREFIX}${profileId}`;
  const data = await kvGet(key);
  return Array.isArray(data) ? data : [];
}

/**
 * 保存某个账号的观看进度列表（完整替换）
 */
export async function saveWatchProgress(profileId: string, items: WatchProgressItem[]): Promise<void> {
  const key = `${PROGRESS_KEY_PREFIX}${profileId}`;
  const sorted = items.sort((a, b) => b.timestamp - a.timestamp);
  // 最多保留100条
  const trimmed = sorted.slice(0, 100);
  await kvPut(key, trimmed);
}

/**
 * 更新单条观看进度（添加或更新）
 */
export async function updateProgressItem(profileId: string, item: WatchProgressItem): Promise<void> {
  const items = await getWatchProgress(profileId);
  const idx = items.findIndex(i => String(i.videoId) === String(item.videoId) && i.source === item.source);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...item, timestamp: Date.now() };
  } else {
    items.push({ ...item, timestamp: Date.now() });
  }
  await saveWatchProgress(profileId, items);
}

/**
 * 删除单条观看进度
 */
export async function deleteProgressItem(profileId: string, videoId: string | number, source: string): Promise<boolean> {
  const items = await getWatchProgress(profileId);
  const filtered = items.filter(i => !(String(i.videoId) === String(videoId) && i.source === source));
  if (filtered.length === items.length) return false;
  await saveWatchProgress(profileId, filtered);
  return true;
}

/**
 * 清空某个账号的全部观看进度
 */
export async function clearWatchProgress(profileId: string): Promise<void> {
  const key = `${PROGRESS_KEY_PREFIX}${profileId}`;
  await kvPut(key, []);
}

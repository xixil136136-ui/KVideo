/**
 * Auth API Route
 * Handles authentication with role-based accounts
 * Supports both env var accounts and dynamic admin-storage accounts
 * + device limit (max 5 devices per password)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';

export const runtime = 'edge';

// Lazy env var reads — process.env is unavailable in Cloudflare Pages
// Edge runtime at module scope, so we read them on demand inside handlers
function getAdminPassword(): string { return getEnvVar('ADMIN_PASSWORD'); }
function getAccessPassword(): string { return getEnvVar('ACCESS_PASSWORD'); }
function getAccountsStr(): string { return getEnvVar('ACCOUNTS'); }
function getPremiumPassword(): string { return getEnvVar('PREMIUM_PASSWORD'); }
function getPersistSession(): boolean { return getEnvVar('PERSIST_SESSION') !== 'false'; }
function getSubscriptionSources(): string { return getEnvVar('SUBSCRIPTION_SOURCES') || getEnvVar('NEXT_PUBLIC_SUBSCRIPTION_SOURCES'); }
function getIptvSources(): string { return getEnvVar('IPTV_SOURCES') || getEnvVar('NEXT_PUBLIC_IPTV_SOURCES'); }
function getMergeSources(): string { return getEnvVar('MERGE_SOURCES') || getEnvVar('NEXT_PUBLIC_MERGE_SOURCES'); }

// Backward compat: ACCESS_PASSWORD acts as ADMIN_PASSWORD if ADMIN_PASSWORD is not set
function getEffectiveAdminPassword(): string { return getAdminPassword() || getAccessPassword(); }

interface AccountEntry {
  password: string;
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
  customPermissions: string[];
}

function parseAccounts(): AccountEntry[] {
  const ACCOUNTS = getAccountsStr();
  if (!ACCOUNTS) return [];

  return ACCOUNTS.split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
    .map(entry => {
      const parts = entry.split(':');
      if (parts.length < 2) return null;
      const [password, name, role, perms] = parts;
      const parsedRole = role?.trim();
      const customPermissions = perms
        ? perms.split('|').map(p => p.trim()).filter(p => p.length > 0)
        : [];
      return {
        password: password.trim(),
        name: name.trim(),
        role: (parsedRole === 'super_admin' ? 'super_admin' : parsedRole === 'admin' ? 'admin' : 'viewer') as 'super_admin' | 'admin' | 'viewer',
        customPermissions,
      };
    })
    .filter((a): a is AccountEntry => a !== null && a.password.length > 0 && a.name.length > 0);
}

/**
 * Generate a session token from an account's info.
 * Returns a base64-encoded JSON with id, name, role, and expiry.
 * This is what verifySession() in the admin accounts API expects.
 */
async function generateSessionToken(
  id: string,
  name: string,
  role: string,
): Promise<string> {
  const sessionData = {
    id,
    name,
    role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const json = JSON.stringify(sessionData);
  // Use platform-available base64 encoding (Buffer not always available in edge)
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  // Convert Uint8Array to base64 using btoa
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Try to load dynamic admin-storage accounts.
 * Falls back gracefully if module not available (e.g., build time).
 */
async function getDynamicAccounts(): Promise<AccountEntry[]> {
  try {
    const { getAccounts, isAccountExpired } = await import('@/lib/admin-storage');
    const adminAccounts = await getAccounts();
    return adminAccounts
      .filter(a => !isAccountExpired(a))
      .map(a => ({
        password: a.password,
        name: a.name,
        role: a.role as 'super_admin' | 'admin' | 'viewer',
        customPermissions: [],
      }));
  } catch {
    return [];
  }
}

/**
 * Get the dynamic premium password from admin-storage.
 */
async function getDynamicPremiumPassword(): Promise<string | null> {
  try {
    const { getConfig } = await import('@/lib/admin-storage');
    const config = await getConfig();
    if (config?.premiumPassword) return config.premiumPassword;
  } catch {}
  return null;
}

/**
 * Check if any dynamic account matches the given password.
 */
async function checkDynamicAccounts(password: string): Promise<AccountEntry | null> {
  const accounts = await getDynamicAccounts();
  return accounts.find(a => a.password === password) || null;
}

/**
 * 检查设备数量限制，返回 null = 通过，否则返回拒绝响应
 * 会根据账号角色判断：admin/super_admin 不限制
 */
async function checkDeviceLimit(
  password: string,
  deviceId: string | undefined | null,
  accountRole?: string | null,
  accountMaxDevices?: number | null,
): Promise<NextResponse | null> {
  if (!deviceId || typeof deviceId !== 'string') {
    return null; // 无 deviceId 则跳过检查（向后兼容）
  }

  // admin/super_admin 不限制设备数量
  if (accountRole === 'super_admin' || accountRole === 'admin') {
    return null;
  }

  try {
    const { registerDevice } = await import('@/lib/admin-storage');
    const result = await registerDevice(password, deviceId);
    if (result.deviceLimitReached) {
      const limit = result.deviceLimit === Infinity ? '无限制' : `${result.deviceLimit}台`;
      return NextResponse.json({
        valid: false,
        deviceLimitReached: true,
        deviceCount: result.deviceCount,
        deviceLimit: result.deviceLimit,
        message: `该账号已绑定 ${result.deviceCount} 台设备，已达上限（最多${limit}）`,
      });
    }
  } catch {}
  return null;
}

export async function GET() {
  const effectiveAdminPassword = getEffectiveAdminPassword();
  const ACCOUNTS = getAccountsStr();
  const hasAuth = !!(effectiveAdminPassword || ACCOUNTS);

  // Also check if there are dynamic accounts
  let hasDynamicAuth = false;
  try {
    const accounts = await getDynamicAccounts();
    hasDynamicAuth = accounts.length > 0;
  } catch {}

  return NextResponse.json({
    hasAuth: hasAuth || hasDynamicAuth,
    hasPremiumAuth: !!(getPremiumPassword() || hasDynamicAuth),
    persistSession: getPersistSession(),
    subscriptionSources: getSubscriptionSources(),
    iptvSources: getIptvSources(),
    mergeSources: getMergeSources(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { password, type, deviceId } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ valid: false, message: 'Password required' }, { status: 400 });
    }

    const PREMIUM_PASSWORD=getPremiumPassword();
    const effectiveAdminPassword = getEffectiveAdminPassword();

    // Dynamic premium password (set via admin panel)
    const dynamicPremiumPwd = await getDynamicPremiumPassword();

    // Premium password check (separate from main auth)
    if (type === 'premium') {
      // Check env var premium password
      if (PREMIUM_PASSWORD && password === PREMIUM_PASSWORD) {
        return NextResponse.json({ valid: true });
      }

      // Check dynamic premium password (set via admin panel)
      if (dynamicPremiumPwd && password === dynamicPremiumPwd) {
        return NextResponse.json({ valid: true });
      }

      // Also allow admin password to unlock premium
      if (effectiveAdminPassword && password === effectiveAdminPassword) {
        return NextResponse.json({ valid: true });
      }
      // Check ACCOUNTS super_admin/admin
      const accounts = parseAccounts();
      for (const account of accounts) {
        if (password === account.password && (account.role === 'super_admin' || account.role === 'admin')) {
          return NextResponse.json({ valid: true });
        }
      }

      // Check dynamic accounts
      const dynamicAccount = await checkDynamicAccounts(password);
      if (dynamicAccount && (dynamicAccount.role === 'super_admin' || dynamicAccount.role === 'admin')) {
        return NextResponse.json({ valid: true });
      }

      // No premium password configured at all = open access
      if (!PREMIUM_PASSWORD && !dynamicPremiumPwd) {
        return NextResponse.json({ valid: true });
      }

      return NextResponse.json({ valid: false });
    }

    // ====== 主要登录流程（非 premium） ======

    // 1. Check admin password (env var)
    if (effectiveAdminPassword && password === effectiveAdminPassword) {
      // 设备数量检查（管理员不限制）
      const deviceBlocked = await checkDeviceLimit(password, deviceId, 'super_admin');
      if (deviceBlocked) return deviceBlocked;

      // Seed KV with this admin account on first login
      try {
        const { verifyAccount } = await import('@/lib/admin-storage');
        await verifyAccount(password);
      } catch {}
      const profileId = await generateSessionToken('admin-default', '管理员', 'super_admin');
      return NextResponse.json({
        valid: true,
        name: '管理员',
        role: 'super_admin',
        profileId,
        persistSession: getPersistSession(),
      });
    }

    // 2. Check ACCOUNTS env var entries
    const accounts = parseAccounts();
    for (const account of accounts) {
      if (password === account.password) {
        // 设备数量检查（传角色信息）
        const deviceBlocked = await checkDeviceLimit(password, deviceId, account.role);
        if (deviceBlocked) return deviceBlocked;

        const profileId = await generateSessionToken(account.password, account.name, account.role);
        return NextResponse.json({
          valid: true,
          name: account.name,
          role: account.role,
          profileId,
          persistSession: getPersistSession(),
          customPermissions: account.customPermissions.length > 0 ? account.customPermissions : undefined,
        });
      }
    }

    // 3. Check dynamic admin-storage accounts
    try {
      const { verifyAccount } = await import('@/lib/admin-storage');
      const found = await verifyAccount(password);
      if (found) {
        // 设备数量检查（传角色信息）
        const deviceBlocked = await checkDeviceLimit(password, deviceId, found.role);
        if (deviceBlocked) return deviceBlocked;

        const profileId = await generateSessionToken(found.id || found.password, found.name, found.role);
        return NextResponse.json({
          valid: true,
          name: found.name,
          role: found.role,
          profileId,
          persistSession: getPersistSession(),
        });
      }
    } catch {}

    // 4. No match
    return NextResponse.json({ valid: false });
  } catch {
    return NextResponse.json({ valid: false, message: 'Invalid request' }, { status: 400 });
  }
}

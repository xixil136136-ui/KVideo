/**
 * Auth API Route
 * Handles authentication with role-based accounts
 * Supports both env var accounts and dynamic admin-storage accounts
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';
const ACCOUNTS = process.env.ACCOUNTS || '';
const PREMIUM_PASSWORD = process.env.PREMIUM_PASSWORD || 'l789789';
const PERSIST_SESSION = process.env.PERSIST_SESSION !== 'false'; // default true
const SUBSCRIPTION_SOURCES = process.env.SUBSCRIPTION_SOURCES || process.env.NEXT_PUBLIC_SUBSCRIPTION_SOURCES || '';
const IPTV_SOURCES = process.env.IPTV_SOURCES || process.env.NEXT_PUBLIC_IPTV_SOURCES || '';
const MERGE_SOURCES = process.env.MERGE_SOURCES || process.env.NEXT_PUBLIC_MERGE_SOURCES || '';

// Backward compat: ACCESS_PASSWORD acts as ADMIN_PASSWORD if ADMIN_PASSWORD is not set
const effectiveAdminPassword = ADMIN_PASSWORD || ACCESS_PASSWORD;

interface AccountEntry {
  password: string;
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
  customPermissions: string[];
}

function parseAccounts(): AccountEntry[] {
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
 * Generate a deterministic profileId from password using SHA-256.
 * Uses a salt to avoid rainbow table attacks.
 */
async function generateProfileId(password: string): Promise<string> {
  const salt = 'kvideo-profile-salt-v1';
  const data = new TextEncoder().encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  // Use first 8 bytes (16 hex chars) for a compact but unique ID
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Try to load dynamic admin-storage accounts.
 * Falls back gracefully if module not available (e.g., build time).
 */
async function getDynamicAccounts(): Promise<AccountEntry[]> {
  try {
    const { getAccounts } = await import('@/lib/admin-storage');
    const adminAccounts = await getAccounts();
    return adminAccounts.map(a => ({
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

export async function GET() {
  const hasAuth = !!(effectiveAdminPassword || ACCOUNTS);

  // Also check if there are dynamic accounts
  let hasDynamicAuth = false;
  try {
    const accounts = await getDynamicAccounts();
    hasDynamicAuth = accounts.length > 0;
  } catch {}

  return NextResponse.json({
    hasAuth: hasAuth || hasDynamicAuth,
    hasPremiumAuth: !!(PREMIUM_PASSWORD || hasDynamicAuth),
    persistSession: PERSIST_SESSION,
    subscriptionSources: SUBSCRIPTION_SOURCES,
    iptvSources: IPTV_SOURCES,
    mergeSources: MERGE_SOURCES,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { password, type } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ valid: false, message: 'Password required' }, { status: 400 });
    }

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

    // 1. Check admin password (env var)
    if (effectiveAdminPassword && password === effectiveAdminPassword) {
      const profileId = await generateProfileId(password);
      return NextResponse.json({
        valid: true,
        name: '管理员',
        role: 'super_admin',
        profileId,
        persistSession: PERSIST_SESSION,
      });
    }

    // 2. Check ACCOUNTS env var entries
    const accounts = parseAccounts();
    for (const account of accounts) {
      if (password === account.password) {
        const profileId = await generateProfileId(password);
        return NextResponse.json({
          valid: true,
          name: account.name,
          role: account.role,
          profileId,
          persistSession: PERSIST_SESSION,
          customPermissions: account.customPermissions.length > 0 ? account.customPermissions : undefined,
        });
      }
    }

    // 3. Check dynamic admin-storage accounts
    const dynamicAccount = await checkDynamicAccounts(password);
    if (dynamicAccount) {
      const profileId = await generateProfileId(password);
      return NextResponse.json({
        valid: true,
        name: dynamicAccount.name,
        role: dynamicAccount.role,
        profileId,
        persistSession: PERSIST_SESSION,
      });
    }

    // 4. No match
    return NextResponse.json({ valid: false });
  } catch {
    return NextResponse.json({ valid: false, message: 'Invalid request' }, { status: 400 });
  }
}

/**
 * Accounts API Route
 * Returns account list (names + roles, no passwords) for admin visibility
 */

import { NextResponse } from 'next/server';
import { getEnvVar, hasEnvVar } from '@/lib/env';

export const runtime = 'edge';

function getAdminPassword(): string { return getEnvVar('ADMIN_PASSWORD'); }
function getAccessPassword(): string { return getEnvVar('ACCESS_PASSWORD'); }
function getAccountsStr(): string { return getEnvVar('ACCOUNTS'); }

const effectiveAdminPassword = getAdminPassword() || getAccessPassword();

interface AccountInfo {
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
  customPermissions?: string[];
}

function getAccountList(): AccountInfo[] {
  const accounts: AccountInfo[] = [];
  const ACCOUNTS = getAccountsStr();

  // Add admin from ADMIN_PASSWORD
  if (effectiveAdminPassword) {
    accounts.push({ name: '超级管理员', role: 'super_admin' });
  }

  // Add accounts from ACCOUNTS env var
  if (ACCOUNTS) {
    ACCOUNTS.split(',')
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
      .forEach(entry => {
        const parts = entry.split(':');
        if (parts.length >= 2) {
          const name = parts[1].trim();
          const parsedRole = parts[2]?.trim();
          const role = parsedRole === 'super_admin' ? 'super_admin' : parsedRole === 'admin' ? 'admin' : 'viewer';
          const perms = parts[3]?.trim();
          const customPermissions = perms
            ? perms.split('|').map(p => p.trim()).filter(p => p.length > 0)
            : undefined;
          if (name) {
            accounts.push({ name, role, ...(customPermissions && customPermissions.length > 0 ? { customPermissions } : {}) });
          }
        }
      });
  }

  return accounts;
}

export async function GET() {
  const accounts = getAccountList();
  const ACCOUNTS = getAccountsStr();

  return NextResponse.json({
    accounts,
    hasAdminPassword: !!effectiveAdminPassword,
    hasAccounts: !!ACCOUNTS,
    totalCount: accounts.length,
  });
}

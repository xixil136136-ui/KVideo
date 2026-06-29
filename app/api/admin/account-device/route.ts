/**
 * Admin Account Device Info API
 * Returns device count and limit information per account
 * Requires valid sessionToken in Authorization header (super_admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAccounts, getAccountDeviceInfo, getAccountMaxDevices } from '@/lib/admin-storage';
import type { AdminAccount } from '@/lib/types/admin';

export const runtime = 'edge';

function verifySession(request: NextRequest): { id: string; name: string; role: string } | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) return null;
    return { id: decoded.id, name: decoded.name, role: decoded.role };
  } catch {
    return null;
  }
}

// GET /api/admin/account-device - Get device info for all accounts or a specific account
export async function GET(request: NextRequest) {
  const session = verifySession(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ valid: false, message: '无权访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  try {
    const accounts = await getAccounts();

    if (accountId) {
      const account = accounts.find(a => a.id === accountId);
      if (!account) {
        return NextResponse.json({ valid: false, message: '账号不存在' }, { status: 404 });
      }
      const devInfo = await getAccountDeviceInfo(account.password, account);
      return NextResponse.json({
        valid: true,
        deviceInfo: {
          accountId: account.id,
          name: account.name,
          role: account.role,
          maxDevices: account.maxDevices ?? null,
          deviceLimit: devInfo.deviceLimit,
          deviceCount: devInfo.deviceCount,
          devices: devInfo.devices,
          isUnlimited: devInfo.deviceLimit === Infinity,
        },
      });
    }

    // Return device info for all accounts
    const deviceInfos = await Promise.all(
      accounts.map(async (account) => {
        const devInfo = await getAccountDeviceInfo(account.password, account);
        return {
          accountId: account.id,
          name: account.name,
          role: account.role,
          maxDevices: account.maxDevices ?? null,
          deviceLimit: devInfo.deviceLimit,
          deviceCount: devInfo.deviceCount,
          isUnlimited: devInfo.deviceLimit === Infinity,
          deviceIds: devInfo.devices,
        };
      })
    );

    return NextResponse.json({ valid: true, deviceInfos });
  } catch (error: any) {
    return NextResponse.json({ valid: false, message: '获取失败', error: error?.message || String(error) }, { status: 500 });
  }
}

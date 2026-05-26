/**
 * Admin Accounts CRUD API
 * Requires valid sessionToken in Authorization header
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAccounts, addAccount, updateAccount, deleteAccount, updatePremiumPassword } from '@/lib/admin-storage';
import type { AdminAccount } from '@/lib/types/admin';

export const runtime = 'edge';

function verifySession(request: NextRequest): { id: string; name: string; role: string } | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;

  try {
    // btoa/atob for Edge Runtime compatibility (no Buffer in Cloudflare Pages)
    const token = auth.replace('Bearer ', '');
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) return null;
    return { id: decoded.id, name: decoded.name, role: decoded.role };
  } catch {
    return null;
  }
}

// GET /api/admin/accounts - List all accounts
export async function GET(request: NextRequest) {
  const session = verifySession(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ valid: false, message: '无权访问' }, { status: 403 });
  }

  const accounts = await getAccounts();
  // Never expose passwords in API response
  const safeAccounts = accounts.map(({ password, ...rest }) => rest);
  return NextResponse.json({ valid: true, accounts: safeAccounts });
}

// POST /api/admin/accounts - Create new account
export async function POST(request: NextRequest) {
  const session = verifySession(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ valid: false, message: '无权访问' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Validate
    if (!body.password || !body.name) {
      return NextResponse.json({ valid: false, message: '账号和密码不能为空' }, { status: 400 });
    }

    // Validate role
    const validRoles = ['super_admin', 'admin', 'viewer'];
    if (body.role && !validRoles.includes(body.role)) {
      return NextResponse.json({ valid: false, message: '无效的角色类型' }, { status: 400 });
    }

    const account: AdminAccount = {
      id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: body.password,
      name: body.name,
      role: body.role || 'viewer',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 支持设置过期时间（30天=月卡, 90天=季卡, 365天=年卡）
    if (body.duration && typeof body.duration === 'number' && body.duration > 0) {
      account.expiresAt = Date.now() + body.duration * 24 * 60 * 60 * 1000;
    }

    await addAccount(account);

    // If this is a premium password update too
    if (body.setAsPremium) {
      await updatePremiumPassword(body.password);
    }

    const { password, ...safeAccount } = account;
    return NextResponse.json({ valid: true, account: safeAccount });
  } catch (error: any) {
    // Try to get the KV binding directly to diagnose
    let kvDiag = {};
    try {
      let kv: any = null;
      if (typeof (globalThis as any).KV_ACCOUNTS !== 'undefined') kv = (globalThis as any).KV_ACCOUNTS;
      else if (typeof process !== 'undefined' && (process as any).env?.KV_ACCOUNTS) kv = (process as any).env?.KV_ACCOUNTS;
      if (kv) {
        kvDiag = {
          hasGet: typeof kv.get === 'function',
          hasPut: typeof kv.put === 'function',
          ctor: kv.constructor?.name,
        };
        // Try a direct put
        await kv.put('kvideo_diag_from_accounts', JSON.stringify({ts:Date.now()}), {});
        kvDiag = { ...kvDiag, directPutOk: true };
        const back = await kv.get('kvideo_diag_from_accounts', 'json');
        kvDiag = { ...kvDiag, readBack: !!back };
        await kv.delete('kvideo_diag_from_accounts');
      } else {
        kvDiag = { noKv: true };
      }
    } catch (kvErr: any) {
      kvDiag = { ...kvDiag, kvError: kvErr?.message || String(kvErr) };
    }
    return NextResponse.json({ valid: false, message: '创建失败', error: error?.message || String(error), kvDiag }, { status: 500 });
  }
}

// PUT /api/admin/accounts - Update account
export async function PUT(request: NextRequest) {
  const session = verifySession(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ valid: false, message: '无权访问' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ valid: false, message: '缺少账号ID' }, { status: 400 });
    }

    const updates: Partial<AdminAccount> = {};
    if (body.password) updates.password = body.password;
    if (body.name) updates.name = body.name;
    if (body.role) updates.role = body.role;
    // 编辑时也可以设置/续期过期时间
    if (body.duration && typeof body.duration === 'number' && body.duration > 0) {
      updates.expiresAt = Date.now() + body.duration * 24 * 60 * 60 * 1000;
    }

    const success = await updateAccount(body.id, updates);
    if (!success) {
      return NextResponse.json({ valid: false, message: '账号不存在' }, { status: 404 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    return NextResponse.json({ valid: false, message: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/admin/accounts - Delete account
export async function DELETE(request: NextRequest) {
  const session = verifySession(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ valid: false, message: '无权访问' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ valid: false, message: '缺少账号ID' }, { status: 400 });
    }

    const success = await deleteAccount(body.id);
    if (!success) {
      return NextResponse.json({ valid: false, message: '账号不存在' }, { status: 404 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    return NextResponse.json({ valid: false, message: '删除失败' }, { status: 500 });
  }
}

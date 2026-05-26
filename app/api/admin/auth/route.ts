/**
 * Admin Auth API
 * Validates admin credentials and returns session token
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccount } from '@/lib/admin-storage';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ valid: false, message: '请输入密码' }, { status: 400 });
    }

    const account = await verifyAccount(password);
    if (!account) {
      return NextResponse.json({ valid: false, message: '密码错误' }, { status: 401 });
    }

    // Generate simple session token (in production, use JWT)
    const sessionToken = Buffer.from(
      JSON.stringify({
        id: account.id,
        name: account.name,
        role: account.role,
        exp: Date.now() + 24 * 60 * 60 * 1000, // 24h expiry
      })
    ).toString('base64');

    return NextResponse.json({
      valid: true,
      session: {
        id: account.id,
        name: account.name,
        role: account.role,
      },
      sessionToken,
    });
  } catch (error) {
    return NextResponse.json(
      { valid: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}

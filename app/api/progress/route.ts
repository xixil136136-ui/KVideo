/**
 * Watch Progress API Route
 * 观看进度管理 - 按账号保存观看进度，跨设备同步
 * 
 * GET  /api/progress - 获取当前账号的观看进度列表
 * PUT  /api/progress - 保存/更新单条观看进度
 * DELETE /api/progress - 删除单条或清空观看进度
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * 解析 session token，返回 profileId（即 decode 后的 id）
 */
function verifySession(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) return null;
    // profileId = decoded.id（密码的哈希/唯一标识）
    return decoded.id || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/progress - 获取当前账号的观看进度
 */
export async function GET(request: NextRequest) {
  const profileId = verifySession(request);
  if (!profileId) {
    return NextResponse.json({ valid: false, message: '请先登录' }, { status: 401 });
  }

  try {
    const { getWatchProgress } = await import('@/lib/admin-storage');
    const items = await getWatchProgress(profileId);
    return NextResponse.json({ valid: true, items });
  } catch (error: any) {
    return NextResponse.json({ valid: false, message: '获取失败', error: error?.message }, { status: 500 });
  }
}

/**
 * PUT /api/progress - 保存/更新单条观看进度
 * Body: { videoId, title, url, episodeIndex, source, playbackPosition, duration, poster?, type_name? }
 */
export async function PUT(request: NextRequest) {
  const profileId = verifySession(request);
  if (!profileId) {
    return NextResponse.json({ valid: false, message: '请先登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { videoId, title, url, episodeIndex, source, playbackPosition, duration, poster, type_name } = body;

    if (!videoId || !source) {
      return NextResponse.json({ valid: false, message: '缺少视频ID或来源' }, { status: 400 });
    }

    const progress = duration > 0 ? Math.round((playbackPosition / duration) * 100) : 0;

    const { updateProgressItem } = await import('@/lib/admin-storage');
    await updateProgressItem(profileId, {
      videoId,
      title: title || '未知视频',
      url: url || '',
      episodeIndex: episodeIndex || 0,
      source,
      playbackPosition: playbackPosition || 0,
      duration: duration || 0,
      progress,
      poster: poster || undefined,
      timestamp: Date.now(),
      type_name: type_name || undefined,
    });

    return NextResponse.json({ valid: true, progress });
  } catch (error: any) {
    return NextResponse.json({ valid: false, message: '保存失败', error: error?.message }, { status: 500 });
  }
}

/**
 * DELETE /api/progress - 删除观看进度
 * Body: { videoId, source } 删除单条，或 { clearAll: true } 清空全部
 */
export async function DELETE(request: NextRequest) {
  const profileId = verifySession(request);
  if (!profileId) {
    return NextResponse.json({ valid: false, message: '请先登录' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.clearAll) {
      const { clearWatchProgress } = await import('@/lib/admin-storage');
      await clearWatchProgress(profileId);
      return NextResponse.json({ valid: true, message: '已清空观看进度' });
    }

    if (!body.videoId || !body.source) {
      return NextResponse.json({ valid: false, message: '缺少视频ID或来源' }, { status: 400 });
    }

    const { deleteProgressItem } = await import('@/lib/admin-storage');
    const success = await deleteProgressItem(profileId, body.videoId, body.source);
    if (!success) {
      return NextResponse.json({ valid: false, message: '进度不存在' }, { status: 404 });
    }

    return NextResponse.json({ valid: true, message: '已删除' });
  } catch (error: any) {
    return NextResponse.json({ valid: false, message: '删除失败', error: error?.message }, { status: 500 });
  }
}

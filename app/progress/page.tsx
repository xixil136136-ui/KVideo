'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/Icon';
import { getSession, type AuthSession } from '@/lib/store/auth-store';

interface ProgressItem {
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

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return `${Math.floor(days / 30)}个月前`;
}

export default function ProgressPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    setSession(s);
    if (!s) {
      setLoading(false);
      setError('请先登录后再查看观看进度');
      return;
    }
    fetchProgress(s);
  }, []);

  const fetchProgress = async (s: AuthSession) => {
    setLoading(true);
    try {
      const res = await fetch('/api/progress', {
        headers: { Authorization: `Bearer ${s.profileId}` },
      });
      const data = await res.json();
      if (data.valid && Array.isArray(data.items)) {
        setItems(data.items);
      } else {
        setError(data.message || '获取进度失败');
      }
    } catch (err) {
      setError('网络错误，无法获取进度');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = useCallback(async (videoId: string | number, source: string) => {
    if (!session) return;
    try {
      const res = await fetch('/api/progress', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.profileId}`,
        },
        body: JSON.stringify({ videoId, source }),
      });
      const data = await res.json();
      if (data.valid) {
        setItems(prev => prev.filter(i => !(String(i.videoId) === String(videoId) && i.source === source)));
      }
    } catch {}
  }, [session]);

  const handleClearAll = useCallback(async () => {
    if (!session || !confirm('确定要清空所有观看进度吗？')) return;
    try {
      const res = await fetch('/api/progress', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.profileId}`,
        },
        body: JSON.stringify({ clearAll: true }),
      });
      const data = await res.json();
      if (data.valid) setItems([]);
    } catch {}
  }, [session]);

  function buildPlayerUrl(item: ProgressItem): string {
    const params = new URLSearchParams({
      id: String(item.videoId),
      source: item.source,
      title: item.title,
      episode: String(item.episodeIndex),
    });
    return `/player?${params.toString()}`;
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <Icons.Clock size={32} className="animate-spin text-[var(--accent-color)]" />
          <span className="ml-3 text-lg text-[var(--text-color-secondary)]">加载中...</span>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center py-20">
          <Icons.History size={64} className="mx-auto mb-4 text-[var(--text-color-secondary)] opacity-40" />
          <h2 className="text-2xl font-bold text-[var(--text-color)] mb-2">请先登录</h2>
          <p className="text-[var(--text-color-secondary)] mb-6">登录后才能查看跨设备同步的观看进度</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent-color)] text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            <Icons.ChevronLeft size={18} />
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200"
            data-focusable
          >
            <Icons.ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-color)] flex items-center gap-2">
              <Icons.History size={24} className="text-[var(--accent-color)]" />
              观看进度
            </h1>
            <p className="text-sm text-[var(--text-color-secondary)]">
              {items.length > 0
                ? `共 ${items.length} 个视频 · 跨设备同步`
                : '跨设备同步，随时继续观看'}
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--text-color-secondary)] hover:text-red-500 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl hover:border-red-500/30 transition-all duration-200 cursor-pointer"
            data-focusable
          >
            <Icons.Trash size={14} />
            清空
          </button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm">
          {error}
          <button
            onClick={() => session && fetchProgress(session)}
            className="ml-4 underline hover:no-underline cursor-pointer"
          >
            重试
          </button>
        </div>
      )}

      {/* 进度列表 */}
      {items.length === 0 && !error ? (
        <div className="text-center py-20">
          <Icons.History size={64} className="mx-auto mb-4 text-[var(--text-color-secondary)] opacity-40" />
          <h2 className="text-xl font-bold text-[var(--text-color)] mb-2">暂无观看记录</h2>
          <p className="text-[var(--text-color-secondary)] mb-6">开始观看视频后，进度会自动保存到这里</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent-color)] text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            去首页找视频看
            <Icons.ChevronRight size={18} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={`${item.videoId}-${item.source}`}
              className="group relative bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200"
            >
              {/* 封面区域 */}
              <Link
                href={buildPlayerUrl(item)}
                className="block relative aspect-video bg-gray-800/50 overflow-hidden"
                data-focusable
              >
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icons.Film size={48} className="text-[var(--text-color-secondary)] opacity-40" />
                  </div>
                )}
                {/* 遮罩 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {/* 进度百分比 */}
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-bold text-white">
                  {item.progress}%
                </div>
                {/* 分类标签 */}
                {item.type_name && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-[var(--accent-color)]/80 backdrop-blur-sm rounded-md text-[10px] font-medium text-white">
                    {item.type_name}
                  </div>
                )}
              </Link>

              {/* 信息区域 */}
              <div className="p-4">
                <Link
                  href={buildPlayerUrl(item)}
                  className="block"
                  data-focusable
                >
                  <h3 className="font-semibold text-sm text-[var(--text-color)] line-clamp-2 mb-2 min-h-[2.5rem] hover:text-[var(--accent-color)] transition-colors">
                    {item.title}
                  </h3>
                </Link>

                {/* 进度条 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-[var(--text-color-secondary)] mb-1.5">
                    <span className="flex items-center gap-1">
                      <Icons.Clock size={12} />
                      {formatDuration(item.playbackPosition)} / {formatDuration(item.duration)}
                    </span>
                    <span>{formatTimeAgo(item.timestamp)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--accent-color)] to-[color-mix(in_srgb,var(--accent-color)_70%,#fff)] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(item.progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  <Link
                    href={buildPlayerUrl(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[var(--accent-color)] rounded-xl hover:opacity-90 transition-opacity"
                    data-focusable
                  >
                    <Icons.Play size={14} />
                    继续观看
                  </Link>
                  <button
                    onClick={() => handleDelete(item.videoId, item.source)}
                    className="flex items-center justify-center w-10 h-9 text-[var(--text-color-secondary)] hover:text-red-500 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl hover:border-red-500/30 transition-all duration-200 cursor-pointer"
                    aria-label="删除"
                    data-focusable
                  >
                    <Icons.X size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

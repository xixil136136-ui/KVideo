/**
 * 观看进度同步工具
 * 从播放页面定期将播放位置保存到服务器
 */

import { getSession } from '@/lib/store/auth-store';

interface ProgressData {
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

const MIN_PROGRESS_INTERVAL = 15000; // 15秒
const SAVE_THRESHOLD = 5; // 进度变化超过5%才保存
const MIN_DURATION = 60; // 至少看60秒才保存（1分钟）

/**
 * 保存观看进度到服务器
 */
export async function saveWatchProgress(data: ProgressData): Promise<boolean> {
  const session = getSession();
  if (!session) return false;

  try {
    const res = await fetch('/api/progress', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.profileId}`,
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    return result.valid === true;
  } catch {
    return false;
  }
}

/**
 * 创建进度自动保存管理器
 * 在组件挂载时启动，卸载时停止
 */
export function createProgressAutoSave(
  getData: () => ProgressData | null,
  intervalMs: number = MIN_PROGRESS_INTERVAL,
): { start: () => void; stop: () => void; saveNow: () => Promise<boolean> } {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastSavedProgress = -1;

  const saveNow = async (): Promise<boolean> => {
    const data = getData();
    if (!data) return false;

    // 如果播放时长太短，不保存
    if (data.duration > 0 && data.playbackPosition < Math.min(MIN_DURATION, data.duration * 0.3)) {
      return false;
    }

    // 如果进度变化太小，不保存（避免频繁写入）
    if (lastSavedProgress >= 0 && Math.abs(data.progress - lastSavedProgress) < SAVE_THRESHOLD) {
      return false;
    }

    const success = await saveWatchProgress(data);
    if (success) {
      lastSavedProgress = data.progress;
    }
    return success;
  };

  const start = () => {
    stop();
    timer = setInterval(saveNow, intervalMs);
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return { start, stop, saveNow };
}

'use client';

import { useEffect } from 'react';

/**
 * React hydration 完成后立即隐藏"加载中"遮罩层。
 * 作为内联脚本的双重保障，确保即使内联脚本漏检也能被清理。
 */
export function HideLoadingScreen() {
    useEffect(() => {
        const el = document.getElementById('kv-loading');
        if (el) {
            el.classList.add('hidden');
        }
    }, []);

    return null;
}

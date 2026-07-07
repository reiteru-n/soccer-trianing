// YouTube IFrame Player API 型宣言 + 共通ヘルパー
// videos ページ本体と /videos/favorites（お気に入りシーン連続再生）で共有する

import { useEffect, useState } from 'react';

export interface YTPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  unloadModule: (moduleName: string) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onApiChange?: (event: { target: YTPlayer }) => void;
          };
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * cc_load_policy: 0 だけでは強制字幕・視聴者アカウント側の字幕設定が優先されて
 * 表示されてしまうことがあるため、onApiChangeで字幕モジュール自体をアンロードして完全に消す
 */
export function disableCaptionsHard(player: YTPlayer): void {
  try {
    player.unloadModule('captions');
    player.unloadModule('cc');
  } catch { /* モジュール未ロード時などは無視 */ }
}

/** YouTube IFrame API を（未読込なら）読み込み、準備できたら onReady を呼ぶ */
export function loadYouTubeIframeApi(onReady: () => void): void {
  if (window.YT && window.YT.Player) {
    onReady();
    return;
  }
  const prevCallback = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prevCallback?.();
    onReady();
  };
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
}

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * YouTube URLから動画IDを取り出す。
 * URL()で正規に解析することで、共有リンクにありがちな
 * "?list=...&v=xxxx"（vが先頭パラメータでない）や
 * m.youtube.com / youtube-nocookie.com / /live/ 等の形式も拾う。
 */
export function extractYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return YT_ID_RE.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const vParam = u.searchParams.get('v');
      if (vParam && YT_ID_RE.test(vParam)) return vParam;
      const pathMatch = u.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      if (pathMatch) return pathMatch[1];
    }
  } catch {
    // 不正/相対URL文字列は下の正規表現フォールバックで救済
  }
  const pathOrShort = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed|shorts|live)\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (pathOrShort) return pathOrShort[1];
  const vMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return vMatch ? vMatch[1] : null;
}

export function getYoutubeThumbnail(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/** スマホ判定時のみ、縦画面でも強制的に横画面レイアウトへ回転させる（動画フルスクリーン表示用） */
export function useForceLandscape(): boolean {
  const [shouldRotate, setShouldRotate] = useState(false);

  useEffect(() => {
    const mobileMq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const portraitMq = window.matchMedia('(orientation: portrait)');

    const update = () => setShouldRotate(mobileMq.matches && portraitMq.matches);
    update();

    mobileMq.addEventListener('change', update);
    portraitMq.addEventListener('change', update);
    return () => {
      mobileMq.removeEventListener('change', update);
      portraitMq.removeEventListener('change', update);
    };
  }, []);

  return shouldRotate;
}

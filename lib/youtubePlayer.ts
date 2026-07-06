// YouTube IFrame Player API 型宣言 + 共通ヘルパー
// videos ページ本体と /videos/favorites（お気に入りシーン連続再生）で共有する

export interface YTPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
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
          };
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
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

export function extractYoutubeVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

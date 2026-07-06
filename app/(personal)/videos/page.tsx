'use client';

// YouTube IFrame Player API 型宣言
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
}

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import { VideoCategory, VideoItem, VideoViewStat, VideoTimestamp } from '@/lib/types';

// タイムスタンプのラベル選択肢（プリセット）
const PRESET_TIMESTAMP_LABELS = ['ゴール', 'ボールタッチ', 'シュート', 'ディフェンス', 'ポジショニング'];

// --- helpers ---
function getYoutubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function useThumbnail(url: string): string | null | 'loading' {
  const ytThumb = getYoutubeThumbnail(url);
  const [thumb, setThumb] = useState<string | null | 'loading'>(ytThumb ?? 'loading');
  useEffect(() => {
    if (ytThumb) { setThumb(ytThumb); return; }
    let cancelled = false;
    fetch(`/api/og-thumbnail?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then((d: { url: string | null }) => { if (!cancelled) setThumb(d.url); })
      .catch(() => { if (!cancelled) setThumb(null); });
    return () => { cancelled = true; };
  }, [url, ytThumb]);
  return thumb;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

// --- SCH match videos fetch (YouTubeのSCHチームプレイリストに限定) ---
interface SchMatchVideo {
  url: string;
  description: string;
  date: string;
}

interface YtPlaylistVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
}

function useSchMatchVideos(enabled: boolean): SchMatchVideo[] {
  const [videos, setVideos] = useState<SchMatchVideo[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/sch/yt-playlist?limit=50').then(r => r.ok ? r.json() : null).then((d: YtPlaylistVideo[] | null) => {
      if (cancelled || !d) return;
      const collected: SchMatchVideo[] = d.map(v => ({
        url: v.url,
        description: v.title,
        date: v.publishedAt,
      }));
      setVideos(collected);
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [enabled]);
  return videos;
}

// --- 1行ぶんのサムネ ---
function VideoThumb({ url }: { url: string }) {
  const thumb = useThumbnail(url);
  if (thumb === 'loading') {
    return <div className="w-full h-full flex items-center justify-center bg-slate-700 text-slate-400 animate-pulse text-xl">🎬</div>;
  }
  if (thumb) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumb} alt="" className="w-full h-full object-cover" />;
  }
  return <div className="w-full h-full flex items-center justify-center bg-slate-700 text-slate-400 text-xl">🎬</div>;
}

// --- 視聴UI 行 ---
// href が指定されている場合はYouTube外部リンク（試合以外カテゴリ）
// href がない場合はアプリ内プレイヤーを開くボタン（試合カテゴリ）
function VideoRow({
  url, description, stat, pinned, onView, href, editMode, onEdit, onDelete, onTogglePin,
  readOnly,
}: {
  url: string;
  description: string;
  stat?: VideoViewStat;
  pinned?: boolean;
  onView: () => void;
  href?: string;
  editMode: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className={"relative rounded-2xl shadow-md overflow-hidden flex " +
      (pinned
        ? "bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border-2 border-amber-300 shadow-amber-200/60"
        : "bg-gradient-to-br from-white via-sky-50 to-blue-100 border border-white/40 shadow-blue-900/20")
    }>
      {pinned && (
        <span className="absolute top-1.5 right-1.5 z-10 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow shadow-amber-300/70 flex items-center gap-0.5">📌 PIN</span>
      )}
      {/* 左：サムネ 1/4 */}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onView}
          className="w-1/4 aspect-video flex-shrink-0 bg-slate-700 relative group"
          aria-label="動画を再生"
        >
          <VideoThumb url={url} />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
            <span className="text-white text-2xl">▶</span>
          </div>
        </a>
      ) : (
        <button
          onClick={onView}
          className="w-1/4 aspect-video flex-shrink-0 bg-slate-700 relative group text-left"
          aria-label="動画を再生"
        >
          <VideoThumb url={url} />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
            <span className="text-white text-2xl">▶</span>
          </div>
        </button>
      )}
      {/* 右：説明 + メタ */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onView}
              className="flex-1 min-w-0 px-3 py-2 text-left"
            >
              <p className="text-sm font-semibold text-gray-800 line-clamp-2 break-words">{description}</p>
            </a>
          ) : (
            <button onClick={onView} className="flex-1 min-w-0 px-3 py-2 text-left">
              <p className="text-sm font-semibold text-gray-800 line-clamp-2 break-words">{description}</p>
            </button>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); speak(description); }}
            className="flex-shrink-0 text-lg p-2 rounded-lg hover:bg-blue-100 active:bg-blue-200 mt-0.5 mr-1"
            aria-label="読み上げ"
          >🔊</button>
        </div>
        <div className="px-3 pb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-500">
            {stat?.lastViewedDate ? `最終視聴: ${stat.lastViewedDate}` : '未視聴'}
          </span>
          {stat?.viewCount ? (
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-sm shadow-orange-300/60">
              {stat.viewCount}<span className="text-[9px] font-bold opacity-90">回</span>
            </span>
          ) : (
            <span className="text-[10px] text-blue-400 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">NEW</span>
          )}
        </div>
        {editMode && !readOnly && (
          <div className="px-2 pb-2 flex items-center gap-1 border-t border-blue-100/60 pt-1.5">
            <button
              onClick={onTogglePin}
              className={
                "text-xs font-bold px-2 py-1 rounded-lg border " +
                (pinned
                  ? "bg-amber-500 text-white border-amber-400"
                  : "bg-white/70 text-amber-600 border-amber-200 hover:bg-amber-50")
              }
            >
              📌 {pinned ? 'ピン解除' : 'ピン留め'}
            </button>
            <div className="flex-1" />
            <button onClick={onEdit} className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1">✏️</button>
            <button onClick={onDelete} className="text-gray-300 hover:text-red-500 text-lg px-1.5">×</button>
          </div>
        )}
        {editMode && readOnly && (
          <div className="px-3 pb-2 text-[10px] text-blue-500 border-t border-blue-100/60 pt-1.5">📺 SCHチームページの動画（編集はチームページから）</div>
        )}
      </div>
    </div>
  );
}

// --- カテゴリブロック ---
function CategoryBlock({
  category, items, stats, onView, editMode, onAdd, onEdit, onDelete, onTogglePin,
  onRenameCategory, onDeleteCategory, onMoveCategoryUp, onMoveCategoryDown, canMoveCatUp, canMoveCatDown,
  matchVideos,
}: {
  category: VideoCategory;
  items: VideoItem[];
  stats: VideoViewStat[];
  // isMatchCategory=true の場合は isMatch=true で呼び出す（アプリ内プレイヤーを開く）
  onView: (url: string, description: string, isMatch: boolean) => void;
  editMode: boolean;
  onAdd: (categoryId: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRenameCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onMoveCategoryUp: () => void;
  onMoveCategoryDown: () => void;
  canMoveCatUp: boolean;
  canMoveCatDown: boolean;
  matchVideos: SchMatchVideo[];
}) {
  const [open, setOpen] = useState(true);
  const sortedItems = useMemo(() => {
    const sortKey = (v: VideoItem) => v.createdAt ?? `0000-${String(v.order).padStart(10, '0')}`;
    return [...items].sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return sortKey(b).localeCompare(sortKey(a));
    });
  }, [items]);
  const statByUrl = useMemo(() => {
    const m = new Map<string, VideoViewStat>();
    for (const s of stats) m.set(s.url, s);
    return m;
  }, [stats]);

  const isMatch = !!category.isMatchCategory;
  const totalCount = sortedItems.length + (isMatch ? matchVideos.length : 0);

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        {editMode && (
          <div className="flex flex-col gap-0.5">
            <button onClick={onMoveCategoryUp} disabled={!canMoveCatUp} className="w-6 h-6 flex items-center justify-center rounded text-blue-200 hover:text-white hover:bg-white/10 disabled:opacity-20 text-xs">▲</button>
            <button onClick={onMoveCategoryDown} disabled={!canMoveCatDown} className="w-6 h-6 flex items-center justify-center rounded text-blue-200 hover:text-white hover:bg-white/10 disabled:opacity-20 text-xs">▼</button>
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-blue-200 text-xs">{open ? '▼' : '▶'}</span>
          <h2 className="text-base font-bold text-white">{category.name}</h2>
          <span className="text-xs text-blue-300/70">({totalCount})</span>
        </button>
        {editMode && (
          <>
            <button onClick={() => onRenameCategory(category.id)} className="text-xs text-blue-200 hover:text-white px-2">✏️</button>
            {!isMatch && (
              <button onClick={() => onDeleteCategory(category.id)} className="text-sm text-blue-200 hover:text-red-300 px-1.5">×</button>
            )}
          </>
        )}
      </div>

      {open && (
        <div className="space-y-2 landscape:md:grid landscape:md:grid-cols-2 landscape:md:gap-3 landscape:md:space-y-0">
          {sortedItems.map((item) => (
            <VideoRow
              key={item.id}
              url={item.url}
              description={item.description}
              stat={statByUrl.get(item.url)}
              pinned={item.pinned}
              // 試合カテゴリ: href なし（ボタン→アプリ内プレイヤー）
              // それ以外: href あり（リンク→YouTube外部）
              href={isMatch ? undefined : item.url}
              onView={() => onView(item.url, item.description, isMatch)}
              editMode={editMode}
              onEdit={() => onEdit(item.id)}
              onDelete={() => onDelete(item.id)}
              onTogglePin={() => onTogglePin(item.id)}
            />
          ))}
          {isMatch && matchVideos.map((mv) => (
            <VideoRow
              key={`sch_${mv.url}`}
              url={mv.url}
              description={mv.description}
              stat={statByUrl.get(mv.url)}
              href={undefined}
              onView={() => onView(mv.url, mv.description, true)}
              editMode={editMode}
              readOnly
            />
          ))}
          {sortedItems.length === 0 && (!isMatch || matchVideos.length === 0) && (
            <p className="text-xs text-blue-200/50 text-center py-4">まだ動画がありません</p>
          )}
          {editMode && !isMatch && (
            <button
              onClick={() => onAdd(category.id)}
              className="w-full border-2 border-dashed border-blue-300/30 rounded-2xl py-2.5 text-blue-200/70 text-xs font-semibold hover:border-blue-300 hover:text-blue-200"
            >＋ 動画を追加</button>
          )}
        </div>
      )}
    </section>
  );
}

// --- タイムスタンプ1行（ゴミ箱アイコンで削除、確認あり）---
function TimestampItem({
  ts, onPlay, onDelete, isActive,
}: {
  ts: VideoTimestamp;
  onPlay: (ts: VideoTimestamp) => void;
  onDelete: (id: string) => void;
  isActive: boolean;
}) {
  const handleDelete = () => {
    if (window.confirm('このタイムスタンプを削除しますか？')) onDelete(ts.id);
  };

  return (
    <div className={`rounded-xl flex items-center gap-2 px-3 py-2 border-l-4 min-w-0 ${isActive ? 'bg-emerald-500/15 border-emerald-400' : 'bg-white/5 border-transparent'}`}>
      <button onClick={() => onPlay(ts)} className="flex-1 flex items-center gap-2 text-left min-w-0">
        <span className={`text-sm font-bold font-mono w-12 flex-shrink-0 ${isActive ? 'text-emerald-300' : 'text-blue-300'}`}>{formatSeconds(ts.seconds)}</span>
        <span className="text-white/80 text-xs flex-1 line-clamp-1 min-w-0">{ts.label || 'シーン'}</span>
      </button>
      <button
        onClick={handleDelete}
        className="text-white/40 hover:text-red-400 active:text-red-400 text-sm flex-shrink-0 px-1"
        aria-label="削除"
      >🗑</button>
    </div>
  );
}

// --- スキップボタン設定（後退5 + 前進5）---
const SKIP_BACK = [
  { d: -60, icon: '⏮', label: '1m' },
  { d: -30, icon: '⏮', label: '30s' },
  { d: -20, icon: '⏮', label: '20s' },
  { d: -10, icon: '◀◀', label: '10s' },
  { d: -5,  icon: '◀',  label: '5s'  },
];
const SKIP_FWD = [
  { d: 5,   icon: '▶',  label: '5s'  },
  { d: 10,  icon: '▶▶', label: '10s' },
  { d: 20,  icon: '⏭',  label: '20s' },
  { d: 30,  icon: '⏭',  label: '30s' },
  { d: 60,  icon: '⏭',  label: '1m' },
];

// --- シークバー（再生位置 + タイムスタンプマーカー）---
function SeekBar({
  currentTime, duration, timestamps, onSeek,
}: {
  currentTime: number;
  duration: number;
  timestamps: VideoTimestamp[];
  onSeek: (seconds: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const seekFromClientX = (clientX: number) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="px-3 pt-1.5 pb-0 bg-gray-950 flex-shrink-0 select-none">
      <div
        ref={barRef}
        className="relative h-5 bg-white/10 rounded-full cursor-pointer"
        onClick={(e) => seekFromClientX(e.clientX)}
        onTouchStart={(e) => seekFromClientX(e.touches[0].clientX)}
      >
        <div
          className="absolute left-0 top-0 h-full bg-sky-500/70 rounded-full pointer-events-none"
          style={{ width: `${progress}%` }}
        />
        {timestamps.map((ts) => {
          const pos = duration > 0 ? Math.min(99, (ts.seconds / duration) * 100) : 0;
          return (
            <button
              key={ts.id}
              className="absolute top-0 h-full w-1.5 bg-emerald-400 rounded-full"
              style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
              onClick={(e) => { e.stopPropagation(); onSeek(ts.seconds); }}
              title={ts.label || formatSeconds(ts.seconds)}
            />
          );
        })}
        <div
          className="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
          style={{ left: `${progress}%`, transform: 'translateX(-50%) translateY(-50%)' }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-white/30 font-mono">{formatSeconds(Math.floor(currentTime))}</span>
        <span className="text-[9px] text-white/30 font-mono">{formatSeconds(Math.floor(duration))}</span>
      </div>
    </div>
  );
}

// --- スマホ判定時のみ、縦画面でも強制的に横画面レイアウトへ回転させる ---
function useForceLandscape(): boolean {
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

// --- 試合動画プレイヤー モーダル（試合カテゴリ専用）---
function VideoPlayerModal({
  url,
  description,
  timestamps,
  onAddTimestamp,
  onDeleteTimestamp,
  onTimestampView,
  onClose,
  customLabelOptions,
  initialSeconds,
  onProgressSave,
}: {
  url: string;
  description: string;
  timestamps: VideoTimestamp[];
  onAddTimestamp: (seconds: number, label?: string) => void;
  onDeleteTimestamp: (id: string) => void;
  onTimestampView: (id: string) => void;
  onClose: () => void;
  customLabelOptions: string[];
  initialSeconds: number;
  onProgressSave: (seconds: number) => void;
}) {
  const playerRef = useRef<YTPlayer | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [pendingSeconds, setPendingSeconds] = useState<number | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const [recordOffsetEnabled, setRecordOffsetEnabled] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const initialSecondsRef = useRef(initialSeconds);
  const onProgressSaveRef = useRef(onProgressSave);
  onProgressSaveRef.current = onProgressSave;

  // 動画エリア/タイムスタンプリストの幅比率（ドラッグでリサイズ可能、端末に保存）
  const [sidebarFraction, setSidebarFraction] = useState(0.25);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('videoPlayerSidebarFraction');
    if (saved) {
      const n = parseFloat(saved);
      if (!Number.isNaN(n) && n >= 0.12 && n <= 0.5) setSidebarFraction(n);
    }
  }, []);

  const shouldRotate = useForceLandscape();
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    if (!shouldRotate) {
      setRotated(false);
      return;
    }
    // 1フレーム置いてから回転させることで「縦→横」のアニメーションを発生させる
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setRotated(true));
    });
    return () => cancelAnimationFrame(raf1);
  }, [shouldRotate]);

  const rotateStyle = shouldRotate
    ? {
        position: 'absolute' as const,
        transformOrigin: '0 0',
        transitionProperty: 'top, left, width, height, transform',
        transitionDuration: '450ms',
        transitionTimingFunction: 'ease-in-out',
        top: 0,
        left: rotated ? '100%' : 0,
        width: rotated ? '100vh' : '100vw',
        height: rotated ? '100vw' : '100vh',
        transform: rotated ? 'rotate(90deg)' : 'rotate(0deg)',
      }
    : { position: 'absolute' as const, inset: 0 };

  const videoId = extractVideoId(url);

  useEffect(() => {
    if (!videoId) return;

    const initPlayer = () => {
      playerRef.current = new window.YT.Player('yt-player-iframe', {
        videoId,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, controls: 0, modestbranding: 1, iv_load_policy: 3, fs: 0, disablekb: 1 },
        events: {
          onReady: (event) => {
            setIsPlayerReady(true);
            if (initialSecondsRef.current > 0) {
              event.target.seekTo(initialSecondsRef.current, true);
            }
          },
          onStateChange: (event) => setIsPlaying(event.data === 1),
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      if (playerRef.current) {
        try {
          const finalTime = playerRef.current.getCurrentTime();
          if (finalTime > 0) onProgressSaveRef.current(finalTime);
        } catch { /* プレイヤー破棄中は取得できないことがある */ }
        playerRef.current.destroy();
      }
      playerRef.current = null;
      setIsPlayerReady(false);
    };
  }, [videoId]);

  // 再生位置と長さをポーリング（500ms）
  useEffect(() => {
    if (!isPlayerReady) return;
    const id = setInterval(() => {
      if (!playerRef.current) return;
      setCurrentTime(playerRef.current.getCurrentTime());
      const d = playerRef.current.getDuration();
      if (d > 0) setDuration(d);
    }, 500);
    return () => clearInterval(id);
  }, [isPlayerReady]);

  const skip = (delta: number) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(Math.max(0, playerRef.current.getCurrentTime() + delta), true);
    playerRef.current.playVideo();
  };

  const handleRecord = () => {
    if (!playerRef.current) return;
    playerRef.current.pauseVideo();
    setPendingSeconds(playerRef.current.getCurrentTime());
    setPendingLabel('ボールタッチ');
  };

  const effectivePendingSeconds = pendingSeconds !== null
    ? (recordOffsetEnabled ? Math.max(0, pendingSeconds - 10) : pendingSeconds)
    : 0;

  const handleAddToList = () => {
    if (pendingSeconds === null) return;
    onAddTimestamp(effectivePendingSeconds, pendingLabel.trim() || undefined);
    setPendingSeconds(null);
    setPendingLabel('');
    playerRef.current?.playVideo();
  };

  const handleCancelRecord = () => {
    setPendingSeconds(null);
    playerRef.current?.playVideo();
  };

  const handleSeek = (ts: VideoTimestamp) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(ts.seconds, true);
    playerRef.current.playVideo();
    onTimestampView(ts.id);
  };

  const handleSeekTo = (seconds: number) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(seconds, true);
    playerRef.current.playVideo();
  };

  // 強制横画面時はCSSでコンテナごと回転しているため、生のポインタ座標(clientY)が
  // 実際のレイアウト上の「動画→リスト」方向に対応する（通常時はclientXを使う）
  const updateSidebarFractionFromPointer = useCallback((clientX: number, clientY: number) => {
    let videoFraction: number;
    if (shouldRotate) {
      videoFraction = clientY / window.innerHeight;
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      videoFraction = (clientX - rect.left) / rect.width;
    }
    setSidebarFraction(Math.min(0.5, Math.max(0.12, 1 - videoFraction)));
  }, [shouldRotate]);

  const handleDividerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      updateSidebarFractionFromPointer(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSidebarFraction((f) => {
        window.localStorage.setItem('videoPlayerSidebarFraction', String(f));
        return f;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const skipBtnClass = "flex flex-col items-center justify-center gap-0 w-9 h-9 rounded-xl bg-slate-700 active:bg-slate-600 text-white disabled:opacity-30 active:scale-95 transition-transform";

  // 現在の再生位置が該当するタイムスタンプ（timestampsはseconds昇順）
  const activeTimestampId = useMemo(() => {
    let active: string | null = null;
    for (const ts of timestamps) {
      if (ts.seconds <= currentTime) active = ts.id;
      else break;
    }
    return active;
  }, [timestamps, currentTime]);

  const quickLabelOptions = useMemo(() => {
    const extra = customLabelOptions.filter((l) => !PRESET_TIMESTAMP_LABELS.includes(l));
    return [...PRESET_TIMESTAMP_LABELS, ...extra];
  }, [customLabelOptions]);

  return (
    <div className="fixed inset-0 z-[200] bg-black overflow-hidden">
    <div ref={containerRef} className="flex flex-row" style={rotateStyle}>

      {/* ===== 左カラム（動画 + コントロール）===== */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* YouTube プレイヤー（ズーム対応）*/}
        <div className="relative w-full bg-black flex-1 min-h-0 overflow-hidden">
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', width: '100%', height: '100%' }}
          >
            {videoId ? (
              <div id="yt-player-iframe" className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40 text-sm">
                YouTube URLではありません
              </div>
            )}
          </div>
          {/* タップで再生/一時停止。YouTube側にタップを渡さないことで、
              YouTubeが出すタイトル/ブランディング表示も防いでいる */}
          {videoId && (
            <button
              type="button"
              aria-label={isPlaying ? '一時停止' : '再生'}
              onClick={() => {
                if (!playerRef.current) return;
                if (isPlaying) playerRef.current.pauseVideo();
                else playerRef.current.playVideo();
              }}
              className="absolute inset-0"
            />
          )}
          {/* ズームボタン（右下オーバーレイ）*/}
          <div className="absolute bottom-2 right-2 flex gap-1 z-10">
            <button
              onClick={() => setZoom(z => Math.max(1.0, parseFloat((z - 0.1).toFixed(1))))}
              disabled={zoom <= 1.0}
              className="w-9 h-9 bg-black/60 text-white rounded-lg flex items-center justify-center text-xl font-bold disabled:opacity-30 active:bg-white/20"
              aria-label="縮小"
            >−</button>
            <button
              onClick={() => setZoom(z => Math.min(3.0, parseFloat((z + 0.1).toFixed(1))))}
              disabled={zoom >= 3.0}
              className="w-9 h-9 bg-black/60 text-white rounded-lg flex items-center justify-center text-xl font-bold disabled:opacity-30 active:bg-white/20"
              aria-label="拡大"
            >＋</button>
          </div>
        </div>

        {/* シークバー */}
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          timestamps={timestamps}
          onSeek={handleSeekTo}
        />

        {/* スキップ・記録ボタン列（左端に閉じるボタン）*/}
        <div className="flex items-center px-2 pt-0.5 pb-2 bg-gray-950 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-white text-base leading-none w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 flex-shrink-0"
          >✕</button>
          <div className="flex-1 flex items-center justify-center gap-0.5">
            {SKIP_BACK.map(({ d, icon, label }) => (
              <button key={d} onClick={() => skip(d)} disabled={!isPlayerReady} className={skipBtnClass}>
                <span className="text-[11px] leading-none">{icon}</span>
                <span className="text-[9px] leading-none opacity-60">{label}</span>
              </button>
            ))}
            <button
              onClick={pendingSeconds !== null ? handleCancelRecord : handleRecord}
              disabled={!isPlayerReady}
              className={`flex flex-col items-center justify-center w-10 h-9 rounded-xl text-white disabled:opacity-30 active:scale-95 transition-transform mx-0.5 ${pendingSeconds !== null ? 'bg-sky-600 active:bg-sky-500' : 'bg-red-700 active:bg-red-600'}`}
            >
              <span className="text-base leading-none">{pendingSeconds !== null ? '▶' : '⏱'}</span>
              <span className="text-[9px] leading-none opacity-80">{pendingSeconds !== null ? '再生' : '記録'}</span>
            </button>
            {SKIP_FWD.map(({ d, icon, label }) => (
              <button key={d} onClick={() => skip(d)} disabled={!isPlayerReady} className={skipBtnClass}>
                <span className="text-[11px] leading-none">{icon}</span>
                <span className="text-[9px] leading-none opacity-60">{label}</span>
              </button>
            ))}
          </div>
          <div className="w-9 flex-shrink-0" aria-hidden />
        </div>

        {/* 記録確定エリア */}
        {pendingSeconds !== null && (
          <div className="flex-shrink-0 bg-red-900/60 border-t border-red-500/40 px-3 py-2">
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-red-200 text-sm font-bold font-mono">{formatSeconds(effectivePendingSeconds)}</span>
                <span className="text-red-300/70 text-xs">を記録中</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] text-red-200/80 whitespace-nowrap">10秒前から記録する</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setRecordOffsetEnabled(v => !v)}
                  aria-pressed={recordOffsetEnabled}
                  aria-label="10秒前から記録する"
                  className={`block w-9 h-5 p-0 rounded-full relative flex-shrink-0 shrink-0 transition-colors outline-none ${recordOffsetEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${recordOffsetEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {quickLabelOptions.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setPendingLabel(l)}
                  className={`text-[10px] px-2 py-1 rounded-full border whitespace-nowrap ${pendingLabel === l ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-black/30 border-white/20 text-white/70'}`}
                >{l}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pendingLabel}
                onChange={e => setPendingLabel(e.target.value)}
                placeholder="ラベル（自由入力も可）"
                className="flex-1 bg-black/40 text-white placeholder-white/30 text-sm px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:border-red-400 min-w-0"
              />
              <button
                onClick={handleAddToList}
                className="bg-red-500 active:bg-red-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
              >追加</button>
              <button
                onClick={handleCancelRecord}
                className="text-white/40 active:text-white text-xl leading-none"
              >✕</button>
            </div>
          </div>
        )}
      </div>

      {/* ドラッグで幅調整できる仕切り */}
      <div
        onPointerDown={handleDividerPointerDown}
        className="w-2 flex-shrink-0 bg-white/10 active:bg-sky-400/50 cursor-col-resize touch-none"
      />

      {/* ===== 右カラム（タイムスタンプリスト、ドラッグで幅調整可）===== */}
      <div className="flex flex-col bg-gray-900 min-h-0" style={{ width: `${sidebarFraction * 100}%`, flexShrink: 0 }}>
        {/* 動画タイトル（旧ヘッダーから移動、文字サイズ縮小）*/}
        <div className="px-3 py-1.5 border-b border-white/10 flex-shrink-0">
          <p className="text-white/70 text-[10px] font-semibold line-clamp-2">{description}</p>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 flex-shrink-0">
          <span className="text-white/60 text-xs font-bold">タイムスタンプ（{timestamps.length}件）</span>
          <button
            onClick={() => setListOpen(!listOpen)}
            className="text-white/40 active:text-white text-xs px-2 py-1"
          >
            {listOpen ? '▲' : '▼'}
          </button>
        </div>
        {listOpen && (
          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-2 py-2">
            {timestamps.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-4">「記録」ボタンでシーンを登録</p>
            ) : (
              <div className="space-y-1.5 min-w-0">
                {timestamps.map((ts) => (
                  <TimestampItem
                    key={ts.id}
                    ts={ts}
                    onPlay={handleSeek}
                    onDelete={onDeleteTimestamp}
                    isActive={ts.id === activeTimestampId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
    </div>
  );
}

// --- 動画 追加/編集 フォーム ---
function VideoFormModal({
  initial, categoryId, categories, onSave, onClose,
}: {
  initial?: VideoItem | null;
  categoryId?: string;
  categories: VideoCategory[];
  onSave: (data: { categoryId: string; url: string; description: string }) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [catId, setCatId] = useState(initial?.categoryId ?? categoryId ?? categories[0]?.id ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !description.trim() || !catId) return;
    onSave({ categoryId: catId, url: url.trim(), description: description.trim() });
  };

  const editableCategories = categories.filter(c => !c.isMatchCategory);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl mb-16 sm:mb-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">🎬 {initial ? '動画を編集' : '動画を追加'}</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">カテゴリ</label>
              <select
                value={catId}
                onChange={e => setCatId(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-blue-400 focus:outline-none"
              >
                {editableCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">URL (YouTube推奨)</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">説明</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="例: ロングキックの基本"
                rows={3}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 active:bg-blue-700 text-white font-bold py-3 rounded-xl text-base">
              💾 {initial ? '更新する' : '追加する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- カテゴリ追加/名前変更 モーダル ---
function CategoryFormModal({
  initialName, title, onSave, onClose,
}: {
  initialName?: string;
  title: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl mb-16 sm:mb-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">{title}</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="カテゴリ名"
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-blue-400 focus:outline-none"
              autoFocus
            />
            <button type="submit" className="w-full bg-blue-600 active:bg-blue-700 text-white font-bold py-3 rounded-xl text-base">💾 保存</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function VideosPage() {
  const {
    videoCategories, addVideoCategory, updateVideoCategory, deleteVideoCategory, reorderVideoCategories,
    videos, addVideo, updateVideo, deleteVideo, toggleVideoPin,
    videoStats, recordVideoView,
    videoTimestamps, addVideoTimestamp, deleteVideoTimestamp, recordTimestampView,
    videoPlaybackPositions, updateVideoPlaybackPosition,
    isLoading,
  } = useApp();

  const [editMode, setEditMode] = useState(false);
  const [videoFormState, setVideoFormState] = useState<{ mode: 'add' | 'edit'; categoryId?: string; item?: VideoItem | null } | null>(null);
  const [categoryFormState, setCategoryFormState] = useState<{ mode: 'add' | 'edit'; id?: string; name?: string } | null>(null);
  const [playerModal, setPlayerModal] = useState<{ url: string; description: string } | null>(null);

  const sortedCategories = useMemo(
    () => [...videoCategories].sort((a, b) => a.order - b.order),
    [videoCategories]
  );

  const hasMatchCategory = sortedCategories.some(c => c.isMatchCategory);
  const schMatchVideos = useSchMatchVideos(hasMatchCategory);

  const activeTimestamps = useMemo(() => {
    if (!playerModal) return [];
    return videoTimestamps
      .filter((t) => t.videoUrl === playerModal.url)
      .sort((a, b) => a.seconds - b.seconds);
  }, [videoTimestamps, playerModal]);

  // 過去に自由入力されたラベル履歴（プリセットを除く、直近入力順）
  const customLabelHistory = useMemo(() => {
    const sorted = [...videoTimestamps].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    const seen = new Set<string>(PRESET_TIMESTAMP_LABELS);
    const out: string[] = [];
    for (const t of sorted) {
      if (t.label && !seen.has(t.label)) {
        seen.add(t.label);
        out.push(t.label);
      }
    }
    return out;
  }, [videoTimestamps]);

  const activeInitialSeconds = useMemo(() => {
    if (!playerModal) return 0;
    return videoPlaybackPositions.find((p) => p.videoUrl === playerModal.url)?.seconds ?? 0;
  }, [videoPlaybackPositions, playerModal]);

  const moveCategory = (id: string, dir: -1 | 1) => {
    const idx = sortedCategories.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sortedCategories.length) return;
    const reordered = [...sortedCategories];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reorderVideoCategories(reordered.map((c, i) => ({ ...c, order: i + 1 })));
  };

  const handleView = useCallback((url: string, description: string, isMatch: boolean) => {
    recordVideoView(url);
    // 試合カテゴリのみアプリ内プレイヤーを開く
    if (isMatch) {
      setPlayerModal({ url, description });
    }
    // それ以外は VideoRow の href で YouTube が外部で開く
  }, [recordVideoView]);

  const handleSaveVideo = (data: { categoryId: string; url: string; description: string }) => {
    if (videoFormState?.mode === 'edit' && videoFormState.item) {
      updateVideo(videoFormState.item.id, data);
    } else {
      addVideo(data);
    }
    setVideoFormState(null);
  };

  const handleSaveCategory = (name: string) => {
    if (categoryFormState?.mode === 'edit' && categoryFormState.id) {
      updateVideoCategory(categoryFormState.id, name);
    } else {
      addVideoCategory(name);
    }
    setCategoryFormState(null);
  };

  if (isLoading) return (<div className="flex items-center justify-center py-24 text-blue-200"><div className="text-center"><p className="text-4xl mb-3">🎬</p><p className="text-sm">読み込み中...</p></div></div>);

  return (
    <>
      <header className="mb-4 pt-1 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-blue-200 text-xs hover:text-white">← ホーム</Link>
          </div>
          <h1 className="text-2xl font-extrabold text-white drop-shadow mt-1">🎬 学習動画</h1>
          <p className="text-xs text-blue-200 mt-0.5">目標達成に近づくために観る</p>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={
            "text-xs font-bold px-3 py-2 rounded-xl border " +
            (editMode
              ? "bg-amber-500 text-white border-amber-300"
              : "bg-white/10 text-blue-100 border-white/20")
          }
        >
          {editMode ? '✓ 編集中' : '✏️ 編集'}
        </button>
      </header>

      <div className="space-y-4">
        {sortedCategories.map((cat, idx) => (
          <CategoryBlock
            key={cat.id}
            category={cat}
            items={videos.filter(v => v.categoryId === cat.id)}
            stats={videoStats}
            onView={handleView}
            editMode={editMode}
            onAdd={(categoryId) => setVideoFormState({ mode: 'add', categoryId })}
            onEdit={(id) => {
              const item = videos.find(v => v.id === id);
              if (item) setVideoFormState({ mode: 'edit', item });
            }}
            onDelete={(id) => {
              if (window.confirm('この動画を削除しますか？')) deleteVideo(id);
            }}
            onTogglePin={toggleVideoPin}
            onRenameCategory={(id) => {
              const c = videoCategories.find(x => x.id === id);
              if (c) setCategoryFormState({ mode: 'edit', id, name: c.name });
            }}
            onDeleteCategory={(id) => {
              if (window.confirm('このカテゴリを削除しますか？\n(中の動画も削除されます)')) deleteVideoCategory(id);
            }}
            onMoveCategoryUp={() => moveCategory(cat.id, -1)}
            onMoveCategoryDown={() => moveCategory(cat.id, 1)}
            canMoveCatUp={idx > 0}
            canMoveCatDown={idx < sortedCategories.length - 1}
            matchVideos={cat.isMatchCategory ? schMatchVideos : []}
          />
        ))}
      </div>

      {editMode && (
        <button
          onClick={() => setCategoryFormState({ mode: 'add' })}
          className="w-full mt-4 border-2 border-dashed border-blue-300/50 rounded-2xl py-3 text-blue-200 text-sm font-semibold hover:border-blue-200 hover:text-white"
        >＋ カテゴリを追加</button>
      )}

      {playerModal && (
        <VideoPlayerModal
          key={playerModal.url}
          url={playerModal.url}
          description={playerModal.description}
          timestamps={activeTimestamps}
          onAddTimestamp={(seconds, label) => addVideoTimestamp(playerModal.url, seconds, label)}
          onDeleteTimestamp={deleteVideoTimestamp}
          onTimestampView={recordTimestampView}
          onClose={() => setPlayerModal(null)}
          customLabelOptions={customLabelHistory}
          initialSeconds={activeInitialSeconds}
          onProgressSave={(seconds) => updateVideoPlaybackPosition(playerModal.url, seconds)}
        />
      )}

      {videoFormState && (
        <VideoFormModal
          initial={videoFormState.item ?? null}
          categoryId={videoFormState.categoryId}
          categories={sortedCategories}
          onSave={handleSaveVideo}
          onClose={() => setVideoFormState(null)}
        />
      )}
      {categoryFormState && (
        <CategoryFormModal
          initialName={categoryFormState.name}
          title={categoryFormState.mode === 'edit' ? 'カテゴリ名を変更' : 'カテゴリを追加'}
          onSave={handleSaveCategory}
          onClose={() => setCategoryFormState(null)}
        />
      )}
    </>
  );
}

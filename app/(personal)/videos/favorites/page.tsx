'use client';

import { useState, useMemo, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import { VideoTimestamp } from '@/lib/types';
import { YTPlayer, loadYouTubeIframeApi, extractYoutubeVideoId, disableCaptionsHard, useForceLandscape } from '@/lib/youtubePlayer';
import { useSchMatchVideos } from '@/lib/schMatchVideos';
import { StarIcon, PlayIcon, PauseIcon, ShuffleIcon, SkipIcon, ExpandIcon, CollapseIcon } from '@/components/AppIcons';

const DEFAULT_CLIP_OFFSET_BEFORE = 20;
const DEFAULT_CLIP_OFFSET_AFTER = 20;
const MIN_CLIP_OFFSET = 0;
const MAX_CLIP_OFFSET = 60;
const FINE_STEP_THRESHOLD = 5; // これ未満は1秒刻み、以上は5秒刻み
const PROGRESS_POLL_MS = 300;

// 5秒未満は1秒刻み、5秒以上は5秒刻みで増減する
function stepOffsetUp(value: number): number {
  const next = value < FINE_STEP_THRESHOLD ? value + 1 : value + 5;
  return Math.min(MAX_CLIP_OFFSET, next);
}
function stepOffsetDown(value: number): number {
  const next = value <= FINE_STEP_THRESHOLD ? value - 1 : value - 5;
  return Math.max(MIN_CLIP_OFFSET, next);
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface FavoriteClip {
  id: string;
  videoUrl: string;
  videoId: string | null; // 動画IDが特定できない場合もお気に入り自体は表示し続ける
  seconds: number;
  label?: string;
  videoDescription: string;
}

/**
 * 再生の仕組み（シンプルな単一プレイヤー方式）:
 * 1. 再生ボタン押下 or シーンをクリック
 * 2. そのシーンの動画をYouTubeプレイヤーに読み込む（同じ動画なら読み込み直さずシークのみ）
 * 3. シーン時刻 - 切り取り秒数 の位置にシーク
 * 4. 再生開始
 * 5. シーン時刻 + 切り取り秒数 に達したら次のシーンへ（末尾なら先頭に戻ってループ）
 */
export default function FavoriteScenesPage() {
  const { videos, videoTimestamps, toggleTimestampFavorite, isLoading } = useApp();
  const schMatchVideos = useSchMatchVideos(true);

  const videoInfoByUrl = useMemo(() => {
    const map = new Map<string, { description: string; sortKey: string }>();
    for (const v of videos) {
      map.set(v.url, { description: v.description, sortKey: v.createdAt ?? '' });
    }
    for (const mv of schMatchVideos) {
      if (!map.has(mv.url)) map.set(mv.url, { description: mv.description, sortKey: mv.date });
    }
    return map;
  }, [videos, schMatchVideos]);

  const clips = useMemo<FavoriteClip[]>(() => {
    const favorites = videoTimestamps.filter((t) => t.favorite);
    const groups = new Map<string, VideoTimestamp[]>();
    for (const t of favorites) {
      if (!groups.has(t.videoUrl)) groups.set(t.videoUrl, []);
      groups.get(t.videoUrl)!.push(t);
    }
    const orderedUrls = [...groups.keys()].sort((a, b) => {
      const ka = videoInfoByUrl.get(a)?.sortKey ?? '';
      const kb = videoInfoByUrl.get(b)?.sortKey ?? '';
      return kb.localeCompare(ka);
    });
    const out: FavoriteClip[] = [];
    for (const url of orderedUrls) {
      const videoId = extractYoutubeVideoId(url);
      const description = videoInfoByUrl.get(url)?.description ?? '';
      const items = [...groups.get(url)!].sort((a, b) => a.seconds - b.seconds);
      for (const t of items) {
        out.push({ id: t.id, videoUrl: url, videoId, seconds: t.seconds, label: t.label, videoDescription: description });
      }
    }
    return out;
  }, [videoTimestamps, videoInfoByUrl]);

  const clipsById = useMemo(() => {
    const m = new Map<string, FavoriteClip>();
    for (const c of clips) m.set(c.id, c);
    return m;
  }, [clips]);
  const clipsByIdRef = useRef(clipsById);
  clipsByIdRef.current = clipsById;
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  // 前後の切り取り秒数は端末に保存し、次回訪問時も引き継ぐ
  const readSavedOffset = (key: string, fallback: number): number => {
    if (typeof window === 'undefined') return fallback;
    const saved = window.localStorage.getItem(key);
    const n = saved ? parseInt(saved, 10) : NaN;
    return !Number.isNaN(n) && n >= MIN_CLIP_OFFSET && n <= MAX_CLIP_OFFSET ? n : fallback;
  };
  const [clipOffsetBefore, setClipOffsetBefore] = useState(() => readSavedOffset('favoriteClipOffsetBefore', DEFAULT_CLIP_OFFSET_BEFORE));
  const clipOffsetBeforeRef = useRef(clipOffsetBefore);
  clipOffsetBeforeRef.current = clipOffsetBefore;
  const [clipOffsetAfter, setClipOffsetAfter] = useState(() => readSavedOffset('favoriteClipOffsetAfter', DEFAULT_CLIP_OFFSET_AFTER));
  const clipOffsetAfterRef = useRef(clipOffsetAfter);
  clipOffsetAfterRef.current = clipOffsetAfter;

  useEffect(() => {
    window.localStorage.setItem('favoriteClipOffsetBefore', String(clipOffsetBefore));
  }, [clipOffsetBefore]);
  useEffect(() => {
    window.localStorage.setItem('favoriteClipOffsetAfter', String(clipOffsetAfter));
  }, [clipOffsetAfter]);

  const [shuffleMode, setShuffleMode] = useState(false);
  const [playOrder, setPlayOrder] = useState<string[]>([]);
  const playOrderRef = useRef<string[]>([]);
  playOrderRef.current = playOrder;
  const [queuePos, setQueuePos] = useState(-1);
  const queuePosRef = useRef(-1);
  queuePosRef.current = queuePos;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  // YouTube側がloadVideoById/playerVars.startで指定した開始位置を無視することがあるため、
  // 再生開始直後にもう一度seekToして確定させる
  const pendingSeekRef = useRef<number | null>(null);
  // プレイヤーがまだreadyでない間に再生要求が来た場合、ready後に実行する
  const pendingLoadRef = useRef<{ videoId: string; start: number } | null>(null);

  const activeClipId = queuePos >= 0 && playOrder.length > 0 ? playOrder[queuePos] : null;
  const activeClip = activeClipId ? clipsById.get(activeClipId) : undefined;

  const createPlayer = useCallback((videoId: string, start: number) => {
    readyRef.current = false;
    pendingSeekRef.current = start;
    currentVideoIdRef.current = videoId;
    playerRef.current = new window.YT.Player('fav-player', {
      videoId,
      playerVars: {
        start: Math.floor(start),
        autoplay: 1,
        playsinline: 1,
        rel: 0,
        controls: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        cc_load_policy: 0,
        fs: 0,
        disablekb: 1,
      },
      events: {
        onReady: (e) => {
          playerRef.current = e.target;
          readyRef.current = true;
          setIsPlayerReady(true);
          disableCaptionsHard(e.target);
          const pending = pendingLoadRef.current;
          if (pending) {
            pendingLoadRef.current = null;
            pendingSeekRef.current = pending.start;
            if (currentVideoIdRef.current === pending.videoId) {
              e.target.seekTo(pending.start, true);
              e.target.playVideo();
            } else {
              currentVideoIdRef.current = pending.videoId;
              e.target.loadVideoById(pending.videoId, pending.start);
            }
          }
        },
        onStateChange: (e) => {
          setIsPlaying(e.data === 1);
          // onApiChangeはcaptionsモジュール初回ロード時にしか確実に発火しないため、
          // 再生/バッファ中の状態遷移でも都度アンロードし直して字幕再表示を防ぐ
          if (e.data === 1 || e.data === 3) disableCaptionsHard(e.target);
          const target = pendingSeekRef.current;
          if (target !== null && (e.data === 1 || e.data === 5)) {
            pendingSeekRef.current = null;
            e.target.seekTo(target, true);
          }
        },
        onApiChange: (e) => disableCaptionsHard(e.target),
      },
    });
  }, []);

  // 指定したクリップ(id)を読み込んで再生する
  const loadAndPlayClip = useCallback((clipId: string) => {
    const clip = clipsByIdRef.current.get(clipId);
    if (!clip || !clip.videoId) return;
    const videoId = clip.videoId;
    const start = Math.max(0, clip.seconds - clipOffsetBeforeRef.current);

    if (!playerRef.current) {
      loadYouTubeIframeApi(() => {
        if (!playerRef.current) createPlayer(videoId, start);
      });
      return;
    }
    if (!readyRef.current) {
      pendingLoadRef.current = { videoId, start };
      return;
    }
    if (currentVideoIdRef.current === videoId) {
      pendingSeekRef.current = start;
      playerRef.current.seekTo(start, true);
      playerRef.current.playVideo();
    } else {
      pendingSeekRef.current = start;
      currentVideoIdRef.current = videoId;
      playerRef.current.loadVideoById(videoId, start);
    }
  }, [createPlayer]);

  const loadAndPlayClipRef = useRef(loadAndPlayClip);
  loadAndPlayClipRef.current = loadAndPlayClip;

  const buildPlayableIds = useCallback((): string[] => {
    return clipsRef.current.filter((c) => c.videoId).map((c) => c.id);
  }, []);

  const shuffleIds = (ids: string[]): string[] => {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const startQueue = useCallback((order: string[], pos: number) => {
    if (order.length === 0) return;
    setPlayOrder(order);
    playOrderRef.current = order;
    setQueuePos(pos);
    queuePosRef.current = pos;
    loadAndPlayClip(order[pos]);
  }, [loadAndPlayClip]);

  const handlePlayAll = useCallback(() => {
    setShuffleMode(false);
    startQueue(buildPlayableIds(), 0);
  }, [buildPlayableIds, startQueue]);

  const handleShufflePlay = useCallback(() => {
    setShuffleMode(true);
    startQueue(shuffleIds(buildPlayableIds()), 0);
  }, [buildPlayableIds, startQueue]);

  const handleClickClip = useCallback((clipId: string) => {
    if (!clipsByIdRef.current.get(clipId)?.videoId) return;
    const all = buildPlayableIds();
    let order: string[];
    let pos: number;
    if (shuffleMode) {
      order = [clipId, ...shuffleIds(all.filter((id) => id !== clipId))];
      pos = 0;
    } else {
      order = all;
      pos = order.indexOf(clipId);
    }
    startQueue(order, pos);
  }, [buildPlayableIds, shuffleMode, startQueue]);

  const goToOffset = useCallback((delta: number) => {
    const order = playOrderRef.current;
    if (order.length === 0) return;
    const pos = queuePosRef.current;
    const nextPos = ((pos + delta) % order.length + order.length) % order.length;
    setQueuePos(nextPos);
    queuePosRef.current = nextPos;
    loadAndPlayClip(order[nextPos]);
  }, [loadAndPlayClip]);

  // 再生位置を監視し、シーン+切り取り秒数に達したら自動で次へ（末尾なら先頭に戻る）
  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (player) disableCaptionsHard(player); // 字幕再表示のフェイルセーフ（ポーリングで都度アンロード）
      const pos = queuePosRef.current;
      const order = playOrderRef.current;
      if (!player || pos < 0 || order.length === 0) return;
      const clip = clipsByIdRef.current.get(order[pos]);
      if (!clip) {
        // お気に入り解除等で消えたクリップはスキップして次へ
        goToOffset(1);
        return;
      }
      let t: number;
      try {
        t = player.getCurrentTime();
      } catch {
        return;
      }
      setCurrentTime(t);
      if (t >= clip.seconds + clipOffsetAfterRef.current) {
        const nextPos = (pos + 1) % order.length;
        setQueuePos(nextPos);
        queuePosRef.current = nextPos;
        loadAndPlayClipRef.current(order[nextPos]);
      }
    }, PROGRESS_POLL_MS);
    return () => clearInterval(interval);
  }, [goToOffset]);

  // アンマウント時にプレイヤーを破棄
  useEffect(() => () => { playerRef.current?.destroy(); playerRef.current = null; }, []);

  const handleTogglePlay = () => {
    const player = playerRef.current;
    if (!player) {
      handlePlayAll();
      return;
    }
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  };

  const clipStart = activeClip ? Math.max(0, activeClip.seconds - clipOffsetBefore) : 0;
  const clipEnd = activeClip ? activeClip.seconds + clipOffsetAfter : 0;
  const progress = activeClip && clipEnd > clipStart
    ? Math.min(100, Math.max(0, ((currentTime - clipStart) / (clipEnd - clipStart)) * 100))
    : 0;

  // クリップ範囲内をドラッグ/タップしてシークできるバー
  const seekBarRef = useRef<HTMLDivElement>(null);
  const seekFromClientX = useCallback((clientX: number) => {
    const player = playerRef.current;
    const bar = seekBarRef.current;
    if (!player || !bar || !activeClip) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = clipStart + ratio * (clipEnd - clipStart);
    player.seekTo(t, true);
    setCurrentTime(t);
  }, [activeClip, clipStart, clipEnd]);

  const draggingSeekRef = useRef(false);
  const handleSeekPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeClip) return;
    draggingSeekRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };
  const handleSeekPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingSeekRef.current) return;
    seekFromClientX(e.clientX);
  };
  const handleSeekPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingSeekRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // 画面最大化（通常の試合動画モーダルと同じ「スマホ縦画面なら強制横回転」方式）
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shouldRotate = useForceLandscape();
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    if (!isFullscreen || !shouldRotate) {
      setRotated(false);
      return;
    }
    // 1フレーム置いてから回転させることで「縦→横」のアニメーションを発生させる
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setRotated(true));
    });
    return () => cancelAnimationFrame(raf1);
  }, [isFullscreen, shouldRotate]);

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

  if (isLoading) {
    return (<div className="flex items-center justify-center py-24 text-blue-200"><div className="text-center"><p className="text-4xl mb-3">⭐</p><p className="text-sm">読み込み中...</p></div></div>);
  }

  return (
    <>
      <header className="mb-4 pt-1 flex items-center gap-2">
        <Link href="/videos" className="text-blue-200 text-xs hover:text-white flex-shrink-0">← 学習動画</Link>
      </header>
      <div className="flex items-center gap-2 mb-4">
        <StarIcon size={26} className="text-amber-400 flex-shrink-0" />
        <h1 className="text-xl font-extrabold text-white drop-shadow">お気に入りシーン</h1>
        <span className="text-xs text-blue-300/70">({clips.length}件)</span>
      </div>

      {clips.length === 0 ? (
        <p className="text-sm text-blue-200/60 text-center py-16">
          まだお気に入りシーンがありません。<br />試合動画の再生画面でタイムスタンプの★をタップして登録してください。
        </p>
      ) : (
        <>
          {/* 全体再生・シャッフル再生 */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={handlePlayAll}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 active:bg-emerald-400 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              <PlayIcon size={16} />上から再生
            </button>
            <button
              onClick={handleShufflePlay}
              className={`flex-1 flex items-center justify-center gap-1.5 text-white font-bold py-2.5 rounded-xl text-sm ${shuffleMode ? 'bg-sky-500 active:bg-sky-400' : 'bg-white/10 active:bg-white/20'}`}
            >
              <ShuffleIcon size={16} />シャッフル再生
            </button>
          </div>

          {/* 1シーンあたりの切り取り秒数（前後で別々に設定可能） */}
          <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mb-4 text-xs text-blue-200/80">
            <div className="flex items-center gap-2">
              <span>シーン前</span>
              <button
                onClick={() => setClipOffsetBefore(stepOffsetDown)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
                aria-label="シーン前を短くする"
              >−</button>
              <span className="font-mono font-bold text-white w-6 text-center">{clipOffsetBefore}</span>
              <button
                onClick={() => setClipOffsetBefore(stepOffsetUp)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
                aria-label="シーン前を長くする"
              >+</button>
              <span>秒</span>
            </div>
            <div className="flex items-center gap-2">
              <span>シーン後</span>
              <button
                onClick={() => setClipOffsetAfter(stepOffsetDown)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
                aria-label="シーン後を短くする"
              >−</button>
              <span className="font-mono font-bold text-white w-6 text-center">{clipOffsetAfter}</span>
              <button
                onClick={() => setClipOffsetAfter(stepOffsetUp)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
                aria-label="シーン後を長くする"
              >+</button>
              <span>秒</span>
            </div>
          </div>

          {/* 動画+シークバー+操作ボタン: フルスクリーン時はDOMツリー形状を変えずclassName/styleだけ切り替える
              （YT.Playerがバインドされた#fav-playerを跨って再マウントされると再生が壊れるため） */}
          <div className={isFullscreen ? 'fixed inset-0 z-[200] bg-black overflow-hidden' : 'contents'}>
            <div
              className={isFullscreen ? 'flex flex-col h-full' : 'contents'}
              style={isFullscreen ? rotateStyle : undefined}
            >
              <div className={isFullscreen ? 'relative flex-1 min-h-0 bg-black overflow-hidden' : 'relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-lg'}>
                <div id="fav-player" className="absolute inset-0 w-full h-full" />
                {activeClip ? (
                  // YouTube側のタップ操作によるタイトル/ブランディング表示を防ぐブロック用オーバーレイ（タップで再生/一時停止）
                  <button
                    type="button"
                    aria-label={isPlaying ? '一時停止' : '再生'}
                    onClick={handleTogglePlay}
                    className="absolute inset-0"
                  />
                ) : (
                  <button
                    type="button"
                    aria-label="再生"
                    onClick={handleTogglePlay}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center"
                  >
                    <span className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                      <PlayIcon size={28} className="text-white ml-1" />
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreen((v) => !v)}
                  aria-label={isFullscreen ? '画面最大化を解除' : '画面を最大化'}
                  title={isFullscreen ? '元のサイズに戻す' : '画面を最大化'}
                  className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white active:bg-black/70"
                >
                  {isFullscreen ? <CollapseIcon size={16} /> : <ExpandIcon size={16} />}
                </button>
              </div>

              {/* クリップ進捗バー（ドラッグ/タップでシーク可能） */}
              <div
                ref={seekBarRef}
                className={isFullscreen ? 'relative h-6 mx-3 mt-2 flex-shrink-0 bg-white/10 rounded-full cursor-pointer select-none touch-none' : 'relative h-5 mt-2 bg-white/10 rounded-full cursor-pointer select-none touch-none'}
                onPointerDown={handleSeekPointerDown}
                onPointerMove={handleSeekPointerMove}
                onPointerUp={handleSeekPointerUp}
                onPointerCancel={handleSeekPointerUp}
              >
                <div className="absolute left-0 top-0 h-full bg-amber-400/70 rounded-full pointer-events-none" style={{ width: `${progress}%` }} />
                <div
                  className="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
                  style={{ left: `${progress}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                />
              </div>

              {/* 現在のシーン情報 + 操作 */}
              <div className={isFullscreen ? 'flex items-center gap-2 px-3 py-2 flex-shrink-0' : 'mt-2 flex items-center gap-2'}>
                <button
                  onClick={() => goToOffset(-1)}
                  disabled={queuePos < 0}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 active:scale-95 transition-transform"
                  aria-label="前のシーン"
                >
                  <SkipIcon size={18} className="rotate-180" />
                </button>
                <button
                  onClick={handleTogglePlay}
                  className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-emerald-500 active:bg-emerald-400 text-white active:scale-95 transition-transform"
                  aria-label={isPlaying ? '一時停止' : '再生'}
                >
                  {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
                </button>
                <button
                  onClick={() => goToOffset(1)}
                  disabled={queuePos < 0}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 active:scale-95 transition-transform"
                  aria-label="次のシーン"
                >
                  <SkipIcon size={18} />
                </button>
                <div className="flex-1 min-w-0 pl-1">
                  <p className="text-white text-sm font-semibold line-clamp-1">{activeClip?.label || (activeClip ? 'シーン' : '未再生')}</p>
                  <p className="text-blue-300/70 text-xs line-clamp-1">{activeClip?.videoDescription}</p>
                </div>
              </div>
            </div>
          </div>

          {/* お気に入りシーン一覧 */}
          <div className="mt-5 space-y-1.5">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className={`rounded-xl flex items-center gap-2 px-3 py-2 border-l-4 min-w-0 ${clip.id === activeClipId ? 'bg-emerald-500/15 border-emerald-400' : 'bg-white/5 border-transparent'}`}
              >
                <button
                  onClick={() => toggleTimestampFavorite(clip.id)}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center p-0 text-amber-400"
                  aria-label="お気に入りを解除"
                  title="お気に入りを解除"
                >
                  <StarIcon size={16} />
                </button>
                <button
                  onClick={() => handleClickClip(clip.id)}
                  disabled={!clip.videoId}
                  className="flex-1 flex items-center gap-2 text-left min-w-0 disabled:opacity-40"
                >
                  <span className={`text-sm font-bold font-mono w-12 flex-shrink-0 ${clip.id === activeClipId ? 'text-emerald-300' : 'text-blue-300'}`}>{formatSeconds(clip.seconds)}</span>
                  <span className="text-white/80 text-xs flex-1 line-clamp-1 min-w-0">{clip.label || 'シーン'}</span>
                  {clip.videoId ? (
                    <span className="text-blue-300/60 text-[10px] flex-shrink-0 max-w-[35%] truncate">{clip.videoDescription}</span>
                  ) : (
                    <span className="text-red-400/70 text-[10px] flex-shrink-0" title="動画URLを認識できませんでした">再生不可</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import { VideoTimestamp } from '@/lib/types';
import { YTPlayer, loadYouTubeIframeApi, extractYoutubeVideoId } from '@/lib/youtubePlayer';
import { useSchMatchVideos } from '@/lib/schMatchVideos';
import { StarIcon, PlayIcon, PauseIcon, ShuffleIcon, SkipIcon } from '@/components/AppIcons';

const DEFAULT_CLIP_OFFSET = 20;
const MIN_CLIP_OFFSET = 5;
const MAX_CLIP_OFFSET = 60;
const PROGRESS_POLL_MS = 300;

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

  const [clipOffset, setClipOffset] = useState(DEFAULT_CLIP_OFFSET);
  const clipOffsetRef = useRef(clipOffset);
  clipOffsetRef.current = clipOffset;

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
          const target = pendingSeekRef.current;
          if (target !== null && (e.data === 1 || e.data === 5)) {
            pendingSeekRef.current = null;
            e.target.seekTo(target, true);
          }
        },
      },
    });
  }, []);

  // 指定したクリップ(id)を読み込んで再生する
  const loadAndPlayClip = useCallback((clipId: string) => {
    const clip = clipsByIdRef.current.get(clipId);
    if (!clip || !clip.videoId) return;
    const videoId = clip.videoId;
    const start = Math.max(0, clip.seconds - clipOffsetRef.current);

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
      if (t >= clip.seconds + clipOffsetRef.current) {
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

  const clipStart = activeClip ? Math.max(0, activeClip.seconds - clipOffset) : 0;
  const clipEnd = activeClip ? activeClip.seconds + clipOffset : 0;
  const progress = activeClip
    ? Math.min(100, Math.max(0, ((currentTime - clipStart) / (clipEnd - clipStart)) * 100))
    : 0;

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

          {/* 1シーンあたりの切り取り秒数 */}
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-blue-200/80">
            <span>1シーンの長さ: 前後</span>
            <button
              onClick={() => setClipOffset((o) => Math.max(MIN_CLIP_OFFSET, o - 5))}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
              aria-label="短くする"
            >−</button>
            <span className="font-mono font-bold text-white w-6 text-center">{clipOffset}</span>
            <button
              onClick={() => setClipOffset((o) => Math.min(MAX_CLIP_OFFSET, o + 5))}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
              aria-label="長くする"
            >+</button>
            <span>秒</span>
          </div>

          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-lg">
            <div id="fav-player" className="absolute inset-0 w-full h-full" />
            {/* YouTube側のタップ操作によるタイトル/ブランディング表示を防ぐブロック用オーバーレイ（タップで再生/一時停止） */}
            <button
              type="button"
              aria-label={isPlaying ? '一時停止' : '再生'}
              onClick={handleTogglePlay}
              className="absolute inset-0"
            />
            {!activeClip && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <PlayIcon size={40} className="text-white/70" />
                <p className="text-white/70 text-xs">再生ボタンかシーンを選んでね</p>
              </div>
            )}
          </div>

          {/* クリップ進捗バー */}
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${progress}%` }} />
          </div>

          {/* 現在のシーン情報 + 操作 */}
          <div className="mt-2 flex items-center gap-2">
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

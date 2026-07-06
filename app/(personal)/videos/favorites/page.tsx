'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import { VideoTimestamp } from '@/lib/types';
import { YTPlayer, loadYouTubeIframeApi, extractYoutubeVideoId } from '@/lib/youtubePlayer';
import { useSchMatchVideos } from '@/lib/schMatchVideos';
import { StarIcon, PlayIcon, PauseIcon, SkipIcon } from '@/components/AppIcons';

const CLIP_MARGIN_SECONDS = 20;
const PROGRESS_POLL_MS = 300;

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface FavoriteClip {
  id: string;
  videoUrl: string;
  videoId: string;
  seconds: number;
  label?: string;
  videoDescription: string;
  start: number;
  end: number;
}

type Slot = 0 | 1;
const OTHER_SLOT = (slot: Slot): Slot => (slot === 0 ? 1 : 0);

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
      if (!videoId) continue;
      const description = videoInfoByUrl.get(url)?.description ?? '';
      const items = [...groups.get(url)!].sort((a, b) => a.seconds - b.seconds);
      for (const t of items) {
        out.push({
          id: t.id,
          videoUrl: url,
          videoId,
          seconds: t.seconds,
          label: t.label,
          videoDescription: description,
          start: Math.max(0, t.seconds - CLIP_MARGIN_SECONDS),
          end: t.seconds + CLIP_MARGIN_SECONDS,
        });
      }
    }
    return out;
  }, [videoTimestamps, videoInfoByUrl]);

  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  const [activeIndex, setActiveIndex] = useState(0);
  const [activeSlot, setActiveSlot] = useState<Slot>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [finished, setFinished] = useState(false);

  const activeIndexRef = useRef(0);
  const activeSlotRef = useRef<Slot>(0);
  const playersRef = useRef<[YTPlayer | null, YTPlayer | null]>([null, null]);
  const slotVideoIdRef = useRef<[string | null, string | null]>([null, null]);
  const bootstrappedRef = useRef(false);

  const createPlayer = useCallback((slot: Slot, videoId: string, start: number, autoplay: boolean) => {
    const player = new window.YT.Player(`fav-player-${slot}`, {
      videoId,
      playerVars: {
        start: Math.floor(start),
        autoplay: autoplay ? 1 : 0,
        playsinline: 1,
        rel: 0,
        controls: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        fs: 0,
        disablekb: 1,
      },
      events: {
        onReady: (e) => {
          playersRef.current[slot] = e.target;
          if (slot === activeSlotRef.current) setIsPlayerReady(true);
        },
        onStateChange: (e) => {
          if (slot === activeSlotRef.current) setIsPlaying(e.data === 1);
        },
      },
    });
    playersRef.current[slot] = player;
    slotVideoIdRef.current[slot] = videoId;
  }, []);

  const preloadNext = useCallback((index: number) => {
    const next = clipsRef.current[index + 1];
    if (!next) return;
    const inactiveSlot = OTHER_SLOT(activeSlotRef.current);
    if (slotVideoIdRef.current[inactiveSlot] === next.videoId) return;
    if (next.videoId === slotVideoIdRef.current[activeSlotRef.current]) return;
    const p = playersRef.current[inactiveSlot];
    if (p) {
      p.cueVideoById(next.videoId, next.start);
      slotVideoIdRef.current[inactiveSlot] = next.videoId;
    } else {
      createPlayer(inactiveSlot, next.videoId, next.start, false);
    }
  }, [createPlayer]);

  const playClip = useCallback((index: number) => {
    const clip = clipsRef.current[index];
    if (!clip) return;
    setFinished(false);
    const active = activeSlotRef.current;
    const other = OTHER_SLOT(active);

    if (slotVideoIdRef.current[active] === clip.videoId && playersRef.current[active]) {
      playersRef.current[active]!.seekTo(clip.start, true);
      playersRef.current[active]!.playVideo();
    } else if (slotVideoIdRef.current[other] === clip.videoId && playersRef.current[other]) {
      // 事前読み込み済みの反対側スロットへスワップ（切替の待ち時間を減らす）
      playersRef.current[other]!.seekTo(clip.start, true);
      playersRef.current[other]!.playVideo();
      playersRef.current[active]?.pauseVideo();
      setActiveSlot(other);
      activeSlotRef.current = other;
      setIsPlayerReady(true);
    } else if (playersRef.current[active]) {
      playersRef.current[active]!.loadVideoById(clip.videoId, clip.start);
      slotVideoIdRef.current[active] = clip.videoId;
    } else {
      createPlayer(active, clip.videoId, clip.start, true);
    }

    setActiveIndex(index);
    activeIndexRef.current = index;
    preloadNext(index);
  }, [createPlayer, preloadNext]);

  const playClipRef = useRef(playClip);
  playClipRef.current = playClip;

  // 初回ブートストラップ: 最初のクリップを再生し、2番目のクリップを事前読み込み
  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (clips.length === 0) return;
    bootstrappedRef.current = true;
    loadYouTubeIframeApi(() => {
      createPlayer(0, clips[0].videoId, clips[0].start, true);
      preloadNext(0);
    });
    return () => {
      playersRef.current[0]?.destroy();
      playersRef.current[1]?.destroy();
      playersRef.current = [null, null];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.length > 0]);

  // 再生位置を監視し、クリップの終端(+20秒)に達したら自動で次へ
  useEffect(() => {
    const interval = setInterval(() => {
      const idx = activeIndexRef.current;
      const clip = clipsRef.current[idx];
      const player = playersRef.current[activeSlotRef.current];
      if (!clip || !player) return;
      let t: number;
      try {
        t = player.getCurrentTime();
      } catch {
        return;
      }
      setCurrentTime(t);
      if (t >= clip.end) {
        const nextIdx = idx + 1;
        if (nextIdx < clipsRef.current.length) {
          playClipRef.current(nextIdx);
        } else {
          player.pauseVideo();
          setFinished(true);
        }
      }
    }, PROGRESS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleTogglePlay = () => {
    const player = playersRef.current[activeSlotRef.current];
    if (!player) return;
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  };

  const activeClip = clips[activeIndex];
  const progress = activeClip
    ? Math.min(100, Math.max(0, ((currentTime - activeClip.start) / (activeClip.end - activeClip.start)) * 100))
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
          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-lg">
            <div
              id="fav-player-0"
              className="absolute inset-0 w-full h-full"
              style={{ visibility: activeSlot === 0 ? 'visible' : 'hidden' }}
            />
            <div
              id="fav-player-1"
              className="absolute inset-0 w-full h-full"
              style={{ visibility: activeSlot === 1 ? 'visible' : 'hidden' }}
            />
            {/* YouTube側のタップ操作によるタイトル/ブランディング表示を防ぐブロック用オーバーレイ（タップで再生/一時停止） */}
            <button
              type="button"
              aria-label={isPlaying ? '一時停止' : '再生'}
              onClick={handleTogglePlay}
              className="absolute inset-0"
            />
            {finished && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
                <p className="text-white font-bold">全てのシーンを再生しました</p>
                <button
                  onClick={() => playClip(0)}
                  className="bg-emerald-500 active:bg-emerald-400 text-white text-sm font-bold px-4 py-2 rounded-full"
                >もう一度最初から再生</button>
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
              onClick={() => activeIndex > 0 && playClip(activeIndex - 1)}
              disabled={activeIndex <= 0}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 active:scale-95 transition-transform"
              aria-label="前のシーン"
            >
              <SkipIcon size={18} className="rotate-180" />
            </button>
            <button
              onClick={handleTogglePlay}
              disabled={!isPlayerReady}
              className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-emerald-500 active:bg-emerald-400 text-white disabled:opacity-30 active:scale-95 transition-transform"
              aria-label={isPlaying ? '一時停止' : '再生'}
            >
              {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
            </button>
            <button
              onClick={() => activeIndex < clips.length - 1 && playClip(activeIndex + 1)}
              disabled={activeIndex >= clips.length - 1}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 active:scale-95 transition-transform"
              aria-label="次のシーン"
            >
              <SkipIcon size={18} />
            </button>
            <div className="flex-1 min-w-0 pl-1">
              <p className="text-white text-sm font-semibold line-clamp-1">{activeClip?.label || 'シーン'}</p>
              <p className="text-blue-300/70 text-xs line-clamp-1">{activeClip?.videoDescription}</p>
            </div>
          </div>

          {/* お気に入りシーン一覧 */}
          <div className="mt-5 space-y-1.5">
            {clips.map((clip, idx) => (
              <div
                key={clip.id}
                className={`rounded-xl flex items-center gap-2 px-3 py-2 border-l-4 min-w-0 ${idx === activeIndex ? 'bg-emerald-500/15 border-emerald-400' : 'bg-white/5 border-transparent'}`}
              >
                <button
                  onClick={() => toggleTimestampFavorite(clip.id)}
                  className="text-amber-400 flex-shrink-0"
                  aria-label="お気に入りを解除"
                  title="お気に入りを解除"
                >
                  <StarIcon size={16} />
                </button>
                <button onClick={() => playClip(idx)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                  <span className={`text-sm font-bold font-mono w-12 flex-shrink-0 ${idx === activeIndex ? 'text-emerald-300' : 'text-blue-300'}`}>{formatSeconds(clip.seconds)}</span>
                  <span className="text-white/80 text-xs flex-1 line-clamp-1 min-w-0">{clip.label || 'シーン'}</span>
                  <span className="text-blue-300/60 text-[10px] flex-shrink-0 max-w-[35%] truncate">{clip.videoDescription}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

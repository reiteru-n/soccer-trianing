'use client';

import { useEffect, useState } from 'react';

// SCH match videos fetch (YouTubeのSCHチームプレイリストに限定)
// videos ページ本体と /videos/favorites で共有する

export interface SchMatchVideo {
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

export function useSchMatchVideos(enabled: boolean): SchMatchVideo[] {
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

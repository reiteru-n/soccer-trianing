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

// YouTube再生リストのpublishedAtは絶対日付("2026-06-13"等)か相対テキスト("3日前"等)のどちらか。
// app/sch/page.tsx の relativeDateLabel と同じ相対表現パターンを認識し、実際のDateに変換する。
export function parseUploadDate(text: string): Date | null {
  if (!text) return null;
  const abs = new Date(text);
  if (!isNaN(abs.getTime())) return abs;

  let days: number | null = null;
  const m1 = text.match(/(\d+)\s*日前/);
  const m2 = text.match(/(\d+)\s*週間?前/);
  const m3 = text.match(/(\d+)\s*[ヶヵか]月前/);
  const m4 = text.match(/(\d+)\s*年前/);
  const m5 = text.match(/(\d+)\s+days?\s+ago/i);
  const m6 = text.match(/(\d+)\s+weeks?\s+ago/i);
  const m7 = text.match(/(\d+)\s+months?\s+ago/i);
  const m8 = text.match(/(\d+)\s+years?\s+ago/i);
  if (/(今日|たった今|just\s+now)/i.test(text)) days = 0;
  else if (/(昨日|yesterday)/i.test(text)) days = 1;
  else if (m1) days = parseInt(m1[1], 10);
  else if (m2) days = parseInt(m2[1], 10) * 7;
  else if (m3) days = parseInt(m3[1], 10) * 30;
  else if (m4) days = parseInt(m4[1], 10) * 365;
  else if (m5) days = parseInt(m5[1], 10);
  else if (m6) days = parseInt(m6[1], 10) * 7;
  else if (m7) days = parseInt(m7[1], 10) * 30;
  else if (m8) days = parseInt(m8[1], 10) * 365;
  if (days === null) return null;
  return new Date(Date.now() - days * 86400000);
}

const TITLE_DATE_RE = /(\d{1,2})\s*\/\s*(\d{1,2})/;

/**
 * 動画のタイトルから「M/D」形式の日付を正規表現で読み取り、実際の試合日を推定する。
 * タイトルから読み取れない場合は動画のアップロード日（publishedAt）にフォールバックする。
 * 年はタイトルに含まれないため、アップロード日を基準に「アップロード日以前で最も近い年」を採用する
 * （動画は試合の後にアップロードされるため）。
 */
export function resolveVideoDate(title: string, uploadDateRaw: string): Date {
  const fallback = parseUploadDate(uploadDateRaw) ?? new Date();
  const m = title.match(TITLE_DATE_RE);
  if (!m) return fallback;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return fallback;

  const fallbackYear = fallback.getFullYear();
  let candidate = new Date(fallbackYear, month - 1, day);
  if (candidate.getTime() > fallback.getTime() + 86400000) {
    candidate = new Date(fallbackYear - 1, month - 1, day);
  }
  return candidate;
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

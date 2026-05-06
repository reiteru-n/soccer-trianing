import { NextResponse } from 'next/server';

const PLAYLIST_ID = 'PLo9LruwA1kPSBNtamp53j4AVZup6aVrin';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export interface YtVideo {
  videoId: string;
  title: string;
  publishedAt: string; // ISO or relative text
  thumbnail: string;
  url: string;
}

let cache: { data: YtVideo[]; expires: number } | null = null;

// ytInitialData の JSON ブロックを HTML から抽出（括弧の深さを追跡）
function extractJsonBlock(html: string, marker: string): unknown | null {
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const start = html.indexOf('{', idx);
  if (start < 0) return null;
  let depth = 0, inStr = false, escape = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inStr) { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dig(obj: any, ...keys: string[]): any {
  for (const k of keys) { if (obj == null || typeof obj !== 'object') return undefined; obj = obj[k]; }
  return obj;
}

export async function GET() {
  const now = Date.now();
  if (cache && cache.expires > now) return NextResponse.json(cache.data);

  try {
    const res = await fetch(
      `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const data = extractJsonBlock(html, 'ytInitialData');
    if (!data) throw new Error('ytInitialData not found');

    // contents ツリーをたどる
    const tabs = dig(data, 'contents', 'twoColumnBrowseResultsRenderer', 'tabs');
    const contents: unknown[] =
      dig(tabs, '0', 'tabRenderer', 'content', 'sectionListRenderer', 'contents', '0',
        'itemSectionRenderer', 'contents', '0', 'playlistVideoListRenderer', 'contents') ?? [];

    const videos: YtVideo[] = [];
    for (const item of contents) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (item as any)?.playlistVideoRenderer;
      if (!r) continue;
      const videoId: string = r.videoId;
      const title: string = r.title?.runs?.[0]?.text ?? r.title?.simpleText ?? '';
      const timeText: string = r.publishedTimeText?.simpleText ?? '';
      // サムネイルは最高解像度を選ぶ
      const thumbs: { url: string; width: number }[] = r.thumbnail?.thumbnails ?? [];
      const thumb = thumbs.reduce((best, t) => (!best || t.width > best.width) ? t : best, thumbs[0]);
      const thumbnail = thumb?.url ?? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      if (!videoId || !title) continue;
      videos.push({ videoId, title, publishedAt: timeText, thumbnail, url: `https://www.youtube.com/watch?v=${videoId}` });
      if (videos.length >= 4) break;
    }

    cache = { data: videos, expires: now + CACHE_TTL };
    return NextResponse.json(videos);
  } catch (e) {
    console.error('[yt-playlist]', e);
    return NextResponse.json([]);
  }
}

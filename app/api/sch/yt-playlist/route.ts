import { NextResponse } from 'next/server';

// ビルド時の静的最適化を無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PLAYLIST_ID = 'PLo9LruwA1kPSBNtamp53j4AVZup6aVrin';
const CACHE_TTL = 15 * 60 * 1000;

export interface YtVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
}

let cache: { data: YtVideo[]; expires: number } | null = null;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const TIME_RE = /(\d+\s*(日|週間|ヶ月|ヵ月|か月|年)前|昨日|今日|\d+\s+days?\s+ago|\d+\s+weeks?\s+ago|\d+\s+months?\s+ago|\d+\s+years?\s+ago|yesterday|just\s+now)/i;

function findTimeText(obj: unknown, depth = 0): string {
  if (depth > 20 || obj == null) return '';
  if (typeof obj === 'string') return obj.match(TIME_RE)?.[0] ?? '';
  if (typeof obj !== 'object') return '';
  if (Array.isArray(obj)) {
    for (const item of obj) { const f = findTimeText(item, depth + 1); if (f) return f; }
    return '';
  }
  const o = obj as Record<string, unknown>;
  for (const key of ['simpleText', 'text', 'content', 'publishedTimeText', 'videoInfo']) {
    if (key in o) { const f = findTimeText(o[key], depth + 1); if (f) return f; }
  }
  for (const [key, v] of Object.entries(o)) {
    if (['thumbnail', 'thumbnailViewModel', 'navigationEndpoint', 'trackingParams', 'title'].includes(key)) continue;
    const f = findTimeText(v, depth + 1);
    if (f) return f;
  }
  return '';
}

function extractTitle(r: Record<string, unknown>): string {
  const t = r['title'] as Record<string, unknown> | undefined;
  if (t) {
    if (typeof t['simpleText'] === 'string' && t['simpleText']) return t['simpleText'];
    const runs = t['runs'] as { text?: string }[] | undefined;
    if (runs?.[0]?.text) return runs[0].text;
    if (typeof t['content'] === 'string' && t['content']) return t['content'];
  }
  // lockupViewModel (2024+ layout): metadata.lockupMetadataViewModel.title.content
  try {
    const lmvm = (r['metadata'] as Record<string, unknown>)?.['lockupMetadataViewModel'] as Record<string, unknown>;
    const c = lmvm?.['title'] as Record<string, unknown>;
    if (typeof c?.['content'] === 'string' && c['content']) return c['content'];
  } catch { /* skip */ }
  return '';
}

function extractThumbnail(r: Record<string, unknown>, videoId: string): string {
  const thumbs = (r['thumbnail'] as Record<string, unknown>)?.['thumbnails'] as { url: string; width: number }[] | undefined;
  if (thumbs?.length) {
    const best = thumbs.reduce((b, t) => t.width > (b?.width ?? 0) ? t : b, thumbs[0]);
    if (best?.url) return best.url;
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// Walk entire ytInitialData / InnerTube JSON tree, collect all video entries.
// Handles classic playlistVideoRenderer and new lockupViewModel (2024+) layouts.
function extractAllVideos(data: unknown, limit = 50): YtVideo[] {
  const videos: YtVideo[] = [];
  const seen = new Set<string>();

  function walk(obj: unknown, depth = 0): void {
    if (depth > 35 || obj == null || typeof obj !== 'object' || videos.length >= limit) return;
    if (Array.isArray(obj)) { for (const item of obj) walk(item, depth + 1); return; }
    const o = obj as Record<string, unknown>;

    if ('playlistVideoRenderer' in o) {
      const r = o['playlistVideoRenderer'] as Record<string, unknown>;
      const videoId = r?.videoId as string;
      if (videoId && !seen.has(videoId)) {
        seen.add(videoId);
        videos.push({ videoId, title: extractTitle(r), publishedAt: findTimeText(r), thumbnail: extractThumbnail(r, videoId), url: `https://www.youtube.com/watch?v=${videoId}` });
      }
      return;
    }

    // New layout (2024+): lockupViewModel
    if ('lockupViewModel' in o) {
      const lvm = o['lockupViewModel'] as Record<string, unknown>;
      const videoId = lvm?.contentId as string;
      if (videoId && typeof videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(videoId) && !seen.has(videoId)) {
        seen.add(videoId);
        videos.push({ videoId, title: extractTitle(lvm), publishedAt: findTimeText(lvm), thumbnail: extractThumbnail(lvm, videoId), url: `https://www.youtube.com/watch?v=${videoId}` });
      }
      return;
    }

    for (const [key, v] of Object.entries(o)) {
      if (['trackingParams', 'clickTrackingParams'].includes(key)) continue;
      walk(v, depth + 1);
    }
  }

  walk(data);
  return videos;
}

// YouTube InnerTube API (YouTube's own internal JSON API).
// Works for all playlist types (PL*, UU*, etc.) and returns relative dates.
// RSS feeds (/feeds/videos.xml?playlist_id=) only work for channel upload playlists (UU*).
async function fetchViaInnerTube(): Promise<YtVideo[]> {
  const res = await fetch(
    'https://www.youtube.com/youtubei/v1/browse',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        'Accept-Language': 'ja,en-US;q=0.9',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20240620.00.00',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240620.00.00',
            hl: 'ja',
            gl: 'JP',
          },
        },
        browseId: `VL${PLAYLIST_ID}`,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    }
  );
  if (!res.ok) throw new Error(`InnerTube HTTP ${res.status}`);
  const data = await res.json();
  return extractAllVideos(data, 50);
}

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

function extractVideoIdsFromHtml(html: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)) {
    ids.add(m[1]);
    if (ids.size >= 50) break;
  }
  return [...ids];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '6') || 6, 50);
  const rawDebug = url.searchParams.get('raw') === '1';
  const now = Date.now();
  if (!rawDebug && cache && cache.expires > now) return NextResponse.json(cache.data.slice(0, limit));

  // Primary: InnerTube API (works for PL* playlists; RSS does not)
  try {
    const videos = await fetchViaInnerTube();
    if (rawDebug) return NextResponse.json({ source: 'innertube', count: videos.length, items: videos.slice(0, 5) });
    if (videos.length > 0) {
      cache = { data: videos, expires: now + CACHE_TTL };
      return NextResponse.json(videos.slice(0, limit));
    }
    console.warn('[yt-playlist] InnerTube returned 0, falling back to HTML scrape');
  } catch (e) {
    console.warn('[yt-playlist] InnerTube failed, falling back to HTML scrape:', e);
  }

  // Fallback: HTML scraping with ytInitialData (handles old + new YouTube layouts)
  try {
    const res = await fetch(
      `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
      {
        headers: {
          'User-Agent': UA,
          'Accept-Language': 'ja,en-US;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const data = extractJsonBlock(html, 'ytInitialData');

    let videos: YtVideo[] = [];
    if (data) {
      videos = extractAllVideos(data, 50);
    }

    if (videos.length === 0) {
      const fallbackIds = extractVideoIdsFromHtml(html);
      for (const videoId of fallbackIds.slice(0, limit)) {
        videos.push({ videoId, title: '', publishedAt: '', thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, url: `https://www.youtube.com/watch?v=${videoId}` });
      }
      console.warn(`[yt-playlist] regex fallback: ${videos.length} videos, hasData=${!!data}`);
    }

    if (rawDebug) return NextResponse.json({ source: 'html', count: videos.length, items: videos.slice(0, 5), hasData: !!data });

    if (videos.length > 0) {
      cache = { data: videos, expires: now + CACHE_TTL };
    }
    return NextResponse.json(videos.slice(0, limit));
  } catch (e) {
    console.error('[yt-playlist]', e);
    if (rawDebug) return NextResponse.json({ error: String(e) });
    return NextResponse.json([]);
  }
}

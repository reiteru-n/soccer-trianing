import { NextResponse } from 'next/server';

const PLAYLIST_ID = 'PLo9LruwA1kPSBNtamp53j4AVZup6aVrin';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export interface YtVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
}

let cache: { data: YtVideo[]; expires: number } | null = null;

// ytInitialData の JSON ブロックを HTML から抽出
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

// playlistVideoListRenderer.contents を JSON ツリーから再帰的に探す
// YouTube は構造を頻繁に変えるためパスをハードコードしない
function findPlaylistContents(obj: unknown, depth = 0): unknown[] | null {
  if (depth > 20 || obj == null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findPlaylistContents(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const o = obj as Record<string, unknown>;
  if ('playlistVideoListRenderer' in o) {
    const plr = o['playlistVideoListRenderer'] as Record<string, unknown> | null;
    const contents = plr?.['contents'];
    if (Array.isArray(contents) && contents.length > 0) return contents;
  }
  for (const v of Object.values(o)) {
    const found = findPlaylistContents(v, depth + 1);
    if (found) return found;
  }
  return null;
}

// ytInitialData が取れなかった場合の fallback: HTML から直接 videoId を正規表現で収集
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

  try {
    const res = await fetch(
      `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const data = extractJsonBlock(html, 'ytInitialData');

    let contents: unknown[] = [];
    if (data) {
      // 再帰的に playlistVideoListRenderer を探す（構造変更に強い）
      contents = findPlaylistContents(data) ?? [];
    }

    // debug: raw=1 でキャッシュ無視し最初の5アイテムの生 renderer データを返す
    if (rawDebug) {
      const rawItems = contents.slice(0, 5).map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = (item as any)?.playlistVideoRenderer;
        if (!r) return item;
        return { videoId: r.videoId, publishedTimeText: r.publishedTimeText, videoInfo: r.videoInfo };
      });
      return NextResponse.json({ contentsLength: contents.length, items: rawItems, hasYtInitialData: !!data });
    }

    const TIME_RE = /(\d+(日|週間|ヶ月|年)前|昨日|今日|\d+\s+days?\s+ago|\d+\s+weeks?\s+ago|\d+\s+months?\s+ago|\d+\s+years?\s+ago|yesterday)/i;
    const videos: YtVideo[] = [];

    for (const item of contents) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (item as any)?.playlistVideoRenderer;
      if (!r) continue;
      const videoId: string = r.videoId;
      const title: string = r.title?.runs?.[0]?.text ?? r.title?.simpleText ?? '';
      const timeText: string = (() => {
        if (r.publishedTimeText?.simpleText) return r.publishedTimeText.simpleText as string;
        const runs: { text: string }[] = r.videoInfo?.runs ?? [];
        for (let i = runs.length - 1; i >= 0; i--) {
          const t = runs[i].text?.trim() ?? '';
          if (TIME_RE.test(t)) return t;
        }
        const label: string = r.accessibility?.accessibilityData?.label ?? '';
        const m = label.match(TIME_RE);
        if (m) return m[0];
        return '';
      })();
      const thumbs: { url: string; width: number }[] = r.thumbnail?.thumbnails ?? [];
      const thumb = thumbs.reduce((best, t) => (!best || t.width > best.width) ? t : best, thumbs[0]);
      const thumbnail = thumb?.url ?? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      if (!videoId || !title) continue;
      videos.push({ videoId, title, publishedAt: timeText, thumbnail, url: `https://www.youtube.com/watch?v=${videoId}` });
      if (videos.length >= 50) break;
    }

    // Fallback: ytInitialData のパースが全滅した場合、HTML から videoId だけ収集してサムネを返す
    if (videos.length === 0) {
      const fallbackIds = extractVideoIdsFromHtml(html);
      for (const videoId of fallbackIds.slice(0, limit)) {
        videos.push({
          videoId,
          title: '',
          publishedAt: '',
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
      console.warn(`[yt-playlist] Fell back to regex extraction: ${videos.length} videos, hasData=${!!data}`);
    }

    cache = { data: videos, expires: now + CACHE_TTL };
    return NextResponse.json(videos.slice(0, limit));
  } catch (e) {
    console.error('[yt-playlist]', e);
    return NextResponse.json([]);
  }
}

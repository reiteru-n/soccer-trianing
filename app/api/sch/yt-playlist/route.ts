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

// 相対日付（秒/分/時間も含む）
const TIME_RE = /(\d+\s*(秒|分|時間|日|週間|ヶ月|ヵ月|か月|年)前|昨日|今日|たった今|\d+\s+seconds?\s+ago|\d+\s+minutes?\s+ago|\d+\s+hours?\s+ago|\d+\s+days?\s+ago|\d+\s+weeks?\s+ago|\d+\s+months?\s+ago|\d+\s+years?\s+ago|yesterday|just\s+now)/i;
// 絶対日付（日本語）: 2026年6月7日
const ABS_DATE_RE = /(\d{4})年(\d{1,2})月(\d{1,2})日/;

// "2026年6月7日" → "2026-06-07" (relativeDateLabel が new Date() で解析できる形式に変換)
function normalizeDate(text: string): string {
  const m = text.match(ABS_DATE_RE);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return text;
}

function findTimeText(obj: unknown, depth = 0): string {
  if (depth > 20 || obj == null) return '';
  if (typeof obj === 'string') {
    if (TIME_RE.test(obj)) return obj.match(TIME_RE)![0];
    const absM = obj.match(ABS_DATE_RE);
    if (absM) return normalizeDate(absM[0]);
    return '';
  }
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

// playlistVideoRenderer から投稿日を取得（既知フィールドを優先してチェック）
function extractPublishedAt(r: Record<string, unknown>): string {
  // 1. publishedTimeText.simpleText（最も一般的）
  const ptt = (r['publishedTimeText'] as Record<string, unknown> | undefined)?.['simpleText'] as string | undefined;
  if (ptt) return normalizeDate(ptt);

  // 2. videoInfo.runs — 末尾から日付テキストを探す
  const runs = ((r['videoInfo'] as Record<string, unknown> | undefined)?.['runs']) as { text?: string }[] | undefined;
  if (runs) {
    for (let i = runs.length - 1; i >= 0; i--) {
      const t = (runs[i].text as string) ?? '';
      if (TIME_RE.test(t)) return t;
      if (ABS_DATE_RE.test(t)) return normalizeDate(t);
    }
  }

  // 3. accessibility label
  const label = (((r['accessibility'] as Record<string, unknown>)
    ?.['accessibilityData']) as Record<string, unknown>)
    ?.['label'] as string | undefined;
  if (label) {
    const absM = label.match(ABS_DATE_RE);
    if (absM) return normalizeDate(absM[0]);
    const relM = label.match(TIME_RE);
    if (relM) return relM[0];
  }

  // 4. フォールバック: 再帰スキャン
  return findTimeText(r);
}

// lockupViewModel (2024+ layout) から投稿日を取得
function extractPublishedAtFromLockup(lvm: Record<string, unknown>): string {
  // metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[*].metadataParts[*].text.content
  try {
    const rows = ((((lvm['metadata'] as Record<string, unknown>)
      ?.['lockupMetadataViewModel'] as Record<string, unknown>)
      ?.['metadata'] as Record<string, unknown>)
      ?.['contentMetadataViewModel'] as Record<string, unknown>)
      ?.['metadataRows'] as unknown[] | undefined;
    for (const row of rows ?? []) {
      const parts = (row as Record<string, unknown>)?.['metadataParts'] as unknown[] | undefined;
      for (const part of parts ?? []) {
        const content = ((part as Record<string, unknown>)?.['text'] as Record<string, unknown>)?.['content'] as string | undefined;
        if (!content) continue;
        if (TIME_RE.test(content)) return content;
        if (ABS_DATE_RE.test(content)) return normalizeDate(content);
      }
    }
  } catch { /* skip */ }
  return findTimeText(lvm);
}

function extractTitle(r: Record<string, unknown>): string {
  const t = r['title'] as Record<string, unknown> | undefined;
  if (t) {
    if (typeof t['simpleText'] === 'string' && t['simpleText']) return t['simpleText'];
    const runs = t['runs'] as { text?: string }[] | undefined;
    if (runs?.[0]?.text) return runs[0].text;
    if (typeof t['content'] === 'string' && t['content']) return t['content'];
  }
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

// Walk entire ytInitialData / InnerTube JSON tree.
// デバッグ用に rawSamples も収集（最初の3件のrenderer生データ）。
function extractAllVideos(data: unknown, limit = 50): { videos: YtVideo[]; rawSamples: unknown[] } {
  const videos: YtVideo[] = [];
  const rawSamples: unknown[] = [];
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
        if (rawSamples.length < 3) {
          rawSamples.push({
            type: 'playlistVideoRenderer',
            videoId: r.videoId,
            keys: Object.keys(r),
            publishedTimeText: r['publishedTimeText'],
            videoInfo: r['videoInfo'],
            accessibility: r['accessibility'],
          });
        }
        videos.push({ videoId, title: extractTitle(r), publishedAt: extractPublishedAt(r), thumbnail: extractThumbnail(r, videoId), url: `https://www.youtube.com/watch?v=${videoId}` });
      }
      return;
    }

    if ('lockupViewModel' in o) {
      const lvm = o['lockupViewModel'] as Record<string, unknown>;
      const videoId = lvm?.contentId as string;
      if (videoId && typeof videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(videoId) && !seen.has(videoId)) {
        seen.add(videoId);
        if (rawSamples.length < 3) {
          rawSamples.push({
            type: 'lockupViewModel',
            contentId: lvm.contentId,
            keys: Object.keys(lvm),
            metadata: lvm['metadata'],
          });
        }
        videos.push({ videoId, title: extractTitle(lvm), publishedAt: extractPublishedAtFromLockup(lvm), thumbnail: extractThumbnail(lvm, videoId), url: `https://www.youtube.com/watch?v=${videoId}` });
      }
      return;
    }

    for (const [key, v] of Object.entries(o)) {
      if (['trackingParams', 'clickTrackingParams'].includes(key)) continue;
      walk(v, depth + 1);
    }
  }

  walk(data);
  return { videos, rawSamples };
}

async function fetchViaInnerTube(): Promise<{ videos: YtVideo[]; rawSamples: unknown[] }> {
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

  // Primary: InnerTube API
  try {
    const { videos, rawSamples } = await fetchViaInnerTube();
    if (rawDebug) {
      return NextResponse.json({ source: 'innertube', count: videos.length, items: videos.slice(0, 5), rawSamples });
    }
    if (videos.length > 0) {
      cache = { data: videos, expires: now + CACHE_TTL };
      return NextResponse.json(videos.slice(0, limit));
    }
    console.warn('[yt-playlist] InnerTube returned 0, falling back to HTML scrape');
  } catch (e) {
    console.warn('[yt-playlist] InnerTube failed, falling back to HTML scrape:', e);
  }

  // Fallback: HTML scraping with ytInitialData
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
    let rawSamples: unknown[] = [];
    if (data) {
      ({ videos, rawSamples } = extractAllVideos(data, 50));
    }

    if (videos.length === 0) {
      const fallbackIds = extractVideoIdsFromHtml(html);
      for (const videoId of fallbackIds.slice(0, limit)) {
        videos.push({ videoId, title: '', publishedAt: '', thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, url: `https://www.youtube.com/watch?v=${videoId}` });
      }
      console.warn(`[yt-playlist] regex fallback: ${videos.length} videos, hasData=${!!data}`);
    }

    if (rawDebug) return NextResponse.json({ source: 'html', count: videos.length, items: videos.slice(0, 5), hasData: !!data, rawSamples });

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

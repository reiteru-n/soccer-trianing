import { NextRequest, NextResponse } from 'next/server';

// In-memory cache: url -> { imgUrl, expires }
const cache = new Map<string, { imgUrl: string | null; expires: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function getYoutubeVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getVimeoVideoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

async function fetchOgImage(url: string): Promise<string | null> {
  // YouTube — use direct CDN (no fetch needed)
  const ytId = getYoutubeVideoId(url);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

  // Vimeo — public API, no key needed
  const vmId = getVimeoVideoId(url);
  if (vmId) {
    try {
      const r = await fetch(`https://vimeo.com/api/v2/video/${vmId}.json`, {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const d = await r.json() as { thumbnail_large?: string }[];
        if (d[0]?.thumbnail_large) return d[0].thumbnail_large;
      }
    } catch { /* fall through */ }
  }

  // Generic OGP scrape
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OGBot/1.0)' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });
    if (!r.ok) return null;
    const html = await r.text();
    // og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) {
      const src = ogMatch[1];
      // resolve relative URL
      if (src.startsWith('http')) return src;
      const base = new URL(url);
      return new URL(src, base.origin).href;
    }
    // twitter:image fallback
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch) {
      const src = twMatch[1];
      if (src.startsWith('http')) return src;
      const base = new URL(url);
      return new URL(src, base.origin).href;
    }
  } catch { /* ignore */ }
  return null;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ url: null }, { status: 400 });

  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expires > now) {
    return NextResponse.json({ url: cached.imgUrl });
  }

  const imgUrl = await fetchOgImage(url);
  cache.set(url, { imgUrl, expires: now + TTL_MS });
  // evict old entries (keep cache small)
  if (cache.size > 500) {
    for (const [k, v] of cache.entries()) {
      if (v.expires < now) cache.delete(k);
      if (cache.size <= 400) break;
    }
  }

  return NextResponse.json({ url: imgUrl });
}

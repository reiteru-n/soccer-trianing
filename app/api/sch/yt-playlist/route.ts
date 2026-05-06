import { NextResponse } from 'next/server';

const PLAYLIST_ID = 'PLo9LruwA1kPSBNtamp53j4AVZup6aVrin';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface YtVideo {
  videoId: string;
  title: string;
  publishedAt: string; // ISO
  thumbnail: string;
  url: string;
}

let cache: { data: YtVideo[]; expires: number } | null = null;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

export async function GET() {
  const now = Date.now();
  if (cache && cache.expires > now) return NextResponse.json(cache.data);

  try {
    const res = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SCHBot/1.0)' },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const videos: YtVideo[] = [];

    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = m[1];
      const videoIdM   = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleM     = e.match(/<media:title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/media:title>/)
                      ?? e.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const publishedM = e.match(/<published>([^<]+)<\/published>/);
      if (!videoIdM || !titleM || !publishedM) continue;
      const videoId = videoIdM[1].trim();
      videos.push({
        videoId,
        title: decodeEntities(titleM[1].trim()),
        publishedAt: publishedM[1].trim(),
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
      if (videos.length >= 4) break;
    }

    cache = { data: videos, expires: now + CACHE_TTL };
    return NextResponse.json(videos);
  } catch {
    return NextResponse.json([]);
  }
}

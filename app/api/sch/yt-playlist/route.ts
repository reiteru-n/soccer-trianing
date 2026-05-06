import { NextResponse } from 'next/server';

const PLAYLIST_ID = 'PLo9LruwA1kPSBNtamp53j4AVZup6aVrin';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export interface YtVideo {
  videoId: string;
  title: string;
  publishedAt: string; // ISO
  thumbnail: string;
  url: string;
}

let cache: { data: YtVideo[]; expires: number } | null = null;

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 503 });
  }

  const now = Date.now();
  if (cache && cache.expires > now) return NextResponse.json(cache.data);

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('maxResults', '4');
    url.searchParams.set('playlistId', PLAYLIST_ID);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);

    const data = await res.json() as {
      items?: {
        snippet: {
          title: string;
          publishedAt: string;
          resourceId: { videoId: string };
          thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
        };
      }[];
    };

    const videos: YtVideo[] = (data.items ?? []).map(item => {
      const videoId = item.snippet.resourceId.videoId;
      const thumb = item.snippet.thumbnails?.high?.url
        ?? item.snippet.thumbnails?.medium?.url
        ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      return {
        videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnail: thumb,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    });

    cache = { data: videos, expires: now + CACHE_TTL };
    return NextResponse.json(videos);
  } catch (e) {
    console.error('yt-playlist fetch error:', e);
    return NextResponse.json([]);
  }
}

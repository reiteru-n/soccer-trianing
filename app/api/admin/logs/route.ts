import { NextResponse } from 'next/server';

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function hasRedis() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'access';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);

  if (!hasRedis()) {
    return NextResponse.json({ entries: [] });
  }

  const key = type === 'change' ? 'admin:change_log' : 'admin:access_log';
  try {
    const redis = await getRedis();
    const raw = await redis.lrange(key, 0, limit - 1);
    const entries = raw.map(item => {
      if (typeof item === 'string') {
        try { return JSON.parse(item); } catch { return null; }
      }
      return item;
    }).filter(Boolean);
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

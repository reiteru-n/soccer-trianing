import { NextRequest, NextResponse } from 'next/server';

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

const KEY = 'admin:excluded_ips';

async function loadIps(redis: Awaited<ReturnType<typeof getRedis>>): Promise<string[]> {
  const raw = await redis.get(KEY);
  if (!raw) return [];
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  if (Array.isArray(raw)) return raw as string[];
  return [];
}

// GET: return list of excluded IPs
export async function GET() {
  if (!hasRedis()) return NextResponse.json({ ips: [] });
  try {
    const redis = await getRedis();
    const ips = await loadIps(redis);
    return NextResponse.json({ ips });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT: replace entire excluded IP list
export async function PUT(req: NextRequest) {
  if (!hasRedis()) return NextResponse.json({ ok: false });
  try {
    const body = await req.json();
    const ips: string[] = Array.isArray(body.ips) ? body.ips : [];
    const redis = await getRedis();
    await redis.set(KEY, JSON.stringify(ips));
    return NextResponse.json({ ok: true, ips });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

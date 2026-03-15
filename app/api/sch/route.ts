import { NextResponse } from 'next/server';
import { SchSchedule, SchMatch, SchAnnouncement } from '@/lib/types';

const KEYS = {
  schedules:     'sch:schedules',
  matches:       'sch:matches',
  announcements: 'sch:announcements',
} as const;

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

interface SchData {
  schedules: SchSchedule[];
  matches: SchMatch[];
  announcements: SchAnnouncement[];
}

async function readSchData(): Promise<SchData> {
  if (hasRedis()) {
    const redis = await getRedis();
    const [schedules, matches, announcements] = await redis.mget<unknown[]>(
      KEYS.schedules, KEYS.matches, KEYS.announcements
    );
    return {
      schedules:     (schedules     as SchSchedule[])     ?? [],
      matches:       (matches       as SchMatch[])         ?? [],
      announcements: (announcements as SchAnnouncement[]) ?? [],
    };
  }
  // Local dev: file fallback
  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const txt = readFileSync(join(process.cwd(), 'dev-sch.json'), 'utf-8');
    return JSON.parse(txt);
  } catch {
    return { schedules: [], matches: [], announcements: [] };
  }
}

async function writeSchPartial(body: Partial<Record<string, unknown>>): Promise<void> {
  if (hasRedis()) {
    const redis = await getRedis();
    const updates: Record<string, unknown> = {};
    if ('schedules'     in body) updates[KEYS.schedules]     = body.schedules;
    if ('matches'       in body) updates[KEYS.matches]       = body.matches;
    if ('announcements' in body) updates[KEYS.announcements] = body.announcements;
    if (Object.keys(updates).length > 0) await redis.mset(updates);
    return;
  }
  const { readFileSync, writeFileSync } = await import('fs');
  const { join } = await import('path');
  const path = join(process.cwd(), 'dev-sch.json');
  let current: Record<string, unknown> = {};
  try { current = JSON.parse(readFileSync(path, 'utf-8')); } catch { /* new file */ }
  writeFileSync(path, JSON.stringify({ ...current, ...body }, null, 2));
}

export async function GET() {
  const data = await readSchData();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    await writeSchPartial(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

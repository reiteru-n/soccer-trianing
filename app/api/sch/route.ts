import { NextResponse } from 'next/server';
import { SchSchedule, SchMatch, SchAnnouncement, SchMember } from '@/lib/types';

const KEYS = {
  schedules:     'sch:schedules',
  matches:       'sch:matches',
  announcements: 'sch:announcements',
  members:       'sch:members',
} as const;

const DEFAULT_MEMBERS: SchMember[] = [
  { id: 'm6',  number: 6,  name: 'かいし' },
  { id: 'm7',  number: 7,  name: 'いつき' },
  { id: 'm8',  number: 8,  name: 'るきあ' },
  { id: 'm9',  number: 9,  name: 'しゅうぞう' },
  { id: 'm10', number: 10, name: 'ぜん' },
  { id: 'm11', number: 11, name: 'さく' },
  { id: 'm14', number: 14, name: 'かいと' },
  { id: 'm15', number: 15, name: 'かい' },
  { id: 'm17', number: 17, name: 'せお' },
  { id: 'm19', number: 19, name: 'たくと' },
  { id: 'm20', number: 20, name: 'さくたろう' },
  { id: 'm30', number: 30, name: 'ひろと' },
  { id: 'm31', number: 31, name: 'しゅう' },
];

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
  members: SchMember[];
}

async function readSchData(): Promise<SchData> {
  if (hasRedis()) {
    const redis = await getRedis();
    const [schedules, matches, announcements, membersRaw] = await redis.mget<unknown[]>(
      KEYS.schedules, KEYS.matches, KEYS.announcements, KEYS.members
    );
    let members = membersRaw as SchMember[] | null;
    if (members === null) {
      members = DEFAULT_MEMBERS;
      await redis.set(KEYS.members, DEFAULT_MEMBERS);
    }
    return {
      schedules:     (schedules     as SchSchedule[])     ?? [],
      matches:       (matches       as SchMatch[])         ?? [],
      announcements: (announcements as SchAnnouncement[]) ?? [],
      members,
    };
  }
  // Local dev: file fallback
  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const txt = readFileSync(join(process.cwd(), 'dev-sch.json'), 'utf-8');
    const data = JSON.parse(txt);
    return { schedules: [], matches: [], announcements: [], members: DEFAULT_MEMBERS, ...data };
  } catch {
    return { schedules: [], matches: [], announcements: [], members: DEFAULT_MEMBERS };
  }
}

async function writeSchPartial(body: Partial<Record<string, unknown>>): Promise<void> {
  if (hasRedis()) {
    const redis = await getRedis();
    const updates: Record<string, unknown> = {};
    if ('schedules'     in body) updates[KEYS.schedules]     = body.schedules;
    if ('matches'       in body) updates[KEYS.matches]       = body.matches;
    if ('announcements' in body) updates[KEYS.announcements] = body.announcements;
    if ('members'       in body) updates[KEYS.members]       = body.members;
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

import { NextResponse } from 'next/server';
import { SchSchedule, SchMatch, SchAnnouncement, SchMember, SchParkingRecord, SchNearbyParking, SchEvent } from '@/lib/types';

const KEYS = {
  events:         'sch:events',
  schedules:      'sch:schedules',
  matches:        'sch:matches',
  announcements:  'sch:announcements',
  members:        'sch:members',
  parkingRecords: 'sch:parking_records',
  parkingRotation:'sch:parking_rotation',
  nearbyParking:  'sch:nearby_parking',
  teamLogo:       'sch:team_logo',
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

const DEFAULT_ROTATION = 5;

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
  events: SchEvent[];
  announcements: SchAnnouncement[];
  members: SchMember[];
  parkingRecords: SchParkingRecord[];
  parkingRotation: number;
  nearbyParking: SchNearbyParking[];
  teamLogo: string | null;
  // Legacy (kept for backward compat read)
  schedules: SchSchedule[];
  matches: SchMatch[];
}

/** Migrate old schedules + matches into unified events array */
function migrateToEvents(schedules: SchSchedule[], matches: SchMatch[]): SchEvent[] {
  const fromSchedules: SchEvent[] = schedules.map(s => ({
    id: s.id,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    location: s.location,
    note: s.note,
    type: 'practice' as const,
  }));
  const fromMatches: SchEvent[] = matches.map(m => ({
    id: m.id,
    date: m.date,
    startTime: m.startTime,
    location: m.location,
    note: m.note,
    type: 'match' as const,
    opponentName: m.opponent,
    isHome: m.isHome,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));
  return [...fromSchedules, ...fromMatches].sort((a, b) => a.date.localeCompare(b.date));
}

async function readSchData(): Promise<SchData> {
  if (hasRedis()) {
    const redis = await getRedis();
    const [eventsRaw, schedulesRaw, matchesRaw, announcements, membersRaw,
           parkingRecordsRaw, parkingRotationRaw, nearbyParkingRaw, teamLogoRaw] =
      await redis.mget<unknown[]>(
        KEYS.events, KEYS.schedules, KEYS.matches, KEYS.announcements,
        KEYS.members, KEYS.parkingRecords, KEYS.parkingRotation,
        KEYS.nearbyParking, KEYS.teamLogo
      );

    let members = membersRaw as SchMember[] | null;
    if (members === null) {
      members = DEFAULT_MEMBERS;
      await redis.set(KEYS.members, DEFAULT_MEMBERS);
    }

    let parkingRotation = parkingRotationRaw as number | null;
    if (parkingRotation === null) {
      parkingRotation = DEFAULT_ROTATION;
      await redis.set(KEYS.parkingRotation, DEFAULT_ROTATION);
    }

    // Migration: if events is null but old schedules/matches exist, migrate
    let events = eventsRaw as SchEvent[] | null;
    if (events === null) {
      const schedules = (schedulesRaw as SchSchedule[]) ?? [];
      const matches = (matchesRaw as SchMatch[]) ?? [];
      events = migrateToEvents(schedules, matches);
      if (events.length > 0) {
        await redis.set(KEYS.events, events);
      } else {
        events = [];
      }
    }

    return {
      events,
      announcements:  (announcements  as SchAnnouncement[]) ?? [],
      members,
      parkingRecords: (parkingRecordsRaw as SchParkingRecord[]) ?? [],
      parkingRotation,
      nearbyParking:  (nearbyParkingRaw as SchNearbyParking[]) ?? [],
      teamLogo:       (teamLogoRaw as string | null) ?? null,
      schedules:      (schedulesRaw as SchSchedule[]) ?? [],
      matches:        (matchesRaw as SchMatch[]) ?? [],
    };
  }

  // Local dev: file fallback
  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const txt = readFileSync(join(process.cwd(), 'dev-sch.json'), 'utf-8');
    const data = JSON.parse(txt);
    // Migrate if needed
    if (!data.events) {
      data.events = migrateToEvents(data.schedules ?? [], data.matches ?? []);
    }
    return {
      events: [], announcements: [],
      members: DEFAULT_MEMBERS,
      parkingRecords: [], parkingRotation: DEFAULT_ROTATION, nearbyParking: [],
      teamLogo: null, schedules: [], matches: [],
      ...data,
    };
  } catch {
    return {
      events: [], announcements: [],
      members: DEFAULT_MEMBERS,
      parkingRecords: [], parkingRotation: DEFAULT_ROTATION, nearbyParking: [],
      teamLogo: null, schedules: [], matches: [],
    };
  }
}

async function writeSchPartial(body: Partial<Record<string, unknown>>): Promise<void> {
  if (hasRedis()) {
    const redis = await getRedis();
    const updates: Record<string, unknown> = {};
    if ('events'         in body) updates[KEYS.events]         = body.events;
    if ('announcements'  in body) updates[KEYS.announcements]  = body.announcements;
    if ('members'        in body) updates[KEYS.members]        = body.members;
    if ('parkingRecords' in body) updates[KEYS.parkingRecords] = body.parkingRecords;
    if ('parkingRotation'in body) updates[KEYS.parkingRotation]= body.parkingRotation;
    if ('nearbyParking'  in body) updates[KEYS.nearbyParking]  = body.nearbyParking;
    if ('teamLogo'       in body) updates[KEYS.teamLogo]       = body.teamLogo;
    // Legacy keys (still writable for backward compat)
    if ('schedules'      in body) updates[KEYS.schedules]      = body.schedules;
    if ('matches'        in body) updates[KEYS.matches]        = body.matches;
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

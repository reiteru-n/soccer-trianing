import { NextResponse } from 'next/server';
import { SchSchedule, SchAnnouncement, SchMember, SchParkingRecord, SchNearbyParking, SchEvent } from '@/lib/types';

// Legacy SchMatch shape (from sch:matches Redis key) — kept only for migration
type LegacySchMatch = { id: string; date: string; startTime?: string; opponent?: string; location?: string; homeScore?: number; awayScore?: number; isHome?: boolean; note?: string; };
import { logAccess, logChange, getIp, getUa } from '@/lib/logger';

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
  { id: 'm6',  number: 6,  name: '年森海志',   parents: [{ role: '父', name: '年森祥太郎' }, { role: '母', name: '年森舞' }] },
  { id: 'm7',  number: 7,  name: '廣瀧樹',     nameKana: 'ひろたきいつき', parents: [{ role: '父', name: '廣瀧巧' }, { role: '母', name: '廣瀧渚' }] },
  { id: 'm8',  number: 8,  name: '大和田琉煌', nameKana: 'おおわだるきあ', parents: [{ role: '父', name: '大和田 真' }, { role: '母', name: '大和田 あゆ未' }] },
  { id: 'm9',  number: 9,  name: '荒井修蔵',   nameKana: 'あらいしゅうぞう', parents: [{ role: '父', name: '荒井大輔' }, { role: '母', name: '荒井未紗子' }] },
  { id: 'm10', number: 10, name: '嶋津然',     nameKana: 'しまづぜん', parents: [{ role: '父', name: '嶋津勝也' }, { role: '母', name: '嶋津佳奈' }] },
  { id: 'm11', number: 11, name: '小野沢朔',   nameKana: 'さく', parents: [{ role: '父', name: '小野沢太郎' }, { role: '母', name: '小野沢友香里' }] },
  { id: 'm14', number: 14, name: '鳥谷海翔',   nameKana: 'とりやかいと', parents: [{ role: '父', name: '鳥谷浩之' }, { role: '母', name: '鳥谷香織' }] },
  { id: 'm15', number: 15, name: '小笠原快',   nameKana: 'かい',         parents: [{ role: '父', name: '小笠原亮' }, { role: '母', name: '小笠原晴菜' }] },
  { id: 'm17', number: 17, name: '村岡晟旺',   nameKana: 'むらおかせお', parents: [{ role: '母', name: '村岡祥子' }, { role: '父', name: '村岡慶男' }] },
  { id: 'm19', number: 19, name: '西本拓渡',   parents: [{ role: '父', name: '西本励照' }, { role: '母', name: '西本倫実' }] },
  { id: 'm20', number: 20, name: '宮﨑朔太郎', parents: [{ role: '父', name: '竜史郎' }, { role: '母', name: '有子' }] },
  { id: 'm30', number: 30, name: '横山寛人',   nameKana: 'よこやまひろと', parents: [{ role: '父', name: '横山大輔' }, { role: '母', name: 'よこやまえつこ' }] },
  { id: 'm31', number: 31, name: '鈴木柊羽',   nameKana: 'しゅう', parents: [{ role: '母', name: 'しおり' }] },
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
  matches: LegacySchMatch[];
}

/** Migrate old schedules + matches into unified events array */
function migrateToEvents(schedules: SchSchedule[], matches: LegacySchMatch[]): SchEvent[] {
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
    } else {
      // 保護者データが未設定のメンバーにDEFAULT_MEMBERSのデータを補完
      const needsUpdate = members.some(m => !m.parents || m.parents.length === 0);
      if (needsUpdate) {
        members = members.map(m => {
          if (m.parents && m.parents.length > 0) return m;
          const def = DEFAULT_MEMBERS.find(d => d.number === m.number);
          return def ? { ...def, ...m, name: def.name, nameKana: m.nameKana || def.nameKana, parents: def.parents } : m;
        });
        await redis.set(KEYS.members, members);
      }
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
      const matches = (matchesRaw as LegacySchMatch[]) ?? [];
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
      matches:        (matchesRaw as LegacySchMatch[]) ?? [],
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

export async function GET(req: Request) {
  const data = await readSchData();
  logAccess({ ts: new Date().toISOString(), type: 'team', page: '/sch', ip: getIp(req), ua: getUa(req) });
  return NextResponse.json(data);
}

const ACTION_LABELS: Record<string, string> = {
  events: 'イベント保存',
  announcements: 'お知らせ保存',
  members: 'メンバー変更',
  parkingRecords: '駐車場記録',
  parkingRotation: '駐車場ローテーション更新',
  nearbyParking: '近隣駐車場変更',
  teamLogo: 'チームロゴ変更',
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function matchEventChanged(a: SchEvent, b: SchEvent): boolean {
  return (
    a.date !== b.date ||
    a.endDate !== b.endDate ||
    a.startTime !== b.startTime ||
    a.location !== b.location ||
    a.matchType !== b.matchType ||
    a.label !== b.label ||
    a.meetingTime !== b.meetingTime ||
    a.meetingPlace !== b.meetingPlace ||
    a.opponentName !== b.opponentName ||
    JSON.stringify(a.matches) !== JSON.stringify(b.matches)
  );
}

function formatMatchAnnouncement(event: SchEvent): { title: string; content: string } | null {
  const d = event.date;
  const dateObj = new Date(d.replace(/\//g, '-') + 'T00:00:00');
  let dateStr = `${d}（${WEEKDAYS[dateObj.getDay()]}）`;
  if (event.endDate && event.endDate !== event.date) {
    const endObj = new Date(event.endDate.replace(/\//g, '-') + 'T00:00:00');
    dateStr += ` 〜 ${event.endDate}（${WEEKDAYS[endObj.getDay()]}）`;
  }

  const lines: string[] = [];
  lines.push(`📅 日時：${dateStr}${event.startTime ? ' ' + event.startTime : ''}`);
  if (event.location)     lines.push(`📍 場所：${event.location}`);
  if (event.matchType)    lines.push(`⚽ 種別：${event.matchType}`);
  if (event.label)        lines.push(`🏆 大会名：${event.label}`);
  if (event.meetingTime)  lines.push(`⏰ 集合：${event.meetingTime}${event.meetingPlace ? ' ' + event.meetingPlace : ''}`);

  const ms = event.matches;
  if (ms && ms.length > 0) {
    if (ms.length === 1) {
      const m = ms[0];
      const homeAway = m.isHome !== undefined ? (m.isHome ? '（ホーム）' : '（アウェイ）') : '';
      lines.push(`🆚 相手：${m.opponentName || '相手未定'}${homeAway}`);
    } else {
      lines.push('🆚 試合：');
      ms.forEach(m => {
        const label = m.roundName || (m.dayNumber != null ? `${m.dayNumber}日目` : '');
        lines.push(`　${label ? label + ' ' : ''}vs ${m.opponentName || '相手未定'}`);
      });
    }
  } else if (event.opponentName) {
    const homeAway = event.isHome !== undefined ? (event.isHome ? '（ホーム）' : '（アウェイ）') : '';
    lines.push(`🆚 相手：${event.opponentName}${homeAway}`);
  }

  const opponents = ms && ms.length > 0
    ? ms.map(m => m.opponentName || '相手未定').join('・')
    : (event.opponentName || '');
  const title = `⚽ 試合のお知らせ：${d}${opponents ? ' vs ' + opponents : ''}`;

  return { title, content: lines.join('\n') };
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;

    // 試合イベント保存時、新規追加 or 日時/場所/相手が変わったら自動でお知らせを生成
    if ('events' in body) {
      const newEvents = body.events as SchEvent[];
      const existing = await readSchData();
      const oldEventMap = new Map(existing.events.map(e => [e.id, e]));

      const toAnnounce: SchAnnouncement[] = [];
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');

      for (const ev of newEvents.filter(e => e.type === 'match')) {
        const old = oldEventMap.get(ev.id);
        if (!old || matchEventChanged(old, ev)) {
          const fmt = formatMatchAnnouncement(ev);
          if (fmt) {
            toAnnounce.push({
              id: `auto-match-${ev.id}`,
              date: today,
              title: fmt.title,
              content: fmt.content,
              important: true,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      if (toAnnounce.length > 0) {
        const upsertIds = new Set(toAnnounce.map(a => a.id));
        body.announcements = [
          ...existing.announcements.filter(a => !upsertIds.has(a.id)),
          ...toAnnounce,
        ].sort((a, b) => b.date.localeCompare(a.date));
      }
    }

    await writeSchPartial(body);
    const actions = Object.keys(body).filter(k => k in ACTION_LABELS);
    if (actions.length > 0) {
      logChange({
        ts: new Date().toISOString(),
        action: actions[0],
        detail: actions.map(a => ACTION_LABELS[a] ?? a).join(', '),
        ip: getIp(req),
        ua: getUa(req),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

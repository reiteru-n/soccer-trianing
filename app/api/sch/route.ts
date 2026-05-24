import { NextResponse } from 'next/server';
import { SchSchedule, SchAnnouncement, SchMember, SchParkingRecord, SchNearbyParking, SchEvent, SchUpdateHistory, SchParkingComment, SchStandaloneVideo } from '@/lib/types';
import { sendPushToAll } from '@/lib/webpush';
import { sendLineMessage } from '@/lib/line';

// Legacy SchMatch shape (from sch:matches Redis key) — kept only for migration
type LegacySchMatch = { id: string; date: string; startTime?: string; opponent?: string; location?: string; homeScore?: number; awayScore?: number; isHome?: boolean; note?: string; };
import { logAccess, logChange, getIp, getUa, getDeviceId } from '@/lib/logger';

const KEYS = {
  events:            'sch:events',
  schedules:         'sch:schedules',
  matches:           'sch:matches',
  announcements:     'sch:announcements',
  members:           'sch:members',
  parkingRecords:    'sch:parking_records',
  parkingRotation:   'sch:parking_rotation',
  nearbyParking:     'sch:nearby_parking',
  parkingComments:   'sch:parking_comments',
  teamLogo:          'sch:team_logo',
  updateHistory:     'sch:update_history',
  standaloneVideos:  'sch:standalone_videos',
  videoThumbnails:   'sch:video_thumbnails',
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
  parkingComments: SchParkingComment[];
  teamLogo: string | null;
  updateHistory: SchUpdateHistory[];
  standaloneVideos: SchStandaloneVideo[];
  videoThumbnails: Record<string, string>;
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
           parkingRecordsRaw, parkingRotationRaw, nearbyParkingRaw, parkingCommentsRaw, teamLogoRaw, updateHistoryRaw, standaloneVideosRaw, videoThumbnailsRaw] =
      await redis.mget<unknown[]>(
        KEYS.events, KEYS.schedules, KEYS.matches, KEYS.announcements,
        KEYS.members, KEYS.parkingRecords, KEYS.parkingRotation,
        KEYS.nearbyParking, KEYS.parkingComments, KEYS.teamLogo, KEYS.updateHistory, KEYS.standaloneVideos, KEYS.videoThumbnails
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
      nearbyParking:   (nearbyParkingRaw  as SchNearbyParking[])  ?? [],
      parkingComments: (parkingCommentsRaw as SchParkingComment[]) ?? [],
      teamLogo:          (teamLogoRaw as string | null) ?? null,
      updateHistory:     (updateHistoryRaw as SchUpdateHistory[]) ?? [],
      standaloneVideos:  (standaloneVideosRaw as SchStandaloneVideo[]) ?? [],
      videoThumbnails:   (videoThumbnailsRaw as Record<string, string>) ?? {},
      schedules:         (schedulesRaw as SchSchedule[]) ?? [],
      matches:           (matchesRaw as LegacySchMatch[]) ?? [],
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
      parkingComments: [],
      teamLogo: null, updateHistory: [], standaloneVideos: [], videoThumbnails: {}, schedules: [], matches: [],
      ...data,
    };
  } catch {
    return {
      events: [], announcements: [],
      members: DEFAULT_MEMBERS,
      parkingRecords: [], parkingRotation: DEFAULT_ROTATION, nearbyParking: [],
      parkingComments: [],
      teamLogo: null, updateHistory: [], standaloneVideos: [], videoThumbnails: {}, schedules: [], matches: [],
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
    if ('nearbyParking'   in body) updates[KEYS.nearbyParking]   = body.nearbyParking;
    if ('parkingComments' in body) updates[KEYS.parkingComments] = body.parkingComments;
    if ('teamLogo'        in body) updates[KEYS.teamLogo]        = body.teamLogo;
    if ('updateHistory'    in body) updates[KEYS.updateHistory]    = body.updateHistory;
    if ('standaloneVideos' in body) updates[KEYS.standaloneVideos] = body.standaloneVideos;
    if ('videoThumbnails'  in body) updates[KEYS.videoThumbnails]  = body.videoThumbnails;
    // Legacy keys (still writable for backward compat)
    if ('schedules'        in body) updates[KEYS.schedules]        = body.schedules;
    if ('matches'          in body) updates[KEYS.matches]          = body.matches;
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
  logAccess({ ts: new Date().toISOString(), type: 'team', page: '/sch', ip: getIp(req), ua: getUa(req), device_id: getDeviceId(req) });
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
const SCH_URL = 'https://soccer-trianing.vercel.app/sch';

function dayOfWeek(dateStr: string): string {
  const d = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00');
  return WEEKDAYS[d.getDay()];
}

function matchEventChanged(a: SchEvent, b: SchEvent): boolean {
  return (
    a.type !== b.type ||
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

function matchScoreEntered(old: SchEvent, ev: SchEvent): boolean {
  const oldMs = old.matches ?? [];
  const newMs = ev.matches ?? [];
  const subScore = newMs.some(nm => {
    const om = oldMs.find(m => m.id === nm.id);
    return om ? om.homeScore == null && nm.homeScore != null : false;
  });
  const legacyScore = !ev.matches && old.homeScore == null && ev.homeScore != null;
  return subScore || legacyScore;
}

function scheduleChanged(a: SchEvent, b: SchEvent): boolean {
  return a.type !== b.type || a.date !== b.date || (a.endDate ?? '') !== (b.endDate ?? '') || a.startTime !== b.startTime || a.location !== b.location || a.label !== b.label;
}

function formatDateRange(ev: SchEvent): string {
  const wd = dayOfWeek(ev.date);
  if (ev.endDate && ev.endDate !== ev.date) {
    return `${ev.date}（${wd}）〜${ev.endDate}（${dayOfWeek(ev.endDate)}）`;
  }
  return `${ev.date}（${wd}）`;
}

const TYPE_LABEL: Record<string, string> = { practice: '練習', match: '試合', camp: '合宿', expedition: '遠征', off: 'OFF', other: 'その他' };

function lineEventMsg(ev: SchEvent, oldType?: string): string {
  const label = ev.label ?? (ev.matches?.[0]?.opponentName ? `vs ${ev.matches[0].opponentName}` : '');
  const typeChanged = oldType && oldType !== ev.type;
  const typeStr = typeChanged ? `${TYPE_LABEL[oldType] ?? oldType}→${TYPE_LABEL[ev.type] ?? ev.type}` : (TYPE_LABEL[ev.type] ?? ev.type);
  const lines = [`⚽ 【SCH】イベント情報更新`];
  lines.push(`📅 ${formatDateRange(ev)}${typeChanged ? ' ' + typeStr : ''}${label ? ' ' + label : ''}`);
  if (ev.startTime) lines.push(`⏰ ${ev.startTime}`);
  if (ev.location) lines.push(`📍 ${ev.location}`);
  if (ev.note) lines.push(`📝 ${ev.note}`);
  return lines.join('\n');
}

function lineResultMsg(ev: SchEvent): string {
  const wd = dayOfWeek(ev.date);
  const lines = [`🏆 【SCH】試合結果`];
  lines.push(`${ev.date}（${wd}）`);
  const scored = (ev.matches ?? []).filter(m => m.homeScore != null && m.awayScore != null);
  if (scored.length > 0) {
    scored.forEach(m => lines.push(`SCH ${m.homeScore} - ${m.awayScore} vs ${m.opponentName || '相手未定'}`));
  } else if (ev.homeScore != null && ev.awayScore != null) {
    lines.push(`SCH ${ev.homeScore} - ${ev.awayScore} vs ${ev.opponentName || '相手未定'}`);
  }
  return lines.join('\n');
}

function lineOffMsg(ev: SchEvent, oldType?: string): string {
  const changed = oldType && oldType !== 'off' ? `（${TYPE_LABEL[oldType] ?? oldType}→OFF）` : '';
  return `😴 【SCH】${formatDateRange(ev)}は休みになりました${changed}`;
}

function lineAnnouncementMsg(ann: SchAnnouncement, isNew: boolean): string {
  const prefix = isNew ? `📢 【SCH】${ann.title}` : `📝 【SCH】お知らせ更新：${ann.title}`;
  const preview = ann.content ? '\n' + ann.content.slice(0, 120) + (ann.content.length > 120 ? '…' : '') : '';
  return `${prefix}${preview}`;
}

function lineCheckItemsMsg(ann: SchAnnouncement): string {
  return `📝 【SCH】持ち物リストが更新されました：${ann.title}`;
}

function lineParkingMsg(): string {
  return `🚗 【SCH】駐車当番が更新されました`;
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
    const notifyLine = body.notifyLine === true;

    // 試合イベント保存時、新規追加 or 日時/場所/相手が変わったら自動でお知らせを生成
    let existing: Awaited<ReturnType<typeof readSchData>> | null = null;
    const changedMatchEvents: SchEvent[] = [];
    let oldEventMap = new Map<string, SchEvent>();

    // LINE用: 追加で追跡する変化
    const scoreEnteredEvents: SchEvent[] = [];
    const offChangedEvents: SchEvent[] = [];
    const nonMatchChangedEvents: SchEvent[] = [];

    if ('events' in body) {
      const newEvents = body.events as SchEvent[];
      existing = await readSchData();
      oldEventMap = new Map(existing.events.map(e => [e.id, e]));

      const toAnnounce: SchAnnouncement[] = [];
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');

      for (const ev of newEvents.filter(e => e.type === 'match')) {
        const old = oldEventMap.get(ev.id);
        if (!old || matchEventChanged(old, ev)) {
          changedMatchEvents.push(ev);
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
          ...toAnnounce,
          ...existing.announcements.filter(a => !upsertIds.has(a.id)),
        ];
      }

      // LINE用: スコア入力・OFF変更・非試合イベント変更の検知
      for (const ev of newEvents) {
        const old = oldEventMap.get(ev.id);
        if (ev.type === 'match' && old && matchScoreEntered(old, ev)) {
          scoreEnteredEvents.push(ev);
        }
        if (ev.type === 'off' && (!old || old.type !== 'off' || scheduleChanged(old, ev))) {
          offChangedEvents.push(ev);
        }
        if (ev.type !== 'match' && ev.type !== 'off') {
          if (!old || scheduleChanged(old, ev)) {
            nonMatchChangedEvents.push(ev);
          }
        }
      }
    }

    // お知らせの新規追加・編集を検出（Push通知 + LINE通知用）
    let newAnnouncementTitles: string[] = [];
    const editedAnns: SchAnnouncement[] = [];
    const checkItemsChangedAnns: SchAnnouncement[] = [];

    if ('announcements' in body) {
      const newAnns = body.announcements as SchAnnouncement[];
      if (!existing) existing = await readSchData();
      const oldAnnMap = new Map(existing.announcements.map(a => [a.id, a]));
      const oldIds = new Set(existing.announcements.map(a => a.id));

      // Push通知用（自動生成除く）
      newAnnouncementTitles = newAnns
        .filter(a => !oldIds.has(a.id) && !a.id.startsWith('auto-match-'))
        .map(a => a.title);

      // LINE用: 編集検知（自動生成除く）
      for (const ann of newAnns) {
        if (ann.id.startsWith('auto-match-')) continue;
        const old = oldAnnMap.get(ann.id);
        if (!old) continue;
        if (old.content !== ann.content || old.title !== ann.title) {
          editedAnns.push(ann);
        } else if (JSON.stringify(old.checkItems) !== JSON.stringify(ann.checkItems)) {
          checkItemsChangedAnns.push(ann);
        }
      }
    }

    await writeSchPartial(body);

    // Web Push通知送信（fire & forget）
    if (changedMatchEvents.length > 0) {
      const ev = changedMatchEvents[0];
      const label = ev.label ?? (ev.matches?.[0]?.opponentName ? `vs ${ev.matches[0].opponentName}` : '試合');
      await sendPushToAll({
        title: `⚽ 試合情報が更新されました`,
        body: `${ev.date} ${label}`,
        url: '/sch',
      }).catch(() => {});
    } else if (newAnnouncementTitles.length > 0) {
      const title = newAnnouncementTitles[0].replace(/^[^\s]+\s/, '').slice(0, 50);
      await sendPushToAll({
        title: `📢 ${newAnnouncementTitles[0]}`,
        body: title !== newAnnouncementTitles[0] ? title : 'SCH Info をご確認ください',
        url: '/sch',
      }).catch(() => {});
    }

    // LINE通知送信（fire & forget、notifyLine === true の場合のみ）
    if (notifyLine) {
      // 優先度順に1件送信: お知らせ新規 > お知らせ編集 > 持ち物リスト > 試合結果 > 試合情報 > OFF > 非試合イベント > 駐車
      let lineMsg: string | null = null;

      if (!lineMsg && newAnnouncementTitles.length > 0) {
        const ann = (body.announcements as SchAnnouncement[])?.find(a => a.title === newAnnouncementTitles[0]);
        if (ann) lineMsg = lineAnnouncementMsg(ann, true);
      }
      if (!lineMsg && editedAnns.length > 0) {
        lineMsg = lineAnnouncementMsg(editedAnns[0], false);
      }
      if (!lineMsg && checkItemsChangedAnns.length > 0) {
        lineMsg = lineCheckItemsMsg(checkItemsChangedAnns[0]);
      }
      if (!lineMsg && scoreEnteredEvents.length > 0) {
        lineMsg = lineResultMsg(scoreEnteredEvents[0]);
      }
      if (!lineMsg && changedMatchEvents.length > 0) {
        const ev = changedMatchEvents[0];
        const old = oldEventMap.get(ev.id);
        if (!old || !matchScoreEntered(old, ev)) {
          lineMsg = lineEventMsg(ev, old?.type);
        }
      }
      if (!lineMsg && offChangedEvents.length > 0) {
        const ev = offChangedEvents[0];
        lineMsg = lineOffMsg(ev, oldEventMap.get(ev.id)?.type);
      }
      if (!lineMsg && nonMatchChangedEvents.length > 0) {
        const ev = nonMatchChangedEvents[0];
        lineMsg = lineEventMsg(ev, oldEventMap.get(ev.id)?.type);
      }
      if (!lineMsg && 'parkingRecords' in body) {
        lineMsg = lineParkingMsg();
      }

      if (lineMsg) await sendLineMessage(lineMsg).catch(() => {});
      // debug: store detection result to Redis
      const debugInfo = { ts: new Date().toISOString(), notifyLine, lineMsg, offChanged: offChangedEvents.length, matchChanged: changedMatchEvents.length, nonMatchChanged: nonMatchChangedEvents.length, scoreEntered: scoreEnteredEvents.length, oldTypes: offChangedEvents.map(e => oldEventMap.get(e.id)?.type), newTypes: offChangedEvents.map(e => e.type) };
      if (hasRedis()) getRedis().then(r => r.set('sch:line_debug', debugInfo)).catch(() => {});
    } else {
      // notifyLine was false - log that too
      if (hasRedis()) getRedis().then(r => r.set('sch:line_debug', { ts: new Date().toISOString(), notifyLine: false, note: 'notifyLine was not true', bodyKeys: Object.keys(body) })).catch(() => {});
    }

    const actions = Object.keys(body).filter(k => k in ACTION_LABELS);
    if (actions.length > 0) {
      logChange({
        ts: new Date().toISOString(),
        action: actions[0],
        detail: actions.map(a => ACTION_LABELS[a] ?? a).join(', '),
        ip: getIp(req),
        ua: getUa(req),
        device_id: getDeviceId(req),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { SchEvent } from '@/lib/types';

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** "yyyy/mm/dd" → "YYYYMMDD" */
function toIcsDate(dateStr: string): string {
  return dateStr.replace(/\//g, '');
}

/** "yyyy/mm/dd" + "HH:MM" (JST) → "YYYYMMDDTHHmmssZ" (UTC) */
function toIcsDatetime(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('/').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, h - 9, min));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
}

/** "yyyy/mm/dd" の翌日を "YYYYMMDD" で返す（終日イベントの DTEND 用） */
function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

function eventSummary(e: SchEvent): string {
  switch (e.type) {
    case 'practice':   return e.label ?? '練習';
    case 'camp':       return e.label ?? '合宿';
    case 'expedition': return e.label ?? '遠征';
    case 'other':      return e.label ?? 'その他';
    case 'match': {
      const parts: string[] = ['試合'];
      if (e.matchType) parts.push(`(${e.matchType})`);
      if (e.matches && e.matches.length > 0) {
        const opponents = e.matches.map(m => m.opponentName).filter(Boolean);
        if (opponents.length) parts.push(`vs ${opponents.join('・')}`);
      } else if (e.opponentName) {
        parts.push(`vs ${e.opponentName}`);
      }
      return parts.join(' ');
    }
    default: return e.label ?? 'SCH予定';
  }
}

function eventDescription(e: SchEvent): string {
  const lines: string[] = [];
  if (e.meetingTime)  lines.push(`集合時間: ${e.meetingTime}`);
  if (e.meetingPlace) lines.push(`集合場所: ${e.meetingPlace}`);
  if (e.note)         lines.push(e.note);
  if (e.memo)         lines.push(e.memo);
  return lines.join('\n');
}

function buildVEvent(e: SchEvent): string {
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`UID:${e.id}@soccer-trianing.vercel.app`);

  // DTSTART / DTEND
  if (e.startTime) {
    lines.push(`DTSTART:${toIcsDatetime(e.date, e.startTime)}`);
    if (e.endTime) {
      lines.push(`DTEND:${toIcsDatetime(e.endDate ?? e.date, e.endTime)}`);
    } else {
      lines.push('DURATION:PT2H');
    }
  } else {
    // 終日イベント
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(e.date)}`);
    const end = e.endDate ? nextDay(e.endDate) : nextDay(e.date);
    lines.push(`DTEND;VALUE=DATE:${end}`);
  }

  lines.push(`SUMMARY:${icsEscape(eventSummary(e))}`);

  if (e.location) {
    lines.push(`LOCATION:${icsEscape(e.location)}`);
  }

  const desc = eventDescription(e);
  if (desc) {
    lines.push(`DESCRIPTION:${icsEscape(desc)}`);
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export async function GET() {
  let events: SchEvent[] = [];

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = await getRedis();
    const raw = await redis.get<SchEvent[]>('sch:events');
    events = raw ?? [];
  } else {
    // ローカル開発: dev-sch.json から読む
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'dev-sch.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      events = data.events ?? [];
    } catch {
      events = [];
    }
  }

  const vevents = events.map(buildVEvent).join('\r\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SCH FC//Team Calendar//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SCHチームカレンダー',
    'X-WR-CALDESC:SCH FC チームスケジュール',
    'X-WR-TIMEZONE:Asia/Tokyo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sch-calendar.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  });
}

'use client';

import { useMemo } from 'react';

export interface ScheduleRulerItem {
  id: string;
  date: Date;
  label: string; // ツールチップ用
  isPast: boolean;
}

interface Props {
  items: ScheduleRulerItem[];
  todayDate: Date;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 予定一覧の左側に配置する縦カレンダー目盛り。
 * 上ほど未来、下ほど過去（一覧の並び順と対応）。今日の位置に目立つ横線を引く。
 * 一覧全体の高さいっぱいに伸びる（flex stretchで自然に高さが揃う）。
 */
export default function ScheduleCalendarRuler({ items, todayDate }: Props) {
  const { ticks, dots, todayPct } = useMemo(() => {
    const allTimes = [...items.map((it) => it.date.getTime()), todayDate.getTime()];
    const newestMs = Math.max(...allTimes);
    const oldestMs = Math.min(...allTimes);
    const totalMs = Math.max(1, newestMs - oldestMs);

    const pctOf = (ms: number) => Math.min(100, Math.max(0, ((newestMs - ms) / totalMs) * 100));

    const dots = items.map((it) => ({
      key: it.id,
      pct: pctOf(it.date.getTime()),
      title: `${formatDate(it.date)}\n${it.label}`,
      isPast: it.isPast,
    }));

    // 月初ごとの目盛り
    const newestDate = new Date(newestMs);
    const oldestDate = new Date(oldestMs);
    const tickList: { key: string; label: string; pct: number }[] = [];
    let cursor = new Date(newestDate.getFullYear(), newestDate.getMonth(), 1);
    const lowerBound = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 1).getTime();
    let prevYear: number | null = null;
    let guard = 0;
    while (cursor.getTime() >= lowerBound && guard < 240) {
      guard++;
      const year = cursor.getFullYear();
      const month = cursor.getMonth() + 1;
      const label = prevYear !== null && prevYear !== year ? `${year}年${month}月` : `${month}月`;
      tickList.push({ key: `${year}-${month}`, label, pct: pctOf(cursor.getTime()) });
      prevYear = year;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    }
    return { ticks: tickList, dots, todayPct: pctOf(todayDate.getTime()) };
  }, [items, todayDate]);

  return (
    <div className="relative w-14 flex-shrink-0 self-stretch">
      {/* 縦のライン */}
      <div className="absolute right-2 top-0 bottom-0 w-px bg-white/15" />
      {ticks.map((t) => (
        <div
          key={t.key}
          className="absolute right-0 flex items-center gap-1 -translate-y-1/2"
          style={{ top: `${t.pct}%` }}
        >
          <span className="text-[9px] text-slate-400/70 whitespace-nowrap">{t.label}</span>
          <span className="w-1.5 h-px bg-white/30 flex-shrink-0" />
        </div>
      ))}
      {dots.map((d) => (
        <span
          key={d.key}
          title={d.title}
          className={`absolute right-2 w-2 h-2 rounded-full -translate-y-1/2 translate-x-1/2 shadow-sm ${
            d.isPast ? 'bg-slate-500 border border-slate-400/50' : 'bg-emerald-400 border border-emerald-200/60'
          }`}
          style={{ top: `${d.pct}%` }}
        />
      ))}
      {/* 今日の位置を示す目立つ横線 */}
      <div
        className="absolute left-0 right-0 flex items-center -translate-y-1/2 pointer-events-none"
        style={{ top: `${todayPct}%` }}
      >
        <span className="text-[9px] font-bold text-amber-300 whitespace-nowrap">今日</span>
        <span className="flex-1 h-0.5 bg-amber-400 ml-0.5" />
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';

export interface RulerItem {
  id: string;
  date: Date;
  label: string; // ツールチップ用（タイトル等）
}

interface Props {
  items: RulerItem[];
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 動画一覧の左側に配置する縦カレンダー目盛り。
 * 新しい日付ほど上、古い日付ほど下（一覧の並び順と対応）。
 * 一覧全体の高さいっぱいに伸びる（flex stretchで自然に高さが揃う）ので、
 * 各動画の実際の日付に応じた位置(%)にドットを打つだけで済む。
 */
export default function VideoCalendarRuler({ items }: Props) {
  const { ticks, dots } = useMemo(() => {
    if (items.length === 0) return { ticks: [], dots: [] };
    const times = items.map((it) => it.date.getTime());
    const newestMs = Math.max(...times);
    const oldestMs = Math.min(...times);
    const totalMs = Math.max(1, newestMs - oldestMs);

    const pctOf = (ms: number) => Math.min(100, Math.max(0, ((newestMs - ms) / totalMs) * 100));

    const dots = items.map((it) => ({
      key: it.id,
      pct: pctOf(it.date.getTime()),
      title: `${formatDate(it.date)}\n${it.label}`,
    }));

    // 月初ごとの目盛り（新しい月→古い月の順に生成、範囲を1か月分広めに取る）
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
    return { ticks: tickList, dots };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="relative w-14 flex-shrink-0 self-stretch" aria-hidden={false}>
      {/* 縦のライン */}
      <div className="absolute right-2 top-0 bottom-0 w-px bg-white/15" />
      {ticks.map((t) => (
        <div
          key={t.key}
          className="absolute right-0 flex items-center gap-1 -translate-y-1/2"
          style={{ top: `${t.pct}%` }}
        >
          <span className="text-[9px] text-blue-300/60 whitespace-nowrap">{t.label}</span>
          <span className="w-1.5 h-px bg-white/30 flex-shrink-0" />
        </div>
      ))}
      {dots.map((d) => (
        <span
          key={d.key}
          title={d.title}
          className="absolute right-2 w-2 h-2 rounded-full bg-amber-400 border border-amber-200/60 -translate-y-1/2 translate-x-1/2 shadow-sm"
          style={{ top: `${d.pct}%` }}
        />
      ))}
    </div>
  );
}

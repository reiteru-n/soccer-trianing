'use client';

import { useEffect, useState, type RefObject } from 'react';

export interface ScheduleRulerItem {
  id: string;
  date: Date;
  label: string; // ツールチップ用
  isPast: boolean;
}

interface Props {
  items: ScheduleRulerItem[];
  // 一覧側のコンテナ。各行に data-ruler-id={item.id}、今日の区切り線に data-ruler-today を
  // 付けておくと、実際に描画された位置(offsetTop)を測ってドット/目盛りを揃える。
  containerRef: RefObject<HTMLDivElement | null>;
}

interface Dot {
  id: string;
  label: string;
  isPast: boolean;
  pct: number;
  ms: number;
}

/**
 * 予定一覧の左側に配置する縦カレンダー目盛り。
 * 日付の間隔だけで位置を計算すると、カード1件あたりの高さがバラバラなため
 * 実際の一覧の行位置とズレてしまう。そのため各行の実際のDOM位置(offsetTop)を
 * 測定し、それに合わせてドット・今日の線を配置する（月ラベルはドット間を日付で補間）。
 */
export default function ScheduleCalendarRuler({ items, containerRef }: Props) {
  const [dots, setDots] = useState<Dot[]>([]);
  const [todayPct, setTodayPct] = useState<number | null>(null);
  const [ticks, setTicks] = useState<{ key: string; label: string; pct: number }[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const totalHeight = container.scrollHeight;
      if (totalHeight <= 0) return;

      const nextDots: Dot[] = [];
      for (const item of items) {
        const el = container.querySelector<HTMLElement>(`[data-ruler-id="${CSS.escape(item.id)}"]`);
        if (!el) continue;
        const top = el.offsetTop + el.offsetHeight / 2;
        nextDots.push({ id: item.id, label: item.label, isPast: item.isPast, pct: (top / totalHeight) * 100, ms: item.date.getTime() });
      }
      nextDots.sort((a, b) => a.pct - b.pct);
      setDots(nextDots);

      const todayEl = container.querySelector<HTMLElement>('[data-ruler-today]');
      setTodayPct(todayEl ? ((todayEl.offsetTop + todayEl.offsetHeight / 2) / totalHeight) * 100 : null);

      // 月初の目盛りは、前後にある実測ドットの間を日付比率で補間して位置を決める
      if (nextDots.length >= 2) {
        const newest = new Date(nextDots[0].ms);
        const oldest = new Date(nextDots[nextDots.length - 1].ms);
        const tickList: { key: string; label: string; pct: number }[] = [];
        let cursor = new Date(newest.getFullYear(), newest.getMonth(), 1);
        const lowerBound = new Date(oldest.getFullYear(), oldest.getMonth(), 1).getTime();
        let prevYear: number | null = null;
        let guard = 0;
        while (cursor.getTime() >= lowerBound && guard < 240) {
          guard++;
          const ms = cursor.getTime();
          // ms を挟む2つの実測ドットを探して線形補間
          let before = nextDots[0];
          let after = nextDots[nextDots.length - 1];
          for (let i = 0; i < nextDots.length - 1; i++) {
            if (nextDots[i].ms >= ms && nextDots[i + 1].ms <= ms) {
              before = nextDots[i];
              after = nextDots[i + 1];
              break;
            }
          }
          const span = before.ms - after.ms;
          const pct = span !== 0 ? before.pct + ((before.ms - ms) / span) * (after.pct - before.pct) : before.pct;
          const year = cursor.getFullYear();
          const month = cursor.getMonth() + 1;
          const label = prevYear !== null && prevYear !== year ? `${year}年${month}月` : `${month}月`;
          tickList.push({ key: `${year}-${month}`, label, pct: Math.min(100, Math.max(0, pct)) });
          prevYear = year;
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
        }
        setTicks(tickList);
      } else {
        setTicks([]);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    // カードの展開/折りたたみ等、内容の変化でも高さが変わるため合わせて監視する
    const mo = new MutationObserver(measure);
    mo.observe(container, { childList: true, subtree: true, attributes: true });

    return () => { ro.disconnect(); mo.disconnect(); };
  }, [items, containerRef]);

  return (
    <div className="relative w-14 flex-shrink-0 self-stretch">
      <div className="absolute right-2 top-0 bottom-0 w-px bg-white/15" />
      {ticks.map((t) => (
        <div key={t.key} className="absolute right-0 flex items-center gap-1 -translate-y-1/2" style={{ top: `${t.pct}%` }}>
          <span className="text-[9px] text-slate-400/70 whitespace-nowrap">{t.label}</span>
          <span className="w-1.5 h-px bg-white/30 flex-shrink-0" />
        </div>
      ))}
      {dots.map((d) => (
        <span
          key={d.id}
          title={d.label}
          className={`absolute right-2 w-2 h-2 rounded-full -translate-y-1/2 translate-x-1/2 shadow-sm ${
            d.isPast ? 'bg-slate-500 border border-slate-400/50' : 'bg-emerald-400 border border-emerald-200/60'
          }`}
          style={{ top: `${d.pct}%` }}
        />
      ))}
      {todayPct !== null && (
        <div className="absolute left-0 right-0 flex items-center -translate-y-1/2 pointer-events-none" style={{ top: `${todayPct}%` }}>
          <span className="text-[9px] font-bold text-amber-300 whitespace-nowrap">今日</span>
          <span className="flex-1 h-0.5 bg-amber-400 ml-0.5" />
        </div>
      )}
    </div>
  );
}

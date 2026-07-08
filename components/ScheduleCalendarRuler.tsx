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
 * 測定し、それに合わせてドット・今日の線を配置する。
 * 月ラベルは「架空の月初日の位置を日付比率で補間する」と、一覧に時間差分の空白がない
 * （カードは隙間なく並ぶだけ）ため実際の行位置と大きくズレる。そのため、月が変わる
 * 最初の実イベントの実測位置にそのままラベルを置く方式にする（补間しない＝ズレない）。
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

      // 月ラベルは「その月最初の実イベント」の実測位置にそのまま置く（補間しないのでズレない）
      const tickList: { key: string; label: string; pct: number }[] = [];
      let prevKey: string | null = null;
      let prevYear: number | null = null;
      for (const d of nextDots) {
        const dt = new Date(d.ms);
        const year = dt.getFullYear();
        const month = dt.getMonth() + 1;
        const key = `${year}-${month}`;
        if (key === prevKey) continue;
        const label = prevYear !== null && prevYear !== year ? `${year}年${month}月` : `${month}月`;
        tickList.push({ key, label, pct: d.pct });
        prevKey = key;
        prevYear = year;
      }
      setTicks(tickList);
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

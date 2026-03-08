'use client';

import { PracticeNote } from '@/lib/types';

interface Props {
  notes: PracticeNote[];
  activeCategory?: string;
  activeLocation?: string;
  onSelectCategory?: (cat: string) => void;
  onSelectLocation?: (cat: string, loc: string) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; activeBg: string; badge: string; activeBadge: string; text: string; ring: string }> = {
  'チーム練習':   { bg: 'bg-blue-50',   activeBg: 'bg-blue-100',   badge: 'bg-blue-600',   activeBadge: 'bg-blue-700',   text: 'text-blue-700',   ring: 'ring-blue-400' },
  'スクール':     { bg: 'bg-green-50',  activeBg: 'bg-green-100',  badge: 'bg-green-600',  activeBadge: 'bg-green-700',  text: 'text-green-700',  ring: 'ring-green-400' },
  '試合':         { bg: 'bg-red-50',    activeBg: 'bg-red-100',    badge: 'bg-red-600',    activeBadge: 'bg-red-700',    text: 'text-red-700',    ring: 'ring-red-400' },
  '自主練':       { bg: 'bg-orange-50', activeBg: 'bg-orange-100', badge: 'bg-orange-500', activeBadge: 'bg-orange-600', text: 'text-orange-700', ring: 'ring-orange-400' },
  'セレクション': { bg: 'bg-purple-50', activeBg: 'bg-purple-100', badge: 'bg-purple-600', activeBadge: 'bg-purple-700', text: 'text-purple-700', ring: 'ring-purple-400' },
};
const DEFAULT_COLOR = { bg: 'bg-gray-50', activeBg: 'bg-gray-100', badge: 'bg-gray-500', activeBadge: 'bg-gray-600', text: 'text-gray-700', ring: 'ring-gray-400' };

export default function PracticeStats({ notes, activeCategory, activeLocation, onSelectCategory, onSelectLocation }: Props) {
  if (notes.length === 0) return null;

  const map = new Map<string, Map<string, { count: number; lastDate: string }>>();
  for (const n of notes) {
    const cat = n.category || '未分類';
    if (!map.has(cat)) map.set(cat, new Map());
    const loc = n.location || '不明';
    const cur = map.get(cat)!.get(loc) ?? { count: 0, lastDate: '' };
    map.get(cat)!.set(loc, {
      count: cur.count + 1,
      lastDate: n.date > cur.lastDate ? n.date : cur.lastDate,
    });
  }

  const categories = [...map.entries()].sort((a, b) => {
    const ta = [...a[1].values()].reduce((s, v) => s + v.count, 0);
    const tb = [...b[1].values()].reduce((s, v) => s + v.count, 0);
    return tb - ta;
  });

  return (
    <div className="space-y-3">
      {categories.map(([cat, locMap]) => {
        const total = [...locMap.values()].reduce((s, v) => s + v.count, 0);
        const color = CATEGORY_COLORS[cat] ?? DEFAULT_COLOR;
        const locs = [...locMap.entries()].sort((a, b) => b[1].count - a[1].count);
        const isCatActive = activeCategory === cat && !activeLocation;

        return (
          <div key={cat} className={`rounded-2xl border border-gray-100 p-4 transition-all ${isCatActive ? color.activeBg + ' ring-2 ' + color.ring : color.bg}`}>
            <button
              onClick={() => onSelectCategory?.(cat)}
              className="flex items-center justify-between w-full mb-2"
            >
              <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${isCatActive ? color.activeBadge : color.badge}`}>{cat}</span>
              <span className={`text-base font-extrabold ${color.text}`}>計 {total}回</span>
            </button>
            <div className="space-y-1">
              {locs.map(([loc, { count, lastDate }]) => {
                const isLocActive = activeCategory === cat && activeLocation === loc;
                return (
                  <button
                    key={loc}
                    onClick={() => onSelectLocation?.(cat, loc)}
                    className={`w-full flex items-center rounded-lg px-3 py-1.5 gap-2 transition-all active:scale-98 ${isLocActive ? 'bg-white ring-2 ' + color.ring : 'bg-white/70 hover:bg-white/90'}`}
                  >
                    <span className="text-sm text-gray-700 truncate flex-1 text-left">{loc}</span>
                    <span className="text-xs text-gray-400">{lastDate}</span>
                    <span className={`text-sm font-bold ${color.text} w-8 text-right`}>{count}回</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

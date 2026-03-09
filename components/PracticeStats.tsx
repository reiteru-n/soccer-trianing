'use client';

import { PracticeNote } from '@/lib/types';

interface Props {
  notes: PracticeNote[];
  activeCategory?: string;
  activeLocation?: string;
  onSelectCategory?: (cat: string) => void;
  onSelectLocation?: (cat: string, loc: string) => void;
}

function normalizeCategory(c?: string): string {
  if (c === 'チーム練習' || c === 'スクール') return 'チーム/スクール';
  return c || '未分類';
}

type ColorDef = { bg: string; activeBg: string; badge: string; activeBadge: string; text: string; ring: string };
const CATEGORY_COLORS: Record<string, ColorDef> = {
  'チーム/スクール': { bg: 'bg-blue-50',   activeBg: 'bg-blue-100',   badge: 'bg-blue-600',   activeBadge: 'bg-blue-700',   text: 'text-blue-700',   ring: 'ring-blue-400' },
  '試合':           { bg: 'bg-red-50',    activeBg: 'bg-red-100',    badge: 'bg-red-600',    activeBadge: 'bg-red-700',    text: 'text-red-700',    ring: 'ring-red-400' },
  '自主練':         { bg: 'bg-orange-50', activeBg: 'bg-orange-100', badge: 'bg-orange-500', activeBadge: 'bg-orange-600', text: 'text-orange-700', ring: 'ring-orange-400' },
  'セレクション':   { bg: 'bg-purple-50', activeBg: 'bg-purple-100', badge: 'bg-purple-600', activeBadge: 'bg-purple-700', text: 'text-purple-700', ring: 'ring-purple-400' },
  'その他':         { bg: 'bg-gray-50',   activeBg: 'bg-gray-100',   badge: 'bg-gray-500',   activeBadge: 'bg-gray-600',   text: 'text-gray-700',   ring: 'ring-gray-400' },
};
const DEFAULT_COLOR: ColorDef = { bg: 'bg-gray-50', activeBg: 'bg-gray-100', badge: 'bg-gray-500', activeBadge: 'bg-gray-600', text: 'text-gray-700', ring: 'ring-gray-400' };

export default function PracticeStats({ notes, activeCategory, activeLocation, onSelectCategory, onSelectLocation }: Props) {
  if (notes.length === 0) return null;

  type GroupEntry = { primaryCategory: string; locMap: Map<string, { count: number; lastDate: string }> };
  const map = new Map<string, GroupEntry>();

  for (const n of notes) {
    const key = n.teamName || normalizeCategory(n.category);
    const cat = normalizeCategory(n.category);
    if (!map.has(key)) map.set(key, { primaryCategory: cat, locMap: new Map() });
    const entry = map.get(key)!;
    const loc = n.location || '不明';
    const cur = entry.locMap.get(loc) ?? { count: 0, lastDate: '' };
    entry.locMap.set(loc, { count: cur.count + 1, lastDate: n.date > cur.lastDate ? n.date : cur.lastDate });
  }

  const groups = [...map.entries()].sort((a, b) => {
    const ta = [...a[1].locMap.values()].reduce((s, v) => s + v.count, 0);
    const tb = [...b[1].locMap.values()].reduce((s, v) => s + v.count, 0);
    return tb - ta;
  });

  return (
    <div className="space-y-3">
      {groups.map(([key, { primaryCategory, locMap }]) => {
        const total = [...locMap.values()].reduce((s, v) => s + v.count, 0);
        const color = CATEGORY_COLORS[primaryCategory] ?? DEFAULT_COLOR;
        const locs = [...locMap.entries()].sort((a, b) => b[1].count - a[1].count);
        const isCatActive = activeCategory === key && !activeLocation;
        const isTeamName = key !== primaryCategory;

        return (
          <div key={key} className={`rounded-2xl border border-gray-100 p-4 transition-all ${isCatActive ? color.activeBg + ' ring-2 ' + color.ring : color.bg}`}>
            <button
              onClick={() => onSelectCategory?.(key)}
              className="flex items-center justify-between w-full mb-2"
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${isCatActive ? color.activeBadge : color.badge}`}>{key}</span>
                {isTeamName && (
                  <span className="text-xs text-gray-400 bg-white/70 px-1.5 py-0.5 rounded-full">{primaryCategory}</span>
                )}
              </div>
              <span className={`text-base font-extrabold ${color.text}`}>計 {total}回</span>
            </button>
            <div className="space-y-1">
              {locs.map(([loc, { count, lastDate }]) => {
                const isLocActive = activeCategory === key && activeLocation === loc;
                return (
                  <button
                    key={loc}
                    onClick={() => onSelectLocation?.(key, loc)}
                    className={`w-full flex items-center rounded-lg px-3 py-1.5 gap-2 transition-all ${isLocActive ? 'bg-white ring-2 ' + color.ring : 'bg-white/70 hover:bg-white/90'}`}
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

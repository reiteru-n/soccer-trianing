'use client';

import { PracticeNote } from '@/lib/types';

interface Props {
  notes: PracticeNote[];
}

const CATEGORY_COLORS: Record<string, { bg: string; badge: string; text: string }> = {
  'チーム練習': { bg: 'bg-blue-50',   badge: 'bg-blue-600',   text: 'text-blue-700' },
  'スクール':   { bg: 'bg-green-50',  badge: 'bg-green-600',  text: 'text-green-700' },
  '試合':       { bg: 'bg-red-50',    badge: 'bg-red-600',    text: 'text-red-700' },
  '自主練':     { bg: 'bg-orange-50', badge: 'bg-orange-500', text: 'text-orange-700' },
};
const DEFAULT_COLOR = { bg: 'bg-gray-50', badge: 'bg-gray-500', text: 'text-gray-700' };

export default function PracticeStats({ notes }: Props) {
  if (notes.length === 0) return null;

  // category → location → count
  const map = new Map<string, Map<string, number>>();
  for (const n of notes) {
    const cat = n.category || '未分類';
    if (!map.has(cat)) map.set(cat, new Map());
    const loc = n.location || '不明';
    map.get(cat)!.set(loc, (map.get(cat)!.get(loc) ?? 0) + 1);
  }

  // sort categories by total count desc
  const categories = [...map.entries()].sort((a, b) => {
    const ta = [...a[1].values()].reduce((s, v) => s + v, 0);
    const tb = [...b[1].values()].reduce((s, v) => s + v, 0);
    return tb - ta;
  });

  return (
    <div className="space-y-3">
      {categories.map(([cat, locMap]) => {
        const total = [...locMap.values()].reduce((s, v) => s + v, 0);
        const color = CATEGORY_COLORS[cat] ?? DEFAULT_COLOR;
        const locs = [...locMap.entries()].sort((a, b) => b[1] - a[1]);

        return (
          <div key={cat} className={`rounded-2xl border ${color.bg} border-gray-100 p-4`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${color.badge}`}>{cat}</span>
              </div>
              <span className={`text-base font-extrabold ${color.text}`}>計 {total}回</span>
            </div>
            <div className="space-y-1">
              {locs.map(([loc, count]) => (
                <div key={loc} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-1.5">
                  <span className="text-sm text-gray-700 truncate flex-1">{loc}</span>
                  <span className={`text-sm font-bold ${color.text} ml-2`}>{count}回</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

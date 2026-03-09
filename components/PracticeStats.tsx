'use client';

import { useState } from 'react';
import { PracticeNote } from '@/lib/types';

interface Props {
  notes: PracticeNote[];
  activeCategory?: string;
  activeLocation?: string;
  onSelectCategory?: (cat: string) => void;
  onSelectLocation?: (cat: string, loc: string) => void;
}

type ColorDef = { bg: string; activeBg: string; badge: string; activeBadge: string; text: string; ring: string };
const CATEGORY_COLORS: Record<string, ColorDef> = {
  'チーム練習':   { bg: 'bg-blue-50',   activeBg: 'bg-blue-100',   badge: 'bg-blue-600',   activeBadge: 'bg-blue-700',   text: 'text-blue-700',   ring: 'ring-blue-400' },
  'スクール':     { bg: 'bg-green-50',  activeBg: 'bg-green-100',  badge: 'bg-green-600',  activeBadge: 'bg-green-700',  text: 'text-green-700',  ring: 'ring-green-400' },
  '試合':         { bg: 'bg-red-50',    activeBg: 'bg-red-100',    badge: 'bg-red-600',    activeBadge: 'bg-red-700',    text: 'text-red-700',    ring: 'ring-red-400' },
  '自主練':       { bg: 'bg-orange-50', activeBg: 'bg-orange-100', badge: 'bg-orange-500', activeBadge: 'bg-orange-600', text: 'text-orange-700', ring: 'ring-orange-400' },
  'セレクション': { bg: 'bg-purple-50', activeBg: 'bg-purple-100', badge: 'bg-purple-600', activeBadge: 'bg-purple-700', text: 'text-purple-700', ring: 'ring-purple-400' },
  'その他':       { bg: 'bg-gray-50',   activeBg: 'bg-gray-100',   badge: 'bg-gray-500',   activeBadge: 'bg-gray-600',   text: 'text-gray-700',   ring: 'ring-gray-400' },
};
const DEFAULT_COLOR: ColorDef = { bg: 'bg-gray-50', activeBg: 'bg-gray-100', badge: 'bg-gray-500', activeBadge: 'bg-gray-600', text: 'text-gray-700', ring: 'ring-gray-400' };

const CATEGORY_ORDER = ['チーム練習', 'スクール', '試合', '自主練', 'セレクション', 'その他'];

export default function PracticeStats({ notes, activeCategory, activeLocation, onSelectCategory, onSelectLocation }: Props) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(notes.map((n) => n.teamName || n.category || '未分類'))
  );

  if (notes.length === 0) return null;

  type GroupEntry = { primaryCategory: string; locMap: Map<string, { count: number; lastDate: string }> };
  const map = new Map<string, GroupEntry>();

  for (const n of notes) {
    const cat = n.category || '未分類';
    const key = n.teamName || cat;
    if (!map.has(key)) map.set(key, { primaryCategory: cat, locMap: new Map() });
    const entry = map.get(key)!;
    const loc = n.location || '不明';
    const cur = entry.locMap.get(loc) ?? { count: 0, lastDate: '' };
    entry.locMap.set(loc, { count: cur.count + 1, lastDate: n.date > cur.lastDate ? n.date : cur.lastDate });
  }

  const groups = [...map.entries()].sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a[1].primaryCategory);
    const catB = CATEGORY_ORDER.indexOf(b[1].primaryCategory);
    const oa = catA === -1 ? CATEGORY_ORDER.length : catA;
    const ob = catB === -1 ? CATEGORY_ORDER.length : catB;
    if (oa !== ob) return oa - ob;
    const ta = [...a[1].locMap.values()].reduce((s, v) => s + v.count, 0);
    const tb = [...b[1].locMap.values()].reduce((s, v) => s + v.count, 0);
    return tb - ta;
  });

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {groups.map(([key, { primaryCategory, locMap }]) => {
        const total = [...locMap.values()].reduce((s, v) => s + v.count, 0);
        const color = CATEGORY_COLORS[primaryCategory] ?? DEFAULT_COLOR;
        const locs = [...locMap.entries()].sort((a, b) => b[1].count - a[1].count);
        const isCatActive = activeCategory === key && !activeLocation;
        const isTeamName = key !== primaryCategory;
        const isExpanded = expandedKeys.has(key);

        return (
          <div key={key} className={`rounded-2xl border border-gray-100 transition-all ${isCatActive ? color.activeBg + ' ring-2 ' + color.ring : color.bg}`}>
            {/* ヘッダー行 */}
            <div className="flex items-center px-4 py-3 gap-2">
              {/* 左：バッジ＋区分 → タップで絞り込み */}
              <button
                onClick={() => onSelectCategory?.(key)}
                className="flex items-center gap-1.5 flex-1 min-w-0"
              >
                <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${isCatActive ? color.activeBadge : color.badge}`}>{key}</span>
                {isTeamName && (
                  <span className="text-xs text-gray-400 bg-white/70 px-1.5 py-0.5 rounded-full flex-shrink-0">{primaryCategory}</span>
                )}
              </button>
              {/* 右：詳細トグル＋回数 */}
              <button
                onClick={() => toggleExpand(key)}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                <span className={`text-xs font-medium ${color.text}`}>{isExpanded ? '▲' : '▼'} 詳細</span>
                <span className={`text-base font-extrabold ${color.text}`}>計 {total}回</span>
              </button>
            </div>

            {/* 展開時：場所一覧 */}
            {isExpanded && (
              <div className="px-4 pb-3 space-y-1">
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
            )}
          </div>
        );
      })}
    </div>
  );
}

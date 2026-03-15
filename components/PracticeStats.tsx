'use client';

import { useState } from 'react';
import { PracticeNote } from '@/lib/types';
import NoteCard from './NoteCard';

interface Props {
  notes: PracticeNote[];
  activeCategory?: string;
  activeLocation?: string;
  onSelectCategory?: (cat: string) => void;
  onSelectLocation?: (cat: string, loc: string) => void;
  onDeleteNote?: (id: string) => void;
  onEditNote?: (note: PracticeNote) => void;
  onToggleImprovement?: (noteId: string, index: number) => void;
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

export function makeGroupKey(teamName: string | undefined, category: string): string {
  return `${teamName ?? ''}##${category}`;
}

export function parseGroupKey(key: string): { teamName: string; category: string } {
  const sep = key.indexOf('##');
  if (sep === -1) return { teamName: key, category: key };
  return { teamName: key.slice(0, sep), category: key.slice(sep + 2) };
}

export default function PracticeStats({ notes, onDeleteNote, onEditNote, onToggleImprovement }: Props) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  if (notes.length === 0) return null;

  type GroupEntry = { teamName: string; category: string; notes: PracticeNote[] };
  const map = new Map<string, GroupEntry>();

  for (const n of notes) {
    const cat = n.category || 'その他';
    const key = makeGroupKey(n.teamName, cat);
    if (!map.has(key)) map.set(key, { teamName: n.teamName ?? '', category: cat, notes: [] });
    map.get(key)!.notes.push(n);
  }

  const groups = [...map.entries()].sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a[1].category);
    const catB = CATEGORY_ORDER.indexOf(b[1].category);
    const oa = catA === -1 ? CATEGORY_ORDER.length : catA;
    const ob = catB === -1 ? CATEGORY_ORDER.length : catB;
    if (oa !== ob) return oa - ob;
    return b[1].notes.length - a[1].notes.length;
  });

  // カテゴリ別合計
  const catTotals = new Map<string, number>();
  for (const n of notes) {
    const cat = n.category || 'その他';
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + 1);
  }
  const catSummary = CATEGORY_ORDER.filter((c) => catTotals.has(c)).map((c) => ({ cat: c, count: catTotals.get(c)! }));

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* カテゴリ別合計サマリー */}
      <div className="flex flex-wrap gap-2 pb-1">
        {catSummary.map(({ cat, count }) => {
          const color = CATEGORY_COLORS[cat] ?? DEFAULT_COLOR;
          return (
            <span key={cat} className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${color.badge} text-white`}>
              {cat} <span className="font-normal opacity-90">{count}回</span>
            </span>
          );
        })}
      </div>

      {groups.map(([key, { teamName, category, notes: groupNotes }]) => {
        const total = groupNotes.length;
        const color = CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
        const displayName = teamName || category;
        const showCategoryBadge = !!teamName;
        const isExpanded = expandedKeys.has(key);
        const sorted = [...groupNotes].sort((a, b) => b.date.localeCompare(a.date));

        return (
          <div key={key} className={`rounded-2xl border border-gray-100 overflow-hidden ${color.bg}`}>
            {/* ヘッダー行 */}
            <button
              onClick={() => toggleExpand(key)}
              className="w-full flex items-center px-4 py-3 gap-2"
            >
              <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${color.badge}`}>{displayName}</span>
              {showCategoryBadge && (
                <span className="text-xs text-gray-400 bg-white/70 px-1.5 py-0.5 rounded-full flex-shrink-0">{category}</span>
              )}
              <span className={`text-base font-extrabold ${color.text} ml-auto`}>計 {total}回</span>
              <span className={`text-xs font-medium ${color.text}`}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {/* 展開時：NoteCard一覧 */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {sorted.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onDelete={onDeleteNote}
                    onEdit={onEditNote}
                    onToggleImprovement={onToggleImprovement}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

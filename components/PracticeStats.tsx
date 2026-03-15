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

type ColorDef = { bg: string; badge: string; text: string; ring: string; teamBg: string };
const CATEGORY_COLORS: Record<string, ColorDef> = {
  'チーム練習':   { bg: 'bg-blue-50',   badge: 'bg-blue-600',   text: 'text-blue-700',   ring: 'ring-blue-300',   teamBg: 'bg-blue-100/60' },
  'スクール':     { bg: 'bg-green-50',  badge: 'bg-green-600',  text: 'text-green-700',  ring: 'ring-green-300',  teamBg: 'bg-green-100/60' },
  '試合':         { bg: 'bg-red-50',    badge: 'bg-red-600',    text: 'text-red-700',    ring: 'ring-red-300',    teamBg: 'bg-red-100/60' },
  '自主練':       { bg: 'bg-orange-50', badge: 'bg-orange-500', text: 'text-orange-700', ring: 'ring-orange-300', teamBg: 'bg-orange-100/60' },
  'セレクション': { bg: 'bg-purple-50', badge: 'bg-purple-600', text: 'text-purple-700', ring: 'ring-purple-300', teamBg: 'bg-purple-100/60' },
  'その他':       { bg: 'bg-gray-50',   badge: 'bg-gray-500',   text: 'text-gray-700',   ring: 'ring-gray-300',   teamBg: 'bg-gray-100/60' },
};
const DEFAULT_COLOR: ColorDef = { bg: 'bg-gray-50', badge: 'bg-gray-500', text: 'text-gray-700', ring: 'ring-gray-300', teamBg: 'bg-gray-100/60' };
const CATEGORY_ORDER = ['チーム練習', 'スクール', '試合', '自主練', 'セレクション', 'その他'];

export function makeGroupKey(teamName: string | undefined, category: string): string {
  return `${teamName ?? ''}##${category}`;
}

export function parseGroupKey(key: string): { teamName: string; category: string } {
  const sep = key.indexOf('##');
  if (sep === -1) return { teamName: key, category: key };
  return { teamName: key.slice(0, sep), category: key.slice(sep + 2) };
}

type LocEntry = { count: number; lastDate: string; notes: PracticeNote[] };
type TeamEntry = { total: number; locs: Map<string, LocEntry> };
type CatEntry  = { total: number; teams: Map<string, TeamEntry> };

export default function PracticeStats({ notes, onDeleteNote, onEditNote, onToggleImprovement }: Props) {
  const [expandedCats,  setExpandedCats]  = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedLocs,  setExpandedLocs]  = useState<Set<string>>(new Set());

  if (notes.length === 0) return null;

  // 3階層データ構築
  const catMap = new Map<string, CatEntry>();
  for (const n of notes) {
    const cat  = n.category || 'その他';
    const team = n.teamName || '（名前なし）';
    const loc  = n.location || '不明';

    if (!catMap.has(cat)) catMap.set(cat, { total: 0, teams: new Map() });
    const catEntry = catMap.get(cat)!;
    catEntry.total++;

    if (!catEntry.teams.has(team)) catEntry.teams.set(team, { total: 0, locs: new Map() });
    const teamEntry = catEntry.teams.get(team)!;
    teamEntry.total++;

    if (!teamEntry.locs.has(loc)) teamEntry.locs.set(loc, { count: 0, lastDate: '', notes: [] });
    const locEntry = teamEntry.locs.get(loc)!;
    locEntry.count++;
    locEntry.lastDate = n.date > locEntry.lastDate ? n.date : locEntry.lastDate;
    locEntry.notes.push(n);
  }

  const cats = CATEGORY_ORDER
    .filter((c) => catMap.has(c))
    .map((c) => ({ cat: c, ...catMap.get(c)! }));

  const toggle = (set: Set<string>, key: string): Set<string> => {
    const s = new Set(set); s.has(key) ? s.delete(key) : s.add(key); return s;
  };

  return (
    <div className="space-y-2">
      {cats.map(({ cat, total, teams }) => {
        const color = CATEGORY_COLORS[cat] ?? DEFAULT_COLOR;
        const isCatOpen = expandedCats.has(cat);
        const teamList = [...teams.entries()].sort((a, b) => b[1].total - a[1].total);

        return (
          <div key={cat} className={`rounded-2xl border border-gray-100 overflow-hidden ${color.bg}`}>
            {/* 区分行 */}
            <button
              onClick={() => setExpandedCats((p) => toggle(p, cat))}
              className="w-full flex items-center px-4 py-3 gap-2"
            >
              <span className={`text-white text-xs font-bold px-2.5 py-1 rounded-full ${color.badge}`}>{cat}</span>
              <span className={`text-base font-extrabold ${color.text} ml-auto`}>計 {total}回</span>
              <span className={`text-xs font-medium ${color.text}`}>{isCatOpen ? '▲' : '▼'}</span>
            </button>

            {/* チーム/スクール一覧 */}
            {isCatOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                {teamList.map(([team, teamEntry]) => {
                  const teamKey = `${cat}::${team}`;
                  const isTeamOpen = expandedTeams.has(teamKey);
                  const locList = [...teamEntry.locs.entries()].sort((a, b) => b[1].count - a[1].count);

                  return (
                    <div key={team} className={`rounded-xl overflow-hidden border border-white/60 ${color.teamBg}`}>
                      {/* チーム行 */}
                      <button
                        onClick={() => setExpandedTeams((p) => toggle(p, teamKey))}
                        className="w-full flex items-center px-3 py-2 gap-2"
                      >
                        <span className="text-sm font-semibold text-gray-700 flex-1 text-left truncate">{team}</span>
                        <span className={`text-sm font-bold ${color.text}`}>{teamEntry.total}回</span>
                        <span className={`text-xs ${color.text}`}>{isTeamOpen ? '▲' : '▼'}</span>
                      </button>

                      {/* 場所一覧 */}
                      {isTeamOpen && (
                        <div className="px-3 pb-2 space-y-1.5">
                          {locList.map(([loc, locEntry]) => {
                            const locKey = `${teamKey}::${loc}`;
                            const isLocOpen = expandedLocs.has(locKey);
                            const sorted = [...locEntry.notes].sort((a, b) => b.date.localeCompare(a.date));

                            return (
                              <div key={loc}>
                                {/* 場所行 */}
                                <button
                                  onClick={() => setExpandedLocs((p) => toggle(p, locKey))}
                                  className={`w-full flex items-center rounded-lg px-3 py-2 gap-2 bg-white/80 ${isLocOpen ? 'ring-2 ' + color.ring : ''}`}
                                >
                                  <span className="text-sm text-gray-700 flex-1 text-left truncate">📍 {loc}</span>
                                  <span className="text-xs text-gray-400">{locEntry.lastDate}</span>
                                  <span className={`text-sm font-bold ${color.text} w-8 text-right`}>{locEntry.count}回</span>
                                  <span className={`text-xs ${color.text}`}>{isLocOpen ? '▲' : '▼'}</span>
                                </button>

                                {/* ノート一覧 */}
                                {isLocOpen && (
                                  <div className="mt-2 space-y-2">
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
                      )}
                    </div>
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

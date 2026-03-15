'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import NoteCard from '@/components/NoteCard';
import NoteForm from '@/components/NoteForm';
import PracticeStats, { parseGroupKey } from '@/components/PracticeStats';
import PracticeBarChart from '@/components/PracticeBarChart';
import { PracticeNote } from '@/lib/types';

export default function NotesPage() {
  const { practiceNotes, addPracticeNote, updatePracticeNote, deletePracticeNote, toggleImprovementItem, liftingRecords, isLoading } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<PracticeNote | null>(null);
  const [showUndoneOnly, setShowUndoneOnly] = useState(false);
  const [groupByLocation, setGroupByLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [activeLocation, setActiveLocation] = useState<string | undefined>();
  const [showStats, setShowStats] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const scrollToId = searchParams.get('scroll');

  useEffect(() => {
    if (!scrollToId || isLoading) return;
    const el = document.getElementById(`note-${scrollToId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
      setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2'), 2000);
    }
  }, [scrollToId, isLoading]);

  const sorted = useMemo(
    () => [...practiceNotes].sort((a, b) => b.date.localeCompare(a.date)),
    [practiceNotes]
  );

  const filtered = useMemo(() => {
    let base = showUndoneOnly ? sorted.filter((n) => n.improvements.some((i) => !i.done)) : sorted;

    // まとめからの絞り込み（優先）
    if (activeCategory) {
      const { teamName: filterTeam, category: filterCat } = parseGroupKey(activeCategory);
      base = base.filter((n) => {
        const noteTeam = n.teamName ?? '';
        const noteCat = n.category || 'その他';
        return noteTeam === filterTeam && noteCat === filterCat;
      });
      if (activeLocation) {
        base = base.filter((n) => (n.location || '不明') === activeLocation);
      }
      return base;
    }

    // テキスト検索
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((n) =>
      n.location.toLowerCase().includes(q) ||
      (n.teamName ?? '').toLowerCase().includes(q) ||
      (n.category ?? '').toLowerCase().includes(q) ||
      n.date.includes(q) ||
      n.goodPoints.toLowerCase().includes(q) ||
      n.improvements.some((i) => i.text.toLowerCase().includes(q))
    );
  }, [sorted, showUndoneOnly, searchQuery, activeCategory, activeLocation]);

  const undoneCount = sorted.filter((n) => n.improvements.some((i) => !i.done)).length;

  const grouped = useMemo(() => {
    if (!groupByLocation) return null;
    const map = new Map<string, PracticeNote[]>();
    for (const n of filtered) {
      const loc = n.location || '不明';
      if (!map.has(loc)) map.set(loc, []);
      map.get(loc)!.push(n);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, groupByLocation]);

  const pastLocations = [...new Set([
    ...practiceNotes.map((n) => n.location),
    ...liftingRecords.map((r) => r.location),
  ])];
  const pastCategories = [...new Set(practiceNotes.map((n) => n.category).filter(Boolean) as string[])];
  const pastTeamNames = [...new Set(practiceNotes.map((n) => n.teamName).filter(Boolean) as string[])];

  const handleEditSave = (data: Omit<PracticeNote, 'id'>) => {
    if (editingNote) {
      updatePracticeNote(editingNote.id, data);
      setEditingNote(null);
    }
  };

  const scrollToList = () => {
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleSelectCategory = (cat: string) => {
    if (activeCategory === cat && !activeLocation) {
      setActiveCategory(undefined);
      setActiveLocation(undefined);
    } else {
      setActiveCategory(cat);
      setActiveLocation(undefined);
      setSearchQuery('');
      scrollToList();
    }
  };

  const handleSelectLocation = (cat: string, loc: string) => {
    if (activeCategory === cat && activeLocation === loc) {
      setActiveCategory(undefined);
      setActiveLocation(undefined);
    } else {
      setActiveCategory(cat);
      setActiveLocation(loc);
      setSearchQuery('');
      scrollToList();
    }
  };

  const clearFilter = () => {
    setActiveCategory(undefined);
    setActiveLocation(undefined);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  const noteCardProps = (note: PracticeNote) => ({
    note,
    onDelete: deletePracticeNote,
    onEdit: (n: PracticeNote) => setEditingNote(n),
    onToggleImprovement: toggleImprovementItem,
  });

  const hasFilter = !!activeCategory;
  const filterLabel = (() => {
    if (!activeCategory) return '';
    const { teamName, category } = parseGroupKey(activeCategory);
    return teamName ? `${teamName}（${category}）` : category;
  })();

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-800">📝 練習ノート</h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm text-gray-500">全{practiceNotes.length}回の練習記録</span>
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
            🏃 {practiceNotes.length}回練習
          </span>
        </div>
      </header>

      <section className="mb-5">
        <button
          onClick={() => setShowStats((v) => !v)}
          className="flex items-center justify-between w-full mb-3"
        >
          <h2 className="text-sm font-bold text-gray-700">📊 練習参加まとめ <span className="text-gray-400 font-normal text-xs">（タップで絞り込み）</span></h2>
          <span className="text-xs text-gray-400">{showStats ? '▲ 閉じる' : '▼ 開く'}</span>
        </button>
        {showStats && (
          <>
            <PracticeStats
              notes={practiceNotes}
              activeCategory={activeCategory}
              activeLocation={activeLocation}
              onSelectCategory={handleSelectCategory}
              onSelectLocation={handleSelectLocation}
            />
            {practiceNotes.length > 0 && (
              <div className="mt-3 bg-slate-800/80 rounded-2xl p-4 shadow-xl border border-white/10">
                <p className="text-xs font-semibold text-gray-400 mb-2">📅 月別練習回数</p>
                <PracticeBarChart notes={practiceNotes} />
              </div>
            )}
          </>
        )}
      </section>

      {/* 一覧セクション */}
      <div ref={listRef}>
        {/* アクティブフィルター表示 */}
        {hasFilter && (
          <div className="mb-3 flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 border border-blue-200">
            <span className="text-xs text-blue-700 flex-1">
              🔍 {filterLabel}{activeLocation ? ' > ' + activeLocation : ''} で絞り込み中 ({filtered.length}件)
            </span>
            <button onClick={clearFilter} className="text-xs text-blue-400 hover:text-blue-600 font-bold">✕ 解除</button>
          </div>
        )}

        {/* 検索（フィルター未使用時のみ） */}
        {!hasFilter && (
          <div className="mb-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 場所・区分・内容で検索..."
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none bg-white"
            />
            {searchQuery && (
              <p className="text-xs text-gray-400 mt-1 pl-1">{filtered.length}件ヒット</p>
            )}
          </div>
        )}

        {/* フィルター & グループ切替 */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setShowUndoneOnly(false)}
            className={"flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors " + (!showUndoneOnly ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-200 text-gray-600")}
          >
            すべて
          </button>
          <button
            onClick={() => setShowUndoneOnly(true)}
            className={"flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors " + (showUndoneOnly ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-gray-200 text-gray-600")}
          >
            💪 未改善
            {undoneCount > 0 && (
              <span className={"ml-1 text-xs px-1.5 py-0.5 rounded-full " + (showUndoneOnly ? "bg-white text-orange-500" : "bg-orange-100 text-orange-600")}>
                {undoneCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setGroupByLocation((v) => !v)}
            className={"flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors " + (groupByLocation ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600")}
          >
            📍 場所別
          </button>
        </div>

        {/* 一覧 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">{hasFilter || searchQuery ? '🔍' : showUndoneOnly ? '🎉' : '📓'}</p>
            <p className="text-sm">
              {hasFilter || searchQuery ? '該当するノートがありません' : showUndoneOnly ? 'すべての改善項目がクリア済みです！' : 'まだ練習ノートがありません'}
            </p>
          </div>
        ) : grouped ? (
          <div className="space-y-5">
            {grouped.map(([loc, notes]) => (
              <div key={loc}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-500">📍 {loc}</span>
                  <span className="text-xs text-gray-400">{notes.length}件</span>
                </div>
                <div className="space-y-3">
                  {notes.map((note) => <div key={note.id} id={`note-${note.id}`}><NoteCard {...noteCardProps(note)} /></div>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((note) => <div key={note.id} id={`note-${note.id}`}><NoteCard {...noteCardProps(note)} /></div>)}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-green-600 hover:bg-green-700 text-white text-2xl rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        title="ノートを追加"
      >
        ＋
      </button>

      {showForm && (
        <NoteForm
          onSave={addPracticeNote}
          onClose={() => setShowForm(false)}
          pastLocations={pastLocations}
          pastCategories={pastCategories}
          pastTeamNames={pastTeamNames}
        />
      )}
      {editingNote && (
        <NoteForm
          onSave={handleEditSave}
          onClose={() => setEditingNote(null)}
          pastLocations={pastLocations}
          pastCategories={pastCategories}
          pastTeamNames={pastTeamNames}
          initialValues={editingNote}
        />
      )}
    </>
  );
}

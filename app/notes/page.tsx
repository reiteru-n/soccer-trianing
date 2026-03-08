'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context';
import NoteCard from '@/components/NoteCard';
import NoteForm from '@/components/NoteForm';
import PracticeStats from '@/components/PracticeStats';
import { PracticeNote } from '@/lib/types';

export default function NotesPage() {
  const { practiceNotes, addPracticeNote, updatePracticeNote, deletePracticeNote, toggleImprovementItem, liftingRecords, isLoading } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<PracticeNote | null>(null);
  const [showUndoneOnly, setShowUndoneOnly] = useState(false);

  const sorted = [...practiceNotes].sort((a, b) => b.date.localeCompare(a.date));
  const displayed = showUndoneOnly
    ? sorted.filter((n) => n.improvements.some((i) => !i.done))
    : sorted;
  const undoneCount = sorted.filter((n) => n.improvements.some((i) => !i.done)).length;

  const pastLocations = [...new Set([
    ...practiceNotes.map((n) => n.location),
    ...liftingRecords.map((r) => r.location),
  ])];
  const pastCategories = [...new Set(practiceNotes.map((n) => n.category).filter(Boolean) as string[])];

  const handleEditSave = (data: Omit<PracticeNote, 'id'>) => {
    if (editingNote) {
      updatePracticeNote(editingNote.id, data);
      setEditingNote(null);
    }
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
        <h2 className="text-sm font-bold text-gray-700 mb-3">📊 練習参加まとめ</h2>
        <PracticeStats notes={practiceNotes} />
      </section>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setShowUndoneOnly(false)}
          className={"flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors " + (!showUndoneOnly ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-200 text-gray-600")}
        >
          すべて表示
        </button>
        <button
          onClick={() => setShowUndoneOnly(true)}
          className={"flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors " + (showUndoneOnly ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-gray-200 text-gray-600")}
        >
          💪 未改善のみ
          {undoneCount > 0 && (
            <span className={"ml-1.5 text-xs px-1.5 py-0.5 rounded-full " + (showUndoneOnly ? "bg-white text-orange-500" : "bg-orange-100 text-orange-600")}>
              {undoneCount}
            </span>
          )}
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">{showUndoneOnly ? '🎉' : '📓'}</p>
          <p className="text-sm">
            {showUndoneOnly ? 'すべての改善項目がクリア済みです！' : 'まだ練習ノートがありません'}
          </p>
          {!showUndoneOnly && <p className="text-xs mt-1">右下の ＋ ボタンで追加しよう！</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={deletePracticeNote}
              onEdit={(n) => setEditingNote(n)}
              onToggleImprovement={toggleImprovementItem}
            />
          ))}
        </div>
      )}

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
        />
      )}
      {editingNote && (
        <NoteForm
          onSave={handleEditSave}
          onClose={() => setEditingNote(null)}
          pastLocations={pastLocations}
          pastCategories={pastCategories}
          initialValues={editingNote}
        />
      )}
    </>
  );
}

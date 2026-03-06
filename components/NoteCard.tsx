'use client';

import { PracticeNote } from '@/lib/types';

interface Props {
  note: PracticeNote;
  onDelete?: (id: string) => void;
  onEdit?: (note: PracticeNote) => void;
  onToggleImprovement?: (noteId: string, index: number) => void;
}

export default function NoteCard({ note, onDelete, onEdit, onToggleImprovement }: Props) {
  const handleDelete = () => {
    if (!onDelete) return;
    if (window.confirm(`${note.date} ${note.location} のノートを削除してよいですか？`)) {
      onDelete(note.id);
    }
  };

  const doneCount = note.improvements.filter((i) => i.done).length;
  const totalCount = note.improvements.length;
  const allDone = doneCount === totalCount && totalCount > 0;

  return (
    <div className={`rounded-2xl border-2 bg-white shadow-sm overflow-hidden ${allDone ? 'border-green-200' : 'border-gray-100'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${allDone ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>📅 {note.date}</span>
          <span>·</span>
          <span>📍 {note.location}</span>
          {allDone && <span className="text-green-600 text-xs font-bold">✅ 改善済</span>}
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(note)}
              className="text-blue-300 hover:text-blue-500 text-sm"
              title="編集"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="text-gray-300 hover:text-red-400 text-sm"
              title="削除"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Good points */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <span className="text-green-500 text-lg mt-0.5">⭐</span>
          <div>
            <p className="text-xs font-bold text-green-700 mb-0.5">良かったところ</p>
            <p className="text-sm text-gray-700 leading-relaxed">{note.goodPoints}</p>
          </div>
        </div>
      </div>

      {/* Improvements */}
      <div className="px-4 pb-3 pt-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-orange-400 text-lg">💪</span>
          <p className="text-xs font-bold text-orange-600">
            改善したいところ
            {totalCount > 0 && (
              <span className="ml-1.5 text-gray-400 font-normal">
                ({doneCount}/{totalCount})
              </span>
            )}
          </p>
        </div>
        <div className="space-y-1.5 pl-7">
          {note.improvements.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onToggleImprovement?.(note.id, index)}
              className={`w-full flex items-start gap-2 text-left rounded-lg px-2 py-1.5 transition-colors ${
                onToggleImprovement ? 'hover:bg-orange-50 active:bg-orange-100' : ''
              }`}
            >
              <span className={`mt-0.5 text-base flex-shrink-0 ${item.done ? 'text-green-500' : 'text-gray-300'}`}>
                {item.done ? '✅' : '⬜'}
              </span>
              <span className={`text-sm leading-relaxed ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {item.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

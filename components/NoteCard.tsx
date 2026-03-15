'use client';

import { useRef, useState } from 'react';
import { PracticeNote } from '@/lib/types';

interface Props {
  note: PracticeNote;
  onDelete?: (id: string) => void;
  onEdit?: (note: PracticeNote) => void;
  onToggleImprovement?: (noteId: string, index: number) => void;
}

const SWIPE_THRESHOLD = 60;
const DELETE_REVEAL = 80;

export default function NoteCard({ note, onDelete, onEdit, onToggleImprovement }: Props) {
  const [offsetX, setOffsetX] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const revealed = offsetX <= -SWIPE_THRESHOLD;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff < 0) setOffsetX(Math.max(diff, -DELETE_REVEAL));
  };

  const handleTouchEnd = () => {
    if (offsetX < -SWIPE_THRESHOLD) {
      setOffsetX(-DELETE_REVEAL);
    } else {
      setOffsetX(0);
      setConfirmDelete(false);
    }
    touchStartX.current = null;
  };

  const handleClose = () => {
    setOffsetX(0);
    setConfirmDelete(false);
  };

  const doneCount = note.improvements.filter((i) => i.done).length;
  const totalCount = note.improvements.length;
  const allDone = doneCount === totalCount && totalCount > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 削除ボタン（背景） */}
      {onDelete && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: DELETE_REVEAL }}>
          {confirmDelete ? (
            <div className="flex flex-col w-full">
              <button
                onClick={() => onDelete(note.id)}
                className="flex-1 bg-red-600 text-white font-bold text-xs flex items-center justify-center"
              >
                削除
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-400 text-white font-bold text-xs flex items-center justify-center"
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full bg-red-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1"
            >
              <span className="text-xl">🗑️</span>
              <span>削除</span>
            </button>
          )}
        </div>
      )}

      {/* カード本体 */}
      <div
        className={`relative border-2 bg-white shadow-sm overflow-hidden rounded-2xl ${allDone ? 'border-green-200' : 'border-gray-100'}`}
        style={{ transform: `translateX(${offsetX}px)`, touchAction: 'pan-y', transition: touchStartX.current ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (revealed) handleClose(); }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b ${allDone ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
          <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
            <span className="whitespace-nowrap">📅 {note.date}</span>
            <span>·</span>
            {note.teamName && (
              <>
                <span className="font-semibold text-blue-700 truncate">🏫 {note.teamName}</span>
                <span>·</span>
              </>
            )}
            <span className="truncate">📍 {note.location}</span>
            {allDone && <span className="text-green-600 text-xs font-bold whitespace-nowrap">✅ 改善済</span>}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(note); }}
                className="text-blue-300 hover:text-blue-500 text-sm p-1"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); setOffsetX(-DELETE_REVEAL); }}
                className="text-gray-300 hover:text-red-400 text-sm p-1"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Good points */}
        {note.goodPoints && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start gap-2">
              <span className="text-green-500 text-lg mt-0.5">⭐</span>
              <div>
                <p className="text-xs font-bold text-green-700 mb-0.5">良かったところ</p>
                <p className="text-sm text-gray-700 leading-relaxed">{note.goodPoints}</p>
              </div>
            </div>
          </div>
        )}

        {/* Improvements */}
        {totalCount > 0 && (
          <div className="px-4 pb-3 pt-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-orange-400 text-lg">💪</span>
              <p className="text-xs font-bold text-orange-600">
                改善したいところ
                <span className="ml-1.5 text-gray-400 font-normal">({doneCount}/{totalCount})</span>
              </p>
            </div>
            <div className="space-y-1.5 pl-7">
              {note.improvements.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleImprovement?.(note.id, index); }}
                  className={`w-full flex items-start gap-2 text-left rounded-lg px-2 py-1.5 transition-colors ${onToggleImprovement ? 'hover:bg-orange-50 active:bg-orange-100' : ''}`}
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
        )}
      </div>
    </div>
  );
}

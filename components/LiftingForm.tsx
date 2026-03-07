'use client';

import { useState, useEffect, FormEvent } from 'react';
import { LiftingPart, LiftingSide, LiftingRecord } from '@/lib/types';

interface Props {
  onSave: (record: Omit<LiftingRecord, 'id'>) => void;
  onClose: () => void;
  pastLocations: string[];
  initialValues?: LiftingRecord;
}

const PARTS: LiftingPart[] = ['インステップ', 'インサイド', 'アウトサイド', 'もも', '頭'];
const SIDES: LiftingSide[] = ['左足', '右足', '両足'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default function LiftingForm({ onSave, onClose, pastLocations, initialValues }: Props) {
  const [date, setDate] = useState(initialValues?.date ?? todayStr());
  const [count, setCount] = useState(initialValues?.count?.toString() ?? '');
  const [location, setLocation] = useState(initialValues?.location ?? '');
  const [part, setPart] = useState<LiftingPart>(initialValues?.part ?? 'インステップ');
  const [side, setSide] = useState<LiftingSide>(initialValues?.side ?? '左足');

  useEffect(() => {
    if (part === '頭') setSide('両足');
  }, [part]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!count || !location || !date) return;
    onSave({ date, count: parseInt(count, 10), location, part, side });
    onClose();
  };

  const inputDate = date.replace(/\//g, '-');
  const onDateChange = (v: string) => setDate(v.replace(/-/g, '/'));
  const isEditing = !!initialValues;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl max-h-[calc(100vh-64px)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              {isEditing ? '✏️ リフティング記録を編集' : '⚽ リフティング記録を追加'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">📅 日付</label>
              <input
                type="date"
                value={inputDate}
                onChange={(e) => onDateChange(e.target.value)}
                required
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">🔢 回数</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="例: 100"
                required
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">📍 場所</label>
              <input
                list="locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 家"
                required
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-blue-400 focus:outline-none"
              />
              <datalist id="locations">
                {pastLocations.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">🦶 部位</label>
              <div className="flex flex-wrap gap-2">
                {PARTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPart(p)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
                      part === p
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {part !== '頭' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">↔️ 左右</label>
                <div className="flex gap-2">
                  {SIDES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(s)}
                      className={`flex-1 py-3 rounded-full text-sm font-semibold border-2 transition-colors ${
                        side === s
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-md"
            >
              {isEditing ? '💾 更新する' : '💾 記録する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

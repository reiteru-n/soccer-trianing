'use client';

import { useState, FormEvent } from 'react';
import { SprintRecord } from '@/lib/types';
import { EditIcon, TimerIcon, SaveIcon } from '@/components/AppIcons';

interface Props {
  onSave: (record: Omit<SprintRecord, 'id'>) => void;
  onClose: () => void;
  pastLocations: string[];
  pastMethods: string[];
  initialValues?: SprintRecord;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default function SprintForm({ onSave, onClose, pastLocations, pastMethods, initialValues }: Props) {
  const [date, setDate] = useState(initialValues?.date ?? todayStr());
  const [location, setLocation] = useState(initialValues?.location ?? '');
  const [method, setMethod] = useState(initialValues?.method ?? '');
  const [timeSeconds, setTimeSeconds] = useState(initialValues?.timeSeconds?.toString() ?? '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = parseFloat(timeSeconds);
    if (!date || !location || !method || isNaN(t) || t <= 0) return;
    onSave({ date, location, method, timeSeconds: t });
    onClose();
  };

  const inputDate = date.replace(/\//g, '-');
  const onDateChange = (v: string) => setDate(v.replace(/-/g, '/'));
  const isEditing = !!initialValues;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end pb-16 sm:pb-0 sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl max-h-[calc(100vh-64px)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {isEditing ? <EditIcon size={18} /> : <TimerIcon size={18} />}
              {isEditing ? '50m走記録を編集' : '50m走記録を追加'}
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
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-orange-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">⏱️ タイム（秒）</label>
              <input
                type="text"
                inputMode="decimal"
                value={timeSeconds}
                onChange={(e) => setTimeSeconds(e.target.value)}
                placeholder="例: 8.45"
                required
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-orange-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">📍 場所</label>
              <input
                list="sprint-locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 学校のグラウンド"
                required
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-orange-400 focus:outline-none"
              />
              <datalist id="sprint-locations">
                {pastLocations.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">📋 記録方法</label>
              <input
                list="sprint-methods"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="例: スマホのストップウォッチで手動計測"
                required
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-orange-400 focus:outline-none"
              />
              <datalist id="sprint-methods">
                {pastMethods.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-md"
            >
              <span className="inline-flex items-center gap-2"><SaveIcon size={18} />{isEditing ? '更新する' : '記録する'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

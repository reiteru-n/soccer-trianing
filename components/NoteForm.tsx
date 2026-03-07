'use client';

import { useState, FormEvent } from 'react';
import { PracticeNote, ImprovementItem } from '@/lib/types';

interface Props {
  onSave: (note: Omit<PracticeNote, 'id'>) => void;
  onClose: () => void;
  pastLocations: string[];
  pastCategories: string[];
  initialValues?: PracticeNote;
}

const PRESET_CATEGORIES = ['チーム練習', 'スクール', '自主練', '試合', 'その他'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default function NoteForm({ onSave, onClose, pastLocations, pastCategories, initialValues }: Props) {
  const [date, setDate] = useState(initialValues?.date ?? todayStr());
  const [location, setLocation] = useState(initialValues?.location ?? '');
  const [category, setCategory] = useState(initialValues?.category ?? '');
  const [goodPoints, setGoodPoints] = useState(initialValues?.goodPoints ?? '');
  const [improvementsText, setImprovementsText] = useState(
    initialValues?.improvements?.map((i) => i.text).join('\n') ?? ''
  );

  const allCategories = [...new Set([...PRESET_CATEGORIES, ...pastCategories])];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!location || !goodPoints || !improvementsText.trim()) return;

    const lines = improvementsText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const improvements: ImprovementItem[] = lines.map((text) => {
      const existing = initialValues?.improvements.find((i) => i.text === text);
      return { text, done: existing?.done ?? false };
    });

    onSave({ date, location, category, goodPoints, improvements });
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
              {isEditing ? '✏️ 練習ノートを編集' : '📝 練習ノートを追加'}
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
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-green-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">📍 場所</label>
              <input
                list="note-locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: リーフスタジアム"
                required
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-green-400 focus:outline-none"
              />
              <datalist id="note-locations">
                {pastLocations.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">🏷️ 練習区分</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(category === cat ? '' : cat)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                      category === cat
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={!PRESET_CATEGORIES.includes(category) ? category : ''}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="カスタム区分（自由入力）"
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-green-700 mb-1">⭐ 良かったところ</label>
              <textarea
                value={goodPoints}
                onChange={(e) => setGoodPoints(e.target.value)}
                placeholder="今日できたこと、うまくいったことを書こう！"
                required
                rows={4}
                className="w-full rounded-xl border-2 border-green-200 bg-green-50 px-3 py-3 text-base focus:border-green-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-orange-700 mb-1">💪 改善したいところ</label>
              <p className="text-xs text-gray-400 mb-1">1行ごとに1つの項目として登録されます</p>
              <textarea
                value={improvementsText}
                onChange={(e) => setImprovementsText(e.target.value)}
                placeholder={"例:\n周りをもっと見る\nシュートの足を振り切る"}
                required
                rows={4}
                className="w-full rounded-xl border-2 border-orange-200 bg-orange-50 px-3 py-3 text-base focus:border-orange-400 focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-md"
            >
              {isEditing ? '💾 更新する' : '💾 記録する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { SprintRecord } from '@/lib/types';
import { EditIcon, TrashIcon } from '@/components/AppIcons';

interface Props {
  records: SprintRecord[];
  onDelete?: (id: string) => void;
  onEdit?: (record: SprintRecord) => void;
}

const SHOW_COUNT = 10;

export default function SprintTable({ records, onDelete, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...records].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.id.localeCompare(a.id);
  });

  if (sorted.length === 0) {
    return <p className="text-center text-gray-400 py-8 text-sm">記録がありません</p>;
  }

  const hasActions = onDelete || onEdit;
  const visible = expanded ? sorted : sorted.slice(0, SHOW_COUNT);
  const remaining = sorted.length - SHOW_COUNT;

  const handleDelete = (r: SprintRecord) => {
    if (!onDelete) return;
    if (window.confirm(`${r.date} ${r.timeSeconds}秒 の記録を削除してよいですか？`)) {
      onDelete(r.id);
    }
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-orange-50 text-orange-800">
              <th className="px-3 py-2 text-left font-semibold">日付</th>
              <th className="px-3 py-2 text-right font-semibold">タイム</th>
              <th className="px-3 py-2 text-left font-semibold">場所</th>
              <th className="px-3 py-2 text-left font-semibold">記録方法</th>
              {hasActions && <th className="px-2 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.id} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2 text-right font-bold text-orange-700">{r.timeSeconds}秒</td>
                <td className="px-3 py-2 text-gray-600">{r.location}</td>
                <td className="px-3 py-2 text-gray-600">{r.method}</td>
                {hasActions && (
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(r)}
                          className="text-blue-400 hover:text-blue-600"
                          title="編集"
                        >
                          <EditIcon size={14} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => handleDelete(r)}
                          className="text-red-400 hover:text-red-600"
                          title="削除"
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > SHOW_COUNT && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-xs text-orange-500 font-semibold py-2 rounded-xl border border-orange-100 bg-orange-50 hover:bg-orange-100 transition-colors"
        >
          {expanded ? '▲ 閉じる' : `▼ もっと見る（残り${remaining}件）`}
        </button>
      )}
    </div>
  );
}

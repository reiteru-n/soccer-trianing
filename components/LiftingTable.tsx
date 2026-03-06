'use client';

import { useState } from 'react';
import { LiftingRecord, LiftingPart, LiftingSide } from '@/lib/types';

interface Props {
  records: LiftingRecord[];
  filterPart: LiftingPart | 'all';
  filterSide: LiftingSide | 'all';
  onDelete?: (id: string) => void;
  onEdit?: (record: LiftingRecord) => void;
}

const SHOW_COUNT = 10;

export default function LiftingTable({ records, filterPart, filterSide, onDelete, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);

  const filtered = records
    .filter((r) => (filterPart === 'all' || r.part === filterPart) && (filterSide === 'all' || r.side === filterSide))
    .sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.id.localeCompare(a.id);
    });

  if (filtered.length === 0) {
    return <p className="text-center text-gray-400 py-8 text-sm">記録がありません</p>;
  }

  const hasActions = onDelete || onEdit;
  const visible = expanded ? filtered : filtered.slice(0, SHOW_COUNT);
  const remaining = filtered.length - SHOW_COUNT;

  const handleDelete = (r: LiftingRecord) => {
    if (!onDelete) return;
    if (window.confirm(`${r.date} ${r.part}(${r.part === '頭' ? '-' : r.side}) ${r.count}回 を削除してよいですか？`)) {
      onDelete(r.id);
    }
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50 text-blue-800">
              <th className="px-3 py-2 text-left font-semibold">日付</th>
              <th className="px-3 py-2 text-right font-semibold">回数</th>
              <th className="px-3 py-2 text-left font-semibold">部位</th>
              <th className="px-3 py-2 text-left font-semibold">左右</th>
              <th className="px-3 py-2 text-left font-semibold">場所</th>
              {hasActions && <th className="px-2 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.id} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2 text-right font-bold text-blue-700">{r.count}</td>
                <td className="px-3 py-2 text-gray-700">{r.part}</td>
                <td className="px-3 py-2 text-gray-700">{r.part === '頭' ? '-' : r.side}</td>
                <td className="px-3 py-2 text-gray-600">{r.location}</td>
                {hasActions && (
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(r)}
                          className="text-blue-400 hover:text-blue-600 text-xs"
                          title="編集"
                        >
                          ✏️
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => handleDelete(r)}
                          className="text-red-400 hover:text-red-600 text-xs"
                          title="削除"
                        >
                          🗑️
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

      {filtered.length > SHOW_COUNT && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-xs text-blue-500 font-semibold py-2 rounded-xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          {expanded ? '▲ 閉じる' : `▼ もっと見る（残り${remaining}件）`}
        </button>
      )}
    </div>
  );
}

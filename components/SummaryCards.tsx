'use client';

import { LiftingRecord } from '@/lib/types';

interface Props {
  records: LiftingRecord[];
}

export default function SummaryCards({ records }: Props) {
  const maxCount = records.length > 0 ? Math.max(...records.map((r) => r.count)) : 0;
  const totalEntries = records.length;
  const instepLeft = records.filter((r) => r.part === 'インステップ' && r.side === '左足');
  const instepMax = instepLeft.length > 0 ? Math.max(...instepLeft.map((r) => r.count)) : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 rounded-2xl border-2 bg-red-50 border-red-200 p-4 flex items-center gap-4">
        <span className="text-4xl">🏆</span>
        <div>
          <p className="text-xs text-gray-500 font-medium">最高記録</p>
          <p className="text-3xl font-extrabold text-red-600">{maxCount}<span className="text-lg font-bold">回</span></p>
        </div>
      </div>
      <div className="rounded-2xl border-2 bg-blue-50 border-blue-200 p-4 flex flex-col gap-1">
        <span className="text-2xl">📅</span>
        <span className="text-xs text-gray-500 font-medium">記録回数</span>
        <span className="text-xl font-bold text-blue-600">{totalEntries}回</span>
      </div>
      <div className="rounded-2xl border-2 bg-orange-50 border-orange-200 p-4 flex flex-col gap-1">
        <span className="text-2xl">🔥</span>
        <span className="text-xs text-gray-500 font-medium">インステップ最高</span>
        <span className="text-xl font-bold text-orange-600">{instepMax}回</span>
      </div>
    </div>
  );
}

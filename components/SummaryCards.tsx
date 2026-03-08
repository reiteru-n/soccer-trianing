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
      <div className="col-span-2 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 p-4 flex items-center gap-4 shadow-lg shadow-red-900/40 border border-red-400/20">
        <span className="text-4xl">🏆</span>
        <div>
          <p className="text-xs text-red-100/80 font-medium">最高記録</p>
          <p className="text-3xl font-extrabold text-white">{maxCount}<span className="text-lg font-bold">回</span></p>
        </div>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 flex flex-col gap-1 shadow-lg shadow-blue-900/40 border border-blue-400/20">
        <span className="text-2xl">📅</span>
        <span className="text-xs text-blue-100/80 font-medium">記録回数</span>
        <span className="text-xl font-bold text-white">{totalEntries}回</span>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-4 flex flex-col gap-1 shadow-lg shadow-orange-900/40 border border-orange-400/20">
        <span className="text-2xl">🔥</span>
        <span className="text-xs text-orange-100/80 font-medium">インステップ最高</span>
        <span className="text-xl font-bold text-white">{instepMax}回</span>
      </div>
    </div>
  );
}

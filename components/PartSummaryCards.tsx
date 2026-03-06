'use client';

import { LiftingRecord, LiftingPart, LiftingSide } from '@/lib/types';

interface Props {
  records: LiftingRecord[];
}

const PARTS: LiftingPart[] = ['インステップ', 'インサイド', 'アウトサイド', 'もも', '頭'];
const SIDES: LiftingSide[] = ['左足', '右足', '両足'];

const PART_COLORS: Record<LiftingPart, { bg: string; border: string; badge: string; text: string }> = {
  インステップ: { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-600',   text: 'text-blue-700' },
  インサイド:   { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-600',  text: 'text-green-700' },
  アウトサイド: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-600', text: 'text-purple-700' },
  もも:         { bg: 'bg-pink-50',   border: 'border-pink-200',   badge: 'bg-pink-600',   text: 'text-pink-700' },
  頭:           { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-500', text: 'text-yellow-700' },
};

export default function PartSummaryCards({ records }: Props) {
  const activeParts = PARTS.filter((p) => records.some((r) => r.part === p));

  if (activeParts.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">記録がありません</p>;
  }

  return (
    <div className="space-y-3">
      {activeParts.map((part) => {
        const partRecords = records.filter((r) => r.part === part);
        const partMax = Math.max(...partRecords.map((r) => r.count));
        const color = PART_COLORS[part];

        const sideStats = SIDES.map((side) => {
          const sideRecords = partRecords.filter((r) => r.side === side);
          if (sideRecords.length === 0) return null;
          return {
            side,
            max: Math.max(...sideRecords.map((r) => r.count)),
            count: sideRecords.length,
          };
        }).filter(Boolean);

        return (
          <div key={part} className={`rounded-2xl border-2 ${color.bg} ${color.border} p-4`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${color.badge}`}>
                  {part}
                </span>
                <span className="text-xs text-gray-500">{partRecords.length}件</span>
              </div>
              <span className={`text-lg font-extrabold ${color.text}`}>最高 {partMax}回</span>
            </div>

            {/* Side breakdown */}
            <div className="flex gap-2 flex-wrap">
              {sideStats.map((stat) => stat && (
                <div key={stat.side} className="flex-1 min-w-[80px] bg-white/70 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-gray-500 font-medium">{stat.side}</p>
                  <p className={`text-base font-bold ${color.text}`}>{stat.max}回</p>
                  <p className="text-xs text-gray-400">{stat.count}件</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

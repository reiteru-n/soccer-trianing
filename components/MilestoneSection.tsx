'use client';

import { Milestone } from '@/lib/types';
import { MILESTONES } from '@/lib/data';

interface Props {
  milestones: Milestone[];
  maxCount: number;
}

const statusConfig = {
  achieved: {
    icon: '✅',
    label: '達成！',
    barColor: 'bg-green-500',
    textColor: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    animate: 'animate-pulse-once',
  },
  challenging: {
    icon: '⏳',
    label: 'チャレンジ中！',
    barColor: 'bg-orange-400',
    textColor: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    animate: '',
  },
  locked: {
    icon: '🔒',
    label: 'まだまだこれから！',
    barColor: 'bg-gray-300',
    textColor: 'text-gray-400',
    bg: 'bg-gray-50 border-gray-200',
    animate: '',
  },
};

export default function MilestoneSection({ milestones, maxCount }: Props) {
  const nextTarget = milestones.find((m) => m.status === 'challenging')?.target ?? MILESTONES[MILESTONES.length - 1];
  const prevTarget = (() => {
    const idx = MILESTONES.indexOf(nextTarget);
    return idx > 0 ? MILESTONES[idx - 1] : 0;
  })();
  const progressPct = Math.min(100, Math.round(((maxCount - prevTarget) / (nextTarget - prevTarget)) * 100));

  return (
    <div className="space-y-3">
      {/* Next challenge progress */}
      {milestones.some((m) => m.status === 'challenging') && (
        <div className="rounded-2xl bg-orange-50 border-2 border-orange-200 p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-orange-700">⏳ 次の目標: {nextTarget}回</span>
            <span className="text-sm font-bold text-orange-600">{maxCount} / {nextTarget}</span>
          </div>
          <div className="h-4 bg-orange-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-orange-500 mt-1 text-right">{progressPct}%</p>
        </div>
      )}

      {/* Milestone list */}
      <div className="space-y-2">
        {milestones.map(({ target, status }) => {
          const cfg = statusConfig[status];
          return (
            <div
              key={target}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 ${cfg.bg} ${cfg.animate}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{cfg.icon}</span>
                <span className={`font-bold text-lg ${status === 'locked' ? 'text-gray-400' : 'text-gray-700'}`}>
                  {target}回
                </span>
              </div>
              <span className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

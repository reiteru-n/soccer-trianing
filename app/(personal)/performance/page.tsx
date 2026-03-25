'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import PracticeBarChart from '@/components/PracticeBarChart';
import LiftingChart from '@/components/LiftingChart';
import { LiftingPart, LiftingSide } from '@/lib/types';

type Period = '1m' | '3m' | 'all';

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}

function subtractMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}

const PARTS: LiftingPart[] = ['インステップ', 'インサイド', 'アウトサイド', 'もも', '頭', '胸→足'];
const SIDES: LiftingSide[] = ['左足', '右足', '両足'];

export default function PerformancePage() {
  const { liftingRecords, practiceNotes, trainingLogs, trainingMenu, bodyRecords, maxCount, isLoading } = useApp();
  const [period, setPeriod] = useState<Period>('3m');

  const cutoff = period === '1m' ? subtractMonths(1) : period === '3m' ? subtractMonths(3) : '';

  const filteredLifting = useMemo(
    () => (cutoff ? liftingRecords.filter(r => r.date >= cutoff) : liftingRecords),
    [liftingRecords, cutoff]
  );
  const filteredNotes = useMemo(
    () => (cutoff ? practiceNotes.filter(n => n.date >= cutoff) : practiceNotes),
    [practiceNotes, cutoff]
  );
  const filteredLogs = useMemo(
    () => (cutoff ? trainingLogs.filter(l => l.date >= cutoff) : trainingLogs),
    [trainingLogs, cutoff]
  );

  // Practice days (unique dates across lifting + notes)
  const practiceDays = useMemo(() => {
    const dates = new Set([
      ...filteredLifting.map(r => r.date),
      ...filteredNotes.map(n => n.date),
    ]);
    return dates.size;
  }, [filteredLifting, filteredNotes]);

  // Best lifting per part (left foot inステップ first)
  const liftingBests = useMemo(() => {
    const bests: { part: LiftingPart; side: LiftingSide; count: number }[] = [];
    for (const part of PARTS) {
      for (const side of SIDES) {
        const recs = filteredLifting.filter(r => r.part === part && r.side === side);
        if (recs.length > 0) {
          const best = Math.max(...recs.map(r => r.count));
          bests.push({ part, side, count: best });
        }
      }
    }
    return bests;
  }, [filteredLifting]);

  // Training completion rate
  const completionRate = useMemo(() => {
    if (trainingMenu.length === 0 || filteredLogs.length === 0) return null;
    const complete = filteredLogs.filter(l =>
      trainingMenu.every(m => l.completedItemIds.includes(m.id))
    ).length;
    return Math.round((complete / filteredLogs.length) * 100);
  }, [filteredLogs, trainingMenu]);

  // Latest body
  const sortedBody = [...bodyRecords].sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = sortedBody.find(r => r.weight != null);
  const latestHeight = sortedBody.find(r => r.height != null);

  // Note category breakdown
  const categoryCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of filteredNotes) {
      const cat = n.category || 'その他';
      map[cat] = (map[cat] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredNotes]);

  const today = todayStr();
  const todayLog = trainingLogs.find(l => l.date === today);
  const todayDoneCount = trainingMenu.filter(m => todayLog?.completedItemIds.includes(m.id)).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="text-center"><p className="text-4xl mb-3">📊</p><p className="text-sm">読み込み中...</p></div>
      </div>
    );
  }

  return (
    <>
      <header className="mb-5 pt-1">
        <h1 className="text-2xl font-extrabold text-white drop-shadow">📊 パフォーマンス</h1>
        <p className="text-sm text-blue-200 mt-0.5">練習の成果を確認しよう！</p>
      </header>

      {/* Period filter */}
      <div className="flex gap-1 mb-5 bg-slate-800/60 rounded-xl p-1">
        {([['1m', '今月'], ['3m', '3ヶ月'], ['all', '全期間']] as [Period, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriod(val)}
            className={'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ' + (period === val ? 'bg-blue-600 text-white shadow' : 'text-slate-400')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <section className="mb-5 grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-3 text-center shadow-lg shadow-blue-900/40 border border-blue-400/20">
          <p className="text-2xl mb-0.5">📅</p>
          <p className="text-[10px] text-blue-100">練習日数</p>
          <p className="text-2xl font-extrabold text-white mt-0.5">{practiceDays}<span className="text-xs font-normal">日</span></p>
        </div>
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-3 text-center shadow-lg shadow-rose-900/40 border border-pink-400/20">
          <p className="text-2xl mb-0.5">🏆</p>
          <p className="text-[10px] text-pink-100">リフティング最高</p>
          <p className="text-2xl font-extrabold text-white mt-0.5">{maxCount}<span className="text-xs font-normal">回</span></p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-3 text-center shadow-lg shadow-amber-900/40 border border-orange-400/20">
          <p className="text-2xl mb-0.5">🏃</p>
          <p className="text-[10px] text-orange-100">今日の自主練</p>
          <p className="text-2xl font-extrabold text-white mt-0.5">{todayDoneCount}<span className="text-xs font-normal">/{trainingMenu.length}</span></p>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-indigo-700 rounded-2xl p-3 text-center shadow-lg shadow-indigo-900/40 border border-violet-400/20">
          <p className="text-2xl mb-0.5">📏</p>
          <p className="text-[10px] text-violet-100">身長 / 体重</p>
          <p className="text-base font-extrabold text-white leading-tight mt-0.5">
            {latestHeight?.height ?? '-'}<span className="text-[10px] font-normal">cm</span>
            {' / '}
            {latestWeight?.weight ?? '-'}<span className="text-[10px] font-normal">kg</span>
          </p>
        </div>
      </section>

      {/* Practice frequency chart */}
      <section className="mb-5">
        <h2 className="text-sm font-bold text-blue-200 mb-3 tracking-wide uppercase">📈 月別練習回数</h2>
        <div className="bg-slate-800/80 rounded-2xl p-4 shadow-xl shadow-blue-900/40 border border-white/10">
          {filteredNotes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">データがありません</p>
          ) : (
            <PracticeBarChart notes={filteredNotes} />
          )}
        </div>
      </section>

      {/* Category breakdown */}
      {categoryCount.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-200 mb-3 tracking-wide uppercase">🗂️ 練習カテゴリ内訳</h2>
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-white/10 space-y-2">
            {categoryCount.map(([cat, count]) => {
              const pct = filteredNotes.length > 0 ? Math.round((count / filteredNotes.length) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">{cat}</span>
                    <span className="text-slate-400">{count}回 ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Training completion rate */}
      {completionRate !== null && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-200 mb-3 tracking-wide uppercase">✅ 自主練メニュー達成率</h2>
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-extrabold text-white">{completionRate}%</span>
              <span className="text-sm text-slate-400">{filteredLogs.filter(l => trainingMenu.every(m => l.completedItemIds.includes(m.id))).length} / {filteredLogs.length}日</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={'h-full rounded-full transition-all ' + (completionRate >= 80 ? 'bg-green-500' : completionRate >= 50 ? 'bg-yellow-500' : 'bg-orange-500')}
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Lifting best records */}
      {liftingBests.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold text-blue-200 mb-3 tracking-wide uppercase">⚽ リフティング最高記録</h2>
          <div className="bg-slate-800/80 rounded-2xl overflow-hidden border border-white/10">
            {liftingBests.map(({ part, side, count }, i) => (
              <div key={`${part}-${side}`} className={'flex items-center gap-3 px-4 py-3 ' + (i < liftingBests.length - 1 ? 'border-b border-white/5' : '')}>
                <span className="text-xs text-slate-400 w-20 shrink-0">{part}</span>
                <span className="text-xs text-slate-500 w-10 shrink-0">{side}</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (count / Math.max(...liftingBests.map(b => b.count))) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-white w-12 text-right">{count}<span className="text-[10px] font-normal text-slate-400">回</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lifting trend */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-blue-200 mb-3 tracking-wide uppercase">📉 リフティング推移（インステップ左足）</h2>
        <div className="bg-slate-800/80 rounded-2xl p-4 shadow-xl shadow-blue-900/40 border border-white/10">
          <LiftingChart records={filteredLifting} filterPart="インステップ" filterSide="左足" />
        </div>
      </section>
    </>
  );
}

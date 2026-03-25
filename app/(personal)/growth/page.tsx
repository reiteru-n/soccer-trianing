'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import GrowthMetricCard from '@/components/GrowthMetricCard';
import { PerformanceMetricType, PerformanceFrequency } from '@/lib/types';

// Static metric definitions
interface MetricDef {
  type: PerformanceMetricType;
  label: string;
  icon: string;
  unit: string;
  lowerIsBetter: boolean;
  section: 'physical' | 'ball';
}

const METRICS: MetricDef[] = [
  // フィジカル/アジリティ
  { type: 'sprint',         label: '坂道ダッシュ',      icon: '🏃', unit: '秒',     lowerIsBetter: true,  section: 'physical' },
  { type: 'rope_endurance', label: '縄跳び耐久',        icon: '⏱️', unit: '秒',     lowerIsBetter: false, section: 'physical' },
  { type: 'rope_speed',     label: '縄跳びスピード',    icon: '🪢', unit: '回/30秒', lowerIsBetter: false, section: 'physical' },
  { type: 'side_jump',      label: '反復横跳び',        icon: '↔️', unit: '回/20秒', lowerIsBetter: false, section: 'physical' },
  // ボールコントロール
  { type: 'pass_direct',    label: '連続パスダイレクト', icon: '⚡', unit: '回',     lowerIsBetter: false, section: 'ball' },
  { type: 'pass_trap',      label: '連続パストラップ',  icon: '🎯', unit: '回',     lowerIsBetter: false, section: 'ball' },
  { type: 'dribble',        label: 'ドリブル',          icon: '🌀', unit: '任意',   lowerIsBetter: false, section: 'ball' },
  { type: 'kick_height',    label: 'キック高さ',        icon: '📏', unit: 'cm',     lowerIsBetter: false, section: 'ball' },
  { type: 'kick_distance',  label: 'キック距離',        icon: '📐', unit: 'm',      lowerIsBetter: false, section: 'ball' },
];

const DEFAULT_FREQ: PerformanceFrequency = 'weekly';

export default function GrowthPage() {
  const {
    performanceRecords, addPerformanceRecord, deletePerformanceRecord,
    liftingRecords, bodyRecords, maxCount, isLoading,
  } = useApp();

  // Per-metric frequency config (stored in local state; persisted via localStorage)
  const [freqConfig, setFreqConfig] = useState<Partial<Record<PerformanceMetricType, PerformanceFrequency>>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('perf_freq_config') ?? '{}');
    } catch { return {}; }
  });

  const [showExpiredOnly, setShowExpiredOnly] = useState(false);

  const handleFreqChange = (type: PerformanceMetricType, freq: PerformanceFrequency) => {
    const next = { ...freqConfig, [type]: freq };
    setFreqConfig(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('perf_freq_config', JSON.stringify(next));
    }
  };

  // Latest body
  const sortedBody = [...bodyRecords].sort((a, b) => b.date.localeCompare(a.date));
  const latestHeight = sortedBody.find(r => r.height != null);
  const latestWeight = sortedBody.find(r => r.weight != null);

  const needsUpdateCount = useMemo(() => {
    return METRICS.filter(m => {
      const freq = freqConfig[m.type] ?? DEFAULT_FREQ;
      const recs = performanceRecords.filter(r => r.metricType === m.type);
      if (recs.length === 0) return true;
      const latest = [...recs].sort((a, b) => b.date.localeCompare(a.date))[0];
      const [y, mo, d] = latest.date.split('/').map(Number);
      const latestD = new Date(y, mo - 1, d);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const days = Math.floor((now.getTime() - latestD.getTime()) / 86400000);
      const expire = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'monthly' ? 30 : null;
      return expire !== null && days >= expire;
    }).length;
  }, [performanceRecords, freqConfig]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="text-center"><p className="text-4xl mb-3">📈</p><p className="text-sm">読み込み中...</p></div>
      </div>
    );
  }

  const physicalMetrics = METRICS.filter(m => m.section === 'physical');
  const ballMetrics = METRICS.filter(m => m.section === 'ball');

  function renderMetricCard(m: MetricDef) {
    const freq = freqConfig[m.type] ?? DEFAULT_FREQ;
    const recs = performanceRecords.filter(r => r.metricType === m.type);

    if (showExpiredOnly) {
      if (recs.length === 0) { /* show */ }
      else {
        const latest = [...recs].sort((a, b) => b.date.localeCompare(a.date))[0];
        const [y, mo, d] = latest.date.split('/').map(Number);
        const latestD = new Date(y, mo - 1, d);
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const days = Math.floor((now.getTime() - latestD.getTime()) / 86400000);
        const expire = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'monthly' ? 30 : null;
        const isExpired = expire !== null && days >= expire;
        if (!isExpired) return null;
      }
    }

    return (
      <GrowthMetricCard
        key={m.type}
        metricType={m.type}
        label={m.label}
        icon={m.icon}
        unit={m.unit}
        lowerIsBetter={m.lowerIsBetter}
        frequency={freq}
        onFrequencyChange={(f) => handleFreqChange(m.type, f)}
        records={recs}
        onAdd={addPerformanceRecord}
        onDelete={deletePerformanceRecord}
      />
    );
  }

  return (
    <>
      <header className="mb-4 pt-1">
        <h1 className="text-2xl font-extrabold text-white drop-shadow">📈 成長記録</h1>
        <p className="text-sm text-blue-200 mt-0.5">昨日の自分を超えたか？💪</p>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowExpiredOnly(f => !f)}
          className={'flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ' +
            (showExpiredOnly
              ? 'bg-orange-600/30 border-orange-500/50 text-orange-300'
              : 'bg-slate-800/60 border-white/10 text-slate-400')}
        >
          {showExpiredOnly ? '⚠️ 更新必要のみ表示中' : '全て表示'}
          {needsUpdateCount > 0 && (
            <span className="ml-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {needsUpdateCount}
            </span>
          )}
        </button>
      </div>

      {/* Physical / Agility section */}
      <section className="mb-4">
        <h2 className="text-xs font-bold text-blue-200 mb-2 tracking-wide uppercase">🏃 フィジカル / アジリティ</h2>
        <div className="space-y-2">
          {physicalMetrics.map(m => renderMetricCard(m))}
        </div>
      </section>

      {/* Ball control section */}
      <section className="mb-4">
        <h2 className="text-xs font-bold text-blue-200 mb-2 tracking-wide uppercase">⚽ ボールコントロール技術</h2>
        <div className="space-y-2">
          {ballMetrics.map(m => renderMetricCard(m))}
        </div>
      </section>

      {/* Lifting (read-only) */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-blue-200 tracking-wide uppercase">🏆 リフティング</h2>
          <Link href="/lifting" className="text-xs text-blue-300">詳細 →</Link>
        </div>
        <div className="bg-slate-800/80 rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">⚽</span>
          <div>
            <p className="text-[10px] text-slate-400">自己最高記録</p>
            <p className="text-2xl font-extrabold text-white leading-none">
              {maxCount}<span className="text-xs font-normal text-slate-400 ml-0.5">回</span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-slate-400">総記録数</p>
            <p className="text-base font-bold text-slate-300">{liftingRecords.length}<span className="text-xs font-normal text-slate-400">回</span></p>
          </div>
        </div>
      </section>

      {/* Body (read-only) */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-blue-200 tracking-wide uppercase">📏 身長・体重</h2>
          <Link href="/" className="text-xs text-blue-300">詳細 →</Link>
        </div>
        <div className="bg-slate-800/80 rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">身長</p>
            <p className="text-xl font-extrabold text-white">
              {latestHeight?.height ?? '-'}<span className="text-[10px] font-normal text-slate-400">cm</span>
            </p>
            {latestHeight && <p className="text-[10px] text-slate-500">{latestHeight.date}</p>}
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">体重</p>
            <p className="text-xl font-extrabold text-white">
              {latestWeight?.weight ?? '-'}<span className="text-[10px] font-normal text-slate-400">kg</span>
            </p>
            {latestWeight && <p className="text-[10px] text-slate-500">{latestWeight.date}</p>}
          </div>
        </div>
      </section>
    </>
  );
}

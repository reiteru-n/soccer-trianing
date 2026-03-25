'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import GrowthMetricCard from '@/components/GrowthMetricCard';
import { PerformanceMetricType, PerformanceFrequency, CustomMetricDef } from '@/lib/types';

// Static metric definitions
interface MetricDef {
  type: PerformanceMetricType;
  label: string;
  icon: string;
  unit: string;
  lowerIsBetter: boolean;
  section: 'physical' | 'ball' | 'other';
}

const BUILTIN_METRICS: MetricDef[] = [
  { type: 'sprint',         label: '坂道ダッシュ',       icon: '🏃', unit: '秒',      lowerIsBetter: true,  section: 'physical' },
  { type: 'rope_endurance', label: '縄跳び耐久',         icon: '⏱️', unit: '秒',      lowerIsBetter: false, section: 'physical' },
  { type: 'rope_speed',     label: '縄跳びスピード',     icon: '🪢', unit: '回/30秒', lowerIsBetter: false, section: 'physical' },
  { type: 'side_jump',      label: '反復横跳び',         icon: '↔️', unit: '回/20秒', lowerIsBetter: false, section: 'physical' },
  { type: 'pass_direct',    label: '連続パスダイレクト', icon: '⚡', unit: '回',      lowerIsBetter: false, section: 'ball' },
  { type: 'pass_trap',      label: '連続パストラップ',   icon: '🎯', unit: '回',      lowerIsBetter: false, section: 'ball' },
  { type: 'dribble',        label: 'ドリブル',           icon: '🌀', unit: '任意',    lowerIsBetter: false, section: 'ball' },
  { type: 'kick_height',    label: 'キック高さ',         icon: '📏', unit: 'cm',      lowerIsBetter: false, section: 'ball' },
  { type: 'kick_distance',  label: 'キック距離',         icon: '📐', unit: 'm',       lowerIsBetter: false, section: 'ball' },
];

const DEFAULT_FREQ: PerformanceFrequency = 'weekly';

const SECTION_ICONS: Record<string, string> = {
  physical: '🏃 フィジカル / アジリティ',
  ball:     '⚽ ボールコントロール技術',
  other:    '📌 その他',
};

const FREQ_LABELS: Record<PerformanceFrequency, string> = {
  daily: '毎日', weekly: '週1', monthly: '月1', irregular: '不定期',
};

// blank form state
const EMPTY_CUSTOM = (): Omit<CustomMetricDef, 'id'> => ({
  label: '', icon: '📊', unit: '', lowerIsBetter: false, section: 'other', frequency: 'weekly',
});

export default function GrowthPage() {
  const {
    performanceRecords, addPerformanceRecord, deletePerformanceRecord,
    customMetrics, addCustomMetric, deleteCustomMetric,
    liftingRecords, bodyRecords, maxCount, isLoading,
  } = useApp();

  const [freqConfig, setFreqConfig] = useState<Partial<Record<string, PerformanceFrequency>>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('perf_freq_config') ?? '{}'); } catch { return {}; }
  });

  const [showExpiredOnly, setShowExpiredOnly] = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [newMetric, setNewMetric] = useState<Omit<CustomMetricDef, 'id'>>(EMPTY_CUSTOM());

  const handleFreqChange = (type: string, freq: PerformanceFrequency) => {
    const next = { ...freqConfig, [type]: freq };
    setFreqConfig(next);
    if (typeof window !== 'undefined') localStorage.setItem('perf_freq_config', JSON.stringify(next));
  };

  const handleAddMetric = () => {
    if (!newMetric.label.trim() || !newMetric.unit.trim()) return;
    addCustomMetric({ ...newMetric, label: newMetric.label.trim(), unit: newMetric.unit.trim() });
    setNewMetric(EMPTY_CUSTOM());
    setShowAddMetric(false);
  };

  const latestBody = [...bodyRecords].sort((a, b) => b.date.localeCompare(a.date));
  const latestHeight = latestBody.find(r => r.height != null);
  const latestWeight = latestBody.find(r => r.weight != null);

  function isExpiredMetric(type: string): boolean {
    const freq = freqConfig[type] ?? DEFAULT_FREQ;
    const recs = performanceRecords.filter(r => r.metricType === type);
    if (recs.length === 0) return true;
    const latest = [...recs].sort((a, b) => b.date.localeCompare(a.date))[0];
    const [y, mo, d] = latest.date.split('/').map(Number);
    const daysDiff = Math.floor((Date.now() - new Date(y, mo - 1, d).getTime()) / 86400000);
    const expire = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'monthly' ? 30 : null;
    return expire !== null && daysDiff >= expire;
  }

  const needsUpdateCount = useMemo(
    () => BUILTIN_METRICS.filter(m => isExpiredMetric(m.type)).length
        + customMetrics.filter(m => isExpiredMetric(m.id)).length,
    [performanceRecords, freqConfig, customMetrics]
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="text-center"><p className="text-4xl mb-3">📈</p><p className="text-sm">読み込み中...</p></div>
    </div>
  );

  function renderCard(type: string, label: string, icon: string, unit: string, lowerIsBetter: boolean) {
    const freq = freqConfig[type] ?? DEFAULT_FREQ;
    const recs = performanceRecords.filter(r => r.metricType === type);
    if (showExpiredOnly && !isExpiredMetric(type)) return null;
    return (
      <GrowthMetricCard
        key={type}
        metricType={type}
        label={label}
        icon={icon}
        unit={unit}
        lowerIsBetter={lowerIsBetter}
        frequency={freq}
        onFrequencyChange={(f) => handleFreqChange(type, f)}
        records={recs}
        onAdd={addPerformanceRecord}
        onDelete={deletePerformanceRecord}
      />
    );
  }

  const physicalMetrics = BUILTIN_METRICS.filter(m => m.section === 'physical');
  const ballMetrics     = BUILTIN_METRICS.filter(m => m.section === 'ball');
  const customPhysical  = customMetrics.filter(m => m.section === 'physical');
  const customBall      = customMetrics.filter(m => m.section === 'ball');
  const customOther     = customMetrics.filter(m => m.section === 'other');

  const hasCustomSection = (section: string) => customMetrics.some(m => m.section === section);

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
            (showExpiredOnly ? 'bg-orange-600/30 border-orange-500/50 text-orange-300' : 'bg-slate-800/60 border-white/10 text-slate-400')}
        >
          {showExpiredOnly ? '⚠️ 更新必要のみ' : '全て表示'}
          {needsUpdateCount > 0 && (
            <span className="ml-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{needsUpdateCount}</span>
          )}
        </button>
        <button
          onClick={() => setShowAddMetric(f => !f)}
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-blue-500/40 bg-blue-600/20 text-blue-300"
        >
          ＋ 項目追加
        </button>
      </div>

      {/* Add custom metric form */}
      {showAddMetric && (
        <div className="mb-4 bg-slate-800/90 rounded-2xl border border-blue-500/30 p-4 space-y-3">
          <p className="text-sm font-bold text-blue-200">新しい指標を追加</p>
          <div className="flex gap-2">
            <div className="w-16">
              <label className="block text-[10px] text-slate-400 mb-1">アイコン</label>
              <input
                type="text"
                value={newMetric.icon}
                onChange={e => setNewMetric(m => ({ ...m, icon: e.target.value }))}
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-blue-400"
                placeholder="📊"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-slate-400 mb-1">名前 *</label>
              <input
                type="text"
                value={newMetric.label}
                onChange={e => setNewMetric(m => ({ ...m, label: e.target.value }))}
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                placeholder="例: シュート距離"
              />
            </div>
            <div className="w-20">
              <label className="block text-[10px] text-slate-400 mb-1">単位 *</label>
              <input
                type="text"
                value={newMetric.unit}
                onChange={e => setNewMetric(m => ({ ...m, unit: e.target.value }))}
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                placeholder="m"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] text-slate-400 mb-1">セクション</label>
              <select
                value={newMetric.section}
                onChange={e => setNewMetric(m => ({ ...m, section: e.target.value as CustomMetricDef['section'] }))}
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none"
              >
                <option value="physical">フィジカル</option>
                <option value="ball">ボールコントロール</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] text-slate-400 mb-1">頻度</label>
              <select
                value={newMetric.frequency}
                onChange={e => setNewMetric(m => ({ ...m, frequency: e.target.value as PerformanceFrequency }))}
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none"
              >
                {(Object.entries(FREQ_LABELS) as [PerformanceFrequency, string][]).map(([f, l]) => (
                  <option key={f} value={f}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end min-w-[100px]">
              <label className="flex items-center gap-2 text-sm text-slate-300 pb-2">
                <input
                  type="checkbox"
                  checked={newMetric.lowerIsBetter}
                  onChange={e => setNewMetric(m => ({ ...m, lowerIsBetter: e.target.checked }))}
                  className="rounded"
                />
                小さい方が良い
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddMetric}
              disabled={!newMetric.label.trim() || !newMetric.unit.trim()}
              className="flex-1 bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              追加
            </button>
            <button
              onClick={() => { setShowAddMetric(false); setNewMetric(EMPTY_CUSTOM()); }}
              className="flex-1 bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Physical section */}
      <section className="mb-4">
        <h2 className="text-xs font-bold text-blue-200 mb-2 tracking-wide uppercase">🏃 フィジカル / アジリティ</h2>
        <div className="space-y-2">
          {physicalMetrics.map(m => renderCard(m.type, m.label, m.icon, m.unit, m.lowerIsBetter))}
          {customPhysical.map(m => (
            <div key={m.id} className="relative">
              {renderCard(m.id, m.label, m.icon, m.unit, m.lowerIsBetter)}
              <button
                onClick={() => { if (window.confirm(`「${m.label}」を削除しますか？`)) deleteCustomMetric(m.id); }}
                className="absolute top-2 right-2 text-slate-600 hover:text-red-400 text-xs z-10"
              >🗑️</button>
            </div>
          ))}
        </div>
      </section>

      {/* Ball control section */}
      <section className="mb-4">
        <h2 className="text-xs font-bold text-blue-200 mb-2 tracking-wide uppercase">⚽ ボールコントロール技術</h2>
        <div className="space-y-2">
          {ballMetrics.map(m => renderCard(m.type, m.label, m.icon, m.unit, m.lowerIsBetter))}
          {customBall.map(m => (
            <div key={m.id} className="relative">
              {renderCard(m.id, m.label, m.icon, m.unit, m.lowerIsBetter)}
              <button
                onClick={() => { if (window.confirm(`「${m.label}」を削除しますか？`)) deleteCustomMetric(m.id); }}
                className="absolute top-2 right-2 text-slate-600 hover:text-red-400 text-xs z-10"
              >🗑️</button>
            </div>
          ))}
        </div>
      </section>

      {/* Other custom section */}
      {customOther.length > 0 && (
        <section className="mb-4">
          <h2 className="text-xs font-bold text-blue-200 mb-2 tracking-wide uppercase">📌 その他</h2>
          <div className="space-y-2">
            {customOther.map(m => (
              <div key={m.id} className="relative">
                {renderCard(m.id, m.label, m.icon, m.unit, m.lowerIsBetter)}
                <button
                  onClick={() => { if (window.confirm(`「${m.label}」を削除しますか？`)) deleteCustomMetric(m.id); }}
                  className="absolute top-2 right-2 text-slate-600 hover:text-red-400 text-xs z-10"
                >🗑️</button>
              </div>
            ))}
          </div>
        </section>
      )}

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

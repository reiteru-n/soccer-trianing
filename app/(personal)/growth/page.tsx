'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import GrowthMetricCard from '@/components/GrowthMetricCard';
import TagSummaryChart from '@/components/TagSummaryChart';
import { PerformanceFrequency, CustomMetricDef } from '@/lib/types';

interface MetricDef {
  type: string;
  label: string;
  icon: string;
  unit: string;
  lowerIsBetter: boolean;
  section: 'physical' | 'ball' | 'other';
  howToMeasure?: string;
  referenceUrl?: string;
}

type BuiltinOverride = Partial<Omit<MetricDef, 'type'>>;

const BUILTIN_METRICS: MetricDef[] = [
  { type: 'sprint',         label: '坂道ダッシュ',       icon: '🏃', unit: '秒',      lowerIsBetter: true,  section: 'physical',
    howToMeasure: '坂道（傾斜10〜15度程度）を全力でダッシュ。スタートからゴールまでの時間を計測する。同じ坂・同じ距離で毎回測ること。' },
  { type: 'rope_endurance', label: '縄跳び耐久',         icon: '⏱️', unit: '秒',      lowerIsBetter: false, section: 'physical',
    howToMeasure: '縄跳びを跳び続けた時間を計測する。引っかかった時点で終了。前跳びで計測。' },
  { type: 'rope_speed',     label: '縄跳びスピード',     icon: '🪢', unit: '回/30秒', lowerIsBetter: false, section: 'physical',
    howToMeasure: '30秒間でできるだけ速く跳んだ回数を数える。前跳びで計測。タイマーを用意して計測すること。' },
  { type: 'side_jump',      label: '反復横跳び',         icon: '↔️', unit: '回/20秒', lowerIsBetter: false, section: 'physical',
    howToMeasure: '1m間隔に引いた2本のライン間を20秒間できるだけ速く往復する。片道1回としてカウント。' },
  { type: 'pass_direct',    label: '連続パスダイレクト', icon: '⚡', unit: '回',      lowerIsBetter: false, section: 'ball',
    howToMeasure: '壁に向かってダイレクトパスを連続で蹴り続ける。ミスなく続いた最大回数を記録。インサイドで蹴る。' },
  { type: 'pass_trap',      label: '連続パストラップ',   icon: '🎯', unit: '回',      lowerIsBetter: false, section: 'ball',
    howToMeasure: '壁に蹴る→トラップ→蹴るを繰り返す。ミスなく続いた最大回数を記録。1往復を1回とカウント。' },
  { type: 'dribble',        label: 'ドリブル',           icon: '🌀', unit: '任意',    lowerIsBetter: false, section: 'ball',
    howToMeasure: '任意の形式で記録（例：コーン間タイム、距離など）。毎回同じ条件で計測すること。' },
  { type: 'kick_height',    label: 'キック高さ',         icon: '📏', unit: 'cm',      lowerIsBetter: false, section: 'ball',
    howToMeasure: 'ボールを蹴り上げて最高到達点の高さをcmで計測する。壁に高さの目印をつけると計測しやすい。' },
  { type: 'kick_distance',  label: 'キック距離',         icon: '📐', unit: 'm',       lowerIsBetter: false, section: 'ball',
    howToMeasure: '全力でボールを蹴り、着地点までの距離をmで計測する。インステップキックで計測。' },
];

const DEFAULT_FREQ: PerformanceFrequency = 'weekly';
const FREQ_LABELS: Record<PerformanceFrequency, string> = {
  daily: '毎日', weekly: '週1', monthly: '月1', irregular: '不定期',
};

const EMPTY_CUSTOM = (): Omit<CustomMetricDef, 'id'> => ({
  label: '', icon: '📊', unit: '', lowerIsBetter: false,
  section: 'other', frequency: 'weekly', referenceUrl: '', howToMeasure: '', tags: [],
});

function loadConfig<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}
function saveConfig(key: string, value: unknown) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
}

export default function GrowthPage() {
  const {
    performanceRecords, addPerformanceRecord, deletePerformanceRecord,
    customMetrics, addCustomMetric, updateCustomMetric, deleteCustomMetric,
    liftingRecords, bodyRecords, maxCount, isLoading,
  } = useApp();

  const [freqConfig, setFreqConfig] = useState<Record<string, PerformanceFrequency>>(
    () => loadConfig('perf_freq_config', {})
  );
  const [tagConfig, setTagConfig] = useState<Record<string, string[]>>(
    () => loadConfig('perf_tag_config', {})
  );
  const [builtinOverrides, setBuiltinOverrides] = useState<Record<string, BuiltinOverride>>(
    () => loadConfig('perf_builtin_overrides', {})
  );
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [newMetric, setNewMetric] = useState<Omit<CustomMetricDef, 'id'>>(EMPTY_CUSTOM());
  const [newMetricTagInput, setNewMetricTagInput] = useState('');
  const [templateId, setTemplateId] = useState('');

  const handleFreqChange = (type: string, freq: PerformanceFrequency) => {
    const next = { ...freqConfig, [type]: freq };
    setFreqConfig(next); saveConfig('perf_freq_config', next);
  };
  const handleTagsChange = (type: string, tags: string[]) => {
    const next = { ...tagConfig, [type]: tags };
    setTagConfig(next); saveConfig('perf_tag_config', next);
  };
  const handleBuiltinUpdate = (type: string, updates: Partial<Omit<CustomMetricDef, 'id'>>) => {
    const next = { ...builtinOverrides, [type]: { ...(builtinOverrides[type] ?? {}), ...updates } };
    setBuiltinOverrides(next); saveConfig('perf_builtin_overrides', next);
    // sync frequency to freqConfig if updated
    if (updates.frequency) handleFreqChange(type, updates.frequency);
  };
  const getEffectiveBuiltin = (m: MetricDef): MetricDef => {
    const ov = builtinOverrides[m.type];
    if (!ov) return m;
    return { ...m, ...ov };
  };

  // テンプレートから内容をコピー
  const applyTemplate = (id: string) => {
    if (!id) { setNewMetric(EMPTY_CUSTOM()); setTemplateId(''); return; }
    const builtin = BUILTIN_METRICS.find(m => m.type === id);
    if (builtin) {
      setNewMetric({
        label: builtin.label, icon: builtin.icon, unit: builtin.unit,
        lowerIsBetter: builtin.lowerIsBetter, section: builtin.section,
        frequency: DEFAULT_FREQ, howToMeasure: builtin.howToMeasure ?? '',
        referenceUrl: '', tags: [],
      });
    } else {
      const custom = customMetrics.find(m => m.id === id);
      if (custom) {
        setNewMetric({
          label: custom.label, icon: custom.icon, unit: custom.unit,
          lowerIsBetter: custom.lowerIsBetter, section: custom.section,
          frequency: custom.frequency, howToMeasure: custom.howToMeasure ?? '',
          referenceUrl: custom.referenceUrl ?? '', tags: [],
        });
      }
    }
    setTemplateId(id);
  };

  const handleAddMetric = () => {
    if (!newMetric.label.trim() || !newMetric.unit.trim()) return;
    addCustomMetric({
      ...newMetric,
      label: newMetric.label.trim(), unit: newMetric.unit.trim(),
      referenceUrl: (newMetric.referenceUrl as string)?.trim() || undefined,
      howToMeasure: (newMetric.howToMeasure as string)?.trim() || undefined,
      tags: newMetric.tags ?? [],
    });
    setNewMetric(EMPTY_CUSTOM()); setNewMetricTagInput(''); setTemplateId('');
    setShowAddMetric(false);
  };

  const handleAddNewMetricTag = () => {
    const t = newMetricTagInput.trim();
    if (!t) return;
    const cur = newMetric.tags ?? [];
    if (!cur.includes(t)) setNewMetric(m => ({ ...m, tags: [...cur, t] }));
    setNewMetricTagInput('');
  };

  function isExpiredMetric(type: string): boolean {
    const freq = freqConfig[type] ?? DEFAULT_FREQ;
    const recs = performanceRecords.filter(r => r.metricType === type);
    if (recs.length === 0) return true;
    const latest = [...recs].sort((a,b) => b.date.localeCompare(a.date))[0];
    const [y,mo,d] = latest.date.split('/').map(Number);
    const days = Math.floor((Date.now() - new Date(y,mo-1,d).getTime()) / 86400000);
    const expire = freq==='daily'?1:freq==='weekly'?7:freq==='monthly'?30:null;
    return expire !== null && days >= expire;
  }

  function getMetricTags(type: string, custom?: CustomMetricDef): string[] {
    return tagConfig[type] !== undefined ? tagConfig[type] : (custom?.tags ?? []);
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    BUILTIN_METRICS.forEach(m => getMetricTags(m.type).forEach(t => set.add(t)));
    customMetrics.forEach(m => getMetricTags(m.id, m).forEach(t => set.add(t)));
    return [...set].sort();
  }, [tagConfig, customMetrics]);

  const needsUpdateCount = useMemo(
    () => [...BUILTIN_METRICS, ...customMetrics.map(m=>({type:m.id}))].filter(m=>isExpiredMetric(m.type)).length,
    [performanceRecords, freqConfig, customMetrics]
  );

  const latestBody = [...bodyRecords].sort((a,b) => b.date.localeCompare(a.date));
  const latestHeight = latestBody.find(r => r.height != null);
  const latestWeight = latestBody.find(r => r.weight != null);

  if (isLoading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="text-center"><p className="text-4xl mb-3">📈</p><p className="text-sm">読み込み中...</p></div>
    </div>
  );

  function shouldShow(type: string, custom?: CustomMetricDef): boolean {
    if (showExpiredOnly && !isExpiredMetric(type)) return false;
    if (selectedTag && !getMetricTags(type, custom).includes(selectedTag)) return false;
    return true;
  }

  function renderCard(m: MetricDef, custom?: CustomMetricDef) {
    const type = m.type;
    if (!shouldShow(type, custom)) return null;
    const effective = custom ? m : getEffectiveBuiltin(m);
    const freq = freqConfig[type] ?? (custom?.frequency ?? DEFAULT_FREQ);
    return (
      <GrowthMetricCard
        key={type}
        metricType={type}
        label={effective.label}
        icon={effective.icon}
        unit={effective.unit}
        lowerIsBetter={effective.lowerIsBetter}
        section={effective.section}
        howToMeasure={effective.howToMeasure}
        frequency={freq}
        onFrequencyChange={f => handleFreqChange(type, f)}
        records={performanceRecords.filter(r => r.metricType === type)}
        onAdd={addPerformanceRecord}
        onDelete={deletePerformanceRecord}
        referenceUrl={custom?.referenceUrl ?? effective.referenceUrl}
        tags={getMetricTags(type, custom)}
        onTagsChange={t => handleTagsChange(type, t)}
        isCustom={!!custom}
        onUpdateMetric={custom
          ? (updates) => updateCustomMetric(custom.id, updates)
          : (updates) => handleBuiltinUpdate(type, updates)}
        onDeleteMetric={custom ? () => deleteCustomMetric(custom.id) : undefined}
      />
    );
  }

  const physicalBuiltin = BUILTIN_METRICS.filter(m => m.section === 'physical');
  const ballBuiltin     = BUILTIN_METRICS.filter(m => m.section === 'ball');
  const customPhysical  = customMetrics.filter(m => m.section === 'physical');
  const customBall      = customMetrics.filter(m => m.section === 'ball');
  const customOther     = customMetrics.filter(m => m.section === 'other');

  // All metrics for template selector
  const templateOptions = [
    ...BUILTIN_METRICS.map(m => ({ id: m.type, label: `${m.icon} ${m.label}`, group: '組み込み' })),
    ...customMetrics.map(m => ({ id: m.id, label: `${m.icon} ${m.label}`, group: 'カスタム' })),
  ];

  return (
    <>
      <header className="mb-4 pt-1">
        <h1 className="text-2xl font-extrabold text-white drop-shadow">📈 成長記録</h1>
        <p className="text-sm text-blue-200 mt-0.5">昨日の自分を超えたか？💪</p>
      </header>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button onClick={() => setSelectedTag(null)}
            className={'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ' +
              (!selectedTag ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800/60 border-white/10 text-slate-400')}>全て</button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setSelectedTag(t => t===tag?null:tag)}
              className={'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ' +
                (selectedTag===tag ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800/60 border-blue-500/30 text-blue-300')}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Tag summary chart */}
      {selectedTag && (() => {
        const tagged = [
          ...BUILTIN_METRICS
            .filter(m => getMetricTags(m.type).includes(selectedTag))
            .map(m => { const e = getEffectiveBuiltin(m); return { type: m.type, label: e.label, icon: e.icon, lowerIsBetter: e.lowerIsBetter }; }),
          ...customMetrics
            .filter(m => getMetricTags(m.id, m).includes(selectedTag))
            .map(m => ({ type: m.id, label: m.label, icon: m.icon, lowerIsBetter: m.lowerIsBetter })),
        ];
        return <TagSummaryChart metrics={tagged} records={performanceRecords} />;
      })()}

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setShowExpiredOnly(f=>!f)}
          className={'flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ' +
            (showExpiredOnly ? 'bg-orange-600/30 border-orange-500/50 text-orange-300' : 'bg-slate-800/60 border-white/10 text-slate-400')}>
          {showExpiredOnly ? '⚠️ 更新必要のみ' : '全て表示'}
          {needsUpdateCount > 0 && <span className="ml-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{needsUpdateCount}</span>}
        </button>
        <button onClick={() => setShowAddMetric(f=>!f)}
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-blue-500/40 bg-blue-600/20 text-blue-300">
          ＋ 項目追加
        </button>
      </div>

      {/* Add custom metric form */}
      {showAddMetric && (
        <div className="mb-4 bg-slate-800/90 rounded-2xl border border-blue-500/30 p-4 space-y-3">
          <p className="text-sm font-bold text-blue-200">新しい指標を追加</p>

          {/* Template selector */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">📋 テンプレートから選択（任意）</label>
            <select value={templateId} onChange={e => applyTemplate(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-400">
              <option value="">（空白から作成）</option>
              <optgroup label="組み込み">
                {BUILTIN_METRICS.map(m => <option key={m.type} value={m.type}>{m.icon} {m.label}</option>)}
              </optgroup>
              {customMetrics.length > 0 && (
                <optgroup label="カスタム">
                  {customMetrics.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          {/* Name / icon / unit */}
          <div className="flex gap-2">
            <div className="w-16">
              <label className="block text-[10px] text-slate-400 mb-1">アイコン</label>
              <input value={newMetric.icon} onChange={e=>setNewMetric(m=>({...m,icon:e.target.value}))}
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-blue-400" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-slate-400 mb-1">名前 *</label>
              <input value={newMetric.label} onChange={e=>setNewMetric(m=>({...m,label:e.target.value}))} placeholder="例: シュート距離"
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-400" />
            </div>
            <div className="w-20">
              <label className="block text-[10px] text-slate-400 mb-1">単位 *</label>
              <input value={newMetric.unit} onChange={e=>setNewMetric(m=>({...m,unit:e.target.value}))} placeholder="m"
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] text-slate-400 mb-1">セクション</label>
              <select value={newMetric.section} onChange={e=>setNewMetric(m=>({...m,section:e.target.value as CustomMetricDef['section']}))}
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none">
                <option value="physical">フィジカル</option>
                <option value="ball">ボールコントロール</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] text-slate-400 mb-1">頻度</label>
              <select value={newMetric.frequency} onChange={e=>setNewMetric(m=>({...m,frequency:e.target.value as PerformanceFrequency}))}
                className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none">
                {(Object.entries(FREQ_LABELS) as [PerformanceFrequency,string][]).map(([f,l]) => <option key={f} value={f}>{l}</option>)}
              </select>
            </div>
            <div className="flex items-end min-w-[100px]">
              <label className="flex items-center gap-2 text-sm text-slate-300 pb-2">
                <input type="checkbox" checked={newMetric.lowerIsBetter} onChange={e=>setNewMetric(m=>({...m,lowerIsBetter:e.target.checked}))} className="rounded" />
                値が小さい方が良い
              </label>
            </div>
          </div>

          {/* How to measure */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">📋 計測方法（任意）</label>
            <textarea value={(newMetric as any).howToMeasure ?? ''} onChange={e=>setNewMetric(m=>({...m,howToMeasure:e.target.value}))}
              rows={2} placeholder="計測の手順・条件を入力"
              className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400 resize-none" />
          </div>

          {/* Reference URL */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">📎 参考URL（任意）</label>
            <input type="url" value={(newMetric as any).referenceUrl ?? ''} onChange={e=>setNewMetric(m=>({...m,referenceUrl:e.target.value}))} placeholder="https://..."
              className="w-full rounded-lg bg-slate-700 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-400" />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">🏷️ タグ（任意）</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(newMetric.tags ?? []).map(t => (
                <span key={t} onClick={()=>setNewMetric(m=>({...m,tags:(m.tags??[]).filter(x=>x!==t)}))}
                  className="text-xs bg-blue-600/30 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full cursor-pointer hover:bg-red-600/30 hover:text-red-300">
                  {t} ✕
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newMetricTagInput} onChange={e=>setNewMetricTagInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();handleAddNewMetricTag();} }}
                placeholder="例: 10分トレーニング"
                className="flex-1 rounded-lg bg-slate-700 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400" />
              <button onClick={handleAddNewMetricTag} className="bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm">追加</button>
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {allTags.filter(t=>!(newMetric.tags??[]).includes(t)).map(t => (
                  <button key={t} onClick={()=>setNewMetric(m=>({...m,tags:[...(m.tags??[]),t]}))}
                    className="text-[10px] text-slate-400 border border-slate-600 px-2 py-0.5 rounded-full hover:border-blue-500 hover:text-blue-300">+ {t}</button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={handleAddMetric} disabled={!newMetric.label.trim()||!newMetric.unit.trim()}
              className="flex-1 bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm">追加</button>
            <button onClick={()=>{setShowAddMetric(false);setNewMetric(EMPTY_CUSTOM());setTemplateId('');}}
              className="flex-1 bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm">キャンセル</button>
          </div>
        </div>
      )}

      {/* Physical section */}
      <section className="mb-4">
        <h2 className="text-xs font-bold text-blue-200 mb-2 tracking-wide uppercase">🏃 フィジカル / アジリティ</h2>
        <div className="space-y-2">
          {physicalBuiltin.map(m => renderCard(m))}
          {customPhysical.map(m => renderCard({ ...m, type: m.id }, m))}
        </div>
      </section>

      {/* Ball control section */}
      <section className="mb-4">
        <h2 className="text-xs font-bold text-blue-200 mb-2 tracking-wide uppercase">⚽ ボールコントロール技術</h2>
        <div className="space-y-2">
          {ballBuiltin.map(m => renderCard(m))}
          {customBall.map(m => renderCard({ ...m, type: m.id }, m))}
        </div>
      </section>

      {/* Other custom section */}
      {customOther.some(m => shouldShow(m.id, m)) && (
        <section className="mb-4">
          <h2 className="text-xs font-bold text-blue-200 mb-2 tracking-wide uppercase">📌 その他</h2>
          <div className="space-y-2">
            {customOther.map(m => renderCard({ ...m, type: m.id }, m))}
          </div>
        </section>
      )}

      {/* Lifting read-only */}
      {!selectedTag && (
        <section className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-blue-200 tracking-wide uppercase">🏆 リフティング</h2>
            <Link href="/lifting" className="text-xs text-blue-300">詳細 →</Link>
          </div>
          <div className="bg-slate-800/80 rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">⚽</span>
            <div>
              <p className="text-[10px] text-slate-400">自己最高記録</p>
              <p className="text-2xl font-extrabold text-white leading-none">{maxCount}<span className="text-xs font-normal text-slate-400 ml-0.5">回</span></p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] text-slate-400">総記録数</p>
              <p className="text-base font-bold text-slate-300">{liftingRecords.length}<span className="text-xs font-normal text-slate-400">回</span></p>
            </div>
          </div>
        </section>
      )}

      {/* Body read-only */}
      {!selectedTag && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-blue-200 tracking-wide uppercase">📏 身長・体重</h2>
            <Link href="/" className="text-xs text-blue-300">詳細 →</Link>
          </div>
          <div className="bg-slate-800/80 rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-4">
            <div className="flex-1 text-center">
              <p className="text-[10px] text-slate-400 mb-0.5">身長</p>
              <p className="text-xl font-extrabold text-white">{latestHeight?.height??'-'}<span className="text-[10px] font-normal text-slate-400">cm</span></p>
              {latestHeight && <p className="text-[10px] text-slate-500">{latestHeight.date}</p>}
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex-1 text-center">
              <p className="text-[10px] text-slate-400 mb-0.5">体重</p>
              <p className="text-xl font-extrabold text-white">{latestWeight?.weight??'-'}<span className="text-[10px] font-normal text-slate-400">kg</span></p>
              {latestWeight && <p className="text-[10px] text-slate-500">{latestWeight.date}</p>}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

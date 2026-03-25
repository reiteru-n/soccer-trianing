'use client';

import { useState, useRef } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line } from 'react-chartjs-2';
import { PerformanceRecord, PerformanceFrequency, CustomMetricDef } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, ChartDataLabels);

const FREQ_LABELS: Record<PerformanceFrequency, string> = {
  daily: '毎日', weekly: '週1', monthly: '月1', irregular: '不定期',
};
const FREQ_EXPIRE_DAYS: Record<PerformanceFrequency, number | null> = {
  daily: 1, weekly: 7, monthly: 30, irregular: null,
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function daysSince(dateStr: string): number {
  const [y,m,day] = dateStr.split('/').map(Number);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.floor((now.getTime() - new Date(y,m-1,day).getTime()) / 86400000);
}

interface Props {
  metricType: string;
  label: string;
  icon: string;
  unit: string;
  lowerIsBetter: boolean;
  section: CustomMetricDef['section'];
  howToMeasure?: string;
  frequency: PerformanceFrequency;
  onFrequencyChange: (f: PerformanceFrequency) => void;
  records: PerformanceRecord[];
  onAdd: (record: Omit<PerformanceRecord, 'id'>) => void;
  onDelete: (id: string) => void;
  referenceUrl?: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  isCustom?: boolean;
  onUpdateMetric?: (updates: Partial<Omit<CustomMetricDef, 'id'>>) => void;
  onDeleteMetric?: () => void;
}

export default function GrowthMetricCard({
  metricType, label, icon, unit, lowerIsBetter, section, howToMeasure,
  frequency, onFrequencyChange, records, onAdd, onDelete,
  referenceUrl, tags, onTagsChange,
  isCustom, onUpdateMetric, onDeleteMetric,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFreqMenu, setShowFreqMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [formDate, setFormDate] = useState(todayStr());
  const [formValue, setFormValue] = useState('');
  const [formMemo, setFormMemo] = useState('');

  // Edit form state
  const [editLabel, setEditLabel] = useState(label);
  const [editIcon, setEditIcon] = useState(icon);
  const [editUnit, setEditUnit] = useState(unit);
  const [editLower, setEditLower] = useState(lowerIsBetter);
  const [editSection, setEditSection] = useState<CustomMetricDef['section']>(section);
  const [editFreq, setEditFreq] = useState<PerformanceFrequency>(frequency);
  const [editUrl, setEditUrl] = useState(referenceUrl ?? '');
  const [editHow, setEditHow] = useState(howToMeasure ?? '');
  const [editTags, setEditTags] = useState<string[]>(tags);
  const [editTagInput, setEditTagInput] = useState('');

  // Swipe detection
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isCustom) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 60) setShowDeleteConfirm(true);
  };

  const sorted = [...records].sort((a,b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length-1];
  const prev   = sorted[sorted.length-2];
  const bestRecord = records.length > 0
    ? records.reduce((best,r) => lowerIsBetter ? (r.value < best.value ? r : best) : (r.value > best.value ? r : best))
    : null;
  const expireDays = FREQ_EXPIRE_DAYS[frequency];
  const needsUpdate = (expireDays !== null && (latest ? daysSince(latest.date) >= expireDays : true)) || records.length === 0;
  const improved: boolean | null = (latest && prev)
    ? (lowerIsBetter ? latest.value < prev.value : latest.value > prev.value)
    : null;

  const handleAdd = () => {
    const val = parseFloat(formValue);
    if (isNaN(val)) return;
    onAdd({ date: formDate, metricType, value: val, memo: formMemo || undefined });
    setFormValue(''); setFormMemo(''); setFormDate(todayStr());
    setShowForm(false); setOpen(true);
  };

  const openEdit = () => {
    setEditLabel(label); setEditIcon(icon); setEditUnit(unit);
    setEditLower(lowerIsBetter); setEditSection(section); setEditFreq(frequency);
    setEditUrl(referenceUrl ?? ''); setEditHow(howToMeasure ?? '');
    setEditTags([...tags]); setEditTagInput('');
    setShowEdit(true); setOpen(true); setShowForm(false);
  };

  const handleSaveEdit = () => {
    onTagsChange(editTags);
    onUpdateMetric?.({
      label: editLabel.trim() || label,
      icon: editIcon || icon,
      unit: editUnit.trim() || unit,
      lowerIsBetter: editLower,
      section: editSection,
      frequency: editFreq,
      referenceUrl: editUrl.trim() || undefined,
      howToMeasure: editHow.trim() || undefined,
    });
    setShowEdit(false);
  };

  const handleAddEditTag = () => {
    const t = editTagInput.trim();
    if (!t || editTags.includes(t)) { setEditTagInput(''); return; }
    setEditTags(prev => [...prev, t]);
    setEditTagInput('');
  };

  const chartLabels = sorted.map(r => r.date.slice(5));
  const chartData   = sorted.map(r => r.value);

  const borderC = lowerIsBetter ? '#f97316' : '#60a5fa';
  const bgC     = lowerIsBetter ? 'rgba(249,115,22,0.08)' : 'rgba(96,165,250,0.08)';
  const ptC     = lowerIsBetter ? '#f97316' : '#f472b6';
  const labelC  = lowerIsBetter ? '#fb923c' : '#93c5fd';

  return (
    <>
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="bg-slate-800 border border-red-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
            <p className="text-3xl mb-3">🗑️</p>
            <p className="font-bold text-white text-lg mb-1">「{label}」を削除</p>
            <p className="text-sm text-slate-400 mb-5">この指標と全ての記録が削除されます。元に戻せません。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-bold text-sm">キャンセル</button>
              <button onClick={() => { setShowDeleteConfirm(false); onDeleteMetric?.(); }} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm">削除する</button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`rounded-2xl border overflow-hidden transition-all ${needsUpdate ? 'border-orange-500/50 bg-orange-950/20' : 'border-white/10 bg-slate-800/80'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <span className="text-xl shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-bold text-white">{label}</span>
                {needsUpdate && records.length === 0 && <span className="text-[10px] bg-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded-full">未記録</span>}
                {needsUpdate && records.length > 0 && <span className="text-[10px] bg-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded-full">更新期限</span>}
                {!needsUpdate && improved === true  && <span className="text-[10px] bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded-full">↑ 記録更新</span>}
                {!needsUpdate && improved === false && <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full">↓ 前回より低下</span>}
              </div>
              {/* Tags */}
              <div className="flex items-center flex-wrap gap-1 mt-0.5">
                {tags.map(t => (
                  <span key={t}
                    className="text-[9px] bg-blue-600/30 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {latest
                  ? <span className="text-lg font-extrabold text-white leading-none">{latest.value}<span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span></span>
                  : <span className="text-sm text-slate-500">-</span>}
                {bestRecord && bestRecord.id !== latest?.id && <span className="text-[10px] text-slate-400">最高: {bestRecord.value}{unit}</span>}
              </div>
            </div>
            <span className="text-slate-400 text-xs ml-1">{open ? '▲' : '▼'}</span>
          </button>

          {/* Edit button */}
          {onUpdateMetric && (
            <button onClick={(e) => { e.stopPropagation(); openEdit(); }}
              className="shrink-0 w-8 h-8 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl flex items-center justify-center text-sm transition-colors">✏️</button>
          )}

          {/* Frequency */}
          <div className="relative shrink-0">
            <button onClick={() => setShowFreqMenu(f=>!f)} className="text-[10px] bg-slate-700/60 text-slate-300 px-2 py-1 rounded-lg border border-white/10">{FREQ_LABELS[frequency]}</button>
            {showFreqMenu && (
              <div className="absolute right-0 top-7 z-30 bg-slate-800 border border-white/20 rounded-xl shadow-2xl py-1 min-w-[80px]">
                {(Object.entries(FREQ_LABELS) as [PerformanceFrequency,string][]).map(([f,l]) => (
                  <button key={f} onClick={() => { onFrequencyChange(f); setShowFreqMenu(false); }}
                    className={'w-full text-left px-3 py-2 text-xs ' + (frequency===f ? 'text-blue-300 font-bold' : 'text-slate-300')}>{l}</button>
                ))}
              </div>
            )}
          </div>

          {/* Add record */}
          <button onClick={(e) => { e.stopPropagation(); setShowForm(f=>!f); setShowEdit(false); }}
            className="shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center text-lg font-bold transition-colors">+</button>
        </div>


        {/* Record add form */}
        {showForm && !showEdit && (
          <div className="px-4 pb-3 border-t border-white/5">
            <div className="bg-slate-700/40 rounded-xl p-3 mt-2 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">📅 日付</label>
                  <input type="date" value={formDate.split('/').join('-')} onChange={e=>setFormDate(e.target.value.split('-').join('/'))}
                    className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">📊 記録 ({unit})</label>
                  <input type="number" step="0.01" inputMode="decimal" value={formValue} onChange={e=>setFormValue(e.target.value)}
                    placeholder={unit==='秒'?'12.5':unit==='m'?'20':'30'}
                    className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <input type="text" value={formMemo} onChange={e=>setFormMemo(e.target.value)} placeholder="メモ（任意）"
                className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400" />
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={!formValue}
                  className="flex-1 bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-sm">💾 保存</button>
                <button onClick={() => setShowForm(false)} className="flex-1 bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-sm">キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {/* Inline edit form */}
        {showEdit && onUpdateMetric && (
          <div className="px-4 pb-3 border-t border-white/5">
            <div className="bg-slate-700/30 rounded-xl p-3 mt-2 space-y-2">
              <p className="text-xs font-bold text-blue-200 mb-1">✏️ メニューを編集</p>
              <div className="flex gap-2">
                <div className="w-14">
                  <label className="block text-[10px] text-slate-400 mb-1">アイコン</label>
                  <input value={editIcon} onChange={e=>setEditIcon(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-400" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">名前</label>
                  <input value={editLabel} onChange={e=>setEditLabel(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400" />
                </div>
                <div className="w-18">
                  <label className="block text-[10px] text-slate-400 mb-1">単位</label>
                  <input value={editUnit} onChange={e=>setEditUnit(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-[10px] text-slate-400 mb-1">カテゴリ</label>
                  <select value={editSection} onChange={e=>setEditSection(e.target.value as CustomMetricDef['section'])}
                    className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none">
                    <option value="physical">フィジカル</option>
                    <option value="ball">ボールコントロール</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-[10px] text-slate-400 mb-1">頻度</label>
                  <select value={editFreq} onChange={e=>setEditFreq(e.target.value as PerformanceFrequency)}
                    className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none">
                    {(Object.entries(FREQ_LABELS) as [PerformanceFrequency,string][]).map(([f,l]) => <option key={f} value={f}>{l}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={editLower} onChange={e=>setEditLower(e.target.checked)} className="rounded" />
                値が小さい方が良い
              </label>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">📋 計測方法</label>
                <textarea value={editHow} onChange={e=>setEditHow(e.target.value)} rows={2} placeholder="計測方法の説明（任意）"
                  className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400 resize-none" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">📎 参考URL</label>
                <input type="url" value={editUrl} onChange={e=>setEditUrl(e.target.value)} placeholder="https://..."
                  className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">🏷️ タグ</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {editTags.map(t => (
                    <span key={t} onClick={() => setEditTags(prev => prev.filter(x=>x!==t))}
                      className="text-[10px] bg-blue-600/30 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-red-600/30 hover:text-red-300 hover:border-red-500/30 transition-colors">{t} ✕</span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={editTagInput} onChange={e=>setEditTagInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();handleAddEditTag();} }}
                    placeholder="タグ名（例: 10分トレーニング）"
                    className="flex-1 rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400" />
                  <button onClick={handleAddEditTag} className="bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs">追加</button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-sm">保存</button>
                <button onClick={() => setShowEdit(false)} className="flex-1 bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-sm">キャンセル</button>
                {onDeleteMetric && (
                  <button onClick={() => { setShowEdit(false); setShowDeleteConfirm(true); }}
                    className="px-3 bg-red-900/50 hover:bg-red-800/60 text-red-400 font-bold py-2 rounded-xl text-sm">🗑️</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expanded: detail + chart + history */}
        {open && !showForm && !showEdit && (
          <div className="px-4 pb-4 border-t border-white/5">
            {/* Detail info */}
            {(howToMeasure || referenceUrl) && (
              <div className="mt-3 space-y-1.5">
                {howToMeasure && (
                  <div className="bg-slate-700/30 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-slate-400 mb-0.5 font-semibold">📋 計測方法</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{howToMeasure}</p>
                  </div>
                )}
                {referenceUrl && (
                  <div className="bg-slate-700/30 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-slate-400 mb-0.5 font-semibold">📎 参考URL</p>
                    <a href={referenceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 underline break-all">{referenceUrl}</a>
                  </div>
                )}
              </div>
            )}

            {/* Chart */}
            {sorted.length >= 2 && (
              <div className="h-32 mt-3 mb-3">
                <Line
                  data={{ labels: chartLabels, datasets: [{ data: chartData, borderColor: borderC, backgroundColor: bgC, pointBackgroundColor: ptC, pointRadius: 4, tension: 0.3, fill: true }] }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: { backgroundColor: 'rgba(7,20,40,0.95)', titleColor: '#93c5fd', bodyColor: '#e2e8f0',
                        callbacks: { title: (items) => sorted[items[0].dataIndex]?.date??'', label: (item) => `${item.raw}${unit}` } },
                      datalabels: { align:'top', anchor:'end', color: labelC, font:{size:10,weight:'bold'}, formatter: v=>`${v}` },
                    },
                    scales: {
                      x: { grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'rgba(148,163,184,0.7)',font:{size:9}}, border:{color:'rgba(255,255,255,0.08)'} },
                      y: { grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'rgba(148,163,184,0.7)',font:{size:9}}, border:{color:'rgba(255,255,255,0.08)'} },
                    },
                  } as ChartOptions<'line'>}
                />
              </div>
            )}

            {/* History */}
            {sorted.length > 0 && (
              <div className="space-y-1 mt-2">
                {[...sorted].reverse().slice(0,10).map((r,i) => {
                  const nextRec = [...sorted].reverse()[i+1];
                  const better = nextRec ? (lowerIsBetter ? r.value<nextRec.value : r.value>nextRec.value) : null;
                  return (
                    <div key={r.id} className={'flex items-center gap-2 rounded-xl px-3 py-2 '+(i===0?'bg-slate-700/40':'bg-slate-700/20')}>
                      <span className="text-[10px] text-slate-500 w-12 shrink-0">{r.date.slice(5)}</span>
                      <span className="text-sm font-bold text-white flex-1">{r.value}<span className="text-[10px] font-normal text-slate-400 ml-0.5">{unit}</span></span>
                      {better===true  && <span className="text-[10px] text-green-400">↑</span>}
                      {better===false && <span className="text-[10px] text-red-400">↓</span>}
                      {r.memo && <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{r.memo}</span>}
                      <button onClick={()=>{ if(window.confirm('この記録を削除しますか？')) onDelete(r.id); }} className="text-slate-600 hover:text-red-400 text-base ml-1">×</button>
                    </div>
                  );
                })}
              </div>
            )}
            {sorted.length === 0 && <p className="text-center text-sm text-slate-500 pt-3">まだ記録がありません。＋ で追加しよう！</p>}
          </div>
        )}
      </div>
    </>
  );
}

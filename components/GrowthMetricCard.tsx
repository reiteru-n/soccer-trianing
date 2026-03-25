'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line } from 'react-chartjs-2';
import { PerformanceRecord, PerformanceMetricType, PerformanceFrequency } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, ChartDataLabels);

const FREQ_LABELS: Record<PerformanceFrequency, string> = {
  daily: '毎日',
  weekly: '週1',
  monthly: '月1',
  irregular: '不定期',
};

const FREQ_EXPIRE_DAYS: Record<PerformanceFrequency, number | null> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  irregular: null,
};

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}

function daysSince(dateStr: string): number {
  const [y, m, day] = dateStr.split('/').map(Number);
  const d = new Date(y, m - 1, day);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

interface Props {
  metricType: PerformanceMetricType;
  label: string;
  icon: string;
  unit: string;
  lowerIsBetter: boolean;
  frequency: PerformanceFrequency;
  onFrequencyChange: (f: PerformanceFrequency) => void;
  records: PerformanceRecord[];
  onAdd: (record: Omit<PerformanceRecord, 'id'>) => void;
  onDelete: (id: string) => void;
}

export default function GrowthMetricCard({
  metricType, label, icon, unit, lowerIsBetter,
  frequency, onFrequencyChange, records, onAdd, onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFreqMenu, setShowFreqMenu] = useState(false);
  const [formDate, setFormDate] = useState(todayStr());
  const [formValue, setFormValue] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [formUrl, setFormUrl] = useState('');

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  const bestRecord = records.length > 0
    ? records.reduce((best, r) =>
        lowerIsBetter ? (r.value < best.value ? r : best) : (r.value > best.value ? r : best)
      )
    : null;

  // expired badge
  const expireDays = FREQ_EXPIRE_DAYS[frequency];
  const daysSinceLatest = latest ? daysSince(latest.date) : Infinity;
  const isExpired = expireDays !== null && daysSinceLatest >= expireDays;
  const needsUpdate = isExpired || records.length === 0;

  // improved badge
  let improved: boolean | null = null;
  if (latest && prev) {
    improved = lowerIsBetter
      ? latest.value < prev.value
      : latest.value > prev.value;
  }

  const handleAdd = () => {
    const val = parseFloat(formValue);
    if (isNaN(val)) return;
    onAdd({
      date: formDate,
      metricType,
      value: val,
      memo: formMemo || undefined,
      referenceUrl: formUrl || undefined,
    });
    setFormValue(''); setFormMemo(''); setFormUrl('');
    setFormDate(todayStr());
    setShowForm(false);
    setOpen(true);
  };

  // Chart
  const chartLabels = sorted.map(r => r.date.slice(5));
  const chartData = sorted.map(r => r.value);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${needsUpdate ? 'border-orange-500/50 bg-orange-950/20' : 'border-white/10 bg-slate-800/80'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className="text-xl shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-white">{label}</span>
              {needsUpdate && records.length === 0 && (
                <span className="text-[10px] bg-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded-full">未記録</span>
              )}
              {needsUpdate && records.length > 0 && (
                <span className="text-[10px] bg-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded-full">更新期限</span>
              )}
              {!needsUpdate && improved === true && (
                <span className="text-[10px] bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded-full">↑ 記録更新</span>
              )}
              {!needsUpdate && improved === false && (
                <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full">↓ 前回より低下</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {latest ? (
                <span className="text-lg font-extrabold text-white leading-none">
                  {latest.value}<span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>
                </span>
              ) : (
                <span className="text-sm text-slate-500">-</span>
              )}
              {bestRecord && bestRecord.id !== latest?.id && (
                <span className="text-[10px] text-slate-400">最高: {bestRecord.value}{unit}</span>
              )}
            </div>
          </div>
          <span className="text-slate-400 text-xs ml-1">{open ? '▲' : '▼'}</span>
        </button>

        {/* Frequency selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowFreqMenu(f => !f)}
            className="text-[10px] bg-slate-700/60 text-slate-300 px-2 py-1 rounded-lg border border-white/10"
          >
            {FREQ_LABELS[frequency]}
          </button>
          {showFreqMenu && (
            <div className="absolute right-0 top-7 z-30 bg-slate-800 border border-white/20 rounded-xl shadow-2xl py-1 min-w-[80px]">
              {(Object.entries(FREQ_LABELS) as [PerformanceFrequency, string][]).map(([f, l]) => (
                <button
                  key={f}
                  onClick={() => { onFrequencyChange(f); setShowFreqMenu(false); }}
                  className={'w-full text-left px-3 py-2 text-xs ' + (frequency === f ? 'text-blue-300 font-bold' : 'text-slate-300')}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add button */}
        <button
          onClick={() => { setShowForm(f => !f); setOpen(true); }}
          className="shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center text-lg font-bold transition-colors"
        >
          +
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="px-4 pb-3 border-t border-white/5">
          <div className="bg-slate-700/40 rounded-xl p-3 mt-2 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-400 mb-1">📅 日付</label>
                <input
                  type="date"
                  value={formDate.split('/').join('-')}
                  onChange={e => setFormDate(e.target.value.split('-').join('/'))}
                  className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-slate-400 mb-1">📊 記録 ({unit})</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  placeholder={`例: ${unit === '秒' ? '12.5' : unit === 'm' ? '20' : '30'}`}
                  className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <input
              type="text"
              value={formMemo}
              onChange={e => setFormMemo(e.target.value)}
              placeholder="メモ（任意）"
              className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400"
            />
            <input
              type="url"
              value={formUrl}
              onChange={e => setFormUrl(e.target.value)}
              placeholder="参考URL（任意）"
              className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!formValue}
                className="flex-1 bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-sm"
              >
                💾 保存
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded: chart + history */}
      {open && !showForm && sorted.length > 0 && (
        <div className="px-4 pb-4 border-t border-white/5">
          {/* Chart */}
          {sorted.length >= 2 && (
            <div className="h-32 mt-3 mb-3">
              <Line
                data={{
                  labels: chartLabels,
                  datasets: [{
                    data: chartData,
                    borderColor: lowerIsBetter ? '#f97316' : '#60a5fa',
                    backgroundColor: lowerIsBetter ? 'rgba(249,115,22,0.08)' : 'rgba(96,165,250,0.08)',
                    pointBackgroundColor: lowerIsBetter ? '#f97316' : '#f472b6',
                    pointRadius: 4,
                    tension: 0.3,
                    fill: true,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(7,20,40,0.95)',
                      titleColor: '#93c5fd',
                      bodyColor: '#e2e8f0',
                      callbacks: {
                        title: (items) => sorted[items[0].dataIndex]?.date ?? '',
                        label: (item) => `${item.raw}${unit}`,
                      },
                    },
                    datalabels: {
                      align: 'top', anchor: 'end',
                      color: lowerIsBetter ? '#fb923c' : '#93c5fd',
                      font: { size: 10, weight: 'bold' },
                      formatter: v => `${v}`,
                    },
                  },
                  scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(148,163,184,0.7)', font: { size: 9 } }, border: { color: 'rgba(255,255,255,0.08)' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(148,163,184,0.7)', font: { size: 9 }, callback: v => `${v}` }, border: { color: 'rgba(255,255,255,0.08)' } },
                  },
                } as ChartOptions<'line'>}
              />
            </div>
          )}

          {/* History list */}
          <div className="space-y-1">
            {[...sorted].reverse().slice(0, 10).map((r, i) => {
              const isLatestRec = i === 0;
              const nextRec = [...sorted].reverse()[i + 1];
              const better = nextRec
                ? (lowerIsBetter ? r.value < nextRec.value : r.value > nextRec.value)
                : null;
              return (
                <div key={r.id} className={'flex items-center gap-2 rounded-xl px-3 py-2 ' + (isLatestRec ? 'bg-slate-700/40' : 'bg-slate-700/20')}>
                  <span className="text-[10px] text-slate-500 w-12 shrink-0">{r.date.slice(5)}</span>
                  <span className="text-sm font-bold text-white flex-1">
                    {r.value}<span className="text-[10px] font-normal text-slate-400 ml-0.5">{unit}</span>
                  </span>
                  {better === true && <span className="text-[10px] text-green-400">↑</span>}
                  {better === false && <span className="text-[10px] text-red-400">↓</span>}
                  {r.memo && <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{r.memo}</span>}
                  <button
                    onClick={() => { if (window.confirm('この記録を削除しますか？')) onDelete(r.id); }}
                    className="text-slate-600 hover:text-red-400 text-base ml-1"
                  >×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && sorted.length === 0 && !showForm && (
        <div className="px-4 pb-4 text-center text-sm text-slate-500 border-t border-white/5 pt-3">
          まだ記録がありません。＋ で追加しよう！
        </div>
      )}
    </div>
  );
}

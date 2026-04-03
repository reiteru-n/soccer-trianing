'use client';
import { useMemo } from 'react';
import { Chart as ChartJS, LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';
import type { BodyRecord } from '@/lib/types';

ChartJS.register(LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Legend);

function fmtDate(d: string) {
  const parts = d.split('/');
  return `${parts[1]}/${parts[2]}`;
}

// "22:30" → 22.5、"00:30" → 24.5（深夜は24時以降として扱う）
function sleepToDecimal(t: string): number {
  const [h, m] = t.split(':').map(Number);
  const dec = h + m / 60;
  return dec < 6 ? dec + 24 : dec;
}
function decimalToTime(d: number): string {
  const actual = d >= 24 ? d - 24 : d;
  const h = Math.floor(actual);
  const m = Math.round((d % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const CHART_BG = 'bg-slate-800/80 border border-white/10';
const LABEL_CLS = 'text-[11px] font-bold text-blue-200 mb-1.5';

export default function BodyCharts({ records }: { records: BodyRecord[] }) {
  const sorted = useMemo(
    () => [...records].sort((a, b) => a.date.localeCompare(b.date)),
    [records]
  );

  const heightSeries = sorted.filter(r => r.height != null);
  const weightSeries = sorted.filter(r => r.weight != null);
  const allDates = [...new Set([...heightSeries, ...weightSeries].map(r => r.date))].sort();

  // 体重・身長両方ある連続レコード間の差分（相関用）
  const fullRecords = sorted.filter(r => r.weight != null && r.height != null);
  const corrPoints = fullRecords.slice(1).map((r, i) => ({
    x: parseFloat((r.weight! - fullRecords[i].weight!).toFixed(2)),
    y: parseFloat((r.height! - fullRecords[i].height!).toFixed(1)),
  }));

  const sleepSeries = sorted.filter(r => r.sleepTime);

  const showTimeSeries = heightSeries.length > 1 || weightSeries.length > 1;
  const showCorr = corrPoints.length >= 2;
  const showSleep = sleepSeries.length > 1;

  if (!showTimeSeries && !showCorr && !showSleep) return null;

  const tickStyle = { font: { size: 9 as const }, color: '#94a3b8', maxTicksLimit: 5 as const };
  const gridColor = 'rgba(255,255,255,0.05)';

  return (
    <div className="space-y-3 mt-3">
      {/* ① 身長・体重の時系列折れ線（デュアルY軸） */}
      {showTimeSeries && (
        <div>
          <p className={LABEL_CLS}>📈 身長・体重の推移</p>
          <div className={`${CHART_BG} rounded-2xl p-3`}>
            <div style={{ height: 170 }}>
              <Line
                data={{
                  labels: allDates.map(fmtDate),
                  datasets: [
                    {
                      label: '身長 (cm)',
                      data: allDates.map(d => heightSeries.find(r => r.date === d)?.height ?? null),
                      borderColor: '#a78bfa',
                      backgroundColor: 'rgba(167,139,250,0.15)',
                      yAxisID: 'yH',
                      tension: 0.35,
                      spanGaps: true,
                      pointRadius: 4,
                      pointBackgroundColor: '#a78bfa',
                    },
                    {
                      label: '体重 (kg)',
                      data: allDates.map(d => weightSeries.find(r => r.date === d)?.weight ?? null),
                      borderColor: '#34d399',
                      backgroundColor: 'rgba(52,211,153,0.15)',
                      yAxisID: 'yW',
                      tension: 0.35,
                      spanGaps: true,
                      pointRadius: 4,
                      pointBackgroundColor: '#34d399',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { labels: { color: '#cbd5e1', font: { size: 10 }, boxWidth: 12 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}` } },
                  },
                  scales: {
                    x: { ticks: tickStyle, grid: { color: gridColor } },
                    yH: {
                      type: 'linear', position: 'left',
                      ticks: { ...tickStyle, maxTicksLimit: 4, callback: v => `${v}` },
                      grid: { color: gridColor },
                      title: { display: true, text: 'cm', color: '#64748b', font: { size: 9 } },
                    },
                    yW: {
                      type: 'linear', position: 'right',
                      ticks: { ...tickStyle, maxTicksLimit: 4, callback: v => `${v}` },
                      grid: { drawOnChartArea: false },
                      title: { display: true, text: 'kg', color: '#64748b', font: { size: 9 } },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ② 体重増加 × 身長増加 相関散布図 */}
      {showCorr && (
        <div>
          <p className={LABEL_CLS}>🔗 体重増加 × 身長増加の相関</p>
          <div className={`${CHART_BG} rounded-2xl p-3`}>
            <p className="text-[9px] text-slate-500 mb-1">各点 = 前回記録との差分。右上ほど両方増えている。</p>
            <div style={{ height: 160 }}>
              <Scatter
                data={{
                  datasets: [{
                    label: '前回比変化',
                    data: corrPoints,
                    backgroundColor: corrPoints.map(p =>
                      p.x >= 0 && p.y >= 0 ? 'rgba(52,211,153,0.8)' :
                      p.x < 0 && p.y >= 0 ? 'rgba(167,139,250,0.8)' :
                      'rgba(248,113,113,0.8)'
                    ),
                    pointRadius: 7,
                    pointHoverRadius: 9,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: ctx => {
                          const x = ctx.parsed.x ?? 0;
                          const y = ctx.parsed.y ?? 0;
                          return `体重 ${x >= 0 ? '+' : ''}${x}kg / 身長 ${y >= 0 ? '+' : ''}${y}cm`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: { ...tickStyle, maxTicksLimit: 5 },
                      grid: { color: gridColor },
                      title: { display: true, text: '体重変化 (kg)', color: '#64748b', font: { size: 9 } },
                    },
                    y: {
                      ticks: { ...tickStyle, maxTicksLimit: 4 },
                      grid: { color: gridColor },
                      title: { display: true, text: '身長変化 (cm)', color: '#64748b', font: { size: 9 } },
                    },
                  },
                }}
              />
            </div>
            <div className="flex gap-3 mt-1.5 justify-center">
              <span className="text-[9px] text-emerald-400">● 体重↑身長↑</span>
              <span className="text-[9px] text-violet-400">● 体重↓身長↑</span>
              <span className="text-[9px] text-red-400">● その他</span>
            </div>
          </div>
        </div>
      )}

      {/* ③ 就寝時刻の推移 */}
      {showSleep && (
        <div>
          <p className={LABEL_CLS}>😴 就寝時刻の推移</p>
          <div className={`${CHART_BG} rounded-2xl p-3`}>
            <div style={{ height: 145 }}>
              <Line
                data={{
                  labels: sleepSeries.map(r => fmtDate(r.date)),
                  datasets: [{
                    label: '就寝時刻',
                    data: sleepSeries.map(r => sleepToDecimal(r.sleepTime!)),
                    borderColor: '#818cf8',
                    backgroundColor: 'rgba(129,140,248,0.12)',
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: '#818cf8',
                    fill: true,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: { label: ctx => `就寝: ${decimalToTime(ctx.parsed.y ?? 0)}` },
                    },
                  },
                  scales: {
                    x: { ticks: tickStyle, grid: { color: gridColor } },
                    y: {
                      ticks: { ...tickStyle, maxTicksLimit: 4, callback: v => decimalToTime(v as number) },
                      grid: { color: gridColor },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

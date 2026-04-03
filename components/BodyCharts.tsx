'use client';
import { useMemo } from 'react';
import { Chart as ChartJS, LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';
import type { BodyRecord } from '@/lib/types';

ChartJS.register(LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Legend);

// ageYears: BodyChart.tsx と同じ実装
function ageYears(birth: string, date: string): number {
  const [by, bm, bd] = birth.split('/').map(Number);
  const [dy, dm, dd] = date.split('/').map(Number);
  return (new Date(dy, dm - 1, dd).getTime() - new Date(by, bm - 1, bd).getTime()) / 31557600000;
}

function dateToTs(date: string): number {
  const [y, m, d] = date.split('/').map(Number);
  return new Date(y, m - 1, d).getTime();
}

// 前後の記録から線形補完
function interpolateValue(
  series: { date: string; value: number | undefined }[],
  targetDate: string
): number | null {
  const tTs = dateToTs(targetDate);
  const pts = series.filter(r => r.value != null) as { date: string; value: number }[];
  if (pts.length === 0) return null;
  const prev = [...pts].reverse().find(r => dateToTs(r.date) <= tTs);
  const next = pts.find(r => dateToTs(r.date) >= tTs);
  if (!prev && !next) return null;
  if (!prev) return next!.value;
  if (!next) return prev.value;
  if (prev.date === next.date) return prev.value;
  const t = (tTs - dateToTs(prev.date)) / (dateToTs(next.date) - dateToTs(prev.date));
  return prev.value + t * (next.value - prev.value);
}

// "22:30" → 22.5、深夜は 24+
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
// BodyChart.tsx に合わせた色
const COLOR_H = 'rgb(234,88,12)';   // オレンジ（身長）
const COLOR_W = 'rgb(37,99,235)';   // ブルー（体重）

export default function BodyCharts({ records, birthDate }: { records: BodyRecord[]; birthDate: string }) {
  const sorted = useMemo(
    () => [...records].sort((a, b) => a.date.localeCompare(b.date)),
    [records]
  );

  const hasAge = !!birthDate;

  // 推移グラフ用（年齢 x 軸）
  const heightAgePoints = useMemo(
    () => hasAge ? sorted.filter(r => r.height != null).map(r => ({ x: ageYears(birthDate, r.date), y: r.height! })) : [],
    [sorted, birthDate, hasAge]
  );
  const weightAgePoints = useMemo(
    () => hasAge ? sorted.filter(r => r.weight != null).map(r => ({ x: ageYears(birthDate, r.date), y: r.weight! })) : [],
    [sorted, birthDate, hasAge]
  );

  // 補完用シリーズ
  const heightSeries = sorted.map(r => ({ date: r.date, value: r.height }));
  const weightSeries = sorted.map(r => ({ date: r.date, value: r.weight }));

  // 相関散布図用：片方の値がない場合も補完して corrPoints を計算
  const enrichedPoints = useMemo(() => {
    const candidates = sorted.filter(r => r.height != null || r.weight != null);
    return candidates.map(r => ({
      date: r.date,
      height: r.height ?? interpolateValue(heightSeries, r.date),
      weight: r.weight ?? interpolateValue(weightSeries, r.date),
    })).filter(p => p.height != null && p.weight != null) as { date: string; height: number; weight: number }[];
  }, [sorted]);

  const corrPoints = useMemo(
    () => enrichedPoints.slice(1).map((r, i) => ({
      x: parseFloat((r.weight - enrichedPoints[i].weight).toFixed(2)),
      y: parseFloat((r.height - enrichedPoints[i].height).toFixed(1)),
    })),
    [enrichedPoints]
  );

  // 就寝時刻 × 身長成長速度（cm/日）散布図
  const sleepSeries = sorted.filter(r => r.sleepTime);
  const sleepScatterPoints = useMemo(() => {
    if (sleepSeries.length < 2) return [];
    return sleepSeries.slice(1).map((r, i) => {
      const prevR = sleepSeries[i];
      const h = r.height ?? interpolateValue(heightSeries, r.date);
      const prevH = prevR.height ?? interpolateValue(heightSeries, prevR.date);
      if (h == null || prevH == null) return null;
      const daysDiff = (dateToTs(r.date) - dateToTs(prevR.date)) / 86400000;
      if (daysDiff <= 0) return null;
      return {
        x: sleepToDecimal(r.sleepTime!),
        y: parseFloat(((h - prevH) / daysDiff).toFixed(4)),
      };
    }).filter(Boolean) as { x: number; y: number }[];
  }, [sleepSeries, heightSeries]);

  const showTimeSeries = hasAge && (heightAgePoints.length > 1 || weightAgePoints.length > 1);
  const showCorr = corrPoints.length >= 2;
  const showSleep = sleepScatterPoints.length >= 2;

  if (!showTimeSeries && !showCorr && !showSleep) {
    if (!hasAge && sorted.length >= 2) {
      return <p className="text-xs text-slate-400 text-center py-3 mt-2">生年月日を設定すると推移グラフが表示されます</p>;
    }
    return null;
  }

  const tickStyle = { font: { size: 9 as const }, color: '#94a3b8', maxTicksLimit: 5 as const };
  const gridColor = 'rgba(255,255,255,0.05)';
  const noLabels = { datalabels: { display: false as const } };

  return (
    <div className="space-y-3 mt-3">

      {/* ① 身長・体重の推移（年齢軸） */}
      {showTimeSeries && (
        <div>
          <p className={LABEL_CLS}>📈 身長・体重の推移</p>
          <div className={`${CHART_BG} rounded-2xl p-3`}>
            <div style={{ height: 180 }}>
              <Line
                data={{
                  datasets: [
                    {
                      label: '身長 (cm)',
                      data: heightAgePoints,
                      borderColor: COLOR_H,
                      backgroundColor: `rgba(234,88,12,0.12)`,
                      yAxisID: 'yH',
                      tension: 0.35,
                      pointRadius: 3,
                      pointBackgroundColor: COLOR_H,
                    },
                    {
                      label: '体重 (kg)',
                      data: weightAgePoints,
                      borderColor: COLOR_W,
                      backgroundColor: `rgba(37,99,235,0.12)`,
                      yAxisID: 'yW',
                      tension: 0.35,
                      pointRadius: 3,
                      pointBackgroundColor: COLOR_W,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  parsing: false,
                  plugins: {
                    ...noLabels,
                    legend: { labels: { color: '#cbd5e1', font: { size: 10 }, boxWidth: 12 } },
                    tooltip: {
                      callbacks: {
                        title: items => `${(items[0]?.parsed.x ?? 0).toFixed(1)}歳`,
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      type: 'linear',
                      ticks: { ...tickStyle, callback: v => `${(v as number).toFixed(1)}歳` },
                      grid: { color: gridColor },
                    },
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

      {/* 生年月日未設定メッセージ */}
      {!hasAge && sorted.length >= 2 && (
        <p className="text-xs text-slate-400 text-center py-2">生年月日を設定すると年齢軸の推移グラフが表示されます</p>
      )}

      {/* ② 体重増加 × 身長増加の相関 */}
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
                    ...noLabels,
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

      {/* ③ 就寝時刻 × 身長成長速度の相関 */}
      {showSleep && (
        <div>
          <p className={LABEL_CLS}>😴 就寝時刻 × 身長成長の相関</p>
          <div className={`${CHART_BG} rounded-2xl p-3`}>
            <p className="text-[9px] text-slate-500 mb-1">各点 = 就寝時刻と次の記録までの身長増加速度 (cm/日)</p>
            <div style={{ height: 160 }}>
              <Scatter
                data={{
                  datasets: [{
                    label: '就寝時刻 × 成長',
                    data: sleepScatterPoints,
                    backgroundColor: 'rgba(129,140,248,0.75)',
                    pointRadius: 6,
                    pointHoverRadius: 9,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    ...noLabels,
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: ctx => `就寝: ${decimalToTime(ctx.parsed.x ?? 0)} / 成長: ${(ctx.parsed.y ?? 0).toFixed(3)}cm/日`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      type: 'linear',
                      ticks: { ...tickStyle, maxTicksLimit: 5, callback: v => decimalToTime(v as number) },
                      grid: { color: gridColor },
                      title: { display: true, text: '就寝時刻', color: '#64748b', font: { size: 9 } },
                    },
                    y: {
                      ticks: { ...tickStyle, maxTicksLimit: 4 },
                      grid: { color: gridColor },
                      title: { display: true, text: '成長速度 (cm/日)', color: '#64748b', font: { size: 9 } },
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

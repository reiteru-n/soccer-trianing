'use client';
import { useMemo } from 'react';
import {
  Chart as ChartJS, LinearScale, CategoryScale,
  PointElement, LineElement, BarElement, Tooltip, Legend,
} from 'chart.js';
import { Line, Scatter, Chart as ReactChart } from 'react-chartjs-2';
import type { BodyRecord } from '@/lib/types';

ChartJS.register(LinearScale, CategoryScale, PointElement, LineElement, BarElement, Tooltip, Legend);

function ageYears(birth: string, date: string): number {
  const [by, bm, bd] = birth.split('/').map(Number);
  const [dy, dm, dd] = date.split('/').map(Number);
  return (new Date(dy, dm - 1, dd).getTime() - new Date(by, bm - 1, bd).getTime()) / 31557600000;
}

function dateToTs(date: string): number {
  const [y, m, d] = date.split('/').map(Number);
  return new Date(y, m - 1, d).getTime();
}

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

// "22:30" → 22.5、深夜0時台は 24+
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
const COLOR_H = 'rgb(234,88,12)';    // オレンジ（身長）
const COLOR_W = 'rgb(37,99,235)';    // ブルー（体重）
const COLOR_S = 'rgba(129,140,248,0.7)'; // インディゴ（就寝）
const NO_LABELS = { datalabels: { display: false as const } };
const TICK = { font: { size: 9 as const }, color: '#94a3b8', maxTicksLimit: 5 as const };
const GRID = 'rgba(255,255,255,0.05)';

export default function BodyCharts({ records, birthDate }: { records: BodyRecord[]; birthDate: string }) {
  const sorted = useMemo(
    () => [...records].sort((a, b) => a.date.localeCompare(b.date)),
    [records]
  );

  const hasAge = !!birthDate;
  const heightSeries = sorted.map(r => ({ date: r.date, value: r.height }));
  const weightSeries = sorted.map(r => ({ date: r.date, value: r.weight }));

  // ① 推移グラフ（年齢 × 身長/体重）
  const heightAgePoints = useMemo(
    () => hasAge ? sorted.filter(r => r.height != null).map(r => ({ x: ageYears(birthDate, r.date), y: r.height! })) : [],
    [sorted, birthDate, hasAge]
  );
  const weightAgePoints = useMemo(
    () => hasAge ? sorted.filter(r => r.weight != null).map(r => ({ x: ageYears(birthDate, r.date), y: r.weight! })) : [],
    [sorted, birthDate, hasAge]
  );

  // ② 相関散布図（体重 × 身長の実測値）
  const corrPoints = useMemo(() => {
    return sorted
      .filter(r => r.weight != null || r.height != null)
      .map(r => ({
        x: r.weight ?? interpolateValue(weightSeries, r.date),
        y: r.height ?? interpolateValue(heightSeries, r.date),
      }))
      .filter(p => p.x != null && p.y != null) as { x: number; y: number }[];
  }, [sorted]);

  // ③ 就寝時刻 × 身長 複合チャート（横軸=年齢）
  const sleepSeries = sorted.filter(r => r.sleepTime);
  const sleepCombinedData = useMemo(() => {
    if (!hasAge) return null;
    const nowTs = Date.now();
    const periodMs = 1.5 * 365 * 24 * 60 * 60 * 1000;
    const periodStartTs = nowTs - periodMs;
    const todayStr = new Date(nowTs).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    const periodStartStr = new Date(periodStartTs).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    const xMax = ageYears(birthDate, todayStr);
    const xMin = ageYears(birthDate, periodStartStr);

    // 身長：全記録を含める（左端でグラフが途切れて見えないよう期間外も含む）
    const hLine = sorted
      .filter(r => r.height != null)
      .map(r => ({ x: ageYears(birthDate, r.date), y: r.height! }));

    // 就寝時刻：期間内のみ
    const sBars = sleepSeries
      .filter(r => dateToTs(r.date) >= periodStartTs - 1)
      .map(r => ({
        x: ageYears(birthDate, r.date),
        y: sleepToDecimal(r.sleepTime!),
      }));

    // 期間内のデータから Y 軸レンジを計算
    const hInPeriod = sorted
      .filter(r => r.height != null && dateToTs(r.date) >= periodStartTs - 1)
      .map(r => r.height!);
    const yHMin = hInPeriod.length > 0 ? Math.min(...hInPeriod) - 5 : undefined;
    const yHMax = hInPeriod.length > 0 ? Math.max(...hInPeriod) + 5 : undefined;

    const sVals = sBars.map(r => r.y);
    const ySMin = sVals.length > 0 ? Math.min(...sVals) - 0.5 : undefined;
    const ySMax = sVals.length > 0 ? Math.max(...sVals) + 0.5 : undefined;

    return { hLine, sBars, xMin, xMax, yHMin, yHMax, ySMin, ySMax };
  }, [sorted, sleepSeries, birthDate, hasAge]);

  const showTimeSeries = hasAge && (heightAgePoints.length > 1 || weightAgePoints.length > 1);
  const showCorr = corrPoints.length >= 2;
  const showSleep = !!sleepCombinedData && sleepCombinedData.sBars.length >= 2 && sleepCombinedData.hLine.length >= 2;

  if (!showTimeSeries && !showCorr && !showSleep) {
    if (!hasAge && sorted.length >= 2) {
      return <p className="text-xs text-slate-400 text-center py-3 mt-2">生年月日を設定すると推移グラフが表示されます</p>;
    }
    return null;
  }

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
                      backgroundColor: 'rgba(234,88,12,0.12)',
                      yAxisID: 'yH',
                      tension: 0.35,
                      pointRadius: 3,
                      pointBackgroundColor: COLOR_H,
                    },
                    {
                      label: '体重 (kg)',
                      data: weightAgePoints,
                      borderColor: COLOR_W,
                      backgroundColor: 'rgba(37,99,235,0.12)',
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
                    ...NO_LABELS,
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
                      ticks: { ...TICK, callback: v => `${(v as number).toFixed(1)}歳` },
                      grid: { color: GRID },
                    },
                    yH: {
                      type: 'linear', position: 'left',
                      ticks: { ...TICK, maxTicksLimit: 4, callback: v => `${v}cm` },
                      grid: { color: GRID },
                    },
                    yW: {
                      type: 'linear', position: 'right',
                      ticks: { ...TICK, maxTicksLimit: 4, callback: v => `${v}kg` },
                      grid: { drawOnChartArea: false },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {!hasAge && sorted.length >= 2 && (
        <p className="text-xs text-slate-400 text-center py-2">生年月日を設定すると年齢軸の推移グラフが表示されます</p>
      )}

      {/* ② 体重 × 身長の相関散布図（実測値） */}
      {showCorr && (
        <div>
          <p className={LABEL_CLS}>🔗 体重 × 身長の相関</p>
          <div className={`${CHART_BG} rounded-2xl p-3`}>
            <p className="text-[9px] text-slate-500 mb-1">横軸 = 体重 / 縦軸 = 身長。右上に伸びるほど体重・身長ともに成長。</p>
            <div style={{ height: 165 }}>
              <Scatter
                data={{
                  datasets: [{
                    label: '実測値',
                    data: corrPoints,
                    backgroundColor: 'rgba(37,99,235,0.65)',
                    pointRadius: 5,
                    pointHoverRadius: 8,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    ...NO_LABELS,
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: ctx => `体重 ${(ctx.parsed.x ?? 0).toFixed(1)}kg / 身長 ${(ctx.parsed.y ?? 0).toFixed(1)}cm`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: { ...TICK, maxTicksLimit: 5, callback: v => `${v}kg` },
                      grid: { color: GRID },
                      title: { display: true, text: '体重 (kg)', color: '#64748b', font: { size: 9 } },
                    },
                    y: {
                      ticks: { ...TICK, maxTicksLimit: 4, callback: v => `${v}cm` },
                      grid: { color: GRID },
                      title: { display: true, text: '身長 (cm)', color: '#64748b', font: { size: 9 } },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ③ 就寝時刻 × 身長の複合チャート（横軸=年齢、左=身長折れ線、右=就寝時刻棒グラフ） */}
      {showSleep && sleepCombinedData && (
        <div>
          <p className={LABEL_CLS}>😴 就寝時刻と身長の推移</p>
          <div className={`${CHART_BG} rounded-2xl p-3`}>
            <p className="text-[9px] text-slate-500 mb-1">
              <span style={{ color: COLOR_H }}>━</span> 身長 (左軸) &nbsp;
              <span style={{ color: 'rgba(129,140,248,1)' }}>▊</span> 就寝時刻 (右軸)
            </p>
            <div style={{ height: 175 }}>
              <ReactChart
                type="bar"
                data={{
                  datasets: [
                    {
                      type: 'line' as const,
                      label: '身長 (cm)',
                      data: sleepCombinedData.hLine,
                      borderColor: COLOR_H,
                      backgroundColor: 'rgba(234,88,12,0.1)',
                      yAxisID: 'yH',
                      tension: 0.35,
                      pointRadius: 3,
                      pointBackgroundColor: COLOR_H,
                      order: 1,
                    },
                    {
                      type: 'bar' as const,
                      label: '就寝時刻',
                      data: sleepCombinedData.sBars,
                      backgroundColor: COLOR_S,
                      yAxisID: 'yS',
                      barThickness: 6,
                      order: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    ...NO_LABELS,
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        title: (items: import('chart.js').TooltipItem<'bar'>[]) => `${(items[0]?.parsed.x ?? 0).toFixed(1)}歳`,
                        label: (ctx: import('chart.js').TooltipItem<'bar'>) => ctx.datasetIndex === 0
                          ? `身長: ${ctx.parsed.y}cm`
                          : `就寝: ${decimalToTime(ctx.parsed.y ?? 0)}`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      type: 'linear',
                      min: sleepCombinedData.xMin,
                      max: sleepCombinedData.xMax,
                      ticks: { ...TICK, callback: (v: number | string) => `${(Number(v)).toFixed(1)}歳` },
                      grid: { color: GRID },
                    },
                    yH: {
                      type: 'linear', position: 'left',
                      min: sleepCombinedData.yHMin,
                      max: sleepCombinedData.yHMax,
                      ticks: { ...TICK, maxTicksLimit: 4, callback: (v: number | string) => `${v}cm` },
                      grid: { color: GRID },
                      title: { display: true, text: '身長 (cm)', color: 'rgb(234,88,12)', font: { size: 9 } },
                    },
                    yS: {
                      type: 'linear', position: 'right',
                      min: sleepCombinedData.ySMin,
                      max: sleepCombinedData.ySMax,
                      ticks: { ...TICK, maxTicksLimit: 4, callback: (v: number | string) => decimalToTime(Number(v)) },
                      grid: { drawOnChartArea: false },
                      title: { display: true, text: '就寝時刻', color: 'rgba(129,140,248,1)', font: { size: 9 } },
                    },
                  },
                } as any}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

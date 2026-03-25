'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend, ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { PerformanceRecord } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface MetricInfo {
  type: string;
  label: string;
  icon: string;
  lowerIsBetter: boolean;
}

interface Props {
  metrics: MetricInfo[];
  records: PerformanceRecord[];
}

const COLORS = ['#60a5fa','#f472b6','#34d399','#fb923c','#a78bfa','#facc15','#38bdf8','#f87171'];

export default function TagSummaryChart({ metrics, records }: Props) {
  const { labels, datasets } = useMemo(() => {
    const dateSet = new Set<string>();
    metrics.forEach(m =>
      records.filter(r => r.metricType === m.type).forEach(r => dateSet.add(r.date))
    );
    const allDates = [...dateSet].sort();

    const datasets = metrics.flatMap((m, i) => {
      const recs = [...records.filter(r => r.metricType === m.type)]
        .sort((a, b) => a.date.localeCompare(b.date));
      if (recs.length < 2) return [];

      const firstVal = recs[0].value;
      const color = COLORS[i % COLORS.length];

      const dateToNorm = new Map<string, number>();
      recs.forEach(r => {
        const raw = firstVal === 0 ? 0 : ((r.value - firstVal) / Math.abs(firstVal)) * 100;
        dateToNorm.set(r.date, m.lowerIsBetter ? -raw : raw);
      });

      return [{
        label: `${m.icon} ${m.label}`,
        data: allDates.map(d => dateToNorm.has(d) ? dateToNorm.get(d)! : null),
        borderColor: color,
        backgroundColor: color + '18',
        pointBackgroundColor: color,
        pointRadius: 3,
        tension: 0.3,
        spanGaps: true,
      }];
    });

    return { labels: allDates.map(d => d.slice(5)), datasets };
  }, [metrics, records]);

  if (datasets.length === 0) return null;

  return (
    <div className="mb-4 bg-slate-800/80 rounded-2xl border border-blue-500/20 p-4">
      <p className="text-xs font-bold text-blue-200 mb-1">📊 タグ別まとめグラフ</p>
      <p className="text-[10px] text-slate-500 mb-3">初回記録を基準とした改善率（上が良い）</p>
      <div className="h-44">
        <Line
          data={{ labels, datasets: datasets as Parameters<typeof Line>[0]['data']['datasets'] }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10, padding: 8 },
              },
              tooltip: {
                backgroundColor: 'rgba(7,20,40,0.95)',
                titleColor: '#93c5fd',
                bodyColor: '#e2e8f0',
                callbacks: { label: item => `${item.dataset.label}: ${(item.raw as number).toFixed(1)}%` },
              },
              datalabels: { display: false },
            },
            scales: {
              x: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: 'rgba(148,163,184,0.7)', font: { size: 9 } },
                border: { color: 'rgba(255,255,255,0.08)' },
              },
              y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                  color: 'rgba(148,163,184,0.7)', font: { size: 9 },
                  callback: v => `${(v as number) > 0 ? '+' : ''}${v}%`,
                },
                border: { color: 'rgba(255,255,255,0.08)' },
              },
            },
          } as ChartOptions<'line'>}
        />
      </div>
    </div>
  );
}

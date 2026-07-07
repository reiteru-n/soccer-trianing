'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line } from 'react-chartjs-2';
import { SprintRecord } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ChartDataLabels);

interface Props {
  records: SprintRecord[];
}

// タイムは速いほど良い（値が小さいほど良い）ため、成長グラフと同じオレンジ系配色を使う
export default function SprintChart({ records }: Props) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map((r) => r.date.slice(5)); // mm/dd
  const data = sorted.map((r) => r.timeSeconds);

  const chartData = {
    labels,
    datasets: [
      {
        label: '50m走タイム',
        data,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,0.10)',
        pointBackgroundColor: '#fb923c',
        pointBorderColor: '#7c2d12',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(7,20,40,0.95)',
        borderColor: 'rgba(249,115,22,0.3)',
        borderWidth: 1,
        titleColor: '#fdba74',
        bodyColor: '#e2e8f0',
        callbacks: {
          title: (items) => sorted[items[0].dataIndex]?.date ?? '',
          label: (item) => `${item.raw}秒`,
        },
      },
      datalabels: {
        align: 'top',
        anchor: 'end',
        color: '#fb923c',
        font: { weight: 'bold', size: 11 },
        formatter: (v) => `${v}`,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: 'rgba(148,163,184,0.8)', font: { size: 11 }, maxRotation: 45 },
        border: { color: 'rgba(255,255,255,0.1)' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: 'rgba(148,163,184,0.8)', font: { size: 11 }, callback: (v) => `${v}秒` },
        border: { color: 'rgba(255,255,255,0.1)' },
      },
    },
  };

  if (sorted.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
        データがありません
      </div>
    );
  }

  return (
    <div className="h-56 md:h-72">
      <Line data={chartData} options={options} />
    </div>
  );
}

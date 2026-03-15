'use client';

import { useEffect, useRef } from 'react';
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
import { LiftingRecord, LiftingPart, LiftingSide } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ChartDataLabels);

interface Props {
  records: LiftingRecord[];
  filterPart: LiftingPart | 'all';
  filterSide: LiftingSide | 'all';
}

export default function LiftingChart({ records, filterPart, filterSide }: Props) {
  const filtered = records
    .filter((r) => (filterPart === 'all' || r.part === filterPart) && (filterSide === 'all' || r.side === filterSide))
    .sort((a, b) => a.date.localeCompare(b.date));

  const labels = filtered.map((r) => r.date.slice(5)); // mm/dd
  const data = filtered.map((r) => r.count);

  const chartData = {
    labels,
    datasets: [
      {
        label: `${filterPart === 'all' ? '全部位' : filterPart} ${filterSide === 'all' ? '全' : filterSide}`,
        data,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96,165,250,0.12)',
        pointBackgroundColor: '#f472b6',
        pointBorderColor: '#1e3a5f',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.4,
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
        borderColor: 'rgba(96,165,250,0.3)',
        borderWidth: 1,
        titleColor: '#93c5fd',
        bodyColor: '#e2e8f0',
        callbacks: {
          title: (items) => filtered[items[0].dataIndex]?.date ?? '',
          label: (item) => `${item.raw}回`,
        },
      },
      datalabels: {
        align: 'top',
        anchor: 'end',
        color: '#93c5fd',
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
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: 'rgba(148,163,184,0.8)', font: { size: 11 }, callback: (v) => `${v}回` },
        border: { color: 'rgba(255,255,255,0.1)' },
      },
    },
  };

  if (filtered.length === 0) {
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

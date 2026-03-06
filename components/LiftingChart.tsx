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
        borderColor: '#2E86C1',
        backgroundColor: 'rgba(46,134,193,0.15)',
        pointBackgroundColor: '#E74C3C',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
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
        callbacks: {
          title: (items) => filtered[items[0].dataIndex]?.date ?? '',
          label: (item) => `${item.raw}回`,
        },
      },
      datalabels: {
        align: 'top',
        anchor: 'end',
        color: '#2E86C1',
        font: { weight: 'bold', size: 11 },
        formatter: (v) => `${v}`,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 11 }, maxRotation: 45 },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 11 }, callback: (v) => `${v}回` },
      },
    },
  };

  if (filtered.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
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

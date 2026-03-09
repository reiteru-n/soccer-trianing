'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { PracticeNote } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  notes: PracticeNote[];
}

const CATEGORIES = ['チーム練習', 'スクール', '試合', 'セレクション', '自主練', 'その他'];
const CATEGORY_COLORS: Record<string, string> = {
  'チーム練習':   'rgba(59,130,246,0.85)',
  'スクール':     'rgba(34,197,94,0.85)',
  '試合':         'rgba(239,68,68,0.85)',
  'セレクション': 'rgba(168,85,247,0.85)',
  '自主練':       'rgba(249,115,22,0.85)',
  'その他':       'rgba(156,163,175,0.85)',
};

export default function PracticeBarChart({ notes }: Props) {
  if (notes.length === 0) return null;

  // collect all months (yyyy/mm) sorted
  const monthSet = new Set<string>();
  for (const n of notes) monthSet.add(n.date.slice(0, 7));
  const months = [...monthSet].sort();

  // month → category → count
  const data: Record<string, Record<string, number>> = {};
  for (const m of months) data[m] = {};
  for (const n of notes) {
    const m = n.date.slice(0, 7);
    const cat = CATEGORIES.includes(n.category ?? '') ? (n.category ?? 'その他') : 'その他';
    data[m][cat] = (data[m][cat] ?? 0) + 1;
  }

  // only include categories that have at least one record
  const activeCats = CATEGORIES.filter((c) => months.some((m) => (data[m][c] ?? 0) > 0));

  const datasets = activeCats.map((cat) => ({
    label: cat,
    data: months.map((m) => data[m][cat] ?? 0),
    backgroundColor: CATEGORY_COLORS[cat] ?? 'rgba(156,163,175,0.85)',
    borderRadius: 3,
    borderSkipped: false,
  }));

  const labels = months.map((m) => m.replace('/', '/'));

  return (
    <Bar
      data={{ labels, datasets }}
      options={{
        responsive: true,
        plugins: {
          datalabels: { display: false },
          legend: {
            position: 'bottom',
            labels: { color: 'rgba(148,163,184,0.9)', font: { size: 10 }, boxWidth: 10, padding: 8 },
          },
          tooltip: {
            backgroundColor: 'rgba(7,20,40,0.95)',
            borderColor: 'rgba(96,165,250,0.3)',
            borderWidth: 1,
            titleColor: '#93c5fd',
            bodyColor: '#e2e8f0',
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: 'rgba(148,163,184,0.7)', font: { size: 9 } },
            border: { color: 'rgba(255,255,255,0.1)' },
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: 'rgba(148,163,184,0.7)', font: { size: 9 }, stepSize: 1 },
            border: { color: 'rgba(255,255,255,0.1)' },
          },
        },
      } as any}
    />
  );
}

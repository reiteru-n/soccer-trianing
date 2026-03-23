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

/** yyyy-MM-dd → Date (local) */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → week start (Monday) as yyyy-MM-dd string */
function weekStart(d: Date): string {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, '0');
  const dd = String(mon.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** yyyy-MM-dd → "M/D〜" label */
function weekLabel(ws: string): string {
  const [, m, d] = ws.split('-').map(Number);
  return `${m}/${d}〜`;
}

export default function Practice14WeekChart({ notes }: Props) {
  if (notes.length === 0) return null;

  // Determine 14 weeks ending at the current week
  const today = new Date();
  const currentWeekStart = weekStart(today);
  const weeks: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    weeks.push(weekStart(d));
  }

  // week → category → count
  const data: Record<string, Record<string, number>> = {};
  for (const w of weeks) data[w] = {};

  for (const n of notes) {
    const d = parseDate(n.date);
    const ws = weekStart(d);
    if (!weeks.includes(ws)) continue;
    const cat = CATEGORIES.includes(n.category ?? '') ? (n.category ?? 'その他') : 'その他';
    data[ws][cat] = (data[ws][cat] ?? 0) + 1;
  }

  const activeCats = CATEGORIES.filter((c) => weeks.some((w) => (data[w][c] ?? 0) > 0));

  const datasets = activeCats.map((cat) => ({
    label: cat,
    data: weeks.map((w) => data[w][cat] ?? 0),
    backgroundColor: CATEGORY_COLORS[cat] ?? 'rgba(156,163,175,0.85)',
    borderRadius: 3,
    borderSkipped: false,
  }));

  const labels = weeks.map(weekLabel);

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
            ticks: { color: 'rgba(148,163,184,0.7)', font: { size: 8 }, maxRotation: 45 },
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

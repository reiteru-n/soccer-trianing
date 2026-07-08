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
  birthDate: string;
}

function ageYears(birth: string, date: string): number {
  const [by, bm, bd] = birth.split('/').map(Number);
  const [dy, dm, dd] = date.split('/').map(Number);
  return (new Date(dy, dm - 1, dd).getTime() - new Date(by, bm - 1, bd).getTime()) / 31557600000;
}

// 年齢(歳)→秒 の アンカーポイントを線形補間（範囲外は両端の傾きで外挿）
function interpolateAnchors(anchors: { age: number; seconds: number }[], age: number): number {
  if (anchors.length === 1) return anchors[0].seconds;
  const last = anchors.length - 1;
  if (age <= anchors[0].age) {
    const a = anchors[0], b = anchors[1];
    return a.seconds + (age - a.age) * (b.seconds - a.seconds) / (b.age - a.age);
  }
  if (age >= anchors[last].age) {
    const a = anchors[last - 1], b = anchors[last];
    return b.seconds + (age - b.age) * (b.seconds - a.seconds) / (b.age - a.age);
  }
  for (let i = 0; i < last; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (age >= a.age && age <= b.age) {
      const t = (age - a.age) / (b.age - a.age);
      return a.seconds + t * (b.seconds - a.seconds);
    }
  }
  return anchors[last].seconds;
}

// 日本人男子の年齢別50m走全国平均（文部科学省「体力・運動能力調査」ベース、学年代表年齢で近似）
// 中3→高1の逆転（元データのばらつき）は単調減少になるよう軽く補正済み
const NATIONAL_AVERAGE_ANCHORS = [
  { age: 6, seconds: 11.31 },
  { age: 7, seconds: 10.65 },
  { age: 8, seconds: 10.01 },
  { age: 9, seconds: 9.61 },
  { age: 10, seconds: 9.21 },
  { age: 11, seconds: 8.91 },
  { age: 12, seconds: 8.42 },
  { age: 13, seconds: 7.80 },
  { age: 14, seconds: 7.46 },
  { age: 15, seconds: 7.38 },
  { age: 16, seconds: 7.30 },
  { age: 17, seconds: 7.23 },
];

// サッカー選手のセレクション目標タイム（指導者ブログ等の集約による目安、公式基準ではない）
// 小6頃のジュニアユース入団セレクション目安と、高3頃のユース昇格/プロ入り水準の2点を線形補間した1本のライン
const SELECTION_TARGET_ANCHORS = [
  { age: 11.5, seconds: 7.5 },
  { age: 17.5, seconds: 6.6 },
];

// タイムは速いほど良い（値が小さいほど良い）ため、成長グラフと同じオレンジ系配色を使う
export default function SprintChart({ records, birthDate }: Props) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map((r) => r.date.slice(5)); // mm/dd
  const data = sorted.map((r) => r.timeSeconds);
  const ages = birthDate ? sorted.map((r) => ageYears(birthDate, r.date)) : null;

  const datasets: any[] = [
    {
      label: 'あなたの記録',
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
  ];

  if (ages) {
    datasets.push({
      label: '全国平均（年齢考慮）',
      data: ages.map((a) => Math.round(interpolateAnchors(NATIONAL_AVERAGE_ANCHORS, a) * 100) / 100),
      borderColor: '#2563eb',
      borderDash: [6, 4],
      pointRadius: 0,
      pointHoverRadius: 3,
      borderWidth: 2,
      tension: 0.3,
      fill: false,
      datalabels: { display: false },
    });
    datasets.push({
      label: '一つ上の学年の平均',
      data: ages.map((a) => Math.round(interpolateAnchors(NATIONAL_AVERAGE_ANCHORS, a + 1) * 100) / 100),
      borderColor: '#059669',
      borderDash: [8, 3, 2, 3],
      pointRadius: 0,
      pointHoverRadius: 3,
      borderWidth: 2,
      tension: 0.3,
      fill: false,
      datalabels: { display: false },
    });
    datasets.push({
      label: 'セレクション目標ライン',
      data: ages.map((a) => Math.round(interpolateAnchors(SELECTION_TARGET_ANCHORS, a) * 100) / 100),
      borderColor: '#9333ea',
      borderDash: [2, 3],
      pointRadius: 0,
      pointHoverRadius: 3,
      borderWidth: 2,
      tension: 0.3,
      fill: false,
      datalabels: { display: false },
    });
  }

  const chartData = { labels, datasets };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { color: '#334155', font: { size: 10, weight: 'bold' }, boxWidth: 12, padding: 10 },
      },
      tooltip: {
        backgroundColor: 'rgba(7,20,40,0.95)',
        borderColor: 'rgba(249,115,22,0.3)',
        borderWidth: 1,
        titleColor: '#fdba74',
        bodyColor: '#e2e8f0',
        callbacks: {
          title: (items) => sorted[items[0].dataIndex]?.date ?? '',
          label: (item) => `${item.dataset.label}: ${Number(item.raw).toFixed(2)}秒`,
        },
      },
      datalabels: {
        align: 'top',
        anchor: 'end',
        color: '#c2410c',
        font: { weight: 'bold', size: 11 },
        formatter: (v) => `${Number(v).toFixed(2)}`,
      },
    },
    scales: {
      x: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#475569', font: { size: 11 }, maxRotation: 45 },
        border: { color: '#d1d5db' },
      },
      y: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#475569', font: { size: 11 }, callback: (v) => `${Number(v).toFixed(2)}秒` },
        border: { color: '#d1d5db' },
      },
    },
  };

  if (sorted.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        データがありません
      </div>
    );
  }

  return (
    <div>
      <div className="h-56 md:h-72">
        <Line data={chartData} options={options} />
      </div>
      {!birthDate && (
        <p className="text-[10px] text-gray-500 text-center mt-1">
          生年月日を設定すると年齢に応じた全国平均・セレクション目標ラインを表示できます
        </p>
      )}
      {birthDate && (
        <p className="text-[9px] text-gray-500 text-center mt-1">
          ※セレクション目標ラインは複数の指導者ブログ等を参考にした目安で、公式基準ではありません
        </p>
      )}
    </div>
  );
}

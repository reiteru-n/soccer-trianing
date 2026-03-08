"use client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler
} from "chart.js";
import { BodyRecord } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type Ref = { mean: number; sd: number };
const H: Record<number, Ref> = {
  6:{mean:114.6,sd:4.95}, 7:{mean:120.5,sd:5.14}, 8:{mean:126.3,sd:5.42},
  9:{mean:131.8,sd:5.67}, 10:{mean:137.3,sd:6.07}, 11:{mean:143.4,sd:6.82},
  12:{mean:150.5,sd:7.69}, 13:{mean:157.9,sd:7.79}, 14:{mean:163.8,sd:6.99},
  15:{mean:167.5,sd:6.22}, 16:{mean:169.5,sd:5.85}, 17:{mean:170.5,sd:5.82},
};
const W: Record<number, Ref> = {
  6:{mean:21.4,sd:3.3}, 7:{mean:24.0,sd:3.9}, 8:{mean:27.2,sd:4.7},
  9:{mean:30.7,sd:5.9}, 10:{mean:34.3,sd:7.1}, 11:{mean:38.4,sd:8.2},
  12:{mean:44.2,sd:9.7}, 13:{mean:49.7,sd:10.4}, 14:{mean:55.3,sd:10.7},
  15:{mean:59.7,sd:10.6}, 16:{mean:62.0,sd:9.9}, 17:{mean:63.8,sd:9.8},
};

function ageYears(birth: string, date: string): number {
  const [by,bm,bd] = birth.split("/").map(Number);
  const [dy,dm,dd] = date.split("/").map(Number);
  return (new Date(dy,dm-1,dd).getTime() - new Date(by,bm-1,bd).getTime()) / 31557600000;
}

function interp(ref: Record<number, Ref>, age: number): Ref | null {
  const ages = Object.keys(ref).map(Number).sort((a,b)=>a-b);
  if (age < ages[0] || age > ages[ages.length-1]) return null;
  const lo = Math.max(...ages.filter(a=>a<=age));
  const hi = Math.min(...ages.filter(a=>a>=age));
  if (lo === hi) return ref[lo];
  const t = (age-lo)/(hi-lo);
  return { mean: ref[lo].mean + t*(ref[hi].mean-ref[lo].mean), sd: ref[lo].sd + t*(ref[hi].sd-ref[lo].sd) };
}

type Point = { x: number; y: number };

interface Props { records: BodyRecord[]; birthDate: string; }

export default function BodyChart({ records, birthDate }: Props) {
  const sorted = [...records].sort((a,b) => a.date.localeCompare(b.date));
  const hRecs = sorted.filter(r => r.height != null);
  const wRecs = sorted.filter(r => r.weight != null);

  if (hRecs.length === 0 && wRecs.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">データがありません</p>;
  }
  if (!birthDate) {
    return <p className="text-xs text-gray-400 text-center py-4">生年月日を入力するとグラフが表示されます</p>;
  }

  const allAges = sorted.map(r => ageYears(birthDate, r.date));
  const minAge = Math.max(6, Math.floor(Math.min(...allAges)));
  const maxAge = Math.min(17, Math.ceil(Math.max(...allAges)));

  const refAges: number[] = [];
  for (let a = minAge; a <= maxAge + 0.01; a += 0.25) {
    refAges.push(Math.round(a * 4) / 4);
  }

  const mk = (ref: Record<number, Ref>, k: number): Point[] =>
    refAges
      .map(a => { const r = interp(ref, a); return r ? {x: a, y: parseFloat((r.mean + k*r.sd).toFixed(1))} : null; })
      .filter(Boolean) as Point[];

  const hActual: Point[] = hRecs.map(r => ({ x: ageYears(birthDate, r.date), y: r.height! }));
  const wActual: Point[] = wRecs.map(r => ({ x: ageYears(birthDate, r.date), y: r.weight! }));

  const datasets = [
    // 身長バンド (+2SD → -2SD 塗りつぶし)
    { data: mk(H,  2), yAxisID: 'y',  fill: '+1', backgroundColor: 'rgba(234,88,12,0.13)', borderColor: 'rgba(234,88,12,0.0)', borderWidth: 0, pointRadius: 0, tension: 0.4, parsing: false, label: '' },
    { data: mk(H, -2), yAxisID: 'y',  fill: false, borderColor: 'rgba(234,88,12,0.0)', borderWidth: 0, pointRadius: 0, tension: 0.4, parsing: false, label: '' },
    // 体重バンド
    { data: mk(W,  2), yAxisID: 'y1', fill: '+1', backgroundColor: 'rgba(37,99,235,0.13)', borderColor: 'rgba(37,99,235,0.0)', borderWidth: 0, pointRadius: 0, tension: 0.4, parsing: false, label: '' },
    { data: mk(W, -2), yAxisID: 'y1', fill: false, borderColor: 'rgba(37,99,235,0.0)', borderWidth: 0, pointRadius: 0, tension: 0.4, parsing: false, label: '' },
    // 実測値
    { label: '身長', data: hActual, yAxisID: 'y',  borderColor: '#ea580c', backgroundColor: '#ea580c', borderWidth: 2.5, pointRadius: 3.5, pointHoverRadius: 6, tension: 0.3, parsing: false, fill: false },
    { label: '体重', data: wActual, yAxisID: 'y1', borderColor: '#2563eb', backgroundColor: '#2563eb', borderWidth: 2.5, pointRadius: 3.5, pointHoverRadius: 6, tension: 0.3, parsing: false, fill: false },
  ];

  return (
    <Line
      data={{ datasets: datasets as any[] }}
      options={{
        responsive: true,
        parsing: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
          legend: {
            position: 'bottom' as const,
            labels: {
              font: { size: 11 },
              boxWidth: 14,
              padding: 10,
              filter: (item: any) => !!item.text,
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                if (!ctx.dataset.label) return '';
                const unit = ctx.dataset.yAxisID === 'y' ? 'cm' : 'kg';
                return `${ctx.dataset.label}: ${ctx.parsed.y}${unit}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear' as const,
            title: { display: true, text: '年齢(歳)', font: { size: 11 } },
            ticks: {
              font: { size: 10 },
              stepSize: 1,
              callback: (v: unknown) => {
                const n = v as number;
                return Number.isInteger(n) ? String(n) : '';
              },
            },
          },
          y: {
            position: 'left' as const,
            title: { display: true, text: '身長(cm)', font: { size: 11 } },
            ticks: { font: { size: 10 } },
          },
          y1: {
            position: 'right' as const,
            title: { display: true, text: '体重(kg)', font: { size: 11 } },
            ticks: { font: { size: 10 } },
            grid: { drawOnChartArea: false },
          },
        }
      } as any}
    />
  );
}

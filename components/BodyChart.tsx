"use client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler, Scale
} from "chart.js";
import { BodyRecord } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type Ref = { mean: number; sd: number };
// 身長(cm) 男児参照値: 0〜5歳=厚生労働省乳幼児身体発育調査(2010), 6〜17歳=文部科学省学校保健統計
const H: Record<number, Ref> = {
  0:{mean:49.0,sd:1.9}, 1:{mean:75.0,sd:2.5}, 2:{mean:87.0,sd:2.8},
  3:{mean:95.7,sd:3.5}, 4:{mean:103.0,sd:3.7}, 5:{mean:109.9,sd:4.1},
  6:{mean:114.6,sd:4.95}, 7:{mean:120.5,sd:5.14}, 8:{mean:126.3,sd:5.42},
  9:{mean:131.8,sd:5.67}, 10:{mean:137.3,sd:6.07}, 11:{mean:143.4,sd:6.82},
  12:{mean:150.5,sd:7.69}, 13:{mean:157.9,sd:7.79}, 14:{mean:163.8,sd:6.99},
  15:{mean:167.5,sd:6.22}, 16:{mean:169.5,sd:5.85}, 17:{mean:170.5,sd:5.82},
};
// 体重(kg) 男児参照値
const W: Record<number, Ref> = {
  0:{mean:3.0,sd:0.6}, 1:{mean:9.3,sd:1.0}, 2:{mean:12.0,sd:1.2},
  3:{mean:13.9,sd:1.5}, 4:{mean:16.1,sd:1.8}, 5:{mean:18.3,sd:2.2},
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

function sdLabel(sd: number): { text: string; color: string } {
  const abs = Math.abs(sd);
  if (abs <= 1) return { text: "標準範囲内", color: "text-green-600" };
  if (abs <= 2) return { text: "やや" + (sd > 0 ? "大きい" : "小さい"), color: "text-yellow-600" };
  return { text: sd > 0 ? "かなり大きい" : "かなり小さい", color: "text-red-500" };
}

function MiniChart({ actual, band, mean, axisMin, axisMax, unit, color }: {
  actual: Point[];
  band: { upper: Point[]; lower: Point[] };
  mean: Point[];
  axisMin: number;
  axisMax: number;
  unit: string;
  color: string;
}) {
  const rgb = color === "orange" ? "234,88,12" : "37,99,235";
  const datasets = [
    { data: band.upper, fill: '+1', backgroundColor: `rgba(${rgb},0.15)`, borderColor: 'transparent', borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, tension: 0.4, parsing: false, label: '' },
    { data: band.lower, fill: false, borderColor: 'transparent', borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, tension: 0.4, parsing: false, label: '' },
    { data: mean, fill: false, borderColor: `rgba(${rgb},0.35)`, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 0, tension: 0.4, parsing: false, label: '' },
    { data: actual, fill: false, borderColor: `rgb(${rgb})`, backgroundColor: `rgb(${rgb})`, borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, tension: 0.3, parsing: false, label: unit === 'cm' ? '身長' : '体重' },
  ];
  return (
    <Line
      data={{ datasets: datasets as any[] }}
      options={{
        responsive: true,
        parsing: false,
        interaction: { mode: 'nearest' as const, axis: 'x', intersect: false },
        plugins: {
          datalabels: { display: false },
          legend: { display: false },
          tooltip: {
            filter: (item: any) => !!item.dataset.label,
            callbacks: {
              title: (items: any[]) => `${items[0]?.parsed.x.toFixed(1)}歳`,
              label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y}${unit}`,
            }
          }
        },
        scales: {
          x: {
            type: 'linear' as const,
            min: axisMin,
            max: axisMax,
            ticks: { font: { size: 9 }, callback: (v: unknown) => String(v) },
            afterBuildTicks: (axis: Scale) => {
              const ticks = [];
              for (let i = axisMin; i <= axisMax; i++) ticks.push({ value: i });
              axis.ticks = ticks;
            },
          },
          y: {
            ticks: { font: { size: 9 }, callback: (v: unknown) => `${v}${unit}` },
          },
        }
      } as any}
    />
  );
}

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
  const axisMin = Math.floor(Math.min(...allAges));
  const axisMax = Math.ceil(Math.max(...allAges));

  const refMin = Math.max(0, axisMin);
  const refMax = Math.min(17, axisMax + 1);
  const refAges: number[] = [];
  for (let a = refMin; a <= refMax; a++) refAges.push(a);

  const mkBand = (ref: Record<number, Ref>, k: number): Point[] =>
    refAges
      .map(a => { const r = interp(ref, a); return r ? {x: a, y: parseFloat((r.mean + k*r.sd).toFixed(1))} : null; })
      .filter(Boolean) as Point[];

  const hActual: Point[] = hRecs.map(r => ({ x: ageYears(birthDate, r.date), y: r.height! }));
  const wActual: Point[] = wRecs.map(r => ({ x: ageYears(birthDate, r.date), y: r.weight! }));

  // 最新値と偏差
  const latestH = hRecs.at(-1);
  const latestW = wRecs.at(-1);
  const latestHAge = latestH ? ageYears(birthDate, latestH.date) : null;
  const latestWAge = latestW ? ageYears(birthDate, latestW.date) : null;
  const hRef = latestHAge != null ? interp(H, latestHAge) : null;
  const wRef = latestWAge != null ? interp(W, latestWAge) : null;
  const hSD = (hRef && latestH?.height != null) ? (latestH.height - hRef.mean) / hRef.sd : null;
  const wSD = (wRef && latestW?.weight != null) ? (latestW.weight - wRef.mean) / wRef.sd : null;

  return (
    <div className="space-y-4">
      {/* 現在の偏差カード */}
      <div className="grid grid-cols-2 gap-2">
        {latestH && hRef && hSD != null && (
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">最新身長 <span className="text-gray-300">{latestH.date}</span></p>
            <p className="text-xl font-extrabold text-orange-600">{latestH.height} <span className="text-sm font-normal">cm</span></p>
            <p className="text-[10px] text-gray-400">平均 {hRef.mean.toFixed(1)}cm</p>
            <p className="text-xs font-bold mt-0.5">
              <span className="text-gray-500">{hSD >= 0 ? "+" : ""}{((latestH.height??0) - hRef.mean).toFixed(1)}cm</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-gray-500">{hSD >= 0 ? "+" : ""}{hSD.toFixed(1)}SD</span>
            </p>
            <p className={`text-[10px] font-semibold mt-0.5 ${sdLabel(hSD).color}`}>{sdLabel(hSD).text}</p>
          </div>
        )}
        {latestW && wRef && wSD != null && (
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">最新体重 <span className="text-gray-300">{latestW.date}</span></p>
            <p className="text-xl font-extrabold text-blue-600">{latestW.weight} <span className="text-sm font-normal">kg</span></p>
            <p className="text-[10px] text-gray-400">平均 {wRef.mean.toFixed(1)}kg</p>
            <p className="text-xs font-bold mt-0.5">
              <span className="text-gray-500">{wSD >= 0 ? "+" : ""}{((latestW.weight??0) - wRef.mean).toFixed(1)}kg</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-gray-500">{wSD >= 0 ? "+" : ""}{wSD.toFixed(1)}SD</span>
            </p>
            <p className={`text-[10px] font-semibold mt-0.5 ${sdLabel(wSD).color}`}>{sdLabel(wSD).text}</p>
          </div>
        )}
      </div>

      {/* 身長グラフ */}
      {hRecs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">📏 身長 (cm)</p>
          <MiniChart
            actual={hActual}
            band={{ upper: mkBand(H, 2), lower: mkBand(H, -2) }}
            mean={mkBand(H, 0)}
            axisMin={axisMin} axisMax={axisMax}
            unit="cm" color="orange"
          />
        </div>
      )}

      {/* 体重グラフ */}
      {wRecs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">⚖️ 体重 (kg)</p>
          <MiniChart
            actual={wActual}
            band={{ upper: mkBand(W, 2), lower: mkBand(W, -2) }}
            mean={mkBand(W, 0)}
            axisMin={axisMin} axisMax={axisMax}
            unit="kg" color="blue"
          />
        </div>
      )}

      <p className="text-[9px] text-gray-300 text-right">帯: ±2SD 参考範囲</p>
    </div>
  );
}

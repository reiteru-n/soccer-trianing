"use client";
import { useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import { BodyRecord } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type Ref = { mean: number; sd: number };
const H: Record<number, Ref> = {
  6:{mean:114.6,sd:4.95},7:{mean:120.5,sd:5.14},8:{mean:126.3,sd:5.42},
  9:{mean:131.8,sd:5.67},10:{mean:137.3,sd:6.07},11:{mean:143.4,sd:6.82},
  12:{mean:150.5,sd:7.69},13:{mean:157.9,sd:7.79},14:{mean:163.8,sd:6.99},
  15:{mean:167.5,sd:6.22},16:{mean:169.5,sd:5.85},17:{mean:170.5,sd:5.82},
};
const W: Record<number, Ref> = {
  6:{mean:21.4,sd:3.3},7:{mean:24.0,sd:3.9},8:{mean:27.2,sd:4.7},
  9:{mean:30.7,sd:5.9},10:{mean:34.3,sd:7.1},11:{mean:38.4,sd:8.2},
  12:{mean:44.2,sd:9.7},13:{mean:49.7,sd:10.4},14:{mean:55.3,sd:10.7},
  15:{mean:59.7,sd:10.6},16:{mean:62.0,sd:9.9},17:{mean:63.8,sd:9.8},
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
  return { mean: ref[lo].mean+t*(ref[hi].mean-ref[lo].mean), sd: ref[lo].sd+t*(ref[hi].sd-ref[lo].sd) };
}

interface Props { records: BodyRecord[]; birthDate: string; }

export default function BodyChart({ records, birthDate }: Props) {
  const [type, setType] = useState<"height"|"weight">("height");
  const sorted = [...records].sort((a,b)=>a.date.localeCompare(b.date));
  const filtered = sorted.filter(r => type==="height" ? r.height!=null : r.weight!=null);
  if (filtered.length === 0) return <p className="text-xs text-gray-400 text-center py-4">データがありません</p>;
  const labels = filtered.map(r => r.date.slice(5));
  const actual = filtered.map(r => type==="height" ? r.height! : r.weight!);
  const refs = filtered.map(r => birthDate ? interp(type==="height"?H:W, ageYears(birthDate,r.date)) : null);
  const hasRef = !!birthDate && refs.some(r=>r!==null);
  const ds: unknown[] = [
    { label: "実測値", data: actual, borderColor: "#f97316", backgroundColor: "#f97316", borderWidth: 2.5, pointRadius: 4, tension: 0.3 },
  ];
  if (hasRef) {
    const pm = (r: Ref|null, k: number) => r ? parseFloat((r.mean+k*r.sd).toFixed(1)) : null;
    ds.push({ label: "+2SD", data: refs.map(r=>pm(r,2)), borderColor: "#fca5a5", borderWidth: 1, borderDash: [4,4], pointRadius: 0, tension: 0.3, spanGaps: true });
    ds.push({ label: "+1SD", data: refs.map(r=>pm(r,1)), borderColor: "#93c5fd", borderWidth: 1, borderDash: [3,3], pointRadius: 0, tension: 0.3, spanGaps: true });
    ds.push({ label: "平均", data: refs.map(r=>r?parseFloat(r.mean.toFixed(1)):null), borderColor: "#3b82f6", borderWidth: 1.5, pointRadius: 0, tension: 0.3, spanGaps: true });
    ds.push({ label: "-1SD", data: refs.map(r=>pm(r,-1)), borderColor: "#86efac", borderWidth: 1, borderDash: [3,3], pointRadius: 0, tension: 0.3, spanGaps: true });
    ds.push({ label: "-2SD", data: refs.map(r=>pm(r,-2)), borderColor: "#4ade80", borderWidth: 1, borderDash: [4,4], pointRadius: 0, tension: 0.3, spanGaps: true });
  }
  const unit = type==="height" ? "cm" : "kg";
  return (
    <div>
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-xl p-1">
        {(["height","weight"] as const).map(t => (
          <button key={t} onClick={()=>setType(t)} className={"flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors " + (type===t ? "bg-white text-gray-800 shadow" : "text-gray-500")}>
            {t==="height" ? "📏 身長" : "⚖️ 体重"}
          </button>
        ))}
      </div>
      <Line data={{ labels, datasets: ds as any[] }} options={{
        responsive: true,
        plugins: { legend: { position: "bottom" as const, labels: { font: { size: 10 }, boxWidth: 12, padding: 8 } } },
        scales: {
          x: { ticks: { font: { size: 10 } } },
          y: { ticks: { font: { size: 10 }, callback: (v: unknown) => String(v)+unit } }
        }
      } as any} />
    </div>
  );
}

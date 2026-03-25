'use client';
import { useState } from 'react';

const STATS = [
  {
    key: 'overseas',
    num: '1+',
    icon: '🌍',
    label: '海外リーグ\n（現役）',
    numColor: 'text-[#f59e0b]',
    bg: 'bg-[rgba(245,158,11,0.08)]',
    border: 'border-[rgba(245,158,11,0.2)]',
    players: ['齋藤俊輔（KVC ウェステルロー・ベルギー）'],
  },
  {
    key: 'jleague',
    num: '10+',
    icon: '⚽',
    label: 'Jリーグ\n（J1〜J3・WE）',
    numColor: 'text-[#4ade80]',
    bg: 'bg-[rgba(34,197,94,0.08)]',
    border: 'border-[rgba(34,197,94,0.2)]',
    players: [
      '松村晃助（横浜F・マリノス J1）',
      '中村翼（水戸ホーリーホック J2）',
      '小野奈菜（INAC神戸 WEリーグ）',
      '角田惠風（カマタマーレ讃岐 J3）',
      '土佐陸翼（ヴァンラーレ八戸 J3）',
      '国本玲央（FC大阪 J2）',
      '北村涼太（FC岐阜 J3）',
      '浅田大翔（横浜F・マリノス J1）',
      '五十嵐太陽（栃木SC J2）',
      '加藤大育（SC相模原 J3）',
    ],
  },
  {
    key: 'jfl',
    num: '5+',
    icon: '🏅',
    label: 'JFL\n（準プロ）',
    numColor: 'text-[#60a5fa]',
    bg: 'bg-[rgba(59,130,246,0.08)]',
    border: 'border-[rgba(59,130,246,0.2)]',
    players: [
      '平野元稀',
      '増田健昇',
      '阿部隼人',
      '萩原大河',
      '西山大輝',
    ],
  },
  {
    key: 'national',
    num: '7+',
    icon: '🇯🇵',
    label: '日本代表OB\n（歴代）',
    numColor: 'text-[#f87171]',
    bg: 'bg-[rgba(220,38,38,0.08)]',
    border: 'border-[rgba(220,38,38,0.2)]',
    players: [
      '對馬 羽琉（U-15日本代表 2025）',
      '浅田大翔（U-17日本代表 2025）',
      '齋藤俊輔（U-20日本代表 2024-25）',
      '松村晃助（U-20日本代表 2022-23）',
      '小野奈菜（U-20女子日本代表 2018）',
      '岩崎真波（U-16日本代表 2018）',
      '小林夏生（U-17日本代表 2019）',
    ],
  },
];

export default function StatGrid() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="relative z-10 mt-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STATS.map(s => (
          <button
            key={s.key}
            onClick={() => setOpen(open === s.key ? null : s.key)}
            className={`${s.bg} ${s.border} border rounded-xl px-3 py-2.5 text-center active:scale-95 transition-transform`}
          >
            <p className={`${s.numColor} text-[22px] font-black leading-none`}>{s.num}</p>
            <p className="text-slate-400 text-[9px] mt-0.5 whitespace-pre-line">{s.icon} {s.label}</p>
            <p className="text-slate-600 text-[8px] mt-1">{open === s.key ? '▲ 閉じる' : '▼ 一覧'}</p>
          </button>
        ))}
      </div>

      {STATS.map(s => open === s.key && (
        <div key={s.key} className={`mt-2 ${s.bg} ${s.border} border rounded-xl px-4 py-3`}>
          <p className={`${s.numColor} text-[10px] font-bold mb-2`}>{s.icon} {s.label.replace('\n', ' ')} — {s.players.length}名</p>
          <ul className="space-y-1">
            {s.players.map((p, i) => (
              <li key={i} className="text-slate-300 text-[12px] flex items-start gap-1.5">
                <span className="text-slate-600 tabular-nums text-[10px] mt-0.5">{i + 1}.</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

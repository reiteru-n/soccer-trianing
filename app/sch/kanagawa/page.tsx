'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef, useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

/* ─────────────────────────────────────────────────────────────────
 * POINT FORMULA（定期呼び出し用メモ）
 *
 * totalPoints(チームT, 年N) = Σ[offset=0..5] Σ[zen, nis, cs] pointValue(result, offset)
 *
 * BASE(result): { 1:10, 2:9, 3:8, 4:7, 8:6, 16:5 }
 *   1=優勝, 2=準優勝, 3=3位, 4=4位(ベスト4), 8=ベスト8, 16=ベスト16
 *
 * pointValue(result, offset) = max( BASE[result] - offset, 1 )
 *   offset=0 → N年度（当年）, offset=5 → N-5年度
 *   nullや定義外 → 0点
 *
 * ① N年度:   優勝10 準優勝9 3位8 4位7 B8=6 B16=5
 * ② N-1年度: 優勝9  準優勝8 3位7 4位6 B8=5 B16=4
 * ③ N-2年度: 優勝8  準優勝7 3位6 4位5 B8=4 B16=3
 * ④ N-3年度: 優勝7  準優勝6 3位5 4位4 B8=3 B16=2
 * ⑤ N-4年度: 優勝6  準優勝5 3位4 4位3 B8=2 B16=1
 * ⑥ N-5年度: 優勝5  準優勝4 3位3 4位2 B8=1 B16=1
 *
 * 対象大会: 全日本(zen)・日産カップ(nis)・チャンピオンシップ(cs)
 * 除外:     FAリーグ（部別ディビジョンのため同計算式に非対応）
 * ───────────────────────────────────────────────────────────────── */

const YEARS = [
  2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018,
  2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

const TEAMS = [
  'buddy', 'frontale', 'marinos', 'sch', 'nakanoshima', 'marinoso',
  'futuro', 'azamino', 'persimmon', 'sumire', 'porta', 'higashi',
  'sfat', 'cfg', 'testigo', 'vinculo', 'ashigara', 'littlejumbo',
];

const TEAM_LABELS: Record<string, string> = {
  buddy:       'バディーSC',
  frontale:    '川崎フロンターレ',
  marinos:     'マリノスPr（新横）',
  sch:         'SCH.FC',
  nakanoshima: '中野島FC',
  marinoso:    'マリノスPr（追浜）',
  futuro:      'JFC FUTURO',
  azamino:     'あざみ野FC',
  persimmon:   'FCパーシモン',
  sumire:      '横浜すみれSC',
  porta:       'FC PORTA',
  higashi:     '東住吉SC',
  sfat:        'SFAT ISEHARA',
  cfg:         'CFG-YOKOHAMA',
  testigo:     'FC Testigo',
  vinculo:     'FCヴィンクーロ',
  ashigara:    '足柄FC',
  littlejumbo: 'リトルジャンボSC',
};

const TEAM_COLORS: Record<string, string> = {
  buddy:       '#f97316',
  frontale:    '#3b82f6',
  marinos:     '#ef4444',
  sch:         '#22c55e',
  nakanoshima: '#a855f7',
  marinoso:    '#06b6d4',
  futuro:      '#eab308',
  azamino:     '#ec4899',
  persimmon:   '#14b8a6',
  sumire:      '#f59e0b',
  porta:       '#6366f1',
  higashi:     '#84cc16',
  sfat:        '#fb923c',
  cfg:         '#94a3b8',
  testigo:     '#64748b',
  vinculo:     '#7c3aed',
  ashigara:    '#059669',
  littlejumbo: '#d97706',
};

type R = number | null;

const ZEN: Record<string, R[]> = {
  buddy:       [1,null,1,3,null,2,2,null,2,2,1,null,8,3,1,8],
  frontale:    [null,1,null,null,3,8,null,1,1,null,8,null,3,2,2,1],
  marinos:     [null,null,null,1,1,1,1,null,3,1,2,null,3,1,3,8],
  sch:         [null,null,2,null,null,null,null,null,null,8,3,1,1,4,16,8],
  nakanoshima: [null,null,null,null,null,null,null,null,null,null,null,null,2,8,4,4],
  marinoso:    [null,null,null,16,null,8,8,16,8,16,null,null,3,null,8,8],
  futuro:      [null,null,null,null,null,null,null,null,3,8,null,null,null,8,4,8],
  azamino:     [null,null,null,null,2,null,null,2,null,null,null,null,8,null,null,null],
  persimmon:   [null,null,null,null,null,null,null,16,null,null,8,16,16,null,16,8],
  sumire:      [null,null,null,null,null,null,null,null,null,null,null,null,8,null,8,null],
  porta:       [null,null,null,null,null,null,null,null,null,null,null,null,null,8,16,8],
  higashi:     [null,null,null,null,null,null,null,null,null,null,null,null,8,8,null,null],
  sfat:        [null,null,null,null,null,null,null,null,null,8,16,null,8,null,null,null],
  cfg:         [null,null,null,null,null,null,null,null,null,null,3,null,null,null,null,null],
  testigo:     [null,null,null,null,null,null,null,null,null,null,null,null,null,8,null,null],
  vinculo:     [null,null,null,null,null,null,null,null,null,null,null,null,null,null,8,null],
  ashigara:    [null,null,null,null,null,null,null,null,null,null,null,null,null,null,8,null],
  littlejumbo: [null,null,null,2,null,null,null,null,null,null,null,null,null,null,null,null],
};

const NIS: Record<string, R[]> = {
  buddy:       [1,null,null,null,null,1,null,null,1,1,null,null,3,1,8,1],
  frontale:    [null,null,2,null,null,null,null,2,null,null,null,null,null,null,3,null],
  marinos:     [null,null,1,1,null,null,null,1,null,2,null,null,null,2,1,8],
  sch:         [null,null,null,null,1,3,null,null,8,null,null,1,null,null,4,3],
  nakanoshima: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,4],
  marinoso:    [null,null,3,null,null,null,null,null,null,null,null,null,null,null,null,8],
  futuro:      [null,null,null,null,null,4,null,3,4,null,null,2,null,null,8,null],
  azamino:     [null,null,null,null,null,null,null,4,null,null,null,null,null,null,null,null],
  persimmon:   [null,null,null,null,null,null,null,null,2,null,null,null,null,null,8,null],
  sumire:      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,8,null],
  porta:       [null,null,null,null,null,null,null,null,null,null,null,null,null,8,2,null],
  higashi:     [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  sfat:        [null,null,null,null,null,null,1,null,null,null,null,null,1,null,null,null],
  cfg:         [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  testigo:     [null,null,null,null,null,null,null,null,null,null,null,null,null,3,null,null],
  vinculo:     [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  ashigara:    [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  littlejumbo: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
};

const CS: Record<string, R[]> = {
  buddy:       [null,null,null,null,null,null,1,1,1,null,null,null,1,null,1,8],
  frontale:    [null,null,null,null,null,null,null,2,3,null,null,3,null,1,null,1],
  marinos:     [null,null,null,null,null,null,null,null,null,null,null,null,null,null,8,null],
  sch:         [null,null,null,null,null,null,null,null,null,null,null,null,3,3,2,null],
  nakanoshima: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  marinoso:    [null,null,null,null,null,null,null,null,null,null,null,null,4,4,8,null],
  futuro:      [null,null,null,null,null,null,null,null,null,3,null,2,null,2,3,3],
  azamino:     [null,null,null,null,null,null,null,null,null,4,null,null,2,null,null,4],
  persimmon:   [null,null,null,null,null,null,null,null,2,null,null,1,null,null,null,null],
  sumire:      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,3,null],
  porta:       [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  higashi:     [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  sfat:        [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  cfg:         [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  testigo:     [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  vinculo:     [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  ashigara:    [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  littlejumbo: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
};

/* ──────────────── ポイント計算 ──────────────── */

const BASE: Record<number, number> = { 1: 10, 2: 9, 3: 8, 4: 7, 8: 6, 16: 5 };

function calcPoints(team: string, yearIndex: number): number {
  let total = 0;
  for (let offset = 0; offset <= 5; offset++) {
    const idx = yearIndex - offset;
    if (idx < 0) continue;
    for (const comp of [ZEN, NIS, CS]) {
      const result = comp[team]?.[idx];
      if (result == null) continue;
      const base = BASE[result];
      if (base == null) continue;
      total += Math.max(base - offset, 1); // 最低1点フロア
    }
  }
  return total;
}

// チャート X軸: 2015〜2025（インデックス 5〜15）
const CHART_YEAR_INDICES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const CHART_YEAR_LABELS  = CHART_YEAR_INDICES.map(i => String(YEARS[i]));

const pointsMatrix: Record<string, number[]> = {};
for (const team of TEAMS) {
  pointsMatrix[team] = CHART_YEAR_INDICES.map(i => calcPoints(team, i));
}

/* ──────────────── チャートオプション ──────────────── */

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 1200, easing: 'easeInOutQuart' },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(6,8,16,0.97)',
      borderColor: 'rgba(245,158,11,0.35)',
      borderWidth: 1,
      titleColor: '#f59e0b',
      bodyColor: '#e2e8f0',
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}pt`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.06)' },
      ticks: { color: 'rgba(148,163,184,0.7)', font: { size: 11 } },
      border: { color: 'rgba(255,255,255,0.08)' },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(255,255,255,0.06)' },
      ticks: {
        color: 'rgba(148,163,184,0.7)',
        font: { size: 11 },
        callback: (v) => `${v}pt`,
      },
      border: { color: 'rgba(255,255,255,0.08)' },
    },
  },
};

/* ──────────────── メインページ ──────────────── */

export default function KanagawaPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState<'ranking' | 'points'>('ranking');
  const [hiddenTeams, setHiddenTeams] = useState<Set<string>>(new Set());
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'iframeHeight' && iframeRef.current) {
        iframeRef.current.style.height = e.data.height + 'px';
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  function toggleTeam(team: string) {
    setHiddenTeams(prev => {
      const next = new Set(prev);
      next.has(team) ? next.delete(team) : next.add(team);
      return next;
    });
  }

  const chartData = useMemo(() => ({
    labels: CHART_YEAR_LABELS,
    datasets: TEAMS.map(team => ({
      label: TEAM_LABELS[team],
      data: pointsMatrix[team],
      borderColor: TEAM_COLORS[team],
      backgroundColor: 'transparent',
      pointBackgroundColor: TEAM_COLORS[team],
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2,
      hidden: hiddenTeams.has(team),
      tension: 0.3,
    })),
  }), [hiddenTeams]);

  return (
    <div className="min-h-screen bg-white pb-16">

      {/* Header */}
      <div className="relative overflow-hidden bg-[#003087] px-5 pt-8 pb-5">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(180deg, transparent, transparent 24px, rgba(255,255,255,0.06) 24px, rgba(255,255,255,0.06) 26px)' }}
        />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0047AB] to-[#001A52] opacity-80" />
        <div className="absolute top-0 right-0 text-white/[0.1] text-[160px] font-black leading-none select-none pointer-events-none translate-x-8 -translate-y-4">↑</div>

        <Link
          href="/sch/history"
          className="relative z-10 flex items-center gap-1.5 text-[#A8C4F0] text-[11px] mb-5 hover:text-white transition-colors"
        >
          ← 先輩たちの戦歴に戻る
        </Link>

        <div className="relative z-10 flex items-end gap-4">
          <Link href="/sch">
            <Image
              src="/sch-logo.png"
              width={175}
              height={215}
              className="object-contain h-16 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
              alt="SCH logo"
            />
          </Link>
          <div>
            <p className="text-[#A8C4F0] text-[9px] font-bold tracking-[0.22em] uppercase border border-white/20 bg-white/10 px-2.5 py-0.5 rounded inline-block mb-2">
              KANAGAWA U-12 2010–2025
            </p>
            <h1 className="text-white text-[22px] font-black leading-tight">
              神奈川県チーム<br />
              <span className="text-[#FFD700]">順位推移</span>グラフ
            </h1>
            <p className="text-[#A8C4F0] text-[11px] mt-1.5">
              全日本・日産カップ・FAリーグ・チャンピオンシップ
            </p>
          </div>
        </div>
      </div>

      {/* タブバー */}
      <div className="flex bg-[#001A52] border-b border-white/10">
        {(['ranking', 'points'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[13px] font-bold tracking-wide transition-colors
              ${activeTab === tab
                ? 'text-[#FFD700] border-b-2 border-[#FFD700]'
                : 'text-[#A8C4F0] hover:text-white'}`}
          >
            {tab === 'ranking' ? '順位推移' : '総合ポイント'}
          </button>
        ))}
      </div>

      {/* Tab 1: 順位推移（iframe） — display:none で非表示・アニメーション状態を保持 */}
      <div style={{ display: activeTab === 'ranking' ? 'block' : 'none' }}>
        <iframe
          ref={iframeRef}
          src="/kanagawa-animated.html"
          width="100%"
          height="800"
          scrolling="no"
          style={{ border: 'none', display: 'block', overflow: 'hidden' }}
          title="神奈川ジュニアサッカー 順位推移グラフ"
        />
      </div>

      {/* Tab 2: 総合ポイント推移 — iframeと同一ダークデザイン */}
      <div style={{ display: activeTab === 'points' ? 'block' : 'none', background: '#060810', minHeight: '100vh' }}>

        {/* ヘッダー */}
        <div style={{ background: 'linear-gradient(160deg,#080c20,#060810)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: 'clamp(14px,4vw,22px) clamp(14px,4vw,24px) clamp(10px,3vw,16px)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 120% at 85% 50%,rgba(245,158,11,.06),transparent 70%)', pointerEvents: 'none' }} />
          <div className="flex items-end gap-4 relative">
            <Link href="/sch">
              <Image
                src="/sch-logo.png"
                width={175}
                height={215}
                className="object-contain w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
                style={{ height: 'clamp(44px,10vw,64px)' }}
                alt="SCH logo"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#f59e0b', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', padding: '3px 10px', borderRadius: 3, marginBottom: 8 }}>
                KANAGAWA U-12 2015–2025
              </span>
              <h2 style={{ fontFamily: "'Noto Sans JP',sans-serif", fontSize: 'clamp(17px,4.5vw,26px)', fontWeight: 900, lineHeight: 1.2, color: '#fff' }}>
                総合ポイント<span style={{ color: '#f59e0b' }}>推移</span>
              </h2>
              <p style={{ fontSize: 10, color: '#3f4d6b', marginTop: 4 }}>
                全日本・日産カップ・チャンピオンシップ　直近6年加重合計
              </p>
            </div>
          </div>
        </div>

        {/* チャートカード */}
        <div style={{ padding: 'clamp(10px,3vw,16px) clamp(12px,3.5vw,20px)' }}>
          <div style={{ background: '#0f1321', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', position: 'relative', marginBottom: 12 }}>
            {/* ゴールドライン上部 */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#f59e0b,transparent)' }} />

            {/* コントロールバー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 'clamp(12px,3vw,15px)', fontWeight: 900, color: '#fff', letterSpacing: '.03em' }}>総合ポイント推移グラフ</p>
                <p style={{ fontSize: 10, color: '#3f4d6b', marginTop: 2 }}>2015〜2025年度　18チーム</p>
              </div>
              <button
                onClick={() => setChartKey(k => k + 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 24, background: '#f59e0b', color: '#060810', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 900, flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg>
                再生
              </button>
            </div>

            {/* チャート本体 */}
            <div style={{ padding: '8px 8px 4px', overflowX: 'auto' }}>
              <div style={{ minWidth: 320, height: 320 }}>
                <Line key={chartKey} data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* チーム選択 */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3f4d6b', letterSpacing: '.12em', textTransform: 'uppercase' }}>チーム表示切替</p>
                <button
                  onClick={() => setHiddenTeams(new Set())}
                  style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', padding: '2px 9px', borderRadius: 20, cursor: 'pointer' }}
                >
                  全表示
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TEAMS.map(team => {
                  const hidden = hiddenTeams.has(team);
                  return (
                    <button
                      key={team}
                      onClick={() => toggleTeam(team)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px 5px 8px', borderRadius: 20, cursor: 'pointer',
                        border: `1.5px solid ${hidden ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.2)'}`,
                        background: hidden ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.07)',
                        fontSize: 11, fontWeight: 700,
                        color: hidden ? 'rgba(255,255,255,0.2)' : '#fff',
                        transition: 'all .15s',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: hidden ? 'rgba(255,255,255,0.15)' : TEAM_COLORS[team] }} />
                      {TEAM_LABELS[team]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ポイント説明 */}
          <div style={{ background: '#0f1321', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>ポイント計算方法</p>
            <p style={{ fontSize: 10, color: '#3f4d6b', lineHeight: 1.8 }}>
              今年度：優勝10 / 準優勝9 / 3位8 / 4位7 / B8=6 / B16=5<br />
              1年前：各-1、2年前：各-2…（5年前まで、最低1点）<br />
              対象：全日本・日産カップ・チャンピオンシップ（FAリーグ除く）
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

import Link from 'next/link';

/* ───────────── 共通 UI コンポーネント ───────────── */

function Tag({ children, color = 'orange' }: { children: React.ReactNode; color?: 'orange' | 'gold' | 'green' | 'red' | 'purple' | 'teal' | 'blue' }) {
  const styles: Record<string, string> = {
    orange: 'bg-[rgba(249,115,22,0.15)] text-[#fb923c] border-[rgba(249,115,22,0.3)]',
    gold:   'bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]',
    green:  'bg-[rgba(34,197,94,0.15)] text-[#4ade80] border-[rgba(34,197,94,0.3)]',
    red:    'bg-[rgba(239,68,68,0.15)] text-[#f87171] border-[rgba(239,68,68,0.3)]',
    purple: 'bg-[rgba(168,85,247,0.15)] text-[#c084fc] border-[rgba(168,85,247,0.3)]',
    teal:   'bg-[rgba(20,184,166,0.15)] text-[#2dd4bf] border-[rgba(20,184,166,0.3)]',
    blue:   'bg-[rgba(59,130,246,0.15)] text-[#60a5fa] border-[rgba(59,130,246,0.3)]',
  };
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[color]}`}>
      {children}
    </span>
  );
}

function Src({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[9px] text-[#7C2D12]/50 hover:text-[#C2410C] transition-colors underline"
    >
      📎 {label}
    </a>
  );
}

function SectionHeader({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="mx-4 mt-8 mb-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h2 className="text-[#7C2D12] text-[17px] font-black">{title}</h2>
      </div>
      {sub && <p className="text-slate-500 text-[11px] mt-0.5 ml-7">{sub}</p>}
    </div>
  );
}

/* ───────────── 選手カード ───────────── */

interface PlayerCardProps {
  name: string;
  nameKana: string;
  birth?: string;
  position?: string;
  career: Array<{ label: string; value: string; note?: string }>;
  tags: Array<{ text: string; color: 'orange' | 'gold' | 'green' | 'red' | 'purple' | 'teal' | 'blue' }>;
  sources: Array<{ href: string; label: string }>;
  highlight?: string;
}

function PlayerCard({ name, nameKana, birth, position, career, tags, sources, highlight }: PlayerCardProps) {
  return (
    <details className="mx-4 mb-3 bg-white border border-[#C2410C]/10 rounded-2xl overflow-hidden">
      <summary className="cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden">
        {highlight && (
          <div className="bg-gradient-to-r from-[#7C2D12] to-[#C2410C] px-4 py-2 border-b border-[#C2410C]/10">
            <p className="text-[#FCD34D] text-[11px] font-bold">{highlight}</p>
          </div>
        )}
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[#7C2D12] text-[17px] font-black leading-tight">{name}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">{nameKana}</p>
            </div>
            <div className="text-right shrink-0">
              {position && <p className="text-[#C2410C] text-[10px] font-bold">{position}</p>}
              <span className="text-slate-400 text-[9px]">▼ 経歴を見る</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((t, i) => <Tag key={i} color={t.color}>{t.text}</Tag>)}
          </div>
        </div>
      </summary>

      <div className="border-t border-[#C2410C]/8 px-4 py-3">
        {birth && <p className="text-slate-400 text-[9px] mb-2">{birth}</p>}
        <div className="space-y-1.5">
          {career.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-slate-400 text-[10px] w-14 shrink-0 pt-0.5">{step.label}</span>
              <div className="flex-1">
                <span className="text-[#7C2D12] text-[12px] font-semibold">{step.value}</span>
                {step.note && <span className="text-slate-400 text-[10px] ml-1">（{step.note}）</span>}
              </div>
            </div>
          ))}
        </div>
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {sources.map((s, i) => <Src key={i} href={s.href} label={s.label} />)}
          </div>
        )}
      </div>
    </details>
  );
}

/* ───────────── メインページ ───────────── */

export default function BuddyScObPage() {
  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ─── ヘッダー ─── */}
      <div className="relative overflow-hidden bg-[#7C2D12] px-5 pt-8 pb-6">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(180deg, transparent, transparent 24px, rgba(255,255,255,0.06) 24px, rgba(255,255,255,0.06) 26px)' }}
        />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#C2410C] to-[#450A0A] opacity-80" />
        <div className="absolute top-0 right-0 text-white/[0.08] text-[140px] font-black leading-none select-none pointer-events-none translate-x-4 -translate-y-4">B</div>

        <Link
          href="/sch/ob"
          className="relative z-10 flex items-center gap-1.5 text-[#FCA58A] text-[11px] mb-5 hover:text-white transition-colors"
        >
          ← OB進路まとめに戻る
        </Link>

        <div className="relative z-10">
          <p className="text-[#FCA58A] text-[9px] font-bold tracking-[0.22em] uppercase border border-white/20 bg-white/10 px-2.5 py-0.5 rounded inline-block mb-2">
            BUDDY SPORTS CLUB · 横浜 OB
          </p>
          <h1 className="text-white text-[22px] font-black leading-tight">
            バディーSC（横浜）<br />
            <span className="text-[#FCD34D]">OB進路・実績まとめ</span>
          </h1>
          <p className="text-[#FCA58A] text-[11px] mt-1.5">
            バディスポーツクラブ横浜支部出身の選手たちの軌跡
          </p>
        </div>

        {/* サマリー */}
        <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
          <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-xl px-3 py-2.5 text-center">
            <p className="text-[#f59e0b] text-[22px] font-black leading-none">1+</p>
            <p className="text-slate-400 text-[9px] mt-0.5">🌍 海外リーグ</p>
          </div>
          <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-xl px-3 py-2.5 text-center">
            <p className="text-[#4ade80] text-[22px] font-black leading-none">2+</p>
            <p className="text-slate-400 text-[9px] mt-0.5">⚽ Jリーグ</p>
          </div>
          <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.2)] rounded-xl px-3 py-2.5 text-center">
            <p className="text-[#f87171] text-[22px] font-black leading-none">1</p>
            <p className="text-slate-400 text-[9px] mt-0.5">🇯🇵 日本A代表</p>
          </div>
        </div>
      </div>

      {/* ─── 注意書き ─── */}
      <div className="mx-4 mt-4 bg-[#FFF7ED] border border-[#C2410C]/10 rounded-xl px-4 py-3">
        <p className="text-[#7C2D12]/70 text-[10px] leading-relaxed">
          ※ 本ページはバディスポーツクラブ<strong>横浜支部</strong>（横浜センター南・横浜バディCFCなど）出身の選手のみ掲載しています。
          バディスポーツクラブには世田谷・江東（東京）など他支部もあり、それらは別途掲載しておりません。
          公開情報をもとに作成。最新情報は各リンク先をご確認ください。
        </p>
      </div>

      {/* ─── プロ選手 ─── */}
      <SectionHeader
        icon="⚽"
        title="プロサッカー選手"
        sub="横浜バディSC出身のプロ選手"
      />

      <PlayerCard
        name="田中 碧"
        nameKana="たなか あお"
        birth="2001年9月10日生（神奈川県横浜市出身）"
        position="MF（ミッドフィルダー）"
        highlight="🌍 ブンデスリーガ活躍・日本A代表／カタールW杯 スペイン戦決勝ゴール"
        career={[
          { label: '幼少期', value: 'バディスポーツ幼児園 横浜センター南校', note: '4期生' },
          { label: '中学', value: '川崎フロンターレU-15' },
          { label: '高校', value: '川崎フロンターレU-18' },
          { label: 'プロ', value: '川崎フロンターレ', note: 'J1 2020〜2022' },
          { label: '海外', value: 'フォルトゥナ・デュッセルドルフ', note: 'ブンデスリーガ 2022〜2024' },
          { label: '現在', value: 'リーズ・ユナイテッドFC', note: 'チャンピオンシップ 2024〜' },
        ]}
        tags={[
          { text: 'J1プロ', color: 'green' },
          { text: 'A代表', color: 'red' },
          { text: 'W杯2022', color: 'red' },
          { text: 'ブンデスリーガ', color: 'gold' },
          { text: 'J1連覇', color: 'orange' },
        ]}
        sources={[
          { href: 'https://www.buddy-sports.co.jp/news/2768/', label: 'バディスポーツ公式（W杯ゴール）' },
          { href: 'https://www.buddy-sports.co.jp/news/1292/', label: 'バディスポーツ公式（東京五輪）' },
          { href: 'https://ja.wikipedia.org/wiki/%E7%94%B0%E4%B8%AD%E7%A2%A7_(%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E9%81%B8%E6%89%8B)', label: 'Wikipedia' },
        ]}
      />

      <PlayerCard
        name="藤本 裕也"
        nameKana="ふじもと ゆうや"
        position="MF / FW"
        career={[
          { label: '小学', value: '横浜バディSC（横浜CFC）' },
          { label: '中学', value: '横浜FCジュニアユース' },
          { label: '高校', value: '横浜FCユース' },
          { label: '大学', value: '関東学院大学' },
          { label: 'プロ', value: '松本山雅FC', note: 'J2/J3' },
          { label: '現在', value: 'ラインメール青森', note: 'JFL' },
        ]}
        tags={[
          { text: 'JFL', color: 'blue' },
          { text: '横浜バディCFC', color: 'teal' },
        ]}
        sources={[
          { href: 'https://www.buddy-sports.co.jp/club_school/club/soccer/yokocfc/', label: 'バディスポーツ 横浜CFC' },
        ]}
      />

      {/* ─── 代表実績 ─── */}
      <SectionHeader
        icon="🇯🇵"
        title="日本代表・国際大会の実績"
        sub="田中碧の主な代表歴"
      />

      <div className="mx-4 space-y-2">
        {[
          { year: '2021', name: '田中 碧', event: '東京オリンピック 男子サッカー日本代表', note: 'U-24日本代表 4位入賞' },
          { year: '2021', name: '田中 碧', event: 'U-24日本代表 スタメン定着', note: '五輪本番・グループリーグ全試合出場' },
          { year: '2022', name: '田中 碧', event: 'FIFAワールドカップ カタール大会', note: 'スペイン戦 決勝ゴール／ベスト16' },
          { year: '2022', name: '田中 碧', event: 'ドイツ戦・スペイン戦で2試合連続ゴール', note: '日本代表の「ドーハの歓喜」を支えた中心選手' },
        ].map((item, i) => (
          <div key={i} className="bg-white border border-[#C2410C]/10 rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
              <span className="text-[#C2410C] text-[10px] font-black text-center leading-tight">{item.year}</span>
            </div>
            <div className="flex-1">
              <p className="text-[#7C2D12] text-[13px] font-bold">{item.name}</p>
              <p className="text-slate-500 text-[11px]">{item.event}</p>
              {item.note && <p className="text-[#C2410C] text-[10px] mt-0.5">{item.note}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ─── クラブ概要 ─── */}
      <SectionHeader
        icon="🏫"
        title="バディスポーツクラブ横浜について"
        sub="選手を育てる横浜の拠点"
      />

      <div className="mx-4 bg-[#FFF7ED] border border-[#C2410C]/10 rounded-xl px-4 py-4 space-y-2">
        {[
          { label: '設立', value: '1992年（バディスポーツクラブ全体）' },
          { label: '横浜拠点', value: '横浜センター南・横浜センター北・横浜みどり 等' },
          { label: 'カテゴリ', value: '幼児園〜小学生（卒団後はJクラブアカデミーへ）' },
          { label: '特徴', value: '「続けることが力」の理念のもと幼少期から本格指導' },
        ].map((row, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[#C2410C] text-[10px] w-20 shrink-0 font-bold pt-0.5">{row.label}</span>
            <span className="text-[#7C2D12] text-[12px]">{row.value}</span>
          </div>
        ))}
      </div>

      {/* ─── 出典 ─── */}
      <div className="mx-4 mt-8 border-t border-slate-100 pt-5">
        <p className="text-slate-400 text-[9px] mb-2 font-bold">出典・参考</p>
        <div className="flex flex-wrap gap-2">
          <Src href="https://www.buddy-sports.co.jp/cat_news/obog/" label="バディスポーツクラブ 公式OB情報" />
          <Src href="https://www.buddy-sports.co.jp/club_school/club/soccer/yokocfc/" label="横浜バディCFC" />
          <Src href="https://ja.wikipedia.org/wiki/%E7%94%B0%E4%B8%AD%E7%A2%A7_(%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E9%81%B8%E6%89%8B)" label="田中碧 Wikipedia" />
        </div>
      </div>

      {/* ─── 戻るボタン ─── */}
      <div className="mx-4 mt-6">
        <Link
          href="/sch/ob"
          className="flex items-center justify-center gap-2 text-[#C2410C] text-[12px] font-bold border border-[#C2410C]/20 bg-[#FFF7ED] rounded-xl py-3 hover:bg-[#FFEDD5] transition-colors"
        >
          ← OBの進路・実績まとめに戻る
        </Link>
      </div>

    </div>
  );
}

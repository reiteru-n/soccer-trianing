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

      {/* 展開コンテンツ */}
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

/* ───────────── サマリーカード ───────────── */

function StatBadge({ num, icon, label, numColor, bg, border }: {
  num: string; icon: string; label: string; numColor: string; bg: string; border: string;
}) {
  return (
    <div className={`${bg} ${border} border rounded-xl px-3 py-2.5 text-center`}>
      <p className={`${numColor} text-[22px] font-black leading-none`}>{num}</p>
      <p className="text-slate-400 text-[9px] mt-0.5 whitespace-pre-line">{icon} {label}</p>
    </div>
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
            SINCE 1992 · BUDDY SPORTS CLUB OB
          </p>
          <h1 className="text-white text-[22px] font-black leading-tight">
            バディーSC OBの<br />
            <span className="text-[#FCD34D]">進路・実績まとめ</span>
          </h1>
          <p className="text-[#FCA58A] text-[11px] mt-1.5">
            バディスポーツクラブが育てたOBたちの軌跡
          </p>
        </div>

        {/* サマリー数字 */}
        <div className="relative z-10 mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatBadge
            num="3+"
            icon="🌍"
            label={'海外リーグ\n（現役）'}
            numColor="text-[#f59e0b]"
            bg="bg-[rgba(245,158,11,0.08)]"
            border="border-[rgba(245,158,11,0.2)]"
          />
          <StatBadge
            num="5+"
            icon="⚽"
            label={'Jリーグ\n（J1〜・WE）'}
            numColor="text-[#4ade80]"
            bg="bg-[rgba(34,197,94,0.08)]"
            border="border-[rgba(34,197,94,0.2)]"
          />
          <StatBadge
            num="3+"
            icon="🇯🇵"
            label={'日本A代表\nOB'}
            numColor="text-[#f87171]"
            bg="bg-[rgba(220,38,38,0.08)]"
            border="border-[rgba(220,38,38,0.2)]"
          />
          <StatBadge
            num="1"
            icon="🏅"
            label={'五輪出場\n（女子）'}
            numColor="text-[#c084fc]"
            bg="bg-[rgba(168,85,247,0.08)]"
            border="border-[rgba(168,85,247,0.2)]"
          />
        </div>
      </div>

      {/* ─── 注意書き ─── */}
      <div className="mx-4 mt-4 bg-[#FFF7ED] border border-[#C2410C]/10 rounded-xl px-4 py-3">
        <p className="text-[#7C2D12]/70 text-[10px] leading-relaxed">
          ※ バディスポーツクラブは横浜・東京・千葉・埼玉・名古屋など全国に展開するスポーツクラブです。
          本ページのデータはバディスポーツクラブ公式サイト・Jリーグ公式・Wikipedia等の公開情報をもとに作成しています。
          各選手の記載内容は取得時点の情報です。
        </p>
      </div>

      {/* ─── プロ選手（男子） ─── */}
      <SectionHeader
        icon="⚽"
        title="プロサッカー選手（男子）"
        sub="世界で活躍するバディーSC出身選手"
      />

      <PlayerCard
        name="武藤 嘉紀"
        nameKana="むとう よしのり"
        birth="1992年7月15日生（東京都世田谷区出身）"
        position="FW（フォワード）"
        highlight="🌍 プレミアリーグ・ブンデスリーガ出場／日本A代表29試合／ロシアW杯出場"
        career={[
          { label: '幼少期', value: 'バディスポーツ幼児園世田谷', note: 'バディSC世田谷' },
          { label: '中学', value: 'FC東京U-15', note: '慶應義塾高校' },
          { label: '高校', value: 'FC東京U-18', note: '慶應義塾高校' },
          { label: '大学', value: '慶應義塾大学', note: '体育会サッカー部' },
          { label: 'プロ', value: 'FC東京', note: 'J1 2014〜2015' },
          { label: '海外', value: 'マインツ05', note: 'ブンデスリーガ 2015〜2018' },
          { label: '海外', value: 'ニューカッスルU', note: 'プレミアリーグ 2018〜2019' },
          { label: '海外', value: 'エイバル', note: 'ラ・リーガ（loan） 2019〜2020' },
          { label: '現在', value: 'ヴィッセル神戸', note: 'J1 2020〜' },
        ]}
        tags={[
          { text: 'J1プロ', color: 'green' },
          { text: 'A代表', color: 'red' },
          { text: 'W杯2018', color: 'red' },
          { text: 'プレミア', color: 'gold' },
          { text: 'ブンデスリーガ', color: 'gold' },
          { text: 'Jベストイレブン', color: 'orange' },
        ]}
        sources={[
          { href: 'https://ja.wikipedia.org/wiki/%E6%AD%A6%E8%97%A4%E5%98%89%E7%B4%80', label: 'Wikipedia' },
          { href: 'https://www.buddy-sports.co.jp/news/1852/', label: 'バディスポーツ公式' },
        ]}
      />

      <PlayerCard
        name="田中 碧"
        nameKana="たなか あお"
        birth="2001年9月10日生（神奈川県横浜市出身）"
        position="MF（ミッドフィルダー）"
        highlight="🌍 ブンデスリーガ活躍中／日本A代表／カタールW杯出場"
        career={[
          { label: '幼少期', value: 'バディスポーツ幼児園横浜センター南' },
          { label: '中学', value: '川崎フロンターレU-15' },
          { label: '高校', value: '川崎フロンターレU-18' },
          { label: 'プロ', value: '川崎フロンターレ', note: 'J1 2020〜2022' },
          { label: '海外', value: 'フォルトゥナ・デュッセルドルフ', note: 'ブンデス2部 2022〜2023' },
          { label: '海外', value: 'フォルトゥナ・デュッセルドルフ', note: 'ブンデスリーガ1部昇格 2023〜2024' },
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
          { href: 'https://www.buddy-sports.co.jp/news/2672/', label: 'バディスポーツ公式' },
          { href: 'https://ja.wikipedia.org/wiki/%E7%94%B0%E4%B8%AD%E7%A2%A7_(%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E9%81%B8%E6%89%8B)', label: 'Wikipedia' },
        ]}
      />

      <PlayerCard
        name="塩貝 健人"
        nameKana="しおがい けんと"
        birth="2005年3月26日生（東京都出身）"
        position="FW（フォワード）"
        highlight="🌍 ブンデスリーガ VfLヴォルフスブルク所属／日本代表招集"
        career={[
          { label: '小学', value: 'バディSC江東' },
          { label: '中学', value: '横浜FCジュニアユース' },
          { label: '高校', value: '國學院久我山高校' },
          { label: '大学', value: '慶應義塾大学', note: '在学中に海外移籍' },
          { label: '海外', value: 'NECナイメヘン', note: 'エールディビジ（オランダ） 2024' },
          { label: '現在', value: 'VfLヴォルフスブルク', note: 'ブンデスリーガ 2024〜' },
        ]}
        tags={[
          { text: '海外プロ', color: 'gold' },
          { text: 'ブンデスリーガ', color: 'gold' },
          { text: '日本代表招集', color: 'red' },
          { text: '特別指定・J1', color: 'green' },
        ]}
        sources={[
          { href: 'https://ja.wikipedia.org/wiki/%E5%A1%A9%E8%B2%9D%E5%81%A5%E4%BA%BA', label: 'Wikipedia' },
          { href: 'https://www.buddy-sports.co.jp/news/4295/', label: 'バディスポーツ公式' },
        ]}
      />

      <PlayerCard
        name="池谷 銀姿郎"
        nameKana="いけや ぎんじろう"
        birth="2004年6月19日生（東京都出身）"
        position="DF（サイドバック）"
        highlight="🏅 2026シーズン ガンバ大阪（J1）加入内定"
        career={[
          { label: '小学', value: 'バディSC江東' },
          { label: '中学', value: '横浜FCジュニアユース' },
          { label: '高校', value: '横浜FCユース' },
          { label: '大学', value: '筑波大学', note: '3年在学中にプロ内定' },
          { label: 'プロ', value: 'ガンバ大阪', note: 'J1 2026シーズン加入内定' },
        ]}
        tags={[
          { text: 'J1内定', color: 'green' },
          { text: '大学MVPスタン', color: 'orange' },
          { text: '身長183cm', color: 'blue' },
        ]}
        sources={[
          { href: 'https://www.buddy-sports.co.jp/news/6008/', label: 'バディスポーツ公式' },
        ]}
      />

      <PlayerCard
        name="カウン・ゼン・マラ"
        nameKana="かうん ぜん まら"
        birth="2002年11月11日生（東京都出身）"
        position="GK（ゴールキーパー）"
        highlight="🏅 FC町田ゼルビア（J1）加入"
        career={[
          { label: '小学', value: 'バディSC江東', note: '7期生' },
          { label: '中学', value: '東京ヴェルディジュニアユース' },
          { label: '高校', value: '東京ヴェルディユース' },
          { label: '大学', value: '産業能率大学' },
          { label: 'プロ', value: 'FC町田ゼルビア', note: 'J1 2025シーズン加入' },
        ]}
        tags={[
          { text: 'J1プロ', color: 'green' },
          { text: 'GK', color: 'blue' },
          { text: '身長190cm', color: 'blue' },
        ]}
        sources={[
          { href: 'https://www.buddy-sports.co.jp/news/5087/', label: 'バディスポーツ公式' },
        ]}
      />

      {/* ─── プロ選手（女子） ─── */}
      <SectionHeader
        icon="👩‍⚽"
        title="プロサッカー選手（女子）"
        sub="なでしこ・五輪を経て世界へ"
      />

      <PlayerCard
        name="籾木 結花"
        nameKana="もみき ゆか"
        birth="1996年4月9日生（ニューヨーク出身）"
        position="MF/FW"
        highlight="🏅 東京五輪出場（バディ出身者初）／なでしこジャパン10番"
        career={[
          { label: '小学', value: 'バディFC世田谷', note: '女子チーム' },
          { label: '中高', value: '日テレ・メニーナ' },
          { label: 'プロ', value: '日テレ・東京ヴェルディベレーザ', note: 'WEリーグ' },
          { label: '海外', value: 'OL Reign', note: 'NWSL（アメリカ）' },
          { label: '海外', value: 'リンシェーピングFC', note: 'スウェーデン' },
          { label: '海外', value: 'レスター・シティ', note: 'イングランド' },
          { label: '現在', value: 'エヴァートンFC', note: 'イングランド' },
        ]}
        tags={[
          { text: '海外プロ', color: 'gold' },
          { text: '東京五輪2021', color: 'purple' },
          { text: 'なでしこ代表', color: 'red' },
          { text: 'W杯2019', color: 'red' },
          { text: 'なでしこ10番', color: 'orange' },
        ]}
        sources={[
          { href: 'https://ja.wikipedia.org/wiki/%E7%B1%BE%E6%9C%A8%E7%B5%90%E8%8A%B1', label: 'Wikipedia' },
          { href: 'https://www.buddy-sports.co.jp/news/1277/', label: 'バディスポーツ公式' },
        ]}
      />

      <PlayerCard
        name="小川 愛"
        nameKana="おがわ あい"
        position="FW（フォワード）"
        career={[
          { label: '小学', value: 'バディFC', note: '女子チーム' },
          { label: 'プロ', value: 'サンフレッチェ広島レジーナ', note: 'WEリーグ' },
        ]}
        tags={[
          { text: 'WEリーグ', color: 'green' },
          { text: '皇后杯優勝', color: 'gold' },
        ]}
        sources={[
          { href: 'https://www.buddy-sports.co.jp/cat_news/obog/', label: 'バディスポーツ公式OB' },
        ]}
      />

      {/* ─── 代表実績 ─── */}
      <SectionHeader
        icon="🇯🇵"
        title="日本代表・五輪の主な実績"
        sub="バディーSC出身の代表OB"
      />

      <div className="mx-4 space-y-2">
        {[
          { year: '2018', name: '武藤 嘉紀', event: 'FIFAワールドカップ ロシア大会', note: '日本A代表 グループステージ' },
          { year: '2019', name: '籾木 結花', event: 'FIFA女子ワールドカップ フランス大会', note: 'なでしこジャパン グループステージ突破' },
          { year: '2021', name: '籾木 結花', event: '東京オリンピック 女子サッカー', note: 'バディ出身者初のオリンピアン' },
          { year: '2022', name: '田中 碧', event: 'FIFAワールドカップ カタール大会', note: '日本A代表 ベスト16' },
          { year: '2025', name: '塩貝 健人', event: '日本A代表招集', note: '2026 W杯最終予選活動' },
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
        title="バディスポーツクラブについて"
        sub="選手を育てるクラブの背景"
      />

      <div className="mx-4 bg-[#FFF7ED] border border-[#C2410C]/10 rounded-xl px-4 py-4 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-[#C2410C] text-[10px] w-16 shrink-0 font-bold pt-0.5">設立</span>
          <span className="text-[#7C2D12] text-[12px]">1992年</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[#C2410C] text-[10px] w-16 shrink-0 font-bold pt-0.5">拠点</span>
          <span className="text-[#7C2D12] text-[12px]">横浜・東京・千葉・埼玉・名古屋ほか全国展開</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[#C2410C] text-[10px] w-16 shrink-0 font-bold pt-0.5">規模</span>
          <span className="text-[#7C2D12] text-[12px]">約6,000名以上（幼児〜小学生）</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[#C2410C] text-[10px] w-16 shrink-0 font-bold pt-0.5">特徴</span>
          <span className="text-[#7C2D12] text-[12px]">幼児園でのサッカー教育が出発点。卒団後はJクラブアカデミー・強豪校へ進む選手多数</span>
        </div>
      </div>

      {/* ─── 出典 ─── */}
      <div className="mx-4 mt-8 border-t border-slate-100 pt-5">
        <p className="text-slate-400 text-[9px] mb-2 font-bold">出典・参考</p>
        <div className="flex flex-wrap gap-2">
          <Src href="https://www.buddy-sports.co.jp/cat_news/obog/" label="バディスポーツクラブ 公式OB情報" />
          <Src href="https://ja.wikipedia.org/wiki/%E6%AD%A6%E8%97%A4%E5%98%89%E7%B4%80" label="武藤嘉紀 Wikipedia" />
          <Src href="https://ja.wikipedia.org/wiki/%E7%94%B0%E4%B8%AD%E7%A2%A7_(%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E9%81%B8%E6%89%8B)" label="田中碧 Wikipedia" />
          <Src href="https://ja.wikipedia.org/wiki/%E5%A1%A9%E8%B2%9D%E5%81%A5%E4%BA%BA" label="塩貝健人 Wikipedia" />
          <Src href="https://ja.wikipedia.org/wiki/%E7%B1%BE%E6%9C%A8%E7%B5%90%E8%8A%B1" label="籾木結花 Wikipedia" />
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

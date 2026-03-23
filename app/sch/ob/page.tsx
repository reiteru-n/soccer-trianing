import Link from 'next/link';
import Image from 'next/image';

/* ───────────── 共通 UI コンポーネント ───────────── */

function Tag({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'gold' | 'green' | 'red' | 'purple' | 'teal' }) {
  const styles: Record<string, string> = {
    blue:   'bg-[rgba(59,130,246,0.15)] text-[#60a5fa] border-[rgba(59,130,246,0.3)]',
    gold:   'bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]',
    green:  'bg-[rgba(34,197,94,0.15)] text-[#4ade80] border-[rgba(34,197,94,0.3)]',
    red:    'bg-[rgba(239,68,68,0.15)] text-[#f87171] border-[rgba(239,68,68,0.3)]',
    purple: 'bg-[rgba(168,85,247,0.15)] text-[#c084fc] border-[rgba(168,85,247,0.3)]',
    teal:   'bg-[rgba(20,184,166,0.15)] text-[#2dd4bf] border-[rgba(20,184,166,0.3)]',
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
      className="inline-flex items-center gap-1 text-[9px] text-[#3f4d6b] hover:text-[#60a5fa] transition-colors underline"
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
        <h2 className="text-white text-[17px] font-black">{title}</h2>
      </div>
      {sub && <p className="text-[#3f4d6b] text-[11px] mt-0.5 ml-7">{sub}</p>}
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
  tags: Array<{ text: string; color: 'blue' | 'gold' | 'green' | 'red' | 'purple' | 'teal' }>;
  sources: Array<{ href: string; label: string }>;
  highlight?: string;
}

function PlayerCard({ name, nameKana, birth, position, career, tags, sources, highlight }: PlayerCardProps) {
  return (
    <div className="mx-4 mb-3 bg-[#0b0e1a] border border-white/8 rounded-2xl overflow-hidden">
      {highlight && (
        <div className="bg-gradient-to-r from-[#1a2744] to-[#0d1530] px-4 py-2 border-b border-white/8">
          <p className="text-[#f59e0b] text-[11px] font-bold">{highlight}</p>
        </div>
      )}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-white text-[17px] font-black leading-tight">{name}</p>
            <p className="text-[#3f4d6b] text-[10px] mt-0.5">{nameKana}</p>
          </div>
          <div className="text-right shrink-0">
            {birth && <p className="text-[#3f4d6b] text-[9px]">{birth}</p>}
            {position && <p className="text-[#60a5fa] text-[10px] font-bold mt-0.5">{position}</p>}
          </div>
        </div>

        {/* 進路フロー */}
        <div className="mt-3 space-y-1.5">
          {career.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#3f4d6b] text-[10px] w-14 shrink-0 pt-0.5">{step.label}</span>
              <div className="flex-1">
                <span className="text-white text-[12px] font-semibold">{step.value}</span>
                {step.note && <span className="text-[#3f4d6b] text-[10px] ml-1">（{step.note}）</span>}
              </div>
            </div>
          ))}
        </div>

        {/* タグ */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((t, i) => <Tag key={i} color={t.color}>{t.text}</Tag>)}
        </div>

        {/* ソース */}
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {sources.map((s, i) => <Src key={i} href={s.href} label={s.label} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── JY進路カード ───────────── */

function PathCard({
  season, players, destinations,
}: {
  season: string;
  players: string[];
  destinations: string[];
}) {
  return (
    <div className="mx-4 mb-2 bg-[#0b0e1a] border border-white/8 rounded-xl px-4 py-3">
      <p className="text-[#f59e0b] text-[10px] font-bold mb-1">{season}</p>
      <div className="flex gap-4">
        <div className="flex-1">
          <p className="text-[#3f4d6b] text-[9px] mb-1">選手</p>
          {players.map((p, i) => (
            <p key={i} className="text-white text-[12px] font-semibold">{p}</p>
          ))}
        </div>
        <div className="text-[#3f4d6b] text-lg self-center">→</div>
        <div className="flex-1">
          <p className="text-[#3f4d6b] text-[9px] mb-1">進路</p>
          {destinations.map((d, i) => (
            <p key={i} className="text-[#60a5fa] text-[12px] font-semibold">{d}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── トレセンカード ───────────── */

function TrecenCard({ year, name, level, event, note }: {
  year: string; name: string; level: string; event: string; note?: string;
}) {
  return (
    <div className="mx-4 mb-2 bg-[#0b0e1a] border border-white/8 rounded-xl px-4 py-3 flex items-start gap-3">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-[#0d1530] flex items-center justify-center">
        <span className="text-[#f59e0b] text-[10px] font-black text-center leading-tight">{year}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white text-[13px] font-bold">{name}</p>
          <Tag color={level === 'ナショナル' ? 'gold' : level === '日本代表' ? 'red' : 'teal'}>{level}</Tag>
        </div>
        <p className="text-[#3f4d6b] text-[11px]">{event}</p>
        {note && <p className="text-[#60a5fa] text-[10px] mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

/* ───────────── メインページ ───────────── */

export default function ObPage() {
  return (
    <div className="min-h-screen bg-[#060810] pb-24">

      {/* ─── ヘッダー ─── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#080c20] to-[#060810] px-5 pt-8 pb-6 border-b border-white/8">
        <div className="absolute inset-0 pointer-events-none bg-radial-[ellipse_60%_120%_at_85%_50%] from-[rgba(34,197,94,0.06)] to-transparent" />

        <Link
          href="/sch/history"
          className="relative z-10 flex items-center gap-1.5 text-[#A8C4F0] text-[11px] mb-5 hover:text-white transition-colors"
        >
          ← 先輩たちの戦歴に戻る
        </Link>

        <div className="relative z-10 flex items-end gap-4">
          <Image
            src="/sch-logo.png"
            width={175}
            height={215}
            className="object-contain h-16 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            alt="SCH logo"
          />
          <div>
            <p className="text-[#4ade80] text-[9px] font-bold tracking-[0.22em] uppercase border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-2.5 py-0.5 rounded inline-block mb-2">
              SINCE 1986 · SCH FC OB
            </p>
            <h1 className="text-white text-[22px] font-black leading-tight">
              OBの進路・実績<br />
              <span className="text-[#4ade80]">まとめ</span>
            </h1>
            <p className="text-[#3f4d6b] text-[11px] mt-1.5">
              SCHが育てたOBたちの軌跡
            </p>
          </div>
        </div>

        {/* サマリー数字 */}
        <div className="relative z-10 grid grid-cols-3 gap-2 mt-5">
          <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-xl px-3 py-2.5 text-center">
            <p className="text-[#4ade80] text-[22px] font-black leading-none">3</p>
            <p className="text-[#3f4d6b] text-[9px] mt-0.5">プロ選手<br />（男女）</p>
          </div>
          <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-xl px-3 py-2.5 text-center">
            <p className="text-[#f59e0b] text-[22px] font-black leading-none">3</p>
            <p className="text-[#3f4d6b] text-[9px] mt-0.5">日本代表<br />選出歴</p>
          </div>
          <div className="bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] rounded-xl px-3 py-2.5 text-center">
            <p className="text-[#60a5fa] text-[22px] font-black leading-none">6+</p>
            <p className="text-[#3f4d6b] text-[9px] mt-0.5">強豪JYへ<br />の進路</p>
          </div>
        </div>
      </div>

      {/* ─── 注意書き ─── */}
      <div className="mx-4 mt-4 bg-[#0d1530] border border-[#1e3a6b] rounded-xl px-4 py-3">
        <p className="text-[#3f4d6b] text-[10px] leading-relaxed">
          ※ 本ページのデータはSCHFC公式サイト・Jリーグ公式・Wikipedia等の公開情報をもとに作成しています。
          各選手の記載内容は取得時点の情報です。最新情報は各リンク先をご確認ください。
        </p>
      </div>

      {/* ─── プロ選手（男子） ─── */}
      <SectionHeader
        icon="⚽"
        title="プロサッカー選手（男子）"
        sub="SCHから夢のプロへ！"
      />

      <PlayerCard
        name="松村 晃助"
        nameKana="まつむら こうすけ"
        birth="2004年5月2日生（神奈川県鎌倉市出身）"
        position="MF（ミッドフィルダー）"
        highlight="🏆 2027シーズン 横浜F・マリノス（J1）加入内定！"
        career={[
          { label: '小学', value: 'SCH.FC' },
          { label: '中学', value: '横浜F・マリノス JY追浜', note: '横浜市立谷本中' },
          { label: '高校', value: '横浜F・マリノスユース', note: '神奈川県立荏田高' },
          { label: '大学', value: '法政大学サッカー部' },
          { label: 'プロ', value: '横浜F・マリノス', note: '2027シーズン加入内定・2025特別指定' },
        ]}
        tags={[
          { text: 'J1プロ', color: 'gold' },
          { text: 'U-20日本代表', color: 'red' },
          { text: 'U-20W杯2023', color: 'red' },
          { text: 'U-18日本代表', color: 'purple' },
        ]}
        sources={[
          { href: 'https://www.f-marinos.com/news/team/8175', label: '横浜F・マリノス公式' },
          { href: 'https://ja.wikipedia.org/wiki/%E6%9D%BE%E6%9D%91%E6%99%83%E5%8A%A9', label: 'Wikipedia' },
          { href: 'https://www.jleague.jp/player/1639094', label: 'Jリーグ公式' },
        ]}
      />

      <PlayerCard
        name="中村 翼"
        nameKana="なかむら つばさ"
        birth="2002年4月26日生（神奈川県出身）"
        position="MF / FW"
        highlight="⚽ 2025シーズン 福島ユナイテッドFC（J3）でプロデビュー！"
        career={[
          { label: '小学', value: 'SCH.FC', note: '横浜市立上矢部小' },
          { label: '中学', value: '横浜F・マリノス JrユースU-15', note: '横浜市立岡津中' },
          { label: '高校', value: '横浜F・マリノスユース', note: '神奈川県立上矢部高・3年時キャプテン' },
          { label: '大学', value: '法政大学サッカー部' },
          { label: 'プロ', value: '福島ユナイテッドFC', note: 'J3・2025〜' },
        ]}
        tags={[
          { text: 'J3プロ', color: 'blue' },
          { text: '3/30初得点', color: 'green' },
          { text: 'FXスーパーカップ2020出場', color: 'teal' },
        ]}
        sources={[
          { href: 'https://fufc.jp/news/12094/', label: '福島ユナイテッドFC公式' },
          { href: 'https://ja.wikipedia.org/wiki/%E4%B8%AD%E6%9D%91%E7%BF%BC_(%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E9%81%B8%E6%89%8B)', label: 'Wikipedia' },
          { href: 'https://www.jleague.jp/player/1637254/', label: 'Jリーグ公式' },
        ]}
      />

      {/* ─── プロ選手（女子） ─── */}
      <SectionHeader
        icon="👩‍⚽"
        title="プロサッカー選手（女子）"
        sub="WEリーグ・なでしこの道を切り拓いたOG"
      />

      <PlayerCard
        name="小野 奈菜"
        nameKana="おの なな"
        birth="1999年5月1日生（神奈川県茅ヶ崎市出身）"
        position="DF（ディフェンダー）"
        highlight="🌟 U-17女子W杯 準優勝 / U-20女子W杯 優勝！"
        career={[
          { label: 'Jr年代', value: 'SCH.FC（ジュニアセレクト）' },
          { label: '中高', value: '日テレ・東京ヴェルディメニーナ' },
          { label: '大学', value: '神奈川大学' },
          { label: 'プロ', value: 'ノジマステラ神奈川相模原', note: 'WEリーグ' },
        ]}
        tags={[
          { text: 'WEリーグ', color: 'purple' },
          { text: 'U-17女子W杯準優勝', color: 'gold' },
          { text: 'U-20女子W杯優勝', color: 'red' },
        ]}
        sources={[
          { href: 'https://ja.wikipedia.org/wiki/%E5%B0%8F%E9%87%8E%E5%A5%88%E8%8F%9C', label: 'Wikipedia' },
          { href: 'https://www.sch-fc.com/', label: 'SCH公式（OB記載）' },
        ]}
      />

      {/* ─── 日本代表・国際大会歴 ─── */}
      <SectionHeader
        icon="🇯🇵"
        title="日本代表・国際大会歴"
        sub="SCH出身の日本代表選手たち"
      />

      <TrecenCard
        year="2023"
        name="松村晃助"
        level="日本代表"
        event="U-20日本代表 / U-20ワールドカップ（アルゼンチン）出場"
        note="小学年代: SCH.FC → 横浜FMユース → 法政大 → マリノス内定"
      />
      <TrecenCard
        year="2022"
        name="松村晃助"
        level="日本代表"
        event="U-18日本代表 / SBSカップ・スペイン遠征参加"
      />
      <TrecenCard
        year="2018"
        name="小野奈菜"
        level="日本代表"
        event="U-20女子日本代表 / U-20女子ワールドカップ 優勝🏆"
      />
      <TrecenCard
        year="2016"
        name="小野奈菜"
        level="日本代表"
        event="U-17女子ワールドカップ 準優勝🥈"
      />
      <TrecenCard
        year="2018"
        name="岩崎真波"
        level="日本代表"
        event="U-16日本代表 / 中国遠征・インターナショナルドリームカップ"
        note="SCH.FC → 横浜FMジュニアユース → ユース → 中央大学"
      />
      <TrecenCard
        year="2017"
        name="岩崎真波"
        level="ナショナル"
        event="U-15日本代表 / バル・ド・マルヌ国際大会（フランス）"
      />
      <div className="mx-4 mb-2">
        <Src href="https://web.gekisaka.jp/player/?43716-43716-jp" label="岩崎真波 ゲキサカ" />
      </div>

      <TrecenCard
        year="2019"
        name="小林夏生"
        level="日本代表"
        event="U-17日本代表 / UAE遠征（2度選出）"
        note="2013年度JrセレクトOB → 横浜F・マリノスユース"
      />
      <TrecenCard
        year="2019"
        name="小林夏生"
        level="ナショナル"
        event="愛媛国体 少年男子 神奈川県代表 / 全試合フル出場・優勝🏆"
      />
      <div className="mx-4 mb-2">
        <Src href="https://www.sch-fc.com/" label="SCH公式サイト（OB情報）" />
      </div>

      {/* ─── 強豪JY・ユース進路 ─── */}
      <SectionHeader
        icon="🏃"
        title="強豪JY・ユースへの進路"
        sub="横浜F・マリノス、横浜FCへ。Jリーグクラブの下部組織へ"
      />

      <PathCard
        season="2015年度卒"
        players={['岩崎 真波']}
        destinations={['横浜F・マリノス JY U-15', '→ 横浜FMユース → 中央大学']}
      />
      <PathCard
        season="2015年度卒"
        players={['佐藤 夏樹']}
        destinations={['横浜FC ジュニアユース', 'JリーグアカデミーU-13選出']}
      />
      <PathCard
        season="2016年度卒"
        players={['角田 恵風']}
        destinations={['横浜F・マリノス ユース', 'FUJI XEROX SUPER CUP 2020出場']}
      />
      <PathCard
        season="2014年度卒"
        players={['中村 翼']}
        destinations={['横浜F・マリノス JrユースU-15', '→ ユース → 法政大 → 福島(J3)プロ']}
      />
      <PathCard
        season="2014年度卒（Jrセレクト）"
        players={['小林 夏生']}
        destinations={['横浜F・マリノス ユース', 'U-17日本代表・国体優勝']}
      />
      <PathCard
        season="現役（〜2025）"
        players={['金丸 希陽']}
        destinations={['横浜F・マリノス JY追浜', 'JY所属中']}
      />
      <div className="mx-4 mb-2 flex flex-wrap gap-2">
        <Src href="https://www.sch-fc.com/" label="SCH公式サイト（OB情報）" />
        <Src href="https://www.f-marinos.com/team/academy/player/jryouth" label="横浜F・マリノス JY選手一覧" />
      </div>

      {/* ─── 進路イメージ ─── */}
      <SectionHeader
        icon="🗺️"
        title="SCHからの代表的な進路"
        sub="こんな道が待っている"
      />

      <div className="mx-4 bg-[#0b0e1a] border border-white/8 rounded-2xl p-4">
        <div className="space-y-3">
          {[
            { step: 'SCH.FC（小学生）', color: '#4ade80', icon: '⚽' },
            { step: '強豪JY（横浜FM・横浜FC など）', color: '#60a5fa', icon: '🏃' },
            { step: '強豪ユース・強豪高校', color: '#c084fc', icon: '🏫' },
            { step: '大学サッカー部 / プロアカデミー', color: '#f59e0b', icon: '🎓' },
            { step: 'Jリーグプロ・WEリーグ・日本代表', color: '#f87171', icon: '🇯🇵' },
          ].map((item, i, arr) => (
            <div key={i}>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: `${item.color}20`, border: `1px solid ${item.color}50` }}
                >
                  {item.icon}
                </div>
                <p className="text-white text-[13px] font-semibold">{item.step}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="ml-4 w-0.5 h-3 bg-white/10 my-0.5" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-xl px-4 py-3">
          <p className="text-[#4ade80] text-[11px] font-bold mb-1">SCHにいると、こんな可能性がある！</p>
          <ul className="text-[#a0b4c8] text-[11px] space-y-0.5">
            <li>✅ 横浜F・マリノスJYへ複数名が進学</li>
            <li>✅ J1・J3・WEリーグでプロとして活躍</li>
            <li>✅ U-15〜U-20まで各年代の日本代表に選出</li>
            <li>✅ ワールドカップ出場・優勝の実績</li>
          </ul>
        </div>
      </div>

      {/* ─── データソース ─── */}
      <SectionHeader
        icon="📚"
        title="データ出典・ソース"
      />

      <div className="mx-4 bg-[#0b0e1a] border border-white/8 rounded-2xl px-4 py-4 mb-4">
        <div className="space-y-2">
          {[
            { href: 'https://www.sch-fc.com/', label: 'SCHフットボールクラブ 公式サイト（OB情報ページ）' },
            { href: 'https://www.f-marinos.com/news/team/8175', label: '横浜F・マリノス公式：松村晃助 加入内定' },
            { href: 'https://www.jleague.jp/player/1639094', label: 'Jリーグ公式：松村晃助' },
            { href: 'https://ja.wikipedia.org/wiki/%E6%9D%BE%E6%9D%91%E6%99%83%E5%8A%A9', label: 'Wikipedia：松村晃助' },
            { href: 'https://fufc.jp/news/12094/', label: '福島ユナイテッドFC公式：中村翼 加入内定' },
            { href: 'https://www.jleague.jp/player/1637254/', label: 'Jリーグ公式：中村翼' },
            { href: 'https://ja.wikipedia.org/wiki/%E4%B8%AD%E6%9D%91%E7%BF%BC_(%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E9%81%B8%E6%89%8B)', label: 'Wikipedia：中村翼（サッカー選手）' },
            { href: 'https://ja.wikipedia.org/wiki/%E5%B0%8F%E9%87%8E%E5%A5%88%E8%8F%9C', label: 'Wikipedia：小野奈菜' },
            { href: 'https://web.gekisaka.jp/player/?43716-43716-jp', label: 'ゲキサカ：岩崎真波' },
            { href: 'https://sports-hosei.net/78893/', label: '法政大スポーツ：松村晃助インタビュー' },
          ].map((s, i) => (
            <div key={i}>
              <Src href={s.href} label={s.label} />
            </div>
          ))}
        </div>
        <p className="text-[#3f4d6b] text-[9px] mt-3 leading-relaxed">
          ※ 情報の誤り・追加情報がある場合はSCHチームにお知らせください。
          SCHFCの公式OB情報ページ（sch-fc.com）には小林夏生・佐藤夏樹・角田恵風・金丸希陽選手の情報が掲載されています（取得時点でアクセス制限あり）。
        </p>
      </div>

      {/* ─── 戻るリンク ─── */}
      <div className="mx-4 mt-2">
        <Link
          href="/sch/history"
          className="flex items-center justify-between w-full bg-[#0b0e1a] border border-white/8 rounded-xl px-4 py-3 hover:border-[#4ade80]/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-[#4ade80] text-lg">🏆</span>
            <div>
              <p className="text-white text-[13px] font-bold">先輩たちの戦歴</p>
              <p className="text-[#3f4d6b] text-[10px] mt-0.5">大会成績・記録を見る</p>
            </div>
          </div>
          <span className="text-[#4ade80] text-[18px] group-hover:-translate-x-1 transition-transform">←</span>
        </Link>
      </div>

    </div>
  );
}

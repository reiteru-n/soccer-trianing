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
    <details className="mx-4 mb-3 bg-[#0b0e1a] border border-white/8 rounded-2xl overflow-hidden">
      <summary className="cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden">
        {highlight && (
          <div className="bg-gradient-to-r from-[#1a2744] to-[#0d1530] px-4 py-2 border-b border-white/8">
            <p className="text-[#f59e0b] text-[11px] font-bold">{highlight}</p>
          </div>
        )}
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-white text-[17px] font-black leading-tight">{name}</p>
              <p className="text-[#3f4d6b] text-[10px] mt-0.5">{nameKana}</p>
            </div>
            <div className="text-right shrink-0">
              {position && <p className="text-[#60a5fa] text-[10px] font-bold">{position}</p>}
              <span className="text-[#3f4d6b] text-[9px]">▼ 経歴を見る</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((t, i) => <Tag key={i} color={t.color}>{t.text}</Tag>)}
          </div>
        </div>
      </summary>

      {/* 展開コンテンツ */}
      <div className="border-t border-white/8 px-4 py-3">
        {birth && <p className="text-[#3f4d6b] text-[9px] mb-2">{birth}</p>}
        <div className="space-y-1.5">
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
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {sources.map((s, i) => <Src key={i} href={s.href} label={s.label} />)}
          </div>
        )}
      </div>
    </details>
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
            <p className="text-[#4ade80] text-[22px] font-black leading-none">9+</p>
            <p className="text-[#3f4d6b] text-[9px] mt-0.5">プロ・JFL<br />（男女）</p>
          </div>
          <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-xl px-3 py-2.5 text-center">
            <p className="text-[#f59e0b] text-[22px] font-black leading-none">5+</p>
            <p className="text-[#3f4d6b] text-[9px] mt-0.5">日本代表<br />選出歴</p>
          </div>
          <div className="bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] rounded-xl px-3 py-2.5 text-center">
            <p className="text-[#60a5fa] text-[22px] font-black leading-none">8+</p>
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
        highlight="⚽ 2025シーズン 福島ユナイテッドFC（J3）でプロデビュー！ 3/30初得点"
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

      <PlayerCard
        name="齋藤 俊輔"
        nameKana="さいとう しゅんすけ"
        birth="2005年4月26日生（神奈川県出身）"
        position="MF"
        highlight="🌍 2026年 KVCウェステルロー（ベルギー）移籍！ J2月間MVP・U-20日本代表"
        career={[
          { label: '小学', value: 'SCH.FC → 横浜F・マリノスプライマリー' },
          { label: '中学', value: '横浜F・マリノス ジュニアユース' },
          { label: '高校', value: '桐光学園高校' },
          { label: 'プロ', value: '水戸ホーリーホック', note: 'J2・2024〜2025 / J2月間MVP・J2優秀選手賞' },
          { label: '海外', value: 'KVCウェステルロー', note: 'ベルギー1部・2026年移籍' },
        ]}
        tags={[
          { text: '海外プロ（ベルギー）', color: 'gold' },
          { text: 'U-20日本代表', color: 'red' },
          { text: 'J2月間MVP', color: 'green' },
          { text: 'J2優秀選手賞', color: 'teal' },
        ]}
        sources={[
          { href: 'https://www.mito-hollyhock.net/news/p=48042/', label: '水戸ホーリーホック公式' },
          { href: 'https://ja.wikipedia.org/wiki/%E9%BD%8B%E8%97%A4%E4%BF%8A%E8%BC%94', label: 'Wikipedia' },
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

      {/* ─── JFL・地域リーグOB ─── */}
      <SectionHeader
        icon="🏅"
        title="JFL・Jリーグ（その他）のOB"
        sub="SCH Jr（小学部）・JY（中学部）卒業後にプロ準相当以上で活躍"
      />

      {[
        {
          name: '平野 元稀', kana: 'ひらの もとき', birth: '2002年10月15日生',
          career: 'SCH.FC → 東急SレイエスFC → 帝京第三高 → 流通経済大 → Y.S.C.C.横浜（JFL）',
          src: 'https://www.fansaka.info/player/J52AF1/',
        },
        {
          name: '増田 健昇', kana: 'ますだ けんしょう', birth: '2003年9月22日生',
          career: 'SCH.FC → 横浜FCユース → 早稲田大学 → 横河武蔵野FC（JFL・2026年加入）',
          src: 'https://fc.yokogawa-musashino.jp/view/569',
        },
        {
          name: '阿部 隼人', kana: 'あべ はやと', birth: '1998年6月27日生',
          career: 'SCH.FC → 横浜FMアカデミー系 → FCティアモ枚方（JFL）',
          src: 'https://www.sch-fc.com/pages/246/',
        },
        {
          name: '萩原 大河', kana: 'はぎわら たいが', birth: '—',
          career: 'SCH.FC → ブリオベッカ浦安・市川（JFL）',
          src: 'https://www.sch-fc.com/pages/246/',
        },
        {
          name: '西山 大輝', kana: 'にしやま だいき', birth: '—',
          career: 'SCH.FC → クリアソン新宿（JFL）',
          src: 'https://www.sch-fc.com/pages/246/',
        },
        {
          name: '土佐 陸翼', kana: 'とさ りくと', birth: '—（SCH JY中学部卒）',
          career: 'SCH FC JY → 栃木シティFC（J3優勝・J2昇格 2025〜）',
          src: 'https://www.sch-fc.com/pages/246/',
        },
        {
          name: '国本 玲央', kana: 'くにもと れお', birth: '（SCH JY中学部 2013年度卒）',
          career: 'SCH FC JY → 暁星国際高 → レノファ山口FC（J2） → 新潟シンガポール等',
          src: 'https://www.sch-fc.com/pages/246/',
        },
        {
          name: '北村 涼太', kana: 'きたむら りょうた', birth: '（SCH JY中学部 2010年度卒）',
          career: 'SCH FC JY → 関東学院大 → 福島ユナイテッドFC（J3）',
          src: 'https://www.sch-fc.com/pages/246/',
        },
      ].map((p) => (
        <div key={p.name} className="mx-4 mb-2 bg-[#0b0e1a] border border-white/8 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-white text-[14px] font-bold">{p.name}</p>
              <p className="text-[#3f4d6b] text-[9px]">{p.kana}{p.birth !== '—' ? ` · ${p.birth}` : ''}</p>
            </div>
            <Tag color="blue">JFL</Tag>
          </div>
          <p className="text-[#60a5fa] text-[11px] mt-1.5 leading-relaxed">{p.career}</p>
          <div className="mt-1.5">
            <Src href={p.src} label="出典" />
          </div>
        </div>
      ))}

      {/* ─── 日本代表・国際大会歴 ─── */}
      <SectionHeader
        icon="🇯🇵"
        title="日本代表・国際大会歴"
        sub="SCH出身の日本代表選手たち"
      />

      <TrecenCard
        year="2024-25"
        name="齋藤俊輔"
        level="日本代表"
        event="U-20日本代表 複数回選出 / J2月間MVP・J2優秀選手賞"
        note="SCH.FC → 横浜FMプライマリー → 桐光学園 → 水戸(J2) → KVC(ベルギー)"
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

      {/* ─── 年度別進路まとめ ─── */}
      <SectionHeader
        icon="📋"
        title="年度別 輩出実績"
        sub="SCH卒業後の進路一覧（卒業年度順）"
      />

      {/* ── 進路先別カード (FC Porta スタイル) ── */}
      <div className="mx-4 mb-4 space-y-2">
        {[
          {
            club: '横浜F・マリノス系',
            count: '12+名',
            color: '#60a5fa',
            players: '松村晃助・中村翼・角田惠風・岩崎真波・小林夏生・金丸希陽・関一成・小漉良太・須見玲央斗・伊藤駿 ほか',
            note: 'JY本体 / JY追浜 / ユース',
          },
          {
            club: '横浜FC系',
            count: '3+名',
            color: '#4ade80',
            players: '佐藤夏樹・増田健昇 ほか',
            note: 'JY / ユース',
          },
          {
            club: '川崎フロンターレ',
            count: '3+名',
            color: '#f59e0b',
            players: '2022年度 3名（生田2・等々力1） ほか',
            note: 'JY',
          },
          {
            club: '湘南ベルマーレ',
            count: '6+名',
            color: '#c084fc',
            players: '2022年度 2名・2023年度 4名（JY/WAIST/EAST）',
            note: 'JY / WAIST / EAST',
          },
          {
            club: 'ノジマステラ 神奈川',
            count: '1+名',
            color: '#f87171',
            players: '小野奈菜（WEリーグプロ）・2023年度 Avvenire 1名',
            note: 'WEリーグ / Avvenire（育成）',
          },
        ].map((item) => (
          <div key={item.club} className="bg-[#0b0e1a] border border-white/8 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-white text-[13px] font-bold">{item.club}</p>
              <span className="text-[11px] font-black" style={{ color: item.color }}>{item.count}</span>
            </div>
            <p className="text-[#a0b4c8] text-[10px] leading-relaxed">{item.players}</p>
            <p className="text-[#3f4d6b] text-[9px] mt-0.5">{item.note}</p>
          </div>
        ))}
      </div>

      {/* ── 年度別一覧テーブル ── */}
      <div className="mx-4 mb-4 bg-[#0b0e1a] border border-white/8 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[70px_1fr_1fr] bg-[#0d1530] px-3 py-2 border-b border-white/8">
          <p className="text-[#3f4d6b] text-[9px] font-bold">卒業年度</p>
          <p className="text-[#3f4d6b] text-[9px] font-bold">選手 / 人数</p>
          <p className="text-[#3f4d6b] text-[9px] font-bold">主な進路先</p>
        </div>
        {[
          { year: '〜2010年度', a: true, name: '阿部 隼人', dest: '横浜FMアカデミー → FCティアモ枚方（JFL）' },
          { year: '2011年度', a: true, name: '小野 奈菜', dest: '日テレメニーナ → 神奈川大 → ノジマステラ（WEリーグ）' },
          { year: '2013年度', a: false, name: '小林 夏生', dest: '横浜FM ユース → 順天堂大（U-17日本代表）' },
          { year: '2014年度', a: false, name: '中村 翼', dest: '横浜FM JY → ユース → 法政大 → 福島（J3）' },
          { year: '2014年度', a: false, name: '平野 元稀', dest: '東急Sレイエス → 帝京第三高 → 流通経済大 → YSCC（JFL）' },
          { year: '2015年度', a: false, name: '岩崎 真波', dest: '横浜FM JY → ユース → 中央大（U-15・16代表）' },
          { year: '2015年度', a: false, name: '佐藤 夏樹', dest: '横浜FC JY' },
          { year: '2015年度', a: false, name: '角田 惠風', dest: '横浜FM JY追浜 → ユース → 慶應大 → 柏（J1）' },
          { year: '2015年度', a: false, name: '増田 健昇', dest: '横浜FC ユース → 早稲田大 → 横河武蔵野（JFL）' },
          { year: '2016年度', a: false, name: '松村 晃助', dest: '横浜FM JY追浜 → ユース → 法政大 → 横浜FM（J1）' },
          { year: '〜2017年度', a: true, name: '齋藤 俊輔', dest: '横浜FMプライマリー → JY → 桐光学園 → 水戸(J2) → ベルギー' },
          { year: '2021年度', a: false, name: '金丸 希陽', dest: '横浜FM JY追浜 → マリノスユース（2025〜）' },
          { year: '2022年度 計18名', a: false, name: '関 一成・小漉 良太・須見 玲央斗 ほか', dest: '横浜FM JY→ユース / 川崎F3名・横浜FC1名・SCH JY6名 等' },
          { year: '2023年度 計15名', a: false, name: '15名 卒業', dest: '横浜FM4名・横浜FC2名・川崎F1名・湘南BM4名・SCH JY2名 等' },
        ].map((row, i) => (
          <div key={i} className="grid grid-cols-[70px_1fr_1fr] px-3 py-2 border-b border-white/5 last:border-0 items-start">
            <p className="text-[#f59e0b] text-[10px] font-bold leading-tight pt-0.5">
              {row.year}{row.a && <span className="text-[#3f4d6b] text-[8px]">※</span>}
            </p>
            <p className="text-white text-[11px] font-semibold leading-tight pr-2">{row.name}</p>
            <p className="text-[#60a5fa] text-[10px] leading-tight">{row.dest}</p>
          </div>
        ))}
        <div className="px-3 py-2 bg-[#0d1530]">
          <p className="text-[#3f4d6b] text-[8px]">※ 推定年度。SCHの在籍期間により実際と異なる場合があります。2022・2023年度は人数のみ判明（個人名未確認）。</p>
        </div>
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
        season="2015年度卒"
        players={['角田 惠風']}
        destinations={['横浜FM JY追浜 → ユース → 慶應大', '→ 柏レイソル（J1）2026年加入⭐']}
      />
      <PathCard
        season="2014年度卒"
        players={['中村 翼']}
        destinations={['横浜F・マリノス JrユースU-15', '→ ユース → 法政大 → 福島(J3)プロ']}
      />
      <PathCard
        season="2013年度（Jrセレクト）"
        players={['小林 夏生']}
        destinations={['横浜FMユース → 順天堂大学', 'U-17日本代表・国体優勝']}
      />
      <PathCard
        season="2017年度頃（推定）"
        players={['齋藤 俊輔']}
        destinations={['横浜FMプライマリー → JY', '→ 桐光学園 → 水戸(J2) → ベルギー🌍']}
      />
      <PathCard
        season="2021年度"
        players={['金丸 希陽']}
        destinations={['横浜F・マリノス JY追浜', 'JY所属中']}
      />
      <div className="mx-4 mb-2 flex flex-wrap gap-2">
        <Src href="https://www.sch-fc.com/" label="SCH公式サイト（OB情報）" />
        <Src href="https://www.f-marinos.com/team/academy/player/jryouth" label="横浜F・マリノス JY選手一覧" />
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

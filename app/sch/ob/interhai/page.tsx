import Link from 'next/link';

/* ───────────── 共通 UI コンポーネント ───────────── */

function Tag({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'gold' | 'green' | 'red' | 'purple' | 'teal' | 'gray' }) {
  const styles: Record<string, string> = {
    blue:   'bg-[rgba(59,130,246,0.15)] text-[#60a5fa] border-[rgba(59,130,246,0.3)]',
    gold:   'bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]',
    green:  'bg-[rgba(34,197,94,0.15)] text-[#4ade80] border-[rgba(34,197,94,0.3)]',
    red:    'bg-[rgba(239,68,68,0.15)] text-[#f87171] border-[rgba(239,68,68,0.3)]',
    purple: 'bg-[rgba(168,85,247,0.15)] text-[#c084fc] border-[rgba(168,85,247,0.3)]',
    teal:   'bg-[rgba(20,184,166,0.15)] text-[#2dd4bf] border-[rgba(20,184,166,0.3)]',
    gray:   'bg-[rgba(100,116,139,0.15)] text-[#94a3b8] border-[rgba(100,116,139,0.3)]',
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
      className="inline-flex items-center gap-1 text-[9px] text-[#003087]/50 hover:text-[#0047AB] transition-colors underline"
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
        <h2 className="text-[#001A52] text-[17px] font-black">{title}</h2>
      </div>
      {sub && <p className="text-slate-500 text-[11px] mt-0.5 ml-7">{sub}</p>}
    </div>
  );
}

/* ───────────── 選手カード ───────────── */

type Confidence = 'confirmed' | 'originOnly' | 'unverified';

const CONFIDENCE_CFG: Record<Confidence, { label: string; color: 'gold' | 'teal' | 'red' }> = {
  confirmed:  { label: '出場実績あり（一部未確認点あり）', color: 'gold' },
  originOnly: { label: 'SCH.FC出身は確認済み・大会出場は未確認', color: 'teal' },
  unverified: { label: '未確認・要検証', color: 'red' },
};

interface InterhaiCardProps {
  name: string;
  school: string;
  grade?: string;
  confidence: Confidence;
  summary: string;
  caveat?: string;
  career?: string;
  sources: Array<{ href: string; label: string }>;
}

function InterhaiCard({ name, school, grade, confidence, summary, caveat, career, sources }: InterhaiCardProps) {
  const cfg = CONFIDENCE_CFG[confidence];
  return (
    <div className="mx-4 mb-3 bg-white border border-[#003087]/10 rounded-2xl px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <p className="text-[#001A52] text-[15px] font-black leading-tight">{name}</p>
          <p className="text-slate-500 text-[11px] mt-0.5">{school}{grade && ` ・ ${grade}`}</p>
        </div>
        <Tag color={cfg.color}>{cfg.label}</Tag>
      </div>
      <p className="text-[#0047AB] text-[12px] leading-relaxed">{summary}</p>
      {career && <p className="text-slate-500 text-[11px] mt-1.5 leading-relaxed">進路: {career}</p>}
      {caveat && (
        <p className="text-amber-600/90 text-[10px] mt-1.5 leading-relaxed bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          ⚠️ {caveat}
        </p>
      )}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {sources.map((s, i) => <Src key={i} href={s.href} label={s.label} />)}
        </div>
      )}
    </div>
  );
}

/* ───────────── メインページ ───────────── */

export default function InterhaiPage() {
  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ─── ヘッダー ─── */}
      <div className="relative overflow-hidden bg-[#003087] px-5 pt-8 pb-6">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(180deg, transparent, transparent 24px, rgba(255,255,255,0.06) 24px, rgba(255,255,255,0.06) 26px)' }}
        />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0047AB] to-[#001A52] opacity-80" />

        <Link
          href="/sch/ob"
          className="relative z-10 flex items-center gap-1.5 text-[#A8C4F0] text-[11px] mb-5 hover:text-white transition-colors"
        >
          ← OBの進路・実績まとめに戻る
        </Link>

        <div className="relative z-10">
          <p className="text-[#A8C4F0] text-[9px] font-bold tracking-[0.22em] uppercase border border-white/20 bg-white/10 px-2.5 py-0.5 rounded inline-block mb-2">
            2019年度〜 · インターハイ
          </p>
          <h1 className="text-white text-[22px] font-black leading-tight">
            SCH出身 高校サッカー<br />
            <span className="text-[#FFD700]">インターハイ出場選手</span>
          </h1>
          <p className="text-[#A8C4F0] text-[11px] mt-1.5">
            全国高等学校総合体育大会 サッカー競技への出場実績を調査
          </p>
        </div>
      </div>

      {/* ─── 調査方針・注意書き ─── */}
      <div className="mx-4 mt-4 bg-[#E8F0FE] border border-[#003087]/10 rounded-xl px-4 py-3 space-y-2">
        <p className="text-[#003087]/80 text-[11px] font-bold">📋 このページの調査方針について</p>
        <p className="text-[#003087]/70 text-[10px] leading-relaxed">
          SCH.FC卒団生の多くはJリーグクラブの下部組織「ユース」に進みますが、ユースチームは高体連（高校サッカー連盟）に非加盟のため、
          インターハイ（全国高等学校総合体育大会）には出場しません。インターハイに出場するのは、桐光学園・日大藤沢・桐蔭学園など、
          通常の「高体連」所属の高校サッカー部に進んだ選手のみです。
        </p>
        <p className="text-[#003087]/70 text-[10px] leading-relaxed">
          複数エージェントによるWeb調査を行いましたが、「SCH.FC出身」であることが学校・大会の公式メンバー表など一次資料で
          明記されている例は多くなく、大半は経歴紹介記事や検索結果の要約に基づく情報です。
          <b>2019年度以降の全出場選手を完全に網羅できているわけではありません。</b>
          方針として、確度の高い情報から未確認情報まですべて掲載し、選手ごとに確認レベルを明示しています。
          誤り・追加情報があればSCHチームまでお知らせください。
        </p>
      </div>

      {/* ─── 確度の高い実績 ─── */}
      <SectionHeader
        icon="🏆"
        title="インターハイ出場・実績が確認できた選手"
        sub="大会結果は公式記録で確認済み。本人の出場有無は一部未確認"
      />

      <InterhaiCard
        name="齋藤 俊輔"
        school="桐光学園高校（神奈川県）"
        grade="2021年度入学〜2023年度卒（推定）"
        confidence="confirmed"
        summary="桐光学園高校は2023年度（令和5年）全国高等学校総合体育大会サッカー競技大会で全国大会準優勝。決勝は明秀日立高校（茨城）と2-2で引き分け、PK戦5-6で惜敗した。"
        career="桐光学園高校 → 水戸ホーリーホック（J2、2024-2025・J2月間MVP）→ KVCウェステルロー（ベルギー1部、2026年〜）"
        caveat="齋藤選手本人がこの決勝を含む大会に実際に出場したかを示す一次資料（公式メンバー表等）は確認できていません。また「SCH.FC出身」の情報自体も複数の経歴紹介記事に基づくもので、学校・大会公式のメンバー表に出身少年団として明記された一次資料は見つかっていません。"
        sources={[
          { href: 'https://koko-soccer.com/report/3152/4523-2023inhi-tokogakuen-meishuhitachi0804', label: '高校サッカードットコム（決勝レポート）' },
          { href: 'https://www.jfa.jp/match/koukou_soutai_2023/men/team_detail/17.html', label: 'JFA公式（2023年度桐光学園チーム紹介）' },
        ]}
      />
      <p className="mx-4 mb-3 text-slate-400 text-[10px] leading-relaxed">
        ※ 参考: 齋藤選手は1年時（2021年度）にも全国高校サッカー選手権大会（冬の全国大会）に出場し、準々決勝で高川学園に0-1で敗退している（インターハイとは別大会）。
      </p>

      {/* ─── 出身確認済み・大会出場は未確認 ─── */}
      <SectionHeader
        icon="🔎"
        title="SCH.FC出身は確認・インターハイ出場は未確認"
        sub="JFA公式資料で出身少年団は確認できたが、在籍期間中の全国大会出場記録なし"
      />

      <InterhaiCard
        name="入谷 友陽"
        school="日本大学藤沢高校（神奈川県）"
        grade="3年（2025年度時点）"
        confidence="originOnly"
        summary="JFA公式の第104回全国高校サッカー選手権大会（2025年度・冬の全国大会）チーム紹介ページで、出身少年団「SCH FC」・背番号3・DFと明記。ただし在籍期間中（2023〜2025年度）、日大藤沢がインターハイ全国大会に出場した記録は確認できず。"
        caveat="出場したのは冬の選手権であり、インターハイ（夏の総体）出場実績ではありません。"
        sources={[
          { href: 'https://www.jfa.jp/match/alljapan_highschool_2025/team_detail/24.html', label: 'JFA公式（第104回選手権 日大藤沢チーム紹介）' },
        ]}
      />
      <InterhaiCard
        name="大森 拓翔"
        school="日本大学藤沢高校（神奈川県）"
        grade="3年（2025年度時点）"
        confidence="originOnly"
        summary="同じくJFA公式ページで出身少年団「SCH FC」・DFと明記。入谷選手と同様、在籍期間中のインターハイ全国大会出場記録は確認できず。"
        sources={[
          { href: 'https://www.jfa.jp/match/alljapan_highschool_2025/team_detail/24.html', label: 'JFA公式（第104回選手権 日大藤沢チーム紹介）' },
        ]}
      />

      {/* ─── 未確認・要検証 ─── */}
      <SectionHeader
        icon="❓"
        title="情報未確認・要検証の選手"
        sub="検索結果の要約情報のみ。一次資料での裏付けなし"
      />

      <InterhaiCard
        name="石橋 鞘"
        school="明秀日立高校（茨城県）"
        confidence="unverified"
        summary="出身チームとして「白根SC → SCH.FC」との検索要約あり。明秀日立は2023年度インターハイ全国優勝校だが、本人の入学時期は2024年度と推定され、優勝メンバーには入っていなかった可能性が高い。"
        career="明秀日立高校 → 日本大学"
        caveat="SCH.FC出身であることもインターハイ出場実績も一次資料で確認できていません。"
        sources={[
          { href: 'https://note.com/nichidai11/n/n0131a83ce819', label: '日本大学サッカー部note（検索要約）' },
        ]}
      />
      <InterhaiCard
        name="池上 遼太"
        school="桐光学園高校（神奈川県）"
        grade="2年 DF"
        confidence="unverified"
        summary="出身チーム「SCH.FC」との検索要約あり。桐光学園は2023〜2025年度連続でインターハイ全国大会に出場しているが、本人の出場記録は確認できず。"
        caveat="出身・出場実績とも一次資料での裏付けなし。"
        sources={[
          { href: 'https://yansaka.com/gachi/post_002624.html', label: 'ヤンサカ 桐光学園メンバー紹介（検索要約）' },
        ]}
      />
      <InterhaiCard
        name="小漉 健太"
        school="桐蔭学園高校（神奈川県）"
        grade="MF・背番号25"
        confidence="unverified"
        summary="出身チーム「SCH」との検索要約あり。桐蔭学園は2025年度にインターハイ神奈川県代表（準優勝校）として全国大会ベスト16。"
        caveat="出身・出場実績とも一次資料での裏付けなし。"
        sources={[
          { href: 'https://sgrum.com/web/toin-fc/staff/', label: '桐蔭学園高校サッカー部選手紹介（検索要約）' },
        ]}
      />
      <InterhaiCard
        name="藤田 琉生"
        school="桐蔭学園高校（神奈川県）"
        confidence="unverified"
        summary="出身チーム「SCH FC JY」との検索要約あり。個人ページが作成されるほどの注目選手だが、具体的なインターハイ出場年・結果は確認できず。"
        sources={[]}
      />
      <InterhaiCard
        name="西城 大翔"
        school="桐光学園高校（神奈川県）"
        grade="3年 FW"
        confidence="unverified"
        summary="出身チームの記載が資料により「東急SレイエスFC」「SCH.FC→横浜FCジュニアユース」など食い違っており、SCH.FC出身と断定できない。"
        caveat="出身情報が資料間で矛盾しているため、SCH.FC出身選手として扱うには要検証。"
        sources={[]}
      />

      {/* ─── 今後の注目株 ─── */}
      <SectionHeader
        icon="🌱"
        title="参考：今後の注目株"
        sub="2019〜2025年度のインターハイにはまだ出場対象外だが要注目"
      />
      <InterhaiCard
        name="本間 福太郎"
        school="東海大相模高校（神奈川県）"
        grade="1年 FW（2026年時点）"
        confidence="unverified"
        summary="出身チーム「SCH.FC」との検索要約あり。2026年入学のため、本調査対象（2019〜2025年度）のインターハイにはまだ出場実績なし。今後の全国大会出場に注目。"
        sources={[]}
      />

      {/* ─── 参考データ：神奈川県代表校 ─── */}
      <SectionHeader
        icon="📊"
        title="参考：神奈川県代表校 年度別一覧"
        sub="全国高校総体（インターハイ）男子サッカー競技・2019〜2025年度"
      />
      <div className="mx-4 mb-4 bg-white border border-[#003087]/10 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[56px_1fr_1.2fr] bg-[#E8F0FE]/40 px-3 py-2 border-b border-[#003087]/8">
          <p className="text-[#003087]/60 text-[9px] font-bold">年度</p>
          <p className="text-[#003087]/60 text-[9px] font-bold">神奈川県代表（2校）</p>
          <p className="text-[#003087]/60 text-[9px] font-bold">全国大会での成績</p>
        </div>
        {[
          { year: '2019', reps: '桐光学園・東海大相模', result: '桐光学園が全国優勝（決勝で富山第一に1-0）' },
          { year: '2020', reps: '― （新型コロナで開催中止）', result: '―' },
          { year: '2021', reps: '東海大相模・相洋', result: '詳細未確認' },
          { year: '2022', reps: '湘南工科大附・日大藤沢', result: '詳細未確認（全国優勝は前橋育英）' },
          { year: '2023', reps: '桐光学園・日大藤沢', result: '桐光学園が全国準優勝（PK5-6で明秀日立に惜敗）、日大藤沢はベスト4' },
          { year: '2024', reps: '桐光学園・東海大相模', result: '桐光学園ベスト8、東海大相模ベスト16（全国優勝は昌平）' },
          { year: '2025', reps: '桐光学園（3連覇）・桐蔭学園', result: '両校ベスト16（全国優勝は神村学園）' },
        ].map((row) => (
          <div key={row.year} className="grid grid-cols-[56px_1fr_1.2fr] px-3 py-2 border-b border-[#003087]/5 last:border-0 items-start">
            <p className="text-[#003087] text-[10px] font-bold pt-0.5">{row.year}</p>
            <p className="text-[#001A52] text-[11px] font-semibold leading-tight pr-2">{row.reps}</p>
            <p className="text-[#0047AB] text-[10px] leading-tight">{row.result}</p>
          </div>
        ))}
        <div className="px-3 py-2 bg-[#E8F0FE]/40">
          <p className="text-slate-400 text-[8px] leading-relaxed">
            ※ この一覧はSCH.FC出身選手の有無に関わらず、神奈川県代表校の記録として参考掲載しています。
            一部年度は詳細成績が未確認です。
          </p>
        </div>
      </div>

      {/* ─── データ出典 ─── */}
      <SectionHeader
        icon="📚"
        title="データ出典・ソース"
      />
      <div className="mx-4 bg-white border border-[#003087]/10 rounded-2xl px-4 py-4 mb-4">
        <div className="space-y-2">
          {[
            { href: 'https://koko-soccer.com/report/3152/4523-2023inhi-tokogakuen-meishuhitachi0804', label: '高校サッカードットコム：2023年度インターハイ決勝レポート' },
            { href: 'https://www.jfa.jp/match/koukou_soutai_2023/men/team_detail/17.html', label: 'JFA公式：2023年度桐光学園チーム紹介' },
            { href: 'https://www.jfa.jp/match/alljapan_highschool_2025/team_detail/24.html', label: 'JFA公式：第104回全国高校サッカー選手権 日大藤沢チーム紹介' },
            { href: 'https://note.com/nichidai11/n/n0131a83ce819', label: '日本大学サッカー部note' },
            { href: 'https://yansaka.com/gachi/post_002624.html', label: 'ヤンサカ：桐光学園メンバー紹介' },
            { href: 'https://sgrum.com/web/toin-fc/staff/', label: '桐蔭学園高校サッカー部選手紹介' },
          ].map((s, i) => (
            <div key={i}>
              <Src href={s.href} label={s.label} />
            </div>
          ))}
        </div>
        <p className="text-slate-400 text-[9px] mt-3 leading-relaxed">
          ※ 本ページの多くの情報は検索エンジンの要約（一次資料への直接アクセスが制限されていたため）に基づいています。
          誤り・追加情報・SCH.FC出身選手の情報提供があれば、SCHチームまでお知らせください。
        </p>
      </div>

      {/* ─── 戻るリンク ─── */}
      <div className="mx-4 mt-2">
        <Link
          href="/sch/ob"
          className="flex items-center justify-between w-full bg-white border border-[#003087]/10 rounded-xl px-4 py-3 hover:border-[#003087]/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-[#003087] text-lg">🎓</span>
            <div>
              <p className="text-[#001A52] text-[13px] font-bold">OBの進路・実績まとめ</p>
              <p className="text-slate-400 text-[10px] mt-0.5">プロ選手・日本代表歴を見る</p>
            </div>
          </div>
          <span className="text-[#003087] text-[18px] group-hover:-translate-x-1 transition-transform">←</span>
        </Link>
      </div>

    </div>
  );
}

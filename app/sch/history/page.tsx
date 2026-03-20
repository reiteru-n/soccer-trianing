import Link from 'next/link';
import Image from 'next/image';

// ---- Badge component ----
function Badge({ type, children }: { type: 'gold' | 'silver' | 'blue' | 'red' | 'gray'; children: React.ReactNode }) {
  const styles = {
    gold:   'bg-yellow-400/20 text-yellow-700 border border-yellow-400/50 font-bold',
    silver: 'bg-slate-200/80 text-slate-600 border border-slate-300 font-bold',
    blue:   'bg-blue-100 text-blue-700 border border-blue-300 font-semibold',
    red:    'bg-red-100 text-red-600 border border-red-200 font-semibold',
    gray:   'bg-slate-100 text-slate-500 border border-slate-200 font-semibold',
  };
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full ${styles[type]}`}>
      {children}
    </span>
  );
}

// ---- Source link ----
function Src({ href, label }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded whitespace-nowrap"
    >
      ↗ {label ?? '出典'}
    </a>
  );
}

// ---- Section header ----
function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-blue-100">
      <span className="text-[10px] font-extrabold text-blue-400 tracking-widest uppercase">{num}</span>
      <h2 className="text-base font-extrabold text-blue-900">{title}</h2>
      <span className="ml-auto text-blue-200 text-xl font-black">↑</span>
    </div>
  );
}

// ---- Table wrapper ----
function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden mb-4">
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-2.5">
        <p className="text-white text-[11px] font-bold tracking-wide">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, highlight, className }: { children: React.ReactNode; highlight?: boolean; className?: string }) {
  return (
    <td className={`px-3 py-2.5 align-top border-b border-slate-50 ${highlight ? 'bg-yellow-50/60' : ''} ${className ?? ''}`}>
      {children}
    </td>
  );
}

function Year({ y }: { y: string }) {
  return <span className="text-[10px] font-bold text-blue-500">{y}</span>;
}

// ---- Unknown ----
function Unknown() {
  return (
    <span className="inline-block text-[10px] text-slate-400 border border-dashed border-slate-300 px-2 py-0.5 rounded">
      未確認
    </span>
  );
}

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-16">

      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 px-5 pt-8 pb-10 relative overflow-hidden">
        {/* Decorative upward stripes */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-0 w-full h-full opacity-10"
            style={{ background: 'repeating-linear-gradient(-60deg, transparent, transparent 18px, #fff 18px, #fff 20px)' }} />
        </div>
        <div className="absolute top-3 right-4 text-white/10 text-[120px] font-black leading-none select-none pointer-events-none">
          ↑
        </div>
        <Link href="/sch" className="flex items-center gap-1.5 text-blue-200 text-[11px] mb-5 hover:text-white transition-colors">
          ← SCHチームページに戻る
        </Link>
        <div className="flex items-end gap-4 relative z-10">
          <Image src="/sch-logo.png" width={175} height={215} className="object-contain h-16 w-auto drop-shadow-lg" alt="SCH logo" />
          <div>
            <p className="text-blue-200 text-[10px] font-bold tracking-widest uppercase mb-1">SINCE 1986</p>
            <h1 className="text-white text-2xl font-extrabold leading-tight tracking-tight">
              SCH.FC<br />
              <span className="text-yellow-300">先輩たちの</span>戦歴
            </h1>
            <p className="text-blue-200 text-[11px] mt-2">2020年〜現在 ／ U-10〜U-12</p>
          </div>
        </div>

        {/* Achievement strip */}
        <div className="flex gap-2 mt-5 flex-wrap relative z-10">
          {[
            { icon: '🏆', label: '全国ベスト8', sub: '2022年度' },
            { icon: '🥇', label: '神奈川優勝', sub: '日産カップ 2021' },
            { icon: '🥇', label: '関東優勝', sub: 'フジパンCUP 2023' },
          ].map(a => (
            <div key={a.label} className="bg-white/10 backdrop-blur rounded-xl px-3 py-1.5 border border-white/20">
              <p className="text-white text-[11px] font-bold">{a.icon} {a.label}</p>
              <p className="text-blue-200 text-[9px]">{a.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Notice */}
      <div className="mx-4 mt-4 mb-1 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400 rounded-xl px-4 py-3 text-[11px] text-amber-700">
        ⚠️ 掲載情報は各出典URLに基づく確認済み情報のみです。未確認箇所は「未確認」と表示。最新情報は各協会公式サイトでご確認ください。
      </div>

      {/* Content */}
      <div className="px-4 pt-5 space-y-8">

        {/* ===== U-12 ===== */}
        <section>
          <SectionHeader num="01" title="U-12 主要大会成績" />

          {/* 全日本U-12 */}
          <ResultCard title="🏆 全日本U-12サッカー選手権 神奈川県大会（FA中央大会）">
            <thead>
              <tr>
                <Th>年度</Th>
                <Th>回</Th>
                <Th>結果</Th>
                <Th>備考</Th>
                <Th>出典</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td><Year y="2020" /></Td>
                <Td>第44回</Td>
                <Td><Badge type="blue">第3位</Badge></Td>
                <Td className="text-slate-500 text-[11px]">CHALLENGE CUP 県代表（中止）</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1413647" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2021" /></Td>
                <Td>第45回</Td>
                <Td><Badge type="blue">第3位</Badge></Td>
                <Td className="text-slate-500 text-[11px]">CHALLENGE CUP 準優勝</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1413647" label="JSN" /></Td>
              </tr>
              <tr className="">
                <Td highlight><Year y="2022" /></Td>
                <Td highlight>第46回</Td>
                <Td highlight><Badge type="gold">🥇 優勝</Badge></Td>
                <Td highlight><span className="text-[11px] text-slate-600">20年ぶり2回目 → 全国へ</span></Td>
                <Td highlight><Src href="https://www.juniorsoccer-news.com/post-1295063" label="JSN" /></Td>
              </tr>
              <tr>
                <Td highlight><Year y="2022" /></Td>
                <Td highlight>全国（第46回）</Td>
                <Td highlight><Badge type="blue">全国ベスト8</Badge></Td>
                <Td highlight><span className="text-[11px] text-slate-600">PK戦で惜敗</span></Td>
                <Td highlight><Src href="https://www.sakaiku.jp/column/technique/2023/016131.html" label="サカイク" /></Td>
              </tr>
              <tr>
                <Td><Year y="2023" /></Td>
                <Td>第47回</Td>
                <Td><Badge type="blue">第4位</Badge></Td>
                <Td className="text-slate-500 text-[11px]">準決勝敗退</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1413647" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2024" /></Td>
                <Td>第48回</Td>
                <Td><Badge type="gray">ベスト16</Badge></Td>
                <Td className="text-slate-500 text-[11px]">TOPリーグ1部として出場</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1633100" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2025" /></Td>
                <Td>第49回</Td>
                <Td><Badge type="blue">ベスト8</Badge></Td>
                <Td className="text-slate-500 text-[11px]">2部Aから出場、横須賀撃破</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1864422" label="JSN" /></Td>
              </tr>
            </tbody>
          </ResultCard>

          {/* 日産カップ U12 */}
          <ResultCard title="🏟 日産カップ争奪 神奈川県少年サッカー選手権 U-12">
            <thead>
              <tr><Th>年度</Th><Th>回</Th><Th>結果</Th><Th>備考</Th><Th>出典</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td highlight><Year y="2021" /></Td>
                <Td highlight>第48回</Td>
                <Td highlight><Badge type="gold">🥇 優勝</Badge></Td>
                <Td highlight><span className="text-[11px] text-slate-600">7年ぶり6大会ぶり</span></Td>
                <Td highlight><Src href="https://www.juniorsoccer-news.com/post-1084079" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2022〜2024" /></Td>
                <Td>49〜51回</Td>
                <Td><Unknown /></Td>
                <Td className="text-slate-400 text-[11px]">詳細未確認</Td>
                <Td>—</Td>
              </tr>
              <tr>
                <Td><Year y="2025" /></Td>
                <Td>第52回</Td>
                <Td><Badge type="silver">第3位</Badge></Td>
                <Td className="text-slate-500 text-[11px]">準決勝で惜敗</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1886363" label="JSN" /></Td>
              </tr>
            </tbody>
          </ResultCard>

          {/* FAリーグ TOPリーグ */}
          <ResultCard title="📊 FAリーグ TOPリーグ ポジション推移">
            <thead>
              <tr><Th>年度</Th><Th>区分</Th><Th>備考</Th><Th>出典</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td highlight><Year y="2022" /></Td>
                <Td highlight><Badge type="gold">1部</Badge></Td>
                <Td highlight><span className="text-[11px] text-slate-600">全日本優勝年度</span></Td>
                <Td highlight><Src href="https://www.juniorsoccer-news.com/post-1295063" label="JSN" /></Td>
              </tr>
              <tr>
                <Td highlight><Year y="2023" /></Td>
                <Td highlight><Badge type="gold">1部</Badge></Td>
                <Td highlight>—</Td>
                <Td highlight><Src href="https://www.juniorsoccer-news.com/post-1413647" label="JSN" /></Td>
              </tr>
              <tr>
                <Td highlight><Year y="2024" /></Td>
                <Td highlight><Badge type="gold">1部</Badge></Td>
                <Td highlight>—</Td>
                <Td highlight><Src href="https://www.juniorsoccer-news.com/post-1633100" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2025" /></Td>
                <Td><Badge type="red">2部A</Badge></Td>
                <Td className="text-slate-500 text-[11px]">1部から降格</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1789175" label="JSN" /></Td>
              </tr>
              <tr>
                <Td highlight><Year y="2026" /></Td>
                <Td highlight><Badge type="gold">1部 復帰</Badge></Td>
                <Td highlight><span className="text-[11px] text-slate-600">入替戦を制して復帰確定</span></Td>
                <Td highlight><Src href="https://www.juniorsoccer-news.com/post-1888753" label="JSN" /></Td>
              </tr>
            </tbody>
          </ResultCard>

          {/* その他大会 */}
          <ResultCard title="📋 その他主要大会（U-12）">
            <thead>
              <tr><Th>年度</Th><Th>大会名</Th><Th>結果</Th><Th>出典</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td><Year y="2021" /></Td>
                <Td className="text-[11px]">県チャンピオンシップ U-10（低学年）</Td>
                <Td><Badge type="silver">準優勝</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1582248" label="JSN" /></Td>
              </tr>
              <tr>
                <Td highlight><Year y="2023" /></Td>
                <Td highlight className="text-[11px]">神奈川県チャンピオンシップ U-12（第43回）</Td>
                <Td highlight><Badge type="gold">🥇 優勝</Badge></Td>
                <Td highlight><Src href="https://www.juniorsoccer-news.com/post-1582248" label="JSN" /></Td>
              </tr>
              <tr>
                <Td highlight><Year y="2023" /></Td>
                <Td highlight className="text-[11px]">フジパンCUP 第47回関東U-12</Td>
                <Td highlight><Badge type="gold">🥇 優勝</Badge></Td>
                <Td highlight><Src href="https://www.juniorsoccer-news.com/post-1582248" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2023" /></Td>
                <Td className="text-[11px]">TOBIGERI ONE 2023 sfida CUP</Td>
                <Td><Badge type="silver">第3位</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1582248" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2025" /></Td>
                <Td className="text-[11px]">横浜後期リーグ 兼 横浜国際チビッ子大会</Td>
                <Td><Badge type="gray">ベスト8</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1863300" label="JSN" /></Td>
              </tr>
            </tbody>
          </ResultCard>
        </section>

        {/* ===== U-11 ===== */}
        <section>
          <SectionHeader num="02" title="U-11 プレミアリーグ神奈川 成績" />

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-[11px] text-blue-700">
            神奈川県内最大規模のジュニアリーグ。80チーム超が参加し1〜3部に分かれて年間戦う。
          </div>

          <ResultCard title="長谷工プレミアリーグ神奈川 U-11 1部 順位">
            <thead>
              <tr><Th>シーズン</Th><Th>1部順位</Th><Th>勝点・成績</Th><Th>出典</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td><Year y="2022-23" /></Td>
                <Td><Badge type="blue">5位 / 12チーム</Badge></Td>
                <Td className="text-[11px] text-slate-500">38pt（12勝2分8敗）1部維持</Td>
                <Td><Src href="https://pl11.jp/kanagawa/1st_2022" label="PL11" /></Td>
              </tr>
              <tr>
                <Td><Year y="2023-24" /></Td>
                <Td><Badge type="blue">6位 / 11チーム</Badge></Td>
                <Td className="text-[11px] text-slate-500">27pt（8勝3分9敗）1部維持</Td>
                <Td><Src href="https://pl11.jp/kanagawa/1st_2023" label="PL11" /></Td>
              </tr>
              <tr>
                <Td><Year y="2024-25" /></Td>
                <Td><Badge type="red">8位 / 10チーム</Badge></Td>
                <Td className="text-[11px] text-slate-500">9pt（3勝0分15敗）2部降格</Td>
                <Td><Src href="https://pl11.jp/kanagawa/2024-2025" label="PL11" /></Td>
              </tr>
            </tbody>
          </ResultCard>

          <ResultCard title="🏆 SCH SUPER LEAGUE U-11（SCH主催招待大会）">
            <thead>
              <tr><Th>年度</Th><Th>大会</Th><Th>結果</Th><Th>出典</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td><Year y="2022" /></Td>
                <Td className="text-[11px]">第14回 SCH SUPER LEAGUE U-11</Td>
                <Td><Badge type="silver">準優勝</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1494456" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2023" /></Td>
                <Td className="text-[11px]">第15回 SCH SUPER LEAGUE U-11</Td>
                <Td className="text-[11px] text-slate-500">SCHはホスト主催</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1494456" label="JSN" /></Td>
              </tr>
            </tbody>
          </ResultCard>
        </section>

        {/* ===== U-10 ===== */}
        <section>
          <SectionHeader num="03" title="U-10 主要大会成績" />

          <ResultCard title="🏟 日産カップ争奪 神奈川県少年サッカー選手権 U-10">
            <thead>
              <tr><Th>年度</Th><Th>回</Th><Th>結果</Th><Th>出典</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td><Year y="2021" /></Td>
                <Td>第48回</Td>
                <Td><Badge type="silver">第3位</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1610325" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2022" /></Td>
                <Td>第49回</Td>
                <Td><Badge type="blue">第4位</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1610325" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2023" /></Td>
                <Td>第50回</Td>
                <Td><Badge type="gray">ベスト16</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1610325" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2024" /></Td>
                <Td>第51回</Td>
                <Td><Unknown /></Td>
                <Td>—</Td>
              </tr>
            </tbody>
          </ResultCard>

          <ResultCard title="🏅 神奈川県チャンピオンシップ U-10">
            <thead>
              <tr><Th>年度</Th><Th>大会</Th><Th>結果</Th><Th>出典</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td><Year y="2021" /></Td>
                <Td className="text-[11px]">第13回 チャンピオンシップ</Td>
                <Td><Badge type="silver">準優勝</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1582248" label="JSN" /></Td>
              </tr>
              <tr>
                <Td><Year y="2022〜2024" /></Td>
                <Td className="text-[11px]">各回</Td>
                <Td><Unknown /></Td>
                <Td>—</Td>
              </tr>
              <tr>
                <Td><Year y="2025" /></Td>
                <Td className="text-[11px]">第17回 チャンピオンシップ</Td>
                <Td><Badge type="gray">ベスト8</Badge></Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1822402" label="JSN" /></Td>
              </tr>
            </tbody>
          </ResultCard>

          <ResultCard title="⚽ 横浜市前期リーグ U-10（参考）">
            <thead>
              <tr><Th>年度</Th><Th>大会</Th><Th>SCHの状況</Th><Th>出典</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td><Year y="2025" /></Td>
                <Td className="text-[11px]">JFA U-10リーグ 横浜前期</Td>
                <Td className="text-[11px] text-slate-600">SCH.FC-W ベスト4進出</Td>
                <Td><Src href="https://www.juniorsoccer-news.com/post-1785931" label="JSN" /></Td>
              </tr>
            </tbody>
          </ResultCard>
        </section>

        {/* ===== Sources ===== */}
        <section>
          <SectionHeader num="04" title="情報出典 URL一覧" />
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-3 text-[11px]">
            {[
              { label: 'juniorsoccer-news.com（主要大会記事）', href: 'https://www.juniorsoccer-news.com/team/8162/' },
              { label: 'プレミアリーグ神奈川 公式 pl11.jp', href: 'https://pl11.jp/kanagawa/' },
              { label: 'サカイク（2022全国ベスト8インタビュー）', href: 'https://www.sakaiku.jp/column/technique/2023/016131.html' },
              { label: '神奈川県FA公式（U-12）', href: 'https://kanagawa-fa.gr.jp/u12/' },
              { label: 'JRユースナビ（チーム紹介）', href: 'https://jr-youth-navi.com/introduce/sch-fc-com/' },
            ].map(s => (
              <div key={s.href} className="flex items-start gap-2">
                <span className="text-blue-300 mt-0.5">▸</span>
                <a href={s.href} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline break-all">
                  {s.label}
                </a>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 px-1">最終更新：2026年3月 ／ 情報は出典URLに基づく確認済み情報のみ掲載</p>
        </section>

      </div>
    </div>
  );
}

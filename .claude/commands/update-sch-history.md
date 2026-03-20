# SCH.FC 戦績ページ 更新コマンド

SCH.FC の戦績ページ (`app/sch/history/page.tsx`) を最新データで更新する。

---

## 実行手順

### Step 1: 現状把握

`app/sch/history/page.tsx` を読んで現在掲載されている年度・成績・出典URLを把握する。
ページが存在しない場合は下記 **ゼロから作成** セクションの指示に従う。

### Step 2: リサーチエージェントを並列起動

以下の3エージェントを **同時に** 起動する（並列実行）。

#### エージェント A — U-12 最新成績リサーチ
```
SCH.FC（神奈川県横浜市泉区）のU-12カテゴリの最新大会成績を調査してください。

対象大会:
1. 全日本U-12サッカー選手権（神奈川県大会・関東大会・全国大会）
2. 日産カップ争奪 神奈川県少年サッカー選手権（U-12/高学年部門）
3. バーモントカップ（フットサル全国大会）
4. SCH SUPER LEAGUE（独自リーグ戦）
5. フジパンCUP U-12 関東大会
6. その他主要大会

調査対象年度: 2019〜2025年度

各結果について:
- 大会名・年度・回次・SCH.FCの成績（順位 or ベスト何）
- スコア・対戦相手（判明する場合）
- 出典URL（juniorsoccer-news.com, j-s-weekly.com など）

情報源: juniorsoccer-news.com, j-s-weekly.com, goal-assist.com 等を検索すること。
調査のみ行い、コードは書かないこと。
```

#### エージェント B — U-10/U-11 最新成績リサーチ
```
SCH.FC（神奈川県横浜市泉区）のU-11・U-10カテゴリの最新大会成績を調査してください。

対象大会:
1. プレミアリーグ神奈川（U-11）
2. 日産カップ争奪 神奈川県少年サッカー選手権（U-10低学年部門）
3. 神奈川県チャンピオンシップ U-10（低学年）
4. 横浜市前期・後期少年サッカー大会 U-10
5. SCH SUPER LEAGUE（U-11）

調査対象年度: 2019〜2025年度

各結果について:
- 大会名・年度・回次・SCH.FCの成績（順位 or ベスト何）
- スコア・対戦相手（判明する場合）
- 出典URL

情報源: juniorsoccer-news.com, j-s-weekly.com, goal-assist.com 等を検索すること。
調査のみ行い、コードは書かないこと。
```

#### エージェント C — U-8 最新成績リサーチ
```
SCH.FC（神奈川県横浜市泉区）のU-8・U-9カテゴリの最新大会成績を調査してください。

対象大会:
1. 横浜国際チビッ子サッカー大会（U-8 2年生以下）
2. 横浜市春季少年サッカー大会（U-8）
3. 日産カップ低学年部門（U-10相当、3年生以下含む場合）
4. その他 U-8/U-9 公式大会

調査対象年度: 2019〜2025年度

各結果について:
- 大会名・年度・回次・SCH.FCの成績（順位 or ベスト何）
- スコア・対戦相手（判明する場合）
- 出典URL

補足: 神奈川ではU-7・U-9単独の公式主要大会は少ない。U-8（2年生以下）が最小カテゴリ。
情報源: juniorsoccer-news.com 等を検索すること。
調査のみ行い、コードは書かないこと。
```

### Step 3: 差分チェック

3エージェントの結果が揃ったら:
- **新規データ**（現在のページにない年度・成績）を特定する
- **不一致データ**（現在のページと異なる成績・出典）を特定する
- **重大な実績**（優勝・全国出場等）はヒーローバッジに追記を検討

### Step 4: ページ更新

差分を `app/sch/history/page.tsx` に反映する:
- 新規年度の行を追加
- 成績の誤りを修正
- 出典URLを更新
- ヒーローバッジへの追記（必要な場合）

### Step 5: コミット & デプロイ

```bash
# 型チェック
npx tsc --noEmit

# コミット
git add app/sch/history/page.tsx
git commit -m "feat: SCH戦績ページ更新 $(date '+%Y-%m')"

# デプロイ（必須: github remote への push）
git checkout master
git merge claude/<現在のブランチ名> --no-edit
git push github master
```

---

## ゼロから作成する場合

ページが存在しない場合は、まずリサーチエージェントを実行し、
その後以下のコンポーネント構成でページを作成する:

### UIコンポーネント定義（ページ上部に記述）

```tsx
// --- 再利用コンポーネント ---
function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="bg-[#003087] text-white text-[10px] font-black px-2 py-1 rounded">{num}</span>
      <h2 className="text-slate-800 font-black text-[15px]">{title}</h2>
    </div>
  );
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl overflow-hidden border border-slate-200">
      <div className="bg-[#003087] px-4 py-2">
        <p className="text-white font-bold text-[12px]">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">{children}</table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="bg-slate-50 px-3 py-2 text-left text-[11px] font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">{children}</th>;
}

function Td({ children, highlight, className }: { children: React.ReactNode; highlight?: boolean; className?: string }) {
  return <td className={`px-3 py-2.5 border-b border-slate-100 ${highlight ? 'bg-amber-50' : ''} ${className ?? ''}`}>{children}</td>;
}

function Badge({ type, children }: { type: 'gold' | 'silver' | 'blue' | 'gray'; children: React.ReactNode }) {
  const cls = {
    gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    silver: 'bg-slate-100 text-slate-700 border-slate-300',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-slate-50 text-slate-500 border-slate-200',
  }[type];
  return <span className={`inline-block border rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>;
}

function Year({ y }: { y: string }) {
  return <span className="font-bold text-slate-700">{y}年度</span>;
}

function Unknown() {
  return <span className="text-slate-400 text-[11px]">未確認</span>;
}

function Src({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-[#003087] underline underline-offset-2 text-[10px] hover:text-blue-700">
      {label}
    </a>
  );
}
```

### ヒーローセクション（ページ冒頭）

- 背景: `bg-[#003087]`（ロイヤルブルー）
- SCHロゴ: `<Image src="/sch-logo.png" width={175} height={215} className="object-contain h-20 w-auto" />`
- 特筆実績バッジ: 優勝・全国出場のみ掲載
- 戻るリンク: `← SCHチームページに戻る` → `/sch`

### セクション構成

| セクション | 内容 |
|---|---|
| 01 | U-12（全日本・日産カップ・TOPリーグ・その他） |
| 02 | U-11（プレミアリーグ・SCH SUPER LEAGUE） |
| 03 | U-10（日産カップ・チャンピオンシップ・横浜前期リーグ） |
| 04 | U-8（横浜国際チビッ子・横浜市春季） |
| 05 | 情報出典 URL一覧 |

---

## 注意事項

- 出典URLは実際にWebFetchで確認したもののみ掲載すること
- 確認できない年度は `<Unknown />` を使い、でたらめな成績を書かない
- `github` リモートへの push を忘れずに（`origin` だけでは本番に反映されない）
- SCH関連UIには必ず `public/sch-logo.png` を使うこと

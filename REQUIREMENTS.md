# 拓渡のサッカー記録 — 要件定義書

## プロジェクト概要

拓渡くんのサッカー練習を記録・可視化するスマートフォン向けWebアプリ。
リフティング回数の成長グラフ、マイルストーン達成演出、練習ノートの管理、身長・体重の成長グラフを提供する。

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 16 (App Router, Turbopack) |
| スタイリング | Tailwind CSS v4 (`@import "tailwindcss"`) |
| グラフ | Chart.js + react-chartjs-2 + chartjs-plugin-datalabels |
| アニメーション | canvas-confetti（マイルストーン達成時） |
| 状態管理 | React Context (useContext / useState) |
| データ永続化 | Upstash Redis（`/api/data` APIルート経由） |
| フォント | M PLUS Rounded 1c（Google Fonts、layout.tsxのlinkタグで読み込み） |
| 言語 | TypeScript |
| バージョン情報 | ビルド時に東京時刻（JST）を `NEXT_PUBLIC_BUILD_TIME` として注入 |

---

## 画面構成

| 画面 | パス | 説明 |
|------|------|------|
| ホーム | `/` | サマリーカード、成長グラフ(インステップ左足)、最新ノート2件、身長体重グラフ、データ管理 |
| リフティング | `/lifting` | 部位別まとめ、フィルター、成長グラフ、記録一覧、マイルストーン |
| 練習ノート | `/notes` | 練習参加まとめ、月別棒グラフ、検索・絞り込み、ノート一覧 |

底部固定ナビ（BottomNav）でホーム/リフティング/練習ノートを切り替え。
ホームのサマリーカードタップで各セクションへスムーズスクロール。

---

## 機能一覧

### リフティング記録

- **追加**: ホームの「今日の記録を追加」ボタン、またはリフティングページのFAB（＋）
- **編集**: 記録一覧の ✏️ ボタンで既存データを編集フォームで開き更新
- **削除**: 記録一覧の 🗑️ ボタン（確認ダイアログ付き）
- **フィルター**: 部位（全部位/インステップ/インサイド/アウトサイド/もも/頭/胸→足）× 左右（全部/左足/右足/両足）
- **グラフ**: 日付×回数の折れ線グラフ（各点に回数ラベル表示）
- **部位別まとめ**: 各部位の最高回数・記録件数・左右内訳をカード表示

### 練習ノート

- **追加**: ホームの「今日の記録を追加」ボタン、またはノートページのFAB（＋）
- **編集**: 各ノートカードの ✏️ ボタンで既存データを編集フォームで開き更新
- **削除**: 各ノートカードの 🗑️ ボタン（確認ダイアログ付き）
- **内容**: 日付、場所、練習区分、良かったところ（⭐）、改善したいところ（💪）
  - 場所のみ必須入力。良かったところ・改善点は任意
  - 改善点は1行1項目として登録。チェックボックスで完了管理
- **練習区分**: チーム練習/スクール/自主練/試合/セレクション/その他（カスタム自由入力も可）
- **練習参加まとめ**: 区分×場所の回数集計カード、最終訪問日表示。タップで一覧絞り込み
- **月別棒グラフ**: 区分ごとに色分けした積み上げ棒グラフ
- **検索**: 場所・区分・日付・内容でテキスト検索
- **場所別グループ**: トグルで場所ごとにまとめて表示
- **未改善フィルター**: 未完了の改善項目があるノートのみ表示

### 身長・体重記録

- **追加/削除**: ホームページから操作
- **グラフ**: 月齢×身長、月齢×体重の散布図。現在月齢の縦点線表示
- **誕生日設定**: 設定アイコンから変更可能

### マイルストーン

目標回数: 10, 50, 100, 200, 300, 500, 1000
- ✅ 達成済み / ⏳ 次の目標（チャレンジ中）/ 🔒 未解放
- 新マイルストーン達成時: バナー表示 + 紙吹雪アニメーション

### データ管理

- **エクスポート**: 全データをJSONファイルでダウンロード
- **インポート**: JSONファイルを読み込んでデータを復元

---

## データ構造

```typescript
type LiftingPart = 'インステップ' | 'インサイド' | 'アウトサイド' | 'もも' | '頭' | '胸→足';
type LiftingSide = '左足' | '右足' | '両足';

interface LiftingRecord {
  id: string;
  date: string;       // "YYYY/MM/DD"
  count: number;
  location: string;
  part: LiftingPart;
  side: LiftingSide;
}

interface ImprovementItem {
  text: string;
  done: boolean;
}

interface PracticeNote {
  id: string;
  date: string;       // "YYYY/MM/DD"
  location: string;
  category?: string;
  goodPoints: string;
  improvements: ImprovementItem[];
}

interface BodyRecord {
  id: string;
  date: string;       // "YYYY/MM/DD"
  height?: number;    // cm
  weight?: number;    // kg
}
```

---

## 特記事項

### 左右のない部位
「頭」「胸→足」は左右の概念がないため:
- 入力フォームでこれらを選択時、左右セレクターを非表示にし `side` を `'両足'` に自動セット
- 記録一覧の左右欄は `'-'` と表示

### スマートフォン対応
- `inputMode="numeric"` で数値入力を最適化
- フォームはボトムシートスタイル（`rounded-t-3xl`）のモーダル
- タップターゲットは `py-3` 以上を確保

### 場所の入力補完
過去に入力した場所を `<datalist>` で候補表示

### ファイル構成

```
soccer-app/
├── app/
│   ├── api/data/route.ts    # Upstash Redis CRUD API
│   ├── globals.css          # @import "tailwindcss" のみ
│   ├── layout.tsx           # AppProvider, BottomNav, Google Fonts (linkタグ)
│   ├── page.tsx             # ホーム画面
│   ├── lifting/page.tsx     # リフティング画面
│   └── notes/page.tsx       # 練習ノート画面
├── components/
│   ├── BodyChart.tsx        # 身長・体重グラフ（現在月齢縦線付き）
│   ├── BottomNav.tsx        # 底部ナビ（ビルド時刻バージョン表示）
│   ├── ConfettiEffect.tsx
│   ├── LiftingChart.tsx
│   ├── LiftingForm.tsx      # 追加・編集フォーム (initialValues prop)
│   ├── LiftingTable.tsx     # 記録一覧 (onEdit prop)
│   ├── MilestoneSection.tsx
│   ├── NoteCard.tsx         # ノートカード (onEdit prop)
│   ├── NoteForm.tsx         # 追加・編集フォーム (initialValues prop)
│   ├── PartSummaryCards.tsx
│   ├── PracticeBarChart.tsx # 月別積み上げ棒グラフ
│   ├── PracticeStats.tsx    # 練習参加まとめ（タップ絞り込み）
│   └── SummaryCards.tsx
└── lib/
    ├── context.tsx           # AppContext (add/update/delete)
    ├── data.ts               # 初期データ・マイルストーン定義
    ├── storage.ts            # Upstash Redis操作
    └── types.ts              # 型定義
```

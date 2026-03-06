# 拓渡のサッカー記録 — 要件定義書

## プロジェクト概要

拓渡くんのサッカー練習を記録・可視化するスマートフォン向けWebアプリ。  
リフティング回数の成長グラフ、マイルストーン達成演出、練習ノートの管理を提供する。

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 16 (App Router, Turbopack) |
| スタイリング | Tailwind CSS v4 (`@import "tailwindcss"`) |
| グラフ | Chart.js + react-chartjs-2 + chartjs-plugin-datalabels |
| アニメーション | canvas-confetti（マイルストーン達成時） |
| 状態管理 | React Context (useContext / useState) |
| データ永続化 | localStorage（バージョンマイグレーション付き） |
| フォント | M PLUS Rounded 1c（Google Fonts、layout.tsxのlinkタグで読み込み） |
| 言語 | TypeScript |

---

## 画面構成

| 画面 | パス | 説明 |
|------|------|------|
| ホーム | `/` | サマリー、成長グラフ(インステップ左足)、最新ノート2件、データ管理 |
| リフティング | `/lifting` | 部位別まとめ、フィルター、成長グラフ、記録一覧、マイルストーン |
| 練習ノート | `/notes` | 練習ノート一覧（日付降順） |

底部固定ナビ（BottomNav）でホーム/リフティング/練習ノートを切り替え。

---

## 機能一覧

### リフティング記録

- **追加**: ホームの「今日の記録を追加」ボタン、またはリフティングページのFAB（＋）
- **編集**: 記録一覧の ✏️ ボタンで既存データを編集フォームで開き更新
- **削除**: 記録一覧の 🗑️ ボタン
- **フィルター**: 部位（全部位/インステップ/インサイド/アウトサイド/もも/頭）× 左右（全部/左足/右足/両足）
- **グラフ**: 日付×回数の折れ線グラフ（各点に回数ラベル表示）
- **部位別まとめ**: 各部位の最高回数・記録件数・左右内訳をカード表示

### 練習ノート

- **追加**: ホームの「今日の記録を追加」ボタン、またはノートページのFAB（＋）
- **編集**: 各ノートカードの ✏️ ボタンで既存データを編集フォームで開き更新
- **削除**: 各ノートカードの 🗑️ ボタン
- **内容**: 日付、場所、良かったところ（⭐）、改善したいところ（💪）

### マイルストーン

目標回数: 10, 50, 100, 200, 300, 500, 1000  
- ✅ 達成済み / ⏳ 次の目標（チャレンジ中）/ 🔒 未解放  
- 新マイルストーン達成時: バナー表示 + 紙吹雪アニメーション

### データ管理

- **エクスポート**: 全データをJSONファイルでダウンロード
- **インポート**: JSONファイルを読み込んでデータを復元（ページリロード）
- **バージョンマイグレーション**: `DATA_VERSION` が変わると初期データへ自動リセット

---

## データ構造

```typescript
type LiftingPart = 'インステップ' | 'インサイド' | 'アウトサイド' | 'もも' | '頭';
type LiftingSide = '左足' | '右足' | '両足';

interface LiftingRecord {
  id: string;
  date: string;       // "YYYY/MM/DD"
  count: number;
  location: string;
  part: LiftingPart;
  side: LiftingSide;
}

interface PracticeNote {
  id: string;
  date: string;       // "YYYY/MM/DD"
  location: string;
  goodPoints: string;
  improvements: string;
}
```

---

## 特記事項

### 頭部位の左右
「頭」は左右の概念がないため:
- 入力フォームで「頭」選択時、左右セレクターを非表示にし `side` を `'両足'` に自動セット
- 記録一覧の左右欄は `'-'` と表示

### スマートフォン対応
- `inputMode="numeric"` で数値入力を最適化
- フォームは `max-h-[92vh] overflow-y-auto` でスクロール可能
- タップターゲットは `py-3` 以上を確保
- ボトムシートスタイル（`rounded-t-3xl`）のモーダル

### 場所の入力補完
過去に入力した場所を `<datalist>` で候補表示

### ファイル構成

```
soccer-app/
├── app/
│   ├── globals.css          # @import "tailwindcss" のみ
│   ├── layout.tsx           # AppProvider, BottomNav, Google Fonts (linkタグ)
│   ├── page.tsx             # ホーム画面
│   ├── lifting/page.tsx     # リフティング画面
│   └── notes/page.tsx       # 練習ノート画面
├── components/
│   ├── BottomNav.tsx
│   ├── ConfettiEffect.tsx
│   ├── LiftingChart.tsx
│   ├── LiftingForm.tsx      # 追加・編集フォーム (initialValues prop)
│   ├── LiftingTable.tsx     # 記録一覧 (onEdit prop)
│   ├── MilestoneSection.tsx
│   ├── NoteCard.tsx         # ノートカード (onEdit prop)
│   ├── NoteForm.tsx         # 追加・編集フォーム (initialValues prop)
│   ├── PartSummaryCards.tsx
│   └── SummaryCards.tsx
└── lib/
    ├── context.tsx           # AppContext (add/update/delete)
    ├── data.ts               # 初期データ・マイルストーン定義
    ├── storage.ts            # localStorage操作・バージョン管理
    └── types.ts              # 型定義
```

# CLAUDE.md

## SCHチーム ロゴ

- ファイル: `public/SCHロゴ.png`（配置済み）
- 内容: SCHFC（エスシーエイチFC）のエンブレム
  - 横浜, SINCE 1986, JAPAN
  - モットー: "CONTINUAR ES PODER"
  - 緑のシールド型、中央にサッカーボール、SCHFCの文字
- **SCH関連のUIには必ずこのロゴを使うこと**
- 使用箇所: `/sch` ページのヘッダー、BottomNavのSCHアイコン等

---

## デプロイ先

- 本番URL: https://soccer-trianing.vercel.app
- SCHチーム親御さん共有URL: https://soccer-trianing.vercel.app/sch

---

## GitHub Push 手順

GitHub に push する際は `github` remote を使う:

```bash
git push github master
```

remote の設定（トークンが必要な場合）:

```bash
git remote set-url github https://reiteru-n:TOKEN@github.com/reiteru-n/soccer-trianing.git
```

- リポジトリ: `reiteru-n/soccer-trianing`
- 使用トークン種別: Classic PAT (`ghp_...`)
- 必要権限: `repo` (full)

# CLAUDE.md — プロジェクト記録

## このプロジェクトについて

拓渡くんのサッカー練習記録アプリ（Next.js 16 / Vercel）。
個人記録ページと、SCHチームの保護者共有ページの2系統がある。

---

## アプリ構成

| パス | 内容 | アクセス |
|------|------|----------|
| `/` | 拓渡のホーム（サマリー・グラフ） | 家族パスワード |
| `/lifting` | リフティング記録 | 家族パスワード |
| `/notes` | 練習ノート | 家族パスワード |
| `/training` | 自主練メニュー | 家族パスワード |
| `/sch` | SCHチーム保護者共有ページ | チームパスワード |
| `/login` | ログイン画面（type=family / type=team） | 誰でも |

---

## デプロイ先

- **本番URL**: https://soccer-trianing.vercel.app
- **SCHチーム親御さん共有URL**: https://soccer-trianing.vercel.app/sch
- Vercel プロジェクト: `reiteru-n/soccer-trianing`
- master ブランチへの push で自動デプロイ

---

## 認証の仕組み

- `proxy.ts`（ルート直下）が Next.js 16 のプロキシ（旧 middleware）
  - **Next.js 16 では `middleware.ts` は非推奨。必ず `proxy.ts` + `export async function proxy()` を使う**
- 環境変数（Vercel に設定が必要）:
  - `FAMILY_PASSWORD` — 拓渡の個人ページ用
  - `TEAM_PASSWORD` — SCHチームページ用
  - `AUTH_SECRET` — HMAC署名シークレット（未設定時は `dev-secret`）
- Cookie: `family_session` / `team_session`（30日有効）

### ⚠️ パスワードの上位互換関係（絶対に忘れない）

```
family_session（家族PW） ⊃ team_session（チームPW）
```

- **家族パスワードはチームパスワードの上位互換**
- `family_session` を持つユーザーは `/sch` も `/api/sch` も全てアクセス可能
- `team_session` のみでは `/sch` 系のみアクセス可能（個人ページ不可）
- `proxy.ts` でチームセッションを要求する箇所は **必ず** 以下の形にすること：

```ts
// NG（家族ユーザーが弾かれる）
if (!(await hasValidCookie(req, 'team_session', 'team'))) { ... }

// OK（上位互換を維持）
const ok = (await hasValidCookie(req, 'team_session', 'team'))
  || (await hasValidCookie(req, 'family_session', 'family'));
if (!ok) { ... }
```

#### ログインAPIも上位互換が必要（落とし穴）

proxy.ts だけ直しても不十分。ログインフローを追うと：

1. `/sch` アクセス → proxy が `/login?type=team` にリダイレクト
2. ログインページが `{ type: 'team', password }` を送信
3. **API が `TEAM_PASSWORD` と照合するため、家族PWを入力しても弾かれる**

`app/api/auth/route.ts` の `type === 'team'` ハンドラでも、
**FAMILY_PASSWORD に一致したら `family_session` を発行する**処理が必須。

---

## SCHチームページ（`/sch`）

- 練習スケジュール・試合結果/予定・お知らせの3タブ
- データは Upstash Redis に `sch:*` キーで保存（拓渡のデータと分離）
- チームメンバー全員が入力可能（同じチームパスワードでログイン）
- ログアウトボタンあり → `/login?type=team` へ遷移

---

## SCHチーム ロゴ

- **使用ファイル**: `public/sch-logo.png`（クロップ済み 175×215px）
- 元ファイル: `public/SCHロゴ.png`（1400×1050、実コンテンツは左上 164×206px のみ）
- 内容: SCHFC エンブレム、横浜、SINCE 1986、JAPAN、"CONTINUAR ES PODER"
- **SCH関連のUIには必ず `sch-logo.png` を使うこと**
- 現在の使用箇所:
  - `/sch` ページヘッダー: `<Image src="/sch-logo.png" width={175} height={215} className="object-contain h-14 w-auto" />`
  - BottomNav SCHリンク: `<Image src="/sch-logo.png" width={175} height={215} className="object-contain h-8 w-auto" />`

---

## BottomNav（`components/BottomNav.tsx`）

5タブ構成:
1. 🏠 ホーム `/`
2. ⚽ リフティング `/lifting`
3. 📝 ノート `/notes`
4. 🏃 自主練メニュー `/training` — ラベルは `\n` で2行（「自主練」9px /「メニュー」text-xs + whitespace-nowrap）
5. SCHロゴ画像 SCHチーム `/sch`

---

## 作業フロー ルール

- **実装完了後は指示を待たずに master へマージ・push まで行うこと**
- claude/* ブランチで開発 → 完成したら master にマージ → `git push github master` でデプロイ

### ⚠️ デプロイのための必須手順（毎回忘れずに）

`claude/*` ブランチに push するだけでは **アプリは更新されない**。
必ず以下の手順まで完走すること：

```bash
# 1. master にマージ（コンフリクトがあれば解消する）
git checkout master
git merge claude/<branch-name>

# 2. GitHub の master に push → Vercel が自動デプロイ
git push github master
```

- **`origin` への push だけでは本番に反映されない**（origin はローカルプロキシ）
- **`github` remote への push が必須**

---

## GitHub Push 手順

```bash
# github remote にトークンをセット（セッション毎に必要）
git remote set-url github https://reiteru-n:TOKEN@github.com/reiteru-n/soccer-trianing.git

# master に push → Vercel 自動デプロイ
git push github master
```

- トークン種別: Classic PAT (`ghp_...`)、`repo` 権限必要
- Fine-grained PAT は Contents:write がないと push 失敗するので使わない

---

## SCH お知らせの直接投稿手順

### 背景
このサンドボックス環境からは外部ネットワーク（Vercel / Upstash）に直接アクセスできない。
**GitHub Actions から Upstash REST API を直接叩く**方式で投稿する。
（Vercelのシードエンドポイントは不要・ローカルサーバー経由も不可）

### 永続ワークフロー（既に設置済み）
`.github/workflows/post-sch-announcement.yml` — 毎回使い回す

このワークフローは `.github/announcements/*.json` を読んで Upstash に書き込む。
**JSONファイルを追加して push するだけで投稿完了。**

### 手順（毎回の流れ）

**① `.github/announcements/<日付-タイトル>.json` を作成**

```json
{
  "id": "ユニークなID（例: 2026-04-01-hanami）",
  "date": "2026/04/01",
  "title": "タイトル",
  "important": true,
  "content": "本文（\\nで改行）",
  "checkItems": [
    { "text": "持ち物名", "note": "備考（省略可）" }
  ]
}
```

**② push → Actions が自動実行（約10秒で完了）**

```bash
git add .github/announcements/
git commit -m "お知らせ: ..."
git push github master
```

### ポイント
- `id` は毎回ユニークにする（同じIDは2回目がスキップされる）
- `checkItems` は持ち物リスト用。不要なら省略可
- Actions の完了確認: https://github.com/reiteru-n/soccer-trianing/actions
- GitHub Secrets に `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` 設定済み

---

## Redis バックアップ（自動）

### 設定済み内容
- **ワークフロー**: `.github/workflows/backup-redis.yml`
- **スケジュール**: 毎日 0:00 JST に自動実行
- **保存先**: `.github/backups/YYYY-MM-DD.json`（日付別） + `latest.json`（常に最新）
- **対象**: `takuto:*` と `sch:*` をパターンスキャンで全取得 → 新キー追加時も自動対応

### 手動で今すぐバックアップを取る手順

1. ブラウザで https://github.com/reiteru-n/soccer-trianing/actions を開く
2. 左のリスト → **「Backup Redis to GitHub」** をクリック
3. 右側の **「Run workflow」** ボタン → **「Run workflow」** を押す
4. 約10〜20秒で完了し、`.github/backups/` にファイルが追加される

### バックアップの確認
- https://github.com/reiteru-n/soccer-trianing/tree/master/.github/backups

### バックアップからリストアする場合
`.github/backups/latest.json` を参照し、各キーの値を Upstash REST API で書き戻す。
（例: `curl -X POST "$URL/set/takuto:lifting" -H "Authorization: Bearer $TOKEN" -d '["SET","takuto:lifting","<JSON文字列>"]'`）

---

## 技術スタック

- Next.js 16.1.6 (App Router, Turbopack)
- Tailwind CSS v4
- Upstash Redis（データ永続化）
- TypeScript
- デプロイ: Vercel（master ブランチ連動）

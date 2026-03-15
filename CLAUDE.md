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

## 技術スタック

- Next.js 16.1.6 (App Router, Turbopack)
- Tailwind CSS v4
- Upstash Redis（データ永続化）
- TypeScript
- デプロイ: Vercel（master ブランチ連動）

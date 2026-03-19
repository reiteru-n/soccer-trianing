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
そのため「シードAPIエンドポイント + GitHub Actions」の2段構えで投稿する。

### 手順（毎回この流れ）

**① シードAPI を作成**

`app/api/sch/seed-<名前>/route.ts` を新規作成:

```ts
import { NextResponse } from 'next/server';
import type { SchAnnouncement } from '@/lib/types';

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

const ANNOUNCEMENT: SchAnnouncement = {
  id: 'seed-<ユニークID>',  // 重複防止のため毎回変える
  date: '2026/xx/xx',
  title: '...',
  important: true,
  content: `...`,
  checkItems: [
    { text: '...', note: '...' },
  ],
};

export async function GET() {
  const redis = await getRedis();
  const existing = await redis.get<SchAnnouncement[]>('sch:announcements') ?? [];
  if (existing.some(a => a.id === ANNOUNCEMENT.id)) {
    return NextResponse.json({ ok: true, message: '既に投稿済み', skipped: true });
  }
  const updated = [ANNOUNCEMENT, ...existing].sort((a, b) => b.date.localeCompare(a.date));
  await redis.set('sch:announcements', updated);
  return NextResponse.json({ ok: true, message: '投稿しました', total: updated.length });
}
```

**② GitHub Actions ワークフローを作成**

`.github/workflows/seed-<名前>.yml`:

```yaml
name: seed-<名前>
on:
  push:
    paths:
      - '.github/workflows/seed-<名前>.yml'
jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - name: Wait for Vercel deploy
        run: sleep 90
      - name: Post announcement
        run: |
          for i in 1 2 3 4 5; do
            echo "Attempt $i..."
            curl -sf https://soccer-trianing.vercel.app/api/sch/seed-<名前> && break
            echo "Retrying in 20s..."
            sleep 20
          done
```

**③ push → Actions が自動実行**

```bash
git add . && git commit -m "[一時] ..." && git push github master
```

**④ 完了後に一時ファイルを削除**

```bash
rm app/api/sch/seed-<名前>/route.ts
rmdir app/api/sch/seed-<名前>
rm .github/workflows/seed-<名前>.yml
git add -A && git commit -m "[削除] 一時シードファイル" && git push github master
```

### ポイント
- `id` は毎回ユニークにする（重複スキップ機能があるので同じIDは2回目が無視される）
- Actions の完了は https://github.com/reiteru-n/soccer-trianing/actions で確認
- 持ち物リストは `checkItems` 配列で渡す（`text` 必須、`note` 任意）

---

## 技術スタック

- Next.js 16.1.6 (App Router, Turbopack)
- Tailwind CSS v4
- Upstash Redis（データ永続化）
- TypeScript
- デプロイ: Vercel（master ブランチ連動）

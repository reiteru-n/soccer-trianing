# CLAUDE.md

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

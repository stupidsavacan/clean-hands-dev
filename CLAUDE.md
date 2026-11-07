# CLEAN HANDS — 作業の前に読む

- 手順と仕様の正本の一覧：[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- 実装の状態：[ROADMAP.md](ROADMAP.md)（I / P / A / D）
- 操作の一覧：[docs/controls.md](docs/controls.md)（正本は `app/src/controls.ts`）
- 持ち物の一覧：[docs/items.md](docs/items.md)（正本はモデル・持ち方・武器・各地図の表。`app/scripts/spec-items.ts` がまとめる）

## 決まり

- 返事は日本語で、短く分かりやすく書く。
- 頼まれた所だけを変える。
- HITMAN に合わせるのは、仕組み・配置・情報の見せ方だけ。色・文字・名前・モデルは CLEAN HANDS のもの。
- 画面（UI）は UI ラボで仕上げてからゲームに入れる。ゲームの画面は、利用者がよいと言うまで変えない。
- モバイルは iPad 第9世代の横持ち（1080×810）が対象。
- 確認用のサーバー（8796 / 8797 / 8798）は止めない。
- コミットしない（git の管理外）。大きく変える前は `backup-before-…/` に控えを取る。
- 歩くゴーストの長い試験は最小限にする（`npm run test:fast` はそれを除く）。

## 仕上げの確かめ

1. `npm run spec`（仕様のページ・型・試験）
2. `npm run build:all`
3. 変えた画面をブラウザで確かめる

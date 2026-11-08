# CLEAN HANDS 開発の手引き

2026-11-07 作成。ここに書いた手順で作業すると、仕様の書き漏れは試験で見つかります。

## まず使うコマンド

`app/` で実行します。

| すること | コマンド |
|---|---|
| 型の確かめ | `npm run check` |
| 試験（歩くゴーストの長い試験を除く） | `npm run test:fast` |
| 試験（すべて） | `npm test` |
| 仕様のページを作り直す | `npm run docs` |
| 仕様・型・試験をまとめて | `npm run spec` |
| 全ページを作り直す | `npm run build:all` |
| 一部だけ作り直す | `npm run build:all -- club ui-lab` |

`build:all` の対象は `hotel`、`party`、`club`、`mobile`、`ai-lab`、`animation-lab`、`item-lab`、`ui-lab` です（`scripts/build-all.mjs`）。

## 仕様の正本（どこに書いてあるか）

| 何の仕様 | 正本 | 人が読むページ | 抜けを見つける試験 |
|---|---|---|---|
| キーとタッチのボタン | `app/src/controls.ts` | [controls.md](controls.md) | `tests/controls.test.ts` |
| 持ち物（モデル・持ち方・武器・合法かどうか・置き場所） | 下の「持ち物を足す」の各表 | [items.md](items.md) | `tests/items.test.ts` |
| 持ち込みの装備（銃は1丁まで） | `app/src/loadout.ts` | — | `tests/loadout.test.ts` |
| HITMAN との食い違いと、その決め | `app/src/data/hitman-decisions.json` | [hitman-decisions.md](hitman-decisions.md)（決め方は [HITMAN-ALIGNMENT.md](HITMAN-ALIGNMENT.md)） | `tests/hitman-decisions.test.ts` |
| HITMAN 資料の決まり（194項目の表） | `investigation/material-audit-20261106/sources/08-weapon-models-194.csv` | — | `tests/item-spec.test.ts` |
| 実装の状態（I / P / A / D） | [ROADMAP.md](../ROADMAP.md) | 同じ | `tests/project.test.ts`（書いてあるファイルがあるか） |
| ページと作り方 | `app/*.html`、`app/vite.*.config.ts`、`scripts/build-all.mjs` | — | `tests/project.test.ts` |

`docs/controls.md` と `docs/items.md` はコードから作っています。手で書き換えると試験が失敗します。

## 操作（キー・ボタン）を足す

1. `app/src/controls.ts` に1行足します。E と移動キー以外は、ほかの操作と同じキーにしません。
2. その行の `owner` のファイルでキーを読みます。
3. iPad でも使うなら `touch` を書きます。iPad のボタンはこの表から作られます（`app/src/touch.ts`）。
4. `npm run docs`、`npm run test:fast` の順に実行します。

## 持ち物を足す

1. モデル：`assets/items/source/build_items.py` に足し、`node scripts/embed-items.mjs` を実行します（`app/src/item-data.ts` ができます）。
2. 持ち方：`app/src/hold-pose.ts` の `HOLD_KIND`（small / long / hang）。棒のように持つ物は `GRIP` に `along` と書きます。
3. 武器にするなら `app/src/melee.ts` の `MELEE` に書きます。ポケットに入らない大きい物は `LARGE_ITEMS`、背中に背負う物は `BACK_ITEMS` です。
4. 地図ごとの決まり（合法・違法・隠せるか）を書きます。
   - クラブ：`investigation/build-club-source.py` の items。`python investigation/build-club-source.py` のあと `node --experimental-strip-types --no-warnings app/scripts/build-club.ts` を実行します。
   - ほかの地図：`app/src/data/*detection.json` の items。
5. 置き場所：同じ所の `worldItems`（id・item・x・z・floor）。
6. `npm run docs` と `npm run test:fast` を実行します。`tests/items.test.ts` が、足りない所を名前つきで出します。手が届かない置き場所も見つけます。
7. 見た目は [持ち物ラボ](../item-lab.html) で、手・床・単体を確かめます。

わざと足りないままにする時は、`app/scripts/spec-items.ts` の `ITEM_EXCEPTIONS` に理由と一緒に書きます。足りた時は、試験が「この行を消す」と言います。

## 持ち物に仕掛けを足す（例：刀を背中に、ケースに銃）

- 持ち物の状態は `app/src/detection.ts`（手・背中・ケース・ポケット）にあります。
- 新しい操作が要るなら、先に「操作を足す」の手順でキーを決めます。
- 画面の案内（「K 刀を背中に背負う」など）は `app/src/engine/game.ts` の prompt にあります。

## 動き（モーション）を直す

- ほかの AI に頼む時は [MOTION-REQUEST.md](MOTION-REQUEST.md) のひな形を埋めて渡します。

- 確かめる場所は [アニメーションラボ](../animation-lab.html) です。ゲームと同じ姿勢の関数を使っています。
- 07の拳銃は [構えの微調整](../animation-lab.html#pistol-tune) で、銃の位置を固定して肩・肘などを動かせます。「保存してゲームに反映」を押し、同じブラウザ・同じサーバーからゲームを開き直すと調整を試せます。元に戻すには「標準に戻す」を押して保存します。
- 07の拳銃の構えを写真に合わせて作るときは [構えエディタ](../animation-lab.html#pose-edit) を使います。スライダーと銃の矢印で形を作り、写真を重ねて（濃さ・大きさ・位置・左右反転・差を見る・カメラの画角）合わせます。「データをコピー」の JSON を開発側に渡すと、`app/src/combat-motion.ts` の `AGENT_PISTOL_AIM` と `AGENT_PISTOL_HOLD` に入れます。エディタだけではゲームは変わりません。
- 格闘：`app/src/brawl-motion.ts`。刀：`app/src/katana-motion.ts` と `app/src/katana-pose.ts`。持った時の腕：`app/src/hold-pose.ts`。
- 足を地面に置く、手を相手に向ける処理は `app/src/motion-runtime.ts` です。
- 骨の向き：+X がキャラクターの左。腕と脚の x は曲げ（マイナスが前）。y は縦軸まわり（プラスが左向き）。z はひねり。
- アニメーションラボの「肘の自動判定」は、IK前の左右の曲げ角を0〜180°で検査します。07の抜銃ではIK後の右肘・手首の前後関係と握りも確かめます。`npm run test:fast` と `npm run spec` でも同じ判定を実行します。

## 地図を新しく作る

1. 地図のデータを `app/src/data/` に置きます（地図・決まり・作戦・予定・会話など。クラブの `club-*.json` が見本です）。
2. 入口の `app/src/<地図>/main.ts`、ページの `app/<地図>.html`、`app/vite.<地図>.config.ts`、まとめ用の `scripts/standalone-<地図>.mjs` を作ります。
3. `scripts/build-all.mjs` の `TARGETS` に1行足します。
4. `app/scripts/spec-items.ts` の `MAPS` に1行足します。これで、その地図の持ち物と置き場所も試験の対象になります。
5. `npm run spec` を実行します。

## 持ち込み・初期装備を HITMAN に合わせる時

- 決まりは `app/src/loadout.ts` に足します（例：ブリーフケースを持ち込みに置く、開始地点ごとの装備）。今は「銃は1丁まで」「持ち込みは、その1丁を置く場所」です。
- 画面は UI ラボの作戦準備（`app/src/menus.ts`）で作ります。

## UI（画面）を変える時

- ゲームの画面は、仕上がるまで変えません。新しい画面は [UI ラボ](../ui-lab.html) で作ります。
- UI ラボには、作戦準備・一時停止・結果・ゲーム中の HUD（持ち物の列つき）があります。PC（1280×720）と iPad 横（1080×810）の大きさで、自動判定ができます。
- ゲームに入れる条件：ラボの自動判定がすべて通ること。見た目を確かめて、利用者がよいと言うこと。
- 入れる時に使う部品：`app/src/menus.ts`、`app/src/menus.css`、`app/src/hud-hitman.ts`。ポケットは `DetectionSystem.pockets=true` で動きます。HUD に渡す状況（status・health・ghost・inventory）の作り方は `backup-before-ui-revert2-20261107/game.ts` に残っています。
- 仕上げで直すと分かっている所は、UI ラボの「残っている課題」に書いてあります。

## 確かめ方（ブラウザ）

- 遊びながらの記録：`playtest/start.bat`（または `playtest` で `python server.py`）で http://127.0.0.1:8795/ が開きます。F8 でメモ（画面とその時の状態を JSON で `playtest/runs/` に保存）、F9 でデバッグ画面。ホテル・夜会・クラブの今のページで動きます。説明は `playtest/README.md`。

- 確認用のサーバーは止めません（8796：このフォルダ、8797：画像の保存、8798：描画を止めない写し）。
- ブラウザの画面が隠れていると描画が止まります。8798 の写し（`requestAnimationFrame` を時間で回す版）で確かめます。
- 画面の画像は、Chrome のヘッドレスで撮れます（`--headless=new --screenshot=... --window-size=1280,720`）。1回ごとに別の `--user-data-dir` を使います。

## 履歴（git）

- 2026-11-07 から、このフォルダ（`outputs/m5-prototype`）を git で管理しています。送り先は非公開の GitHub [stupidsavacan/clean-hands-dev](https://github.com/stupidsavacan/clean-hands-dev) です。
- `stupidsavacan/clean-hands` は 11/3 に作った配布用（遊べるファイルだけ）です。ここには送りません。
- 区切りのよい所でコミットして送ります。戻したい時は `git log` で場所を探し、`git diff` で何が変わったかを確かめてから戻します。
- 作り直せるページ（`index.html`、`club-prototype.html`、`party-prototype.html`、`clean-hands-mobile.html`、4つのラボ）は入れていません。取り出した後は `app/` で `npm run build:all` を実行します。
- `backup-before-…/` のフォルダは、git を使う前の控えです。新しい控えは作らず、git の履歴を使います。

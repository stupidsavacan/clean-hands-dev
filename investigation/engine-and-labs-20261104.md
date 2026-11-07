# 共通エンジンと2つの実験ステージ

2026-11-04。Claude が作った。

## 1. なぜ変えたか

ホテル・パーティー・クラブの `main.ts` は、どれも同じ中身（約100KB）を写して、別々に直してきたものだった。
そのため、クラブで直したことがホテルには入らない。

今回のマップ（ホテル・パーティー）は、試作としてこのままにする。**これから作るマップは、エンジンを写さずに使う。**

## 2. ファイルの形

| 場所 | 中身 |
|---|---|
| `app/src/engine/game.ts` | **共通エンジン**。ゲームの流れ、プレイヤー操作、カメラ、HUD、AI・変装・戦闘・群衆・監視カメラのつなぎ。`runGame(def)` を呼ぶだけで動く |
| `app/src/engine/types.ts` | エンジンとマップの約束（`GameDef`）。マップが渡すものの一覧 |
| `app/src/engine/crowd.ts` ほか | クラブから移した、どのマップでも使える部品（群衆、群衆の絵、行動記録、銃の拾い方と検問の決まり、予定） |
| `app/src/club/main.ts` | クラブ。データと、クラブだけの部品（ミラーボール、床の光、レーザー、DJのヘッドホン、停電）を渡して `runGame` を呼ぶだけ |
| `app/src/club/chances.ts` | クラブのミッションの台本（投資家、ドロップ、密会、要人警備） |
| `app/src/club/crowd.ts` など | 移した部品への入口だけ（古い import が動くように残した） |
| `app/src/main.ts`、`app/src/party/main.ts` | ホテルとパーティー。**古い写しのまま**。エンジンの変更は届かない |

AI（`ai.ts`）、変装（`m4.ts`）、戦闘（`combat.ts`）などの仕組みは、もともと共有のファイル。エンジンもそこを使う。

### クラブで入れた決まりは、新しいマップにも最初から入る
- 壁越しに物を拾えない。走っても検問を抜けられない（`engine/weapons.ts`）。
- 検問の警備は、コインで持ち場を離れない（同じ）。
- 服の通報は警備だけが聞く（ルールのデータ `compromisedBy:"guards"`。新しいマップは `club-rules.json` を写して始める）。

## 3. 新しいマップの作り方

1. データを作る：`investigation/build-club-source.py` を写して、新しいマップの元データを書く。`scripts/build-club.ts` で JSON にする。形はクラブと同じ（地図、ルール、予定、会話、チャンス、ミッション、戦闘、監視カメラ、群衆、見た目）。
2. 台本を作る：`club/chances.ts` を参考に、そのマップのミッションの台本を書く。`engine/types.ts` の `MissionScript` の形に合わせる（避難や停電などは無くてもよい）。
3. 入口を作る：`src/<マップ名>/main.ts` に、データと台本を渡して `runGame({...})` を呼ぶ。`club/main.ts` がそのまま見本になる。
4. ページを作る：`club.html` と `vite.club.config.ts` と `scripts/standalone-club.mjs` を写して、名前を変える。

**してはいけないこと：`engine/game.ts` を写すこと。** 足りない機能は、エンジンに足すか、`GameDef` に差し込み口を足す。そうすれば、すべてのマップに入る。

## 4. AI 実験ステージ

- 開き方：`http://127.0.0.1:8795/ai-lab`（ファイルは `m5-prototype/ai-lab.html`）
- 40m×30m の試験場。ホール、衝立、職員室、迷路がある。
- 13個のシナリオを、ゲームと同じAI（クラブのルール）で動かし、自動で合否を出す。
  - 視認：正面、背後、壁越し、走る
  - 聴覚：コイン、銃声
  - 無線：届く、届かない
  - 戦闘：銃を見せる
  - 捜索：見失って捜索し、戻る
  - 経路探索：迷路の道、歩いて着く
  - 立入禁止：警告→取り押さえ→確保
- シナリオを押すと3Dで再生する（×1・×2・×4）。「すべて自動判定」で全部を一度に判定する。
- 同じシナリオが試験（`tests/ai-lab.test.ts`）でも動く。AIを変えて壊れたら、試験が落ちる。
- 中身：`app/src/labs/ai-scenarios.ts`（シナリオ）、`app/src/labs/ai-lab.ts`（ページ）。

### 見つかったこと
最初は2件が不合格でした（遠くへの無線が届かない、1発の銃声で警備が動かない）。2026-11-04 のうちに直しました。中身は `ai-report-fixes-20261104.md` にあります。今は20個のシナリオがすべて合格です。

## 5. モーション実験ステージ

- 開き方：`http://127.0.0.1:8795/animation-lab`（ファイルは `m5-prototype/animation-lab.html`）
- モデル：エージェント、NPC 28体、キャラクター全部。チェックで並べる。「NPC全員」で一度に出せる。骨が足りないモデルは下に出る（今は無し）。
- モーション：移動5、予定の仕草18、背後アクション7（する側・される側）、戦闘10（拳銃・長物）。
- 再生、一時停止、1コマ送り・戻し（`,` `.`）、時間のつまみ、速さ（0.1〜2倍）、くり返し。
- 骨格の表示、半透明。
- 並べた全員が同じ時計で動く。「ずらし」で一人ずつ時間をずらせる。
- ゲームと同じ動きの仕組みを使う。ここで直った動きは、すべてのマップに入る。

## 5b. 持ち物ラボ（2026-11-05）

- 開き方：`http://127.0.0.1:8795/item-lab`（ファイルは `m5-prototype/item-lab.html`）
- 道具・近接武器・投げる物のモデルを、手・床・単体で見て、自動で確かめる。中身は `carry-plan-20261105.md` の5章。

## 6. 組み立て方

```
cd app
npx vite build --config vite.club.config.ts && node scripts/standalone-club.mjs
LAB=ai-lab npx vite build --config vite.labs.config.ts && node scripts/standalone-labs.mjs ai-lab
LAB=animation-lab npx vite build --config vite.labs.config.ts && node scripts/standalone-labs.mjs animation-lab
LAB=item-lab npx vite build --config vite.labs.config.ts && node scripts/standalone-labs.mjs item-lab
```

## 7. 確かめたこと

- 型の確認、試験 334件：通過 332、todo 2（上の2件）、失敗 0。
- クラブの歩行確認：すべて通過。
- クラブをブラウザで開いた。準備画面、群衆60人、レーザー、ミラーボール、会話の字幕、時間送りが前と同じに動いた。
- 2つの実験ステージをブラウザで開いた。

変える前の写しは `m5-prototype/backup-before-engine-20261104/` にある。

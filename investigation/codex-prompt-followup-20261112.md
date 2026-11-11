# CLEAN HANDS：11/10〜11/11 の作業の後片付け（Codex への依頼）

2026-11-12 作成。Claude が 11/10〜11/11 の作業を確かめ、7つのコミットに分けて `clean-hands-dev` へ push しました（dc04c34〜3219453）。
spec は 594 合格・失敗0、build:all は11枚すべてでき、服装ラボとクラブもブラウザで確かめました。出来はよいです。残っているのは、次の2つの記録と後片付けだけです。

プロジェクトの場所：`C:\Users\gamit\Documents\Codex\2026-10-26\https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page\outputs\m5-prototype`（以下「ルート」）。今回は main で作業してかまいません。

## 1. HITMAN との食い違いの台帳に、扉とはしごを書く

あなたは「HITMAN の扉と警備・はしごと警備」を調べて、ゲームに入れました（55ffcb0）。この決まりは、台帳にまだ書かれていません。

- 台帳：`app/src/data/hitman-decisions.json`（決め方は `docs/HITMAN-ALIGNMENT.md`）。今の最後は HD16 です。
- 足すもの
  - **HD17**：警備は、通り道の閉まった扉を開けて通り、2秒後、人がいなくなってから閉まる。鍵の扉は `guardAccess` の物だけ開け、通った後はまた鍵がかかる。
  - **HD18**：追いかける警備は歩ける道だけを使い、プレイヤー用のはしごの近道は使わない。
- 書き方は HD15・HD16 と同じです（`hitman`・`ours`・`decision`・`by: "codex"`・`date`・`status`・`reason`・`tests`）。
- `hitman` には、あなたが調べた**出典を名前つきで**書いてください（例：Hitman Wiki「Alert Levels」）。調べた時の記録が手元に無い時は、調べ直してから書きます。出典が見つからない所は「出典なし（推測）」と正直に書きます。
- `tests` に書いた試験ファイルの中に、その id（HD17・HD18）を書きます。HD18 の試験がまだ無ければ、1つ足します。
- 最後に `npm run docs` で `docs/hitman-decisions.md` を作り直します。

## 2. 服装ラボの元データを、リポジトリの中へ

`app/scripts/build-outfit-catalog.py` は、リポジトリの外の `outputs/agent07-jacket/`（`agent07-jacket.blend` と `build_jacket.py`。全部で 1.7 MB）を読んでいます。これでは、git から取り出しただけでは服装ラボの GLB を作り直せません。

- `outputs/agent07-jacket/` の、作り直しに要るファイルを `assets/outfits/agent07-jacket/` に写します。`renders/` など、作り直しに要らない物は写しません。
- `build-outfit-catalog.py` と `build_jacket.py` が、写した先を読むようにします。
- 元の `outputs/agent07-jacket/` は消さずに、そのまま残します。
- `../character-revision/source` を読む所は、今のままでかまいません（ほかのキャラも同じ作りです）。
- 作り直した `app/src/labs/assets/agent07-outfit.glb` が、今の物と同じ見た目になることを確かめます。同じバイト列にならなくてもかまいません。違いが出たら、その理由を書きます。

## 3. 決まり

- 頼まれた所だけを変えます。
- 行末を変えません。コミットの前に `git diff --stat` を見ます。
- `git add` はファイル名を指定します。
- 試験の期待値をゆるめたり消したりしません。
- 長い試験（歩くゴースト）は回さず、`npm run test:fast` を使います。
- **確認用サーバー（8795〜8798）は止めません。** 止まっていたら、セッションと切り離して起動します（`Start-Process python -ArgumentList 'tools/dev-servers.py' -WorkingDirectory <ルート> -WindowStyle Minimized`）。
- 作業ごとに1コミットにします。メッセージは英語で書き、末尾に `(Codex)` を付けます。push はしません（Claude が確かめてから送ります）。

## 4. 報告

短く日本語で、次を書いてください。

- 足した HD17・HD18 と、書いた出典
- 写したファイルの一覧と、GLB を作り直して比べた結果
- `npm run spec` と `npm run build:all` の結果

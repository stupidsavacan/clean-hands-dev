# CLEAN HANDS：服装ラボの作り直しと、全キャラの服の棚卸し（Codex への依頼）

2026-11-12 作成。

## 0. 目的

今の服装ラボは、AGENT 07 の標準体型に、別に作った部品を着せる見本です。棚卸し（`app/src/labs/outfit-inventory.json`）も「白シャツ・スラックス」のような文字の一覧だけです。

これを次の形にします。

- **全キャラの服を、部品の組み合わせ（レシピ）として書き表す。**
- **そのレシピから作った GLB が、今の GLB と同じになる。見た目は1つも変えない。**
- 新しいキャラは、服装ラボで体型と部品を選んでレシピを作れば、同じ作り方で GLB ができる。

いちばん大事な決まりは「**見た目が変わらないこと**」です。下の 3. の「同じかどうかの確かめ方」で、全員が「同じ」になるまでは、ゲームが読む GLB を差し替えません。

プロジェクトの場所：`C:\Users\gamit\Documents\Codex\2026-10-26\https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page\outputs\m5-prototype`（以下「ルート」）。

## 1. 今の作り（先に読む）

| 何 | どこ | 誰が作ったか |
|---|---|---|
| NPC の共通の体・頭・既存5体 | `../character-revision/source/build_characters.py` | Astra |
| プール客・体型の違い | `build_pool_characters.py`、`build_body_variants.py`（同じフォルダ） | Astra |
| 制服・標的・増援・DJ など | `build_uniforms.py`（同じフォルダ） | Claude が書き、Astra が直した |
| 主人公の服 | `../player-wardrobe/source/build_player_wardrobe.py` | — |
| 主人公の別キャラ（architect・operative・veteran・agent47） | `app/src/character-data.ts`（作り方は調べる） | — |
| `guest_male` | 棚卸しにはあるが、作り方は調べる | — |
| ゲームへの埋め込み | `app/scripts/embed-npcs.mjs` → `app/src/npc-data.ts`、`player-data.ts` | — |
| 今の服装ラボ | `app/src/labs/outfit-lab.ts`、`app/scripts/build-outfit-catalog.py` | Codex |

- `../character-revision` と `../player-wardrobe` は git の外です。**この2つの中は変えません。**今の GLB は「比べる元（正解）」として、そのまま残します。
- 主人公（AGENT 07・47）は特に大事です。少しでも変わったら、そのキャラは差し替えません。

## 2. 進め方（4段階。段階ごとに止まって報告）

各段階の終わりに報告を書き、**次の段階へは進まずに止まってください。** Claude が確かめて、利用者がよいと言ってから次へ進みます。

### 段階1　調べて設計する（コードはまだ変えない）

- 全キャラ（`../character-revision/models/` の全部、主人公の服、`character-data.ts` の4人、`guest_male`）について、次を表にします。
  - どのスクリプトの、どの関数で作られているか
  - どの部品でできているか（体・頭・顔・髪・トップス・パンツ・上着・靴・小物・模様など）
  - 色は、パレットのどの番号を使っているか
  - キャラだけの特別な処理（`if id=='photographer'` のような分岐）
- その表から、**部品の一覧（部品庫）**と、**レシピの形（JSON）**を提案します。
  - レシピは、少なくとも「体型」「頭・顔・髪」「部品と色の並び」「特別な処理の名前」を持ちます。
  - 特別な処理を無理に部品に分けると、形が変わることがあります。分けられない物は「そのキャラだけの部品」として残してかまいません。**見た目が変わらないことが、分け方のきれいさより優先です。**
- 新しい作業場所の案を書きます。案：作り方のソースはリポジトリの中の `assets/characters/source/`、作った GLB は `assets/characters/models/` に置く。
- 報告：`investigation/outfit-overhaul/stage1-design.md`

### 段階2　3人で試す

- 違う種類の3人で、レシピ → GLB を作れるようにします。例：`waiter`（共通の制服）、`photographer`（特別な処理あり）、`pool_guest_resort`（体型の違い）。
- 3人とも、3. の確かめで「同じ」になること。
- 報告：`investigation/outfit-overhaul/stage2-pilot.md`

### 段階3　全員

- 全キャラをレシピにし、全員が「同じ」になるまで直します。
- 「同じ」にできないキャラは、無理にそろえず、どこがどう違うかを画像つきで報告します（差し替えない）。
- 棚卸し（`outfit-inventory.json`）は、文字の一覧ではなく、各キャラのレシピを指すようにします。
- 報告：`investigation/outfit-overhaul/stage3-all.md`

### 段階4　服装ラボを作り直す

- 体型（標準の男性・女性・プール客の体型など）を選び、部品庫から部品を順に選び、色を決めて、レシピを作れるようにします。
- 「既存キャラを開く」で、どのキャラのレシピも読み込めて、その部品から組んだ姿が見えること。
- 今あるマーク（文字・PNG を服の表面に置く）と、`window.__outfitLab`（Codex などから使う操作）は残します。
- 最終の GLB は、ラボの画面の中ではなく、Blender でレシピから作ります（見た目を確実に同じにするため）。マップ編集ラボの「保存してゲームに反映」と同じ考え方で、8795 のサーバーにレシピを送ると Blender で作り、できた GLB をラボで見られる、という形を提案します。
- 報告：`investigation/outfit-overhaul/stage4-lab.md`

**ゲームが読む GLB の差し替え**（`embed-npcs.mjs` の読み先を変えること）は、どの段階でもしません。段階3が全員「同じ」になった後、Claude が確かめてから行います。

## 3. 同じかどうかの確かめ方（いちばん大事）

比べる道具を、段階2の最初に作ります（例：`assets/characters/source/compare_glb.mjs`）。今の GLB と、レシピから作った GLB を比べて、次を全部満たした時だけ「同じ」とします。

1. 骨：22本の名前・親子・inverse bind が一致する（差 1e-6 以下）。
2. メッシュ：メッシュの名前と数が一致する。メッシュごとに、三角形の集まりが一致する。三角形の並び順は違ってよいが、各三角形の頂点の位置・法線・UV（色）・骨の番号と重みが、1e-5 以下の差で一致する。
3. 表情（calm・curious・alert）と `walk1` が一致する（値の差 1e-5 以下）。
4. 材質（パレットの画像、roughness など）が一致する。

- 数字で「同じ」にならないキャラは、Blender で前後の画像（正面・35°・横・後ろ。ライトは今までのキャストの画像と同じ）を並べて、違いを報告します。
- 全員分の結果を、1つの表（id・同じ／違う・違う所）にまとめます。
- 段階2の最初に、今の全 GLB の SHA-256 を記録してください。最後に、`../character-revision` と `../player-wardrobe` の中が1バイトも変わっていないことを確かめます。

## 4. 決まり

- 報告は日本語で、短く分かりやすく書きます。
- 頼まれた所だけを変えます。ゲームの見た目・動き・画面は変えません。
- 作業は main ではなく、別のフォルダとブランチで行います。
  ```
  cd <ルート>
  git worktree add ../m5-outfit-overhaul -b outfit/overhaul main
  ```
- 段階ごとに1つ以上のコミットにします。メッセージは英語で書き、末尾に `(Codex)` を付けます。**push はしません。**main にもマージしません（Claude が確かめてから入れます）。
- `git add` はファイル名を指定します。行末を変えません。コミットの前に `git diff --stat` を見ます。
- 試験の期待値をゆるめたり消したりしません。長い試験（歩くゴースト）は回さず、`npm run test:fast` を使います。
- **確認用サーバー（8795〜8798）は止めません。** 自分の確認には、自分のポート（8890〜8899）を使います。止まっていたら、セッションと切り離して起動します（`Start-Process python -ArgumentList 'tools/dev-servers.py' -WorkingDirectory <ルート> -WindowStyle Minimized`）。
- Blender は `C:\Program Files\Blender Foundation\Blender 4.2\blender.exe` です。
- 決まっていないことを自分で決める時は、案を書いて報告し、いちばん無難な方で進めます。

## 5. 各段階の報告に書くこと

| 項目 | 書くこと |
|---|---|
| 時刻 | 始めた時刻・終えた時刻 |
| 結果 | できた／一部できた／できなかった |
| 確かめたこと | コマンドと結果（「同じ」の表を含む） |
| 変えたファイル | 一覧 |
| 迷った所・決めた所 | なければ「なし」 |
| うまくいかなかった所 | 試してだめだったことも書く |
| 次の段階で気をつける所 | — |

最後に、`npm run spec` と `npm run build:all` の結果（自分のフォルダで実行）を付けてください。

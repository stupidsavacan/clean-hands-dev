# 服装の作り直し：段階2 3人の試作

## 結果

**できた。waiter・photographer・pool_guest_resortの3人ともPASS。** レシピから別プロセスのBlenderでGLBを生成し、元のGLBと比較した。骨1e-6、その他の数値1e-5の許容差は変更していない。画像全ピクセルと材質設定も一致する。

段階3へは進まず停止する。主人公5実体は今回の承認に従って固定資産とし、前段の再生成をしない。guest_maleはwardrobeのalias、棚卸しへの4 ID追加は段階3へ残した。ゲームへの読み込み先・埋め込み・ラボ・棚卸しは変更していない。

- 作業場所：`outputs/m5-outfit-overhaul`、ブランチ `outfit/overhaul`。前回 `a2c1a9b` の続き。
- 依頼文：元worktree `m5-prototype/investigation/codex-prompt-outfit-overhaul-stage2-20261112.md` と前回の依頼文。
- 開始：保護ファイルmanifestの `createdAt`（下の実測時刻欄）。終了も末尾に記録。

## 同一性の結果

|id|骨22本・親子・rest・inverse bind|メッシュ名/数・三角形/属性|calm/curious/alert・walk1|材質・画像|総合|
|---|---|---|---|---|---|
|waiter|PASS|PASS（5メッシュ、664三角形）|PASS|PASS|**PASS**|
|photographer|PASS|PASS（5メッシュ、790三角形）|PASS|PASS|**PASS**|
|pool_guest_resort|PASS|PASS（7メッシュ、719三角形）|PASS|PASS|**PASS**|

結果の原本は `stage2-compare-<id>.json`。比較器はすべての検査が通った場合だけPASSを返す。上の内訳はその検査結果と生成メッシュ統計から記載した。

|id|元GLBのSHA-256|候補GLBのSHA-256|
|---|---|---|
|waiter|1f2db36492b32997a7dbc1a65ace73dd8f34bef0621ad7f26d8592ee45b33add|238928acc8c4bb221db4bf6dacad201a7ef02198bd06301b718f93f93228e1ba|
|photographer|3760efdd6826254db37c344f59140944f0f2804fac0019de9144acaf49d91b43|3760efdd6826254db37c344f59140944f0f2804fac0019de9144acaf49d91b43|
|pool_guest_resort|cd46e39c8980c21a363659ced272ccbe70f852ab7b6a237b42baa91892a5032c|48c7455dda57124c1c1d541fdcf4f41038f426274ac73cd881e56352ea9dc808|

photographerはバイト列も同一。waiterとresortはBINチャンクがバイト列で同一で、JSONの差は `/images/0/name` の `palette` → `CLEAN_HANDS_Palette_256` のみだった（JSON/BINの直接比較で確認）。外部ファイルへpalette.pngを保存する副作用を取り除いたため、画像の識別名が変わった。画像の内容・使用UV・材質・形状・動きの差はない。画像名を合わせるための追加処理は入れなかった。

数値FAILの人物はいないため、指定のFAIL用4方向比較画像は今回作成していない。画面・ゲーム側の見た目検証や全員の比較を済ませたという意味ではない。

## 作ったもの

### 保護と比較の正解

作業の最初に `../character-revision` 743ファイル、`../player-wardrobe` 24ファイルの相対パス・長さ・SHA-256を `stage2-protected-files.json` に保存した。履歴・画像・blend・pycacheを含む全ファイルが対象。

`stage2-baseline-models.json` にはNPC32体、wardrobe、埋め込みを復号した固定主人公4人の計37実体と、guest_maleのaliasを記録した。外部のPythonをimport/実行せず、通常のファイル読み取りとJSON/BINの解析だけを行った。

終了前の `verify_pilot.py` で全ファイルの追加/削除/長さ/内容を確認し、**767ファイルの差分0、元の37実体のSHAもすべて一致**。`stage2-verification.json` に結果がある。

### コピーした生成ソースと部品庫

`assets/characters/source/` に共通キャスト・プール客・制服の必要なヘルパーとskinルート正規化をコピーした。元のbuild/render/main処理、import時の出力フォルダ作成、palette.png保存を取り除いた。関数定義をASTで比較し、palette以外のコピー済み定義が元と一致することを確認した（`stage2-source-check.json`）。paletteの変更は画像のファイル保存をやめてメモリ上にpackする部分だけ。

`build_recipe.py:PARTS` が版付きの登録関数。レシピは `body`・`identity`・`palette`・順序付き `parts`・`specialOperations`・出力メッシュ順・元のSHAを持つ。実際の生成はpartsだけを実行する。

- waiter：共通の頭/顔/胴/脚/手/髪、給仕の襟と蝶タイ。
- photographer：肩を修復したuniform_torso → ベストのinlay → 脚 → 手 → 髪 → 襟 → カメラ。元の順序・座標・色・ウェイトを保持。
- pool_guest_resort：専用pool_head/face/hair/torso/legs/hands/details。胴体型・ドレス裾・帯・飾りを専用の組として保持。

1レシピ1Blenderプロセスで作り、出力先は `assets/characters/models/<id>/` に限定した。全メッシュ生成後にFaceのモーフを作り、NLA walk1を同じ設定で出力してからskinルートを正規化する。呼び出したbc/bp/buがコピー側のモジュールであることも実行時に検証する。

レシピが受け付ける部品・体型・色番号・文字列パラメーター・特別処理は固定の登録表で検証する。JSON内の式や任意Pythonを実行する経路はない。今回の3 ID以外への書き込みは拒否する。

### 比較器

`source/compare_glb.py` はBlenderを起動せずに比較する。Python 3と既存Pillowを使用し、新しいnpm依存は追加していない。

- node名/階層/変換/シーンルート、メッシュ名/数/割り当て、skinと22骨の名前/番号順/親/rest/inverse bindを検査。
- 全頂点の位置・法線・全UV・JOINTS/WEIGHTS等の属性を、三角形の多重集合として比較。面の格納順と頂点番号は許すが、向き・重複数は保持する。
- 位置の空間セルは候補を絞るためだけに使う。隣接セルも探し、最後は許容差内の一対一対応で判定する。境界付近の丸めや貪欲対応で誤判定しない。
- Faceのtarget名/既定値/三角形ごとの全モーフ差分（POSITION/NORMAL）と、walk1の全channel/interpolation/時刻/値を比較する。
- 材質はglTF既定値を補い、係数・texture/sampler・alpha/doubleSided等と、画像をRGBAへデコードした全ピクセルを照合する。材質の数値・画像は完全一致を要求する。
- accessorのoffset/stride/normalized/sparseに対応。今回のGLBに必要な型に対応し、外部buffer/画像や未対応形式はFAILで止める。

### 比較器を先に試した結果

候補GLB生成前に比較器の自己検査を実行して成功させた。最終版でも15テスト（複数の変更種別はsubtest）すべて成功。詳細は `stage2-comparator-tests.log`。

|検査|期待と結果|
|---|---|
|3人それぞれ自分自身との比較|すべてPASS|
|頂点位置・法線・UV・重み・骨番号の変更|すべてFAIL|
|骨名・親・rest・inverse bindの変更|すべてFAIL|
|表情のPOSITION/NORMAL変更|FAIL|
|walk1の値/時刻の変更|FAIL|
|roughness・画像ピクセルの変更|FAIL|
|三角形の並び順だけを変更|PASS|
|向きの反転・別の面による重複の追加|FAIL|
|許容差内/外、NaN、mesh名変更、walk1欠落|期待どおりPASS/FAIL。NaNは例外で拒否しCLIはFAIL|
|normalized+sparse+stride読取、境界付近の曖昧な一対一対応|成功|

Blender側のレシピ検査も3件成功（`stage2-recipe-tests.log`）。3レシピの受理、外部ソース非import、不正ID/関数/色/式/体型組み合わせ/処理順の拒否を確認した。

## 再実行するコマンドと結果

リポジトリのルートで実行。手順の全コマンドは `assets/characters/README.md` に記載。

|コマンド|結果|
|---|---|
|`python assets/characters/source/test_compare_glb.py`|終了0、15件成功|
|`blender.exe -b --python-exit-code 1 -P assets/characters/source/test_build_recipe.py`|終了0、3件成功|
|`blender.exe -b --python-exit-code 1 -P assets/characters/source/build_recipe.py -- assets/characters/recipes/<id>.json`|3人とも終了0。Blender 4.2.16 LTS、指定パスの実行ファイルを使用|
|`python assets/characters/source/verify_pilot.py`|終了0。保護767ファイル・元37モデル・候補3人すべてPASS|
|`npm --prefix app run spec`|終了0。docs/型チェック成功、596件中pass594/fail0/todo2。test:fastを使用|
|`npm --prefix app run build:all`|終了0。hotel/party/club/mobile/ai-lab/animation-lab/item-lab/outfit-lab/ui-lab/map-lab/test-stageの全11対象が成功|
|`git diff --check` / `git diff --cached --check`|コミット前に実行。新規記録はLF、既存ファイルの行末は変更しない|
|8795〜8798のListen確認|全4ポートがPID16224で稼働。停止・再起動せず、自分用サーバーも不要だった|

全体ビルドで生成されたこのworktreeの `build-info.json` はHEADの内容へ戻した。main側の未コミット変更には触れていない。

## 迷った所・決めた所・うまくいかなかった所

- 比較器は提案例のmjsではなくPythonにした。既存Pillowで画像全ピクセルを検証でき、Blenderを使わず実行できるため。許容差や比較条件は同じ。
- 比較器の最初のテストでは、元GLBの疎なモーフaccessorをテストの変更処理が直接扱えず失敗した。テスト側で実データへ展開してから変更するよう修正した。
- 重複面のテストでは、変更前accessorのキャッシュを残してしまいFAILにならなかった。テストの変更後にキャッシュを消し、異なる面を確実に重複させるよう直した。比較条件を緩めていない。
- この修正後、比較器テストを通してから初回生成を実行した。3人の生成は初回から数値PASS。その後、build.jsonのパスを相対表記にした最終版で3人を再生成し、同じ候補SHAになることも確認した。
- 画像名だけの差を消すために元ファイル保存の副作用を復活させることはしなかった。未変更のBINと全データの数値一致を根拠にPASSとした。
- 主人公を再生成するコードやレシピ、alias、棚卸し変更は今回追加せず、承認済みの方針としてREADMEに記録した。段階3の作業範囲を先取りしないため。

## 変更ファイル

追加のみ。既存の追跡ファイルに差分はない。

- `assets/characters/README.md`
- `assets/characters/source/`：コピー4ファイル（build_characters.py、build_pool_characters.py、build_uniforms.py、normalize_skin_roots.py）、source-provenance.json、build_recipe.py、compare_glb.py、verify_pilot.py、test_compare_glb.py、test_build_recipe.py。
- `assets/characters/recipes/`：waiter.json、photographer.json、pool_guest_resort.json。
- `assets/characters/models/`：各idのGLBとbuild.json、計6ファイル。
- `investigation/outfit-overhaul/`：本報告、stage2-protected-files.json、stage2-baseline-models.json、stage2-source-check.json、stage2-verification.json、stage2-compare-<id>.json（3個）。
- 同フォルダのログ：stage2-build-<id>.log（3個）、stage2-comparator-tests.log、stage2-recipe-tests.log、stage2-spec.log、stage2-build-all.log、stage2-verification.log。

## 次の段階で気をつける所

全員への拡張は未実施。女性/体型変形、Face全キーへの変形、DJの置換、responseの専用処理を同じ順序で移す。今回の部品庫は3人向けなので、既存の他キャラへ無条件に使えるとは扱わない。

主人公5実体は `assetMode: "fixed"` と元GLBパス/SHA/説明を持たせ、バイト列一致で判定する。guest_maleはaliasにし、ゲームのLook依存とラボDEFAULT_LOOKの差を保持する。棚卸しへの4 ID追加も段階3で行う。ゲームのGLB読み先は全員PASS後もClaudeの確認なしに変更しない。

開始：2026-11-12 10:16:35 JST（保護manifest採取）。終了：2026-11-12 10:31:11 JST。段階2の報告までで停止。

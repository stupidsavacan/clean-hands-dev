# 服装の作り直し：段階3 全員

## 結果

**できた。全37実体が元GLBとバイト単位で一致。数値一致のみ0、FAIL 0。**

NPC32体をレシピから生成した。主人公5実体は固定の元GLBを参照し、埋め込みを含む元データとのバイト一致を確認した。guest_maleはwardrobeへの別名。棚卸しは全38項目になり、すべて各レシピを指す。

段階4へは進まず停止する。ゲームの読み先・埋め込み・表示・動作は変更していない。push・mainへのマージも行わない。

- 作業場所：`outputs/m5-outfit-overhaul`、ブランチ `outfit/overhaul`、開始コミット `0e2d951`。
- 依頼：元worktree `m5-prototype/investigation/codex-prompt-outfit-overhaul-stage3-20261112.md` と前2段階の決まり。
- 開始：2026-11-12 10:36:37 JST（段階3の保護manifest採取）。終了時刻は末尾。
- 開始前からあった `stage2-verification.json` の確認日時変更は保持し、コミット対象から外した。内容のSHAも段階3の開始/終了で照合した。

## 実装と判断

### 32体を生成レシピへ

`assets/characters/recipes/` にNPC32体の生成レシピを揃えた。部品の生成順序・色・体型・頭顔髪・特別処理・元GLBのSHAを保持する。

- 女性は頭/顔/手の専用生成、服の変形、最後の頭首Z補正の順を保持。
- 体型違いはコピーしたpoolモジュールに元と同じobject/face/hair/morph処理を適用する。FaceはBasisを含む全キーをモーフ生成後に変形する。
- DJ3案はOutfit/Hairの置き換えと小物追加を、元の `dj_customize` / `dj_experiment_customize` / `dj_cast_customize` のままオブジェクト化前に実行する。
- response、各制服の飾り、wine_merchantの体型処理は専用部品/処理を保持。分割のために面やウェイトを変えない。
- 1レシピ1Blenderプロセスで生成。外部2フォルダのPythonはimport/実行せず、コピー側の関数だけを呼ぶ。

制服ソースは作業時点の現行版を再コピーした。元SHAは `e46f749a1515628e2fbeb6ef1110e72977ad4caa2224a9181035eb181128baae`。DJ3案も含めた58関数の定義は元とASTで一致する。体型ソースもコピーし、元SHAと変更内容を `source-provenance.json` に追加した。全コピーの確認は `stage3-source-check.json`。

### 画像名を元へ合わせる

ファイル保存の副作用を戻さず、メモリ上の画像名をレシピの `palette.imageName` に設定した。元の名前が `palette` のキャラはpaletteへ、元から `CLEAN_HANDS_Palette_256` のキャラはその名前を保持する。これでwaiter・resortに加え、bodyguard・driver・underwear3体のメタデータ差も解消した。

### 水着客の生成元と採用GLBの食い違い

初回はpool_guest_swimsuitだけFAILだった。位置/法線/UV/重みを比較して、採用GLBのLegs最上端（高さ.94）だけが保存済みソースと違うことを確認した。

|箇所|保存済みソースからの生成|採用GLB|
|---|---|---|
|左右の脚の上端断面|半幅.072、奥行.083|半幅.082、奥行.100|
|上端の閉じ面|パレット5（水着）|パレット14（肌）|

その実測形状を `pool.swimsuit-hip-fit.v1` としてレシピに追加した。脚の中心±.095を維持し、最上端だけを合わせ、閉じ面の色を肌14にする。他の水着キャラへ適用しない。コピーしたpool_legs自体は変更していない。

断面だけ合わせた途中段階では位置・法線は一致し、残りは閉じ面のUV36頂点分だった（途中のFAIL記録：`stage3-swimsuit-before-cap-fix.json`）。色も合わせた最終生成は元と**全バイト一致**。許容差や比較条件を変えていない。最終FAILがないため、FAIL用の比較画像は作成していない。

### 主人公と別名

wardrobe・architect・operative・veteran・agent47は `assetMode: "fixed"` とし、元GLBパス・SHA・メッシュ/色の説明を保持する。新しい部品庫へ主人公の部品は追加せず、生成処理も呼ばない。固定レシピをbuild_recipeで開く場合も元SHAの照合だけで、候補ファイルを作らない。

guest_maleは `assetMode: "alias", aliasOf: "wardrobe"`。夜会の初期主人公Lookに従う方針と、ラボではDEFAULT_LOOKという方針を残す。

### 棚卸し

`app/src/labs/outfit-inventory.json` の全行に `recipe` を追加し、レシピを生成内容の参照先にした。現行画面で使うtop/jacket等の文章は表示用要約として残す。既存の登場人物・配置の対応は変更していない。

不足していたagent・dj・dj_cast・pool_guest_strongを追加して34→38項目。棚卸し試験では既存の埋め込み/地図配置の検査を残し、全37実体/aliasの網羅と、各レシピの存在・id・版・種類を確認する検査を追加した。

現行ラボをレシピから組み立てる変更は段階4へ残す。現行の元モデル表示は従来の埋め込みを使うため、追加したゲーム未使用4体のプレビューも段階4の範囲。ゲームへの埋め込みを増やして回避していない。

## 検証

|コマンド・検査|結果|
|---|---|
|指定のBlender 4.2で各generatedレシピを別プロセス実行|NPC32体すべて終了0。`stage3-build-<id>.log` と各モデルのbuild.json|
|`python assets/characters/source/verify_all.py`|終了0。元37実体・候補32体・固定5体・alias・棚卸し・保護ファイルすべてPASS|
|`python assets/characters/source/test_compare_glb.py`|終了0、15件成功。比較器の許容差は骨1e-6、他1e-5のまま|
|`blender.exe -b --python-exit-code 1 -P assets/characters/source/test_build_recipe.py`|終了0、5件成功。全38レシピ受理、不正入力拒否、外部ソース非import、固定/aliasが生成ファイルを書かないことを検査|
|`npm --prefix app run spec`|終了0。仕様生成・型成功。597件中pass595/fail0/todo2。test:fastで長い歩くゴースト試験は除外|
|`npm --prefix app run build:all`|終了0。全11対象成功|
|自分用 `http://127.0.0.1:8890/outfit-lab.html` をブラウザで確認|38/38と追加4 IDが一覧に表示。既存の3D編集画面も表示。UI改修はしていない|
|8795〜8798のListen確認|全4ポートがPID16224で継続稼働。停止・再起動なし。自分用8890のみ別途起動|
|`git diff --check` / `git diff --cached --check`|成功。新規コピーの末尾空行警告は除去して再確認|
|全保護ファイルのパス/長さ/SHA照合|character-revision 743、player-wardrobe 24、計767ファイルすべて差分0|
|確認者のstage2-verification.json|開始時のSHAと一致、変更を保持|
|コピー元SHAと関数ASTの照合|全コピー済み形状/モーフ関数一致。例外は既報のpaletteファイル保存削除のみ|

全体ビルドが更新した、このworktreeのbuild-info.jsonはHEADの内容に戻した。main側の未コミット変更は保持している。行末は既存ファイルの形式を維持した。

## 全員の結果

以下は `stage3-verification.json` から記載。分類は「バイト一致」「数値一致（PASS）」「FAIL」の3種類。別名は参照先の結果を表示する。

|id|レシピ|結果|違う所|
|---|---|---|---|
|agent|生成|バイト一致|なし|
|beachbar|生成|バイト一致|なし|
|bodyguard|生成|バイト一致|なし|
|chef|生成|バイト一致|なし|
|cleaner|生成|バイト一致|なし|
|delivery|生成|バイト一致|なし|
|dj|生成|バイト一致|なし|
|dj_cast|生成|バイト一致|なし|
|dj_experiment|生成|バイト一致|なし|
|driver|生成|バイト一致|なし|
|fisher|生成|バイト一致|なし|
|guard|生成|バイト一致|なし|
|guest_dress|生成|バイト一致|なし|
|guest_suit|生成|バイト一致|なし|
|investor|生成|バイト一致|なし|
|lawyer|生成|バイト一致|なし|
|masseuse|生成|バイト一致|なし|
|photographer|生成|バイト一致|なし|
|pilot|生成|バイト一致|なし|
|pool_guest_lean|生成|バイト一致|なし|
|pool_guest_resort|生成|バイト一致|なし|
|pool_guest_slim|生成|バイト一致|なし|
|pool_guest_strong|生成|バイト一致|なし|
|pool_guest_swimshorts|生成|バイト一致|なし|
|pool_guest_swimsuit|生成|バイト一致|なし|
|response|生成|バイト一致|なし|
|sommelier|生成|バイト一致|なし|
|underwear|生成|バイト一致|なし|
|underwear_dark|生成|バイト一致|なし|
|underwear_female|生成|バイト一致|なし|
|waiter|生成|バイト一致|なし|
|wine_merchant|生成|バイト一致|なし|
|wardrobe|固定|バイト一致|なし|
|architect|固定|バイト一致|なし|
|operative|固定|バイト一致|なし|
|veteran|固定|バイト一致|なし|
|agent47|固定|バイト一致|なし|
|guest_male|別名 → wardrobe|参照先バイト一致（PASS）|なし。表示Lookの方針は保持|

## 変更ファイル

- `assets/characters/recipes/`：全38項目（生成32・固定5・別名1）。
- `assets/characters/models/`：NPC32体のGLBとbuild.json。主人公の候補は作っていない。
- `assets/characters/source/`：build_recipe.py、build_uniforms.py、追加のbuild_body_variants.py、source-provenance.json、test_build_recipe.py、追加のverify_all.py。
- `assets/characters/README.md`：全員の再生成/検証手順、固定資産・専用部品の説明。
- `app/src/labs/outfit-inventory.json`、`app/tests/outfit-inventory.test.ts`。
- `investigation/outfit-overhaul/stage3-*`：本報告、保護manifest、全結果、生成結果、コピー元照合、途中の水着客FAIL記録、各生成/試験/仕様/ビルド/検証ログ。

## うまくいかなかった所・次の注意

- 保護manifest作成の最初の試行で相対親パスが不正と判明し、ソース変更前に絶対ルートから767ファイルを取り直した。
- 水着客の断面補正だけでは閉じ面の色が残りFAILだった。元GLBのUVを根拠に色も復元し、バイト一致にした。途中の不一致は上記に記録。
- テストファイルは元が一部CRLFの混在形式だったため、元の各行末を保持したうえで必要な行だけ追加・変更した。
- 部品の自由な組み合わせやラボからのBlender生成は未実装。段階4の実装では、今回固定した生成順・体型互換性・専用処理・パレット上書きの範囲を守る。
- 体型違いのモジュールはコピー側poolへ処理を差し込むため、1レシピ1Blenderプロセスを継続する。
- 主人公は固定資産のまま扱う。全員一致しても、ゲームのGLB読み先はClaudeの確認前に変更しない。

終了：2026-11-12 10:50:26 JST。段階3の報告までで停止。

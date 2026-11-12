# 服装レシピと服装ラボ

ゲームへ未接続の候補です。NPC32体を生成でき、主人公5実体は固定資産、guest_maleはwardrobeの別名として扱います。
`models/` は候補、比較の正解は段階2開始時にSHA-256を固定した外部GLBです。

## 実行

リポジトリのルート（`m5-outfit-overhaul`）で実行します。指定のBlender 4.2とPython 3.11/Pillowを使用しています。Pillowは既存環境のものを使い、npm依存は追加していません。

```powershell
# 比較器の自己検査を先に行う
python assets/characters/source/test_compare_glb.py

# 1レシピごとに別のBlenderプロセスで生成する
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --python-exit-code 1 -P assets/characters/source/build_recipe.py -- assets/characters/recipes/waiter.json
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --python-exit-code 1 -P assets/characters/source/build_recipe.py -- assets/characters/recipes/photographer.json
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --python-exit-code 1 -P assets/characters/source/build_recipe.py -- assets/characters/recipes/pool_guest_resort.json

# 全保護ファイル・全37実体・alias・棚卸しを一括で再確認
python assets/characters/source/verify_all.py

# 1人だけ比較する場合（不一致・未対応入力は終了1）
python assets/characters/source/compare_glb.py ../character-revision/models/waiter/waiter.glb assets/characters/models/waiter/waiter.glb
```

生成先は `models/<id>/<id>.glb` と `build.json`。埋め込みファイルや外部の生成元には書き込みません。コピーしたヘルパーの出典・元SHAと変更内容は `source/source-provenance.json` に記録しています。

## レシピと部品

`recipes/` のJSONは体型・頭顔髪・パレット・順序付き部品と色・特別処理・出力順・正解SHAを持ちます。`source/build_recipe.py:PARTS` が版付き部品庫です。対応体型、許される色番号、文字列パラメーターを宣言し、登録されていない処理・体型・色・組み合わせを拒否します。式やPythonは受け付けません。

生成の実体は `parts` の配列順です。`identity` は選択内容の説明で、二重生成しません。`specialOperations` は必要なオブジェクト化前の専用処理、Faceのモーフ生成、出力後のskinルート正規化を元の順序で実行します。形を維持するため、胴・袖・脚を途中で別オブジェクトにしません。

|レシピ|使う主な部品|体型|
|---|---|---|
|waiter|共通頭/顔/胴/脚/手/七三髪、給仕の白襟と蝶タイ|cast.male.v1|
|photographer|共通頭/顔/脚/手/髪、修復済み胴、ベストinlay、襟、カメラ|cast.male.v1|
|pool_guest_resort|専用の頭/顔/髪/胴/脚/手/飾り|pool.resort.v1|

camera等の人物専用部品の定数色はコピー元どおりです。対応していない体型への服の流用はまだ実装していません。

## 比較の範囲

骨の許容差は1e-6、頂点・法線・UV・重み・モーフ・アニメーションの許容差は1e-5。メッシュ名/数、node階層/変換、22骨/階層/inverse bind、三角形の多重集合、Faceの全targetと既定値、walk1の全channel/時刻/値、割り当て材質とデコードした画像全ピクセルを検証します。三角形の格納順と頂点番号は問いませんが、面の向き・重複数は保持します。境界付近は丸めハッシュで合否を決めず、隣接空間セルから候補を出して許容差内の一対一対応を探します。

対象GLBの自己検査、位置/法線/UV/重み/骨/表情/歩行/材質を意図的に変える陰性検査、面順だけ変える陽性検査があります。NaN等の不正入力は失敗します。外部buffer/外部画像・TRIANGLES以外・未対応のaccessor型は成功扱いにせず明示的に拒否します。今回のGLBに必要なSCALAR/VEC2/3/4/MAT4、stride/offset、normalized、sparseに対応しています。

PNG圧縮方式やGLB内の配置が違うだけなら、バイトSHAが異なっても数値比較はPASSになり得ます。SHAと「バイト一致 / 数値一致 / FAIL」を別途記録します。段階3の最終結果は37実体すべてバイト一致です。

## 全員の生成と固定資産

```powershell
Get-ChildItem assets/characters/recipes/*.json | ForEach-Object {
  $outfitRecipe = Get-Content $_.FullName -Raw | ConvertFrom-Json
  if ($outfitRecipe.assetMode -eq 'generated') {
    & 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --python-exit-code 1 -P assets/characters/source/build_recipe.py -- $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Failed: $($_.Name)" }
  }
}
python assets/characters/source/verify_all.py
```

`assetMode: "fixed"` は元GLBのパス・SHAと部品の説明を保持します。build_recipeで開いてもSHA照合だけを行い、主人公の候補は生成しません。guest_maleはwardrobeへ解決しますが、ゲームのLook依存とラボの標準Lookという表示方針はレシピに残します。

胴・脚・手・髪などの部品は順序付きで構築し、女性の頭首補正とDJの置き換えはbeforeObjectsの登録処理で実行します。体型違いはコピー側のpoolモジュールだけを使い、FaceのBasisと全キーを元と同じ段階で変形します。引き続き1レシピ1Blenderプロセスが必須です。

パレット画像はファイルに保存せず、レシピのimageNameで元の名前を再現します。pool_guest_swimsuitだけは、ソースと採用GLBの差（脚上端の幅/深さ・閉じ面の肌色）を `pool.swimsuit-hip-fit.v1` で保持します。他の水着体型には適用しません。

棚卸しのrecipeが生成の参照先です。従来のtop/jacket等は表示用要約です。服装ラボは38件を開き、段階3のバイト一致結果を表示します。ゲームの読み込み先は変更していません。

## 服装ラボを使う

```powershell
python tools/outfit-preview.py --port 8891
# http://127.0.0.1:8891/outfit-lab
```

体型→頭/顔/髪→服の部品→役割ごとの色/文字/PNGマーク→「保存して作る」で、新しいレシピとGLBを作れます。Blender生成後、アニメーションラボと同じ歩き・しゃがみ・ダンス・仕事を確認できます。文字/PNGは服をクリックして配置でき、GLBにも骨ウェイト付きの面と画像を保存します。

既存38レシピは保護され、新規は `recipes/new/`、生成物は `models/new/<id>/` に別IDで保存します。固定資産とaliasは編集しません。画面での変更は編集中と表示し、Blenderで作成した結果をプレビューします。

`window.__outfitLab` はgetRecipe/setRecipe/setPart/setMark/getInventory/findInventory/listParts/exportGLBを保持し、loadRecipe/setBody/selectPart/saveAndBuild/setMotion/status/readyも提供します。旧version:1のJSONとsetPartの旧部位名・襟/丈も移行できます。

8795用の接続は `tools/dev-servers.py` に追加済みですが、反映には再起動が必要です。既存8795〜8798は停止せず、確認には別ポートを使ってください。詳細・API・画像は `investigation/outfit-overhaul/stage4-lab.md`。既存の全員バイト一致記録はstage3-all.mdです。

部品庫は `source/build_recipe.py:PARTS` から `source/export_catalog.py` でcatalog/catalog.jsonへ出力します。従来の上着の再生成は `assets/outfits/agent07-jacket/README.md`。1レシピ1Blenderプロセスを守ってください。

verify_all.pyは段階4の保護manifestがあればそれを使用します。過去の段階を検査する場合は `--protection-snapshot stage3-protected-files.json --report stage3-recheck.json` のように明示できます。元GLBの比較基準と許容差は共通です。

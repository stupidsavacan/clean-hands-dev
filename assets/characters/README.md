# 服装レシピ：段階2の試作

ゲームへ未接続の候補です。`waiter`・`photographer`・`pool_guest_resort` のみ生成できます。
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

# 全保護ファイル・37実体のハッシュ・3人の数値同一性を一括で再確認
python assets/characters/source/verify_pilot.py

# 1人だけ比較する場合（不一致・未対応入力は終了1）
python assets/characters/source/compare_glb.py ../character-revision/models/waiter/waiter.glb assets/characters/models/waiter/waiter.glb
```

生成先は `models/<id>/<id>.glb` と `build.json`。埋め込みファイルや外部の生成元には書き込みません。コピーしたヘルパーの出典・元SHAと変更内容は `source/source-provenance.json` に記録しています。

## レシピと部品

`recipes/` のJSONは体型・頭顔髪・パレット・順序付き部品と色・特別処理・出力順・正解SHAを持ちます。`source/build_recipe.py:PARTS` が版付き部品庫です。対応体型、許される色番号、文字列パラメーターを宣言し、登録されていない処理・体型・色・組み合わせを拒否します。式やPythonは受け付けません。

生成の実体は `parts` の配列順です。`identity` は選択内容の説明で、二重生成しません。`specialOperations` はFaceのモーフ生成と出力後のskinルート正規化だけを固定順で実行します。形を維持するため、胴・袖・脚を途中で別オブジェクトにしません。

|レシピ|使う主な部品|体型|
|---|---|---|
|waiter|共通頭/顔/胴/脚/手/七三髪、給仕の白襟と蝶タイ|cast.male.v1|
|photographer|共通頭/顔/脚/手/髪、修復済み胴、ベストinlay、襟、カメラ|cast.male.v1|
|pool_guest_resort|専用の頭/顔/髪/胴/脚/手/飾り|pool.resort.v1|

camera等の人物専用部品の定数色はコピー元どおりです。対応していない体型への服の流用はまだ実装していません。

## 比較の範囲

骨の許容差は1e-6、頂点・法線・UV・重み・モーフ・アニメーションの許容差は1e-5。メッシュ名/数、node階層/変換、22骨/階層/inverse bind、三角形の多重集合、Faceの全targetと既定値、walk1の全channel/時刻/値、割り当て材質とデコードした画像全ピクセルを検証します。三角形の格納順と頂点番号は問いませんが、面の向き・重複数は保持します。境界付近は丸めハッシュで合否を決めず、隣接空間セルから候補を出して許容差内の一対一対応を探します。

対象GLBの自己検査、位置/法線/UV/重み/骨/表情/歩行/材質を意図的に変える陰性検査、面順だけ変える陽性検査があります。NaN等の不正入力は失敗します。外部buffer/外部画像・TRIANGLES以外・未対応のaccessor型は成功扱いにせず明示的に拒否します。今回のGLBに必要なSCALAR/VEC2/3/4/MAT4、stride/offset、normalized、sparseに対応しています。

PNG圧縮方式やGLB内の配置が違うだけなら、バイトSHAが異なっても数値比較はPASSになり得ます。SHAは別途記録します。

## 今回の対象外

主人公5実体は承認済みの方針に従い、段階3で `assetMode: "fixed"`（元パス・SHA・説明）にします。前段生成の再現や部品庫への取り込みは行いません。`guest_male` はwardrobeのaliasです。棚卸しの追加・参照変更、服装ラボ、ゲームの読み先変更は段階2では行いません。

調査・実測・既知の制限は `investigation/outfit-overhaul/stage2-pilot.md` を参照してください。

# 服装の作り直し：段階1 調査と設計

## 結果

できた。調査対象は NPC 32体、主人公ワードローブ1個、固定主人公4人、`guest_male` 1項目。コード・GLB・埋め込み先・棚卸しは変更していない。段階2へは進まず、Claude の確認と利用者の承認を待つ。

- 開始：初回操作の時刻は未記録。調査中の最初の時刻実測は2026-11-12 10:03:48 JST。終了は末尾の検証記録に記載。
- 作業場所：`outputs/m5-outfit-overhaul`、ブランチ `outfit/overhaul`、出発点 `8d7bd06`。
- 指示書：`investigation/codex-prompt-outfit-overhaul-20261112.md`。今回の変更は本報告と調査・検証記録だけ。
- 元の main にあった `build-info.json` の未コミット変更は触っていない。

## 調べて分かった重要な違い

1. `character-revision/models/*/*.glb` は32体。現在の棚卸しは34項目で、`agent`・`dj`・`dj_cast`・`pool_guest_strong` が載っていない。ゲーム未使用でも32体すべてを対象にする。
2. `character-data.ts` の4人は、`../protagonist-studies-20261028/models/` の4 GLBとそれぞれバイト単位で一致する。architect・operative・veteran は **archive-v1 のGLBとも一致**。現在の `source/build_studies.py` を使うだけでは3人の採用版を再現できない。
3. Agent 47 の埋め込みは `agent47-occiput-fix/models/q2.glb` と一致する。`build_occiput.py:build('q2') → fix()` が最終処理。Q2の入力は同フォルダ `source-assets/q2.glb` にあり、refinement の入力コピーとも一致する。`source/build_studies.py:build('agent47', variants['Q2'])` は前段の生成候補だが、今回再生成して一致を確認したわけではない。
4. `guest_male.glb` は存在せず、独立した生成関数もない。`investigation/build-party-v2-source.py` が夜会客にこのIDを付け、`app/src/party/main.ts:loadPlayer()` は `models.get(model) ?? g.scene` により `PLAYER_BASE64` の主人公へ到達する。先に `applyLook(g.scene, agentLook)` が呼ばれる。服装ラボの `showReference()` は同じIDを `PLAYER_BASE64 + DEFAULT_LOOK` として表示する。**ゲームの保存済み外見とラボの標準外見は同一とは限らない**。
5. NPC32体は22骨・`walk1`・3表情を持つ。ワードローブと固定主人公4人は22骨だが **アニメーションを含まない**。Faceには3表情に加え `brow_sharp`・`brow_soft` がある。比較時は「元に無いwalk1を追加しない」。これは期待値の緩和でなく、元のアニメーション集合そのものの一致を要求する扱いとする。
6. 材質・パレットは人物ごとに異なる。元GLBのデコード結果を `stage1-observed.json` に記録した。材質には省略されたroughness等もあり、glTFの既定値を含めて比較する必要がある。

## 調査表の読み方

以下の色番号は0始まり。`bc`＝`../character-revision/source/build_characters.py`、`bu`＝同 `build_uniforms.py`、`bp`＝同 `build_pool_characters.py`、`bv`＝同 `build_body_variants.py`、`pw`＝`../player-wardrobe/source/build_player_wardrobe.py`。

共通パレット：

|番号|HEX|番号|HEX|番号|HEX|番号|HEX|
|---:|---|---:|---|---:|---|---:|---|
|0|2b2e35|1|efeadf|2|c22f21|3|f2c14e|
|4|17776c|5|3b5b8a|6|4fb8c9|7|d9b39a|
|8|9b7053|9|503f35|10|8b9c88|11|c8d7cf|
|12|ddd0b8|13|a9bcc9|14|f2d7c4|15|737a82|

個々の**全メッシュ名・三角形数・使用色番号・実画像16色・画像SHA-256・材質・表情名・GLB SHA-256** は `stage1-observed.json` に収録。以下は生成関数から読んだ部品と順序の表であり、再生成の一致を示す表ではない。

### 共通5体

全員 `bc.build(id)`。出力メッシュは `Body / Outfit / Hair / Accessories / Face`。Bodyは頭・首と手、Outfitは胴・袖・脚・靴を同居させている。Faceは `morphs()` で3表情。目白1・瞳0・口9（女性は瞳9）。靴は0。

|id|体・頭・顔・髪|トップス・パンツ・小物と色|特別な処理|
|---|---|---|---|
|agent|head/face、肌7、hands=2、hair(swept,0)|torso=0、legs=0、chest_details(suit)の白1/黒0、glasses=3|赤手袋。ワードローブとは別GLB|
|guard|head/face、肌/手8、hair(short,0)|torso/legs=5、chest_details(guard)=1/3、hat(guard)=5/0/3、通信機0|guard用帽子・マイクを残す|
|waiter|head/face、肌/手7、hair(parted,9)|torso=1、legs=0、chest_details(waiter)=白襟1/蝶タイ0|`bu`ではなく `bc.build('waiter')`|
|guest_suit|head/face、肌/手7、hair(short,0)|torso=4、legs=0、chest_details(guest)=白1/ラペル4|ラペルを黒に置換しない|
|guest_dress|female_head/female_face、肌/手7、hair(bob,0)|torso=1、legs(dress=True)=肌7/裾1/靴0、hat(wide)=0/12/耳飾り1|female_outfit→female_hands、頭・首ウェイトの全対象をZ=-.018してからobject/morphs|

### 制服・標的・DJ等21体

全員 `bu.build(id)`。明記しない場合、頭/顔は `bc.head/face`、手は肌色、髪は `bc.hair`、脚・靴は `bc.legs`（靴0）。Body/Outfit/Hair/Faceを作り、必要ならAccessories。女性は `female_head/face/outfit/hands` と最後の頭首Z=-.018を使う。

`T`は胴、`L`は脚、`S`は肌、`H`は髪。Outfitを作る順序は **胴→inlay→半袖→脚→靴再色付け→big→女性変形→tee**、その後に手・髪・`dress()`、DJ専用置換、Accessoriesのbig、頭首補正。順序を保持する。

|id|体・頭髪/基調色|`dress(id)` の部品・色、専用処理|
|---|---|---|
|chef|uniform_torso、T1/L15/S7/H(short,0)|首布2、ボタン0、apron1、toque1|
|cleaner|uniform_torso、T10/L15/S8/H(parted,9)|collar1、apron1、ポケットpanel11|
|delivery|uniform_torso、T15/L0/S8/H(short,0)|胴にベストinlay3と反射帯11（前後、順序付き）、ball_cap0/0|
|fisher|uniform_torso、T4/L0/S7/H(short,9)|前開きpanel1、胸ポケット0、boots3、beanie2|
|bodyguard|bc.torso、T0/L0/S7/H(short,0)|chest_details(suit)=1/0、tie0、sunglasses0、earpiece15|
|sommelier|uniform_torso、T0/L0/S7/H(parted,9)|chest_details(suit)、bow0、長apron9、試飲杯/紐3|
|photographer|uniform_torso、T13/L12/S8/H(swept,9)|服の面自体にベスト10・ポケット9をinlay→collar13→camera0/15とストラップ0|
|driver|bc.torso、T15/L15/S7/手1/H(short,0)|chest_details(suit)、tie0、peaked_cap(0,0,0,3)|
|beachbar|uniform_torso、T6/L12/S7/H(swept,9)、半袖cut=.474|collar6、apron0、前面の柄dot3/1と背面dot3。柄の座標・半径も部品設定に保持|
|pilot|uniform_torso、T9/L0/S7/H(short,0)|collar12、turtleneck12、ジッパーpanel15、headset0|
|masseuse|uniform_torso、T1/L10/S7/H(parted,9)、半袖|collar10、胸印panel3、towel4（panel+肩のbox）|
|underwear|bc.torso、T1/L7/S7/H(short,0)、cut=.28|shorts13をOutfitへ追加。脚色を肌にして素足部分、靴0は残る|
|underwear_dark|bc.torso、T1/L8/S8/H(short,0)、cut=.28|上と同じshorts13。肌だけ8|
|underwear_female|bc.torso+女性変形、T1/L7/S7/H(bob,0)、cut=.28|shorts13、女性手と頭首補正。スカート化しない|
|wine_merchant|bc.torso+big_build、T11/L0/S7/H(bald,7)|chest_details(suit)、mustache9、チーフ1、Accessoriesもbig。セル7=d99683・11=6b2a2aに上書き|
|lawyer|bc.torso、T11/L11/S14/H(slick,13)|chest_details(suit)、tie15、square_glasses0。セル11=1c2230・13=c9c9c2|
|investor|uniform_torso+女性変形、T4/L12/S14/H(spiky,3)|tee_front1（変形後にinlay）、靴1、sunglasses0、earring3、頭首補正|
|response|response_torso/response_legs、T0/L0/S8/手0/H(short,0)|response_carrier、response_kneepads15、helmet10/0、response_kit（マスク・レンズ・防音具・弾倉・無線・腕章・ホルスター）。専用処理一式を維持|
|dj|専用Outfitをdj_customizeで置換、S7|拡大黒半袖0・脚5・靴1、素肌袖口接続、ball_cap0、胸印6、首掛けヘッドホン0/15、Hairを専用の襟足9に置換|
|dj_experiment|dj_experiment_customizeで置換、S8/H(swept,0)|短丈上着4、インナーinlay0、脚0/靴1、裾襟袖口0、チェーン3、頭のヘッドホン0/4/3、靴線4・袖章3。仕立て後に小物生成|
|dj_cast|dj_cast_customizeで置換、S8/H(swept,0)|元のbc.torso4を無変形、袖口0・脚0/靴1、面追従チェーン3、頭ヘッドホン0/4/3。experimentとは別レシピ|

responseのパレット上書き：0=292e31、6=26343c、9=3c4540、10=505b48、11=b4bda4、12=8a7656、15=353c3d。その他は共通。`REPAIRED_IDS`によりtorsoの関数が変わる点と、`normalize_skin_roots.normalize()` の出力後処理も保存する。

`*_sheet` 7体は `sheet-candidates/models/` に出力する比較用で、今回指定の `models/` 32体には含まれない。モデル数の不足を避けるため出力先で区別する。

### プール客6体

標準3体は `bp.build_pool(id)`。`pool_head/face/hair/torso/legs/details` と共通 `hands` を順に使う。メッシュは `Head / Body / Legs / Hands / Hair / Details / Face`。裸足もLegsに含む（肌色）。

|id|体型・頭顔髪|服・模様・色|専用処理|
|---|---|---|---|
|pool_guest_swimsuit|kind=swimsuit、S14、H9、まとめ髪|水着5、肩紐6、裸足14|女性用pool_head/face、pool_torso/legsの水着区画|
|pool_guest_resort|kind=resort、ふくよかな女性、S7、ボブH0|服4、帯/襟飾り12、裾の斜線10、裸足7|専用の太い胴断面・裾・脚開始高、pool_details(resort)|
|pool_guest_swimshorts|kind=shorts、男性、S8、短髪H9|胴裾/ショーツ6、白い腰印1、裸足8|男性用pool_head/face、pool_details(shorts)|
|pool_guest_slim|bvからswimsuitを利用、S14/H9|水着5→4、縁6→11（Body/Legs/Details限定）|肩.88/腰.90/腹.84/深.88/腕.78/脚.80/頭.94/顎.90/首.84、face_variant|
|pool_guest_lean|bvからshortsを利用、S8→7/H9|ショーツ6→3（Body/Legs限定）|肩.90/腰.94/腹.86/深.87/腕.79/脚.82/頭.94/顎.88/首.88、髪傾斜とface_variant|
|pool_guest_strong|bvからswimsuitを利用、S14→7/H0、resortの髪へ置換|水着5→3、縁6→4（Body/Legs/Details限定）|肩1.10/腰1.09/腹1.08/深1.10/腕1.17/脚1.15/頭1.03/顎1.04/首1.03、face_variant|

`bv` は `PROFILES`、`deform()`、`object_variant()`、`face_variant()`、`morph_variant()`、`hair_variant()` を差し込んで `h.build_pool()` を実行する。Faceはobject生成時に変形せず、**Basisを含む全表情をmorph生成後に変形する**。眼幅・間隔・高さ・眉形・口幅もPROFILESとface_variantに依存する。単純な体スケールでは置き換えない。

### 主人公の衣装・4人・guest_male

|id|生成元・関数|体・頭顔髪、服・小物・色|固有処理|
|---|---|---|---|
|wardrobe|pw.build()|Body=bc.head肌7+bc.hands手袋2、Face=bc.face(0)、Glasses=bc.glasses(3)。Outfit_suit=torso0/legs0、Details_suit=chest_details(suit)白1/黒0。Outfit_tie=torso15/legs15、Details_tie=白1/灰15/ボタン0。Tie_red2/Tie_black0。髪8種は全て黒0、skinheadのみ肌7|ネクタイ付きはOutfitからBVH→シャツ/襟→両方からBVH→tieの順。brow_keys2種。ponytailはpool髪を1.085倍、longは1.0倍。crop/ponytail/longはbp、swept/parted/short/bobはbc、skinheadはpw|
|architect|../protagonist-studies-20261028/archive-v1/source/build_studies.py:build(id,p)|head/face(専用BVH)、hair(parted)0、肌7/陰8、手袋2、torso/legs0→tailor、details白1/黒0、glasses3|SPECSの肩.99/腹.91等を保持、facial_keys5種。archive-v1出力と埋め込みが一致|
|operative|同archive-v1:build|head/face、hair(crop)0、肌7/陰8、手袋0、torso/legs5→tailor、details白1/黒0|肩1.06/腹.86、脚幅.92、袖断面.94、facial_keys5種|
|veteran|同archive-v1:build|head/face、hair(receding)9、肌7/陰8、手袋0、torso/legs15→tailor、details白1/黒0|肩1.10/腹1.04、袖断面1.07、顔の年齢線8、facial_keys5種|
|agent47|../protagonist-studies-20261028/agent47-occiput-fix/source/build_occiput.py:build('q2')→fix|頭顔はQ2入力GLB、手袋0、Outfit0、Details白1/タイ2/ラペル15/ボタン0、Barcode0。髪なし|後頭部頂点投影→後部面削除→片側凸包とミラー→未変更面のカスタム法線復元→バーコード2分割/頭皮再投影。前段候補：source/build_studies.py:build + head47.build_head(Q2) + smooth_head(35) + suit47_details + sty.facial_keys/barcode|
|guest_male|独立GLB/生成関数なし。party/main.ts:loadPlayer、ラボshowReference|wardrobeの表示選択・色の適用に従う|レシピは別の人物として捏造せずaliasにする。ゲームのLook依存とラボDEFAULT_LOOKを別々に記録|

固定3人のパレットは共通から0=20232a、1=ddd9ce、3=a58b55、7=d1ac93、8=ad8871へ変更。Agent 47は0=22262c、1=ddd9cf、6=86abcf、7=c9a58d、8=aa8a75、9=56463a、10=b99a84、15=343941。材質もワードローブと同一と決めつけない。

`appearance.ts:applyLook()` はワードローブの各メッシュ別にパレットを複製して再色付けする。標準Lookではフレーム指定が15だが、元Glassesは3を使用している。この現状も変更しない。GLB一致と、Look適用後の画面一致は別の検証項目として残す。

## 部品庫の案

既存の出力メッシュを分割するのではなく、**同じMeshへ順番に書く生成部品**を登録する。出力名・面分割・フラット/カスタム法線・頂点ウェイト・Faceのタグを保持し、部品の境目でobject化や再法線計算を増やさない。

|部品群|登録候補|制約|
|---|---|---|
|骨・材質|shared22、共通palette、人物別cells、正規化処理|bindは固定。パレット画像・サンプラー・材質設定も版付き|
|体・顔|cast.male、cast.female、pool.swimsuit/resort/shorts、pool.PROFILES、study.v1各人、agent47.q2|頭・首・手・表情生成を同じ版で組にする|
|胴袖・脚|cast.torso、uniform.torso、response.torso/legs、cast.legs、pool.torso/legs、dress裾|脚や靴が一体の部分を無理に分けない。対応体型を明記|
|髪・帽子|bc.hair各種、pool.hair各種、bald/slick/spiky、pw.skinhead、帽子各種|専用フィット率・頭首補正の適用対象を保持|
|表面の服|chest_details、collar、tie/bow、garment_inlay、tee_front、panel/dot|生成順とクリップ領域を保存。inlayは別の板へ置換しない|
|小物|glasses各種、camera、earpiece、headset、apron/boots/towel等|使用色を部品の役割別に保存、座標/ウェイト定数は版付きソース|
|専用の組|dj.*、response.kit、wine.big、study.v1、agent47.q2-occiput|安全に分けられるまで人物専用部品として扱う|

汎用の服を任意の体へ着せられる保証はまだない。部品には `compatibleBodies` と必要な表面プロバイダーを持たせ、非対応の組み合わせはラボで選べない案が無難。色番号の共用を見て肌・靴・髪まで一括再色付けしない。

## レシピJSONの案（未実装）

```json
{
  "schemaVersion": 1,
  "id": "photographer",
  "rig": "cast.shared22.v1",
  "body": {"profile": "cast.male.v1", "parameters": {}},
  "identity": {
    "head": "cast.head.male.v1",
    "face": "cast.face.male.v1",
    "hair": {"part": "cast.hair.swept.v1", "cell": 9}
  },
  "palette": {"id": "cast.palette.v1", "overrides": {}},
  "parts": [
    {"part": "cast.head.male.v1", "mesh": "Body", "colors": {"skin": 8}},
    {"part": "cast.face.male.v1", "mesh": "Face", "colors": {"brow": 9}},
    {"part": "uniform.torso.v1", "mesh": "Outfit", "colors": {"base": 13}},
    {"part": "photographer.vest-inlay.v1", "mesh": "Outfit", "colors": {"vest": 10, "pocket": 9}},
    {"part": "cast.legs.v1", "mesh": "Outfit", "colors": {"pants": 12, "skin": 8, "shoes": 0}},
    {"part": "cast.hands.v1", "mesh": "Body", "colors": {"skin": 8}},
    {"part": "cast.hair.swept.v1", "mesh": "Hair", "colors": {"hair": 9}},
    {"part": "uniform.collar.v1", "mesh": "Accessories", "colors": {"base": 13}},
    {"part": "uniform.camera.v1", "mesh": "Accessories", "colors": {"body": 0, "lens": 15, "strap": 0}}
  ],
  "specialOperations": [
    {"operation": "cast.face-morphs.v1", "phase": "afterObjects", "mesh": "Face"},
    {"operation": "skin-roots.normalize.v1", "phase": "afterExport"}
  ],
  "output": {
    "meshOrder": ["Body", "Outfit", "Hair", "Accessories", "Face"],
    "animationProfile": "cast.walk1.v1",
    "exportProfile": "blender42.cast-nla.v1"
  },
  "reference": {"baselineId": "photographer", "sha256": "段階2で固定する実際のSHA-256"}
}
```

これは形の提案。`identity` は選択・表示用情報、生成実体は重複生成せず `parts` だけを実行する。partsの配列順を生成順として固定し、特別処理のphaseも固定列挙にする。任意Pythonや式をJSONに入れず、版付き登録関数と検証済みパラメーターだけ許可する。

ワードローブは `assetMode: "wardrobe"` と全17メッシュ/表示プリセット/5表情を記録し、標準服だけを出して他の髪・タイを欠落させない。固定4人は `animationProfile: "none"`。`guest_male` は `{ "id": "guest_male", "aliasOf": "wardrobe", "lookPolicy": "party-initial-agent-look", "labPreviewLook": "DEFAULT_LOOK" }` のように実体と表示方針を分ける。

Agent 47は最初から全工程をきれいに分けない。Q2元GLBのSHAを固定した人物専用入力とocciput処理を保持し、前段の再生成が一致した時に置き換える。入力コピーのみを「生成部品へ分解できた」と数えない。前段で一致しなければ段階3の未達として報告し、ゲームへは差し替えない。

## 作業場所と移行の案

```text
assets/characters/
  source/            # 版付きMesh・骨・palette・部品関数・build_recipe.py・compare_glb.mjs
  recipes/           # 1人1JSON、wardrobe/aliasを含む
  catalog/           # 部品、対応体型、色の役割、処理順の定義
  reference-inputs/  # 必要なQ2等の固定入力、出典・SHA。比較の正解とは別管理
  models/            # レシピからの候補GLBだけ
  baselines/         # 段階2開始時manifest、必要なら正解GLBの読み取り専用コピー
investigation/outfit-overhaul/
  stage1-design.md / stage1-observed.json / stage1-*.log
  stage2-pilot.md / stage3-all.md / stage4-lab.md
```

段階2で必要な元ソースを**コピーしてから**入出力先・実行時副作用を整理する。外部2フォルダのimportも、palette保存・mkdir・pycache生成などを書き込むため避ける。pwのトップレベル `build()`、bvのトップレベルループ、環境変数の上書きもコピー側で除去する。複数人物間のCOLORSやmonkey patch漏れを避け、まず1レシピ1Blenderプロセスとする。

Blenderは指定の4.2を別プロセスで使い、ライブシーンを操作しない。出力先は候補modelsだけ。`embed-npcs.mjs`、`npc-data.ts`、`player-data.ts`、`character-data.ts` の読み先・内容を変えない。

## 段階2からの同一性確認の設計

最初に外部2ツリーの全ファイルの相対パス・長さ・SHA-256を記録し、全対象GLB（埋め込み4人を含む）のmanifestを固定する。今回の早期記録は補助で、段階2開始時に改めて採取する。

比較器はGLBのJSON/BINとaccessor（offset/stride/normalized/sparseも扱う）を読み、次を全部満たす時だけPASSにする。

- 骨：22本の名前・親子・rest transform・inverse bind（1e-6以下）。JOINTSの番号は各skinのjoint名対応も検証する。
- メッシュ：名前・数・primitive/material対応・node変換を検証。頂点位置/法線/UV/JOINTS/WEIGHTSを1e-5以下で、三角形の**多重集合**として比較。面順・頂点番号順は許すが、向きや重複数を落とさない。単純丸めハッシュだけで許容差境界を判定しない。
- 表情：target名・既定weight・全三角形の対応頂点のPOSITION/NORMAL差分まで検証。NPC3表情、主人公5表情。アニメーション集合・channel/target/interpolation・時刻/値を1e-5以下で照合。元にwalk1があれば必須、無ければ候補も無し。
- 材質：画像のデコード済み全ピクセル、texture/sampler、色空間に関わる設定、PBR係数（省略時のglTF既定値を含む）、alpha/doubleSided等を比較する。PNGの圧縮バイトだけの差は形状差と混同せず記録する。
- 自己比較PASS、頂点/法線/UV/ウェイト/骨/表情/歩行/材質の意図的な変更をFAIL、面順だけの変更をPASSにする検査を先に行う。比較器の誤判定を防ぐためで、許容値は指示書の値を維持する。

試作は `waiter / photographer / pool_guest_resort`。分岐なし・inlayあり・別体型を各1人。数値FAILなら、元と候補をBlenderへ読み、同一照明/カメラ/ポーズで正面・35°・横90°・後ろ180°を並べる。照明は `bu.render` のAstraキャスト3灯（背景.55/.60/.65、強さ.7、key350/fill60/rim180）を共通プリセットにする。元の画像には横が無いので同条件で追加生成する。画像だけでPASSへ格上げしない。

|対象|段階1の同一性結果|理由|
|---|---|---|
|NPC32体・wardrobe・固定主人公4人|未判定|候補生成・比較器は段階2以降。全37実体の出力構造だけ調査済み|
|guest_male|実体比較はwardrobeに従う|alias。Look適用後の表示は別途確認が必要|

段階3では全37実体を1行ずつid/PASS・FAIL/相違箇所/画像パスで出し、aliasも別行で記録する。棚卸しはその後にレシピ参照へ変更する。全員PASS後も埋め込み先変更は別途Claudeの確認後に行う。

## 段階4の接続案

体型→対応部品→役割別の色→順番を選び、既存キャラのレシピも同じ操作で開く。文字/PNGマークと `window.__outfitLab` を保持し、マークの配置・対象面・色・入力データもレシピへ保存する。画面上でのGLB書き出しを最終成果にしない。

8795へレシピを送ってBlenderで作り、候補GLBと生成ログをラボへ返す案。既存 `/api/map-layout` と同様にlocalhost・専用ヘッダー・固定の出力先を使い、シェル文字列や任意パスを受け取らない。生成はジョブ化し、ラボは状態を取得して候補を読む。既存サーバーは変更・停止せず、実装確認は8890〜8899の自分のサーバーで行う。ゲームへの反映ボタンはまだ作らず、候補の保存・確認までを対象にする。

## 判断・失敗・次の注意

- 決めた所：既存GLBを正解とし、ソースから推測した見た目へ揃えない。固定3人はarchive-v1、47はQ2後頭部修正版を使う案。特殊な処理は人物専用部品として残す。
- 未確定：Q2入力の前段生成が現在のソースで厳密一致するか。段階2以降に調べ、一致しなければ47は未達・差し替え不可とする。
- 失敗した試行：worktreeには依存リンクが無く最初のspecが失敗。相対パスのJunction作成も拒否されたため、既存m1のnode_modulesへ絶対パスのJunctionを作成して再実行した。新依存は追加していない。
- 調査の広域検索は埋め込みbase64や生成物で出力が膨らんだため、ソースに絞り、GLBはJSON/BINを直接読んだ。保護フォルダのPythonを実行/importしていない。
- 次の段階：許可を受けるまで開始しない。段階2冒頭に完全なハッシュmanifestと比較器を作り、比較器を検証してから試作する。最も重要なリスクは再三角分割、法線再計算、BVHの順序、パレット共有、女性/体型変形の適用順。

## 検証記録

|コマンド・確認|結果|
|---|---|
|`git worktree add ../m5-outfit-overhaul -b outfit/overhaul main`|成功、8d7bd06から開始|
|Python標準ライブラリと既存PillowでGLB JSON/BIN・画像を読み取り|32 NPC + wardrobe + 固定4人 = 37実体。全37個の骨数22を確認。各メッシュ・色・表情・アニメ・材質・SHAをobserved JSONへ保存|
|`character-data.ts`をbase64復号し元GLBとバイト比較|4人ともprotagonist-studies/modelsと一致。3人はarchive-v1、47はocciput-fix/models/q2とも一致|
|棚卸しIDとモデルの集合比較、報告のID網羅確認|34項目。欠落4 IDはagent/dj/dj_cast/pool_guest_strong。報告に全37実体を記載|
|`npm --prefix app run spec`（作業worktree）|終了0。docs生成・型チェック成功。596件、pass594/fail0/todo2（歩くゴーストはtest:fastの指定で除外）。stage1-spec.log参照|
|`npm --prefix app run build:all`（同上）|終了0。hotel/party/club/mobile/ai-lab/animation-lab/item-lab/outfit-lab/ui-lab/map-lab/test-stageの11対象が成功。stage1-build-all.log参照|
|外部ツリーのファイル内容・一覧の作業前後集約SHA比較|character-revision 743ファイル、player-wardrobe 24ファイル、ともに一致（調査中の採取から終了前まで）。ハッシュはstage1-observed.jsonのprotectedTrees|
|8795〜8798のListen確認|開始側・終了側とも全4ポートがPID16224で稼働。停止・再起動なし|
|`git diff --check` / `git diff --cached --check`|新規記録のCRLFを空白警告と判定したため、新規4ファイルをLFで保存して再確認。既存ファイルの行末は変更なし|

生成された `build-info.json` はこのworktreeのHEADの内容へ戻し、コードや生成物をコミットに含めない。保護フォルダのハッシュ採取前の読み取り調査については、変更前後ハッシュによる証明はできない。段階2では必ず冒頭で全ファイルmanifestを採取する。

変更ファイル：本報告 `stage1-design.md`、生データ `stage1-observed.json`、検証ログ `stage1-spec.log` / `stage1-build-all.log` の4ファイルのみ（すべて `investigation/outfit-overhaul/`）。ログの時間・試験所要時間等は今回の実測。

終了：2026-11-12 10:12:27 JST。GLB再生成・数値同一性判定・新画面のブラウザ検証は未実施（段階1ではコード/画面の変更なし）。段階1の報告までで停止。

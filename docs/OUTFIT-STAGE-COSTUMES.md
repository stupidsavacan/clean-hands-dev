# 服装Labと新ステージ用衣装

2026-11-13。稼働を確認した編集用URL: http://127.0.0.1:8891/outfit-lab.html

「開く」→「新ステージ候補」に5着を追加。

| ID | 衣装 | 舞台での用途 |
|---|---|---|
| us_police | 濃紺制服、制帽、星型バッジ、装備ベルト | 空港の警察 |
| movie_star | ワイン色礼装、黒ラペル、蝶ネクタイ、サングラス | テレビ局・空港のVIP |
| ferry_captain | 白い上着と制帽、肩章、袖の四本線 | フェリーの船長 |
| professor | 茶系ジャケット、白髪、眼鏡、肘当て | 講演出演者・旅館の宿泊客 |
| oil_magnate | 白いトーブ、金縁の黒いビシュト、グトラとアガール | 湾岸地域出身の架空VIP |

特定の実在人物・警察組織を再現したものではない。ゲーム内の配置、通行権限、変装判定は未設定。追加衣装はLabで確認する候補資産。

## 元のPythonとデータ

- `assets/characters/source/build_recipe.py`: JSONを検証し、共通骨格・部品・歩行を組み立て、GLBを書き出す入口。
- `assets/characters/source/build_characters.py`: 元の体、顔、髪、共通22骨、歩行。
- `assets/characters/source/build_uniforms.py`: 制服の胴、襟、帽子、眼鏡、表面に沿う装飾など。
- `assets/characters/source/stage_costumes.py`: 今回の5着の専用部品。
- `assets/characters/recipes/<ID>.json`: 色、体型、部品構成のレシピ。
- `assets/characters/models/<ID>/<ID>.glb`: 完成モデル。同フォルダの `build.json` にハッシュと頂点数。
- `assets/characters/source/source-provenance.json`: 元ソースの来歴。
- `app/src/labs/outfit-inventory.json`: Labの衣装一覧。
- `tools/outfit_service.py`: ブラウザからの生成・プレビューAPI。

## 追加・再生成の手順

1. 近い既存レシピを複製し、固有の `id` と `label` を付ける。既存キャラは上書きしない。
2. 登録済みの部品・パレットを指定する。専用形状が必要ならPythonで共通骨へのウェイトを付け、`build_recipe.py` の `PARTS` に登録する。
3. 次のコマンドをこのプロジェクトのルートから実行する。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --factory-startup --python-exit-code 1 -P assets/characters/source/build_recipe.py -- assets/characters/recipes/ferry_captain.json
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --factory-startup --python-exit-code 1 -P assets/characters/source/export_catalog.py
```

4. 衣装台帳と必要なら `outfit-lab.ts` の部品表示名を追加し、`app` で `npm run build:all -- outfit-lab`。
5. Labを更新し、正面・横・背面と歩行で確認。色・部品を変えた版は「保存して作る」で別キャラとして保存できる。

サーバーを起動する場合はルートで `python tools/outfit-preview.py --port 8891`。すでに動いていれば二重起動しない。Python部品を変更した直後に古いプレビューワーカーが残っている場合は、生成中でないことを確かめて専用サーバーを再起動する。

石油王の長衣の裾はゲーム用に左右脚へ分割して追従する方式。布シミュレーションではなく、激しい動作では裾の分割が見える。

## 体を突き抜けない服（drape.v2）

長い上着やスカートのように、脚の動きに骨だけでは付いて行けない服は、`stage_costumes.py` の `GARMENTS` に登録する。登録した服は専用のメッシュになり、宣言が GLB に入る。動かした後の補正は `app/src/garment-runtime.ts` が行う（仕組みと測定は `investigation/garment-system-review/acceptance.md`）。

1. 形を作る関数を書く。腰から下は辺を約8cm以下にする（`refine_grid` で、形とウェイトを変えずに細かくできる）。
2. 基準姿勢で、下に着ている物より外側にあること。ここで入り込んでいる所は補正されない。
3. `GARMENTS` に宣言を足す。
   - `colliders`：下に着ているメッシュ（太さを測る相手）
   - `innerBones`：布の内側にある手足。布はこの外に出る
   - `outerBones`：布の外側にある手足（袖を通した腕）。布が少し内へ譲る
   - `pinAbove` / `freeBelow`：この高さより上は動かさない／下は自由（m）
   - `clearance`：手足との間隔（m）
4. Blender で GLB を作り直し、`app` で確かめる。

```powershell
node --experimental-strip-types scripts/garment-audit.ts <キャラクターのid>
```

脚との交差（`legs`）が補正ありで0になっていること、基準姿勢の `maxCorrection` が0であることを見る。

ゲームや他のラボで使う時は、モデルを読み込んだ後に `new GarmentRuntime(model)`、毎フレーム骨を動かして行列を更新した後に `update(経過秒)`、捨てる時に `dispose()` を呼ぶ。

動きは `style` で選ぶ。既定の `'calm'`（落ち着き）は重い布のようにゆっくり戻り、`'dynamic'`（機敏）は脚の一歩ごとに付いて行く。落ち着きでは `gait`（歩幅と足の上げの倍率）を着ている人の `Locomotion.style` に入れる。場面を飛ばした時は `reset()`。数値は `garment-runtime.ts` の `DRAPE_STYLES`。
今は服装ラボだけが呼んでいる。補正なしの GLB だけを外のビューアで動かすと、布は体を突き抜ける。


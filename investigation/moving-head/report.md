# クラブのムービングライト 作業報告

2026-11-10 16:39〜16:48（JST）

結果は「できた」。クラブの6台を、台・U字の腕・頭が分かれた788三角形のモデルに置き換えた。

| 確認項目 | 方法と結果 |
|---|---|
| GLB 検証 | `node assets/props/source/validate.cjs`。9点すべてエラー0・警告0。新モデルの情報2件は空ノードのアンカー。 |
| 小物の表と仕様 | `assets/props/README.md` に寸法、三角形数、原点、パン・チルトの軸、静止時の向き、2つのアンカーを記載。 |
| レンズの向き | `node --experimental-strip-types --no-warnings --test app/tests/club-moving-head.test.ts`。埋め込みGLBを読み込み、6台を0〜60秒の0.1秒刻みで測定。円錐の軸に対する最大角度差は約0.0000015°（許容3°）。 |
| 円錐の頂点 | 同じ試験で、実メッシュの頂点と `BEAM` の最大差は約0.000000095 m（許容0.01 m）。暗転と復帰も確認。 |
| キャットウォークとの接続 | 同じ試験で、6台の `HANG` が地図上のキャットウォーク範囲内にあり、裏面との高さの差は0 m（許容0.02 m）。クランプのメッシュ上端も裏面に達する。 |
| モデル画像 | Blender 4.2.16 の `blender.exe -b -t 6 --python-exit-code 1 -P $env:TEMP/moving-head-render.py`。Cycles 32サンプル。参考の3灯をモデル中心へ平行移動し、出力・サイズ・向きを維持した。横・斜め上・見上げの3枚を目視確認。 |
| ゲーム画像 | `python -m http.server 8892 --bind 127.0.0.1` で作業ツリーの `club-prototype.html` を配信。Playwright の Chromium で1080×810、床上1.65 mの同一視点から照明時刻20秒と24秒を撮影。ページ・コンソールエラー0。2枚を目視確認。 |

## 迷った所・決めた所

- 旧箱の上端は 3.42 + 0.16 = 3.58 m。地図の2階床は3.50 mで、描画の床板は0.50 m厚。指定された2つの高さは同時に満たせないため、旧箱と同じ水平位置で、実際に接する裏面の3.00 mを採用した。
- 光の向きに合わせる際、同じ向きを作るパンとチルトの組のうち、直前のパン角に近い方を選ぶ。光が真下を横切るときに腕が急に半回転するのを避けた。

## うまくいかなかった所と見た目

- 初回は852三角形。台の通気口を左右3本から2本ずつ、頭の背面の放熱フィンを5本から3本に減らし、内側の軸を8角から6角にして788三角形に収めた。
- 最初の位置合わせでは、移動後に `HANG` を読んだため、配置先が相殺されて試験が失敗した。移動前のアンカー位置を読むよう修正した。
- 初回のゲーム画像では腕が黒い天井に溶け、頭の側面に付けた銀色の四角だけが浮いて見えた。頭の四角を外し、腕の面取りに金属色を移した。最終画像の20秒では腕の輪郭と頭の丸み、24秒ではレンズが傾き、その中心から光が伸びることを確認した。台の細部は暗い天井に近い色のため、床からは判別しづらい。

## 変えたファイル

- `app/src/club/main.ts`、`app/src/club/show.ts`、`app/src/prop-data.ts`
- `app/tests/club-moving-head.test.ts`
- `assets/props/source/build_props.py`、`assets/props/models/moving_head/moving_head.glb`
- `assets/props/README.md`、`assets/props/build-info.json`、`assets/props/khronos-validation.json`
- `investigation/moving-head/` の [model-side.png](model-side.png)、[model-above.png](model-above.png)、[model-below.png](model-below.png)、[game-20s.png](game-20s.png)、[game-24s.png](game-24s.png)、`report.md`

## 最終確認

- `m5-codex-movinghead/app` で `npm run spec` 成功。型チェックと `test:fast` を実行し、585件中583件成功・失敗0件・TODO 2件。
- 同じ場所で `npm run build:all` 成功。全10ページ生成。

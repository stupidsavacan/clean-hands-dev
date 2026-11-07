# CLEAN HANDS M5.8 食い違いの修正とゴースト：作業報告（2026-10-31）

①〜⑥を修正し、14チャンス（B2の2通りを含む15ルート）すべてでゴースト、標的以外の死者0を確認した。既存212件に24件を追加して `npm test` は236件成功・失敗0件。既存テストは変更していない。

## 修正前後の比較

| チャンス | 修正前 | 修正後 |
|---|---|---|
| A1 試飲会のソムリエ（毒の一杯） | 可 | 可 |
| A2 限定ワインの樽（毒） | 可 | 可 |
| A3 プールの照明（感電） | 不可 | 可 |
| A4 テラスの記念撮影（突き落とし） | 不可 | 可 |
| A5 展示ヨットのクレーン（落下物） | 不可 | 可 |
| B1 スピーチとシャンデリア | 可 | 可 |
| B2 料理長の試食会（ガス） | 不可 | 可 |
| B2 料理長の試食会（毒の皿） | 可 | 可 |
| B3 護衛の交代（付き添って排除） | 不可 | 可 |
| B4 専属運転手（車内） | 可 | 可 |
| C1 バルコニーの電話（手すり） | 可 | 可 |
| C2 避難ボート（燃料・警戒度3） | 可 | 可 |
| C3 屋上のヘリ（パイロットで突き落とし） | 不可 | 可 |
| C4 出張マッサージ師（ワイヤー） | 不可 | 可 |
| C5 浜辺の花火 | 不可 | 可 |

素手Xの3ルートは今回の目標外で、修正前後とも不可。全18ルートでは7→15ルートがゴースト可。比較元は `ghost-sim.before.json`、修正後は `ghost-sim.after.json`。後者は `ScoreLedger` と `computeResult` の採点内訳も保存した。

周囲の人を消さず、実際の予定・AI・検知を動かしている。作動後は離れた場所からさらに2分間、死体発見や通報を観察した。各チャンスを個別に確認した結果で、移動中の未発見や、1ミッションでの全14件の同時達成を示すものではない。

## 変更と手順

- ① 検知システムの生きているカメラで判定し、作動の映像は同時に録画する。消去時はカメラだけが理由だった殺人を事故に戻す。死体発見・事故加点の帳簿も訂正する。同じ作動に複数被害者がいる場合も全員を更新する。目撃者や違法な物、監視員にすでに見つかった記録、直接の殺しは消えない。
- ② 罠の7種の準備をtamperとして疑惑と録画に渡す。
- ③ 手動作動の目撃者は通常の疑惑計算で不審に感じる人に限定。服・持ち物・溶け込み・立入権限に従う。押す・ワイヤーは見られれば殺人。
- ④ M5.3も現在の銃と変装の違法性を参照。
- ⑤ 銃声のヘルプを警戒度2→継続15秒で3に修正。
- ⑥ カメラマンのカメラ所持を許可。
- A3は清掃員の服で作動すると事故。A5は操作盤と操作地点をカメラの外へ移した。準備時は従来位置の固定ピンが映るため、まず消音ピストルで `CAM_marina` を止め、銃をしまって警備の確認が終わるのを待つ（検証では20秒）。その後ピンを抜き、見学中に操作盤を使う。
- A4は撮影の台本でテラスの人が手すりから離れ、浜辺の人は海を向く。C3は出迎えの間、警備がヘリの点検へ移る。移動が終わるのを待ってから押す。
- B2の試食中は護衛3人が爆発の外で待つ。C5は花火の当たる半径を投資家の席だけに絞った。
- B3はほかの護衛3人が待機するので、Bの客室奥 `(22, 3.5, -17)` まで誘導して背後から排除できる。C4はマッサージ後すぐにEで運び、新設の近くの物入れへ隠す。

数値・JSON・台本の位置の詳細はREADMEの「5.8のあと：食い違いの修正とゴースト」に記載した。hotel.jsonはbuild-hotel.tsから生成し、手書きしていない。

## 検証

- `npm test`：236件成功、失敗0件（`tests.after.txt`）。既存テストの修正0件。追加は `fixes.test.ts` 9件と `ghost.test.ts` 15件。
- `npm run build`：型チェックと本番ビルド成功。単体配布用にモデルを埋め込んでいるため、Viteの大きいチャンクの警告は出る。
- `node scripts/standalone.mjs`：成功。`index.html` と `clean-hands-m5.8-pc-fixes.html` はバイト一致。
- Chromiumで単体HTMLを直接開き、準備画面→「作戦開始」→プレイ画面を確認。NPC120人、コンソールとページのエラー0件。`browser-fixes.json`、`fixes-briefing.png`、`fixes-playing.png` に記録。
- 修正前HTMLのSHA256は作業開始時と一致：`22588aea8662a7529f3d7bc84318a8906c089b13f8591c8c754379d449fae9c1`。
- `scoring.json`、`combat.json`、`rules.json`、`weapons.json`、`chances.json`、`kills.json` は修正前とバイト一致。ホテルの壁・床・階段・部屋・区域・NPC定義・通常の予定地点・カメラ配置は同一。追加は依頼の物入れ1つとその当たり判定、変更はチャンスの操作盤・台本・巻き込み範囲。モバイル版とサイト公開には触れていない。

## 変更ファイル

アプリのソース・データ・テスト：

- `app/src/detection.ts`
- `app/src/events.ts`
- `app/src/kills.ts`
- `app/src/m53.ts`
- `app/src/m57.ts`
- `app/src/main.ts`
- `app/src/schedule.ts`
- `app/src/score.ts`
- `app/src/data/detection.json`
- `app/src/data/hotel.json`
- `app/src/data/schedule.json`
- `app/scripts/build-hotel.ts`
- `app/scripts/verify-fixes.mjs`
- `app/tests/fixes.test.ts`
- `app/tests/ghost.test.ts`

生成物・調査・文書：

- `README.md`
- `investigation/ghost-sim.ts`（本番と同じ検知状態、正しい手順、computeResult、テストから再利用できる入口）
- `investigation/ghost-sim.after.json`
- `investigation/fixes-report-20261031.md`（この報告）
- `investigation/tests.before.txt`、`investigation/tests.after.txt`
- `investigation/browser-fixes.json`、`investigation/fixes-briefing.png`、`investigation/fixes-playing.png`
- `app/dist/`（ビルド出力）
- `index.html`、`clean-hands-m5.8-pc-fixes.html`、`build-info.json`

修正前ソースは `investigation/before-fixes-source/` に保存した。

## 残った課題・未確認

開始地点から実際に歩く途中の発見、全ルートの服・道具の実地入手、全チャンスの実画面操作、2分を超えた後の死体発見は未確認。今回のシミュレーションは作動場所への瞬間移動を使う。B3は死体を隠さず客室奥に残す手順なので、長時間の安全性は別途確認が必要。

⑦ 録画機を壊しても、カメラ自体が動いていればその後また録画される。仕様が未決定のため現状を保持し、READMEの「決めていないこと」に明記した。

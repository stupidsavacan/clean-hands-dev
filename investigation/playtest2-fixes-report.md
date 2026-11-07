# CLEAN HANDS 5.8：プレイテスト2の修正報告

依頼：`codex-prompt-playtest2-20261101.md`。
修正対象はPC版の9項目。
`index.html` と `../clean-hands-m5.8-pc-playtest2-fixes.html` を作り直した。
2つのHTMLのSHA256は一致する。

## 修正1〜9の結果

| 項目 | 結果 | 確認と制限 |
|---|---|---|
| 1 検問の受付 | 修正済み | 線分から1.2m以内。2検問の左端・中央・右端から担当が歩いて接近し、検査・帰還・横断に成功。担当不在の表示も確認。ロビーKOだけは捕縛後に検問単体を調べる負例。 |
| 2 大階段の隙間 | 修正済み | 線をz=−3.8へ移動。左右端×6深さで、検査なしでは上階へ到達しない。マリーナ直近の端は壁で塞がれているため形を変更していない。 |
| 3 A1の受入れと説明 | 修正済み | 正規の服取得・挨拶・19分以降の給仕長前通過・地下での一杯と誘導の2経路でチャンス成立とゴースト。時刻と場所を手順へ追加。 |
| 4 忙しい人のTポーズ | 修正済み | 既存の立位・歩行・chatを使用。骨の検査と実ゲームのJ挨拶写真で腕が下がることを確認。写真の服と位置は制御した準備。 |
| 5 宙に残る構えた銃 | 修正済み | 倒れた次の描画で構えた銃が非表示。拾える落下銃は1挺残る。busyも確認。 |
| 6 無担当の連続通報 | 修正済み | 通報後はうずくまり、12秒の間隔を設定。全警備員が倒れた状態で民間人の前に銃を構え10秒待ち、銃目撃の通報は各人1回。 |
| 7 漁師の港湾許可 | 修正済み | 正規取得して港湾事務所内で許可。厨房の許可判定は従来のdeny。服の北東から取り、ゴーストを維持。 |
| 8 コインの残留 | 修正済み | 着地した見た目も管理して片付ける。最終HTMLで着地1個→やり直し0個、別の1個→準備画面0個。 |
| 9 しゃがみ銃姿勢 | 修正済み | 既存動作の銃と両手を0.4m下げ、前傾を調整。立位／しゃがみの構え・射撃・弾込め写真を比較。入口から歩いた後のしゃがみ射撃が狙った標的へ命中。 |

## 確認結果

- `npm test`：281件成功、失敗0件（従来250件＋追加31件）。最終結果：`playtest2-tests-final.txt`。
- 追加31件は検問23件、A1・服・通報4件、描画・命中4件。
- ビルド：`npm run build` 成功。
- 単体化：`node scripts/standalone.mjs` 成功。6,424,118バイト、外部アセット0件。
- Viteは従来の大きい単一ファイルに対するサイズ警告を出す。ビルドエラーではない。
- 最終単体HTMLをChromiumで開き、「作戦開始」からプレイ画面が表示されることを確認。
- 最終HTMLの確認でコンソールのerrorと未処理例外は0件。`playtest2-coin-browser.json`。
- 型検査も成功。
- `scoring.json`、`schedule.json`、`weapons.json`、`combat.json` は作業開始時のハッシュと一致。
- モバイル版、プレイテストの道具、公開サイトは変更していない。コミット・プッシュはしていない。

### 検問の調査4本

全出力は `checkpoint-playtest2-results.jsonl`。

| スクリプト | 結果 |
|---|---|
| `checkpoint-reach.ts` | 実床の高さで数えた受付可能点は大階段1113点、マリーナ732点。全点で検査完了まで試した数ではない。 |
| `checkpoint-cross.ts` | 両検問とも止める側から線の範囲は横断不可。逆向きの中央は従来どおり通過可。 |
| `checkpoint-gap.ts` | 直進・西端・東端の3経路はすべて `upstairs:false`。 |
| `checkpoint-gap2.ts` | 左右端×6深さの12経路はすべて `upstairs:false`。 |

- 大階段1253点という途中報告は、階段上の高さを0と仮定した点を含んでいた。140点を除外した1113点が最終値。
- マリーナの線の直近の両端には隙間がない。±8mを10cm刻みで調べた。
- マリーナの遊歩道側の出入り、検問の向き・幅・位置は変更していない。
- 追加した検問テストは23件。詳しくは `checkpoint-fixes-report.md`。

### 歩行テストの範囲

- 本番の `hotel.json` と本物の更新処理を使用する。
- 周囲の人を残し、ナビの経路を歩く。各歩で `world.move` と `m4.constrain` を通す。
- 服は置き服または気絶者からTで取る。服の直接指定は使わない。
- A1は人目のある桟橋 `(34,0,26.7)` を出発点にする。服取得地点や排除地点を出発点にはしない。
- ソムリエを気絶させ、物入れへ運び、`(43.95,0,27.45)` から収納・服取得する。真正面へ寄り過ぎると給仕の視界に出るため。
- 時間ジャンプは地図内で誰にも見られていないことを確かめてから `clock.jump` を使う。
- A1の2経路、正常な検問経路、漁師服取得は `ScoreLedger` と `computeResult` でゴーストを確認。
- 故意に銃を見せる負例は発見されるため、ゴーストが崩れることを確認する。
- 全警備員死亡の負例は、指定された状況を作るため警備員のlifeをdeadに初期化する。民間人は全員維持する。全警備員を1人ずつ実操作で倒す攻略試験ではない。
- ロビーの検問担当KOは目撃され、捕縛になる。捕縛後にM4単体へBを入力して不在表示を確認した。捕まらずゴーストを保ってKOからBまで行く経路は未確認。
- 描画の骨・銃の単体試験は状態を制御した確認。服取得や排除へ歩いた証明とは別にする。
- 挨拶写真はデバッグで撮影位置と服を準備し、実際のJ入力で撮影した。接近と服取得はNodeの歩行試験で別に確認した。

## 変えた値

| 保存先 | 変更 |
|---|---|
| `app/src/data/rules.json` | `m4.friskRange=1.2`、`friskStandDistance=1`、`friskArrivalDistance=0.08`。既存の2.5秒検査・90秒通行証・違法な物の発見は維持。 |
| `app/src/data/checkpoints.json` | 2検問の定義をJSONへ移し、大階段のzだけ−3.4→−3.8。 |
| `app/src/data/detection.json` | `witness.repeatSeconds=12`。 |
| `app/src/data/combat-pose.json` | 既存の胸高さ1.4m／1.0mを共有。銃使用中のしゃがみ前傾0.10ラジアン。 |
| `app/src/data/hotel.json` | 生成された港湾事務所に`allowedDisguises:["fisher"]`。手書き編集はしていない。 |
| `app/src/data/chances.json` | A1手順へ19:00〜24:00と地下セラーの試飲会を記載。 |

歩行試験専用の位置・時間は `checkpoint-walk.routes.json`、`playtest2-field.routes.json`、`visual-checks.json` に保存。
新しい隠し場所・予定・セリフ・モデル・モーションファイルは追加していない。

## 既存テストの変更理由

- `tests/m53.test.ts`：鍵受領後の一時免疫解除という旧期待を、ソムリエ受入れ継続へ変更。
- `tests/m53-play.test.ts`：鍵をもらった後に給仕長に見抜かれる旧期待を、見抜かれず顔ゲージ0へ変更。
- `tests/m4.test.ts`：検査中断後は警備員が歩いて持ち場へ戻るため、帰還を待ってからbusy解除を検査する。
- `investigation/ghost-walk.ts`：A5・C2は警備員の接近時間を含めてBを長押しする。
- 同じB3は、今回塞いだ大階段の隙間を通っていた。正規の検査を受けて上階へ向かう経路に変更。
- 練習用マップの既存M4テストは残し、本番ホテルの23件を追加した。
- 中間実行の失敗出力は `playtest2-tests-first.txt` と `playtest2-tests-interim.txt` に残した。最終結果と混同しないこと。

## 写真

いずれも撮ったあとに開いて確認した。

- `playtest2-briefing.png`：最終HTMLの準備画面。
- `playtest2-greeting-game.png`：実ゲームの挨拶中。両腕が下がっている。
- `playtest2-busy-chat.png`：本番給仕長モデルの会話姿勢の描画確認。
- `playtest2-guard-dropped.png`：構えた銃がなく、拾える銃1挺が残る。
- `playtest2-coin-landed.png`／`playtest2-coin-reset.png`：同じ視点でコイン着地とやり直し後。
- `playtest2-combat-before.png`／`playtest2-combat-after.png`：立位・しゃがみ各3動作を並べた比較描画。
- `playtest2-crouch-before.png`／`playtest2-crouch-after.png`：実ゲームの修正前相当・修正後。修正前はブラウザ内だけで補正を無効にして再現した。
- 銃の構え位置は立位1.437m、しゃがみ1.037m。比較描画の手と銃の誤差は約1.4〜1.9mm。
- 描画の詳しい手順と結果は `visual-fixes-report.md`、`playtest2-visual-results.json`。

## 人がもう一度遊んで確かめること

1. 検問の端でBを押し続けたとき、警備員が歩いて来る待ち時間が分かるか。
2. 検査中と帰還中に、手すり・壁・プレイヤーへの不自然な重なりがないか。
3. A1の挨拶後、19〜24分の試飲会へ戻り、両方の最後の手順を実行できるか。
4. 漁師の服で港湾事務所へ入り、他のスタッフ区域では従来どおり禁止されるか。
5. しゃがみの銃操作をいつものカメラで見たとき、胸の高さと腕が自然か。
6. 長い撃ち合いでも目撃者の通報が大量に繰り返されないか。

S1から3人を続けて倒して脱出する通しプレイ、長時間の撃ち合い、全服・全体型・全カメラの組合せは今回未確認。
A1は桟橋で開始するため、桟橋までの侵入全行程を証明していない。

## 変更ファイル一覧

すべて `outputs/m5-prototype/` 以下。

本体：

- `app/src/ai.ts`
- `app/src/m3.ts`
- `app/src/m4.ts`
- `app/src/m4-view.ts`
- `app/src/m53.ts`
- `app/src/detection.ts`
- `app/src/npc-view.ts`
- `app/src/combat.ts`
- `app/src/combat-view.ts`
- `app/src/combat-runtime.ts`
- `app/src/main.ts`
- `app/src/data/rules.json`
- `app/src/data/checkpoints.json`（追加）
- `app/src/data/chances.json`
- `app/src/data/detection.json`
- `app/src/data/combat-pose.json`（追加）
- `app/scripts/build-hotel.ts`
- `app/src/data/hotel.json`（生成）

テスト：

- `app/tests/m4.test.ts`
- `app/tests/m53.test.ts`
- `app/tests/m53-play.test.ts`
- `app/tests/checkpoint-hotel.test.ts`（追加）
- `app/tests/playtest2-field.test.ts`（追加）
- `app/tests/visual-state.test.ts`（追加）

調査・説明：

- `investigation/checkpoint-reach.ts`
- `investigation/checkpoint-cross.ts`
- `investigation/checkpoint-gap2.ts`
- `investigation/ghost-walk.ts`
- `investigation/ghost-walk.routes.json`
- `investigation/checkpoint-walk.routes.json`（追加）
- `investigation/playtest2-field.routes.json`（追加）
- `investigation/a1-playtest2-probe.ts`（追加）
- `investigation/fisher-approach.ts`（追加）
- `investigation/verify-playtest2-coins.mjs`（追加）
- `investigation/visual-checks.json`（追加）
- `investigation/visual-browser-before.mjs`（追加）
- `investigation/visual-browser.mjs`（追加）
- `investigation/combat-browser.mjs`（追加）
- `investigation/greeting-browser.mjs`（追加）
- `investigation/checkpoint-fixes-report.md`（追加）
- `investigation/visual-fixes-report.md`（追加）
- `investigation/playtest2-fixes-report.md`（この報告）
- `README.md`

生成物：

- `index.html`
- `clean-hands-m5.8-pc-playtest2-fixes.html`（追加）
- `build-info.json`
- `app/dist/index.html`、`app/dist/assets/index-C2G02tdx.css`、`app/dist/assets/index-gLvCcXJu.js`
- 調査結果JSON／JSONL、テストのテキストログ、上記画面写真（`investigation/`内）。


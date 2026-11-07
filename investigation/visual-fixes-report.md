# プレイテスト2：修正4・5・9の確認

- 修正4：busyの早期終了を外した。立ち止まる人は既存の立位で描く。検査へ歩く人は既存の歩行を使う。挨拶中はscriptedActionのchatを使う。
- 修正5：CombatView.renderで、倒れた・busy・撃ち合い終了・非表示の人の構えた銃を毎フレーム隠す。落下銃の処理は変えていない。
- 修正9：既存の銃動作をしゃがみへ重ねるとき、銃と弾倉の腰目標を0.4m下げる。前傾を0.10ラジアンへ補正する。新規モーションは作っていない。
- 値：src/data/combat-pose.jsonのchest.standing=1.4、chest.crouched=1.0、crouch.spinePitch=0.10。射撃の既存胸高さも同じJSONへ移し、弾道の高さと共有した。射撃距離・威力・命中処理は変えていない。
- 本番コードへ追加した距離・秒数・位置の直書きはない。テストの角度差・IK許容差、サンプル進行度、描画確認スクリプトのカメラや画面サイズは検証用の値。
- 既存テストは変更していない。tests/visual-state.test.tsを4件追加し、4件すべて成功した。npm run checkも成功した。
- busy立位とchatの腕が初期姿勢から1ラジアン以上下がることを確認した。
- 倒れた直後のfall=0の次のrenderで構えた銃が消えることを確認した。落下完了後に落下銃のデータと描画が残ることも確認した。
- ピストルと長銃で、構え・射撃・弾込め・抜く・しまうの5動作を検査した。しゃがみの両手の誤差は許容範囲0.025m以内だった。
- 入口からバー前までナビを歩き、world.moveとm4.constrain、群衆を含む通常の更新を通した。射撃直前のゴーストを確認した。準備相当で持ち込んだ消音ピストルをしゃがんで撃ち、狙ったワイン商へ命中することを確認した。この試験は射撃後のゴースト攻略を保証しない。
- PlaywrightのChromiumで修正前のしゃがみを確認した。補正を無効にするブラウザの応答差し替えで旧挙動を再現した。ゲームのファイルは差し替えない。
- 実ゲームの修正前後はplaytest2-crouch-before.pngとplaytest2-crouch-after.png。双方を開いて確認した。
- 立位としゃがみの構え・射撃・弾込めを並べた画像はplaytest2-combat-before.pngとplaytest2-combat-after.png。いずれも開いて確認した。本番のモデルと動作の描画比較で、プレイ経路の試験ではない。
- 銃口の構え高さは立位1.437m、しゃがみ1.037m。比較画像の手と銃の誤差は約1.4〜1.9mm。
- playtest2-busy-chat.pngは本番の給仕長モデルをbusy/chat状態で描く確認画像。
- playtest2-guard-dropped.pngは本番の警備員モデルを使う確認画像。構えた銃は非表示で、足元の落下銃は1挺残る。開いて確認した。
- playtest2-greeting-game.pngは実ゲームでJを押した挨拶中の画面。busy=true、scriptedAction=chat、action.kind=greetを確認した。給仕長の両腕が下がることを画像を開いて確認した。服と撮影位置はデバッグで準備した。服取得と接近の歩行証明は別のA1テストを参照する。
- ブラウザのpageerrorとconsole.errorは、比較描画、実ゲームのしゃがみ、実ゲームの挨拶の各実行で0件。

再実行はappで次を行う。先にnpm run devで5175を起動する。

- node --experimental-strip-types --test tests/visual-state.test.ts
- node ../investigation/visual-browser-before.mjs
- node ../investigation/visual-browser.mjs
- node ../investigation/combat-browser.mjs
- node ../investigation/greeting-browser.mjs

結果の数値はplaytest2-visual-results.jsonとplaytest2-greeting-browser.jsonに保存した。

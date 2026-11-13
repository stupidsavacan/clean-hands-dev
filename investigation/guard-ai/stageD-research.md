# 段階D：未確認の動きの調査

開始：2026-11-13 16:35 JST。終了：2026-11-13 16:40 JST。
結果：できた。今回はゲームの挙動は変更しない。本報告を含む段階Dコミットで終了する。

## 調査と判断

| 動き | 分かったこと・判断 | 出典と確度 |
|---|---|---|
| 撃たれたら後退・遮蔽変更 | **根拠なし（今回の調査範囲）**。一般的な遮蔽利用・回り込みの説明はあるが、被弾をトリガーとする後退とは区別する。追加しない。HITMANに存在しないと断定する意味ではない。 | [IOI開発者インタビュー](https://www.greenmangaming.com/intel-feature/hitman-2/developer-question-and-answer/)は回り込みと射撃位置を説明する一次資料だが、被弾後退の記述なし。[公式マニュアル](https://www.feralinteractive.com/en/manuals/hitman/latest/linux/)のCombat・Alert Levelsにも該当する明記を確認できず。 |
| 被弾や弾着による別の移動 | 遠方から撃たれた警備が射撃位置へ走るというプレイヤーの実験説明がある。後退の根拠にはならない。既存のwounded（視認できれば戦闘、見えなければ発砲地点を調査）は変更しない。 | [Steam：How Bullet Distractions Work](https://steamcommunity.com/sharedfiles/filedetails/?id=2957831754)のThree Shot Bullet Distractions or Shooting NPCs。プレイヤーの一次報告、確度中。ゲームの現行バージョンを自分で再現してはいない。 |
| 落ちている強い銃へ交換するか | 戦闘が激化しても拳銃の警備が周囲の小銃等を使わない、という記述を確認。CLEAN HANDSも戦闘中は拾って装備しない。変更不要。 | [Hitman Forum、2023-02-28、Toybasherの投稿16](https://www.hitmanforum.com/t/70usd-aaa-game-ai-is-dumb-as-a-box-of-rocks/18222)。本人のプレイ観察・確度中。改良案として拾わせたいという文脈。公式仕様の断定ではない。 |
| エージェントの投擲爆発物への反応 | **対象の物がない**。新設しない。段階Cの警備専用フラッシュはエージェントの持ち物に登録していない。 | 現実装のMELEEは鈍器・刃物、投擲はengine/game.tsのthrowHeld。weapons.jsonと持ち物表にエージェントが投げる爆発物はない。地図の固定の仕掛けは対象外。 |

検索には guard/shot/retreat/change cover/better weapons/upgrade 等とHitman Forum、Steamの条件を用いた。プレイヤーが下がる攻略と警備が被弾して下がる挙動を混同しない。脚を撃たれて倒れるという投稿も、戦術的な後退とは扱わない。

## 落下銃の回収：実装で確認したこと

- 正本は `app/src/engine/weapons.ts`。`app/src/club/weapons.ts` は再export。
- 新しい回収の候補はpatrolまたはcuriousだけ。combatは候補に入らない。
- 進行中の回収も、stateがdistracted以外になると解除する。
- 回収完了時は落下銃をリストから取り除く。`n.weapon`への代入はない。武器の強さの比較や持ち替えはしていない。
- 共有エンジンは `CombatSystem.step` の後に回収を更新するため、戦闘へ移った同じフレームで回収を解除できる。
- ホテル・夜会の旧mainエントリにはClubWeaponsの接続がない。共通エンジンを使うクラブ等の回収と区別する。この差は今回変更しない。

## 実行検証

`node --experimental-strip-types --no-warnings app/scripts/guard-recovery-audit.ts`

1. 拳銃の警備の足元にSMGを置き、戦闘状態で20秒分回収更新：落下SMGが残り、拳銃のまま。
2. 持ち上げ中に `CombatSystem.engage` で戦闘へ：持ち上げを解除、SMGは残り、拳銃のまま。
3. 巡回中に同じSMGを回収：床から消えるが拳銃のまま。

3件ともassert成功。[実行結果](stageD-recovery.txt)。挙動は変えていない。既存の回収・キャンセル等の試験は全体specにも含まれる。

## 最終確認

- `npm run spec`：625件、623合格・既知todo2・失敗0（spec-stageD.log）。
- `npm run build:all`：11ページ成功（build-stageD.log）。
- 新しい画面の変更はないので、この段階では画像追加なし。段階A〜Cの画像を参照。

## 変更ファイル・コミット

- `app/scripts/guard-recovery-audit.ts`（読み取り・検証用）
- 本報告、stageD-recovery.txt。
- 段階Aの追加検証：app/scripts/guard-outdoor-audit.ts、stageA-outdoor-motion.json、stageA-maps.mdの追記（実マップの増援入口から遮蔽へ移動・射撃を確認）。
- A：dabf8b4、B：d3a9fd6、C：c8c990b。Dのハッシュはgit logで確認できる。

## 迷った所・うまくいかなかった所

- HITMANの資料に一般的な移動・追跡の説明はあるが、被弾後の退避の確かな条件は見つからなかった。根拠の弱い推測から新しい挙動を足さず、依頼どおり見送った。
- 方針メモの「警備AIの質問5983」は狙撃後の発覚の議論だった。強い銃を使わないという記述は別の18222の投稿16にあったため、出典を区別した。
- 回収を武器保管場所まで運ぶ表現やホテル・夜会への回収接続は、今回の対象外として報告だけにした。

## 目の高さ・視界

変更なし。段階Dで新しく確認した問題はなし。

## 終了条件

段階D完了で停止。push・mainへのマージは行わない。目の高さの修正、ゲームへの新UI導入、新マップ作成は行わない。

確認用8795〜8798は全ポート稼働を確認。停止していない。自分の検証サーバーは8892。各段階の実行ログはローカルのrun-logs/に保持し、コミットには含めない。

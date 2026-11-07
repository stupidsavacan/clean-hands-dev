# クラブ第0段階　警備の調査

対象は主に HITMAN World of Assassination の通常ミッション。人数はプレイヤーと背景の群衆を除き、個別に行動する人物を分母とする。今回は公開資料を照合した。自分でゲームを起動して数えた結果はない。

## 公式資料

- 移植元の公式マニュアルでは、死体や音などで近くの警備が捜索し、姿を見失うと交戦状態から段階的に戻る。標的の身に危険が及ぶと、護衛は標的を安全な場所へ移す。解除後も目撃された服には注意が必要。全マップの人数や新規出現の有無は明記されていない。 [Feral Interactive の公式マニュアル](https://feralinteractive.com/en/manuals/hitman/latest/linux/)
- IO Interactive の修正記録にも、誘導に反応して調べに向かう警備員の例がある。 [Haven Island の修正記録](https://ioi.dk/hidden/h3-patchnotes?panel=hitman%2Fpatch-notes%2F2024%2Fhitman-woa-march-patch-notes)

## 実際に遊んで確かめた資料

|ミッション|警備と全体|根拠と限界|
|---|---:|---|
|The Final Test|制服の警備・兵士41人／46人、約89%|プレイヤーの内訳はキューバ警備14人、ロシア兵27人、士官1人、整備士3人、標的1人。士官は別枠とした。別の投稿は武装者を基準に約85%と報告しており、人数の区分は要再計測。 [内訳の投稿](https://www.reddit.com/r/HiTMAN/comments/obl4g2/is_there_a_list_of_how_many_people_are_in_each/) [46人を集めたプレイ記録](https://www.reddit.com/r/HiTMAN/comments/ti31mj) [武装者の割合を数えた投稿](https://www.reddit.com/r/HiTMAN/comments/ziptxr)|
|Paris・The Showstopper|警備122人という報告。割合は保留|投稿は概数。別資料の民間人306人は群衆を除くが、同じ版と数え方か不明。分母に合算しない。 [プレイヤーの人数報告](https://www.reddit.com/r/HiTMAN/comments/1sbrqgr/do_they_ever_stop_spawning/) [民間人の記載](https://hitman.fandom.com/wiki/The_Showstopper)|

- Hawke’s Bay の Nightcall は、無人の邸宅から始まり、調査後に標的と警備が到着する。警戒度による繰り返しの増援とは条件が異なる。 [Nightcall のプレイ映像](https://www.youtube.com/watch?v=tXzwpKgztkg) [出現条件のプレイヤー報告](https://steamcommunity.com/app/1659040/discussions/0/598513665563444265/)
- Chongqing では、データコア操作で施設が封鎖され、脱出経路が変わる。操作後にマスク姿の警備3人が追加されるとのプレイヤー報告もある。3人は公式の数値ではなく、ここでは再計測していない。 [脱出の攻略記録](https://www.powerpyx.com/hitman-3-chongqing-china-all-challenges-guide/) [追加警備のプレイヤー報告](https://www.reddit.com/r/HiTMAN/comments/1fyds4o)

## Wiki・掲示板から読み取れる警備の動き

- 固定警備は正面入口や区画の境を守る。検査を通るには禁制品を持たずに応じる必要がある。巡回は複数の場所をつなぎ、護衛は標的について移動する。服を見破る役は区域や服によって変わる。 [行動と変装の解説](https://hitman.fandom.com/wiki/World_of_Assassination)
- 民間人が死体や犯罪を見つけると、逃げるか警備に知らせる。近くの警備は持ち場を離れ、現場や最後に見た場所を調べる。姿を確認されると交戦し、見失うと捜索に戻る。気絶した人が起こされる場合もある。 [警戒状態の解説](https://hitman.fandom.com/wiki/Alert_Levels) [気絶者を起こすプレイヤー報告](https://www.reddit.com/r/HiTMAN/comments/1lt884t/)
- 標的の退避、客が現場から逃げること、施設の出口を閉める演出は分けて考える。通常の死体発見だけでマップ全体の客を一斉に避難させ、出口を自動封鎖するという共通仕様は確認できなかった。 [警戒状態の解説](https://hitman.fandom.com/wiki/Alert_Levels) [Chongqing の施設封鎖](https://www.powerpyx.com/hitman-3-chongqing-china-all-challenges-guide/)
- 通常の交戦では既存の警備が寄ってくるという報告がある。通常ミッションでも進行に伴う追加の例があり、シリーズ全体で増援がないとは言えない。Freelancer の開始時に加わる警備や暗殺者も、銃撃に応じた補充とは別に扱う。 [プレイヤーの増援報告](https://steamcommunity.com/app/1659040/discussions/0/598513665563444265/) [Freelancer の配置](https://hitman.fandom.com/wiki/Syndicates)
- 増援がなくても、複数の射線から同時に攻撃され、隠れている間に別の警備が接近すると立て直しづらい。これは配置と捜索からの推論。通常警備の命中率、警備とプレイヤーの体力を比較できる公式数値は確認できなかった。Freelancer の暗殺者が数発でプレイヤーを倒し得るという記述は、通常警備の数値には使わない。 [交戦と捜索の解説](https://hitman.fandom.com/wiki/Alert_Levels) [暗殺者の解説](https://hitman.fandom.com/wiki/Syndicates)

## クラブの案

**警備5人／全34人（約15%）で始める。** 本家の割合を移植した数字ではない。入口検査、フロアの巡回、VIP席の境界、標的の随行を、小さな建物で同時に成立させるための内訳。

|役|人数|通常時|交戦・捜索時|
|---|---:|---|---|
|入口の用心棒|2|1人が検査、1人が列と入口を監視|近い方が現場へ。残りは入口を監視|
|巡回の用心棒|1|フロア・バー前・喫煙所|最寄りの応援として現場へ。目撃が切れたら最後の目撃地点から捜索|
|VIP階段の護衛|1|正面階段の下|VIP席への経路を守る。VIP側の事案なら現場へ|
|標的の護衛|1|投資家に随行。密会時だけ厨房入口で待機|標的に危険が及べば退避を優先|

### ゲーム側の変更案

- クラブ専用の戦闘設定で増援を `waves: 0`、出現位置を空にする。現行の `combat.ts` は警戒度と残り波数で生成を判定する。ホテルと夜会は既存設定を使う。
- 現行の増援専用捜索は `n.reinforcement` が条件。クラブの既存警備は別の割り当てで捜索させる。警戒度3でも全員を一地点に集めず、近い警備と持ち場に残る警備を分ける。最後の目撃が古くなれば持ち場へ戻す。
- 客は現場と射線を避ける。入口を監視する警備は配置するが、自動で出口をすべて閉じず、裏経路から離脱できる案を初回に試す。射撃の命中や体力は、まず既存値で遊んでから判断する。
- 実装時は、警戒度3でも人物が増えないこと、倒れた警備が復活しないこと、持ち場と応援の両方が機能することを確認する。クラブの第1段階には警備や戦闘の変更を入れない。

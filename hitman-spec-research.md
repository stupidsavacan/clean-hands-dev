# HITMAN World of Assassination 仕様調査

調査日: 2026-10-31。対象は現行WoAの通常画面・Campaign/Professionalを基準とする。HITMAN(2016)単体、2002年のHitman 2: Silent Assassin、VR、Freelancer、Sniper Assassinは同じ仕様表に混ぜない。実機による全項目の再現確認は未実施。一次資料で足りない箇所を二次資料と明記して補った。実装変更はしていない。

## 直近更新による重要差分（古い攻略より優先）

[2026-10-29公式3.290](https://ioi.dk/hitman/patch-notes/2026/game-update-3-290)を確認した。以下は通常画面にも関わる新仕様。実機の導入版は未確認。

- Nothing to See Here: 違法品は47の身体、壁、柱等によってNPCから見えなくすれば隠せる。通常画面とVRの双方に適用。したがって「武器を手に出したという状態だけで周囲全員が必ず違法認識する」は現行版の説明にならない。
- Ain’t No Rest in the Closet: 収納容器の中の身体にも、身体の当たり判定へ届く射撃でとどめを刺せる。爆発も収納済み標的へ届く。標的も他の人物同様に収納可能になった。古い攻略の「標的の気絶身体は収納不可」を現行へ転記しない。
- A bird? A plane? A GRENADE!: 生きた手榴弾をNPCが認識・警告・回避する。人前の投擲は敵対行為。
- Weaponized Potassium: 投げたバナナは着地時に滑り罠になる。VRのみ落下/軽い放り投げでも成立するとの区別がある。

## CLEAN HANDSとの比較で誤同定しやすい3項目

1. **公共区域で走行/しゃがみだけで疑惑が常時増えるか**: 今回の一次資料から現行Campaign/Professionalのその一般則は確認できていない。旧作やWikipediaには疑われる記述が混じるが、コミュニティ説明には走行を問題にするのは最上位難易度との説明もあり、資料が衝突する。Masterの足音感度上昇と「公共でしゃがむだけで認識ゲージが増える」は別。比較表は「同一仕様と確認できず/実機検証要」とすべき。
2. **スパナを疑わしい道具とし職種で許可するか**: 現行H3のHandyman WrenchはWiki属性でIllegal Item: No、Frisk Hidden: Yes。H3攻略でもcrowbar/wrench/screwdriverは携行合法と明記される。少なくとも通常スパナの職種別携行許可をWoA共通則として説明する根拠はない。「道具の使用による破壊工作が違法」と「持つことが違法」を分ける。[二次: Handyman Wrench](https://hitman.fandom.com/wiki/Handyman_Wrench)、[二次: Wccftech H3ガイド](https://wccftech.com/hitman-3-guide-5-tips-and-tricks-turn-you-into-a-silent-assassin/)
3. **制服を問わず手に銃を出すと違法か**: 公式2016マニュアルは警備制服で公然武装できると記し、WoAのH2/III変装一覧でも銃携行許可（狙撃銃を除く）を区別する。よって「制服は背負いだけ許可、手に持つと全部違法」をHITMANの確認済み仕様とは言えない。ただし「手持ち」「照準操作」「照準をNPCへ向ける」を完全に切り分けた現行公式資料は未確保。人的威嚇と単なる手持ちの境界は未確定として実機検証を推奨する。[2016一次](https://www.feralinteractive.com/en/manuals/hitman/latest/linux/)、[二次: List of disguises](https://hitman.fandom.com/wiki/List_of_disguises)

## 資料の扱い

- IOIの[現行機能紹介](https://ioi.dk/hitman/game-features)は変装・環境操作・準備・XP解放の一次資料。
- Feral Interactiveの[公式移植版マニュアル](https://www.feralinteractive.com/en/manuals/hitman/latest/linux/)はHITMAN(2016)の資料。基本操作の確認に有用だが、現行WoAの細部や更新後の判定を単独では確定できない。
- [3.240.3公式パッチノート](https://ioi.dk/hitman/patch-notes/2025/game-update-3-240-3)は2025-10-30。目撃者とSA、NPCルーチン、遠距離射撃の認識修正の明確な一次根拠。
- Hitman Wikiはシリーズの複数作品を同一記事に収録する二次資料。以下ではWoA/HITMAN 2/HITMAN IIIの節を対象にする。検索エンジンの抽出本文を確認できたが、一部ページの直接取得は402/制限エラーだった。完全な現行実機検証の代替にはならない。

## 移動・カメラ・Instinct

歩行、走行、しゃがみ、カバー、低い障害物の乗り越え、梯子・縁へのアクションがあり、通常操作には肩越しカメラの左右切替もある。2016公式マニュアルのControls/Stealthで確認できる。現行版のキー割当は設定・機種ごとに確認すべきで、2016 Linux既定キーを現行共通仕様として写さない。[公式マニュアル](https://www.feralinteractive.com/en/manuals/hitman/latest/linux/)

Instinctは対象・人物・操作物を視覚的に判別する情報機能で、変装そのものの代わりにはならない。2016マニュアルでは標的は赤、操作物は黄、犯罪目撃者は橙、一般NPCは白、警戒要因を持つ人物は頭上の白点で示す。現行版の表示オプション/モード差に注意する。[公式マニュアル](https://www.feralinteractive.com/en/manuals/hitman/latest/linux/)

未確認: 現行版全機種の移動速度、加速度、FOV、カメラ補間時間、Instinct対象の全距離制限、遮蔽物判定の内部数式。数値は公開仕様として置かない。

## 変装・エリア・Enforcer・疑惑

変装は見た目だけでなく、区域への立入権限と、携行物・業務動作の合法性に関わる。区域は公開区域/許可の要る区域で構成され、Trespassingでは警備に退去誘導され得るが、Hostile Areaでは発見時に攻撃される。権限は区域×変装×シナリオ状況の関係で、同じ制服のNPCが立つ区域へ47も常に入れるわけではない。イベントで立入条件が変わる場合もある。[二次: World of Assassination](https://hitman.fandom.com/wiki/World_of_Assassination)

Enforcerはその変装を見破る人物で、白点で識別できる。警備員だけに限らない。白点はエンフォーサー/目撃等の認識上の脅威を示すので、全員が同じ役割・遷移を持つものとして扱わない。視線が続くと疑いが進み、接近・追尾、民間人なら警備への報告、警備なら対応に進む。Blend Inの専用行動は見破り回避に使えるが、既に犯罪を認識された状態を無条件で消す機能ではない。[二次: NPC](https://hitman.fandom.com/wiki/NPC)

Trespassing/Hostile Areaは「場所への権限」、Searching/Hunted/Combat等は「警戒状態」で、別の軸として扱うのが妥当。疑惑の秒数・距離・増加曲線は難易度・NPC・行動に依存し、調査資料から共通定数を確定できない。[二次: Alert Levels](https://hitman.fandom.com/wiki/Alert_Levels)

## 目撃者・通報・警備連絡

民間の犯罪目撃者は警備へ走って報告し、警備が容姿を把握すると追跡につながる。Searchingは事件が知られたが犯人未確定、Compromisedは容姿を認識する目撃者が存在、Huntedは警備が容姿を得て追跡、Combatは攻撃中という区別がある。時間経過で追跡が弱まっても、既知の容姿が即座に完全消去されるとは限らない。[二次: Alert Levels](https://hitman.fandom.com/wiki/Alert_Levels)

重要: 「現在の目撃者状態の除去」と「Silent Assassin評価の回復」は同じではない。IOIは3.240.3で、気絶中の目撃者の頭に鈍器を投げるとwitness statusを取り除けるがSAは戻らず、収納容器に隠した場合と同等と明記した。単に目撃者を気絶させる/収納するだけで過去の発覚をなかったことにはできない。[一次: Forget Me Now](https://ioi.dk/hitman/patch-notes/2025/game-update-3-240-3)

警備無線の存在から「全NPCが瞬間に全情報共有する」と推定しない。無線連絡の正確な範囲・所要時間、誰に容姿が伝わるかの完全な内部アルゴリズムは本調査では確定できていない。

## 監視カメラ・録画・溶け込み・群衆

カメラは犯罪行為がなくても47を録画し、録画が残るとSA条件に関わる。違法行為を録画されると警備が反応するため、「普通に通るだけの録画」と「犯罪認識」は別。Professional/MasterにはカメラがあるがCasualではない。[二次: Security Camera](https://hitman.fandom.com/wiki/Security_Camera)、[二次: Difficulty Level](https://hitman.fandom.com/wiki/Difficulty_Level)

録画機への操作/破壊で録画証拠を消すことができる。現行では録画機の1台を無効化するとマップ内のカメラ全体も停止するという説明が広く一致するが、この全域連動について一次資料は今回確保できていない。2016初期版の分離ネットワークの記述を現行版へ持ち込まない。[補助的二次: 録画機に関するSteam議論](https://steamcommunity.com/app/1659040/discussions/0/3770111882046421571/)、[補助的二次: 旧監視構成を復元するModの説明](https://www.nexusmods.com/hitman3/mods/860)

群衆隠れはHITMAN 2で追加。ディレクターJacob Mikkelsenが、群衆を使いEnforcerの視線を切り、警備が群衆内を捜す仕組みと説明している。これは単なる背景装飾ではない。一方、群衆NPCと個別ルーチンを持つNPCの能力を同一としない。[開発者インタビュー一次発言: GamesBeat](https://gamesbeat.com/hitman-2-gives-players-more-information-and-bigger-crowds-to-hide-in/)

未確認: 群衆成立に必要な人数、半径、茂みの成立形状・姿勢条件、戦闘時の全例外。固定数値は出さない。

## 道具・投擲・近接・気絶・身体収納・検問・ワイヤー

道具は合法性と殺傷性を分ける必要がある。同じ所持品でも変装によって公然携行が許可される場合があり、投擲は弧線表示と人物へのロックを持つ。近接物は殺傷/非殺傷が区別され、素手は気絶と首折りが別操作。身体は引きずって移動し、容器に隠せる。[2016一次: Items/Combat/Silent Attacks](https://www.feralinteractive.com/en/manuals/hitman/latest/linux/)

気絶身体は発見されると起こされ得る。専用収納は発見防止に使えるが、公開された位置への置き去りと同義ではない。通常の収納箱/ロッカーの容量は多くが2人で、47自身の隠れ場所とも競合するが、全オブジェクトを2人固定と決めつけない。[2016一次: Hiding bodies](https://www.feralinteractive.com/en/manuals/hitman/latest/linux/)、[二次: NPC](https://hitman.fandom.com/wiki/NPC)

検問は区域侵入権限とは別の武器検査で、現行WoAでは違法携行品があるとfrisk開始自体が許されない。通常のホルスターやブリーフケースへの収納と、検問を通れる性質は別物。[二次: Frisking](https://hitman.fandom.com/wiki/Frisking)

Fiber Wireは非違法・隠匿可能・frisk非検出とされる専用殺傷道具。後方から使用する。刃物や拳銃の「見えなければ良い」と同じ分類に置かない。[二次/ゲーム内属性の整理: Fiber Wire](https://hitman.fandom.com/wiki/Fiber_Wire)

注意: 2025-10-30の公式パッチは新聞の動作を気絶ではなくknockdownへ意図的変更したと記す。鈍器一般を「必ず即気絶」に統一するのは現行仕様と一致しない。[一次: Read All About It](https://ioi.dk/hitman/patch-notes/2025/game-update-3-240-3)

## 銃携行・戦闘・捜索・離脱

警備制服には多くの銃の公然携行許可がある。しかし「制服だから全武器合法」ではなく、H2/IIIの変装一覧はsniper riflesを例外としている。長物は背負っても見えなくなるわけではなく、ブリーフケースは1品を隠す別手段。狙撃銃の合法性にはマップ/変装/過去の不具合の例外報告があり、「全場面で絶対違法」という普遍命題は避ける。[二次: List of disguises](https://hitman.fandom.com/wiki/List_of_disguises)、[二次: Rifle Case](https://hitman.fandom.com/wiki/Rifle_Case_%28Hitman_3%29)、[例外報告: Ambrose/The Icon](https://www.hitmanforum.com/t/why-is-a-sniper-rifle-legal-to-carry-as-a-guard-now/15705)

発砲・着弾・死体・不審物などが警備反応を誘発し、戦闘では遮蔽・接近・迂回等の対応を受ける。視線を切り安全な場所へ退くとCombat→Hunted等へ弱まるが、固定時間ですべて正常化する単一タイマーでは説明できない。増援が無限に外部から生成されるか、配置警備の再配置かについて本調査では普遍仕様を確定していない。[二次: NPC](https://hitman.fandom.com/wiki/NPC)、[二次: Alert Levels](https://hitman.fandom.com/wiki/Alert_Levels)

未発見の射撃位置をNPCが不当に47に結びつける問題は、3.240.3のPsychicで修正対象になった。「遠距離から誰にも見られず撃っても必ず正体が割れる」は仕様化しない。[一次](https://ioi.dk/hitman/patch-notes/2025/game-update-3-240-3)

## NPCルーチン・Mission Stories・事故・毒

NPCは決められた活動や移動を繰り返すが、時間順に全イベントを必ず再生するだけではない。開発者は人物同士が揃った際の会話など、条件が満たされた際に進み、47の介入で条件が崩れても継続する設計と説明している。各人物の全行動表はマップ固有である。[開発者インタビュー](https://gamesbeat.com/hitman-2-gives-players-more-information-and-bigger-crowds-to-hide-in/)

Mission Stories（2016でOpportunities）は任意の誘導経路で、暗殺だけでなく変装/道具取得に導く場合もある。会話・イベント・物の調査から発見し追跡でき、Full/Minimal/Offの案内設定がある。Masterでは案内なし。全ミッションに用意されるわけではない。[二次: Mission Stories](https://hitman.fandom.com/wiki/Mission_Stories)

事故死と致死毒は、標的の死体が発見されても通常SAを失わせない。ただし毒はContracts/Escalationsの方法指定で事故と同じ分類ではない。殺害/毒投入を直接見られる、対象外を死なせる、死体を移動後に発見される等は別問題で、「事故/毒なら常に無罪」ではない。[二次: Staged Accident](https://hitman.fandom.com/wiki/Staged_Accident)

鎮静は特に注意。非標的の鎮静毒/一部事故気絶には発見時のSA例外がある一方、標的の気絶死体には異なる判定がある。致死毒と鎮静毒、標的と非標的、銃・注射・飲食・環境気絶を一括扱いせず、比較に必要な具体ケースのみ実機で補足検証すべき。[二次: Silent Assassin](https://hitman.fandom.com/wiki/Difficulty_Level/Silent_Assassin)、[補助的二次: 鎮静のケース差](https://www.hitmanforum.com/t/get-your-sedatives-straight-ioi/17895)

## 準備・出口・採点・保存・熟練度

開始位置、開始変装、武器/道具、搬入位置などを準備し、反復プレイのチャレンジとXPで装備や開始地点が解放される。これは現行IOI紹介でも確認できる。[一次: Game Features](https://ioi.dk/hitman/game-features)

ミッションは標的排除だけでなく固有の追加目標と脱出を含む。全出口が最初から同じ条件で利用可能とは限らず、鍵・装備・イベント等の条件はミッション固有。全出口条件の一覧は未調査。

通常CampaignのSAは大枠で標的だけ殺す、犯罪を見られない、評価に数える死体を発見されない、録画を残さないこと。単なるクリア可否、現在の警戒、チャレンジ達成、SA、時間を含む最終得点は別。標的だけが認識した場合など回復可能なケースがあるが、非標的目撃者を殺してもSAは戻らず非標的殺害も加わる。[二次: Silent Assassin](https://hitman.fandom.com/wiki/Difficulty_Level/Silent_Assassin)、[一次: 目撃状態を消してもSAが戻らない](https://ioi.dk/hitman/patch-notes/2025/game-update-3-240-3)

難易度差（Campaign基準、二次資料で確認）:

|難易度|主な差|
|---|---|
|Casual|無制限保存、案内あり、監視カメラなし、Enforcer少、音への反応が寛容|
|Professional|無制限保存、案内あり、監視カメラあり、違法行為のカメラ認識に警備反応|
|Master|1ミッション保存1回・自動保存なし、案内なし、追加監視/Enforcer、音への感度上昇、血の出る殺害で変装が使用不能|

[二次: Difficulty Level](https://hitman.fandom.com/wiki/Difficulty_Level)、[独立した二次確認: Gamepressure](https://www.gamepressure.com/hitman-iii/difficulty-levels/z7e10a)

モード差:

- Freelancerは拠点・装備管理・ローグライクな連続Campaignを持ち、通常CampaignのSA評価を常時成功条件にするものではない。SA系は報酬/Prestige目標に登場する。任務中の任意保存は不可。[一次: Game Modes](https://ioi.dk/hitman/game-modes)、[一次: 2023 May SA目標報酬調整](https://ioi.dk/hitman/patch-notes/2023/hitman-woa-may-patch-notes)、[二次: Freelancer](https://hitman.fandom.com/wiki/Freelancer)
- Elusive Targetは期間内の1回性、HUD/Instinct情報制限等を持つ。Escalationsには変装条件や追加カメラ等の独自制約、Contractsはプレイヤー指定標的/方法、Sniper Assassinは固定狙撃任務で別採点を持つ。[一次: Game Modes](https://ioi.dk/hitman/game-modes)
- 現行情報で特に重要: 2026年のSpecial AssignmentsはCampaign形式で任意保存/読込とオフラインが可能。元のET/Arcadeと同じ保存仕様にしてはいけない。Arcade失敗後待機は2025-10-30に12時間から30分へ変更済み。Game Modesページには12時間が残るが、日付の新しい公式パッチと2026 roadmapを優先する。[一次: 3.240.3](https://ioi.dk/hitman/patch-notes/2025/game-update-3-240-3)、[一次: Season of the Herbalist 2026](https://ioi.dk/hitman/roadmaps/2026/season-of-the-herbalist)

## 比較時に数値を発明しない項目

視野角/視距離、疑惑の蓄積秒数、しゃがみ/走行速度、聴覚半径、各武器ダメージ、警備無線の伝播秒数、捜索半径/継続時間、NPC周期、気絶自動回復の全条件、弾薬精度や増援上限は、上の資料から共通値として確定できない。これらをCLEAN HANDS実装の定数と並べる場合は「HITMANは未確認/非公開」とする。ゲーム内の既知の個別例を全マップ・全難易度へ一般化しない。

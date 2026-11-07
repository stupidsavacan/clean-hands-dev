# HITMAN の UI の調べ（2026-11-06）

公式の説明ページは見つからず、攻略記事・パッチノート・フォーラムからの情報です。CLEAN HANDS では配置と情報の出し方だけを取り入れました。HITMAN の絵柄・ロゴ・書体は真似せず、CLEAN HANDS の色と文字を使っています。

## 分かったこと

| 要素 | HITMAN（調べた範囲） | 出典 |
|---|---|---|
| 小さな地図 | 画面の左下 | GamesRadar |
| 状態の表示 | 地図の下。立入禁止（黄）・敵対区域・捜索・正体がばれた・追跡・戦闘 | GamesRadar、Red Bull、IGN |
| 疑いのゲージ | 左下、体力の右。特定の人の近くで赤くなる | speedrun.com の解説 |
| 疑われ始めた時 | 画面の真ん中に黄色の印、満ちると見つかる | gamepressure（Stealth） |
| Silent Assassin の印 | 地図の横。3段階（取れる・録画を消せば取れる・取れない＝赤い枠） | 2021年2月パッチノート（IOI） |
| 変装を見破る人 | 頭の上と地図に白い点 | gamepressure、Games Learning Society |
| Instinct | 標的は赤、人は白、使える物は黄色 | gamepressure（Map exploration） |
| 操作の案内 | 物の近くにボタンと言葉。違法な行動を長押しすると赤い輪 | Nexus Mods の HUD 改造の説明 |

## CLEAN HANDS の HUD（`app/src/hud.ts`、`app/src/engine/game.ts`）

- 左下：四角い地図。その下に状態の札を、重い順に4つまで出します。
  - 戦闘・追跡されている・変装がばれた・敵対区域・立入禁止・捜索中。
  - 主人公自身の状態として、銃を構えている・違法な物が見えている・この服では怪しい物・カメラに映っている・隠れている・溶け込んでいる・人混みに紛れている。
- 地図の右：今いる階と区画、変装、行ける区域、疑いのゲージ（誰が見ているか）、体力。
- 地図の右上：GHOST の印（取れる＝白・録画を消せば取れる＝黄・取れない＝赤）。
- 右下：手に持っている物、背中の刀、ケースの中身、コイン。銃と弾数はその上に出ます。
- 画面の中央：疑い始めた人の方向に向けた印。疑いが増えると開いて濃くなり、警戒されると赤くなります。
- 操作の案内：キーを四角で囲み、横に言葉を出します。長押しはキーの周りの輪で示し、犯罪になる操作は赤くします。
- 上の真ん中の警報の帯は、状態の札と同じ内容なのでやめました。画面の端が赤くなる演出は残しています。

## メニュー・作戦準備・持ち物（同じ日の続き）

| 要素 | HITMAN（調べた範囲） | 出典 |
|---|---|---|
| 作戦準備の装備 | 道具の枠が2つ、最初の武器（銃）を選べる。隠せる近接の道具は道具の枠にしか入らない | NME、Steam の議論 |
| 開始地点・持ち込み | 一度遊んだ後、開始地点を選べる。現地へ物を持ち込める（密輸） | NME |
| スーツ | 作戦準備画面で選ぶ。種類ごとに分かれている | Hitman Forum |
| 前回の装備 | 覚えている | Hitman Forum |
| 持ち物 | 一覧を開いて選ぶ。速く切り替えるキーはない。大きい銃以外は、ほとんど何でもしまえる | Steam の議論、gamepressure（Beginner's Guide） |
| 一時停止・結果 | 細かい資料は見つからなかった。評価名と統計を出す形に合わせた | — |

CLEAN HANDS で作った物：
- **作戦準備**：左に標的の説明、右に装備の枠を並べます。枠は、開始地点・スーツ・銃（身につける）・道具1・道具2・いつも持つ（ワイヤー）・持ち込み（隠し場所に置く銃と場所）です。枠を押すと、選択肢がカードで出ます。道具1と道具2に同じ物は選べません。前回の装備を覚えます（ブラウザに保存）。
- **一時停止**：左にメニュー（続ける・地図・操作・姿を変える・最初からやり直す・作戦準備へ）、右に目標・今の状況・持ち込んだ物を出します。
- **結果**：上に評価と題、左に点数の内訳、右に統計を並べます。
- **持ち物**：
  - 小さい物はポケットにしまえます（見えないので怪しまれないが、検査では見つかる）。ブリーフケース・刀・モップ・トレイは大きくてしまえません。刀は背中に背負います。
  - 選び方は3つあります。マウスホイールで画面下の列を動かし0.7秒止まると持ち替える、数字キー1〜9で直接選ぶ、iPad では道具ボタン「持ち物」（O）。
  - 物を拾う時、手の小さい物はポケットへ、刀は背中へ行きます。大きい物はその場に置きます。

画像：[作戦準備](ui-planning-20261106.jpg)・[一時停止](ui-pause-20261106.jpg)・[持ち物の列](ui-inventory-20261106.jpg)

## 出典

- [GamesRadar: Hitman 3 tips](https://gamesradar.com/hitman-3-tips)
- [Red Bull: Hitman 3 tips guide](https://www.redbull.com/gb-en/hitman-3-tips-guide)
- [IGN Hitman 3 wiki（ミラー）](https://destructoidmod.netlify.app/host-https-www.ign.com/wikis/hitman-3/17_Essential_Tips_and_Tricks_for_Getting_Started)
- [gamepressure: Stealth Guide](https://www.gamepressure.com/hitman-iii/stealth/zde21e)
- [gamepressure: Map Exploration](https://www.gamepressure.com/hitman-iii/map-exploration/z9e220)
- [IOI: February 2021 patch notes](https://ioi.dk/hitman/patch-notes/2021/february-patch-notes)
- [speedrun.com: Silent Assassin requirements](https://www.speedrun.com/hitman3/guides/a9zd9)
- [Nexus Mods: HUD mod](https://www.nexusmods.com/hitman3/mods/994)
- [Games Learning Society: white dots](https://www.gameslearningsociety.org/wiki/what-do-the-white-dots-mean-in-hitman-3/)
- [NME: Hitman III essential tips](https://www.nme.com/guides/hitman-iii-guide-essential-tips-before-playing-the-game-2866739)
- [Steam: Hitman 2 loadout slots discussion](https://steamcommunity.com/app/863550/discussions/0/1742226629874493820)
- [Hitman Forum: List of new things in HITMAN 3](https://www.hitmanforum.com/t/list-of-new-things-in-hitman-3/613)
- [Steam: switching weapons discussion](https://steamcommunity.com/app/863550/discussions/0/1739974199626809108)
- [gamepressure: Beginner's Guide](https://www.gamepressure.com/hitman-iii/stealth/z0e07d)

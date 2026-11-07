# 武器モデル194項目のチェックリスト

2026-11-05。Claude が作った。元：`HITMAN_WoA_武器モデル_194項目_武器種別詳細追加版.csv`。

**作り方の決まり**
- 一覧の名前付きの銃（ICA19、Bartoli、Jaeger 7 など）は、原作のデザインです。同じ形は作りません。
- 代わりに、詳細区分ごとに一般形のモデルを1つ作り、その区分の行はすべてそのモデルで表します。
- 色違い・装飾仕様（Gold、Chrome、Ornamental など）は、形が同じなので、同じモデルの色替えで足ります。色替えはまだ作っていません。

簡易版：🆕1・🆕2 の8丁は、M5.5 の拳銃と同じ細かさの簡易版も `assets/guns-simple` にある（同じ ID、2026-11-06）。

記号：✅ 前からある　🆕1 第1弾（2026-11-06 に作り込み版へ作り直し）　🆕2 第2弾（作り込み版）　⬜ まだ無い

合計：✅ 86行　🆕1 62行　🆕2 18行　⬜ 28行（全 194行）

## 近接・投擲武器（23行）

| 行 | 名前 | 詳細区分 | 当てるモデル | 状態 |
|---:|---|---|---|:---:|
| 1 | ハンマー | 工具・鈍器 | `hammer`（assets/items） | ✅ |
| 2 | レンチ | 工具・鈍器 | `wrench`（assets/items） | ✅ |
| 3 | バール | 工具・鈍器 | `crowbar`（assets/items） | ✅ |
| 4 | レンガ | 投擲可能な鈍器 | `brick`（assets/items） | ✅ |
| 5 | ソーダ缶 | 缶・即席鈍器 | — | ⬜ |
| 6 | 魚 | 食材・即席鈍器 | — | ⬜ |
| 7 | フライパン | 調理器具・鈍器 | `frying_pan`（assets/items） | ✅ |
| 8 | 丸めた新聞 | 新聞・即席鈍器 | — | ⬜ |
| 9 | ブルーベリーマフィン | 食品・即席武器 | — | ⬜ |
| 10 | バナナ | 食品・転倒用アイテム | — | ⬜ |
| 11 | 金塊 | 金属製鈍器 | — | ⬜ |
| 12 | 小型金塊 | 小型金属製武器 | — | ⬜ |
| 13 | ビリヤード球 | 球状鈍器 | — | ⬜ |
| 14 | ココナッツ | 果実・即席鈍器 | — | ⬜ |
| 15 | 雪玉 | 雪玉・消失型投擲物 | — | ⬜ |
| 16 | 野球ボール | 球状鈍器 | — | ⬜ |
| 17 | シャベル | 工具・長柄鈍器 | — | ⬜ |
| 18 | パドル | 長柄鈍器 | — | ⬜ |
| 19 | 鉛管 | 金属製鈍器 | — | ⬜ |
| 20 | 小包 | 小包・即席鈍器 | — | ⬜ |
| 189 | 刀（Katana） | 刀・刃物 | — | ⬜ |
| 190 | Kali Sticks | 二本組の棒状鈍器 | — | ⬜ |
| 191 | ナイフ（小型刃物類の例） | ナイフ・小型刃物 | `kitchen_knife`（assets/items） | ✅ |

## 収納ケース兼近接武器（2行）

| 行 | 名前 | 詳細区分 | 当てるモデル | 状態 |
|---:|---|---|---|:---:|
| 21 | ブリーフケース | ブリーフケース | — | ⬜ |
| 22 | 工具箱型ケース | 工具箱型ケース | — | ⬜ |

## 拳銃（ピストル）（62行）

| 行 | 名前 | 詳細区分 | 当てるモデル | 状態 |
|---:|---|---|---|:---:|
| 23 | "El Matador" | 高威力型拳銃 | `revolver`（assets/guns） | 🆕2 |
| 24 | "Rude Ruby" | 通常型拳銃（Bartoli 75系列） | `pistol_guard`（assets/m55-combat） | ✅ |
| 25 | Aircrush 73 | エアピストル | — | ⬜ |
| 26 | Assassin's HWK21 Covert | 消音型拳銃 | `pistol_silenced`（assets/m55-combat） | ✅ |
| 27 | Bartoli 75R | 通常型拳銃（Bartoli 75系列） | `pistol_guard`（assets/m55-combat） | ✅ |
| 28 | Bartoli 75S | 通常型拳銃（Bartoli 75系列） | `pistol_guard`（assets/m55-combat） | ✅ |
| 29 | Bartoli 75S "Lucky Knight" | 消音型拳銃 | `pistol_silenced`（assets/m55-combat） | ✅ |
| 30 | Collector's Kalmer Sedative Edition | 鎮静ダーツ銃 | `tranq_pistol`（assets/guns） | 🆕2 |
| 31 | Collector's Sieker Emetic Edition | 催吐ダーツ銃 | `tranq_pistol`（assets/guns） | 🆕2 |
| 32 | Concept 5 | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 33 | Custom 5mm | 小型5mm拳銃 | — | ⬜ |
| 34 | Custom 5mm DTI | 小型5mm拳銃 | — | ⬜ |
| 35 | Hackl 9R | 通常型拳銃（HWK/Hackl系列） | `pistol_guard`（assets/m55-combat） | ✅ |
| 36 | Hackl 9S | 通常型拳銃（HWK/Hackl系列） | `pistol_guard`（assets/m55-combat） | ✅ |
| 37 | Hackl 9S Covert | 消音型拳銃 | `pistol_silenced`（assets/m55-combat） | ✅ |
| 38 | HWK21 | 通常型拳銃（HWK/Hackl系列） | `pistol_guard`（assets/m55-combat） | ✅ |
| 39 | HWK21 Covert | 消音型拳銃 | `pistol_silenced`（assets/m55-combat） | ✅ |
| 40 | HWK21 Mk II | 通常型拳銃（HWK/Hackl系列） | `pistol_guard`（assets/m55-combat） | ✅ |
| 41 | HWK21 Pale | 通常型拳銃（HWK/Hackl系列） | `pistol_guard`（assets/m55-combat） | ✅ |
| 42 | HWK21 Pale Homemade Silencer | 消音型拳銃 | `pistol_silenced`（assets/m55-combat） | ✅ |
| 43 | ICA DTI Stealth | 消音型拳銃 | `pistol_silenced`（assets/m55-combat） | ✅ |
| 44 | ICA19 | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 45 | ICA19 Black Lily | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 46 | ICA19 Black Trinity | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 47 | ICA19 Chrome | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 48 | ICA19 Classicballer | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 49 | ICA19 F/A | フルオート式拳銃 | `machine_pistol`（assets/guns） | 🆕2 |
| 50 | ICA19 F/A Stealth | フルオート式拳銃 | `machine_pistol`（assets/guns） | 🆕2 |
| 51 | ICA19 F/A Stealth "Ducky" Edition | フルオート式拳銃 | `machine_pistol`（assets/guns） | 🆕2 |
| 52 | ICA19 Goldballer | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 53 | ICA19 Iceballer | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 54 | ICA19 Red Trinity | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 55 | ICA19 Shortballer | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 56 | ICA19 Silverballer | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 57 | ICA19 Silverballer Mk II | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 58 | ICA19 White Trinity | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 59 | Kalmer 1 - Tranquilizer | 鎮静ダーツ銃 | `tranq_pistol`（assets/guns） | 🆕2 |
| 60 | Kalmer 2 - Tranquilizer | 鎮静ダーツ銃 | `tranq_pistol`（assets/guns） | 🆕2 |
| 61 | Kalmer 3 - Cure Gun | 治療用ダーツ銃 | `tranq_pistol`（assets/guns） | 🆕2 |
| 62 | Krugermeier 2-2 | 静音型拳銃（Krugermeier系列） | `pistol_silenced`（assets/m55-combat） | ✅ |
| 63 | Krugermeier 2-2 Dark | 静音型拳銃（Krugermeier系列） | `pistol_silenced`（assets/m55-combat） | ✅ |
| 64 | Krugermeier 2-2 Silver | 静音型拳銃（Krugermeier系列） | `pistol_silenced`（assets/m55-combat） | ✅ |
| 65 | Sieker 1 | 催吐ダーツ銃 | `tranq_pistol`（assets/guns） | 🆕2 |
| 66 | Striker | 高威力型拳銃 | `revolver`（assets/guns） | 🆕2 |
| 67 | Striker V3 | 高威力型拳銃 | `revolver`（assets/guns） | 🆕2 |
| 68 | The Ancestral Pistol | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 69 | The Banker Silenced Pistol | 消音型拳銃 | `pistol_silenced`（assets/m55-combat） | ✅ |
| 70 | The Cherry Blossom Baller | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 71 | The Concrete Bunny Pistol | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 72 | The Ducky Gun | 小型5mm拳銃 | — | ⬜ |
| 73 | The Floral Baller | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 74 | The Ornamental Pistol | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 75 | The Prank Pistol | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 76 | The Purple Streak ICA19 Classic Baller | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 77 | The Scrap Gun | 小型5mm拳銃 | — | ⬜ |
| 78 | The Serpent's Tongue | 眩惑ダーツ銃（小型クロスボウ型） | — | ⬜ |
| 79 | The Taunton Dart Gun | 鎮静ダーツ銃 | `tranq_pistol`（assets/guns） | 🆕2 |
| 80 | ICA19 Spider Lily | ICA19系列拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 81 | The Smoke | 特殊仕様の拳銃 | — | ⬜ |
| 82 | Sweet Pea Baller | 通常型・装飾型拳銃 | `pistol_guard`（assets/m55-combat） | ✅ |
| 83 | Redline | フルオート式拳銃 | `machine_pistol`（assets/guns） | 🆕2 |
| 84 | 荒野のハゲワシ | 高威力型拳銃 | `revolver`（assets/guns） | 🆕2 |

## サブマシンガン（SMG）（24行）

| 行 | 名前 | 詳細区分 | 当てるモデル | 状態 |
|---:|---|---|---|:---:|
| 85 | Brine-Damaged SMG | 小型・片手持ち型（DAK系） | `compact_smg`（assets/guns） | 🆕1 |
| 86 | DAK Black Covert | DAK系・両手持ち型 | `smg`（assets/m55-combat） | ✅ |
| 87 | DAK DTI | 小型・片手持ち型（DAK系） | `compact_smg`（assets/guns） | 🆕1 |
| 88 | DAK X2 | 小型・片手持ち型（DAK系） | `compact_smg`（assets/guns） | 🆕1 |
| 89 | DAK X2 Covert | 小型・片手持ち型（DAK系） | `compact_smg`（assets/guns） | 🆕1 |
| 90 | DAK X2 Covert Special | 小型・片手持ち型（DAK系） | `compact_smg`（assets/guns） | 🆕1 |
| 91 | Slapdash SMG | 小型・片手持ち型（DAK系） | `compact_smg`（assets/guns） | 🆕1 |
| 92 | The Scrap SMG | 小型・片手持ち型（DAK系） | `compact_smg`（assets/guns） | 🆕1 |
| 93 | DAK Gold Covert | DAK系・両手持ち型 | `smg`（assets/m55-combat） | ✅ |
| 94 | HX-10 | 大型・両手持ち型（HX系列） | `smg`（assets/m55-combat） | ✅ |
| 95 | HX-7 | 大型・両手持ち型（HX系列） | `smg`（assets/m55-combat） | ✅ |
| 96 | HX-7 Covert | 大型・両手持ち型（HX系列） | `smg`（assets/m55-combat） | ✅ |
| 97 | ICA SMG Raptor | 大型・両手持ち型（Raptor系列） | `smg`（assets/m55-combat） | ✅ |
| 98 | ICA SMG Raptor Covert | 大型・両手持ち型（Raptor系列） | `smg`（assets/m55-combat） | ✅ |
| 99 | ICA SMG White Raptor Covert | 大型・両手持ち型（Raptor系列） | `smg`（assets/m55-combat） | ✅ |
| 100 | Militia-Issued HX-10 SMG | 大型・両手持ち型（HX系列） | `smg`（assets/m55-combat） | ✅ |
| 101 | SMG Raptor Rude Ruby Covert | 大型・両手持ち型（Raptor系列） | `smg`（assets/m55-combat） | ✅ |
| 102 | TAC-SMG | 大型・両手持ち型（TAC系列） | `smg`（assets/m55-combat） | ✅ |
| 103 | TAC-SMG Covert | 大型・両手持ち型（TAC系列） | `smg`（assets/m55-combat） | ✅ |
| 104 | TAC-SMG Mk II | 大型・両手持ち型（TAC系列） | `smg`（assets/m55-combat） | ✅ |
| 105 | TAC-SMG S | 大型・両手持ち型（TAC系列） | `smg`（assets/m55-combat） | ✅ |
| 106 | The Ornamental SMG | 大型・両手持ち型 | `smg`（assets/m55-combat） | ✅ |
| 107 | The Shark SMG | 大型・両手持ち型 | `smg`（assets/m55-combat） | ✅ |
| 108 | The Splitter SMG | 大型・両手持ち型 | `smg`（assets/m55-combat） | ✅ |

## アサルトライフル（22行）

| 行 | 名前 | 詳細区分 | 当てるモデル | 状態 |
|---:|---|---|---|:---:|
| 109 | Fusil G1-4 | Fusil系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 110 | Fusil G1-4/C | Fusil系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 111 | Fusil G2 | Fusil系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 112 | Fusil X2000 | Fusil系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 113 | RS-15 | RS系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 114 | Shashka A33 | Shashka系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 115 | Shashka A33 Covert | Shashka系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 116 | Shashka A33 Gold | Shashka系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 117 | Shashka A33 H | Shashka系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 118 | Sieger AR552 Tactical | Sieger AR系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 119 | TAC-4 AR Auto | TAC-4系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 120 | TAC-4 AR Auto Mk II | TAC-4系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 121 | TAC-4 AR Desert | TAC-4系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 122 | TAC-4 AR Stealth | TAC-4系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 123 | TAC-4 S/A | TAC-4系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 124 | TAC-4 S/A Jungle | TAC-4系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 125 | The Ancestral Assault Rifle | 装飾型・特殊外観型 | `rifle_npc`（assets/m55-combat） | ✅ |
| 126 | The Concrete Assault Rifle | 装飾型・特殊外観型 | `rifle_npc`（assets/m55-combat） | ✅ |
| 127 | The Makeshift Scrap Assault Rifle | 装飾型・特殊外観型 | `rifle_npc`（assets/m55-combat） | ✅ |
| 128 | The Ornamental Assault Rifle | 装飾型・特殊外観型 | `rifle_npc`（assets/m55-combat） | ✅ |
| 129 | The Shashka Beast | Shashka系列 | `rifle_npc`（assets/m55-combat） | ✅ |
| 130 | タックンイエロー | 装飾型・特殊外観型 | `rifle_npc`（assets/m55-combat） | ✅ |

## ショットガン（22行）

| 行 | 名前 | 詳細区分 | 当てるモデル | 状態 |
|---:|---|---|---|:---:|
| 131 | Bartoli 12G | 通常携行型（Bartoli系列） | `shotgun`（assets/guns） | 🆕1 |
| 132 | Bartoli 12G Short | 通常携行型・短銃身（Bartoli 12G系列） | `shotgun_short`（assets/guns） | 🆕1 |
| 133 | Bartoli 12G Short H | 通常携行型・短銃身（Bartoli 12G系列） | `shotgun_short`（assets/guns） | 🆕1 |
| 134 | Bartoli Hunting Shotgun | 通常携行型（Bartoli系列） | `shotgun`（assets/guns） | 🆕1 |
| 135 | Bartoli Hunting Shotgun Deluxe | 通常携行型（Bartoli系列） | `shotgun`（assets/guns） | 🆕1 |
| 136 | Enram HV | 通常携行型（Enram系列） | `shotgun`（assets/guns） | 🆕1 |
| 137 | Enram HV CM | 通常携行型（Enram系列） | `shotgun`（assets/guns） | 🆕1 |
| 138 | Enram HV Covert | 通常携行型（Enram系列） | `shotgun`（assets/guns） | 🆕1 |
| 139 | Enram HV Covert Mk II | 通常携行型（Enram系列） | `shotgun`（assets/guns） | 🆕1 |
| 140 | ICA Tactical Shotgun | 通常携行型（ICA Tactical系列） | `shotgun`（assets/guns） | 🆕1 |
| 141 | ICA Tactical Shotgun Covert | 通常携行型（ICA Tactical系列） | `shotgun`（assets/guns） | 🆕1 |
| 142 | ICA Tactical White Shotgun Covert | 通常携行型（ICA Tactical系列） | `shotgun`（assets/guns） | 🆕1 |
| 143 | Tactical Bartoli 12G | 通常携行型（Bartoli系列） | `shotgun`（assets/guns） | 🆕1 |
| 144 | The Ancestral Shotgun | 通常携行型・装飾仕様 | `shotgun`（assets/guns） | 🆕1 |
| 145 | The Concrete Shotgun | 通常携行型・装飾仕様 | `shotgun`（assets/guns） | 🆕1 |
| 146 | The Ornamental Shotgun | 通常携行型・装飾仕様 | `shotgun`（assets/guns） | 🆕1 |
| 147 | Golden Sawed-Off Bartoli 12G | 短縮型（ソードオフ／携行型） | `shotgun_short`（assets/guns） | 🆕1 |
| 148 | Sawed-Off Bartoli 12G | 短縮型（ソードオフ／携行型） | `shotgun_short`（assets/guns） | 🆕1 |
| 149 | The Makeshift Scrap Shotgun | 短縮型（ソードオフ／携行型） | `shotgun_short`（assets/guns） | 🆕1 |
| 150 | The Maximalist Shotgun | 短縮型（ソードオフ／携行型） | `shotgun_short`（assets/guns） | 🆕1 |
| 151 | 過激主義者のショットガン | 短縮型（ソードオフ／携行型） | `shotgun_short`（assets/guns） | 🆕1 |
| 152 | デーモンダコタ12G | 短縮型（ソードオフ／携行型） | `shotgun_short`（assets/guns） | 🆕1 |

## スナイパーライフル（狙撃銃）（36行）

| 行 | 名前 | 詳細区分 | 当てるモデル | 状態 |
|---:|---|---|---|:---:|
| 153 | Bartoli Woodsman Hunting Rifle | 狩猟用ライフル型 | `hunting_rifle`（assets/guns） | 🆕2 |
| 154 | Druzhina 34 | Druzhina 34系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 155 | Druzhina 34 (The Kashmirian's) | Druzhina 34系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 156 | Druzhina 34 DTI | Druzhina 34系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 157 | Druzhina 34 ICA | Druzhina 34系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 158 | Druzhina 34 ICA Arctic | Druzhina 34系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 159 | Hackl Leviathan Sniper Rifle Covert | Hackl系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 160 | Hackl Sniper Rifle Covert "Ducky" Edition | Hackl系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 161 | ICA Bartoli Woodsman Hunting Rifle Covert | 狩猟用ライフル型 | `hunting_rifle`（assets/guns） | 🆕2 |
| 162 | Jaeger 7 | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 163 | Jaeger 7 Copperhead | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 164 | Jaeger 7 Covert | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 165 | Jaeger 7 Green Eye | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 166 | Jaeger 7 Lancer | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 167 | Jaeger 7 Mk II | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 168 | Jaeger 7 Rude Ruby | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 169 | Jaeger 7 Snow Fox | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 170 | Jaeger 7 Tiger | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 171 | Jaeger 7 Tuatara | Jaeger 7系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 172 | Sieger 300 | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 173 | Sieger 300 Advanced | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 174 | Sieger 300 Arctic | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 175 | Sieger 300 Ghost | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 176 | Sieger 300 Ice | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 177 | Sieger 300 Redeemer | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 178 | Sieger 300 Tactical | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 179 | Sieger 300 Viper | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |
| 180 | The Ancestral Sniper Rifle | 狙撃銃・装飾仕様 | `sniper_rifle`（assets/guns） | 🆕1 |
| 181 | The Concrete Sniper Rifle | 狙撃銃・装飾仕様 | `sniper_rifle`（assets/guns） | 🆕1 |
| 182 | The Golden Dragon | 狙撃銃・装飾仕様 | `sniper_rifle`（assets/guns） | 🆕1 |
| 183 | The Majestic | 狙撃銃・装飾仕様 | `sniper_rifle`（assets/guns） | 🆕1 |
| 184 | The Ornamental Sniper Rifle | 狙撃銃・装飾仕様 | `sniper_rifle`（assets/guns） | 🆕1 |
| 185 | The Scrappy Sniper Rifle | 狙撃銃・装飾仕様 | `sniper_rifle`（assets/guns） | 🆕1 |
| 186 | The White Ruby Rude 300 Sniper Rifle | 狙撃銃・装飾仕様 | `sniper_rifle`（assets/guns） | 🆕1 |
| 187 | UL-LR Sport Rifle | スポーツライフル型 | `hunting_rifle`（assets/guns） | 🆕2 |
| 188 | SUNSIEGER 300 | Sieger 300系列 | `sniper_rifle`（assets/guns） | 🆕1 |

## 近接専用武器（3行）

| 行 | 名前 | 詳細区分 | 当てるモデル | 状態 |
|---:|---|---|---|:---:|
| 192 | ファイバーワイヤー（Fiber Wire） | ワイヤー | `wire`（assets/wire） | ✅ |
| 193 | イヤホン | イヤホン型ワイヤー | — | ⬜ |
| 194 | メジャー | メジャー型ワイヤー | — | ⬜ |

## まだ無い区分（⬜）

- 小型5mm拳銃：4行
- 金属製鈍器：2行
- 球状鈍器：2行
- 缶・即席鈍器：1行
- 食材・即席鈍器：1行
- 新聞・即席鈍器：1行
- 食品・即席武器：1行
- 食品・転倒用アイテム：1行
- 小型金属製武器：1行
- 果実・即席鈍器：1行
- 雪玉・消失型投擲物：1行
- 工具・長柄鈍器：1行
- 長柄鈍器：1行
- 小包・即席鈍器：1行
- ブリーフケース：1行
- 工具箱型ケース：1行
- エアピストル：1行
- 眩惑ダーツ銃（小型クロスボウ型）：1行
- 特殊仕様の拳銃：1行
- 刀・刃物：1行
- 二本組の棒状鈍器：1行
- イヤホン型ワイヤー：1行
- メジャー型ワイヤー：1行

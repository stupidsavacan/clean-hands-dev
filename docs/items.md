# 持ち物（アイテム）

このページは `app/scripts/spec-items.ts` が、モデル・持ち方・近接武器の表・各地図の決まりと置き場所から作っています。直接書き換えず、元の表を直してから `node --experimental-strip-types --no-warnings scripts/spec-docs.ts` を実行します。

## 新しい持ち物を足す時

1. モデル：`assets/items/source/build_items.py` に足し、`node scripts/embed-items.mjs`（`src/item-data.ts` ができる）。
2. 持ち方：`src/hold-pose.ts` の `HOLD_KIND`（small / long / hang）。棒のように持つ物は `GRIP` に along。
3. 武器なら：`src/melee.ts` の `MELEE`。大きくてポケットに入らない物は `LARGE_ITEMS`、背中に背負う物は `BACK_ITEMS`。
4. 地図ごとの決まり（合法・違法・隠せるか）：クラブは `investigation/build-club-source.py` の items → `scripts/build-club.ts`。ほかの地図は `src/data/*detection.json` の items。
5. 置き場所：同じ所の `worldItems`（id・item・x・z・floor）。
6. このページを作り直し、`npm test` を通す（`tests/items.test.ts` が抜けを言う）。
7. 見た目は [持ち物ラボ](../item-lab.html) で、手・床・単体を確かめる。

## 一覧

| id | 名前 | 種類 | クラブ | 夜会 | ホテル | 天文台 | 持ち方 | 握り | 大きい | 背中 | 近接 | 三角形 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `bottle` | ワインボトル | 鈍器 | 怪しい | 怪しい | 怪しい · 置き1 | 怪しい | small | along |  |  | 0.6秒 · 投げる | 132 |
| `brick` | レンガ | 鈍器 | 合法 · 置き1 |  |  | 合法 · 置き1 | small |  |  |  | 0.7秒 · 投げる | 36 |
| `briefcase` | ブリーフケース | 鈍器 | 合法 · 置き1 |  |  | 合法 | hang |  | ○ |  | 0.7秒 · 投げる | 840 |
| `camera` | カメラ | 道具 | 怪しい | 怪しい | 怪しい · 置き1 | 怪しい | small |  |  |  |  | 96 |
| `cellar_key` | セラーの鍵 | — | 合法 | 合法 | 合法 | 合法 |  |  |  |  |  |  |
| `coin` | コイン | 投げる物 | 合法 | 合法 | 合法 | 合法 | small |  |  |  |  | 44 |
| `crowbar` | バール | 鈍器 | 怪しい · 置き1 |  |  | 怪しい · 置き1 | long |  |  |  | 0.8秒 · 投げる | 80 |
| `frying_pan` | フライパン | 鈍器 | 怪しい · 置き1 |  |  | 怪しい | small |  |  |  | 0.7秒 · 投げる | 148 |
| `hammer` | ハンマー | 鈍器 | 怪しい · 置き1 |  |  | 怪しい · 置き1 | small |  |  |  | 0.7秒 · 投げる | 80 |
| `katana` | 刀 | 刃物 | 違法 · 置き1 |  |  | 違法 | hang | along | ○ | ○ | 1秒 · 投げる · 正面はblunt | 148 |
| `keycard` | カードキー | — | 合法 | 合法 | 合法 | 合法 |  |  |  |  |  |  |
| `kitchen_knife` | 包丁 | 刃物 | 違法 · 置き1 |  |  | 違法 · 置き1 | small |  |  |  | 0.6秒 · 投げる | 52 |
| `lockpick` | 鍵開け具 | — | 違法 | 違法 | 違法 | 違法 |  |  |  |  |  |  |
| `mop` | モップ | 道具 | 怪しい | 怪しい | 怪しい · 置き1 | 怪しい | long |  | ○ |  |  | 116 |
| `pistol_guard` | 警備の拳銃 | 銃 | 違法 | 違法 | 違法 | 違法 |  |  |  |  |  |  |
| `pistol_silenced` | 消音ピストル | 銃 | 違法 | 違法 | 違法 | 違法 |  |  |  |  |  |  |
| `poison_lethal` | 致死毒 | — | 違法 | 違法 · 置き1 | 違法 | 違法 |  |  |  |  |  |  |
| `rifle_npc` | 突撃銃 | 銃 | 銃（weapons.json） | 銃（weapons.json） | 銃（weapons.json） | 銃（weapons.json） |  |  |  |  |  |  |
| `smg` | 短機関銃 | 銃 | 違法 | 違法 | 違法 | 違法 |  |  |  |  |  |  |
| `toolbox` | 工具箱 | 鈍器 | 合法 · 置き1 |  |  | 合法 | hang |  | ○ |  | 0.7秒 · 投げる | 1004 |
| `tranq_pistol` | 鎮静ダーツ銃 | 銃 | 銃（weapons.json） | 銃（weapons.json） | 銃（weapons.json） | 銃（weapons.json） |  |  |  |  |  |  |
| `tray` | トレイ | 道具 | 合法 | 合法 | 合法 | 合法 | small | along | ○ |  |  | 152 |
| `wire` | ワイヤー | — | 違法 | 違法 | 違法 | 違法 |  |  |  |  |  |  |
| `wire_earphones` | イヤホン型ワイヤー | — | 違法 · 置き1 |  |  | 違法 | small |  |  |  |  | 280 |
| `wire_tape` | メジャー型ワイヤー | — | 違法 · 置き1 |  |  | 違法 | small |  |  |  |  | 72 |
| `wrench` | スパナ | 鈍器 | 怪しい · 置き1 | 怪しい · 置き1 | 怪しい · 置き2 | 怪しい · 置き1 | small |  |  |  | 0.7秒 · 投げる | 60 |

## 足りない所

- なし

## 置き場所の確かめ

- すべての置き場所と持ち込みの場所に、手が届く立ち位置がある

## わざと例外にしている所

- `poison_lethal:model`：まだモデルがない。手と床では代わりの小さな形で出る。作ったらこの行を消す
- `poison_lethal:hold`：モデルと一緒に足す（今は small 扱い）

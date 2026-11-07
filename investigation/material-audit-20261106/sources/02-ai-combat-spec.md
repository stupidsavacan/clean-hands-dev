# CLEAN HANDS M5.8 — NPC認知・戦闘・検問システム修正仕様書

## 0. 対象・実装原則

- **対象ファイル**：`clean-hands-m5.8-pc-20261031(1).html`
- **対象版SHA-256**：`22588aea8662a7529f3d7bc84318a8906c089b13f8591c8c754379d449fae9c1`
- **コード形態**：単一HTML内のminify済み JavaScript。以下の識別子はこの版での実名。変更時は**検索アンカー（文字列）**を使う。難読化された変数名は将来変わり得るため、改修時には可読な名前にリファクタリングする。
- **目標**：HITMAN系の「発生した事実／知った場所／犯人を認識したか」を分離した認知AIにする。制服・武器の適法性、検問、逮捕を共通規則から判定する。増援・戦力区分は既存仕様を保持し、整合性不良のみ修正する。
- **判定区分**：`BUG`＝観測された不整合・実装上の問題、`CHANGE`＝挙動改善、`KEEP`＝既存実装の維持・回帰確認、`POLICY`＝この修正書で採用する設計上の決定。HITMAN内部の具体的な閾値・距離を断定するものではない。
- **安全な変更手順**：元HTMLを保存 → JSコードを開発用ファイルに展開 → 判定関数・状態遷移を分離 → 単体テスト → ゲーム内回帰テスト → 再バンドル。元のGLB・モーションデータとNPC初期配置・ミッション進行データを不用意に変更しない。

**HITMAN本家との照合**：第14章「HITMAN本家の参照仕様」を本書の比較基準とする。**第2〜13章はCLEAN HANDSへの修正要件**であり、HITMANの内部コード・内部数値・完全な挙動を記述したものではない。HITMANで確認された挙動と、CLEAN HANDSで採用する設計案を混同しない。

## 1. 変更対象の索引

| ID | 優先度 | 区分 | 現状 | 変更後の要件 | 主な検索アンカー |
|---|---|---|---|---|---|
| F01 | P0 | BUG | 武装を合法に携行できても身体検査で違法扱い | 携行・検査・検問の許可判定を統一 | `friskFinds(){` / `shown(e){` / `allowedFor` |
| F02 | P0 | BUG | 生存警備員への被弾で射手の現在座標を確定・即戦闘 | 被弾反応→発射地点の調査→本人確認で交戦 | `m.guard?this.engage(m,e,n)` |
| F03 | P0 | BUG | 屋内の非消音銃声が同じ階・隣接階へ水平距離無制限で届く | 屋内外・距離・遮蔽・階層・音量で音の到達を決定 | `noise(e,t,n,r){` / `noiseLoudOutdoor` |
| F04 | P0 | BUG | 検査発覚から`accuse`→警戒→接近時に即逮捕 | 検査不合格、停止・警告、拒否、追跡、拘束を段階分離 | `complete(e,t){` / `this.caught=!0` |
| F05 | P0 | BUG | `weaponShown`は「構えている」ではなく「違法な長物を背負っている」判定 | `weaponDrawn`と`illegalVisibleCarry`を分離し全呼出元を修正 | `weaponShown:!Y&&Q.shown(` |
| F06 | P1 | CHANGE | 銃声だけで射手の精密座標が全体状態に記録される | 音源推定・最終目撃・犯人の特定を別情報として管理 | `this.lastKnown={x:e.x` / `lastSeen` |
| F07 | P1 | BUG | `recognizes()`が共有Setが空なら全変装を認識し、知識がNPC間で混線 | 各NPCの本人認識と変装発覚情報、無線共有情報を分離 | `recognizes(e){` / `knownDisguises` |
| F08 | P1 | CHANGE | 戦闘・目撃・通報・ホテル全体警戒が相互に飛躍 | 局所認知→通報→区域警戒→全体警戒の明示的な伝播 | `this.hotel.level<2` / `radio(` / `accuse(` |
| F09 | P1 | CHANGE | NPCの戦闘系統をIDの接頭辞から推定 | NPC定義に明示的な`faction`/`combatProfile`/`loadout`を追加 | `function lh(e){` |
| F10 | P2 | KEEP | 制服が同じでもエンフォーサーになれる | `knowsFaces`を保持、役職とは独立した能力として扱う | `watchFace(` / `knowsFaces` |
| F11 | P2 | KEEP | 有限の増援・警備系統別HP/武器・全員排除可 | 有限上限・状態遷移・スポーン周りの回帰テスト | `spawnWave(e){` / `reinforcements:{` |
| F12 | P2 | POLICY | 増援用ライフルは倒すとSMGに変換してドロップ | 意図的制限として明示維持。ライフル取得を許可する場合のみ変更 | `disarm(e){` / `npcOnly:!0` |

### 変更してはいけない既存要素

- 同じ`guard`制服を着た警備主任・一般警備員が、別々の顔認識能力を持てること。
- `knowsFaces`、`post`、`watchFace()`の基本構造と、認識ゲージの時間経過。
- 通常警備・私設護衛・増援の**初期3戦闘系統**。増援を無限湧きにしない。
- 銃声の種類（`small` / `loud`）、遮蔽物データ、移動経路探索、逃走、捜索、ミッション結果・イベント通知との接続。

---

## 2. F01：携行許可と身体検査の不一致【P0 / BUG】

### 確認した既存コード

- `dh.shown(disguise)`：収納中の非隠匿武器について`!weapon.allowedFor?.includes(disguise)`で違法可視携行を判定。
- `dh.illegalIn(disguise)`：手持ちの武器がある、または`shown()`が真なら違法扱い。
- `fm.inventory()`：ワイヤー、他システムの持ち物、`Q.guns.map(e=>e.id)`等を集約。
- `fm.friskFinds()`：`this.rules.items[id].legality==='illegal' && friskDetect!==false`のみを見る。**`allowedFor`を参照しない**。`fm`の`rules`は`Wf.m4`であり、`ag.items`ではない。
- 定義：`oh.smg.allowedFor=['guard','bodyguard']`、`ag.items.smg.allowedFor=['guard','bodyguard']`に対して、**`Wf.m4.items.smg={legality:'illegal',concealable:false,friskDetect:true}`**で、制服による例外がない。`Wf.m4.items.wire.friskDetect=false`。
- `fm.complete()`：検査対象を見つけたら`this.director.accuse(e.guard,...)`を呼ぶ。

### 必須変更

1. 武器・道具を判定する**唯一の共通関数**を作る。`evaluateItemLegality(itemId, disguise, carryMode, context)` は少なくとも `{ possessionAllowed, visibleCarryAllowed, friskContraband, prohibitedHere, reason }`を返す。
2. **`oh`（武器・携行）、`ag.items`（道具とワールドアイテム）、`Wf.m4.items`（身体検査）という3つの定義を統合する。** 武器IDと道具IDを共通のアイテムマスターへ正規化するか、マスター参照方式に変えて`allowedFor`/`legality`/`friskDetect`を一元管理する。現状の`Wf.m4.items`のみを修正しても他経路に不一致が残り得る。
3. `carryMode`を少なくとも`holstered`（収納）/`slung`（背負い）/`drawn`（構え）の3状態にする。`dh.hand`の有無を利用する。
4. `fm.friskFinds()`はアイテムIDを列挙して終わるのではなく、共通関数の`friskContraband`を使う。**制服と武器の組み合わせが許可され、かつ検問側に特別な禁止規則がなければ、背負ったSMGは検査不合格にしない。**
5. 隠匿可能な拳銃・毒・鍵開け道具等は、既存仕様で許可されていない限り従来どおり検出対象。ワイヤーの`friskDetect:false`は維持する。
6. 検問固有の武器禁止区域が必要なら、`checkpoint.weaponPolicy`（例：`inherit`/`no_long_guns`/`no_weapons`）を明示的に設定し、通常エリアでの合法携行と検問の通過許可を混同しない。
7. `fm.passed()`がチェックする`disguise`/`wire`に加え、**検査後に持ち物・装備・許可区分が変わったら検査結果を無効化**する。現行の90秒有効期限は維持可。

### 受け入れテスト

| 条件 | 期待結果 |
|---|---|
| `guard`＋背負った`smg`＋通常検問 | 通常携行合法、検査合格、警戒しない |
| `bodyguard`＋背負った`smg`＋通常検問 | 同上 |
| `suit`＋背負った`smg` | 不法な露出所持として検知。検査では不合格 |
| `guard`＋背負った`smg`＋`no_long_guns`検問 | 携行自体は合法でも、当該検問では通過不可。理由を表示 |
| `guard`＋収納済み未許可の`pistol_silenced` | 検査で検出（既存の例外がなければ） |
| ワイヤーのみ＋`friskDetect:false` | 検査で検出されない |
| 検査合格後に未許可品を取得 | 旧検査結果では通過不可 |

## 3. F05：`weaponShown`の意味の取り違え【P0 / BUG】

### 既存コードの問題

- `My()`の`weaponShown`は`Q.shown(J.disguise)`を格納している。
- `Q.shown()`は「**手に持っていない**、背負った非隠匿武器がその制服で不許可か」を調べる。**「銃を手に構えているか」の判定ではない。**
- ところが`dp.step()`の拘束判定は`!t.weaponShown`を条件にしている。`Q.hand`があっても`weaponShown===false`になり得る。
- `dp.think()`で使う疑惑上昇判定`sp()`も`weaponShown`を読む。`Q.illegalIn()`とは別の経路で結果が変わる。

### 必須変更

- `My()`の状態を明示する：

```ts
{
  weaponDrawn: Q.hand !== '',
  illegalVisibleCarry: Q.shown(J.disguise),
  illegalWeaponHandling: Q.illegalIn(J.disguise)
}
```

- `sp()`：露出した武器を構える行為と、制服に対して違法な背負い武器の両方を、意図された疑惑上昇の対象にする。
- `dp.step()`の拘束：`weaponDrawn`が真なら通常の非武装拘束に進まず、戦闘・武器を下ろす警告へ遷移させる。無条件の「逮捕無効」にはしない。
- `dh.step()`：既存の`!!this.hand`を含む交戦判定との二重発火を防止する。
- `weaponShown`旧フィールドへの参照を**すべて検索・置換**し、名前変更だけで終わらせない。

**回帰テスト**：合法な背負いSMG／違法な背負いSMG／手に構えたSMG／手に構えた拳銃の4条件で、HUDの合法性・疑惑・警告・戦闘・拘束を検証。

## 4. F04：検問の発覚・警戒・拘束を分離【P0 / BUG】

### 既存コードの問題

- `fm.complete()`：検査違反時に直ちに`director.accuse(guard, player)`。
- `dp.accuse()`：警備員を`alert`へ変更し、疑惑100・プレイヤー座標の記録・変装の発覚・周辺警備へ共有を行う。
- `dp.step()`：`state==='alert'`、視認あり、`recognizes()`または立入違反のレート、距離`<0.95`、上下差`<1`、`!weaponShown`なら即`caught`。
- `fm.step()`：検査終了直後に`cancel()`し、検問員の`busy`が解除される。プレイヤーと検問員は近距離なので、次の処理で拘束条件が成立し得る。
- **重要**：`weaponShown`の意味の問題（F05）が逮捕分岐にも影響する。

### 必須変更

1. `fm.complete()`は直接`accuse()`せず、`frisk.failed`イベント（検出物・検問ID・警備員ID・理由）を発行。
2. 検問員専用状態を導入：`checkpoint_hold`（停止要求）→`checkpoint_warn`（退去/武器を降ろす要求）→`checkpoint_pursue`（逃走・拒否時）→`arrest`（必要条件が揃った時）。戦闘は別遷移。
3. 検査違反時はまず検問の**通過を拒否**し、提示済みの警告に従って退去できる猶予を設ける。猶予は設定値で管理（例：`warnSeconds=3`は**新規設計案**であり既存値ではない）。
4. `caught`は「単に`alert`で0.95m以内」では発生させない。`arrest`モード、犯人特定、接触可能、退去拒否/逃走等の明示条件を必要とする。
5. 不審者を確認しているのか、違法品を検出したのか、立入違反かをイベントに記録し、検問AIに行動を選択させる。
6. 検問中の`busy`解除、キャンセル、警備員死亡、プレイヤー離脱、変装変更、検査パス期限切れの遷移を定義。失敗した検査でパスを発行しない。
7. 逮捕成立後だけ既存の`caught`イベントとミッション失敗処理へ送る。新しいイベント名は追加可、既存購読者を壊さない。

### 受け入れテスト

- 合法武装・許可制服：検問通過、警戒なし、逮捕なし。
- 不正アイテム：検査不合格→警告表示→離脱できる。**検査完了直後に`caught`が発生しない**。
- 警告後の退去・逃走・再接近：それぞれ適切な状態遷移。逃走時の追跡と接触時の逮捕は分離。
- 検問員が発覚した変装のエンフォーサーでも、違反理由と行動状態を重複発火させない。
- 警備員が死亡/気絶/勤務外になったときに、進行中の検査が安全に中止される。

## 5. F02：被弾から戦闘への直結を解消【P0 / BUG】

### 既存コード

`dh.fire()`の命中後：

```js
m.hp -= a.damage * (g ? a.headshot : 1);
if (m.hp <= 0) this.kill(m, 'gun', time);
else if (m.guard) this.engage(m, player, time);
else this.flee(m, muzzlePosition);
```

`dh.engage()`は、その場で`state='combat'`、`lastSeen=player座標`、共有`lastKnown=player座標`、`compromised.add(disguise)`、`onSpotted`、戦闘イベントを設定する。**視認の確認がない。**

### 必須変更

1. 発砲時に構造化イベントを発行：`shot.fired`（発射地点、武器ID、音種別、時刻）／`shot.impact`（着弾位置、命中対象、時刻）／`npc.wounded`（対象ID、被ダメージ、攻撃元**未特定可**）。
2. `dh.fire()`では被弾処理後、`onWounded(npc, impact, shotContext)`へ渡す。既存の`m.guard?this.engage(...)`直結を削除。
3. 武装NPC：攻撃者を**視認・特定している場合だけ**`engage()`。射手未特定の場合、`search`/`investigate`で発射元推定位置を調べる。
4. 民間人：原則`flee`/通報。命中しただけで攻撃元を確定認識しない。
5. 被弾時の状態は、発射時点での視界・遮蔽・他者の通報・すでに犯人を認識しているかで変える。被弾を根拠にプレイヤーの現在座標を直接書かない。
6. 発射地点を調べてプレイヤーを見つけたら、通常の視認条件を経て`combat`へ移る。見つからなければ時間経過で捜索終了。
7. 既にプレイヤーを交戦相手として特定済みなら、再被弾のたびに戦闘開始イベントや警戒を二重発火させない。

**必須テスト**：背後からの非致死被弾／正面からの非致死被弾／遮蔽物越しの被弾／高所からの狙撃／民間人の被弾／既に交戦中の追加被弾／即死時の死体・武器ドロップ。見えていないプレイヤーの座標・変装が確定してはならない。

## 6. F03：銃声の伝播範囲を修正【P0 / BUG】

### 既存の判定

`dh.noise(e, t, n, r)`：

```js
const isOutside = director.outdoorAt(origin);
const originFloor = Lf(origin.y - 1.4);
const listenerDistance3D = distance3D(npc.pos, origin);
const hears = sound === 'small'
  ? listenerDistance3D <= rules.noiseSmall
  : horizontalDistance(npc.pos, origin) <= rules.noiseLoudOutdoor
    || (!isOutside && !npc.outdoor &&
        Math.abs(Lf(npc.pos.y) - originFloor) <= 1);
```

- `noiseSmall=8`、`noiseLoudOutdoor=40`。
- `loud`の後半分岐に**水平距離の上限がない**。同じ階または隣接階の屋内NPCが距離と無関係に反応し得る。
- `loud`なら**聞いたNPCが0人でも**`this.lastKnown`を発射地点に変更し、`hotel.level`を最低2に上げる。
- `radio()`は警備NPCを`investigate`へ遷移させる。これは`combat`への即移行ではない。

### 必須変更

1. 銃声の到達判定を`canHearGunshot(listener, soundEvent, world)`に切り出す。**どの経路にも有限の最大距離を設ける**。
2. `small`/`loud`に別の基本距離を設定。既存の8m/40mは初期設定として使ってよいが、屋内の無限水平距離を削除。
3. 距離に加えて、同一屋内区画・隣接区画・屋外・階差・遮蔽（既存の`boxes` / `ep` / 室内・屋外判定）で音量を減衰させる。隔壁を完全な遮音壁と見なすかは素材・区画で設定。
4. 結果は「聞いたNPCの集合」を返す。音源の推定地点を共有するかは**報告または通報イベント**で別途判断する。
5. **聞いた者も通報者もいない発砲だけでは、ホテル全体の警戒レベルを上げない。** 世界全体の警戒度と各NPCの局所認識を分離（F08）。
6. 既存`director.noise(e)`はコイン用の別処理。銃声だけを修正してコイン等の挙動を壊さない。

### 受け入れテスト

- 同一階の100m離れた屋内警備員：**銃声を聞かない**。
- 近距離の警備員：聞こえ、音源推定位置へ調査に向かう。
- 壁越し／上下階／屋内外の境界：遮蔽・階差に応じて到達範囲が変わる。
- 無人の離れた地点で発砲：全警備員への一斉警戒・プレイヤー位置共有が起こらない。
- 発砲を聞いた一般人：必要ならパニック・通報。即座に全警備員の`combat`にはしない。
- 銃声が重なっても、通知数に比例して同じ警戒イベントが無限増殖しない。

## 7. F06・F08：位置情報と警戒伝播を分離【P1 / CHANGE】

### 既存で混線しているもの

- `dh.noise()`：発射地点→`this.lastKnown`。
- `dh.engage()`：プレイヤー位置→NPCの`lastSeen`、戦闘系`lastKnown`、変装発覚。
- `dp.accuse()`：プレイヤー位置をセットしたうえで、周辺の警備員へ`knownDisguises`・`lastSeen`を共有。
- `dp.step()`：`alert`を受けると15m以内のNPCへ`radio()`、`report`でも警備へ情報を渡す。
- `hotel.level`：個別NPCとは独立に上昇する部分がある。

### 必須の情報モデル

```ts
type Knowledge = {
  eventType: 'gunshot' | 'impact' | 'wounded' | 'sighting' | 'report';
  estimatedOrigin?: Vec3;       // 音・弾道からの推定位置（誤差付き）
  lastSeenPosition?: Vec3;      // 目視確認した時のプレイヤー位置
  confirmedActor?: boolean;    // プレイヤーが犯人だと確認済みか
  identifiedDisguise?: string;  // 判明した変装（推定だけでは設定しない）
  confidence: number;
  observedAt: number;
  sourceNpcId?: string;
};
```

- `estimatedOrigin`から直接`confirmedActor=true`にしない。
- `lastSeenPosition`は**視覚または信頼できる目撃情報**でのみ更新。最後に見た位置が分かっても、現在地とは限らない。
- 無線・会話・目撃による共有では`sourceNpcId`を保持し、**誰が何を知っているか**をNPC単位で追跡。
- NPC別状態（`patrol`/`curious`/`investigate`/`search`/`alert`/`combat`/`flee`）と、区域別・ホテル全体の警戒レベルを分離。
- 区域警戒の更新は証拠・通報・既知の犯人情報で行う。遠隔地のNPCがプレイヤーの精密現在座標を受け取らない。
- 視界が途切れたら既存の`loseSeconds=4`、`timers.search=8`などを使って調査・捜索に遷移。値はパラメータとして調整可。

### 最小イベント経路（推奨）

```text
fire → shot.fired → 音の到達対象を計算 → 各NPCにgunshot記憶を追加 → investigate
     └→ shot.impact / npc.wounded → 被害NPCがwounded状態
                                ├→ 犯人目視済み → combat
                                └→ 犯人不明   → investigate/search
調査中にプレイヤー視認 → 犯人と確定できた場合だけ combat / accuse
通報成立 → 近隣・担当区域に情報伝播 → 必要条件を満たして全体警戒
```

**必須テスト**：発射位置を離れた後、警備員が旧地点を調べる。遠隔区画では通報前に平常状態を保持。通報後も追跡情報が更新されなければ旧地点までしか分からない。変装変更後に旧犯人情報が全NPCへ無条件に適用されない。

## 8. F07：本人認識・既知の変装・エンフォーサーの整合性【P1 / BUG】

### 既存の疑義（重要）

```js
// up.recognizes(e)
return !this.knownDisguises.size
    || this.knownDisguises.has(e.disguise)
    || this.knowsFace(e.disguise);
```

- `knownDisguises`はNPCコンストラクタで渡された**`director.compromised`共有Set**である。
- 共有Setが空の場合、`!this.knownDisguises.size`が真になり、**全NPCがあらゆる変装を「認識」できる**。
- `accuse()`は共有Setに変装を加える処理と、周辺警備員への個別情報の付加を混用している。`watchFace()`は別途`knowsFaces`を扱っており、役割が重なっている。

### 必須変更

1. `recognizes(player)`を、文脈を示す複数の関数へ分割：
   - `isEnforcerFor(disguise)`：そのNPC固有の`knowsFaces`。
   - `hasConfirmedIdentity(player)`：自分自身が見た／信頼できる通報を受けた本人情報。
   - `isDisguiseCompromised(disguise)`：変装が発覚済みというゲーム側の状態。
2. **Setが空というだけで認識成功にしない。**
3. `watchFace()`のエンフォーサーゲージ（2m/約1秒、5m/約3秒、8m/約6秒、正面±50度、閾値0.5/1.0）は基本維持。
4. `security_chief`と普通の`guard`の制服を同じにしてもよい。`monitor_watcher`のような主任以外の認識役も維持。
5. `knownDisguises`が共通参照か個別保持かを明確化し、共有されるのは通報済み情報のみとする。NPCごとの視認履歴を全員に暗黙共有しない。
6. `perceive()`、`think()`、`dh.fightStep()`、`dp.step()`の**すべての`recognizes()`利用箇所**を移行し、「エンフォーサーである」だけで常時射撃許可になることを防ぐ。

**必須テスト**：初期状態で通常警備員は合法変装の47を認識しない。`security_chief`と`monitor_watcher`は指定変装をゲージで見破る。同じ制服の普通の警備員は見破らない。近隣での通報後だけ、対象情報を知ったNPCが適切に反応する。

## 9. F09・F10：役職・所属・装備の対応【P1 / CHANGE、P2 / KEEP】

### 既存

`function lh(e)`：

```js
return e.id.startsWith('response') ? 'response'
  : e.id.startsWith('bodyguard') ? 'bodyguard'
  : e.role === 'guard' ? 'guard'
  : 'civilian';
```

`dh.arm(npc)`：その分類の`health`/`weapon`を設定する。初期値は`guard={health:100, weapon:'pistol_guard'}`、`bodyguard={health:150, weapon:'smg'}`、`response={health:200, weapon:'rifle_npc'}`。

- 現在の基本`role`は`guard`/`waiter`/`guest`。衣服モデルや肩書きの違いは戦闘系統と必ずしも一致しない。
- 例：`guard_penthouse`はID接頭辞の条件に該当せず、`guard`分類となる。`bodyguard_captain`は`bodyguard`分類。
- `knowsFaces`はNPC単位で設定済み。**制服が同一でも見破る人／見破らない人を分けられる**ため、この仕様自体は正しい。

### 必須変更

- 各NPC定義に`faction`（所属）、`securityRole`（警備上の役職）、`combatProfile`（戦闘特性）、`loadout`（装備）、`disguiseId`（変装カテゴリ）、`enforcerDisguises`（見破る制服）を明示。**内部IDやラベル名から推測しない**。
- `role`は従来の市民/警備の基本行動区分として残してよい。`combatProfile`と独立。
- 既存配置とHP・武器を移行時点で正確にスナップショットし、意図的に変更対象としたNPC以外の戦闘性能を変えない。
- 初期のホテル警備／私設護衛／増援の3系統を維持し、区域・制服・護衛対象・所属を別フィールドで表す。種類を増やすこと自体は修正の必須条件ではない。
- 新データには検証ルールを設ける：全NPCに有効な`combatProfile`があること、全武器IDが存在すること、`disguiseId`に有効な権限定義があること、必要なら専属護衛は対象・所属を参照できること。

```ts
// 移行後の定義例。既存NPCの位置・経路は変更しない。
{
  id: 'bodyguard_captain', role: 'guard',
  faction: 'private_security', securityRole: 'captain',
  combatProfile: 'bodyguard', loadout: 'smg',
  disguiseId: 'bodyguard', enforcerDisguises: ['bodyguard']
}
```

**必須テスト**：同一制服・別階級で変装判定のみ相違。別制服・同一戦闘系統で同じ武器/HP。`guard_penthouse`の性能がID変更で変わらない。`response_1`等の増援も明示的なprofileで生成。

## 10. F11・F12：増援・警備全滅・武器ドロップ【P2 / KEEP・POLICY】

### 既存設定（保持）

| 要素 | 現状 |
|---|---|
| 増援発動 | `hotel.level >= 3` |
| 通常の戦闘継続でレベル3へ | `alert3After=15`秒 |
| 最初の増援 | レベル3到達後`firstDelay=20`秒 |
| 増援数 | 1波4人、最大3波＝12人、波間隔60秒 |
| 出現点 | `REINF_parking`、`REINF_dock` |
| 増援HP・装備 | 200、`rifle_npc` |
| 警戒度3の出口制限 | `E1`、`E2` |
| 初期武装警備 | 通常警備19＋私設護衛4＝23人（当該版の初期配置上の数） |
| 最大武装警備 | 23＋12＝35人（追加生成が全波成功した場合） |

### 修正・確認要件

1. F03/F08により警戒レベルの発生条件が変わるため、増援の波数・タイマーが不意にリセット/重複発火しないこと。
2. `spawnWave()`で生成する`response_*`は、F09の明示的な`combatProfile:'response'`を設定する。`role:'guard'`であることと混同しない。
3. 生成地点が通行不能・プレイヤーの目の前・他NPCと重複する場合のフォールバックを定義。全員倒しても条件次第で予定済みの有限増援が残ることをHUD/デバッグで判別できるようにする。
4. 新たな警備員を**無限生成しない**。全警備員排除プレイを禁止するための特別な無敵フラグは追加しない。
5. `dh.disarm()`は現在`e.weapon==='rifle_npc' ? 'smg' : e.weapon`で増援ライフルをSMGに置換し、`rifle_npc.npcOnly=true`。これは**意図的な取得制限として維持**する方針。変更したい場合は`playerPickupId`等の明示的なマッピングへ置き換え、暗黙の特例をなくす。
6. 取り逃した武器が永久増殖しないこと、死体隠し・気絶・死亡時のドロップ処理が二重発火しないこと。

**受け入れテスト**：レベル2で未発動／レベル3で初回20秒／3波計12人で停止／増援が倒れた際のSMGドロップ／残存警備0でもクリア・ミッション進行が壊れない／戦闘終了後に再びレベル3でも無限湧きしない。

---

## 11. 推奨モジュール境界・更新順

**順序を入れ替えないこと**（判定を二重実装しやすいため）。

1. **共通型・監査ログ追加**：`Knowledge`、`WeaponCarryState`、`DisguisePermission`、`CheckpointStatus`、NPCごとの知識・状態ログ。
2. **F05**：`weaponShown`を用途別のフラグに分割。`My()`、`sp()`、`dh.step()`、`dp.step()`、カメラ/違法判定への影響を追跡。
3. **F01**：武器/道具判定を統合し、検査経路に反映。既存アイテム全種の判定表をスナップショット比較。
4. **F07**：共有知識とNPC固有知識、本人認識/変装認識を分割。`recognizes()`を全呼出元から除去。
5. **F06・F08**：音源推定・目撃座標・犯人特定・無線・区域警戒を分離。
6. **F03**：銃声の伝播判定を置換。局所イベントと全体警戒の更新を連携。
7. **F02**：被弾時の直結`engage()`を削除し、知識ベースの行動へ移行。
8. **F04**：検問状態と逮捕条件を段階化。直接`accuse()`→即`caught`経路を解消。
9. **F09**：NPCの所属・戦闘系統・装備を明示的なデータで移行。
10. **F10〜F12**：エンフォーサー、増援、武器ドロップ、ミッション終了の回帰検証。

### 関連イベント・呼出元を必ず確認

- `shot.fired`、`combat.started`、`combat.ended`、`player.hit`、`player.spotted`、`caught`、`mission.failed`。
- `fm.complete()`、`fm.step()`、`fm.constrain()`、`fm.passed()`。
- `dp.step()`、`dp.accuse()`、`up.perceive()`、`up.think()`、`up.watchFace()`、`up.radio()`、`up.recognizes()`。
- `dh.fire()`、`dh.noise()`、`dh.engage()`、`dh.fightStep()`、`dh.step()`、`dh.disarm()`、`dh.spawnWave()`。
- `My()`が組み立てるプレイヤー状態、`sp()`の疑惑上昇レート、`op()`のゾーン入場許可。
- `q.hotel.level`を参照する出口封鎖、増援、NPC避難、ターゲット逃走、UI警告・ミッション失敗ロジック。

## 12. 全体回帰テスト表（リリース条件）

| ID | テスト状況 | 期待する観測結果 |
|---|---|---|
| T01 | 平時、警備の制服、SMGを背負う | 犯人認識・違法所持・戦闘にならない |
| T02 | 同じSMGをスーツで背負う | 不法所持として反応、ただし通常の認識ゲージと警告に従う |
| T03 | 警備制服＋SMGで検問 | 検査合格、`caught`なし、通行可能 |
| T04 | スーツ＋SMGで検問 | 検査不合格、警告、退去可能、即時`caught`なし |
| T05 | 検査済みの後に禁止物を拾う | 旧検査パスは無効化 |
| T06 | 警備員から見えない場所で消音銃 | 近距離の音のみ反応、遠隔NPCは通常行動 |
| T07 | ホテル一端の屋内で非消音銃 | 100m先の屋内NPCは反応しない |
| T08 | 無人地点の発砲 | 自動的な全館警戒・全員戦闘なし |
| T09 | 警備員への背後からの非致死被弾 | 被弾と調査は発生、犯人を確定しない |
| T10 | 見えている攻撃者から警備員が被弾 | 射手と特定できれば戦闘へ |
| T11 | 銃撃直後に別地点へ移動 | 警備員は発射推定地点を調べ、現在位置を全知しない |
| T12 | 民間人が被弾して生存 | 逃走/通報。自力で即戦闘へ入らない |
| T13 | 通報の成立前後で別区域を確認 | 通報前は局所警戒、通報後は共有範囲だけ警戒 |
| T14 | 同じ警備服の主任と一般警備 | 主任だけ設定された変装を見破れる |
| T15 | `knownDisguises`が空の初期状態 | 一般NPCが全変装を認識することはない |
| T16 | 違反発覚後に検問から退去 | 警告を経て退去でき、近接即逮捕しない |
| T17 | 違反発覚後に逃走・抵抗 | 明示的な追跡・戦闘・逮捕状態へ遷移 |
| T18 | 武器を手に構える／背負う | `weaponDrawn`と`illegalVisibleCarry`が正しく区別される |
| T19 | 15秒以上の戦闘で全館警戒3 | 設定された入口/出口・増援が正常連動 |
| T20 | 最大3波の増援を排除 | 計12人で打ち止め、追加無限生成なし |
| T21 | 増援のライフル所持NPCを倒す | 仕様どおりSMGが1回ドロップする |
| T22 | 初期・増援の全警備員を排除 | NPC0で不正ループ・強制無敵・実装例外なし |
| T23 | 変装を変更、以前の目撃者から逃れる | 視認・通報情報に基づく反応のみ起きる |
| T24 | 再開/リスタート/新ミッション | 知識・警戒・増援タイマー・検査パスが初期化される |

### デバッグ観測（実装必須）

既存の`window.__cleanHands`に開発用の読み取り専用スナップショットを追加、または専用のデバッグ表示を実装する。

```ts
{
  npcId, role, faction, combatProfile, disguiseId,
  aiState, checkpointState, suspicion,
  lastHeardOrigin, lastSeenPosition, confirmedActor,
  enforcerDisguises, knownDisguises,
  perceivedEventIds, receivedReportIds,
  currentWeapon, weaponDrawn, illegalVisibleCarry,
  zoneAlertLevel, hotelAlertLevel,
  reinforcementWave, reinforcementRemaining,
  eventTimestamp
}
```

- テストごとに**イベント発行時刻・音源座標・受信者・認識根拠・状態遷移・検問判定理由**を記録できること。
- 受信者0の銃声による全体警戒、未視認での犯人確定、同一行動からの連続`caught`/`combat.started`発火を検出できるアサーションを追加。
- 新機能の動作だけでなく、既存のミッション進行、NPCの経路探索、ターゲット避難、GLB描画、モーション再生、セーブ/リセット相当の初期化に回帰がないこと。

## 13. 既存コードの検索位置（貼り付け用）

```text
# 検知・AI
var up=class{
recognizes(e){
watchFace(e,t,n,r,i){
radio(e,t){
var dp=class{
accuse(e,t){
this.caught=!0
function op(e,t,n){
function sp(e,t,n,r){

# 検問
fm=class{
friskFinds(){
checkpoint(e){
attendant(e){
allowed(e){
passed(e){
complete(e,t){
constrain(e,t){

# 戦闘・武器
ah={_note:
oh={_note:
function lh(e){
var dh=class{
shown(e){
illegalIn(e){
fire(e,t,n){
noise(e,t,n,r){
engage(e,t,n){
fightStep(e,t,n,r){
disarm(e){
spawnWave(e){

# アイテム・プレイヤー状態・入口
var ag={
legality(e,t){
function My(){
weaponShown:!Y&&Q.shown(
```

> **注意**：minify済みコードのため、同じ短いメソッド名や`complete(e,t)`等は複数クラスに現れる。必ずクラス・前後のコード・引数の意味まで確認して編集すること。上記の擬似コードは設計例であり、そのままminify済みHTMLにコピーして動く差分ではない。


---

## 14. HITMAN本家の参照仕様（World of Assassination／実装比較用）

### 14.0 参照対象と証拠区分

- 比較対象は、**HITMAN（2016）・HITMAN 2（2018）・HITMAN 3／World of Assassination**の通常ミッション。作品・難易度・ミッション固有イベントで挙動が異なる場合がある。
- **[A] 公式資料**：IO Interactiveのパッチノート、2016年版HITMANの公式配布マニュアル。ゲーム内で観測できる挙動には有効だが、内部AIの変数・計算式や全ミッションの例外までは示さない。
- **[B] 複数場面を用いたプレイヤー検証・実攻略資料**：ゲーム上の挙動の参考。バージョン差・検証漏れに注意。
- **[C] Wiki・コミュニティ証言**：一般化の根拠には弱い。マップ固有の例や、公式文書のない仕組みの補助資料としてのみ扱う。
- 公式で公開されていない**視認角度、音の到達距離、犯人認識時間、NPCごとのHP・命中率、通報の伝播半径**を「HITMAN公式値」として記載しない。第2〜13章の`8m`、`40m`、`0.95m`、`3秒`等はCLEAN HANDS側の既存値または提案値。
- **2026年10月29日公開の公式パッチ v3.290.1**まで参照。パッチの記載箇所は版差の可能性がある。[H3]

### 14.1 F10・F07：エンフォーサーと制服・上下関係

| HITMANで確認できること | 根拠 | CLEAN HANDS実装時の判断 |
|---|---|---|
| 変装を見破るNPC（脅威）は、そのNPCの頭上に白い点で示される。認識は視線を通じて段階的に進む。 | [A] [H1] | `knowsFaces`と認識ゲージを維持し、`suspicion`とは別に判定。 |
| 見破る能力は「上司である」ことを必須条件としない。一般警備、ホテル従業員、VIP関係者など、変装カテゴリと個々のNPCの関係で決まる。 | [A] [H1]の「脅威」の定義＋[B] [H6]のバンコク例 | `securityRole`と`enforcerDisguises`を独立させる。 |
| **同一制服の警備員が、片方は見破り、片方は見破らない**状況は成立する。服装が同じでも階級・視認能力は同じとは限らない。 | [B] [H6]（ホテル警備の一部が見破る） | 制服の見た目や役職の表示名ではなく、NPC固有の設定を見る。 |
| 変装の脅威と「犯罪行為を目撃した証人」は、異なる原因から脅威として扱われ得る。 | [A] [H1] | `isEnforcerFor()`、`hasWitnessedCrime()`、`hasConfirmedIdentity()`を独立させる。 |

**適合確認**：`security_chief`、`monitor_watcher`が`guard`を見破り、同じ制服の普通の`guard`が見破らないこと。`knownDisguises`が空という理由で全NPCが見破る処理は本家仕様とは両立しない。HITMANの正確な認識秒数を本書のテストに転用しない。

### 14.2 F09：警備の種類・所属・装備・許可区域

- HITMANの警備員は「警備員」という単一カテゴリだけではない。**所属・護衛対象・制服／変装カテゴリ・立入権限が異なる複数の集団**が同一マップに存在する。[B] [H6]
- ホテルを扱う**バンコク「Club 27」**には、少なくとも `Hotel Security`、`Jordan Cross' Bodyguard`、`Morgan's Bodyguard` という**3つの警備系変装カテゴリ**がある。[B] [H6]
- `Morgan's Bodyguard` は **Otis Kaplan 1人に対応する固有変装**。したがって「警備3種類」は**変装カテゴリの数**であり、3つの大規模部隊が独立しているという意味ではない。[B] [H6]
- 別のマップでは警備関係のカテゴリ数や特殊変装は異なる。**全マップに共通する警備の種類数は存在しない**。一般警備・専属護衛・精鋭役職を混ぜて一律「3種類」とは扱わない。
- **警備の所属・制服・武器の所持権限・入場権限・戦闘能力は別の属性**。制服が同じことと、同じAI能力・同じ持ち物を持つことは同義ではない。[A] [H1]（変装ごとの権限）

**実装指示**：`faction`、`disguiseId`、`accessZones`、`enforcerDisguises`、`combatProfile`、`loadout`を分離。現状の3系統の人数や装備を単純に増やす必要はない。ID接頭辞で戦闘プロファイルを推定するF09の実装だけ先に修正する。

### 14.3 F03・F08：発砲音・着弾・警報・エリア警戒

| ゲーム内イベント | 本家の見える挙動 | 根拠 | CLEAN HANDSへの適用 |
|---|---|---|---|
| `Gunshot Heard` | **近くの誰かが音を聞いた場合**に発生し、周辺警備員が調査に動く。警戒表示は`Searching`になり得る。 | [A] [H1] | 音を聞けるNPCを局所計算する。マップ全員に「現在の射手座標」を渡さない。 |
| `Bullet Impact Noticed` | 銃声を聞いていなくても、**物体への着弾を認識**した場合、警備員がその周辺を調査する。 | [A] [H1] | `shot.fired`と`shot.impact`を分け、着弾を独立イベントにする。 |
| `Crime Noticed` | 犯行目撃によって周辺警備が呼ばれ、現場調査が発生する。 | [A] [H1] | `sighting`や目撃・通報経路を音情報と独立させる。 |
| 複数回の着弾・異常行動 | 単なる調査からパニックや強い警戒へ変化し得る。条件の細部はゲーム版や場面による。 | [B] [H4] | 同一イベントの繰り返しに対し、累積・クールダウンを定義可能にする（再現するなら別タスク）。 |

**注意点**：「画面の警戒表示が`Searching`になった」ことは「全NPCが銃声を直接聞いた」ことを意味しない。警戒UIの表示、個々のNPCの記憶、区域への通報、全館の非常態勢は別物。[A] [H1]

**実装指示**：F03の「屋内・同階なら水平距離無制限」は修正する。ただし、HITMAN本家の**正確な聞こえる距離や壁越し減衰式は公開資料から確定できない**。音量・遮蔽・階層に応じた有限の到達判定は、CLEAN HANDS独自の調整値として実装する。

### 14.4 F02：撃たれて生き残ったNPCは即座に犯人と交戦するか

- **HITMANには警戒段階の区別がある**。公式マニュアルでは`Searching`は「犯人は未特定」、`Compromised`は「顔・変装が特定された」、`Hunted`は「追跡中」、`Combat`は「認識した相手に攻撃する状態」と分けられる。[A] [H1]
- **非致死の被弾・近接着弾などで武装NPCがパニックや調査に移る場面**がある。被弾したという事実だけで、あらゆる角度・距離から射手の顔と現在座標が確定し、必ず即`Combat`になる、という単一規則ではない。[B] [H4]
- ただし、「**被弾時に本人を視認していなければ、発射場所の情報すら得られない**」という解釈も正確ではない。HITMANには発射元を強く推定する特殊なリアクションがある（次項）。[B] [H4][H5]
- 戦闘状態へ移行できる条件は、実際のNPCによる目撃・すでに犯人を把握済み・警報共有・特殊な発射地点調査と、その後の本人照合を区別する必要がある。

**実装指示**：既存の「生存した警備員への命中直後に、無条件で`engage()`＋現在のプレイヤー位置登録」を削除。被弾側のリアクションと犯人確定を分ける。ただし、**本人の存在を既に知っている場合の即時交戦**は維持する。

### 14.5 F06：銃撃の発生地点をどれだけ正確に知るか

- **通常の発砲音を聞くこと**と、**現場の着弾・被弾から射手の発射地点を特定すること**は別のゲームイベント。[A] [H1]
- HITMANの狙撃関連リアクションには、**発砲を直接見ていない警備員が、後からかなり正確な発射地点を割り出して移動する挙動**が報告・検証されている。消音されていてもこの特殊反応が生じる例がある。[B] [H5]
- **発射地点を知っている**ことと、**プレイヤーの現在地／外見／変装を特定している**ことは別。プレイヤーが既に地点を離れた場合、調査担当がそこへ向かっても本人を認識しない例が検証されている。[B] [H4][H5]
- この「ほぼ正確な発射地点」特定は**ゲーム的な情報付与**であり、本家の内部で必ず実世界の弾道計算や物理推定を行っていることは確認できない。

**実装指示**：`estimatedOrigin`は、状況に応じて「曖昧な音源位置」「正確な発射地点」両方を格納できるようにする。一方、`lastSeenPosition`・`confirmedActor`・`identifiedDisguise`は別に保持。**F06を「発射地点を一切特定できなくする修正」として実装しないこと。**

### 14.6 F01・F05：持ち物が合法かどうかと、外見に見えるかどうか

- **変装によって許可される持ち物や行為が変わる。** 警備員の服装では通常の服装より多くの装備を表に出して持てる。[A] [H1]
- 一方、**武装を許可される制服でも、すべての装備が無条件に許可されるわけではない**。アイテムと制服の組合せに例外がある。[B/C] [H7]
- `holstered`／`slung`／`drawn`などの携行モードと、見られているかどうかは別の因子。**2026年10月29日の公式パッチでは、違法アイテムが本人の体や物陰に隠れてNPCから見えない場合、NPCがそのアイテムを視認できない**よう修正された。[A] [H3]
- **「所持自体が合法か」「周囲から可視か」「検問の持込規則を満たすか」**を同じ真偽値に潰さない。

**実装指示**：F01/F05の共通判定関数を使用。少なくとも `itemAllowedByDisguise`、`isVisiblyCarried`、`isVisibleTo(observer)`、`checkpointAllowed` を区別する。NPCがアイテムの存在を知らないのに「見えている違法携行」を理由とした告発が起きないこと。2026年パッチの遮蔽判定は再現すると決めた場合のみ追加（現在のP0の必須条件とは切り分ける）。

### 14.7 F01・F04：身体検査はどんな時に行われるか

ここは**従来の推論に対する重要な補足**。

- HITMAN WOAの身体検査は、**違法な持ち物がインベントリにある場合、そもそも検査を開始できない**形式が基本、とされている。[C] [H8] すべての検問・難易度・バージョンでの例外を網羅した公式資料は確認できていない。
- **検問を要求されるかどうかも、変装によって変わる。** 公式の2022年修正では、ダートムーア正門で警備員の変装をした47にまで身体検査を求めていた不具合が修正され、警備服なら検査不要になった。[A] [H2] 重慶の警備服で検査要求が消えるようにする修正も2021年公式パッチに存在する。[A] [H9]
- したがって「合法な装備を持っているなら、**どの変装でも必ず検査を受け、必ず合格する**」は**HITMANの一般仕様ではない**。`requiresFrisk(disguise, checkpoint)`と`mayStartFrisk(inventory, checkpoint)`がまず必要。
- CLEAN HANDSにある**身体検査中に禁止物を発見し、その直後に検問員が近距離で即`caught`**という連続動作を「HITMANそのものの検問処理」と扱わない。

**実装上の選択肢（混同禁止）**：

| モード | ルール | HITMANとの関係 |
|---|---|---|
| `woa_like` | 検問ごとに変装で検査要否を決定。禁止品がある場合は検査開始前に停止／持込不可を表示。 | 本家で報告される基本構造に近い。[H2][H8] |
| `clean_hands_inspection` | 既存どおり検査を開始し、完了後に禁止品を発見し得る。ただし段階的警告・退去・追跡を実装する。 | **CLEAN HANDS独自拡張**。本家そのままではない。 |

**修正方針**：第2章で要求している「`guard`＋許可SMGで身体検査に合格」は、あくまで**検査が行われる設計を選んだ場合のCLEAN HANDS受け入れ条件**。本家に厳密に寄せるなら、まず**その変装は当該検問でそもそも検査不要か**を判定する。どちらのモードでも、同一アイテムの合法性を通常視認と検問処理で矛盾させない。

### 14.8 F04：退去警告・犯人確定・拘束の違い

- `Found Trespassing`：不法侵入を発見されると、警備員から**退去を求められる**。従えば、その行為だけで即座に疑われるとは限らない。[A] [H1]
- 警戒表示には、犯人未特定の`Searching`、認識済みの`Compromised`、追跡中の`Hunted`、交戦中の`Combat`の区別がある。[A] [H1]
- 逮捕・投降のインタラクションは存在する。**警備員が「警戒した」という理由だけで全ケースが瞬時にミッション失敗する**設計ではない。[A] [H1]
- 例外：立入禁止の中でも即時に敵対する`Hostile Area`、犯罪の現認、既に犯人を認識している警備員、進行中の敵対イベントなどは、丁寧な退去案内を経ない場合がある。[B/C] [H10]

**実装指示**：`trespassing_notice`／`frisk_denied`／`identity_compromised`／`hostile_trespass`／`active_combat`を原因として残す。`alert`＋至近距離を単一の逮捕条件にしない。退去要求できる状況には通知と応答機会を設けるが、**どの犯罪でも一律3秒の警告を保証するわけではない**（第4章の3秒は設計例）。

### 14.9 F08：局所警戒・全体UI・NPCごとの知識

- 本家のUIには`Searching`・`Compromised`・`Hunted`・`Combat`等の**グローバルな警戒表示**がある。[A] [H1]
- しかし、`Gunshot Heard`の説明で行動するのは**近くの警備員**。従ってグローバルなUI表示と、全NPCへの音源情報の配布は同値でない。[A] [H1]
- 犯人が特定された際には、目撃者がいなくなる／変装を変えると警戒が下がる場合がある。[A] [H1] 状態は永続単調増加ではない。

**実装指示**：`npc.knowledge`（個人知識）、`zoneAlert`（担当区域）、`hotelAlert`（全館イベント）、`uiAlert`（プレイヤー向け表示）を区別。`hotel.level`が上がっただけで全NPCがプレイヤーの位置・変装を知っている扱いにしない。状態復帰時は、無線・目撃履歴に合わせて情報を失効させる。

### 14.10 F11：警備員の追加出現と「全警備員を倒せるか」

- 通常のHITMAN WOAのマップは、**警備員が無限に湧いて消耗戦になることを前提としていない**。警報で集まるのは主として既存のNPCである。警備員の数は通常有限とするプレイヤー検証がある。[B/C] [H11]
- 例外として**スゲール島の鎧の警備員**のように、通常NPCが全員気絶・死亡した後に固有イベントで新NPCが出現するマップもある。[C] [H12] これは一般警報からの無限増援ではない。
- 警備員全排除は一般的な通常任務の目的ではないが、**通常のシステムで物理的に不可能というわけではない**。ただしミッション固有の失敗条件、特殊NPC、出口条件は別に存在する。

**実装指示**：CLEAN HANDS既存の「3波・計12名」の有限増援は**本家と同一仕様ではなく、CLEAN HANDS独自の緊張感演出**として維持する。全体警戒イベントと`spawnWave()`は連動してよいが、1イベントで複数回波が増えないこと。残存警備員0を非法状態と扱わない。

### 14.11 F09・F11：通常警備と特別な警備の能力差

- **「上位の制服＝必ず高HP」ではない**。多くの精鋭・私設護衛の違いは、配置・所属・見破り・行動権限などの属性にある。[B/C] [H7][H10]
- 特殊例として、**HITMAN 3の最終ミッション「Untouchable」のProvidence Commando**は通常NPCより高い耐久性を持つ。耐久性は制服を奪ってもプレイヤーに移転しないため、**外観よりNPC個体／戦闘プロファイルの性質**として考えるのが適切。[C] [H13]
- キャンペーンとFreelancer等の**別モードに固有の特殊敵**を通常マップの共通警備としてカウントしない。

**実装指示**：`combatProfile`を`disguiseId`や階級表示から自動算出しない。通常警備・私設護衛・増援に異なるHPを与えるのはCLEAN HANDSのゲームデザインだが、HITMANの共通公式HP倍率を再現したものとは扱わない。

### 14.12 F12：敵の落としたアイテム・NPC専用装備

- HITMANでは、**変装権限**と**アイテム取得・所持・検査**は別の判定。敵キャラクターの制服を取得しても、そのNPC固有の耐久性等の能力が継承されるとは限らない。[A] [H1]、[C] [H13]
- **CLEAN HANDSの`rifle_npc`がドロップ時に`smg`へ置換される実装**を「HITMANで確認された仕様」として扱う根拠はない。これはCLEAN HANDS独自のバランス方針。

**実装指示**：本家再現とは切り離し、`npcDropItemId`／`playerPickupId`を明示的に持たせる。現状のドロップ変換は維持してよいが仕様書・ゲーム内説明で明示する。

### 14.13 本家参照に基づく実装時の追加確認項目

| ID | HITMANから参照する観測点 | CLEAN HANDSで守るべき不変条件 |
|---|---|---|
| HT01 | エンフォーサーは上司だけではない | `securityRole`と`enforcerDisguises`が独立 |
| HT02 | 同じ制服でもNPCごとに見破り能力が違う | 制服共有で`knowsFaces`まで共有されない |
| HT03 | ホテル内に複数の警備変装カテゴリがある | 所属・アクセス・変装カテゴリの変更がHPと無関係 |
| HT04 | Gunshot Heardは周辺で発生 | 遠隔NPCが発射音を受けず、全館通知との区別が可能 |
| HT05 | Bullet Impact Noticedは銃声とは別 | 着弾イベントの有無で調査理由を区別できる |
| HT06 | Searchingでは犯人未特定 | 事件の知覚のみで`confirmedActor`は真にならない |
| HT07 | 特殊な狙撃反応では発射地点が高精度で特定され得る | 推定地点とプレイヤーの現在地を区別する |
| HT08 | 不適切な変装／違法な持ち物が可視なら疑われる | 装備・携行・視界・検問の判定を分離 |
| HT09 | 本家には検査の**対象外制服**がある | `requiresFrisk()`を先に評価する |
| HT10 | 身体検査は不適切な持ち物があれば開始拒否され得る | `mayStartFrisk()`と検査後の結果を分ける |
| HT11 | 立入違反に退去要求がある | 告発と逮捕が同時の単一判定にならない |
| HT12 | 警戒UIが全館情報網を意味しない | `uiAlert`とNPCの個別知識が独立 |
| HT13 | 通常警備の無限スポーンが前提ではない | 増援が有限・上限を越えない |
| HT14 | 特別な高耐久NPCは外観と別属性 | 戦闘性能は`combatProfile`に保持 |
| HT15 | 検問員と同じ制服なら検査不要になるマップ例がある | マップ・検問ごとのポリシーで上書き可能 |

### 14.14 参照資料（番号は本章内のみ）

**公式資料（A）**

- **[H1]** Feral Interactive配布『HITMAN (2016) Manual』：Disguises / Threats / Alert Levels / Gunshot Heard / Bullet Impact Noticed / Found Trespassing / Illegal Items。<https://www.feralinteractive.com/en/manuals/hitman/latest/linux/>
- **[H2]** IO Interactive「October Patch Notes (2022)」：Dartmoor Securityの検査対象外制服への修正。<https://ioi.dk/hitman/patch-notes/2022/october-patch-notes>
- **[H3]** IO Interactive「Game Update 3.290.1」（2026-10-29）：NPCの違法アイテム視認と遮蔽、関連知識共有の修正。<https://ioi.dk/de/hitman/patch-notes/2026/game-update-3-290-1>
- **[H9]** IO Interactive「February 2021 Patch Notes」：重慶の特定警備服に対する身体検査要求の修正。<https://ioi.dk/hitman/patch-notes/2021/february-patch-notes>

**実プレイ資料（B）／コミュニティ資料（C）**

- **[H4]** TJGM, *How Bullet Distractions Work*（2023、更新2025）：着弾・発射地点調査・パニックの再現例。**プレイヤー検証であり公式仕様書ではない。** <https://steamcommunity.com/sharedfiles/filedetails/?id=2957831754>
- **[H5]** TJGM, *How Sniper Rifles Work*（2023）：特定条件での発射地点の高精度特定と本人認識の違い。**プレイヤー検証。** <https://steamcommunity.com/sharedfiles/filedetails/?id=2964294830>
- **[H6]** Gamepressure, *Hitman: Disguises Bangkok*（2017）：ホテル警備、Cross側護衛、Morgan側護衛のカテゴリ・区域・見破りの実例。<https://www.gamepressure.com/hitman/disguises-bangkok/z29513>
- **[H7]** Hitman Wiki, *Disguise*／*World of Assassination*：制服・アイテムの許可範囲と例外。**非公式Wiki。** <https://hitman.fandom.com/wiki/Disguise>
- **[H8]** Hitman Wiki, *Frisking*：違法アイテム所持時に検査開始できない仕組みの説明。**非公式Wiki。** <https://hitman.fandom.com/wiki/Frisking>
- **[H10]** Hitman Wiki, *NPC*／*World of Assassination*：退去案内、Hostile Area、警備員の行動傾向。**非公式Wiki。** <https://hitman.fandom.com/wiki/NPC>
- **[H11]** Steam Community, *Guard population in levels...*（2018）：通常ミッションのNPC数は有限というプレイヤー経験談。**公式保証ではない。** <https://steamcommunity.com/app/863550/discussions/0/1742226629868786931/>
- **[H12]** r/HiTMAN「Isle of Sgail's Knight Guards」（2021等）：特定条件の鎧NPC出現例。**特殊イベント、一般増援と混同しない。** <https://www.reddit.com/r/HiTMAN/comments/njyisa/>
- **[H13]** Hitman Wiki, *Untouchable*：Providence Commandoの高耐久と制服非継承の記述。**非公式Wiki。** <https://hitman.fandom.com/wiki/Untouchable>

> **出典に関する制限**：上記はプレイヤーが観測できるゲーム挙動に関する参考情報。HITMANの非公開AIソースコード、内部の音響判定式、個別NPCの完全な状態遷移表、全バージョンでの一致を保証するものではない。「ゲームで観測された挙動」と「CLEAN HANDSに実装する選択」を必ず分けること。

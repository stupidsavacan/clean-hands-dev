# 引き継ぎ：CLEAN HANDS の Claude 側の作業（2026-11-01）

あなたは、前の Claude セッションの作業を引き継ぎます。同じフォルダで作業します。まずこの文書を最後まで読み、次に「最初にすること」を行ってください。

## 1. 役割の分担

- **ユーザー**：遊んで、メモを残し、方針を決める。
- **Codex**：ゲームのコード・データ・設計書を書く。
- **Claude（あなた）**
  - Codex への依頼文を書く（`investigation\codex-prompt-*-YYYYMMDD.md`）。
  - Codex の成果を確かめる（テスト、スクリプト、ヘッドレスのブラウザ、写真）。
  - プレイテストの道具（`playtest\`）を作り、保つ。ここだけは Claude が直接コードを書く。
  - 遊んだ記録とメモを読み、原因を突き止め、次の依頼にまとめる。

ゲーム本体（`app\src\`、`index.html`、`party-prototype.html` など）は、原則 Claude が直接直しません。直すべきことは、Codex への依頼にします。

## 2. 場所

- 作業の根：`C:\Users\gamit\Documents\Codex\2026-10-26\https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page\outputs\m5-prototype`（以下「根」）
- `index.html`：ホテル（グランド・マリーナ・ホテル）
- `party-prototype.html`：夜会の私邸。今、Codex が第2版に置き換え中。第1版は `party-prototype-v1.html`。
- `app\src\`：ゲームのソース（TypeScript, Three.js）。夜会は `app\src\party\`。
- `investigation\`：依頼文・報告・設計書・調べたスクリプト
- `playtest\`：プレイテストの道具（`server.py`、`playtest.js`、`debug.js`、`README.md`、`start.bat`、`runs\`）
- `investigation\claude-tools\`：前の Claude が使ったヘッドレス確認スクリプト（下の 5.3）

## 3. 守ること

- **返答は日本語。** ユーザー向けの文は、平易に、短い文で。
- **頼まれたことだけ変える。** ついでの改善はしない。提案するだけにする。
- **git の commit・push は、頼まれたときだけ。**
- **公開（Artifact など）は、ユーザーの許可を取ってから。**
- **モバイル版は、iPad 第9世代の横持ちだけを対象にする。**
- **捕まる仕組み（`ai.ts` の `caught`）は、2026-11-02 に HITMAN 式へ変えた（ユーザーの判断）。** 立入禁止は警告→取り押さえ→捕まる。これ以上は、頼まれない限り変えない。
- **`playtest\runs\` で消してよいのは、自分の試験で作った記録だけ。** 見分け方は、JSON の中に `HeadlessChrome` が含まれること。ユーザーの記録は、頼まれない限り消さない。
- 自分の記憶（memory）にも、ユーザーの好みが入っています（Agent 47 の似せ方、描画の照明、GPT Sol のモデルを参考にしない、など）。会話の始めに出る一覧を読んでください。

## 4. Codex への依頼文の書き方

- 先に `investigation\codex-working-guide.md` を読んでください。前の Claude が Codex に渡した「作業の仕方」で、スクリプトや README を作る基準、ブラウザでの確かめ方、モデルの決まりが書いてあります。依頼文はこれと矛盾させないこと。
- 形は、これまでの依頼文に合わせます。例：`codex-prompt-party-v2-stage1-20261101.md`、`codex-prompt-playtest2-20261101.md`。
  - 見出しと箇条書き。1文は短く。何を・どこを・合格の条件・守ること・報告、の順。
  - 座標・ファイル名・関数名など、確かめた事実を書く。推測は推測と書く。
  - 「確かめたこと」と「直してほしいこと」を分ける。原因が分かっていれば書く。
- 依頼文を書いたら、パスをユーザーに伝えて終わり。Codex に渡すのはユーザーです。

## 5. プレイテストの道具

### 5.1 サーバー（`playtest\server.py`、127.0.0.1:8795）

- `/`：ホテル。`/party`：夜会（`..\party-prototype.html`）。どちらにも `/playtest.js` と `/debug.js` を差し込む。
- `/api/chances`・`/api/schedule`・`/api/actions` は、`?map=party` を付けると `party-*.json` を返す。
- `POST /api/discard`：その記録を消し、id を `DISCARDED` に入れる。以後その id の保存は 410。
- 再起動の仕方（PowerShell で古いものを止めてから、背景で起動）：
  - 止める：`Get-CimInstance Win32_Process | ? { $_.CommandLine -like '*server.py*' } | % { Stop-Process -Id $_.ProcessId -Force }`
  - 起動（Bash、`playtest\` で、背景実行）：`PYTHONIOENCODING=utf-8 "C:/Users/gamit/AppData/Local/Programs/Python/Python311/python.exe" server.py`
- 古いページを開いたままだと、消した記録を保存し直すことがある。そのときは、ユーザーにページの再読み込みを頼む。

### 5.2 記録（`playtest.js`）とデバッグ画面（`debug.js`、F9）

- `playtest.js`
  - パスからマップを決める（`MAP`、`MAPS`、マップごとの `TARGET`）。夜会の記録は id に `party-` が付く。
  - 3秒以内にくり返す `player.spotted`・`witness.*`・`player.hit` は、1行にまとめる（`repeat`、`lastPlay`）。
  - `debug.cheat` の出来事が来たら、その作戦の記録を捨てる（デバッグ中は記録しない）。
  - 作戦の途中でシナリオを選び直すと、変わるのは次の作戦から。表示は「次の作戦から：…」。
  - 選ぶ画面を開くと `document.exitPointerLock()` を呼ぶ（ヘッドレスでクリックできるように）。
- `debug.js`
  - タブ：自分／オンオフ／イベント／人／移動・時間。
  - オンオフ11個は localStorage に保存。`Npc.prototype.perceive`・`watchFace`・`move`、`detection.sees`、`m3.discover` を差し替えて実現。
  - 夜会では `/api/actions?map=party` から行動を読み、フラグは `field().flags`、行動は `field().complete(id,p)` で起こす。
  - 部屋への瞬間移動は、家具の中に出ないよう、3m の渦巻きで空いた床を探す。
  - `window.__ptDebug.active()` で、デバッグ中かが分かる。
- **ゲーム側との約束**：`window.__cleanHands`（`state()`、`chances()` など）、`party-actions.json` の `acts[].{id,label,at}`、`party-chances.json` の `window`（シナリオの開始時刻をここから決める）。第2版でも保つよう、Codex に頼んであります。

### 5.3 ヘッドレスで確かめる

- Playwright：`C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`（`createRequire` で読む）
- Chromium：`C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe`、引数 `--enable-gpu --use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist`
- 道具を通さずにゲームだけ見るときは、根で静的サーバーをポート 8796 に立て、終わったら止める。
- 読み込み完了の待ち方：`window.__cleanHands?.state().modelReady`
- ヘッドレスの fps は 90 で頭打ち。性能の判断には使えない。
- `investigation\claude-tools\` のスクリプト（写真はスクリプトと同じフォルダに出る）
  - `party-check.cjs`：夜会を開いて、説明画面・開始・舞踏室の写真とエラーを取る
  - `pt-party.cjs`：道具の2つのマップで、選ぶ画面とデバッグの各タブが壊れていないか
  - `pt-scenario.cjs`：夜会のシナリオを選ぶと、正しいチャンスが追跡されるか
  - `pt-switch.cjs`：デバッグのオンオフの確認
  - どれも最後に、自分が作った記録（`HeadlessChrome` を含むもの）を消す。

### 5.4 マップの構造を調べる

- `investigation\map-topology.ts`：ナビの格子から区域のつながり（区域・開口・行き止まり）を数える。Codex がマップを引数で選べるようにした。
- ホテル：26区域、51開口、行き止まり5。ハブと枝の形。表と裏の動線がなく、上下のつながりが少ない（`map-structure-audit-20261101.md`、`hitman-map-comparison-20261101.md`）。

## 6. ここまでの流れ

1. ホテルのプレイテストで、デバッグ画面、記録の重複まとめ、デバッグ中の記録停止を作った。
   - JSON が 14,900件に膨らんだ原因：`detection.ts` で、通報できる警備がいないと `deliver(n,null)` がくり返す。
2. 2回目のプレイテストの直しを Codex に頼んだ（`codex-prompt-playtest2-20261101.md`、報告は `playtest2-fixes-report.md`）。
   - 増援の持つ銃と落とす銃が違う件は、保留。
3. マップの構造監査と HITMAN との比較をして、「構造が悪い」という結論になった。
   - ユーザーは「案2」を選んだ：別の試作マップ（夜会の私邸）を作る。
4. 夜会の第1版を Codex が作った（`party-design.md`、`party-implementation-report.md`）。道具を夜会に対応させた。
   - ユーザーの評価は「正直試作すぎる」。簡単すぎ（3分33秒でゴースト）、チャンス探しがない、隠し場所59個、作りの粗さ7件。
5. 上位モデルで第2版を設計させた（`party-v2-design.md`、`party-v2-coordinate-tables.md`、`party-v2-people.md`、図）。
   - 前の Claude が見つけた食い違い：階段 S5 が 1階の厨房と使用人室のあいだの壁 W027 を突き抜け、給仕長 W01 (18,0,24) が張り出しの下にいる。
6. **今：Codex が第2版を第1〜第4段階まで作っている**（依頼は `codex-prompt-party-v2-stage1-20261101.md`）。
   - 段ごとに止まらず、合格の条件を自分で確かめ、`investigation\party-v2-stage<番号>-check.md` を残す。満たせないときだけ止まる。
   - 18:16 の時点で、第1段階と第2段階の点検ファイルがある。

7. **11/2〜11/3：Claude が直接ゲーム本体を直した（ユーザーの指示）。**
   - NPC の認識・戦闘・検問の仕様書 F01〜F12（README「NPCの認識・戦闘・検問の修正」）。
   - 夜会 第2版の第4段階を、Codex の代わりに仕上げた（`party-v2-stage4-check.md`）。生成は `--stage 4`。
   - デバッグ中でも F8 のメモを残せる（`playtest\README.md`）。

## 7. 最初にすること

1. この文書のあと、次を読む：`codex-working-guide.md`、`party-v2-design.md`（とくに 8「作り方の手順」）、`codex-prompt-party-v2-stage1-20261101.md`、`party-v2-stage*-check.md`。
2. ユーザーから「終わった」と言われるまで、ゲーム本体には触らない（Codex が作業中）。
3. 終わったら、Codex の最終報告を読み、次を確かめる。
   - `npm test` と型検査が通ること（件数も）
   - `map-topology.ts` で、19区域・38接続になっていること
   - `party-v2-overlap.ts` の重なりが0件であること
   - 各段の点検ファイルの写真を、自分でも開いて見ること（見た目と当たり判定のずれ、宙に浮く物、階段の見た目）
   - 開始時にチャンスがすべて未発見であること（第1版は `chances.ts` の `afterAi()` で全部発見済みになっていた）
   - 9ルートの歩く試験と、慣れた人の最短が8分以上であること
   - ホテル（`index.html`）が壊れていないこと
   - **道具が第2版で動くこと**：`claude-tools\pt-party.cjs` と `pt-scenario.cjs` を流す。`party-chances.json` の `window` と `party-actions.json` の形が変わっていれば、道具の側を合わせる。
4. 結果をユーザーに日本語で短く伝える。問題があれば、次の依頼文にまとめる。

## 8. 保留していること

- 増援の持つ銃と、落とす銃が違う（6:28、搬入口）
- ホテルのマリーナの検問の設計（遊歩道からは、岸の手すりでふさがっていて入れない。前に「入れる」と誤って伝え、訂正済み）
- モバイル版への反映
- 夜会を本編にどうつなぐか

## 9. 前に起きたつまずき

- テストの中で文字列置換をするとき、同じ文字列が2か所にあると失敗する。前後を含めて一意にする。
- `weapons` の `_note` キーが、空の銃の行として出た。`_` で始まるキーは除く。
- `reserve` は配列。
- 「遊歩道からマリーナへ入れる」と誤って伝えたことがある。地形の主張は、ナビか写真で確かめてから言う。

## 10. 詳しい経緯

前のセッションの会話の全文：
`C:\Users\gamit\.claude\projects\C--Users-gamit-Documents-Codex-2026-10-26-https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page\bc8b7bea-75c9-4971-9885-06d492769817.jsonl`

必要なときだけ、検索して部分的に読んでください（とても長いです）。

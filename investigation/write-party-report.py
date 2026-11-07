from pathlib import Path
import json,re
P=Path(__file__).parent;root=P.parent;app=root/'app'
read=lambda n:json.loads((P/n).read_text(encoding='utf-8'))
routes=read('party-route-results.json');fps=read('party-fps-results.json');hides=read('party-hide-distance.json');audit=read('party-connection-audit.json');m=json.loads((app/'src/data/party.json').read_text(encoding='utf-8'));rules=json.loads((app/'src/data/party-rules.json').read_text(encoding='utf-8'))
log=(P/'party-tests.txt').read_text(encoding='utf-8');assert re.search(r'pass 286\b',log) and re.search(r'fail 0\b',log)
assert fps['traversal']['action'] and not fps['errors']
assert all(e['clear'] for e in audit) and all(h['pass'] for h in hides)
names={'chandelier':'シャンデリア','papers':'書斎の書類','drink':'寝室の飲み物'}
lines=['# 夜会の私邸：実装と検証の報告','', '2026-11-01。遊ぶファイルは `../party-prototype.html` です。','', '## 追加指示1〜6の結果','', '|指示|実装したこと|','|---|---|','|1 検問の意味|庭を敷地内へ移動。正門は検査、使用人入口は制服、西の塀は巡回の目を避ける抜け道。正門はスーツ・毒なしの準備で、歩行→B長押し→横断に成功。|','|2 清掃員の合鍵|Qのみ区域例外。パーティー専用の服ルールでO・Mを禁止。護衛隊長は護衛服の顔を知る。|','|3 外の縁|Lを追加。Q・O・Mの3窓と、庭・屋根の雨どいが接続。窓の腰壁でNPCの普通の歩行を遮断。|','|4 書類の倒し方|書類を窓辺へ差し替え、12〜17分の主人を外の縁から突き落とす事故。|','|5 座標付き図|実装した壁・開口・階段・家具・収納・検問・警備・抜け道の端点から1m＝20pxで生成。回廊の床開口は視線と床の両方をテスト。|','|6 接続の測定|階段の途中を二重に数えず、実際のナビ経路と抜け道の着地点を検査。20区域・37接続で測定結果と一致。|','', '設計の初期案は19区域・36接続でした。Lの追加と、37のR–U、38のM–L、旧27の整理で20区域・37接続にしました。接続先を変えた全番号は party-design.md の差分表にあります。屋根裏は垂直はしごの着地点を作るため40×10mに広げました。','', '## 合格基準','', '|項目|結果|根拠|','|---|---|---|','|行き止まり|0|map-topology.ts。20区域、37接続、1つながり、独立した輪18。|','|チャンスごとの入り方|各3経路を歩行|9件。全経路で通常の服取得・ナビ移動・必要な抜け道を使用。捕まった経路は成功扱いにしない。|','|スタッフだけで全階|地下W→K→S→U→A|階段17・21・32。別の地下階段18もある。|','|隣階の接続数|地下–1階3、1–2階4、2階–屋根裏3|階段とプレイヤー専用の抜け道を含む。|','|15m超の室内|柱・棚・仕切りで分割|舞踏室、使用人通路、屋根裏。人が遊んだときの見やすさは未確認。|',f"|身体の収納までの距離|最大{max(h['maxMetres'] for h in hides):.2f}m|全20区域のナビ格子から、実際の隣接判定で最短歩行距離を測定。|",'|入口の検問と回避2本|正門検査／使用人入口／西の塀|庭から敷地外へ直接無料で入る接続を撤去。|','', f"人は60人。2点以上の巡回または予定を持つ人は58人です。固定2人（3.3%）。身体の収納は{len(m['hides'])}個です。収納の見た目と当たり判定を合わせ、人の初期位置・予定位置・階段・抜け道に重なる配置は除外しました。",'', '## チャンス3件 × 3経路','', '共通の準備は、正門前から使用人入口の外の給仕服へ歩き、T長押しで着替え、厨房・使用人室を通り、仕切りの裏で護衛服に着替える流れです。`dress()`、瞬間移動、NPCの削除は使っていません。','', '時間は MissionClock.jump、採点は ScoreLedger と computeResult、脱出の確定は MissionFlow.exit を使っています。成功例は使用人入口から敷地外へ戻り、E1まで歩いています。正門の検査は別の入場試験で確かめました。','', '|チャンス|経路|排除・脱出|ゴースト|記録と理由|','|---|---|---|---|---|']
for r in routes:
 approach={'chandelier':['H→B','D→B','G→B'],'papers':['R→Q→O','U→O','庭→雨どい22→L→窓36→O'],'drink':['R→Q→O→M','U→M','庭→雨どい22→L→窓38→M']}[r['scene']][r['route']-1]
 reason='発見なし。服を正規に2回取得。' if r['ghost'] else ''
 if r.get('spotted'):
  e=r['spotted'][0];p=e['position'];reason=f"{e['id']}が{e['time']:.2f}秒、({p['x']:.2f}, {p['z']:.2f}, 高さ{p['y']:.2f})で発見。"+('雨どいを客に見られた。' if r['route']==3 else '護衛隊長の前を通った。')
 if r['error']:reason+=r['error']
 lines.append(f"|{names[r['scene']]}|{approach}|{'成功' if r['escaped'] else '失敗'}|{'可' if r['ghost'] else '今回の手順では不可'}|{reason}|")
lines+=['','失敗した試行は、捕縛後も接続の診断のため計算を継続しています。捕縛後の排除は成功に数えていません。失敗した3経路で、時間をずらす・コインを使うなどの別手順は探索していません。ルートそのものがゴースト不可能だとは断定しません。','', '## 抜け道とJSONの値','', '- 定義は party-layout.json の traversals。両端、途中の点、種類、所要時間を持ちます。NPCのナビには追加しません。','- 接近半径は1.15m。E長押しを続けると移動。途中で離すと、開始時の正確な位置へ戻ります。再入力には一度Eを離します。','- 窓は2秒。雨どいは5秒。地下のはしごは5秒。舞踏室のはしごは5秒。回廊–屋根裏は5秒。西の塀と外周は9秒。',f"- 見られると25/秒×見え方を追加します。共通の細工の疑惑{rules['rates']['tamper']}/秒も通常どおり計算します。値はいずれもJSONです。到着後の立入判定は共通の服ルールです。",'- party-motions.json は既存と同じ root・bones の姿勢形式です。肩・肘・脚の簡単な動きを重ねています。手足を足場へ正確に固定する仕上げはしていません。','- 所要時間中は両端の間を補間します。西の塀だけは、外周と塀の上を通る途中の点を使います。','', '## 性能と画面','', 'ヘッドレスChromium、1280×800、DPR 1、60人、AMD Radeon / D3D11。各場所で約4秒の描画間隔を測定しました。計測中にミッションが停止した場所はありません。','', '|場所|平均fps|95%のフレーム時間ms|最低1秒間fps|','|---|---|---|---|']
for r in fps['fps']:lines.append(f"|{r['place']}|{r['fps']}|{r['p95Ms']}|{r['minOneSecondFps']}|")
lines += ['', f"ブラウザの pageerror・console.error は計{len(fps['errors'])}件です。party-fps-results.json はホテルの測定ファイルと同じ config・gpu・fps の形で保存しています。",'', '画面確認では位置と服だけをデバッグから設定しました。これは歩行試験とは別です。各階、回廊、窓を越えている途中の写真を開いて確認しました。','', '- party-briefing.png','- party-view-1f.png','- party-view-ballroom.png','- party-view-b1.png','- party-view-2f.png','- party-view-attic.png','- party-view-gallery.png','- party-view-traversal.png','', '## テストとホテルへの影響','', '- npm test：286件成功、失敗0。party-tests.txt。既存の281件と追加の5件です。','- 追加5件：全抜け道を両方向へ移動、途中解除、目撃による疑惑、清掃員の許可、回廊からの視線と床開口。','- npm run check とパーティー専用のViteビルドに成功。単体HTMLは約6.4MB。','- 共通のゲーム実行コード、hotel.json、ホテルの入口・単体HTMLは変更していません。ホテル専用のm53.ts・m57.tsをパーティーから呼びません。','- 共有の変更は調査用map-topology.tsのみ。モバイル、playtestの道具、サイト、gitには変更を加えていません。','- ブラウザの準備画面から作戦開始を確認しました。人が操作して遊ぶプレイテストはしていません。','', '## 実装の分け方','', 'ホテルのmain.tsを複製し、パーティー専用入口src/party/main.tsを作りました。小さな試作のために、ホテルの描画・入力・結果画面を大きく作り変えないことを優先しました。AI・検問・身体操作・検出・戦闘・採点・予定のモジュールは共通です。専用入口の重複は、今後両方を改修するときに同期が必要です。','', '## 足した・変えたファイル','']
files=['app/party.html','app/vite.party.config.ts','app/scripts/build-party.ts','app/scripts/standalone-party.mjs','app/src/party/main.ts','app/src/party/chances.ts','app/src/party/traversal.ts','app/tests/party.test.ts']+[str(x.relative_to(root)).replace('\\','/') for x in sorted((app/'src/data').glob('party*.json'))]+['investigation/map-topology.ts','investigation/party-audit.ts','investigation/party-hide-distance.ts','investigation/party-routes.ts','investigation/verify-party.mjs','investigation/draw-party-layout.py','investigation/write-party-design.py','investigation/write-party-report.py','investigation/party-design-baseline.json','investigation/party-design.md','investigation/party-implementation-report.md','README.md','party-prototype.html']
lines += ['- '+f for f in files]
lines += ['', '生成した平面図4枚・接続図・層の図、写真、party-connection-audit.json、party-hide-distance.json、party-topology.jsonl、party-route-results.json／jsonl、party-front-results.json／jsonl、party-fps-results.json、テストログ、dist-party/も成果物です。古い設計を再生成するparty-design-draw.pyと、作業中の初期写真・初期結果・初期生成補助は削除しました。元の接続一覧はparty-design-baseline.jsonに保存しました。','', '## 人が遊んで確認すること','', '1. 正門の検査、使用人入口、塀越えの3つから、自分で入口を選べるか。抜け道が正面より簡単すぎないか。','2. 厨房から裏階段を使って屋根裏まで上がり、別の道で庭へ戻れるか。ホテルより回り道を考える楽しさがあるか。','3. 護衛隊長を避けて書斎へ入り、書類のあと外の縁で主人を待てるか。','4. 回廊の床開口から舞踏室を観察できるか。窓・はしご・雨どいの足場が見た目で分かるか。','5. 雨どいで見られた試行について、客がいない時間を待つと通れるか。失敗理由を画面から理解できるか。','6. 服と、その場で働く人の見た目が分かりやすいか。60人の密度、収納の多さ、仮の家具が遊びを邪魔しないか。','', '身体の運搬を含む全収納への実戦経路、全員の30分の予定の網羅、全視線、全持ち込みの組合せ、全ての服の外見、別のPCやiPadの性能は検証していません。ホテルより面白くなったかは、人のプレイテストで判断してください。']
(P/'party-implementation-report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
readme=root/'README.md';text=readme.read_text(encoding='utf-8');heading='## パーティー会場の試作'
if heading in text:text=text[:text.index(heading)].rstrip()+'\n'
text+='''
## パーティー会場の試作

`party-prototype.html` をPCのブラウザで開きます。
ホテルとは別の、夜の私邸と庭の試作です。
「作戦開始」を押して、館の主人1人を排除し、正門前のE1から脱出してください。

- 正門は **B長押し** で身体検査を受けます。毒や銃を持ち込む場合は別の入口を考えます。
- 東の使用人入口はスタッフ服が必要です。入口の外に給仕服があります。**T長押し** で着替えます。
- 西の塀は巡回に見られない時間に越えます。
- はしご・雨どい・窓・縁は印の近くで **E長押し**。離すと元の位置へ戻ります。見られると疑惑が上がります。
- 書斎と主寝室は護衛服が必要です。使用人室の仕切りの裏に予備の服があります。護衛隊長は顔を知っています。
- シャンデリアは回廊で吊り具を緩め、主人が舞踏室に戻る8〜12分を狙います。
- 書斎の書類は主人が来る前に差し替え、12〜17分に外の縁から突き落とします。
- 寝室の飲み物は17〜21分より前に致死毒を仕込みます。
- **Tab** で地図と3つのチャンスを確認できます。

20区域・37接続で、行き止まりはありません。
地下から屋根裏まで、スタッフ区域を通る裏階段がつながります。
外の縁が2階の3室をつなぎ、庭と屋根にも回り込めます。
回廊には舞踏室を見る床の開口があります。

9経路を通常の着替えと歩行で試しました。
6経路は排除・脱出までゴーストでした。
残り3経路では、雨どいで客に見られるか、護衛隊長に発見されました。
隠し場所までの最短歩行距離、抜け道の移動・中断・目撃、ホテルを含む286テストを確認しました。
人が操作しての遊びやすさ、全運搬経路、iPadの性能は確認していません。
詳しい数値・失敗の位置・写真は `investigation/party-implementation-report.md` にあります。

作り直すときは `app` で次を実行します。

```powershell
node --experimental-strip-types scripts/build-party.ts
npm run check
npx vite build --config vite.party.config.ts
node scripts/standalone-party.mjs
```

地形の値は `app/src/data/party-layout.json` です。
このビルドはホテルのHTMLを上書きしません。
'''
readme.write_text(text,encoding='utf-8')
print(json.dumps({'report':'party-implementation-report.md','ghost':sum(r['ghost'] for r in routes),'tests':286,'fps':[r['fps'] for r in fps['fps']]},ensure_ascii=False))

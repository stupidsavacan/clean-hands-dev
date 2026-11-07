# M5.5 モデルとアニメーションの確認

[m55-review.html](m55-review.html) をブラウザで開く。モデル・ライブラリ・アニメを埋め込んだ単体HTMLなので、ローカルファイルでも動く。

- 「モデル」：13点。ドラッグで回転、ホイールで拡大、右ドラッグで平行移動。正面・横・後ろ・全体表示、ワイヤーフレーム、自動回転、GRIP / MUZZLE / STOCK / COVERなどの印を切り替えられる。
- 「アニメーション」：Claudeの既存のcombat-labを利用。主人公・警備員・私設護衛・増援・客と10種類の動きを切り替える。再生・停止、1コマ、速度、時間スライダー、歩きながら、視点を操作できる。増援の人物は既存の警備員モデルを使った仮表示。
- 素材確認用のページ。ゲーム本体への組み込みは別の作業。

## 確認

型チェック成功。headless Chromiumの実GPUでローカルHTMLを開き、13モデルの読み込み、全34組の人物と対応動作、印・ワイヤーフレーム・視点、コマ送り、タブの切り替え、640×800での表示を確認。コンソールエラー0件。

結果：[m55-review-results.json](m55-review-results.json)。画像：screenshots/m55-review-*.png。

## 作り直し

app で次を実行する。元のモデル、アニメのソース、既存のcombat-motionsページは変更しない。

```powershell
npm run check
node scripts/build-m55-review.mjs
node scripts/verify-m55-review.mjs
```

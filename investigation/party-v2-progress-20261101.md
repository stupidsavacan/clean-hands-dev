> **2026-11-03：第4段階は Claude が仕上げた（`party-v2-stage4-check.md`）。以下は Codex が止まった時点の記録。** 生成は `--stage 4` で行う。

# 再開時の作業位置

第1/第2段階の点検報告あり。第3段階のコードとHTMLを作成済み。第3段階は待機時間の条件で合格保留。第4段階へ進まない。
2026-11-02更新。ユーザーは8分下限維持・工程追加なし・時刻前倒しを指示済み。書類11:30、飲み物14:30・再機会28:30へ変更。9経路ゴーストは成立するが準備中90秒を満たすのは1経路。指示どおり不合格で停止。前の二択の質問は撤回済み。

- 最新のビルド：party-prototype.html（stage=3）。第1版：party-prototype-v1.html。
- 段階保存：investigation/party-v2-stage1.html、party-v2-stage2.html、party-v2-stage3.html。
- 9経路：party-v2-routes.ts、party-v2-route-results.json。すべてゴースト成立。最長準備待機527.3秒。
- 8分未満探索：fast-wireの時刻違い7ケース。すべて不成立。網羅的な下限証明ではない。
- テスト296件成功。型検査成功。専用の専用テスト10件。
- 予定：60人519区間全到着、タイムアウト0、衝突0、職員の禁止区域0。
- overlap：5,580標本0件。書斎F21を折返し棚に変更後も再検査済み。
- 写真と欠点はstage3-check.mdを参照。第4段階の未実施項目はstage4-check.md。

## 生成とビルド

1. python investigation/build-party-v2-source.py --stage 3
2. appから node --experimental-strip-types --no-warnings scripts/build-party.ts
3. npm run check
4. npx vite build --config vite.party.config.ts
5. node scripts/standalone-party.mjs

ホテルのビルド、index.html、モバイル、playtest、サイト、gitは変更しない。
元設計のPythonから入力を作る。W08の配置修正はbuild-party-v2-source.pyの冒頭、客の出発遅延は同ファイル内。F21の折返し部分はbuild-party-v2.ts。
party-actions.json、party-chances.json、party-detection.jsonは既存形を保って直接更新済み。今後の生成で古い値へ戻さない。
main.tsにはstage条件と検査用APIを追加してある。window.__cleanHandsの従来APIは保持。

## 検証上の注意

ルート試験は実AI、予定、衝突、M3/M4、DetectionSystem、ScoreLedgerを使う。身体運搬を0.8m/秒に修正後の結果を保存済み。
服の直接付与・NPC削除・移動の瞬間移動はしない。撮影専用スクリプトはデバッグ配置を使い、歩行の証拠とは分けている。
一時停止中は字幕が非表示になるため、字幕撮影だけ短く解除する。写真のmodalは隠すがoverlayを隠すと字幕も消える。
検査用サーバーは8797。最終的には止める。

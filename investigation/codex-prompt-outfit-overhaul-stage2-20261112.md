# 服装の作り直し：段階2へ進んでください（Codex への依頼）

2026-11-12 作成。前の依頼文は [codex-prompt-outfit-overhaul-20261112.md](codex-prompt-outfit-overhaul-20261112.md) です。決まりは前と同じです。

## 段階1の確認結果

`../m5-outfit-overhaul` の a2c1a9b（`stage1-design.md`）を Claude が読み、次を確かめました。よくできています。

- `character-revision/models` は32体で、棚卸しに無いのは `agent`・`dj`・`dj_cast`・`pool_guest_strong` の4つ。報告どおりでした。
- `character-data.ts` の4人は、`protagonist-studies-20261028/models/` の GLB とバイト単位で一致しました。
- worktree の `app/node_modules` は m1 への Junction ですが、`package-lock.json` が m5 と同じなので、このままでかまいません。

部品庫の案、レシピ JSON の案（部品は版付きの登録関数だけ、JSON に式を入れない）、`assets/characters/` の置き場所、比較器の設計は、提案どおりで進めてください。

## 決めたこと

1. **主人公（wardrobe・architect・operative・veteran・agent47）は、作り直しを目指しません。**
   - 主人公は見た目をとても大事にしているので、生成の前段を再現する作業で危険を冒しません。
   - レシピは「固定の資産」の形（例：`assetMode: "fixed"`、元の GLB のパスと SHA-256、部品の内訳は説明として書く）にします。
   - 段階3の「同じ」の判定は、レシピが指す GLB が元と同じバイト列であることで足ります。
   - 新しいキャラの部品庫には、主人公の部品は入れなくてかまいません。
2. **`guest_male` は、提案どおり別名（`aliasOf: "wardrobe"`）にします。**
3. **棚卸しに無い4つ（`agent`・`dj`・`dj_cast`・`pool_guest_strong`）は、段階3で棚卸しに足します。**

## 段階2でやること

前の依頼文の「段階2　3人で試す」と同じです。

1. 最初に、`../character-revision` と `../player-wardrobe` の全ファイルの一覧と SHA-256、全対象 GLB の manifest を記録します。
2. 比較器を作り、先に比較器そのものを試します（自分自身との比較で PASS、頂点・法線・UV・重み・骨・表情・歩き・材質をわざと変えると FAIL、三角形の並び順だけ変えると PASS）。
3. `waiter`・`photographer`・`pool_guest_resort` の3人を、`assets/characters/source/` に写したソースとレシピから作り、3人とも PASS にします。
4. 報告は `investigation/outfit-overhaul/stage2-pilot.md` に書き、**段階3へは進まずに止まってください。**

## 気をつけること

- 外の2つのフォルダの Python は import も実行もしません（報告のとおり、書き込みが起きるため）。写した側から副作用を取り除いてください。
- 比較の許容差（骨 1e-6、ほかは 1e-5）をゆるめません。PASS にならない時は、ゆるめずに原因を報告します。
- 確認用サーバー（8795〜8798）は止めません。push もしません。

# 服装の作り直し：段階3へ進んでください（Codex への依頼）

2026-11-12 作成。前の依頼文は [codex-prompt-outfit-overhaul-20261112.md](codex-prompt-outfit-overhaul-20261112.md) と [stage2](codex-prompt-outfit-overhaul-stage2-20261112.md) です。決まりは同じです。

## 段階2の確認結果

`../m5-outfit-overhaul` の 0e2d951（`stage2-pilot.md`）を Claude が確かめました。よくできています。

- 比較器とは別に、GLB の中身を Claude が自分で比べました。3人とも BIN（形・重み・表情・歩き）はバイト単位で同じでした。JSON の違いは、waiter と pool_guest_resort の画像の名前（`palette` → `CLEAN_HANDS_Palette_256`）だけでした。
- `waiter.glb` を消して、レシピから Claude が作り直すと、あなたの候補と同じ SHA-256（238928ac…）になりました。レシピから作られていることを確かめられました。
- 比較器の試験15件と `verify_pilot.py` は、Claude が回しても PASS でした。
- 元の29体の GLB は、11/10 に Claude が記録した SHA-256 から1バイトも変わっていません。

## 段階3で足してほしいこと

1. **画像の名前を元と同じ `palette` にしてください。**
   - ファイルへ保存する副作用は、戻さなくてかまいません。メモリ上の画像の名前だけを合わせます。
   - そうすると、ほとんどのキャラが元と**バイト単位で同じ**になり、確かめが一番強くなります。
   - 結果の表に「バイト一致」「数値一致（PASS）」「FAIL」を分けて書いてください。
2. 前の依頼文の「段階3　全員」と、stage2 の依頼文の「決めたこと」（主人公は固定の資産、`guest_male` は別名、棚卸しに4つ足す）を行います。
3. 報告は `investigation/outfit-overhaul/stage3-all.md` に書き、**段階4へは進まずに止まってください。**

## 気をつけること

- 段階2の報告にあるとおり、女性・体型の変形、Face の全キーの変形、DJ の置き換え、response の専用の処理は、元と同じ順序で移します。
- `build_uniforms.py` は、11/10 に Astra が DJ の3案（`dj`・`dj_experiment`・`dj_cast`）を足した後の版が、今の元です。写す時は今の版を使い、`source-provenance.json` に写した時の SHA-256 を書きます。
- 比較の許容差はゆるめません。PASS にならない時は、ゆるめずに原因と前後の画像を報告します。
- `../character-revision` と `../player-wardrobe` は変えません。確認用サーバー（8795〜8798）は止めません。push しません。

# 従来の服装ラボの部品

元の `outputs/agent07-jacket/` の build_jacket.py / blend / GLBをコピーしたものです。外部の元ファイルは変更しません。

リポジトリのルートで次を実行すると、外部フォルダを読まずに再生成できます。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --python-exit-code 1 -P assets/outfits/agent07-jacket/build_jacket.py
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --python-exit-code 1 -P app/scripts/build-repository-outfit-catalog.py
```

コピー側の変更は、参照するヘルパーを `assets/characters/source/` に変更し、外部出力先設定とレンダーを省き、出力をこのフォルダへ固定した点です。2本目は従来の `app/scripts/build-outfit-catalog.py` を基にしたリポジトリ内専用版です。catalog.blend / catalog.glbに全パーツを収めます。

新しい部品庫には半袖/襟付きシャツ、ジーンズ/ワイド/スラックス、サングラス/帽子/タイ、フィールドとフライトの襟・丈4変種ずつ、ブレザーを登録しました。体型互換性は元のキャスト男性だけに限定します。女性・プール体型へ未調整の上着を着せることはできません。

新規キャラのBlender生成はcatalog.blendから服のメッシュを読み、生成した22骨リグへ付け替えます。頭・顔・主人公の固定資産をこのライブラリから取り込むことはありません。

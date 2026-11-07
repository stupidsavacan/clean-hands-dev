# One overview image of every asset (3/4 view) plus the scale lineup. python make_sheet.py
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent
info = json.loads((OUT / 'build-info.json').read_text(encoding='utf-8'))
font = next((ImageFont.truetype(f, 22) for f in ('C:/Windows/Fonts/YuGothM.ttc', 'C:/Windows/Fonts/meiryo.ttc') if Path(f).exists()), ImageFont.load_default())
cols, w, h = 5, 400, 330
rows = (len(info) + cols - 1) // cols
lineup = Image.open(OUT / 'renders' / 'lineup-with-guard.png'); lw = cols * w; lh = int(lineup.height * lw / lineup.width)
sheet = Image.new('RGB', (cols * w, rows * h + lh), (166, 172, 180)); d = ImageDraw.Draw(sheet)
for i, e in enumerate(info):
    im = Image.open(OUT / 'renders' / f"{e['id']}-35.png").resize((w, 300))
    x, y = i % cols * w, i // cols * h
    sheet.paste(im, (x, y)); d.text((x + 10, y + 300), f"{e['label']}  {e['triangles']} tri", fill=(25, 28, 34), font=font)
sheet.paste(lineup.resize((lw, lh)), (0, rows * h))
sheet.save(OUT / 'overview.jpg', quality=90)
print('overview.jpg', sheet.size)

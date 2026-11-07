# One overview image of the gunplay motions, from the lab proof shots (app/scripts/verify-combat.mjs). python make_motion_sheet.py
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent
PROOF = OUT.parents[1] / 'combat-motions' / 'proof'
SHOTS = [('agent-draw-0.3-35', '銃を出す（腰から抜く）'), ('agent-aim-0-35', '構え（拳銃）'), ('agent-aim-0-walk-35', '構えて歩く'), ('agent-fire-0.18-35', '撃つ'),
         ('agent-reload-0.44-35', '弾を込める（ポーチ）'), ('agent-reload-0.85-35', '弾を込める（スライド）'), ('agent-hit-0.22-side', '被弾のよろけ'), ('agent-cover-0-side', '遮蔽に隠れる'),
         ('agent-coverAim-1-side', '遮蔽から構える'), ('bodyguard-draw-0-35', '低く構える（短機関銃）'), ('bodyguard-aim-0-35', '構え（短機関銃）'), ('bodyguard-cover-0-35', '遮蔽に隠れる（短機関銃）'),
         ('response-aim-0-side', '構え（突撃銃）'), ('response-fire-0.18-35', '撃つ（突撃銃）'), ('guest-flee-0.25-35', '一般人が逃げる'), ('guest-duck-1-35', '一般人が伏せる')]
font = next((ImageFont.truetype(f, 22) for f in ('C:/Windows/Fonts/YuGothM.ttc', 'C:/Windows/Fonts/meiryo.ttc') if Path(f).exists()), ImageFont.load_default())
cols, w, h = 4, 450, 316
sheet = Image.new('RGB', (cols * w, (len(SHOTS) + cols - 1) // cols * (h + 34)), (17, 25, 30)); d = ImageDraw.Draw(sheet)
for i, (name, label) in enumerate(SHOTS):
    im = Image.open(PROOF / f'{name}.png').crop((120, 0, 780, 460)).resize((w, h))
    x, y = i % cols * w, i // cols * (h + 34)
    sheet.paste(im, (x, y)); d.text((x + 10, y + h + 4), label, fill=(233, 228, 218), font=font)
sheet.save(OUT / 'motion-overview.jpg', quality=88)
print('motion-overview.jpg', sheet.size)

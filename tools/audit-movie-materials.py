"""Verify raw movie takes and produce an inventory and contact sheet; no movie edit."""
import hashlib
import json
import re
import wave
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MOVIE = ROOT / 'movie'
source = (ROOT / 'app/src/observatory/trailer.ts').read_text(encoding='utf-8')
takes = re.findall(r"name:'([^']+)'[^\n]*?frames:(\d+)", source)
sheet = Image.new('RGB', (1280, 210 * len(takes)), '#171b22')
draw = ImageDraw.Draw(sheet)
report = []
for row, (name, count) in enumerate(takes):
    count = int(count)
    folder = MOVIE / 'frames' / name
    files = sorted(folder.glob('*.jpg'))
    errors = []
    if [f.name for f in files] != [f'{i:05d}.jpg' for i in range(count)]:
        errors.append('Frame count or sequence differs from the capture plan')
    digest = hashlib.sha256()
    sizes = set()
    for f in files:
        data = f.read_bytes()
        digest.update(f.name.encode())
        digest.update(data)
        try:
            with Image.open(f) as im:
                sizes.add(im.size)
                im.load()
        except Exception as e:
            errors.append(f'{f.name}: {e}')
    if sizes != {(2880, 1620)}:
        errors.append(f'Unexpected image sizes: {sizes}')
    picks = [0, count // 3, count * 2 // 3, count - 1]
    for col, k in enumerate(picks):
        f = folder / f'{k:05d}.jpg'
        if f.exists():
            with Image.open(f) as im:
                im.thumbnail((320, 180))
                sheet.paste(im, (col * 320, row * 210 + 25))
        draw.text((col * 320 + 5, row * 210 + 5), f'{name} / {k:05d}', fill='white')
    report.append(dict(take=name, frames=len(files), expected=count,
                       seconds=count / 30, dimensions=sorted(sizes),
                       sha256=digest.hexdigest(), errors=errors))
    print(name, len(files), 'OK' if not errors else errors, flush=True)
audio = None
audio_path = MOVIE / 'work/sound.wav'
if audio_path.exists():
    with wave.open(str(audio_path)) as w:
        audio = dict(path='work/sound.wav', channels=w.getnchannels(),
                     sample_rate=w.getframerate(), seconds=w.getnframes()/w.getframerate(),
                     note='Existing draft soundtrack; final edit synchronization not verified.')
result = dict(session='532b51e3-e7d7-4faa-b796-7ed4c17b5156', fps=30,
              total_frames=sum(r['frames'] for r in report), takes=report, audio=audio,
              complete=all(not r['errors'] for r in report))
(MOVIE / 'materials-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
sheet.save(MOVIE / 'materials-contact-sheet.jpg', quality=92)
assert result['complete'], 'Materials verification failed'
print('COMPLETE', result['total_frames'], flush=True)

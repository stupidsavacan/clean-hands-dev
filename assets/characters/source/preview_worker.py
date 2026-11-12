"""A Blender kept running for the outfit lab's live preview (2026-11-12).

Started once by tools/outfit_service.py:
    blender -b --factory-startup --python-exit-code 1 -P preview_worker.py
It reads one recipe path per line on stdin and answers one line on stdout:
    WORKER_DONE {"id": ..., "output": ..., "sha256": ...}   or   WORKER_ERROR <message>
Only recipes under recipes/preview/ are built here. Body-variant profiles patch the pool builder for the whole
process, so the service builds those in a fresh Blender instead (see VARIANTS in build_recipe.py).
"""
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_recipe  # noqa: E402

PREVIEW = (build_recipe.ASSETS / 'recipes' / 'preview').resolve()

print('WORKER_READY', flush=True)
for line in sys.stdin:
    path = Path(line.strip()).resolve()
    try:
        if path.parent != PREVIEW or path.suffix != '.json':
            raise ValueError('Only preview recipes are built here')
        recipe = json.loads(path.read_text(encoding='utf-8'))
        if recipe.get('body', {}).get('profile') in build_recipe.VARIANTS:
            raise ValueError('Body variants are built in a fresh Blender')
        result = build_recipe.build(path)
        print('WORKER_DONE ' + json.dumps({k: result[k] for k in ('id', 'output', 'sha256')}), flush=True)
    except Exception as exc:  # report and keep serving
        print('WORKER_ERROR ' + str(exc).replace('\n', ' ')[:500], flush=True)

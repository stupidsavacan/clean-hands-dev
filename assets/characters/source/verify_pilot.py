"""Recheck stage-2 baselines, the protected trees, and all three generated pilots.

Run from any directory: python assets/characters/source/verify_pilot.py
Reads external assets; writes only stage2 verification results in this worktree.
"""
import base64
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

from compare_glb import Glb, compare

ROOT = Path(__file__).resolve().parents[3]
REPORTS = ROOT / 'investigation/outfit-overhaul'
PILOTS = ('waiter', 'photographer', 'pool_guest_resort')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def save(name, value):
    (REPORTS / name).write_bytes((json.dumps(value, ensure_ascii=False, indent=2)+'\n').encode())


def verify():
    snapshot = json.loads((REPORTS / 'stage2-protected-files.json').read_text(encoding='utf-8'))
    manifest = json.loads((REPORTS / 'stage2-baseline-models.json').read_text(encoding='utf-8'))
    result = {'checkedAt': datetime.now(timezone(timedelta(hours=9))).isoformat(),
              'protectedTrees': {}, 'baselines': [], 'pilots': []}
    for name, expected in snapshot['trees'].items():
        base = ROOT.parent / name
        actual = {}
        for path in sorted(base.rglob('*')):
            if path.is_file():
                raw = path.read_bytes()
                actual[path.relative_to(base).as_posix()] = (len(raw), digest(raw))
        old = {v['path']: (v['bytes'], v['sha256']) for v in expected}
        changes = sorted(k for k in old.keys() | actual.keys() if old.get(k) != actual.get(k))
        result['protectedTrees'][name] = {'status': 'FAIL' if changes else 'PASS', 'files': len(actual), 'changes': changes}
    src = (ROOT / 'app/src/character-data.ts').read_text(encoding='utf-8')
    embedded = json.loads(src[src.index('={')+1:].strip().rstrip(';'))
    for entry in manifest['models']:
        raw = base64.b64decode(embedded[entry['id']]) if '#' in entry['source'] else (ROOT / entry['source']).read_bytes()
        result['baselines'].append({'id': entry['id'], 'status': 'PASS' if len(raw) == entry['bytes'] and digest(raw) == entry['sha256'] else 'FAIL'})
    for id in PILOTS:
        entry = next(m for m in manifest['models'] if m['id'] == id)
        source = ROOT / entry['source']
        candidate = ROOT / 'assets/characters/models' / id / (id+'.glb')
        recipe = ROOT / 'assets/characters/recipes' / (id+'.json')
        description = json.loads(recipe.read_text(encoding='utf-8'))
        try:
            comparison = compare(Glb(source), Glb(candidate))
            if description['reference'] != {'baselineId': id, 'sha256': entry['sha256']}:
                comparison['status'] = 'FAIL'
                comparison['differences'].append('recipe baseline reference/hash mismatch')
        except Exception as exc:
            comparison = {'status': 'FAIL', 'differences': [type(exc).__name__ + ': ' + str(exc)]}
        comparison.update(id=id, reference=entry['source'], candidate=candidate.relative_to(ROOT).as_posix(),
                          referenceSha256=digest(source.read_bytes()), candidateSha256=digest(candidate.read_bytes()),
                          recipeSha256=digest(recipe.read_bytes()))
        save('stage2-compare-'+id+'.json', comparison)
        result['pilots'].append(comparison)
    statuses = [v['status'] for v in result['protectedTrees'].values()] + [v['status'] for v in result['baselines']] + [v['status'] for v in result['pilots']]
    result['status'] = 'PASS' if all(v == 'PASS' for v in statuses) else 'FAIL'
    save('stage2-verification.json', result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(verify())

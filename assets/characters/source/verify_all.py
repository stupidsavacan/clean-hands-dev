"""Stage 3: verify protected files, all recipes, inventory and all 37 assets."""
import base64
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path

from compare_glb import Glb, compare

ROOT = Path(__file__).resolve().parents[3]
REPORTS = ROOT / 'investigation/outfit-overhaul'
RECIPES = ROOT / 'assets/characters/recipes'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def save(name, data):
    (REPORTS / name).write_bytes((json.dumps(data, ensure_ascii=False, indent=2)+'\n').encode())


def verify():
    snapshot = read(REPORTS/'stage3-protected-files.json')
    baseline = read(REPORTS/'stage2-baseline-models.json')
    recipes = {p.stem: read(p) for p in sorted(RECIPES.glob('*.json'))}
    src = (ROOT/'app/src/character-data.ts').read_text(encoding='utf-8')
    embedded = json.loads(src[src.index('={')+1:].strip().rstrip(';'))
    result = {'checkedAt': datetime.now(timezone(timedelta(hours=9))).isoformat(),
              'protectedTrees': {}, 'preservedUserChanges': {}, 'assets': [], 'aliases': [], 'errors': []}
    for name, expected in snapshot['trees'].items():
        base = ROOT.parent/name
        actual = {}
        for p in sorted(base.rglob('*')):
            if p.is_file():
                raw = p.read_bytes()
                actual[p.relative_to(base).as_posix()] = (len(raw), sha(raw))
        original = {x['path']: (x['bytes'], x['sha256']) for x in expected}
        changes = sorted(k for k in actual.keys() | original.keys() if actual.get(k) != original.get(k))
        result['protectedTrees'][name] = {'status': 'FAIL' if changes else 'PASS', 'files': len(actual), 'changes': changes}
    for name, digest in snapshot['preservedUserChanges'].items():
        result['preservedUserChanges'][name] = 'PASS' if sha((REPORTS/name).read_bytes()) == digest else 'FAIL'
    expected_ids = {m['id'] for m in baseline['models']} | {a['id'] for a in baseline['aliases']}
    inventory = read(ROOT/'app/src/labs/outfit-inventory.json')
    if set(recipes) != expected_ids or {e['id'] for e in inventory} != expected_ids or len(inventory) != len(expected_ids):
        result['errors'].append('Recipe/inventory/baseline IDs differ')
    for entry in inventory:
        if entry.get('recipe') != 'assets/characters/recipes/'+entry['id']+'.json':
            result['errors'].append('Invalid inventory recipe: '+entry['id'])
    for entry in baseline['models']:
        id = entry['id']
        recipe = recipes[id]
        reference = base64.b64decode(embedded[id]) if '#' in entry['source'] else (ROOT/entry['source']).read_bytes()
        candidate_path = ROOT/'assets/characters/models'/id/(id+'.glb')
        try:
            if len(reference) != entry['bytes'] or sha(reference) != entry['sha256']:
                raise ValueError('Original GLB differs from stage-2 baseline')
            if recipe['assetMode'] == 'fixed':
                candidate_path = ROOT/recipe['source']
                candidate = candidate_path.read_bytes()
                if recipe['sha256'] != entry['sha256'] or candidate != reference:
                    raise ValueError('Fixed asset byte mismatch')
                comparison = {'status': 'PASS', 'differences': []}
            elif recipe['assetMode'] == 'generated':
                candidate = candidate_path.read_bytes()
                comparison = compare(Glb(reference), Glb(candidate))
                if recipe['reference'] != {'baselineId': id, 'sha256': entry['sha256']}:
                    raise ValueError('Recipe baseline mismatch')
            else:
                raise ValueError('Invalid asset mode')
            comparison.update(classification=('byte-match' if reference == candidate else 'numeric-match') if comparison['status'] == 'PASS' else 'FAIL',
                              referenceSha256=sha(reference), candidateSha256=sha(candidate))
        except Exception as exc:
            comparison = {'status': 'FAIL', 'classification': 'FAIL', 'differences': [type(exc).__name__+': '+str(exc)]}
        comparison.update(id=id, assetMode=recipe['assetMode'], source=entry['source'],
                          candidate=str(candidate_path.relative_to(ROOT)) if candidate_path.is_relative_to(ROOT) else str(candidate_path),
                          recipeSha256=sha((RECIPES/(id+'.json')).read_bytes()))
        result['assets'].append(comparison)
    for alias in baseline['aliases']:
        recipe = recipes[alias['id']]
        target = next(x for x in result['assets'] if x['id'] == alias['aliasOf'])
        ok = recipe['assetMode'] == 'alias' and recipe['aliasOf'] == alias['aliasOf'] and target['status'] == 'PASS'
        result['aliases'].append({'id': alias['id'], 'aliasOf': alias['aliasOf'], 'status': 'PASS' if ok else 'FAIL'})
    statuses = [x['status'] for x in result['assets']+result['aliases']] + [x['status'] for x in result['protectedTrees'].values()] + list(result['preservedUserChanges'].values())
    result['status'] = 'PASS' if not result['errors'] and all(s == 'PASS' for s in statuses) else 'FAIL'
    result['counts'] = {key: sum(x['classification'] == key for x in result['assets']) for key in ['byte-match', 'numeric-match', 'FAIL']}
    save('stage3-verification.json', result)
    print(json.dumps({'status': result['status'], 'counts': result['counts'], 'errors': result['errors'],
                      'failures': [x for x in result['assets'] if x['status'] == 'FAIL']}, ensure_ascii=False, indent=2))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(verify())

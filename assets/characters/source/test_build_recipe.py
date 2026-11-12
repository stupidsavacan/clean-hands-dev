"""Small Blender-side checks for the recipe registry; does not export a GLB."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_recipe as builder


class RecipeTests(unittest.TestCase):
    def recipe(self):
        return json.loads((HERE.parent/'recipes/waiter.json').read_text(encoding='utf-8'))

    def test_all_recipes_validate(self):
        for path in sorted((HERE.parent/'recipes').glob('*.json')):
            builder.validate(json.loads(path.read_text(encoding='utf-8')))

    def test_external_sources_not_imported(self):
        for module in (builder.bc, builder.bp, builder.bu):
            self.assertEqual(Path(module.__file__).resolve().parent, HERE)
        for module in list(sys.modules.values()):
            file = getattr(module, '__file__', None)
            if file:
                self.assertNotIn('character-revision', str(Path(file).resolve()))
                self.assertNotIn('player-wardrobe', str(Path(file).resolve()))

    def test_reject_unsupported_operations_and_parameters(self):
        original = self.recipe()
        def invalid(change):
            value = copy.deepcopy(original)
            change(value)
            with self.assertRaises((ValueError, KeyError)):
                builder.validate(value)
        invalid(lambda r: r.update(id='../outside'))
        invalid(lambda r: r.update(id='agent47'))
        invalid(lambda r: r['parts'][0].update(part='__import__'))
        invalid(lambda r: r['parts'][0]['colors'].update(skin=16))
        invalid(lambda r: r['parts'][0]['colors'].update(skin=True))
        invalid(lambda r: r['parts'][0]['parameters'].update(expression='1+1'))
        invalid(lambda r: r['body'].update(profile='pool.resort.v1'))
        invalid(lambda r: r['specialOperations'].reverse())
        invalid(lambda r: r['palette']['overrides'].update({'0': 'ffffff'}))

    def test_fixed_assets_and_alias_do_not_generate_files(self):
        before = {p: p.read_bytes() for p in (HERE.parent/'models').rglob('*') if p.is_file()}
        for id in ('wardrobe','architect','operative','veteran','agent47','guest_male'):
            result = builder.build(HERE.parent/'recipes'/(id+'.json'))
            self.assertEqual(result['assetMode'], 'fixed')
        after = {p: p.read_bytes() for p in (HERE.parent/'models').rglob('*') if p.is_file()}
        self.assertEqual(before, after)

    def test_reject_fixed_hash_mismatch_and_alias_redirection(self):
        fixed = json.loads((HERE.parent/'recipes/agent47.json').read_text(encoding='utf-8'))
        wrong_hash = copy.deepcopy(fixed)
        wrong_hash['sha256'] = '0'*64
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'agent47.json'
            path.write_text(json.dumps(wrong_hash), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
                builder.build(path)
        fixed['source'] = '../character-revision/models/agent/agent.glb'
        with self.assertRaises(ValueError):
            builder.validate(fixed)
        alias = {'schemaVersion': 1, 'assetMode': 'alias', 'id': 'guest_male', 'aliasOf': '../../outside'}
        with self.assertRaises(ValueError):
            builder.validate(alias)


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RecipeTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise RuntimeError('Recipe checks failed')

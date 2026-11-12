import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import outfit_service as service

class ServiceTests(unittest.TestCase):
    def recipe(self):return service.read(service.ASSETS/'recipes/waiter.json')
    def test_generated_recipe_is_data_only(self):
        raw=self.recipe();raw.update(source='../../private',command='echo unsafe')
        result=service.validate(raw)
        self.assertNotIn('source',result);self.assertNotIn('command',result)
    def test_fixed_alias_and_incompatible_parts_are_rejected(self):
        for mode in ('fixed','alias'):
            raw=self.recipe();raw['assetMode']=mode
            with self.assertRaises(ValueError):service.validate(raw)
        raw=service.read(service.ASSETS/'recipes/guest_dress.json')
        raw['parts'].append({'part':'outer.layer.v1','mesh':'Accessories','colors':{},'parameters':{'model':'Jacket'}})
        with self.assertRaises(ValueError):service.validate(raw)
        raw=service.read(service.ASSETS/'recipes/pool_guest_strong.json')
        next(p for p in raw['parts'] if p['part']=='pool.hair.v1')['parameters']['kind']='shorts'
        with self.assertRaises(ValueError):service.validate(raw)
    def test_paths_shell_strings_and_invalid_colors_cannot_be_part_parameters(self):
        raw=self.recipe();raw['parts'].append({'part':'outer.layer.v1','mesh':'Accessories','colors':{},'parameters':{'model':'../../file; command'}})
        with self.assertRaises(ValueError):service.validate(raw)
        raw=self.recipe();raw['appearanceColors']={'skin':'not a color'}
        with self.assertRaises(ValueError):service.validate(raw)
    def test_only_own_local_origins(self):
        self.assertTrue(service.allowed_origin('http://127.0.0.1:8891'))
        for origin in ('https://evil.example','http://127.0.0.1.evil.example:8891','http://localhost:3000','null','http://localhost:bad'):
            self.assertFalse(service.allowed_origin(origin))
    def test_invalid_surface_marks_are_rejected(self):
        raw=self.recipe();raw['surfaceMark']={'mesh':'Outfit','point':[0,1.3,.1],'normal':[0,0,1],'size':.12,'angle':0,'png':'data:image/png;base64,broken'}
        with self.assertRaises(ValueError):service.validate(raw)

if __name__=='__main__':unittest.main(verbosity=2)

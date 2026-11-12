"""Mutation tests against the real protected baseline, without writing to it."""
import copy
from io import BytesIO
from pathlib import Path
import struct
import unittest
from PIL import Image
from compare_glb import Glb, compare, EPS, near, triangle_set_matches, triangles, triangle_matches

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT.parent / 'character-revision/models'


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.original = Glb(BASE / 'waiter/waiter.glb')
        self.changed = copy.deepcopy(self.original)

    def outcome(self):
        return compare(self.original, self.changed)['status']

    def edit_accessor(self, index, delta=.001, component=0, row=0):
        g = self.changed
        a = g.doc['accessors'][index]
        if 'bufferView' not in a or 'sparse' in a:
            rows = g.accessor(index)
            self.assertEqual(a['componentType'], 5126)
            off = len(g.bin)
            g.bin += b''.join(struct.pack('<'+'f'*len(row), *row) for row in rows)
            a['bufferView'] = len(g.doc['bufferViews'])
            g.doc['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(g.bin)-off})
            a['byteOffset'] = 0
            a.pop('sparse', None)
            g.cache.clear()
        view = g.doc['bufferViews'][a['bufferView']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        fmt = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}[a['componentType']]
        size = struct.calcsize(fmt)
        off = view.get('byteOffset', 0) + a.get('byteOffset', 0) + row * view.get('byteStride', width*size) + component*size
        data = bytearray(g.bin)
        old = struct.unpack_from('<'+fmt, data, off)[0]
        struct.pack_into('<'+fmt, data, off, old+delta)
        g.bin = bytes(data)
        g.cache.clear()

    def mesh(self, name='Outfit'):
        return next(m for m in self.changed.doc['meshes'] if m['name'] == name)

    def test_self_all_three(self):
        for name in ['waiter', 'photographer', 'pool_guest_resort']:
            with self.subTest(name=name):
                g = Glb(BASE / name / (name+'.glb'))
                self.assertEqual(compare(g, g)['status'], 'PASS')

    def test_position_normal_uv_weight_mutations(self):
        for attr in ['POSITION', 'NORMAL', 'TEXCOORD_0', 'WEIGHTS_0']:
            with self.subTest(attribute=attr):
                self.changed = copy.deepcopy(self.original)
                self.edit_accessor(self.mesh()['primitives'][0]['attributes'][attr])
                self.assertEqual(self.outcome(), 'FAIL')

    def test_joint_index_mutation(self):
        self.edit_accessor(self.mesh()['primitives'][0]['attributes']['JOINTS_0'], delta=1)
        self.assertEqual(self.outcome(), 'FAIL')

    def test_bone_name_parent_bind_and_rest_mutations(self):
        for kind in ['name', 'parent', 'bind', 'rest']:
            with self.subTest(kind=kind):
                self.changed = copy.deepcopy(self.original)
                g = self.changed
                joints = g.doc['skins'][0]['joints']
                if kind == 'name':
                    g.doc['nodes'][joints[1]]['name'] += '_changed'
                elif kind == 'parent':
                    g.doc['nodes'][g.parents[joints[1]]]['children'].remove(joints[1])
                    g.parents.pop(joints[1])
                elif kind == 'rest':
                    g.doc['nodes'][joints[1]].setdefault('translation', [0, 0, 0])[0] += .001
                else:
                    self.edit_accessor(g.doc['skins'][0]['inverseBindMatrices'])
                self.assertEqual(self.outcome(), 'FAIL')

    def test_morph_position_and_normal(self):
        for attr in ['POSITION', 'NORMAL']:
            with self.subTest(attribute=attr):
                self.changed = copy.deepcopy(self.original)
                self.edit_accessor(self.mesh('Face')['primitives'][0]['targets'][0][attr])
                self.assertEqual(self.outcome(), 'FAIL')

    def test_walk_values_and_times(self):
        for key in ['input', 'output']:
            with self.subTest(key=key):
                self.changed = copy.deepcopy(self.original)
                self.edit_accessor(self.changed.doc['animations'][0]['samplers'][0][key])
                self.assertEqual(self.outcome(), 'FAIL')

    def test_material_roughness(self):
        self.changed.doc['materials'][0]['pbrMetallicRoughness']['roughnessFactor'] = .25
        self.assertEqual(self.outcome(), 'FAIL')

    def test_material_image_pixels(self):
        g = self.changed
        view = g.doc['bufferViews'][g.doc['images'][0]['bufferView']]
        image = Image.open(BytesIO(g.view(g.doc['images'][0]['bufferView']))).convert('RGBA')
        image.putpixel((0, 0), (255, 0, 0, 255))
        encoded = BytesIO()
        image.save(encoded, format='PNG')
        view['byteOffset'] = len(g.bin)
        view['byteLength'] = len(encoded.getvalue())
        g.bin += encoded.getvalue()
        self.assertEqual(self.outcome(), 'FAIL')

    def test_triangle_order_only(self):
        g = self.changed
        index = self.mesh()['primitives'][0]['indices']
        a = g.doc['accessors'][index]
        v = g.doc['bufferViews'][a['bufferView']]
        fmt = '<' + {5123: 'H', 5125: 'I', 5121: 'B'}[a['componentType']]*3
        size = struct.calcsize(fmt)
        off = v.get('byteOffset', 0)+a.get('byteOffset', 0)
        data = bytearray(g.bin)
        rows = [data[off+i*size:off+(i+1)*size] for i in range(a['count']//3)]
        data[off:off+size*len(rows)] = b''.join(reversed(rows))
        g.bin = bytes(data)
        g.cache.clear()
        self.assertEqual(self.outcome(), 'PASS')

    def test_winding_and_duplicate_faces_fail(self):
        for kind in ['winding', 'duplicate']:
            with self.subTest(kind=kind):
                self.changed = copy.deepcopy(self.original)
                g = self.changed
                index = self.mesh()['primitives'][0]['indices']
                a = g.doc['accessors'][index]
                v = g.doc['bufferViews'][a['bufferView']]
                fmt = '<' + {5123: 'H', 5125: 'I'}[a['componentType']]*3
                off = v.get('byteOffset', 0)+a.get('byteOffset', 0)
                data = bytearray(g.bin)
                tri = struct.unpack_from(fmt, data, off)
                if kind == 'winding':
                    struct.pack_into(fmt, data, off, tri[0], tri[2], tri[1])
                else:
                    size = struct.calcsize(fmt)
                    faces = triangles(g, self.mesh()['primitives'][0], [])
                    different = next(i for i, t in enumerate(faces) if not triangle_matches(faces[0], t))
                    data[off:off+size] = data[off+different*size:off+(different+1)*size]
                g.bin = bytes(data)
                g.cache.clear()
                self.assertEqual(self.outcome(), 'FAIL')

    def test_within_and_beyond_tolerance(self):
        index = self.mesh()['primitives'][0]['attributes']['POSITION']
        self.edit_accessor(index, EPS*.25)
        self.assertEqual(self.outcome(), 'PASS')
        self.edit_accessor(index, EPS*2)
        self.assertEqual(self.outcome(), 'FAIL')

    def test_nonfinite_is_rejected(self):
        self.edit_accessor(self.mesh()['primitives'][0]['attributes']['POSITION'], float('nan'))
        # Fail closed at the API/CLI boundary if binning encounters NaN.
        with self.assertRaises(ValueError):
            compare(self.original, self.changed)

    def test_missing_mesh_and_animation_fail(self):
        self.changed.doc['animations'] = []
        self.assertEqual(self.outcome(), 'FAIL')
        self.changed = copy.deepcopy(self.original)
        self.mesh()['name'] = 'renamed'
        self.assertEqual(self.outcome(), 'FAIL')

    def test_normalized_sparse_and_interleaved_accessor(self):
        g = self.changed
        g.cache = {}
        g.bin = bytes([0, 255, 99, 99, 127, 64, 99, 99, 1, 255, 128])
        g.doc['bufferViews'] = [{'buffer': 0, 'byteOffset': 0, 'byteLength': 8, 'byteStride': 4},
                                {'buffer': 0, 'byteOffset': 8, 'byteLength': 1},
                                {'buffer': 0, 'byteOffset': 9, 'byteLength': 2}]
        g.doc['accessors'] = [{'bufferView': 0, 'componentType': 5121, 'type': 'VEC2', 'count': 2,
                              'normalized': True, 'sparse': {'count': 1, 'indices': {'bufferView': 1, 'componentType': 5121},
                                                            'values': {'bufferView': 2}}}]
        self.assertTrue(near(g.accessor(0), [(0, 1), (1, 128/255)]))

    def test_ambiguous_tolerance_uses_complete_matching(self):
        def triangle(x):
            return tuple({'attributes': {'POSITION': (x, y, z)}, 'morphs': {}} for y, z in [(0, 0), (1, 0), (0, 1)])
        self.assertTrue(triangle_set_matches([triangle(.75*EPS), triangle(-.75*EPS)], [triangle(0), triangle(1.5*EPS)]))


if __name__ == '__main__':
    unittest.main(verbosity=2)

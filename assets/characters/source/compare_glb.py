"""Strict semantic comparison of the character GLBs (Python 3 + Pillow).

Triangle/vertex storage order may differ; winding, duplicate faces, all vertex
attributes and morph deltas must agree. No Blender import or source writes.
"""
import argparse
from collections import defaultdict
from io import BytesIO
import itertools
import json
import math
from pathlib import Path
import struct

from PIL import Image

BONE_EPS = 1e-6
EPS = 1e-5
COMPONENT = {5120: ('b', 127), 5121: ('B', 255), 5122: ('h', 32767),
             5123: ('H', 65535), 5125: ('I', 4294967295), 5126: ('f', None)}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Glb:
    def __init__(self, raw):
        if isinstance(raw, (str, Path)):
            raw = Path(raw).read_bytes()
        magic, version, length = struct.unpack_from('<III', raw)
        if magic != 0x46546c67 or version != 2 or length != len(raw):
            raise ValueError('Invalid GLB header')
        chunks = {}
        offset = 12
        while offset < length:
            size, kind = struct.unpack_from('<II', raw, offset)
            if offset + 8 + size > length:
                raise ValueError('Truncated GLB chunk')
            chunks[kind] = raw[offset + 8:offset + 8 + size]
            offset += 8 + size
        self.doc = json.loads(chunks[0x4e4f534a])
        self.bin = chunks.get(0x004e4942, b'')
        self.parents = {c: i for i, n in enumerate(self.doc['nodes']) for c in n.get('children', [])}
        self.cache = {}

    def view(self, index):
        view = self.doc['bufferViews'][index]
        if view.get('buffer', 0) != 0:
            raise ValueError('External buffer is unsupported')
        off = view.get('byteOffset', 0)
        return self.bin[off:off + view['byteLength']]

    def accessor(self, index):
        if index in self.cache:
            return self.cache[index]
        a = self.doc['accessors'][index]
        if a['type'] not in WIDTH:
            raise ValueError('Unsupported accessor type: ' + a['type'])
        code, maximum = COMPONENT[a['componentType']]
        width = WIDTH[a['type']]
        fmt = '<' + code * width
        size = struct.calcsize(fmt)
        rows = [(0,) * width] * a['count']
        if 'bufferView' in a:
            view = self.doc['bufferViews'][a['bufferView']]
            data = self.view(a['bufferView'])
            stride = view.get('byteStride', size)
            rows = [struct.unpack_from(fmt, data, a.get('byteOffset', 0) + i * stride) for i in range(a['count'])]
        if 'sparse' in a:
            sparse = a['sparse']
            ix, vals = sparse['indices'], sparse['values']
            ifmt = '<' + COMPONENT[ix['componentType']][0]
            ib, vb = self.view(ix['bufferView']), self.view(vals['bufferView'])
            for j in range(sparse['count']):
                i = struct.unpack_from(ifmt, ib, ix.get('byteOffset', 0) + j * struct.calcsize(ifmt))[0]
                rows[i] = struct.unpack_from(fmt, vb, vals.get('byteOffset', 0) + j * size)
        if a.get('normalized'):
            if maximum is None:
                raise ValueError('Float accessor cannot be normalized')
            rows = [tuple(max(-1, v / maximum) for v in row) for row in rows]
        self.cache[index] = rows
        return rows

    def node_name(self, index):
        return self.doc['nodes'][index].get('name', '@' + str(index))

    def transform(self, index):
        n = self.doc['nodes'][index]
        if 'matrix' in n:
            return n['matrix']
        x, y, z, w = n.get('rotation', [0, 0, 0, 1])
        sx, sy, sz = n.get('scale', [1, 1, 1])
        tx, ty, tz = n.get('translation', [0, 0, 0])
        return [(1-2*y*y-2*z*z)*sx, (2*x*y+2*z*w)*sx, (2*x*z-2*y*w)*sx, 0,
                (2*x*y-2*z*w)*sy, (1-2*x*x-2*z*z)*sy, (2*y*z+2*x*w)*sy, 0,
                (2*x*z+2*y*w)*sz, (2*y*z-2*x*w)*sz, (1-2*x*x-2*y*y)*sz, 0,
                tx, ty, tz, 1]

    def image(self, index):
        im = self.doc['images'][index]
        if 'bufferView' not in im:
            raise ValueError('External image is unsupported')
        with Image.open(BytesIO(self.view(im['bufferView']))) as pic:
            pic = pic.convert('RGBA')
            return {'size': list(pic.size), 'pixels': pic.tobytes().hex()}

    def texture_info(self, value):
        result = dict(value)
        tex = self.doc['textures'][result.pop('index')]
        sampler = self.doc.get('samplers', [])[tex['sampler']] if 'sampler' in tex else {}
        result['texCoord'] = result.get('texCoord', 0)
        result['texture'] = {
            'image': self.image(tex['source']),
            'sampler': {'wrapS': 10497, 'wrapT': 10497, **sampler},
            'extensions': tex.get('extensions', {})}
        return result

    def material(self, index):
        m = self.doc.get('materials', [])[index] if index is not None else {}
        m = json.loads(json.dumps(m))
        m.pop('name', None)
        pbr = {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 1, 'roughnessFactor': 1,
               **m.pop('pbrMetallicRoughness', {})}
        for key in ('baseColorTexture', 'metallicRoughnessTexture'):
            if key in pbr:
                pbr[key] = self.texture_info(pbr[key])
        for key in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
            if key in m:
                info = self.texture_info(m[key])
                if key == 'normalTexture':
                    info.setdefault('scale', 1)
                if key == 'occlusionTexture':
                    info.setdefault('strength', 1)
                m[key] = info
        return {'alphaMode': 'OPAQUE', 'alphaCutoff': .5, 'doubleSided': False,
                'emissiveFactor': [0, 0, 0], **m, 'pbrMetallicRoughness': pbr}


def near(a, b, eps=EPS):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isfinite(a) and math.isfinite(b) and abs(a-b) <= eps
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(near(a[k], b[k], eps) for k in a)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(near(x, y, eps) for x, y in zip(a, b))
    return type(a) is type(b) and a == b


def unique_by_name(items, label):
    names = [name for name, _ in items]
    if len(set(names)) != len(names):
        raise ValueError('Duplicate ' + label + ' names')
    return dict(items)


def skin(g, index):
    s = g.doc['skins'][index]
    joints = s['joints']
    if len(joints) != 22:
        raise ValueError('Expected 22 joints')
    inverse = g.accessor(s['inverseBindMatrices'])
    return unique_by_name([(g.node_name(n), {
        'parent': g.node_name(g.parents[n]) if n in g.parents else None,
        'transform': g.transform(n), 'inverseBind': inverse[i]
    }) for i, n in enumerate(joints)], 'joint')


def triangles(g, primitive, target_names):
    if primitive.get('mode', 4) != 4:
        raise ValueError('Only TRIANGLES primitives supported')
    attrs = {k: g.accessor(i) for k, i in primitive['attributes'].items()}
    if not {'POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'} <= attrs.keys():
        raise ValueError('Missing required vertex attributes')
    targets = primitive.get('targets', [])
    if len(targets) != len(target_names):
        raise ValueError('Morph target names/count mismatch')
    morphs = [{k: g.accessor(i) for k, i in t.items()} for t in targets]
    count = len(attrs['POSITION'])
    indices = [x[0] for x in g.accessor(primitive['indices'])] if 'indices' in primitive else list(range(count))
    if len(indices) % 3:
        raise ValueError('Incomplete triangle')
    def vertex(i):
        return {'attributes': {k: v[i] for k, v in attrs.items()},
                'morphs': {name: {k: v[i] for k, v in m.items()} for name, m in zip(target_names, morphs)}}
    return [tuple(vertex(i) for i in indices[start:start+3]) for start in range(0, len(indices), 3)]


def vertex_matches(a, b):
    if a['attributes'].keys() != b['attributes'].keys():
        return False
    for key, value in a['attributes'].items():
        other = b['attributes'][key]
        if key.startswith('JOINTS_'):
            if value != other:
                return False
        elif not near(value, other):
            return False
    return near(a['morphs'], b['morphs'])


def triangle_matches(a, b):
    # Cyclic shifts preserve winding; reversed winding is deliberately rejected.
    return any(all(vertex_matches(a[i], b[(i+shift) % 3]) for i in range(3)) for shift in range(3))


def triangle_set_matches(a, b):
    if len(a) != len(b):
        return False
    # Centroid bins provide candidates only. All final comparisons use the exact
    # tolerance, including adjacent bins. Bipartite matching preserves duplicates
    # and avoids the ambiguity of greedy matches near a tolerance boundary.
    cell = EPS * 4
    def key(t):
        return tuple(math.floor(sum(v['attributes']['POSITION'][j] for v in t) / 3 / cell) for j in range(3))
    buckets = defaultdict(list)
    for i, t in enumerate(b):
        buckets[key(t)].append(i)
    candidates = []
    for t in a:
        k = key(t)
        choices = []
        for delta in itertools.product((-1, 0, 1), repeat=3):
            choices.extend(i for i in buckets.get(tuple(k[j]+delta[j] for j in range(3)), []) if triangle_matches(t, b[i]))
        if not choices:
            return False
        candidates.append(choices)
    matched = {}
    def assign(i, seen):
        for j in candidates[i]:
            if j in seen:
                continue
            seen.add(j)
            if j not in matched or assign(matched[j], seen):
                matched[j] = i
                return True
        return False
    return all(assign(i, set()) for i in sorted(range(len(a)), key=lambda i: len(candidates[i])))


def animation(g, a):
    channels = []
    for ch in a['channels']:
        s = a['samplers'][ch['sampler']]
        target = ch['target']
        channels.append(((g.node_name(target['node']), target['path']), {
            'interpolation': s.get('interpolation', 'LINEAR'),
            'input': g.accessor(s['input']), 'output': g.accessor(s['output'])}))
    return unique_by_name(channels, 'animation channel')


def compare(a, b):
    errors = []
    def check(ok, where):
        if not ok:
            errors.append(where)
    # Node identities/transforms are relevant even for non-skinned accessories.
    na = unique_by_name([(a.node_name(i), i) for i in range(len(a.doc['nodes']))], 'node')
    nb = unique_by_name([(b.node_name(i), i) for i in range(len(b.doc['nodes']))], 'node')
    check(na.keys() == nb.keys(), 'nodes: names/count')
    for name in na.keys() & nb.keys():
        check(near(a.transform(na[name]), b.transform(nb[name]), BONE_EPS), 'nodes/' + name + ': transform')
        check((a.node_name(a.parents[na[name]]) if na[name] in a.parents else None) ==
              (b.node_name(b.parents[nb[name]]) if nb[name] in b.parents else None), 'nodes/' + name + ': parent')
    roots = lambda g: sorted(sorted(g.node_name(i) for i in s.get('nodes', [])) for s in g.doc.get('scenes', []))
    check(roots(a) == roots(b), 'scenes: roots/count')
    check(a.doc.get('scene', 0) == b.doc.get('scene', 0), 'scenes: active scene')
    check(len(a.doc.get('materials', [])) == len(b.doc.get('materials', [])), 'materials: count')
    sa, sb = a.doc.get('skins', []), b.doc.get('skins', [])
    check(len(sa) == len(sb), 'skins: count')
    for i in range(min(len(sa), len(sb))):
        check(near(skin(a, i), skin(b, i), BONE_EPS), 'skin/' + str(i) + ': bones/parents/inverseBind')
        check([a.node_name(n) for n in sa[i]['joints']] == [b.node_name(n) for n in sb[i]['joints']], 'skin: joint index order')
    ma = unique_by_name([(m['name'], m) for m in a.doc['meshes']], 'mesh')
    mb = unique_by_name([(m['name'], m) for m in b.doc['meshes']], 'mesh')
    check(ma.keys() == mb.keys(), 'meshes: names/count')
    for name in ma.keys() & mb.keys():
        x, y = ma[name], mb[name]
        tx, ty = x.get('extras', {}).get('targetNames', []), y.get('extras', {}).get('targetNames', [])
        check(tx == ty, name + ': morph names/order')
        check(near(x.get('weights', [0]*len(tx)), y.get('weights', [0]*len(ty))), name + ': morph weights')
        check(len(x['primitives']) == len(y['primitives']), name + ': primitive count')
        for j, (p, q) in enumerate(zip(x['primitives'], y['primitives'])):
            label = name + '/' + str(j)
            check(near(a.material(p.get('material')), b.material(q.get('material')), 0), label + ': material/image')
            check(triangle_set_matches(triangles(a, p, tx), triangles(b, q, ty)), label + ': triangles/attributes/morphs')
    for name in na.keys() & nb.keys():
        x, y = a.doc['nodes'][na[name]], b.doc['nodes'][nb[name]]
        check(('mesh' in x) == ('mesh' in y), name + ': mesh assignment')
        if 'mesh' in x and 'mesh' in y:
            check(a.doc['meshes'][x['mesh']]['name'] == b.doc['meshes'][y['mesh']]['name'], name + ': mesh name')
            check(x.get('skin') == y.get('skin'), name + ': skin assignment')
            check(near(x.get('weights', []), y.get('weights', [])), name + ': node weights')
    aa = unique_by_name([(x.get('name', ''), x) for x in a.doc.get('animations', [])], 'animation')
    ab = unique_by_name([(x.get('name', ''), x) for x in b.doc.get('animations', [])], 'animation')
    check(aa.keys() == ab.keys(), 'animations: names/count')
    for name in aa.keys() & ab.keys():
        check(near(animation(a, aa[name]), animation(b, ab[name])), 'animation/' + name + ': channels/time/values')
    return {'status': 'FAIL' if errors else 'PASS', 'boneTolerance': BONE_EPS, 'attributeTolerance': EPS, 'differences': sorted(errors)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference', type=Path)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        result = compare(Glb(args.reference), Glb(args.candidate))
    except Exception as exc:
        result = {'status': 'FAIL', 'differences': [type(exc).__name__ + ': ' + str(exc)]}
    result.update(reference=str(args.reference), candidate=str(args.candidate))
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(encoded.encode())
    print(encoded, end='')
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())

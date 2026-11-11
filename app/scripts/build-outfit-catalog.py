"""Build the layered lab asset from the fitted AGENT 07 sample using Blender.

Run from the project root: blender -b -P app/scripts/build-outfit-catalog.py
"""
import math
import os
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

PROJECT = Path(__file__).resolve().parents[2]
OUTPUTS = PROJECT.parent
SOURCE = OUTPUTS / 'agent07-jacket'
os.environ['CLEAN_HANDS_OUTPUT'] = str(SOURCE)
sys.path.insert(0, str(OUTPUTS / 'character-revision' / 'source'))

import build_characters as bc
import build_uniforms as clothes

bpy.ops.wm.open_mainfile(filepath=str(SOURCE / 'agent07-jacket.blend'))
rig = bpy.data.objects['Rig']
material = bpy.data.objects['Jacket'].data.materials[0]


def jacket_mesh(name, hem, opening, width, depth, accent):
    mesh = bc.Mesh(name)
    clothes.uniform_torso(mesh, 4)
    shaped = []
    for x, y, z in mesh.v:
        side = abs(x)
        if side < .24:
            shoulder = min(1, max(0, (side - .045) / .20)) * min(1, max(0, (z - 1.38) / .06))
            # A long hem overlaps the upper thighs and needs clearance for both legs.
            hip = 1.16 if hem < .94 and z < .90 else 1
            shaped.append((x * width * hip, y * depth * hip, hem if z < .90 else z - .026 * shoulder))
        else:
            shoulder = min(1, max(0, (.39 - side) / .135)) * min(1, max(0, (z - 1.375) / .065))
            shaped.append((x, y * depth, 1.385 + (z - 1.385) * 1.18 - .036 * shoulder))
    mesh.v = shaped

    faces = list(zip(mesh.f, mesh.c))
    mesh.f.clear()
    mesh.c.clear()
    for ids, color in faces:
        poly = [(mesh.v[i], mesh.w[i]) for i in ids]
        if all(p[2] == hem for p, _ in poly):
            continue
        front = all(p[1] < 0 for p, _ in poly) and min(abs(p[0]) for p, _ in poly) < .10
        if front and opening:
            # Clip the front along a V. The same interpolation also blends bone weights.
            for side in (-1, 1):
                coords = [((side*x-opening(z), y, z), w) for (x,y,z), w in poly]
                cut = clothes.clip(coords, 0, 0, True)
                if len(cut) >= 3:
                    verts = [mesh.vert((side*(x+opening(z)), y, z), w) for (x,y,z), w in cut]
                    mesh.face(verts, color)
        else:
            cuff = min(abs(p[0]) for p, _ in poly) >= .629
            mesh.face(ids, 10 if cuff else color)
    clothes.garment_inlay(mesh, accent)
    return mesh.object(rig, material)


bomber = jacket_mesh('Bomber', 1.015, None, 1.11, 1.30, [
    (-.009,.009,1.015,1.45,10,False), (-.175,.175,1.015,1.065,10,False),
])
# The top of the lapels opens wider, then tapers toward the front fastening.
blazer = jacket_mesh('Blazer', .90, lambda z: .024 + max(0, z-1.18)*.20, 1.05, 1.20, [
    (-.126,-.046,1.31,1.44,10,False), (.046,.126,1.31,1.44,10,False),
])
def duplicate(original, name):
    variant = original.copy()
    variant.data = original.data.copy()
    variant.name = variant.data.name = name
    bpy.context.collection.objects.link(variant)
    return variant


def lengthen_jacket(original, name, extra, hem):
    variant = duplicate(original, name)
    for vertex in variant.data.vertices:
        x, y, z = vertex.co
        blend = min(1, max(0, (1.14-z)/(1.14-hem)))
        if blend:
            vertex.co = (x*(1+.20*blend), y*(1+.15*blend), z-extra*blend)
    return variant


def add_jacket_collar(original, name):
    variant = duplicate(original, name)
    collar = bc.Mesh('FieldCollar')
    # An open band around the neck with two folded ends. Leave the centre of
    # the front clear so the opening still reads as a separate outer layer.
    arc = [(-.051,-.044),(-.069,-.012),(-.058,.036),(0,.052),
           (.058,.036),(.069,-.012),(.051,-.044)]
    weights = {'chest':.75,'neck':.25}
    collar.rings([[(x,y,1.477) for x,y in arc],
                  [(x*.94,y*.90,1.51) for x,y in arc]],10,[weights,weights],cap=False)
    collar.f.pop()
    collar.c.pop()
    for side in (-1,1):
        collar.poly([(side*.051,-.044,1.477),(side*.048,-.039,1.51),
                     (side*.108,-.104,1.459),(side*.077,-.121,1.422)],10,weights)
    trim = collar.object(rig, material)
    bpy.ops.object.select_all(action='DESELECT')
    variant.select_set(True)
    trim.select_set(True)
    bpy.context.view_layer.objects.active = variant
    bpy.ops.object.join()


field = bpy.data.objects['Jacket']
long_field = lengthen_jacket(field, 'JacketLong', .09, .99)
long_bomber = lengthen_jacket(bomber, 'BomberLong', .115, 1.015)
for jacket in (field, long_field, bomber, long_bomber):
    add_jacket_collar(jacket, jacket.name+'Collar')

jeans = bpy.data.objects['Jeans']
wide = duplicate(jeans, 'WideJeans')
for vertex in wide.data.vertices:
    x, y, z = vertex.co
    if any(wide.vertex_groups[g.group].name.startswith('foot.') and g.weight > 0 for g in vertex.groups):
        continue
    center = math.copysign(.095, x)
    flare = min(1, max(0, (.97-z)/.60))
    vertex.co.x = center + (x-center)*(1+.62*flare)
    vertex.co.y = y*(1+.32*flare)

trousers = duplicate(jeans, 'Trousers')
for vertex in trousers.data.vertices:
    x, y, z = vertex.co
    if z > .105:
        center = math.copysign(.095, x)
        vertex.co.x = center + (x-center)*(.96 if z>.55 else 1.10)
        vertex.co.y = y * .94
# Use the middle fabric shade across the trouser faces; keep the original shoes.
uv = trousers.data.uv_layers.active.data
for polygon in trousers.data.polygons:
    cell = lambda vector: int(vector.x*4) + 4*int((1-vector.y)*4)
    if cell(uv[polygon.loop_indices[0]].uv) in (5,6,13):
        for i in polygon.loop_indices:
            uv[i].uv = ((5%4+.5)/4, 1-(5//4+.5)/4)

shirt = bc.Mesh('Shirt')
clothes.uniform_torso(shirt, 1)
shirt.v = [
    (x, y, .94 if z < .90 else z - .028 * min(1, max(0, (abs(x)-.045)/.21))
        * min(1, max(0, (.40-abs(x))/.115)) * min(1, max(0, (z-1.375)/.065)))
    for x, y, z in shirt.v
]
clothes.collar(shirt, 11)
clothes.garment_inlay(shirt, [(-.009,.009,.94,1.43,11,False)])
shirt.object(rig, material)

cap = bc.Mesh('Cap')
clothes.ball_cap(cap, 0, 0)
cap = cap.object(rig, material)
tie = bc.Mesh('Tie')
clothes.tie(tie, 0)
tie = tie.object(rig, material)

def add_mark_surface(garment):
    """Sample the front of the garment and give the patch the same bone weights."""
    surface = garment.data
    surface.calc_loop_triangles()
    triangles = [tuple(tri.vertices) for tri in surface.loop_triangles]
    vertices = [v.co.copy() for v in surface.vertices]
    bvh = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
    patch = bc.Mesh('Mark_'+garment.name)
    samples = 5
    for row in range(samples):
        for col in range(samples):
            x = .081 + .063 * col/(samples-1)
            z = 1.280 + .063 * row/(samples-1)
            point, _, index, _ = bvh.ray_cast(Vector((x,-1,z)), Vector((0,1,0)), 1)
            if point is None:
                raise RuntimeError(f'{garment.name}: missing breast surface at {x}, {z}')
            ids = triangles[index]
            mix = barycentric_transform(point, *(vertices[i] for i in ids),
                                        Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
            weights = {}
            for i, ratio in zip(ids,mix):
                for g in surface.vertices[i].groups:
                    bone = garment.vertex_groups[g.group].name
                    weights[bone] = weights.get(bone,0)+g.weight*max(0,ratio)
            total = sum(weights.values())
            patch.vert((x,point.y-.004,z),{k:v/total for k,v in weights.items() if v>0})
    for row in range(samples-1):
        for col in range(samples-1):
            i = row*samples+col
            patch.face((i,i+1,i+samples+1,i+samples),1)
    obj = patch.object(rig,material)
    uv = obj.data.uv_layers.active.data
    for loop in obj.data.loops:
        row,col = divmod(loop.vertex_index,samples)
        uv[loop.index].uv = (col/(samples-1),row/(samples-1))


for garment in list(rig.children):
    if garment.name in ('TShirt','Shirt','Blazer') or garment.name.startswith(('Jacket','Bomber')):
        add_mark_surface(garment)

bc.pose_clear(rig)
for track in rig.animation_data.nla_tracks:
    track.mute = False
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for obj in rig.children:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
dest = PROJECT/'app'/'src'/'labs'/'assets'/'agent07-outfit.glb'
bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_morph=True,
    export_skins=True, export_rest_position_armature=True)
clothes.normalize(dest)
print('Layered asset:', ', '.join(sorted(obj.name for obj in rig.children)))

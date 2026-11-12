"""Blender preview of Agent 07 in an open field jacket, built on the shared rig."""
import json
import math
import os
import sys
from pathlib import Path

import bpy

OUT = Path(__file__).resolve().parent
# Output is confined to this copied asset folder.
sys.path.insert(0, str(OUT.parents[1] / 'characters' / 'source'))
import build_characters as bc
import build_uniforms as clothes
from normalize_skin_roots import normalize

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
rig = bc.rig_create()
palette = clothes.palette({
    0: '18202a', 1: 'e7e1d3', 2: 'b78954', 5: '345880',
    4: '53634b', 6: '42678d', 10: '344337', 11: 'c8c4b8', 13: '273f60', 15: '212936',
})
body, face, hair, tee, jeans, glasses = (
    bc.Mesh(name) for name in ('Body', 'Face', 'Hair', 'TShirt', 'Jeans', 'Sunglasses')
)
bc.head(body, 7)
bc.hands(body, 7)
bc.face(face, 0)
bc.hair(hair, 0, 'swept')
clothes.sunglasses(glasses)

def slope_shoulder(mesh):
    """Taper the upper shoulder into the sleeve without moving the armpit."""
    for i, (x, y, z) in enumerate(mesh.v):
        width = abs(x)
        if width <= .045 or width >= .40:
            continue
        outward = min(1.0, (width - .045) / .21)
        fade = min(1.0, (.40 - width) / .115)
        top = max(0.0, min(1.0, (z - 1.375) / .065))
        mesh.v[i] = (x, y, z - .034 * outward * fade * top)

clothes.uniform_torso(tee, 1)
slope_shoulder(tee)
clothes.short_sleeves(tee, 7, .39)
# A shorter, untucked hem meets the jeans at the hip.
tee.v = [(x, y, .94 if z < .90 else z) for x, y, z in tee.v]
for i, ids in enumerate(tee.f):
    if max(tee.v[j][2] for j in ids) < .96:
        tee.c[i] = 11

bc.legs(jeans, 5, 7)
for i, ids in enumerate(jeans.f):
    if jeans.c[i] != 5:
        continue
    verts = [jeans.v[j] for j in ids]
    x = sum(v[0] for v in verts) / len(verts)
    y = sum(v[1] for v in verts) / len(verts)
    jeans.c[i] = 13 if abs(x) > .135 else 6 if y < -.045 else 5

jacket = bc.Mesh('Jacket')
clothes.uniform_torso(jacket, 4)
slope_shoulder(jacket)
# Keep the same bone weights as the shirt while giving the outer layer clearance.
jacket.v = [
    (x * (1.06 if abs(x) < .23 else 1), y * (1.17 if .22 <= abs(x) <= .39 else 1.25),
     .99 if z < .90 else 1.385 + (z - 1.385) * 1.16 if abs(x) >= .25 else z + .010)
    for x, y, z in jacket.v
]
faces = list(zip(jacket.f, jacket.c))
jacket.f.clear()
jacket.c.clear()
for ids, color in faces:
    poly = [(jacket.v[i], jacket.w[i]) for i in ids]
    if all(p[1] < 0 for p, _ in poly) and min(p[0] for p, _ in poly) < .066 and max(p[0] for p, _ in poly) > -.066:
        # Split just the front around the open zipper. New vertices retain interpolated skin weights.
        for greater, edge in ((False, -.066), (True, .066)):
            cut = clothes.clip(poly, 0, edge, greater)
            if len(cut) >= 3:
                jacket.face([jacket.vert(p, w) for p, w in cut], color)
    elif not all(p[2] == .99 for p, _ in poly):
        cuff = min(abs(p[0]) for p, _ in poly) >= .629
        jacket.face(ids, 10 if cuff else color)
clothes.garment_inlay(jacket, [
    (-.144, -.074, 1.11, 1.19, 10, False),
    (.074, .144, 1.11, 1.19, 10, False),
])

objects = []
for mesh in (body, face, hair, tee, jeans, glasses, jacket):
    obj = mesh.object(rig, palette)
    objects.append(obj)
    if mesh is face:
        bc.morphs(obj, mesh)

action = bc.walk(rig)
rig.animation_data.action = None
bc.pose_clear(rig)
track = rig.animation_data.nla_tracks.new()
track.name = 'walk1'
track.strips.new('walk1', 1, action)
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig, *objects]:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
glb = OUT / 'agent07-jacket.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_morph=True,
    export_skins=True, export_rest_position_armature=True)
normalize(glb)

track.mute = True
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'agent07-jacket.blend'))

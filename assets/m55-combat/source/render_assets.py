# Re-imports the exported GLBs into empty scenes and renders proof images (independent of the build scene).
# Lighting is the Astra setup (Cycles 32 samples, three disk area lights aimed at (0,0,1.55)) so brightness matches.
# blender -b -P render_assets.py
import bpy, json, math, os, sys
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
CHAR = OUT.parents[2] / 'character-revision' / 'models'
REN = OUT / 'renders'; REN.mkdir(exist_ok=True)
info = {e['id']: e for e in json.loads((OUT / 'build-info.json').read_text(encoding='utf-8'))}


def scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new('W'); sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (.55, .60, .65, 1); bg.inputs[1].default_value = .7
    for name, pos, power, size in (('Broad key', (-2, -3, 4), 350, 4), ('Soft fill', (2, -1, 2), 60, 3), ('Hair edge', (0, 2, 3), 180, 3)):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy, ld.shape, ld.size = power, 'DISK', size
        lo = bpy.data.objects.new(name, ld); sc.collection.objects.link(lo); lo.location = pos
        lo.rotation_euler = (Vector((0, 0, 1.55)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    sc.view_settings.view_transform = 'Standard'
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'
    return sc, cam


def load(path):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    root = next(o for o in new if o.parent is None)
    return root, new


def bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def shoot(sc, cam, path, target, yaw, elev, scale, res):
    sc.render.resolution_x, sc.render.resolution_y = res
    d = Vector((math.sin(math.radians(yaw)), -math.cos(math.radians(yaw)), math.tan(math.radians(elev))))
    cam.location = Vector(target) + d.normalized() * 30; cam.data.clip_end = 100
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = scale; sc.render.filepath = str(path); bpy.ops.render.render(write_still=True)


measured = {}
for aid, e in info.items():
    sc, cam = scene()
    root, objs = load(OUT / 'models' / aid / (aid + '.glb'))
    lo, hi = bounds(objs); size = hi - lo
    # glTF axes: X = Blender x, Y = Blender z, Z = -Blender y (forward)
    measured[aid] = {'size_m': [round(size.x, 3), round(size.z, 3), round(size.y, 3)],
                     'anchors': {o.name: [round(o.location.x, 4), round(o.location.z, 4), round(-o.location.y, 4)] for o in objs if o.type == 'EMPTY' and o.parent == root}}
    # Lift the asset so its centre sits where the Astra lights are aimed.
    centre = (lo + hi) / 2; root.location += Vector((0, 0, 1.55)) - centre
    if e['kind'] == 'cover':
        span = max(size.x, size.y, size.z) * 1.7
        views = [('35', 35, 22), ('front', 0, 0), ('side', 90, 0), ('top', 30, 60)]
    else:
        span = max(size.x, size.y, size.z) * 1.35
        views = [('side', 90, 0), ('35', 35, 20), ('other-side', -90, 0), ('top', 30, 60)]
    for name, yaw, elev in views:
        shoot(sc, cam, REN / f'{aid}-{name}.png', (0, 0, 1.55), yaw, elev, span, (800, 600))

# Scale lineup with the guard character (1.8 m) at true size.
sc, cam = scene()
guard, gobjs = load(CHAR / 'guard' / 'guard.glb')
placed = [('crate', (1.7, 0, 0), 0), ('planter_1x1', (3.4, 0, 0), 0), ('counter_bar_2m', (5.6, 0, 0), 0), ('car_sedan_blue', (9.2, 0, 0), math.pi / 2), ('planter_3x1', (13.4, .3, 0), 0)]
for aid, loc, rot in placed:
    r, _ = load(OUT / 'models' / aid / (aid + '.glb')); r.location = loc; r.rotation_euler = (0, 0, rot)
for i, aid in enumerate(['pistol_guard', 'pistol_silenced', 'smg', 'rifle_npc']):
    r, _ = load(OUT / 'models' / aid / (aid + '.glb')); r.location = (-1.2 - i * .02, 0, 1.55 - i * .28); r.rotation_euler = (0, 0, math.pi / 2)
r, _ = load(OUT / 'models' / 'ammo_pickup' / 'ammo_pickup.glb'); r.location = (-1.0, -.3, 0)
shoot(sc, cam, REN / 'lineup-with-guard.png', (6.0, 0, 1.1), 18, 8, 17.5, (2000, 700))

# Hand check: the guard in rest pose holding a pistol (right) and a sub-machine gun (left), barrels forward.
sc, cam = scene()
guard, gobjs = load(CHAR / 'guard' / 'guard.glb')
arm = next(o for o in gobjs if o.type == 'ARMATURE')
bpy.context.view_layer.update()
for bone, aid in (('hand.R', 'pistol_guard'), ('hand.L', 'smg')):
    b = arm.pose.bones.get(bone)
    if b is None: continue
    p = arm.matrix_world @ ((b.head + b.tail) / 2)   # posed hand, not the rest T-pose
    r, _ = load(OUT / 'models' / aid / (aid + '.glb')); r.location = p + Vector((0, 0, -.01))
for name, yaw, elev in (('hand-check-front', 0, 0), ('hand-check-35', 35, 15), ('hand-check-side', 90, 0)):
    shoot(sc, cam, REN / f'{name}.png', (0, 0, 1.2), yaw, elev, 2.3, (900, 700))

(OUT / 'measured.json').write_text(json.dumps(measured, ensure_ascii=False, indent=2), encoding='utf-8')
print('RENDERED', len(measured))

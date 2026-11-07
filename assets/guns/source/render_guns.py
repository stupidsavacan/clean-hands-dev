# Proof renders: each exported GLB re-imported on its own (side view and 3/4 view), plus a lineup with the existing
# M5.5 guns for scale. Lighting as the M5.5 renders (Cycles, three disk area lights). blender -b -P render_guns.py
import bpy, json, math, sys
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
M55 = OUT.parent / 'm55-combat' / 'models'
REN = OUT / 'renders'; REN.mkdir(exist_ok=True)
info = json.loads((OUT / 'build-info.json').read_text(encoding='utf-8'))


def scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new('W'); sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (.55, .60, .65, 1); bg.inputs[1].default_value = .7
    for name, pos, power, size in (('Key', (-2, -3, 4), 350, 4), ('Fill', (2, -1, 2), 60, 3), ('Edge', (0, 2, 3), 180, 3)):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy, ld.shape, ld.size = power, 'DISK', size
        lo = bpy.data.objects.new(name, ld); sc.collection.objects.link(lo); lo.location = pos
        lo.rotation_euler = (Vector((0, 0, .2)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    sc.view_settings.view_transform = 'Standard'
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'
    return sc, cam


def load(path, offset=(0, 0, 0)):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.parent is None: o.location = Vector(o.location) + Vector(offset)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def shoot(sc, cam, lo, hi, view, path, res=(800, 500)):
    c = (lo + hi) / 2; span = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    # side: from the gun's right; q: front-right above; q2: from the left behind (the other side and the top)
    d = {'side': Vector((-3, 0, 0)), 'q': Vector((-2.2, -2.2, 1.4)), 'q2': Vector((2.2, 1.6, 1.2))}[view]
    cam.location = c + d; cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    # Fit the frame to the gun as seen from the camera (tall guns are not cut off at the top and bottom).
    sc.render.resolution_x, sc.render.resolution_y = res
    bpy.context.view_layer.update(); inv = cam.matrix_world.inverted()
    pts = [inv @ Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    w = max(p.x for p in pts) - min(p.x for p in pts); h = max(p.y for p in pts) - min(p.y for p in pts)
    cam.data.ortho_scale = max(w, h * res[0] / res[1]) * 1.15
    sc.render.filepath = str(path); bpy.ops.render.render(write_still=True)


only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
for e in info:
    if only and e['id'] not in only: continue
    for view in ('side', 'q', 'q2'):
        sc, cam = scene(); lo, hi = load(OUT / 'models' / e['id'] / (e['id'] + '.glb'))
        shoot(sc, cam, lo, hi, view, REN / f"{e['id']}-{view}.png")

# Lineup: the existing guns and the new ones, side by side in true scale (barrels along +Y in Blender = forward).
sc, cam = scene()
ids = [('m55', 'pistol_guard'), ('m55', 'pistol_silenced'), ('new', 'tranq_pistol'), ('new', 'machine_pistol'), ('new', 'revolver'), ('new', 'compact_smg'), ('m55', 'smg'),
       ('new', 'shotgun_short'), ('m55', 'rifle_npc'), ('new', 'shotgun'), ('new', 'hunting_rifle'), ('new', 'sniper_rifle')]
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for i, (src, gid) in enumerate(ids):
    a, b = load((M55 if src == 'm55' else OUT / 'models') / gid / (gid + '.glb'), (0, 0, -i * .32))
    lo = Vector(map(min, lo, a)); hi = Vector(map(max, hi, b))
shoot(sc, cam, lo, hi, 'side', REN / 'lineup.png', (1400, 1600))
print('RENDERED')

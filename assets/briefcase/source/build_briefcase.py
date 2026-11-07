# The briefcase, made on its own (2026-11-06; 194-item table row 21: "the case body + its open/closed state + what it
# holds (a separate item); not broken apart"). A generic hard briefcase, not any named one.
# blender -b -P build_briefcase.py [-- --render]
# Conventions as the items (../../items/source/build_items.py): the hand grips the origin (GRIP_R, the handle), the case
# hangs below it, its length runs along the hand's forward axis (+Z in glTF), shared 16-colour palette, flat faces.
# Authoring: forward f, up z, right x -> Blender (x, -f, z) (fz). The two shells meet at x = 0; the lid is the +x shell,
# its own node LID with the origin on the hinge line (the bottom edge); turning LID about its local Z (glTF) by
# -angle opens it outward. CONTENT marks where a stored thing sits (inside the base shell).
import json, math, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'm55-combat' / 'source'))
sys.path.insert(0, str(HERE.parents[1] / 'guns' / 'source'))
import build_m55_assets as base
from build_m55_assets import Mesh, empty, fz, glb_info, GRAPHITE, PAPER, YELLOW, DARKWOOD, WOOD, METAL, SAGE
from detail import prism
import bpy

OUT = HERE.parent
L, TOP, BOT, T = .46, -.035, -.37, .056          # length, top and bottom edge (z), half thickness
HINGE = (0, 0, BOT)                               # Blender space


def rounded(f0, f1, z0, z1, r, n=3):
    """A rounded rectangle in (forward, up), counter-clockwise."""
    pts = []
    for cf, cz, a0 in ((f1 - r, z0 + r, -90), (f1 - r, z1 - r, 0), (f0 + r, z1 - r, 90), (f0 + r, z0 + r, 180)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n); pts.append((cf + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def shell(m, x0, x1, colour, bev):
    prism(m, rounded(-L / 2, L / 2, BOT, TOP, .03), (x1 - x0) / 2, colour, x=(x0 + x1) / 2, bev=bev)


def build():
    body, lid = Mesh(), Mesh()
    # --- the base shell (x < 0) with its lining, the frame rim, feet, the handle and the lock bodies
    shell(body, -T, -.004, DARKWOOD, .008)
    shell(body, -.004, 0, METAL, 0)                                          # aluminium frame rim at the seam
    prism(body, rounded(-L / 2 + .02, L / 2 - .02, BOT + .02, TOP - .02, .015), .0015, GRAPHITE, x=.0005)  # foam lining
    for f in (-.12, .12):                                                    # elastic straps in the lining
        body.box((-.001, -f + .012, BOT + .03), (.0025, -f - .012, TOP - .03), SAGE)
    for f in (-L / 2 + .05, L / 2 - .05):                                    # feet on the bottom edge
        body.box((-T + .012, -f + .012, BOT - .008), (-.012, -f - .012, BOT), GRAPHITE)
    for f in (-.15, .15):                                                    # lock bodies (base half)
        body.box((-.012, -f + .022, TOP - .028), (0, -f - .022, TOP + .004), YELLOW)
        body.box((-.009, -f + .006, TOP - .02), (-.003, -f - .006, TOP + .006), GRAPHITE)  # key hole
    # handle: two brass mounts on the top edge and a leather grip between them
    for f in (-.065, .065):
        body.box((-.012, -f + .011, TOP), (.012, -f - .011, TOP + .012), YELLOW)
        body.tube((0, -f, TOP + .008), (0, -f * .86, TOP + .036), .007, 6, GRAPHITE)
    body.tube((0, .056, .002), (0, -.056, .002), .012, 8, GRAPHITE)          # the grip (the hand holds the origin)
    for f in (-.12, .12):                                                    # hinge barrels on the bottom edge (base half)
        body.tube((-.004, -f + .03, BOT - .004), (-.004, -f + .005, BOT - .004), .006, 6, METAL)
    # --- the lid shell (x > 0), its rim, the hasps and corner guards; built in place, pivoted on the hinge
    shell(lid, .004, T, DARKWOOD, .008)
    shell(lid, 0, .004, METAL, 0)
    prism(lid, rounded(-L / 2 + .02, L / 2 - .02, BOT + .02, TOP - .02, .015), .0015, GRAPHITE, x=-.0005)
    lid.box((-.0025, -.16, -.12), (.001, .16, -.06), SAGE)                    # document pocket in the lid
    for f in (-.15, .15):                                                    # hasps (lid half) over the locks
        lid.box((0, -f + .018, TOP - .03), (.012, -f - .018, TOP + .002), YELLOW)
    for f in (-.12, .12):
        lid.tube((.004, -f - .005, BOT - .004), (.004, -f - .03, BOT - .004), .006, 6, METAL)  # hinge knuckles
    for cf in (-L / 2 + .01, L / 2 - .01):                                   # brass corner guards on the lid face
        for cz in (BOT + .012, TOP - .012):
            lid.box((T - .002, -cf + .014 * (1 if cf > 0 else -1), cz - .012), (T + .003, -cf, cz + .012), YELLOW)
    return {'body': (body, (0, 0, 0)), 'LID': (lid, HINGE)}, {
        'GRIP_R': (0, 0, 0), 'CONTENT': (-.03, 0, (BOT + TOP) / 2), 'HINGE': HINGE, 'TIP': fz(0, BOT)}


def make():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    parts, anchors = build()
    root = bpy.data.objects.new('briefcase', None); bpy.context.collection.objects.link(root)
    mat = base.palette_material()
    for name, (mesh, pivot) in parts.items():
        ob = mesh.build('briefcase_mesh' if name == 'body' else name, mat, shift=pivot); ob.parent = root; ob.location = pivot
    for name, p in anchors.items(): empty(name, p, root)
    folder = OUT / 'models' / 'briefcase'; folder.mkdir(parents=True, exist_ok=True)
    glb = folder / 'briefcase.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_yup=True, export_apply=True)
    j, tris, size = glb_info(glb)
    to_gl = lambda p: [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]
    allv = [v for mesh, _ in parts.values() for v in mesh.v]
    xs = [v[0] for v in allv]; ys = [v[1] for v in allv]; zs = [v[2] for v in allv]
    info = {'id': 'briefcase', 'csvRow': 21, 'label': 'ブリーフケース', 'triangles': tris, 'bytes': size,
            'size_m': [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)],
            'anchors': {k: to_gl(v) for k, v in anchors.items()}, 'moving': {'LID': 'turns about its local Z (glTF) on the hinge; -1.9 rad = fully open'}}
    (OUT / 'build-info.json').write_text(json.dumps([info], ensure_ascii=False, indent=2), encoding='utf-8')
    print('BUILT', info['id'], tris, 'tris', size, 'bytes', info['size_m'])


def render():
    # Proof renders: closed and open, from the front-right and from the open side (Cycles, three area lights).
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT / 'models' / 'briefcase' / 'briefcase.glb'))
    from mathutils import Vector
    lid = bpy.data.objects['LID']
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.render.resolution_x = 720; sc.render.resolution_y = 540
    w = bpy.data.worlds.new('w'); w.color = (.25, .27, .3); sc.world = w
    c = Vector((0, 0, -.2))
    for i, (loc, e) in enumerate([((1.2, -1.0, 1.4), 220), ((-1.4, -.2, .6), 90), ((0, 1.4, 1.0), 70)]):
        l = bpy.data.lights.new('l%d' % i, 'AREA'); l.energy = e; l.size = 1.2
        o = bpy.data.objects.new('l%d' % i, l); o.location = c + Vector(loc); o.rotation_euler = (c - o.location).to_track_quat('-Z', 'Y').to_euler(); sc.collection.objects.link(o)
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = .95
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    renders = OUT / 'renders'; renders.mkdir(exist_ok=True)
    for name, angle, eye in (('closed', 0, (1.1, -.55, .25)), ('open', 1.9, (1.0, -.7, .35)), ('open_side', 1.9, (.2, -1.2, .1))):
        lid.rotation_mode = 'XYZ'; base_rot = lid.rotation_euler.copy()
        # glTF import keeps the node's frame: the hinge runs along Blender Y here, so the lid opens about Y.
        lid.rotation_euler = (base_rot.x, base_rot.y + angle, base_rot.z)
        co.location = c + Vector(eye); co.rotation_euler = (c - co.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = str(renders / ('briefcase_%s.png' % name)); bpy.ops.render.render(write_still=True)
        lid.rotation_euler = base_rot


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    render() if '--render' in args else make()

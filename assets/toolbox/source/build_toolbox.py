# The toolbox case (2026-11-07; 194-item table row 22 "工具箱型ケース": the case body + its open/closed state + what it
# holds (a separate item); not broken apart; knocks out in melee and when thrown, like the briefcase). A generic hard
# aluminium tool case, not any named one. Built the same way as the briefcase (../../briefcase/source/build_briefcase.py)
# so the game handles both alike: carried by the top handle (GRIP_R at the origin), the two shells meet at x = 0, the
# lid is the +x shell on its own node LID with the origin on the bottom hinge line, opening by -angle about local Z (glTF).
# Deeper and boxier than the briefcase, ribbed metal faces, black corner caps and rails, tools held in the foam.
# blender -b -P build_toolbox.py [-- --render]
import json, math, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'm55-combat' / 'source'))
sys.path.insert(0, str(HERE.parents[1] / 'guns' / 'source'))
import build_m55_assets as base
from build_m55_assets import Mesh, empty, fz, glb_info, GRAPHITE, YELLOW, METAL, STEELBLUE, SAND
from detail import prism
import bpy

OUT = HERE.parent
L, TOP, BOT, T = .44, -.05, -.34, .085           # length, top and bottom edge (z), half thickness
HINGE = (0, 0, BOT)                               # Blender space
RED = 2                                           # palette index (c22f21)


def rounded(f0, f1, z0, z1, r, n=2):
    """A rounded rectangle in (forward, up), counter-clockwise."""
    pts = []
    for cf, cz, a0 in ((f1 - r, z0 + r, -90), (f1 - r, z1 - r, 0), (f0 + r, z1 - r, 90), (f0 + r, z0 + r, 180)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n); pts.append((cf + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def shell(m, x0, x1, colour, bev):
    prism(m, rounded(-L / 2, L / 2, BOT, TOP, .012), (x1 - x0) / 2, colour, x=(x0 + x1) / 2, bev=bev)


def ribs(m, x, side):
    """Three raised ribs along the face and black corner caps (side = -1 base, +1 lid)."""
    for z in (BOT + .07, (BOT + TOP) / 2, TOP - .07):
        a, b = sorted((x, x + side * .004))
        m.box((a, -L / 2 + .04, z - .006), (b, L / 2 - .04, z + .006), METAL)
    for cf in (-L / 2, L / 2):
        for cz in (BOT, TOP):
            a, b = sorted((x - side * .02, x + side * .005))
            m.box((a, -cf - .018 if cf < 0 else -cf, cz - .018 if cz > BOT else cz - .004), (b, -cf if cf < 0 else -cf + .018, cz + .004 if cz > BOT else cz + .018), GRAPHITE)


def build():
    body, lid = Mesh(), Mesh()
    # --- the base shell (x < 0): metal skin, black edge rail at the seam, foam with a wrench and a screwdriver
    shell(body, -T, -.006, METAL, .006)
    shell(body, -.006, 0, GRAPHITE, 0)
    ribs(body, -T, -1)
    prism(body, rounded(-L / 2 + .015, L / 2 - .015, BOT + .015, TOP - .015, .008), .002, GRAPHITE, x=-.001)   # foam face
    body.box((.0005, -.15, BOT + .05), (.006, .06, BOT + .07), METAL)                       # wrench shaft
    body.tube((.003, -.17, BOT + .06), (.003, -.15, BOT + .06), .016, 6, METAL)               # wrench head
    body.tube((.003, .09, BOT + .14), (.003, .17, BOT + .14), .011, 6, RED)                  # screwdriver handle
    body.tube((.003, -.05, BOT + .14), (.003, .09, BOT + .14), .003, 5, METAL)               # screwdriver shaft
    for f in (-L / 2 + .05, L / 2 - .05):                                                    # feet on the bottom edge
        body.box((-T + .015, -f + .015, BOT - .01), (-.015, -f - .015, BOT), GRAPHITE)
    for f in (-.14, .14):                                                                    # latch bodies (base half)
        body.box((-.016, -f + .024, TOP - .03), (0, -f - .024, TOP + .004), YELLOW)
    # handle: black mounts on the top edge and a thick grip between them
    for f in (-.07, .07):
        body.box((-.016, -f + .013, TOP), (.016, -f - .013, TOP + .014), GRAPHITE)
        body.tube((0, -f, TOP + .01), (0, -f * .85, TOP + .04), .009, 6, GRAPHITE)
    body.tube((0, .06, .0), (0, -.06, .0), .014, 8, GRAPHITE)                                 # the grip (the hand holds the origin)
    for f in (-.13, .13):                                                                    # hinge barrels (base half)
        body.tube((-.004, -f + .035, BOT - .005), (-.004, -f + .005, BOT - .005), .007, 6, METAL)
    # --- the lid shell (x > 0): skin, rail, ribs, foam with a socket set strip, hasps, hinge knuckles; pivoted on the hinge
    shell(lid, .006, T, METAL, .006)
    shell(lid, 0, .006, GRAPHITE, 0)
    ribs(lid, T, 1)
    prism(lid, rounded(-L / 2 + .015, L / 2 - .015, BOT + .015, TOP - .015, .008), .002, GRAPHITE, x=.001)
    lid.box((-.004, -.16, -.16), (-.0005, .16, -.13), STEELBLUE)                               # socket rail
    for i in range(7):
        f = -.13 + i * .043
        lid.tube((-.004, f, -.145), (-.016, f, -.145), .007 + .001 * i, 6, METAL)              # sockets
    lid.box((-.003, -.12, BOT + .05), (-.0005, .12, BOT + .1), SAND)                          # spare parts tray
    for f in (-.14, .14):                                                                    # hasps (lid half) over the latches
        lid.box((0, -f + .02, TOP - .034), (.016, -f - .02, TOP + .002), YELLOW)
    for f in (-.13, .13):
        lid.tube((.004, -f - .005, BOT - .005), (.004, -f - .035, BOT - .005), .007, 6, METAL)  # hinge knuckles
    return {'body': (body, (0, 0, 0)), 'LID': (lid, HINGE)}, {
        'GRIP_R': (0, 0, 0), 'CONTENT': (-.04, 0, (BOT + TOP) / 2), 'HINGE': HINGE, 'TIP': fz(0, BOT)}


def make():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    parts, anchors = build()
    root = bpy.data.objects.new('toolbox', None); bpy.context.collection.objects.link(root)
    mat = base.palette_material()
    for name, (mesh, pivot) in parts.items():
        ob = mesh.build('toolbox_mesh' if name == 'body' else name, mat, shift=pivot); ob.parent = root; ob.location = pivot
    for name, p in anchors.items(): empty(name, p, root)
    folder = OUT / 'models' / 'toolbox'; folder.mkdir(parents=True, exist_ok=True)
    glb = folder / 'toolbox.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_yup=True, export_apply=True)
    j, tris, size = glb_info(glb)
    to_gl = lambda p: [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]
    allv = [v for mesh, _ in parts.values() for v in mesh.v]
    xs = [v[0] for v in allv]; ys = [v[1] for v in allv]; zs = [v[2] for v in allv]
    info = {'id': 'toolbox', 'kind': 'melee', 'csvRow': 22, 'label': '工具箱', 'triangles': tris, 'bytes': size,
            'size_m': [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)],
            'anchors': {k: to_gl(v) for k, v in anchors.items()}, 'moving': {'LID': 'turns about its local Z (glTF) on the hinge; -1.9 rad = fully open'}}
    (OUT / 'build-info.json').write_text(json.dumps([info], ensure_ascii=False, indent=2), encoding='utf-8')
    print('BUILT', info['id'], tris, 'tris', size, 'bytes', info['size_m'])


def render():
    # Proof renders: closed and open, as the briefcase's (Cycles, three area lights).
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT / 'models' / 'toolbox' / 'toolbox.glb'))
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
        lid.rotation_euler = (base_rot.x, base_rot.y + angle, base_rot.z)
        co.location = c + Vector(eye); co.rotation_euler = (c - co.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = str(renders / ('toolbox_%s.png' % name)); bpy.ops.render.render(write_still=True)
        lid.rotation_euler = base_rot


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    render() if '--render' in args else make()

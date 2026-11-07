# The eight generic guns of assets/guns again, at the detail of the first two M5.5 pistols (pistol_guard,
# pistol_silenced) so they sit with them in one set (2026-11-06). Same outlines and sizes as the detailed versions;
# made the M5.5 way: side profiles extruded across the gun, 8-sided tubes, the shared trigger group, a few boxes for
# sights, one mesh per gun (no moving parts), about 150-450 triangles.
# blender -b -P build_guns_simple.py [-- id ...]
# Axes and anchors as everywhere: the right-hand grip at the origin (GRIP_R), the muzzle along +Z.
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'm55-combat' / 'source'))
import build_m55_assets as base
from build_m55_assets import Mesh, empty, fz, glb_info, trigger_group, pistol, GRAPHITE, PAPER, YELLOW, TEAL, BLUE, CYAN, WOOD, DARKWOOD, SAGE, SAND, STEELBLUE, METAL
import bpy

OUT = Path(__file__).resolve().parent.parent
RED = 2


def build_revolver():
    m = Mesh()
    # frame with the recoil shield and top strap in one outline, cylinder, barrel with underlug, wooden grip, hammer
    # The frame in four pieces so the cylinder shows through its window, as on the detailed version.
    m.side([(-.030, .024), (.104, .024), (.104, .048), (-.030, .050)], .0115, METAL)                         # lower frame
    m.side([(-.032, .040), (.018, .040), (.018, .094), (-.008, .099), (-.032, .088)], .0135, METAL)           # recoil shield
    m.side([(.074, .040), (.104, .040), (.104, .090), (.074, .090)], .012, METAL)                            # front of frame
    m.side([(.010, .084), (.080, .084), (.080, .096), (.010, .096)], .009, METAL)                            # top strap
    m.tube(fz(.019, .066), fz(.075, .066), .0195, 12, METAL)
    for k in range(6):                                                                                       # flutes
        a = k * math.tau / 6
        m.box((.0185 * math.cos(a) - .002, -.026, .066 + .0185 * math.sin(a) - .002), (.0185 * math.cos(a) + .002, -.068, .066 + .0185 * math.sin(a) + .002), GRAPHITE)
    m.tube(fz(.100, .068), fz(.253, .068), .0115, 8, METAL)
    m.side([(.104, .044), (.250, .044), (.250, .062), (.104, .058)], .0095, METAL)
    m.box((-.0022, -.236, .080), (.0022, -.246, .098), METAL); m.box((-.0023, -.240, .092), (.0023, -.245, .097), RED)
    m.box((-.006, .006, .096), (.006, -.008, .104), GRAPHITE)
    m.side([(-.034, .032), (.006, .032), (-.002, -.070), (-.010, -.088), (-.040, -.091), (-.050, -.076), (-.042, .010)], .016, DARKWOOD)
    m.side([(-.030, .060), (-.016, .060), (-.026, .103), (-.044, .102)], .0045, METAL)
    trigger_group(m, -.010, .026)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.010, -.010, -.035), 'MUZZLE': fz(.253, .068)}


def build_tranq_pistol():
    m = Mesh()
    m.side([(-.040, .022), (.128, .022), (.128, .052), (-.030, .052), (-.044, .040)], .016, GRAPHITE)        # lower frame
    m.side([(-.045, .052), (.158, .052), (.158, .094), (-.040, .094), (-.048, .086)], .018, GRAPHITE)        # housing
    for x in (.0186, -.0186): m.box((x - .0006, -.020, .062), (x + .0006, -.130, .082), YELLOW)
    m.tube(fz(.157, .073), fz(.177, .073), .012, 8, METAL)
    m.tube(fz(.034, .040), fz(.153, .040), .0095, 8, METAL)                                                 # gas cartridge
    m.box((-.005, .036, .094), (.005, .028, .103), GRAPHITE); m.box((-.0018, -.142, .094), (.0018, -.148, .102), YELLOW)
    m.side([(-.038, .026), (.004, .026), (-.010, -.080), (-.050, -.082), (-.057, -.070), (-.044, .000)], .0165, GRAPHITE)
    for x in (.0168, -.0168): m.box((x - .0005, .040, -.060), (x + .0005, .016, -.004), YELLOW)
    trigger_group(m, -.010, .022)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.010, -.010, -.035), 'MUZZLE': fz(.177, .073)}


def build_machine_pistol():
    m = Mesh()
    pistol(m, GRAPHITE)                                                                                      # the M5.5 pistol...
    m.side([(.135, .040), (.190, .040), (.190, .072), (.135, .072)], .014, GRAPHITE)                         # ...with a compensator
    for i in range(3): m.box((-.006, -(.145 + i * .014), .0715), (.006, -(.152 + i * .014), .0725), METAL)
    m.side([(-.050, -.060), (-.008, -.062), (-.012, -.160), (-.052, -.158)], .0115, GRAPHITE)                # long magazine
    m.side([(-.056, -.156), (-.008, -.159), (-.008, -.170), (-.056, -.167)], .013, YELLOW)
    m.box((-.0165, .040, .056), (-.0133, .030, .064), YELLOW)                                                # selector
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.010, -.010, -.035), 'MUZZLE': fz(.190, .057)}


def build_compact_smg():
    m = Mesh()
    m.side([(-.075, .030), (.140, .030), (.140, .080), (-.075, .080)], .019, GRAPHITE)
    m.box((-.006, .040, .080), (.006, -.120, .086), METAL)                                                   # top rail
    m.box((-.0040, .066, .086), (.0040, .056, .097), GRAPHITE); m.box((-.0035, -.120, .086), (.0035, -.130, .096), GRAPHITE)
    m.tube(fz(.138, .056), fz(.196, .056), .0125, 8, GRAPHITE, math.pi / 8)
    m.tube(fz(.194, .056), fz(.212, .056), .0078, 8, METAL)
    m.side([(-.032, .032), (.006, .032), (-.006, -.072), (-.044, -.069)], .016, GRAPHITE)
    m.side([(-.040, -.066), (-.006, -.070), (-.006, -.150), (-.040, -.146)], .0125, GRAPHITE)
    m.side([(-.045, -.144), (-.002, -.148), (-.002, -.160), (-.045, -.156)], .0145, METAL)
    trigger_group(m, -.010, .031)
    for z in (.066, .042): m.tube(fz(-.072, z, -.025), fz(.112, z, -.025), .0042, 6, METAL)                  # folded stock
    m.side([(.104, .036), (.118, .036), (.118, .074), (.104, .074)], .006, GRAPHITE, x=-.025)
    m.side([(.094, .030), (.116, .030), (.112, -.036), (.098, -.036)], .011, GRAPHITE)                       # front grip
    m.box((-.0215, .040, .046), (-.0188, .030, .054), YELLOW)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.105, -.012), 'MUZZLE': fz(.212, .056)}


def pump_action(m, barrel_end, pump, mag_end):
    m.side([(-.110, .025), (.135, .025), (.135, .088), (-.095, .088), (-.110, .075)], .022, GRAPHITE)
    m.tube(fz(.128, .068), fz(barrel_end, .068), .0125, 8, GRAPHITE)
    m.box((-.0045, -.140, .079), (.0045, -barrel_end, .086), GRAPHITE)                                       # rib
    m.box((-.0025, -(barrel_end - .016), .086), (.0025, -(barrel_end - .010), .091), METAL)                  # bead
    m.tube(fz(.128, .040), fz(mag_end, .040), .0115, 8, GRAPHITE)
    m.tube(fz(mag_end - .004, .040), fz(mag_end + .020, .040), .0128, 8, METAL)
    m.tube(fz(pump[0], .050), fz(pump[1], .050), .027, 8, WOOD, math.pi / 8)
    for k in range(4):
        f = pump[0] + .02 + k * (pump[1] - pump[0] - .04) / 3
        m.tube(fz(f, .050), fz(f + .006, .050), .0278, 8, DARKWOOD, math.pi / 8)
    trigger_group(m, -.010, .025)


def build_shotgun():
    m = Mesh(); pump_action(m, .66, (.27, .45), .60)
    m.side([(-.100, .082), (-.100, .026), (-.030, .020), (-.045, -.012), (-.080, -.030), (-.160, -.032),
            (-.430, -.052), (-.440, -.052), (-.440, .080), (-.420, .082), (-.120, .086)], .021, WOOD)
    m.side([(-.460, -.056), (-.438, -.054), (-.438, .082), (-.460, .084)], .022, GRAPHITE)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.36, .035), 'MUZZLE': fz(.66, .068), 'STOCK': fz(-.46, .028)}


def build_shotgun_short():
    m = Mesh(); pump_action(m, .36, (.17, .30), .30)
    m.side([(-.040, .030), (.008, .030), (-.012, -.082), (-.058, -.078)], .0175, WOOD)
    m.side([(-.062, -.076), (-.010, -.081), (-.012, -.090), (-.064, -.085)], .0175, GRAPHITE)
    m.side([(-.128, .040), (-.106, .040), (-.106, .078), (-.128, .078)], .016, GRAPHITE)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.235, .035), 'MUZZLE': fz(.36, .068)}


def scope(m, f0, f1, z, r, big):
    """Tube, objective bell, eyepiece, lenses, one turret, two rings on bases."""
    m.tube(fz(f0, z), fz(f1 - .05, z), r, 8, GRAPHITE)
    m.tube(fz(f1 - .05, z), fz(f1, z), big, 8, GRAPHITE)
    m.tube(fz(f0 - .035, z), fz(f0, z), r + .005, 8, GRAPHITE)
    m.tube(fz(f1 - .002, z), fz(f1 + .001, z), big - .003, 8, CYAN)
    m.tube((0, -(f0 + f1) / 2 + .02, z + r), (0, -(f0 + f1) / 2 + .02, z + r + .014), .009, 8, GRAPHITE)
    for f in (f0 + .02, f1 - .09):
        m.box((-.007, -f, .086), (.007, -(f + .013), z - r + .002), METAL)


def build_hunting_rifle():
    m = Mesh()
    m.side([(.48, .030), (.48, .058), (-.080, .060), (-.120, .080), (-.200, .098), (-.300, .102), (-.470, .096), (-.490, .094),
            (-.490, -.056), (-.470, -.058), (-.300, -.040), (-.150, -.012), (-.085, -.050), (-.060, -.060), (-.030, -.048),
            (-.010, .008), (.060, .008), (.100, .012)], .022, WOOD)
    m.side([(.452, .030), (.492, .030), (.492, .058), (.452, .058)], .0225, DARKWOOD)
    m.side([(-.516, -.060), (-.490, -.058), (-.490, .096), (-.516, .098)], .023, GRAPHITE)
    m.tube(fz(-.105, .072), fz(.160, .072), .0155, 8, GRAPHITE)
    m.tube(fz(.158, .072), fz(.645, .072), .010, 8, GRAPHITE)
    m.tube(fz(-.032, .072, .012), fz(-.040, .052, .036), .0045, 6, METAL); m.ico(fz(-.041, .049, .040), (.008, .008, .008), METAL)
    scope(m, -.066, .166, .135, .0125, .0215)
    trigger_group(m, -.020, .010)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.300, .035), 'MUZZLE': fz(.645, .072), 'STOCK': fz(-.516, .020), 'SCOPE': fz(-.100, .135)}


def build_sniper_rifle():
    m = Mesh()
    m.side([(.52, .032), (.52, .064), (.18, .066), (-.080, .066), (-.100, .074), (-.480, .074), (-.495, .070),
            (-.495, -.040), (-.470, -.046), (-.300, -.030), (-.180, .010), (-.080, .010), (.10, .018)], .023, SAGE)
    m.side([(-.440, .074), (-.200, .074), (-.200, .098), (-.215, .104), (-.425, .104), (-.440, .098)], .020, SAGE)   # cheek riser
    m.side([(-.520, -.048), (-.493, -.046), (-.493, .076), (-.520, .078)], .024, GRAPHITE)
    m.side([(-.040, .012), (.004, .012), (-.012, -.088), (-.058, -.084)], .0165, GRAPHITE)                          # pistol grip
    m.tube(fz(-.100, .072), fz(.170, .072), .0165, 8, GRAPHITE)
    m.box((-.0075, .095, .086), (.0075, -.175, .093), METAL)                                                       # rail
    m.tube(fz(.168, .072), fz(.760, .072), .013, 8, GRAPHITE)
    m.tube(fz(.755, .072), fz(.845, .072), .017, 8, GRAPHITE)
    for f in (.780, .815): m.box((-.0185, -f, .066), (.0185, -(f + .010), .078), METAL)
    m.tube(fz(-.040, .072, .014), fz(-.052, .062, .046), .005, 6, METAL); m.ico(fz(-.054, .061, .050), (.011, .011, .011), GRAPHITE)
    scope(m, -.058, .215, .140, .015, .026)
    m.side([(.070, .012), (.128, .012), (.124, -.042), (.074, -.042)], .015, GRAPHITE)                             # magazine
    for x in (-.013, .013): m.tube(fz(.44, .028, x * .6), fz(.74, .024, x), .005, 6, METAL)                       # folded bipod
    trigger_group(m, -.020, .012)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.36, .030), 'MUZZLE': fz(.845, .072), 'STOCK': fz(-.52, .020), 'SCOPE': fz(-.110, .140)}


GUNS = {
    'compact_smg': (build_compact_smg, '小型サブマシンガン（収納対応）'),
    'shotgun': (build_shotgun, 'ショットガン（通常サイズ）'),
    'shotgun_short': (build_shotgun_short, 'ショットガン（短縮型）'),
    'sniper_rifle': (build_sniper_rifle, 'スナイパーライフル'),
    'revolver': (build_revolver, '高威力型拳銃（リボルバー）'),
    'tranq_pistol': (build_tranq_pistol, '鎮静ダーツ銃'),
    'machine_pistol': (build_machine_pistol, 'フルオート式拳銃'),
    'hunting_rifle': (build_hunting_rifle, '狩猟用ライフル'),
}


def make(gid):
    fn, label = GUNS[gid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh, anchors = fn()
    root = bpy.data.objects.new(gid, None); bpy.context.collection.objects.link(root)
    ob = mesh.build(gid + '_mesh', base.palette_material()); ob.parent = root
    for name, p in anchors.items(): empty(name, p, root)
    folder = OUT / 'models' / gid; folder.mkdir(parents=True, exist_ok=True)
    glb = folder / (gid + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_yup=True, export_apply=True)
    j, tris, size = glb_info(glb)
    to_gl = lambda p: [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]
    xs = [v[0] for v in mesh.v]; ys = [v[1] for v in mesh.v]; zs = [v[2] for v in mesh.v]
    return {'id': gid, 'label': label, 'triangles': tris, 'bytes': size,
            'size_m': [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)],
            'anchors': {k: to_gl(v) for k, v in anchors.items()}}


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    info = [make(g) for g in (args or list(GUNS))]
    path = OUT / 'build-info.json'
    old = {e['id']: e for e in json.loads(path.read_text(encoding='utf-8'))} if path.exists() and args else {}
    old.update({e['id']: e for e in info})
    path.write_text(json.dumps([old[g] for g in GUNS if g in old], ensure_ascii=False, indent=2), encoding='utf-8')
    for e in info: print('BUILT', e['id'], e['triangles'], 'tris', e['bytes'], 'bytes', e['size_m'])

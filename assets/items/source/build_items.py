# Hand-held tools and melee weapons (2026-11-05): the things the agent can pick up, carry, throw and hit with.
# blender -b -P build_items.py [-- id ...]
# Same conventions as the M5.5 weapons (../../m55-combat/source/build_m55_assets.py, whose helpers this reuses): the
# shared 16-colour palette, flat faces, roughness 1, one GLB per item, metres.
# Item axes (glTF): the hand grips the origin (GRIP_R); the handle runs along +Z with the working end (head, blade,
# jaw) at +Z, so every item hangs in the hand the same way (detection-view.ts attaches it to the hand bone).
# Authoring axes as in the weapons: x right, z up, -y forward -> fz(forward, up, right).
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'm55-combat' / 'source'))
import build_m55_assets as base
from build_m55_assets import Mesh, empty, fz, glb_info, GRAPHITE, PAPER, YELLOW, TEAL, BLUE, CYAN, WOOD, DARKWOOD, SAGE, SAND, STEELBLUE, METAL
import bpy

OUT = Path(__file__).resolve().parent.parent
RED = 2


def ring(f, z0, r, n, x=0.0, z=None):
    """A ring of n points round the forward axis at forward f (a disc lying across the handle)."""
    return [fz(f, (z if z is not None else z0) + r * math.sin(i * math.tau / n), x + r * math.cos(i * math.tau / n)) for i in range(n)]


def disc(m, centre_f, z0, z1, r0, r1, n, c):
    """A flat round thing lying in the hand plane (pan, tray, coin): its axis is up (z)."""
    pts = lambda z, r: [(r * math.cos(i * math.tau / n), -(centre_f + r * math.sin(i * math.tau / n)), z) for i in range(n)]
    m.solid([pts(z0, r0), pts(z1, r1)], c)


def build_wrench():
    m = Mesh()
    m.box((-.006, .04, -.012), (.006, -.17, .012), METAL)                      # flat shaft
    m.box((-.007, -.165, -.024), (.007, -.21, .024), METAL)                    # head
    for z in (-.026, .014): m.box((-.007, -.205, z), (.007, -.235, z + .012), METAL)   # open jaw
    m.box((-.0065, .02, -.0135), (.0065, -.06, .0135), GRAPHITE)               # rubber grip
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.235, 0)}


def build_hammer():
    m = Mesh()
    m.tube(fz(-.05, 0), fz(.26, 0), .014, 8, WOOD)
    m.tube(fz(-.05, 0), fz(.05, 0), .0165, 8, GRAPHITE)                         # grip wrap
    m.box((-.017, -.245, -.035), (.017, -.29, .075), GRAPHITE)                 # head across the handle
    m.box((-.019, -.25, .07), (.019, -.285, .095), METAL)                      # striking face
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.27, .09)}


def build_crowbar():
    m = Mesh()
    m.tube(fz(-.06, 0), fz(.46, 0), .011, 6, RED)
    m.tube(fz(.455, 0), fz(.50, .045), .011, 6, RED)                            # hook
    m.tube(fz(.495, .042), fz(.475, .07), .010, 6, RED)
    m.tube(fz(-.06, 0), fz(-.09, -.012), .010, 6, RED)                          # flat end
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.50, .045)}


def build_kitchen_knife():
    m = Mesh()
    m.box((-.008, .05, -.011), (.008, -.06, .011), DARKWOOD)                   # handle
    for f in (-.03, .02): m.box((-.0085, -f + .004, -.003), (.0085, -f - .004, .003), METAL)  # rivets
    m.side([(.055, -.012), (.24, -.004), (.265, .012), (.24, .016), (.055, .016)], .0012, METAL)  # blade, edge down
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.265, .012)}


def build_frying_pan():
    m = Mesh()
    m.tube(fz(-.05, 0), fz(.16, .02), .011, 8, GRAPHITE)
    disc(m, .29, .01, .05, .118, .13, 16, GRAPHITE)
    disc(m, .29, .049, .052, .11, .118, 16, METAL)                             # inside surface, a shade lighter
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.42, .03)}


def build_bottle():
    m = Mesh()
    # Held by the neck: the neck at the hand, the body beyond it.
    m.solid([ring(-.04, 0, .013, 8), ring(.06, 0, .014, 8), ring(.10, 0, .036, 8), ring(.30, 0, .038, 8)], TEAL)
    m.solid([ring(.298, 0, .034, 8), ring(.305, 0, .03, 8)], TEAL)
    m.solid([ring(-.06, 0, .015, 8), ring(-.035, 0, .015, 8)], YELLOW)          # foil cap
    m.solid([ring(.15, 0, .039, 8), ring(.23, 0, .039, 8)], PAPER, caps=False)  # label
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.305, 0)}


def build_mop():
    m = Mesh()
    m.tube(fz(-.45, 0), fz(.95, 0), .013, 6, WOOD)
    m.box((-.15, -.94, -.03), (.15, -.99, .03), METAL)                          # head bar
    for i in range(7):                                                          # strands
        x = -.135 + i * .045
        m.box((x - .016, -.97, -.03), (x + .016, -1.13, .03), PAPER)
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(1.13, 0)}


def build_camera():
    m = Mesh()
    m.box((-.07, .02, -.03), (.07, -.07, .06), GRAPHITE)                       # body, held by the right side grip
    m.tube(fz(.07, .015), fz(.13, .015), .032, 10, GRAPHITE)                    # lens barrel
    m.tube(fz(.128, .015), fz(.135, .015), .028, 10, CYAN)
    m.box((-.025, -.0, .06), (.025, -.04, .08), GRAPHITE)                       # prism hump
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.135, .015)}


def build_tray():
    m = Mesh()
    disc(m, .17, -.006, .006, .17, .175, 20, METAL)
    disc(m, .17, .006, .018, .175, .18, 20, METAL)
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.35, 0)}


def build_coin():
    m = Mesh()
    disc(m, 0, -.001, .001, .012, .012, 12, YELLOW)
    return m, {'GRIP_R': (0, 0, 0), 'TIP': (0, 0, 0)}


def build_brick():
    m = Mesh()
    m.box((-.05, .02, -.032), (.05, -.2, .032), RED)
    for f in (.05, .13): m.box((-.051, -f + .012, -.033), (.051, -f - .012, -.031), SAND)  # holes' rims underneath
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.2, 0)}


def build_katana():
    # A Japanese sword (ROADMAP M14/M15, N31, 2026-11-06): a two-hand grip wrapped dark, a round guard, a slightly
    # curved blade with the edge down. Generic shape, no named sword.
    m = Mesh()
    m.box((-.013, .09, -.016), (.013, -.17, .016), GRAPHITE)                   # tsuka (grip)
    for f in (-.05, .02, .09): m.box((-.0135, -f + .006, -.0165), (.0135, -f - .006, .0165), DARKWOOD)  # wrap diamonds
    m.box((-.014, .095, -.017), (.014, .085, .017), METAL)                     # pommel cap
    m.solid([ring(.17, 0, .042, 12), ring(.18, 0, .042, 12)], METAL)          # tsuba (guard), round the blade's axis
    m.box((-.008, -.18, -.015), (.008, -.205, .019), YELLOW)                   # habaki (collar)
    m.side([(.205, -.013), (.5, -.010), (.8, -.002), (.93, .012), (.96, .03), (.93, .03), (.8, .018), (.5, .021), (.205, .021)], .0028, METAL)  # blade, edge down
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.12, 0), 'TIP': fz(.96, .03)}


def build_briefcase():
    # A hard briefcase (ROADMAP M09/M10, N22, 2026-11-06): carried by the handle, the case hanging below it; it can hide
    # a gun inside, and it is swung or thrown like a blunt thing.
    m = Mesh()
    m.box((-.013, .06, -.002), (.013, -.06, .018), GRAPHITE)                   # handle grip
    for f in (-.05, .05): m.box((-.011, -f + .008, -.03), (.011, -f - .008, 0), METAL)  # handle posts
    m.box((-.055, .23, -.36), (.055, -.23, -.03), DARKWOOD)                    # body
    m.box((-.057, .232, -.205), (.057, -.232, -.195), METAL)                   # rim where the lid closes
    for f in (-.15, .15): m.box((-.058, -f + .02, -.07), (.058, -f - .02, -.045), YELLOW)  # latches
    for f in (-.2, .2):
        for z in (-.36, -.03): m.box((-.058, -f + .018, z - .012), (.058, -f - .018, z + .012), METAL)  # corner caps
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(0, -.36)}


# id: (kind, builder, label). kind: tool (carried, may be suspicious), melee (a weapon in hand), throw (thrown only).
ITEMS = {
    'wrench': ('tool', build_wrench, 'スパナ'),
    'bottle': ('tool', build_bottle, 'ワインボトル'),
    'mop': ('tool', build_mop, 'モップ'),
    'camera': ('tool', build_camera, 'カメラ'),
    'tray': ('tool', build_tray, 'トレイ'),
    'hammer': ('melee', build_hammer, 'ハンマー'),
    'crowbar': ('melee', build_crowbar, 'バール'),
    'kitchen_knife': ('melee', build_kitchen_knife, '包丁'),
    'frying_pan': ('melee', build_frying_pan, 'フライパン'),
    'coin': ('throw', build_coin, 'コイン'),
    'brick': ('throw', build_brick, 'レンガ'),
    'katana': ('melee', build_katana, '刀'),
    'briefcase': ('melee', build_briefcase, 'ブリーフケース'),
}


def make(aid):
    kind, fn, label = ITEMS[aid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh, anchors = fn()
    root = bpy.data.objects.new(aid, None); bpy.context.collection.objects.link(root)
    ob = mesh.build(aid + '_mesh', base.palette_material()); ob.parent = root
    for name, p in anchors.items(): empty(name, p, root)
    folder = OUT / 'models' / aid; folder.mkdir(parents=True, exist_ok=True)
    glb = folder / (aid + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_yup=True, export_apply=True)
    j, tris, size = glb_info(glb)
    to_gl = lambda p: [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]
    xs = [v[0] for v in mesh.v]; ys = [v[1] for v in mesh.v]; zs = [v[2] for v in mesh.v]
    return {'id': aid, 'kind': kind, 'label': label, 'triangles': tris, 'bytes': size,
            'size_m': [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)],
            'anchors': {k: to_gl(v) for k, v in anchors.items()}}


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    info = [make(a) for a in (args or list(ITEMS))]
    path = OUT / 'build-info.json'
    old = {e['id']: e for e in json.loads(path.read_text(encoding='utf-8'))} if path.exists() and args else {}
    old.update({e['id']: e for e in info})
    path.write_text(json.dumps([old[a] for a in ITEMS if a in old], ensure_ascii=False, indent=2), encoding='utf-8')
    for e in info: print('BUILT', e['id'], e['triangles'], 'tris', e['bytes'], 'bytes', e['size_m'])

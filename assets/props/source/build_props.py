# Props for the scheduled gestures (2026-11-05): what people hold while they phone, drink or radio, and a standing
# desk with a PC for desk work.
# blender -b -P build_props.py [-- id ...]
# Same conventions as the items and the M5.5 weapons (helpers from ../../m55-combat/source/build_m55_assets.py):
# shared 16-colour palette, flat faces, roughness 1, one GLB each, metres.
# Hand props: the hand grips the origin (GRIP_R); the long axis runs along +Z (gestures.ts turns them in the hand).
# desk_pc: the origin is on the floor at the front edge of the desk, centred; +Z runs into the desk (away from the
# person standing at it), the top is at TOP (0.95 m, a standing desk). The user faces +Z, so their right is -X: the
# mouse is on -X.
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'm55-combat' / 'source'))
import build_m55_assets as base
from build_m55_assets import Mesh, empty, fz, glb_info, GRAPHITE, PAPER, YELLOW, TEAL, BLUE, CYAN, WOOD, DARKWOOD, SAGE, SAND, STEELBLUE, METAL
import bpy

OUT = Path(__file__).resolve().parent.parent
RED = 2
TOP = .95


def ring(f, z0, r, n, x=0.0):
    return [fz(f, z0 + r * math.sin(i * math.tau / n), x + r * math.cos(i * math.tau / n)) for i in range(n)]


def build_phone():
    m = Mesh()
    m.box((-.035, .005, -.0045), (.035, -.145, .0045), GRAPHITE)                # body, screen up (+y in glTF)
    m.box((-.031, -.008, .004), (.031, -.132, .0055), BLUE)                      # screen
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.145, 0)}


def build_wine_glass():
    m = Mesh()
    # Held by the stem: the stem at the hand, the bowl beyond it (+Z), the foot behind (-Z).
    m.solid([ring(-.035, 0, .034, 12), ring(-.031, 0, .034, 12)], CYAN)          # foot
    m.solid([ring(-.032, 0, .004, 8), ring(.04, 0, .004, 8)], CYAN)              # stem
    m.solid([ring(.038, 0, .006, 12), ring(.06, 0, .03, 12), ring(.10, 0, .038, 12), ring(.14, 0, .031, 12)], CYAN, caps=False)
    m.solid([ring(.05, 0, .022, 12), ring(.085, 0, .034, 12)], RED)              # wine
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.14, 0)}


def build_radio():
    m = Mesh()
    m.box((-.03, .02, -.017), (.03, -.11, .017), GRAPHITE)                       # body
    m.tube(fz(.105, .0, .018), fz(.19, .0, .018), .005, 6, GRAPHITE)              # antenna
    m.box((-.02, -.07, .016), (.02, -.1, .019), METAL)                           # speaker grille
    m.box((-.034, -.02, -.006), (-.029, -.05, .006), YELLOW)                     # talk button
    return m, {'GRIP_R': (0, 0, 0), 'TIP': fz(.19, 0, .018)}


def build_desk_pc():
    m = Mesh()
    w, d = 1.2, .7
    # In desk space: x right, forward (into the desk) is +Z in glTF = -y in Blender.
    m.box((-w / 2, 0, TOP - .035), (w / 2, -d, TOP), WOOD)                      # top
    for x in (-w / 2 + .05, w / 2 - .09):
        m.box((x, -.06, 0), (x + .04, -d + .06, .05), GRAPHITE)                   # feet
        m.box((x, -d / 2 - .02, 0), (x + .04, -d / 2 + .02, TOP - .03), GRAPHITE)  # legs
    m.box((-w / 2 + .05, -d / 2 - .02, .25), (w / 2 - .05, -d / 2 + .02, .29), GRAPHITE)  # brace
    m.box((-.22, -.48, TOP), (.22, -.50, TOP + .32), GRAPHITE)                   # monitor
    m.box((-.205, -.477, TOP + .02), (.205, -.483, TOP + .30), BLUE)              # screen (faces the user)
    m.box((-.03, -.50, TOP), (.03, -.56, TOP + .12), GRAPHITE)                   # stand
    m.box((-.12, -.48, TOP), (.12, -.62, TOP + .01), GRAPHITE)                   # stand foot
    m.box((-.22, -.07, TOP), (.22, -.21, TOP + .02), METAL)                      # keyboard, near the front edge
    m.box((-.33, -.09, TOP), (-.27, -.18, TOP + .025), METAL)                    # mouse, on the user's right (-x)
    m.box((.32, -.15, TOP), (.5, -.40, TOP + .015), PAPER)                       # papers, on the user's left
    m.box((.42, -.05, 0), (.58, -.5, .45), GRAPHITE)                             # PC tower under the desk, left
    m.box((.43, -.04, .38), (.57, -.06, .40), CYAN)                              # power light strip
    return m, {'KEYBOARD': (0, -.14, TOP + .02), 'MOUSE': (-.30, -.135, TOP + .025), 'SCREEN': (0, -.48, TOP + .16), 'STAND': (0, .35, 0)}


def build_boombox():
    # A portable stereo (ROADMAP H15, 2026-11-06): stands on a surface, origin on the surface under its centre, front
    # (speakers) toward +Z in glTF (-y in Blender). E switches it on; someone nearby comes to switch it off.
    m = Mesh()
    w, d, h = .46, .15, .24
    m.box((-w / 2, d / 2, 0), (w / 2, -d / 2, h), GRAPHITE)                       # body
    for x in (-.14, .14):
        m.tube((x, -d / 2 + .002, .11), (x, -d / 2 - .012, .11), .075, 12, METAL)  # speaker rims
        m.tube((x, -d / 2 - .01, .11), (x, -d / 2 - .016, .11), .055, 12, GRAPHITE)  # cones
        m.tube((x, -d / 2 - .014, .11), (x, -d / 2 - .02, .11), .018, 8, METAL)    # dust caps
    m.box((-.06, -d / 2 - .006, .05), (.06, -d / 2, .15), METAL)                  # cassette deck
    m.box((-.045, -d / 2 - .009, .075), (.045, -d / 2 - .005, .13), GRAPHITE)     # cassette window
    m.box((-.06, -d / 2 - .006, .165), (.06, -d / 2, .205), CYAN)                 # tuner display
    for i in range(5):
        x = -.05 + i * .025
        m.box((x - .008, .02, h), (x + .008, -.02, h + .012), YELLOW if i == 2 else METAL)  # buttons on top
    for x in (-.19, .19):
        m.box((x - .012, .012, h), (x + .012, -.012, h + .07), GRAPHITE)          # handle posts
    m.box((-.2, .012, h + .055), (.2, -.012, h + .08), GRAPHITE)                  # handle
    m.tube((.17, .03, h), (.08, .03, h + .32), .004, 6, METAL)                    # antenna
    return m, {'BUTTON': (0, 0, h + .012), 'FRONT': (0, -d / 2 - .02, .11)}


def build_tv():
    # A flat TV on a small stand (ROADMAP H16, 2026-11-06): origin on the surface under its centre, screen toward +Z
    # (glTF). Switched on, someone comes over and watches it for a while before switching it off.
    m = Mesh()
    m.box((-.36, .04, 0), (.36, -.04, .015), GRAPHITE)                            # foot
    m.box((-.03, .02, .015), (.03, -.02, .12), GRAPHITE)                          # neck
    m.box((-.42, .03, .1), (.42, -.02, .58), GRAPHITE)                            # body
    m.box((-.40, -.02, .12), (.40, -.026, .56), BLUE)                             # screen
    m.box((.30, -.026, .105), (.34, -.03, .112), CYAN)                            # power light
    return m, {'SCREEN': (0, -.03, .34), 'BUTTON': (.38, -.02, .12)}


def build_vacuum():
    # An upright vacuum cleaner (ROADMAP H17, 2026-11-06): stands on the floor, origin under its base, handle up.
    # Switched on it is loud: heard further than a radio, and someone comes to switch it off.
    m = Mesh()
    m.box((-.16, .10, 0), (.16, -.14, .07), STEELBLUE)                            # floor head
    for x in (-.13, .13):
        m.tube((x, .08, .035), (x + (.02 if x > 0 else -.02), .08, .035), .035, 8, GRAPHITE)  # wheels
    m.box((-.12, .10, .07), (.12, -.04, .52), STEELBLUE)                          # body
    m.box((-.10, -.04, .18), (.10, -.06, .44), CYAN)                              # dust bin window
    m.tube((0, .05, .52), (0, .07, 1.05), .016, 8, METAL)                         # handle pole
    m.box((-.08, .05, 1.03), (.08, .09, 1.08), GRAPHITE)                          # grip
    m.box((-.03, -.045, .46), (.03, -.05, .5), RED)                               # power switch
    return m, {'BUTTON': (0, -.05, .48), 'GRIP': (0, .07, 1.05)}


PROPS = {
    'phone': ('hand', build_phone, 'スマートフォン'),
    'wine_glass': ('hand', build_wine_glass, 'ワイングラス'),
    'radio': ('hand', build_radio, '無線機'),
    'desk_pc': ('furniture', build_desk_pc, '立ち机とパソコン'),
    'boombox': ('furniture', build_boombox, 'ラジカセ'),
    'tv': ('furniture', build_tv, 'テレビ'),
    'vacuum': ('furniture', build_vacuum, '掃除機'),
}


def make(aid):
    kind, fn, label = PROPS[aid]
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
    info = [make(a) for a in (args or list(PROPS))]
    path = OUT / 'build-info.json'
    old = {e['id']: e for e in json.loads(path.read_text(encoding='utf-8'))} if path.exists() and args else {}
    old.update({e['id']: e for e in info})
    path.write_text(json.dumps([old[a] for a in PROPS if a in old], ensure_ascii=False, indent=2), encoding='utf-8')
    for e in info: print('BUILT', e['id'], e['triangles'], 'tris', e['bytes'], 'bytes', e['size_m'])

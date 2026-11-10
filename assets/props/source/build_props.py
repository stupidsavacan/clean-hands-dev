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
PALE_SAGE = 11
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


def sink_ring(half_width, back, front, height, corner):
    """Chamfered rectangle, counterclockwise in Blender's XY plane."""
    w, c = half_width, corner
    return [(x, y, height) for x, y in [
        (w - c, -front), (w, -front + c), (w, back - c), (w - c, back),
        (-w + c, back), (-w, back - c), (-w, -front + c), (-w + c, -front),
    ]]


def build_sink():
    # Floor-centred vanity, cabinet doors and user approach on +Z in glTF.
    m = Mesh()
    m.box((-.35, -.188, 0), (.35, .258, .12), GRAPHITE)                       # recessed toe kick
    m.solid([sink_ring(.397, .275, .236, h, .016) for h in (.082, .745)], TEAL)
    for x in (-.188, .188):
        m.box((x - .179, -.254, .118), (x + .179, -.231, .721), TEAL)         # inset cabinet door
        pull_x = x - math.copysign(.083, x)
        for offset in (-.037, .037):
            m.box((pull_x + offset - .007, -.268, .641),
                  (pull_x + offset + .007, -.252, .657), METAL)
        m.box((pull_x - .048, -.28, .64), (pull_x + .048, -.265, .658), STEELBLUE)

    # One closed ceramic shell. Its top rim connects to a recessed, sloped bowl.
    basin = [
        sink_ring(.403, .277, .268, .742, .022),
        sink_ring(.424, .289, .289, .839, .022),
        sink_ring(.424, .289, .289, .883, .022),
        sink_ring(.415, .28, .28, .895, .022),
        sink_ring(.318, .148, .222, .895, .059),
        sink_ring(.301, .132, .205, .873, .055),
        sink_ring(.248, .095, .14, .764, .046),
        sink_ring(.208, .08, .118, .749, .042),
    ]
    first_bowl_face = len(m.c)
    segments = len(basin[0])
    m.solid(basin, PAPER)
    m.c[first_bowl_face + 5 * segments:first_bowl_face + 7 * segments] = [PALE_SAGE] * (2 * segments)
    m.c[-1] = PALE_SAGE

    drain = fz(.014, .754)
    m.tube(fz(.014, .748), fz(.014, .753), .039, 12, METAL)
    m.tube(fz(.014, .753), drain, .025, 12, GRAPHITE)
    m.tube(fz(-.124, .836), fz(-.113, .836), .014, 10, METAL)                 # overflow on the rear slope
    m.tube(fz(-.114, .836), fz(-.112, .836), .008, 10, GRAPHITE)

    # Swept eight-sided gooseneck with a downturned aerator.
    m.tube(fz(-.216, .893), fz(-.216, .912), .046, 12, METAL)
    path = [(-.216, .907), (-.216, 1.057), (-.198, 1.102), (-.158, 1.127),
            (-.087, 1.127), (-.029, 1.107), (.006, 1.072), (.014, 1.039),
            (.014, 1.024)]
    spout_rings = []
    for i, (forward, height) in enumerate(path):
        before = path[max(i - 1, 0)]
        after = path[min(i + 1, len(path) - 1)]
        df, dh = after[0] - before[0], after[1] - before[1]
        length = math.hypot(df, dh)
        ring = []
        for j in range(8):
            angle = j * math.tau / 8
            radial = .019 * math.sin(angle) / length
            ring.append(fz(forward + dh * radial, height - df * radial, .019 * math.cos(angle)))
        spout_rings.append(ring)
    m.solid(spout_rings, STEELBLUE)
    outlet = fz(.014, 1.011)
    m.tube(fz(.014, 1.033), fz(.014, 1.012), .023, 10, METAL)
    m.tube(fz(.014, 1.013), outlet, .014, 10, GRAPHITE)

    m.tube(fz(-.217, .893, .13), fz(-.217, .937, .13), .029, 10, METAL)     # mixer base
    m.box((.112, .145, .93), (.148, .231, .949), STEELBLUE)                    # lever towards the bowl
    return m, {'HANDLE': fz(-.153, .949, .13), 'WATER_OUTLET': outlet,
               'DRAIN': drain, 'STAND': fz(.64, 0)}


def build_moving_head(root, material):
    # Z is up in Blender. Each mesh is built in its own pivot space.
    deck, arms, lamp = Mesh(), Mesh(), Mesh()
    deck.solid([sink_ring(w, d, d, z, .018) for w, d, z in (
        (.148, .101, -.154), (.169, .121, -.141), (.169, .121, -.052), (.155, .108, -.042),
    )], GRAPHITE)
    # A single saddle clamp with a silver shoe, hooked jaw and screw.
    deck.box((-.046, -.033, -.047), (.046, .033, -.032), METAL)
    deck.side([(-.032, -.036), (.025, -.036), (.047, -.023), (.047, 0),
               (.025, 0), (.025, -.017), (-.022, -.017), (-.022, -.005),
               (-.038, -.005), (-.038, -.026)], .031, METAL)
    deck.tube((0, .021, -.02), (0, .059, -.02), .009, 8, STEELBLUE)
    deck.box((-.025, -.122, -.126), (.025, -.119, -.104), METAL)
    deck.box((-.015, -.123, -.12), (.015, -.120, -.11), BLUE)
    for x in (-.117, .117):
        for z in (-.117, -.093):
            deck.box((x - .024, -.122, z), (x + .024, -.120, z + .006), METAL)

    pan = -.165
    pivot = -.194
    arms.tube((0, 0, -.017), (0, 0, .015), .061, 12, METAL)
    arms.solid([sink_ring(w, d, d, z, .02) for w, d, z in (
        (.145, .056, -.057), (.152, .061, -.047), (.137, .05, -.013),
    )], GRAPHITE)
    for side in (-1, 1):
        first_arm_face = len(arms.c)
        arms.side([(-.058, -.035), (.058, -.035), (.069, -.074),
                   (.058, -.202), (.043, -.235), (-.043, -.235),
                   (-.058, -.202), (-.069, -.074)], .017, GRAPHITE, side * .138)
        for bevel in (1, 3, 5, 7):
            arms.c[first_arm_face + bevel] = METAL
        arms.tube((side * .096, 0, pivot), (side * .129, 0, pivot), .025, 6, METAL)
        arms.tube((side * .153, 0, pivot), (side * .160, 0, pivot), .038, 10, METAL)
        arms.tube((side * .159, 0, pivot), (side * .165, 0, pivot), .023, 8, GRAPHITE)

    # The front rim rolls into the recessed lens; the lens rises slightly towards its centre.
    profile = [(.068, -.113), (.088, -.119), (.102, -.105), (.106, -.057),
               (.106, .029), (.091, .064), (.067, .077)]
    lamp.solid([[(r * math.cos(a * math.tau / 12), r * math.sin(a * math.tau / 12), z)
                 for a in range(12)] for r, z in profile], GRAPHITE)
    lamp.c[:12] = [METAL] * 12
    lens_z = -.116
    lamp.solid([[(r * math.cos(a * math.tau / 12), r * math.sin(a * math.tau / 12), z)
                 for a in range(12)] for r, z in ((.057, lens_z), (.068, -.111), (.069, -.109))], CYAN)
    lamp.c[:12] = [BLUE] * 12
    lamp.c[-2] = STEELBLUE
    for y in (-.034, 0, .034):
        lamp.box((-.045, y - .003, .075), (.045, y + .003, .081), METAL)

    base_node = deck.build('base', material)
    base_node.parent = root
    yoke_node = arms.build('yoke', material)
    yoke_node.parent = base_node
    yoke_node.location.z = pan
    head_node = lamp.build('head', material)
    head_node.parent = yoke_node
    head_node.location.z = pivot
    hang = (0, 0, 0)
    empty('HANG', hang, base_node)
    empty('BEAM', (0, 0, lens_z), head_node)
    vertices = deck.v + [(x, y, z + pan) for x, y, z in arms.v]
    vertices += [(x, y, z + pan + pivot) for x, y, z in lamp.v]
    return vertices, {'HANG': hang, 'BEAM': (0, 0, lens_z + pan + pivot)}


def build_dj_desk():
    m = Mesh()

    def point(y, z, x):
        return fz(z, y, x)

    def box(x0, x1, y0, y1, z0, z1, color):
        m.box(point(y0, z1, x0), point(y1, z0, x1), color)

    def disk(x, z, radius, bottom, top, color, sides=24):
        def row(y):
            return [point(y, z-radius*math.sin(i*math.tau/sides),
                          x+radius*math.cos(i*math.tau/sides)) for i in range(sides)]
        m.solid([row(bottom), row(top)], color)

    # Recessed panels and stepped fins give the front a readable silhouette in club lighting.
    box(-2.36, 2.36, 0, .09, -.45, .43, GRAPHITE)
    box(-2.32, 2.32, .085, .76, -.43, .41, GRAPHITE)
    for x in (-1.78, -.9, 0, .9, 1.78):
        box(x-.36, x+.36, .145, .705, -.474, -.426, STEELBLUE)
        box(x-.335, x+.335, .17, .68, -.485, -.47, GRAPHITE)
        for rib in (-.24, -.12, 0, .12, .24):
            box(x+rib-.025, x+rib+.025, .23, .63, -.498, -.481, STEELBLUE)
    box(-2.49, 2.49, .75, .815, -.5, .48, GRAPHITE)
    box(-2.38, 2.38, .715, .751, -.489, -.452, METAL)

    for x in (-.89, .89):
        box(x-.41, x+.41, .813, .89, -.38, .39, GRAPHITE)
        box(x-.39, x+.39, .886, .9, -.355, .365, METAL)
        disk(x-.055, -.015, .272, .9, .924, STEELBLUE)
        disk(x-.055, -.015, .255, .924, .937, GRAPHITE)
        disk(x-.055, -.015, .067, .937, .941, TEAL if x < 0 else RED, 12)
        disk(x-.055, -.015, .012, .941, .952, PAPER, 8)
        pivot = x+.295
        disk(pivot, -.22, .042, .9, .96, GRAPHITE, 12)
        m.tube(point(.963, -.22, pivot), point(.963, .09, pivot), .013, 6, METAL)
        m.tube(point(.963, .09, pivot), point(.947, .171, x+.22), .013, 6, METAL)
        box(x+.193, x+.238, .93, .954, .163, .212, PAPER)
        box(x-.345, x-.256, .898, .915, .237, .306, TEAL)

    # The DJ's palms are slightly below the wrist targets. Keep the control-free lip
    # underneath the grip point, and put the raised controls out of its path.
    box(-.43, .43, .813, .917, -.36, .70, GRAPHITE)
    box(-.414, .414, .916, .927, -.346, .695, STEELBLUE)
    for x in (-.27, -.14, .14, .27):
        for z in (-.27, -.16):
            disk(x, z, .031, .926, .953, GRAPHITE, 8)
            box(x-.007, x+.007, .952, .957, z-.005, z+.022, PAPER)
    for x in (-.14, .14):
        box(x-.013, x+.013, .926, .930, -.08, .15, GRAPHITE)
        box(x-.035, x+.035, .929, .945, .055, .088, PAPER)
    for i in range(5):
        box(-.042, .042, .926, .932, -.21+i*.044, -.19+i*.044, TEAL if i<4 else YELLOW)

    # Low-profile laptop and wedge stand fit under the one-metre sightline.
    box(1.27, 1.88, .813, .856, -.49, -.28, STEELBLUE)
    box(1.295, 1.855, .855, .875, -.482, -.269, GRAPHITE)
    box(1.31, 1.84, .873, .882, -.446, -.28, METAL)
    m.solid([[point(y,z,x) for x,z in ((1.295,front),(1.855,front),(1.855,back),(1.295,back))]
             for y,back,front in ((.873,-.484,-.468),(1.011,-.499,-.478))], GRAPHITE)
    m.face([point(.884,-.467,1.839),point(.884,-.467,1.311),
            point(1.001,-.477,1.311),point(1.001,-.477,1.839)], BLUE)
    box(1.551, 1.599, .943, .974, -.5, -.496, PAPER)

    for x in (-2.13, 2.13):
        box(x-.243, x+.243, .814, 1.013, -.407, .058, GRAPHITE)
        box(x-.219, x+.219, .829, 1.002, -.421, -.402, STEELBLUE)
        for offset, radius in ((-.085,.07),(.099,.048)):
            m.tube(point(.918,-.425,x+offset), point(.918,-.437,x+offset), radius, 16, GRAPHITE)
            m.tube(point(.918,-.436,x+offset), point(.918,-.444,x+offset), radius*.45, 12, METAL)
        box(x+.154, x+.186, .847, .859, -.426, -.421, TEAL)
    return m, {}


PROPS = {
    'phone': ('hand', build_phone, 'スマートフォン'),
    'wine_glass': ('hand', build_wine_glass, 'ワイングラス'),
    'radio': ('hand', build_radio, '無線機'),
    'desk_pc': ('furniture', build_desk_pc, '立ち机とパソコン'),
    'boombox': ('furniture', build_boombox, 'ラジカセ'),
    'tv': ('furniture', build_tv, 'テレビ'),
    'vacuum': ('furniture', build_vacuum, '掃除機'),
    'sink': ('furniture', build_sink, '洗面台'),
    'moving_head': ('furniture', build_moving_head, 'ムービングライト'),
    'dj_desk': ('furniture', build_dj_desk, 'DJ卓'),
}


def make(aid):
    kind, fn, label = PROPS[aid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = bpy.data.objects.new(aid, None); bpy.context.collection.objects.link(root)
    if aid == 'moving_head':
        vertices, anchors = fn(root, base.palette_material())
    else:
        mesh, anchors = fn()
        ob = mesh.build(aid + '_mesh', base.palette_material()); ob.parent = root
        for name, p in anchors.items(): empty(name, p, root)
        vertices = mesh.v
    folder = OUT / 'models' / aid; folder.mkdir(parents=True, exist_ok=True)
    glb = folder / (aid + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_yup=True, export_apply=True)
    j, tris, size = glb_info(glb)
    to_gl = lambda p: [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]
    xs, ys, zs = zip(*vertices)
    return {'id': aid, 'kind': kind, 'label': label, 'triangles': tris, 'bytes': size,
            'size_m': [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)],
            'anchors': {k: to_gl(v) for k, v in anchors.items()}}


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    info = [make(a) for a in (args or list(PROPS))]
    path = OUT / 'build-info.json'
    old = {e['id']: e for e in json.loads(path.read_text(encoding='utf-8'))} if path.exists() and args else {}
    old.update({e['id']: e for e in info})
    path.write_text(json.dumps([old[a] for a in PROPS if a in old], ensure_ascii=False, indent=2), encoding='utf-8', newline='\r\n')
    for e in info: print('BUILT', e['id'], e['triangles'], 'tris', e['bytes'], 'bytes', e['size_m'])

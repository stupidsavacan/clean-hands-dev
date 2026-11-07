# M5.5 combat props: weapons, ammo, muzzle flash and cover objects.
# blender -b -P build_m55_assets.py [-- id ...]
# Same conventions as character-revision: one shared 16-colour palette atlas (256x256, 4x4 cells), flat faces,
# roughness 1, one GLB per asset. Authoring axes: x right, z up, -y forward (glTF: Y up, +Z forward).
import bpy, bmesh, json, math, os, struct, sys
from mathutils import Vector, Matrix
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
COLORS = ['2b2e35', 'efeadf', 'c22f21', 'f2c14e', '17776c', '3b5b8a', '4fb8c9', 'd9b39a',
          '9b7053', '503f35', '8b9c88', 'c8d7cf', 'ddd0b8', 'a9bcc9', 'f2d7c4', '737a82']
GRAPHITE, PAPER, YELLOW, TEAL, BLUE, CYAN, WOOD, DARKWOOD, SAGE, SAND, STEELBLUE, METAL = 0, 1, 3, 4, 5, 6, 8, 9, 10, 12, 13, 15


def palette_material(flash=False):
    im = bpy.data.images.get('CLEAN_HANDS_Palette_256')
    if not im:
        im = bpy.data.images.new('CLEAN_HANDS_Palette_256', 256, 256, alpha=False)
        px = []
        for y in range(256):
            for x in range(256):
                h = COLORS[(3 - y // 64) * 4 + x // 64]
                px.extend([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1])
        im.pixels = px
        im.filepath_raw = str(OUT / 'palette.png'); im.file_format = 'PNG'; im.save(); im.pack()
    m = bpy.data.materials.new('Flash' if flash else 'Palette'); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value = 1
    tex = m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = im; tex.interpolation = 'Closest'
    m.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
    if flash:
        # The flash glows in its own colours and is seen from both sides.
        m.node_tree.links.new(tex.outputs['Color'], bs.inputs['Emission Color'])
        bs.inputs['Emission Strength'].default_value = 1.0
        m.use_backface_culling = False
    else:
        m.use_backface_culling = True
    return m


class Mesh:
    """Faces carry a palette index; parts are closed solids that overlap by a few mm instead of sharing planes."""
    def __init__(self): self.v = []; self.f = []; self.c = []

    def face(self, pts, c):
        base = len(self.v); self.v.extend(tuple(p) for p in pts); self.f.append(tuple(range(base, base + len(pts)))); self.c.append(c)

    def solid(self, rings, c, caps=True):
        """Loft through rings of equal length; rings are lists of 3D points."""
        rows = []
        for ring in rings:
            base = len(self.v); self.v.extend(tuple(p) for p in ring); rows.append(list(range(base, base + len(ring))))
        n = len(rings[0])
        for a, b in zip(rows, rows[1:]):
            for i in range(n):
                self.f.append((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])); self.c.append(c)
        if caps:
            self.f.append(tuple(rows[0][::-1])); self.c.append(c)
            self.f.append(tuple(rows[-1])); self.c.append(c)

    def box(self, lo, hi, c):
        (x0, y0, z0), (x1, y1, z1) = lo, hi
        self.solid([[(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)],
                    [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]], c)

    def side(self, profile, half, c, x=0.0):
        """Extrude a side profile given as (forward, up) pairs across x = x±half (forward is -y)."""
        self.solid([[(x - half, -f, z) for f, z in profile], [(x + half, -f, z) for f, z in profile]], c)

    def tube(self, a, b, r, n, c, phase=0.0):
        a, b = Vector(a), Vector(b); d = (b - a).normalized()
        u = d.orthogonal().normalized(); w = d.cross(u)
        ring = lambda o: [o + (u * math.cos(phase + i * math.tau / n) + w * math.sin(phase + i * math.tau / n)) * r for i in range(n)]
        self.solid([ring(a), ring(b)], c)

    def ico(self, centre, scale, c, seed=0):
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1 if scale[0] > 2 else 0, radius=1)
        rot = Matrix.Rotation(seed * 1.3, 3, 'Z') @ Matrix.Rotation(seed * .7, 3, 'X')
        base = len(self.v)
        for v in bm.verts:
            p = rot @ v.co; self.v.append((centre[0] + p.x * scale[0], centre[1] + p.y * scale[1], centre[2] + p.z * scale[2]))
        for f in bm.faces:
            self.f.append(tuple(base + v.index for v in f.verts)); self.c.append(c)
        bm.free()

    def build(self, name, mat, recalc=True, shift=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        me.from_pydata([(x - shift[0], y - shift[1], z - shift[2]) for x, y, z in self.v], [], self.f); me.update()
        ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); me.materials.append(mat)
        uv = me.uv_layers.new(name='PaletteUV')
        for p, c in zip(me.polygons, self.c):
            for li in p.loop_indices: uv.data[li].uv = ((c % 4 + .5) / 4, 1 - (c // 4 + .5) / 4)
            p.use_smooth = False
        if recalc:
            bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(me); bm.free()
        return ob


def empty(name, loc, parent):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o)
    o.location = loc; o.parent = parent; o.empty_display_size = .03; return o


def fz(f, z, x=0.0):
    """Weapon-space point: forward f, up z, right x -> Blender (x, -f, z)."""
    return (x, -f, z)

# ---------- weapons (origin: centre of the right-hand grip; barrel points +Z in glTF) ----------

def trigger_group(m, bottom, top):
    """Trigger guard loop from the grip to the frame underside (top), with the trigger hanging inside it."""
    m.side([(-.004, bottom - .006), (.050, bottom - .006), (.056, bottom), (.056, top), (.048, top), (.048, bottom + .002), (-.004, bottom + .002)], .006, GRAPHITE)
    m.side([(.017, top), (.024, top), (.022, bottom + .012), (.017, bottom + .014)], .003, METAL)


def pistol(m, grip_colour):
    # slide with a chamfered top edge, frame, slanted grip, magazine base, sights, barrel crown
    m.side([(-.055, .040), (.135, .040), (.135, .066), (.130, .072), (-.050, .072), (-.055, .067)], .013, GRAPHITE)
    m.box((.0095, -.045, .054), (.0136, -.012, .068), METAL)                      # ejection port, right side
    m.side([(-.045, .022), (.128, .022), (.128, .041), (-.045, .041)], .011, GRAPHITE)
    m.side([(-.045, .024), (.005, .024), (-.008, -.060), (-.055, -.057)], .0145, grip_colour)
    m.side([(-.058, -.056), (-.006, -.059), (-.006, -.067), (-.058, -.064)], .0155, METAL)
    trigger_group(m, -.012, .026)
    m.box((-.009, .040, .070), (.009, .052, .079), GRAPHITE)                       # rear sight
    m.box((-.002, -.130, .070), (.002, -.122, .078), METAL)                        # front sight
    m.tube(fz(.128, .057), fz(.140, .057), .0055, 8, METAL)


def build_pistol_guard():
    m = Mesh(); pistol(m, DARKWOOD)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.010, -.010, -.035), 'MUZZLE': fz(.140, .057)}, (0, 0, 0)


def build_pistol_silenced():
    m = Mesh(); pistol(m, GRAPHITE)
    m.tube(fz(.138, .057), fz(.300, .057), .0165, 12, GRAPHITE)
    for a in (.141, .287): m.tube(fz(a, .057), fz(a + .010, .057), .0173, 12, METAL)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.010, -.010, -.035), 'MUZZLE': fz(.300, .057)}, (0, 0, 0)


def build_smg():
    m = Mesh()
    m.side([(-.100, .030), (.170, .030), (.170, .085), (-.090, .085), (-.100, .075)], .021, GRAPHITE)
    m.box((-.009, -.120, .084), (.009, .070, .095), METAL)                         # top rail
    m.box((-.0035, -.165, .084), (.0035, -.155, .104), METAL)                      # front post
    m.tube(fz(.168, .062), fz(.260, .062), .015, 8, GRAPHITE, math.pi / 8)
    m.tube(fz(.255, .062), fz(.285, .062), .009, 8, METAL)
    m.side([(-.035, .035), (.005, .035), (-.008, -.065), (-.045, -.062)], .014, GRAPHITE)
    trigger_group(m, -.012, .034)
    m.side([(.075, .035), (.105, .035), (.115, -.140), (.085, -.140)], .012, GRAPHITE)        # magazine
    m.side([(.081, -.137), (.119, -.137), (.119, -.150), (.081, -.150)], .014, METAL)
    m.side([(.128, .035), (.160, .035), (.155, -.045), (.133, -.045)], .013, DARKWOOD)        # fore grip
    for z in (.072, .040): m.tube(fz(-.300, z), fz(-.090, z), .0055, 6, METAL)                 # wire stock
    m.side([(-.315, .018), (-.296, .018), (-.296, .092), (-.315, .092)], .021, GRAPHITE)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.145, -.005), 'MUZZLE': fz(.285, .062), 'STOCK': fz(-.315, .055)}, (0, 0, 0)


def build_rifle_npc():
    m = Mesh()
    m.side([(-.120, .025), (.200, .025), (.200, .085), (-.110, .085), (-.120, .070)], .022, GRAPHITE)
    m.tube(fz(.198, .055), fz(.440, .055), .026, 8, GRAPHITE, math.pi / 8)                        # handguard
    m.tube(fz(.435, .058), fz(.540, .058), .008, 8, GRAPHITE)
    m.tube(fz(.520, .058), fz(.570, .058), .012, 8, METAL)
    m.box((-.009, -.400, .084), (.009, .080, .094), METAL)                          # rail over receiver and handguard
    m.box((-.008, -.090, .093), (.008, -.020, .102), METAL)                         # optic mount
    m.tube(fz(-.002, .118), fz(.110, .118), .020, 8, GRAPHITE, math.pi / 8)
    m.tube(fz(.105, .118), fz(.112, .118), .016, 8, CYAN, math.pi / 8)            # front lens
    m.side([(-.110, .075), (-.110, .028), (-.330, -.022), (-.345, -.022), (-.345, .078), (-.330, .082)], .020, GRAPHITE)
    m.side([(-.360, -.026), (-.342, -.026), (-.342, .084), (-.360, .084)], .021, GRAPHITE)
    m.side([(-.035, .030), (.005, .030), (-.010, -.070), (-.048, -.067)], .015, GRAPHITE)
    trigger_group(m, -.016, .029)
    m.side([(.060, .030), (.105, .030), (.118, -.060), (.135, -.150), (.095, -.160), (.080, -.065)], .013, GRAPHITE)
    return m, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.150, .020), 'MUZZLE': fz(.570, .058), 'STOCK': fz(-.360, .030)}, (0, 0, 0)


def build_ammo_pickup():
    m = Mesh()
    m.box((-.13, -.055, 0), (.13, .055, .145), SAGE)                                # ammo can
    m.box((-.135, -.060, .140), (.135, .060, .170), SAGE)                           # lid
    m.box((-.045, -.012, .169), (.045, .012, .185), GRAPHITE)                       # handle
    m.box((-.090, -.0605, .055), (.090, -.050, .085), YELLOW)                       # stencil band, front
    m.box((-.120, .0545, .060), (-.060, .0605, .080), YELLOW)
    for i, (x, y, a) in enumerate([(.195, -.01, .12), (.240, .005, .12)]):            # two loose magazines on the floor
        r = Matrix.Rotation(a, 3, 'Z')
        mag = [r @ Vector(p) + Vector((x, y, 0)) for p in [(-.015, -.065, 0), (.015, -.065, 0), (.015, .065, 0), (-.015, .065, 0)]]
        m.solid([[(p.x, p.y, 0) for p in mag], [(p.x, p.y, .028) for p in mag]], GRAPHITE)
        tip = [r @ Vector(p) + Vector((x, y, 0)) for p in [(-.006, .060, 0), (.006, .060, 0), (.006, .078, 0), (-.006, .078, 0)]]
        m.solid([[(p.x, p.y, .007) for p in tip], [(p.x, p.y, .021) for p in tip]], YELLOW)  # cartridge nose
    return m, {'PICKUP': (0, 0, .09)}, (0, 0, 0)


def build_muzzle_flash():
    m = Mesh()
    for k in range(3):                                                             # three crossed petals along the barrel axis
        a = k * math.pi / 3; d = Vector((math.cos(a), 0, math.sin(a)))
        pts = [(0, 0), (.05, .036), (.14, 0), (.05, -.036)]
        m.face([Vector(fz(f, 0)) + d * s for f, s in pts], YELLOW)
        a2 = a + math.pi / 6; d2 = Vector((math.cos(a2), 0, math.sin(a2)))
        m.face([Vector(fz(f, 0)) + d2 * s for f, s in [(0, 0), (.03, .018), (.075, 0), (.03, -.018)]], PAPER)
    star = []
    for i in range(12):                                                            # six-point star facing forward
        r = .045 if i % 2 == 0 else .018; a = i * math.tau / 12
        star.append((r * math.cos(a), -.004, r * math.sin(a)))
    m.face(star, YELLOW)
    return m, {'MUZZLE': (0, 0, 0)}, (0, 0, 0)

# ---------- cover (origin: centre of the footprint on the floor; sizes match the 5.1 collision boxes) ----------

def cover_points(hx, hy, gap=.45):
    return {'COVER_FRONT': (0, -hy - gap, 0), 'COVER_BACK': (0, hy + gap, 0), 'COVER_LEFT': (-hx - gap, 0, 0), 'COVER_RIGHT': (hx + gap, 0, 0)}


def build_car(body):
    m = Mesh(); hw = .90
    m.side([(-2.18, .28), (2.18, .28), (2.20, .45), (2.15, .72), (1.10, .80), (-1.25, .82), (-2.15, .78), (-2.20, .55)], hw, body)
    m.side([(1.06, .78), (.45, 1.37), (-.78, 1.39), (-1.42, .79)], .80, GRAPHITE)    # glass house
    m.side([(.40, 1.355), (-.74, 1.375), (-.76, 1.425), (.38, 1.405)], .785, body)     # roof
    m.side([(-.20, .80), (-.08, .80), (-.08, 1.36), (-.20, 1.36)], .806, body)          # B pillar
    for f in (1.38, -1.38):
        for s in (-1, 1):
            m.tube((s * .68, -f, .33), (s * .90, -f, .33), .33, 10, GRAPHITE, math.pi / 10)
            m.tube((s * .86, -f, .33), (s * .905, -f, .33), .18, 8, METAL, math.pi / 8)
    for s in (-1, 1):
        m.box((s * .82 - .13, -2.195, .56), (s * .82 + .13, -2.12, .66), PAPER)     # headlights
        m.box((s * .80 - .13, 2.12, .60), (s * .80 + .13, 2.195, .70), YELLOW)      # tail lights
        m.box((min(s * .78, s * .95), -1.00, .80), (max(s * .78, s * .95), -.90, .88), body)  # mirrors, rooted in the door glass
    m.box((-.40, -2.198, .40), (.40, -2.15, .53), GRAPHITE)                          # grille
    m.box((-.86, -2.20, .28), (.86, -2.08, .40), METAL)                              # bumpers
    m.box((-.86, 2.08, .30), (.86, 2.20, .42), METAL)
    return m, cover_points(.95, 2.2), (0, 0, 0)


def build_crate():
    m = Mesh(); h = .58
    m.box((-h, -h, 0.02), (h, h, 1.18), WOOD)
    # edge boards: each direction has a slightly different thickness so no two faces share a plane
    for y in (-1, 1):
        for z in (0, 1):
            m.box((-.600, y * .600 - (.08 if y > 0 else 0), z * 1.12), (.600, y * .600 + (.08 if y < 0 else 0), z * 1.12 + .08), DARKWOOD)
    for x in (-1, 1):
        for z in (0, 1):
            m.box((x * .595 - (.075 if x > 0 else 0), -.53, .005 + z * 1.12), (x * .595 + (.075 if x < 0 else 0), .53, .005 + z * 1.12 + .07), DARKWOOD)
    for x in (-1, 1):
        for y in (-1, 1):
            m.box((x * .590 - (.07 if x > 0 else 0), y * .590 - (.07 if y > 0 else 0), .07), (x * .590 + (.07 if x < 0 else 0), y * .590 + (.07 if y < 0 else 0), 1.13), DARKWOOD)
    m.box((-.53, -.592, .55), (.53, .592, .65), DARKWOOD)                            # middle bands
    m.box((-.588, -.52, .555), (.588, .52, .645), DARKWOOD)
    m.box((-.30, -.5935, .80), (.30, -.585, .95), YELLOW)                           # cargo label
    return m, cover_points(.6, .6), (0, 0, 0)


def build_planter(width):
    m = Mesh(); hx, hy = width / 2, .6
    m.box((-hx + .02, -hy + .02, 0), (hx - .02, hy - .02, .74), SAND)
    m.box((-hx, -hy, .72), (hx, hy, .80), PAPER)                                     # rim
    m.box((-hx + .03, -hy + .03, -.01), (hx - .03, hy - .03, .04), METAL)             # plinth shadow line
    # Clipped hedge in the style of the existing hedge.glb: a chamfered block with darker bands.
    # Its top (1.55 m) matches the sight height the game already gives planters (box + 0.65 m).
    def hedge(x0, x1, grow=0.0, c=SAGE):
        w = hy - .07 + grow
        prof = [(-w, .78 + grow), (w, .78 + grow), (w, 1.32 + grow), (w - .16, 1.55 + grow), (-w + .16, 1.55 + grow), (-w, 1.32 + grow)]
        m.solid([[(x0, y, z) for y, z in prof], [(x1, y, z) for y, z in prof]], c)
    hedge(-hx + .07, hx - .07)
    n = 2 if width < 2 else 4
    for i in range(n):
        x = -hx + .07 + (i + .5) * (width - .14) / n
        hedge(x - .07, x + .07, .012, TEAL)
    return m, cover_points(hx, hy), (0, 0, 0)


def build_counter():
    m = Mesh()
    m.box((-.995, -.43, 0), (.995, .43, .11), GRAPHITE)                              # toe kick
    m.box((-.995, -.45, .10), (.995, .45, 1.05), DARKWOOD)
    m.box((-1.0, -.50, 1.04), (1.0, .50, 1.10), PAPER)                               # top
    for x in (-.5, 0, .5): m.box((x - .03, -.462, .16), (x + .03, -.44, 1.0), WOOD)  # front fluting
    m.tube((-1.0, -.56, .24), (1.0, -.56, .24), .022, 8, YELLOW)                      # brass foot rail
    for x in (-.7, .7): m.box((x - .015, -.56, .23), (x + .015, -.445, .25), YELLOW)
    return m, cover_points(1.0, .5), (0, 0, 0)


ASSETS = {
    'pistol_guard': ('weapon', build_pistol_guard, '警備の拳銃'),
    'pistol_silenced': ('weapon', build_pistol_silenced, '消音ピストル'),
    'smg': ('weapon', build_smg, '短機関銃（私設護衛）'),
    'rifle_npc': ('weapon', build_rifle_npc, '突撃銃（増援部隊・NPC専用）'),
    'ammo_pickup': ('item', build_ammo_pickup, '落ちている弾'),
    'muzzle_flash': ('effect', build_muzzle_flash, '銃口の火花'),
    'car_sedan_blue': ('cover', lambda: build_car(BLUE), '車（青）'),
    'car_sedan_white': ('cover', lambda: build_car(PAPER), '車（白）'),
    'car_sedan_grey': ('cover', lambda: build_car(METAL), '車（灰）'),
    'crate': ('cover', build_crate, '木箱'),
    'planter_1x1': ('cover', lambda: build_planter(1.2), 'プランター 1.2m'),
    'planter_3x1': ('cover', lambda: build_planter(3.0), 'プランター 3m'),
    'counter_bar_2m': ('cover', build_counter, 'バーカウンター 2m（並べて使う）'),
}


def glb_info(path):
    b = open(path, 'rb').read(); j = json.loads(b[20:20 + struct.unpack_from('<I', b, 12)[0]])
    tris = sum(j['accessors'][p['indices']]['count'] // 3 for me in j['meshes'] for p in me['primitives'])
    return j, tris, len(b)


def make(aid):
    kind, fn, label = ASSETS[aid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh, anchors, shift = fn()
    root = bpy.data.objects.new(aid, None); bpy.context.collection.objects.link(root)
    mat = palette_material(flash=(kind == 'effect'))
    ob = mesh.build(aid + '_mesh', mat, recalc=(kind != 'effect'), shift=shift); ob.parent = root
    for name, p in anchors.items(): empty(name, p, root)
    folder = OUT / 'models' / aid; folder.mkdir(parents=True, exist_ok=True)
    glb = folder / (aid + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_yup=True, export_apply=True)
    (OUT / 'blends').mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'blends' / (aid + '.blend')))
    j, tris, size = glb_info(glb)
    to_gl = lambda p: [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]
    return {'id': aid, 'kind': kind, 'label': label, 'triangles': tris, 'bytes': size,
            'anchors': {k: to_gl(v) for k, v in anchors.items()}}


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ids = args or list(ASSETS)
    info = [make(a) for a in ids]
    path = OUT / 'build-info.json'
    old = {e['id']: e for e in json.loads(path.read_text(encoding='utf-8'))} if path.exists() and args else {}
    old.update({e['id']: e for e in info})
    path.write_text(json.dumps([old[a] for a in ASSETS if a in old], ensure_ascii=False, indent=2), encoding='utf-8')
    for e in info: print('BUILT', e['id'], e['triangles'], 'tris', e['bytes'], 'bytes')

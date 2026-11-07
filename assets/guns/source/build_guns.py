# Generic firearms for the weapon categories of the HITMAN WoA lists that had no model (2026-11-05, first set rebuilt
# in detail 2026-11-06). Each is a generic design for its category, not a copy of a named gun.
# blender -b -P build_guns.py [-- id ...]
# Same conventions and helpers as the M5.5 guns (../../m55-combat/source/build_m55_assets.py): the shared 16-colour
# palette, flat faces, roughness 1, one GLB each, metres. The origin is the centre of the right-hand grip and the
# barrel points +Z in glTF. Empty nodes: GRIP_R (the right hand), GRIP_L (the supporting hand), MUZZLE (shots and the
# flash), STOCK (the shoulder; long guns), SCOPE (the eye; the sniper rifle). Generic shapes, no real make or model.
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'm55-combat' / 'source'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_m55_assets as base
from build_m55_assets import Mesh, empty, fz, glb_info, trigger_group, GRAPHITE, PAPER, YELLOW, TEAL, BLUE, CYAN, WOOD, DARKWOOD, SAGE, SAND, STEELBLUE, METAL
import bpy

OUT = Path(__file__).resolve().parent.parent


# ======================================================================================================================
# Second set (2026-11-05, more detailed): categories of the 194-item weapon list that had no model. Generic designs for
# each category (the list's named guns are the original game's own designs and are not copied). Finer modelling:
# chamfered edges, turned parts, grooves, more colours, and the parts that move as their own nodes, each with its
# origin on its pivot (HAMMER, CYLINDER, TRIGGER, SLIDE, MAGAZINE, BOLT, LEVER) so the game can animate them.
from detail import prism, lathe, grooves, inset, screw


def bar(m, a, b, t, half, c, x=0.0):
    """A thin flat bar from a to b (forward, up), t thick in the side view: trigger guards and loops."""
    dx, dz = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dz) or 1; nx, nz = -dz / l * t / 2, dx / l * t / 2
    prism(m, [(a[0] + nx, a[1] + nz), (b[0] + nx, b[1] + nz), (b[0] - nx, b[1] - nz), (a[0] - nx, a[1] - nz)], half, c, x)


def loop(m, pts, t, half, c):
    """A chain of bars (a trigger guard)."""
    for a, b in zip(pts, pts[1:]): bar(m, a, b, t, half, c)


def build_revolver():
    """High-power pistol (list rows 23, 66, 67, 84): a large-frame six-shot revolver in brushed steel, a heavy barrel
    with a full underlug and a vented rib, wooden grips. The cylinder, hammer and trigger move."""
    body, cyl, ham, trg = Mesh(), Mesh(), Mesh(), Mesh()
    S = METAL
    prism(body, [(-.030, .024), (.100, .024), (.104, .032), (.104, .048), (.072, .046), (.020, .046), (-.020, .050), (-.030, .046)], .0115, S, bev=.0025)
    prism(body, [(-.032, .040), (.018, .040), (.018, .094), (-.008, .099), (-.032, .088)], .0135, S, bev=.003)          # recoil shield
    prism(body, [(.074, .040), (.104, .040), (.104, .090), (.074, .090)], .012, S, bev=.003)                            # front of frame
    prism(body, [(.010, .084), (.080, .084), (.080, .096), (.010, .096)], .009, S, bev=.002)                            # top strap
    for x in (-.0055, .0055): body.box((x - .0018, .006, .096), (x + .0018, -.008, .104), GRAPHITE)                    # rear sight
    lathe(body, [(.100, .0115), (.250, .0115)], .068, 14, S)                                                             # barrel
    lathe(body, [(.249, .0098), (.2535, .0098)], .068, 14, GRAPHITE)                                                     # crown
    prism(body, [(.104, .076), (.250, .076), (.250, .084), (.104, .084)], .0055, S, bev=.0015)                           # vented rib
    for i in range(6):
        a = .118 + i * .021; body.box((-.0038, -a, .0836), (.0038, -(a + .010), .0846), GRAPHITE)
    prism(body, [(.104, .044), (.250, .044), (.250, .062), (.104, .058)], .0095, S, bev=.002)                            # underlug
    lathe(body, [(.2502, .0034), (.2512, .0034)], .053, 8, GRAPHITE)                                                     # ejector rod end
    prism(body, [(.225, .084), (.247, .084), (.247, .099), (.240, .099)], .002, S)                                       # front sight ramp
    body.box((-.0022, -.241, .093), (.0022, -.2455, .0985), 2)                                                           # red insert
    body.box((-.0165, .004, .060), (-.0135, -.010, .068), GRAPHITE)                                                      # cylinder latch (left)
    grip = [(-.034, .032), (.006, .032), (.010, .012), (.003, -.030), (-.002, -.070), (-.010, -.088), (-.040, -.091), (-.050, -.076), (-.048, -.030), (-.042, .010)]
    prism(body, grip, .017, DARKWOOD, bev=.006)                                                                          # wooden grip
    for x in (.0172, -.0172): prism(body, inset(grip, .012), .0004, WOOD, x=x)                                           # lighter grain panels
    screw(body, -.022, -.030, .0176, .0035, METAL); screw(body, -.022, -.030, -.0176, .0035, METAL)
    prism(body, [(-.050, -.076), (-.040, -.091), (-.010, -.088), (-.010, -.094), (-.044, -.097), (-.055, -.080)], .0105, S, bev=.002)  # butt of the grip frame
    loop(body, [(-.004, .026), (-.008, .006), (.004, -.008), (.034, -.010), (.050, .002), (.054, .026)], .005, .0045, S)  # trigger guard
    # cylinder: 12 faces, every other one dark = six flutes; six chambers on the front face
    lathe(cyl, [(.019, .0165), (.021, .0195), (.073, .0195), (.075, .0165)], .066, 12, [S, GRAPHITE], phase=math.pi / 12)
    for k in range(6):
        a = k * math.tau / 6
        lathe(cyl, [(.0748, .0042), (.0757, .0042)], .066 + .0105 * math.sin(a), 8, GRAPHITE, x=.0105 * math.cos(a))
    prism(ham, [(-.030, .060), (-.016, .060), (-.014, .090), (-.026, .103), (-.042, .105), (-.045, .099), (-.030, .090)], .0045, S, bev=.001)
    for k in range(3): ham.box((-.0048, .040 - k * .006, .099 + k * .0018), (.0048, .037 - k * .006, .101 + k * .0018), GRAPHITE)
    prism(trg, [(.014, .040), (.026, .040), (.030, .022), (.026, .006), (.017, .004), (.021, .020)], .0035, S)
    parts = {'body': (body, (0, 0, 0)), 'CYLINDER': (cyl, fz(.047, .066)), 'HAMMER': (ham, fz(-.022, .072)), 'TRIGGER': (trg, fz(.020, .040))}
    return parts, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.010, -.010, -.035), 'MUZZLE': fz(.2535, .068)}


def build_tranq_pistol():
    """Sedative dart pistol (list rows 30, 59, 60, 79): a compressed-gas dart gun, dark polymer with yellow panels so
    it reads as non-lethal, a wide bore, a gas cartridge under the barrel and a window showing the loaded dart. The top
    loading lever and the trigger move."""
    body, lever, trg = Mesh(), Mesh(), Mesh()
    prism(body, [(-.040, .022), (.120, .022), (.128, .030), (.128, .052), (-.030, .052), (-.044, .040)], .016, GRAPHITE, bev=.004)
    housing = [(-.045, .052), (.150, .052), (.158, .060), (.158, .088), (.150, .094), (-.040, .094), (-.048, .086)]
    prism(body, housing, .018, GRAPHITE, bev=.005)
    for x in (.0186, -.0186): prism(body, [(.020, .062), (.130, .062), (.130, .082), (.020, .082)], .0006, YELLOW, x=x)   # yellow side panels
    body.box((.0188, -.070, .065), (.0194, -.112, .081), GRAPHITE)                                                          # loading window (right)
    body.box((.0192, -.074, .070), (.0198, -.104, .076), CYAN); body.box((.0192, -.104, .0715), (.0198, -.110, .0745), 2)  # the dart: vial and red tail
    lathe(body, [(.157, .0105), (.170, .0105), (.172, .0125), (.177, .0125)], .073, 14, METAL)                             # muzzle
    lathe(body, [(.1765, .0075), (.1775, .0075)], .073, 14, GRAPHITE)                                                      # wide bore
    lathe(body, [(.034, .0065), (.040, .0095), (.140, .0095), (.148, .0065)], .040, 12, METAL)                             # gas cartridge
    lathe(body, [(.147, .0068), (.153, .0068)], .040, 12, YELLOW)
    for x in (-.0055, .0055): body.box((x - .0016, .036, .094), (x + .0016, .028, .103), GRAPHITE)                          # rear sight
    body.box((-.0018, -.142, .094), (.0018, -.148, .102), GRAPHITE); body.box((-.0019, -.1435, .0985), (.0019, -.1465, .1015), YELLOW)
    body.tube((-.0175, -.010, .072), (-.0215, -.010, .072), .007, 12, GRAPHITE)                                             # pressure dial (left)
    body.tube((-.0213, -.010, .072), (-.0222, -.010, .072), .0045, 12, YELLOW)
    grip = [(-.038, .026), (.004, .026), (-.010, -.080), (-.050, -.082), (-.057, -.070), (-.044, .000)]
    prism(body, grip, .0165, GRAPHITE, bev=.005)
    for x in (.0168, -.0168): prism(body, inset(grip, .011), .0005, YELLOW, x=x)                                             # grip inserts
    loop(body, [(-.004, .024), (-.010, .004), (.004, -.010), (.052, -.010), (.056, .004), (.056, .024)], .005, .0055, GRAPHITE)
    prism(lever, [(.058, .094), (.140, .094), (.140, .100), (.064, .101)], .0055, METAL, bev=.0012)
    lever.box((-.0075, -.058, .095), (.0075, -.066, .106), GRAPHITE)                                                        # its thumb tab
    prism(trg, [(.014, .022), (.024, .022), (.028, .006), (.023, -.006), (.015, -.007), (.019, .008)], .0035, METAL)
    parts = {'body': (body, (0, 0, 0)), 'LEVER': (lever, fz(.140, .097)), 'TRIGGER': (trg, fz(.018, .022))}
    return parts, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.010, -.010, -.035), 'MUZZLE': fz(.1775, .073)}


def build_machine_pistol():
    """Fully automatic pistol (list rows 49-51, 83): a polymer-frame pistol with a ported compensator, an accessory
    rail, a selector on the slide and a long magazine. The slide, magazine and trigger move."""
    body, slide, mag, trg = Mesh(), Mesh(), Mesh(), Mesh()
    prism(body, [(-.040, .020), (.140, .020), (.145, .028), (.145, .046), (-.030, .046), (-.046, .034)], .014, GRAPHITE, bev=.003)
    body.box((-.010, -.070, .013), (.010, -.140, .021), GRAPHITE)                                                           # rail
    for i in range(5): body.box((-.0105, -(.074 + i * .013), .0128), (.0105, -(.080 + i * .013), .0134), METAL)
    lathe(body, [(.150, .0072), (.158, .0072)], .063, 12, METAL)                                                            # barrel at the muzzle
    prism(body, [(.155, .044), (.205, .044), (.208, .050), (.208, .078), (.155, .080)], .014, GRAPHITE, bev=.003)          # compensator
    for i in range(3): body.box((-.0065, -(.163 + i * .014), .0795), (.0065, -(.170 + i * .014), .0806), METAL)          # ports
    lathe(body, [(.2075, .0065), (.2085, .0065)], .063, 12, GRAPHITE)
    grip = [(-.040, .022), (.004, .022), (-.008, -.080), (-.048, -.082), (-.054, -.070), (-.044, .000)]
    prism(body, grip, .015, GRAPHITE, bev=.004)
    for x in (.0152, -.0152): prism(body, inset(grip, .010), .0005, METAL, x=x)                                               # grip texture panels
    loop(body, [(-.004, .020), (-.010, .002), (.004, -.010), (.050, -.010), (.054, .004), (.054, .020)], .005, .0050, GRAPHITE)
    prism(slide, [(-.050, .046), (.150, .046), (.155, .052), (.155, .074), (.148, .080), (-.044, .080), (-.050, .074)], .0135, METAL, bev=.003)
    grooves(slide, -.046, -.012, 7, .052, .076, .0135, .0012, GRAPHITE)                                                      # rear serrations
    grooves(slide, .115, .146, 5, .052, .076, .0135, .0012, GRAPHITE)                                                        # front serrations
    slide.box((.0133, -.030, .058), (.0145, -.066, .076), GRAPHITE)                                                         # ejection port
    for x in (-.0055, .0055): slide.box((x - .0016, .044, .080), (x + .0016, .036, .089), GRAPHITE)
    slide.box((-.0017, -.140, .080), (.0017, -.146, .088), GRAPHITE)
    slide.box((-.0165, .040, .064), (-.0133, .030, .072), YELLOW)                                                            # selector (left)
    prism(mag, [(-.044, -.078), (-.006, -.080), (-.010, -.175), (-.050, -.172)], .0115, GRAPHITE, bev=.002)
    prism(mag, [(-.055, -.170), (-.005, -.173), (-.005, -.186), (-.055, -.183)], .013, YELLOW, bev=.002)                     # base plate
    for k in range(4): mag.box((.0113, .030 + k * .002, -.100 - k * .018), (.0118, .025 + k * .002, -.106 - k * .018), METAL)
    prism(trg, [(.014, .020), (.024, .020), (.028, .004), (.023, -.006), (.015, -.007), (.019, .006)], .0035, GRAPHITE)
    parts = {'body': (body, (0, 0, 0)), 'SLIDE': (slide, fz(0, .063)), 'MAGAZINE': (mag, fz(-.027, -.080)), 'TRIGGER': (trg, fz(.018, .020))}
    return parts, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(-.010, -.010, -.035), 'MUZZLE': fz(.2085, .063)}


def build_hunting_rifle():
    """Hunting rifle (list rows 153, 161): a bolt-action rifle with a walnut stock (Monte Carlo comb, cheek piece,
    checkered grip and fore-end, dark fore-end tip and grip cap), a blued tapered barrel, a hunting scope and sling
    studs. The bolt and the trigger move."""
    body, bolt, trg = Mesh(), Mesh(), Mesh()
    stock = [(.48, .030), (.48, .058), (-.080, .060), (-.120, .080), (-.200, .098), (-.300, .102), (-.470, .096), (-.490, .094),
             (-.490, -.056), (-.470, -.058), (-.300, -.040), (-.150, -.012), (-.085, -.050), (-.060, -.060), (-.030, -.048),
             (-.010, .008), (.060, .008), (.100, .012)]
    prism(body, stock, .022, WOOD, bev=.008)
    prism(body, [(-.42, .056), (-.21, .062), (-.23, .088), (-.40, .090)], .0035, WOOD, x=-.0245, bev=.0015)                   # cheek piece (left)
    prism(body, [(.452, .030), (.492, .030), (.492, .058), (.452, .058)], .0225, DARKWOOD, bev=.007)                           # fore-end tip
    prism(body, [(-.090, -.050), (-.058, -.064), (-.052, -.070), (-.092, -.058)], .016, DARKWOOD, bev=.003)                    # grip cap
    for x in (.0223, -.0223):
        prism(body, [(-.016, .004), (-.040, -.036), (-.064, -.046), (-.074, -.010), (-.060, .030)], .0005, DARKWOOD, x=x)      # grip checkering
        prism(body, [(.200, .020), (.380, .020), (.380, .046), (.200, .046)], .0005, DARKWOOD, x=x)                           # fore-end checkering
    prism(body, [(-.516, -.060), (-.492, -.058), (-.492, .096), (-.516, .098)], .023, GRAPHITE, bev=.006)                      # recoil pad
    prism(body, [(-.493, -.058), (-.4895, -.058), (-.4895, .095), (-.493, .095)], .0228, PAPER)                                # white spacer
    lathe(body, [(-.075, .0155), (.160, .0155)], .072, 14, GRAPHITE)                                                           # receiver
    lathe(body, [(-.108, .0095), (-.075, .0140)], .072, 12, GRAPHITE)                                                          # bolt shroud
    lathe(body, [(.158, .0135), (.200, .0115), (.640, .0088), (.645, .0085)], .072, 12, GRAPHITE)                             # tapered barrel
    lathe(body, [(.6445, .0045), (.6455, .0045)], .072, 10, METAL)
    body.box((.0150, -.020, .070), (.0158, -.080, .084), METAL)                                                                # ejection port (right)
    prism(body, [(.030, .004), (.112, .004), (.112, .012), (.030, .012)], .0105, METAL, bev=.002)                               # floorplate
    loop(body, [(-.004, .010), (-.010, -.008), (.004, -.022), (.040, -.024), (.054, -.010), (.058, .010)], .005, .005, METAL)  # trigger guard
    # scope with turrets, rings and bases
    lathe(body, [(-.100, .0185), (-.066, .0185), (-.056, .0125), (.088, .0125), (.118, .0215), (.166, .0215)], .135, 16, GRAPHITE)
    lathe(body, [(.165, .0185), (.1665, .0185)], .135, 16, CYAN); lathe(body, [(-.1015, .015), (-.1, .015)], .135, 16, CYAN)
    lathe(body, [(-.100, .0195), (-.088, .0195)], .135, 16, GRAPHITE)                                                          # eyepiece rubber
    body.tube((0, -.015, .146), (0, -.015, .160), .0095, 12, GRAPHITE); body.tube((0, -.015, .159), (0, -.015, .162), .0078, 12, METAL)
    body.tube((.012, -.015, .135), (.026, -.015, .135), .0095, 12, GRAPHITE); body.tube((.025, -.015, .135), (.028, -.015, .135), .0078, 12, METAL)
    for f in (-.045, .070):
        lathe(body, [(f, .0145), (f + .012, .0145)], .135, 16, METAL)
        body.box((-.007, -f, .086), (.007, -(f + .012), .122), METAL)
    for f, z in ((.40, .025), (-.38, -.046)):                                                                                  # sling studs
        body.tube((0, -f, z), (0, -f, z - .012), .0035, 8, METAL); body.tube((-.009, -f, z - .014), (.009, -f, z - .014), .0035, 8, METAL)
    # bolt: the handle sweeps down on the right with a round knob
    bolt.tube(fz(-.032, .072, .012), fz(-.040, .052, .036), .0045, 8, METAL)
    bolt.ico(fz(-.041, .049, .040), (.009, .009, .009), METAL)
    lathe(bolt, [(-.075, .0098), (-.068, .0098)], .072, 12, METAL)
    prism(trg, [(.014, .010), (.024, .010), (.028, -.006), (.023, -.016), (.015, -.017), (.019, -.002)], .0035, METAL)
    parts = {'body': (body, (0, 0, 0)), 'BOLT': (bolt, fz(-.032, .072)), 'TRIGGER': (trg, fz(.018, .010))}
    return parts, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.300, .035), 'MUZZLE': fz(.6455, .072), 'STOCK': fz(-.516, .020), 'SCOPE': fz(-.100, .135)}


# ======================================================================================================================
# First set, rebuilt (2026-11-06) at the second set's detail: chamfers, turned parts, grooves, more colours, and the
# moving parts as their own nodes (TRIGGER, BOLT, MAGAZINE, PUMP, STOCK, FOREGRIP, BIPOD), origins on their pivots.

def build_compact_smg():
    """Compact sub-machine gun that fits under a jacket (name list row 25; 194-list rows 85-92): a stamped steel
    receiver, a perforated barrel shroud, the magazine in the grip, a side-folding wire stock and a fold-down front
    grip. Moves: TRIGGER, BOLT (charging handle), MAGAZINE, STOCK (folds), FOREGRIP (folds)."""
    body, trg, bolt, mag, stock, fore = Mesh(), Mesh(), Mesh(), Mesh(), Mesh(), Mesh()
    prism(body, [(-.075, .030), (.135, .030), (.140, .036), (.140, .074), (.132, .080), (-.068, .080), (-.075, .072)], .019, GRAPHITE, bev=.004)
    grooves(body, -.070, -.040, 4, .040, .070, .019, .0012, METAL)                                                   # rear grip ribs on the receiver
    body.box((.0186, -.010, .052), (.0198, -.060, .070), METAL)                                                      # ejection port (right)
    body.box((-.0215, -(-.040), .046), (-.0188, -(-.030), .054), YELLOW)                                              # selector (left)
    body.box((-.0060, .040, .080), (.0060, -.120, .085), METAL)                                                       # top rail
    for i in range(8): body.box((-.0065, -(-.036 + i * .019), .0845), (.0065, -(-.030 + i * .019), .0868), GRAPHITE)
    for x in (-.0075, .0075): body.box((x - .0016, .066, .085), (x + .0016, .056, .098), GRAPHITE)                    # rear sight ears
    body.box((-.0020, .063, .085), (.0020, .059, .094), METAL)
    for x in (-.0070, .0070): body.box((x - .0015, -.120, .085), (x + .0015, -.130, .097), GRAPHITE)                  # front sight ears
    body.box((-.0013, -.123, .085), (.0013, -.127, .093), YELLOW)
    lathe(body, [(.138, .0125), (.196, .0125)], .056, 12, GRAPHITE)                                                   # barrel shroud
    for k in range(3):
        for a in (0, math.pi):                                                                                         # its cooling holes
            body.box((-.0015 + .0126 * math.cos(a) - .001, -(.150 + k * .015), .052), (.0015 + .0126 * math.cos(a) + .001, -(.157 + k * .015), .060), METAL)
    lathe(body, [(.194, .0078), (.212, .0078)], .056, 10, METAL)                                                      # threaded muzzle
    lathe(body, [(.2115, .0048), (.2125, .0048)], .056, 10, GRAPHITE)
    grip = [(-.032, .032), (.006, .032), (-.006, -.072), (-.044, -.069)]
    prism(body, grip, .016, GRAPHITE, bev=.004)
    for x in (.0162, -.0162): prism(body, inset(grip, .009), .0005, METAL, x=x)
    loop(body, [(-.004, .028), (-.010, .008), (.004, -.006), (.046, -.008), (.052, .004), (.054, .028)], .005, .005, GRAPHITE)
    body.box((-.006, .080, .040), (.006, .074, .062), METAL)                                                          # stock hinge block
    body.tube((-.010, .085, .046), (.010, .085, .046), .005, 8, METAL)                                                # sling loop
    prism(trg, [(.012, .030), (.022, .030), (.026, .014), (.021, .004), (.013, .003), (.017, .016)], .0035, METAL)
    bolt.box((-.0050, .020, .080), (.0050, -.010, .090), METAL); bolt.box((-.0090, .016, .088), (.0090, .006, .096), GRAPHITE)  # charging handle
    prism(mag, [(-.040, -.066), (-.006, -.070), (-.006, -.150), (-.040, -.146)], .0125, GRAPHITE, bev=.002)
    prism(mag, [(-.045, -.144), (-.002, -.148), (-.002, -.160), (-.045, -.156)], .0145, METAL, bev=.002)
    for z in (.066, .042): stock.tube(fz(-.072, z, -.025), fz(.112, z, -.025), .0042, 8, METAL)                         # folded along the right
    prism(stock, [(.104, .036), (.118, .036), (.118, .074), (.104, .074)], .006, GRAPHITE, x=-.025, bev=.0015)          # butt plate
    prism(stock, [(-.080, .040), (-.066, .040), (-.066, .070), (-.080, .070)], .004, METAL, x=-.022)                    # hinge arm
    prism(fore, [(.094, .030), (.116, .030), (.112, -.036), (.098, -.036)], .011, GRAPHITE, bev=.003)                   # front grip (down)
    for k in range(4): fore.box((-.0115, -.099, .018 - k * .013), (.0115, -.111, .014 - k * .013), METAL)
    parts = {'body': (body, (0, 0, 0)), 'TRIGGER': (trg, fz(.016, .030)), 'BOLT': (bolt, fz(.005, .085)), 'MAGAZINE': (mag, fz(-.024, -.068)),
             'STOCK': (stock, fz(-.073, .055, -.022)), 'FOREGRIP': (fore, fz(.105, .030))}
    return parts, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.105, -.012), 'MUZZLE': fz(.2125, .056)}


def pump_action(body, trg, pump, barrel_end, pump_span, mag_end):
    """The shared pump-action: receiver with loading and ejection ports, a barrel with a vented rib and beads, the
    magazine tube with its cap, the wooden fore-end on action bars, trigger and safety."""
    prism(body, [(-.110, .025), (.130, .025), (.135, .032), (.135, .082), (.128, .088), (-.095, .088), (-.110, .075)], .022, GRAPHITE, bev=.004)
    body.box((.0216, -.010, .050), (.0228, -.075, .072), METAL)                                                       # ejection port (right)
    body.box((-.014, -.020, .0245), (.014, -.105, .0262), METAL)                                                      # loading port (under)
    body.tube((-.022, -.050, .034), (-.0245, -.050, .034), .0035, 8, METAL)                                           # slide release (left)
    lathe(body, [(.128, .0145), (.140, .0145), (.144, .0125), (barrel_end, .0125)], .068, 14, GRAPHITE)              # barrel
    lathe(body, [(barrel_end - .002, .0130), (barrel_end, .0130)], .068, 14, METAL)
    lathe(body, [(barrel_end - .0005, .0090), (barrel_end + .0005, .0090)], .068, 12, GRAPHITE)
    prism(body, [(.140, .079), (barrel_end, .079), (barrel_end, .086), (.140, .086)], .0045, GRAPHITE, bev=.001)      # vented rib
    n = int((barrel_end - .16) / .03)
    for i in range(n): body.box((-.0047, -(.155 + i * .03), .0795), (.0047, -(.165 + i * .03), .0835), METAL)
    body.ico(fz(barrel_end - .012, .089), (.0028, .0028, .0028), METAL)                                                # front bead
    body.ico(fz((barrel_end + .14) / 2, .088), (.0018, .0018, .0018), METAL)                                           # mid bead
    lathe(body, [(.128, .0115), (mag_end, .0115)], .040, 12, GRAPHITE)                                                 # magazine tube
    lathe(body, [(mag_end - .004, .0128), (mag_end + .016, .0128), (mag_end + .020, .0105)], .040, 12, [METAL, GRAPHITE])  # knurled cap
    body.box((-.014, -(mag_end - .004), .036), (.014, -(mag_end + .002), .062), GRAPHITE)                              # barrel clamp
    loop(body, [(-.004, .025), (-.010, .006), (.004, -.010), (.050, -.012), (.060, .004), (.064, .025)], .005, .006, METAL)
    body.tube((-.010, -.062, .030), (.010, -.062, .030), .0036, 10, 2)                                                 # cross-bolt safety (red ring)
    prism(trg, [(.012, .025), (.023, .025), (.027, .008), (.022, -.004), (.013, -.005), (.017, .010)], .0040, METAL)
    a, b = pump_span                                                                                                   # wooden pump on its action bars
    lathe(pump, [(a, .021), (a + .010, .027), (b - .010, .027), (b, .021)], .050, 12, WOOD)
    for k in range(6):
        f = a + .016 + k * (b - a - .032) / 5
        lathe(pump, [(f, .0278), (f + .005, .0278)], .050, 12, DARKWOOD)
    for x in (-.0125, .0125): pump.box((x - .0012, -.130, .045), (x + .0012, -a, .050), METAL)


def build_shotgun():
    """Full-size pump shotgun (name list row 28; 194-list rows 131, 134-146): wooden stock with a pistol wrist,
    checkering, a recoil pad and sling studs. Moves: PUMP, TRIGGER."""
    body, trg, pump = Mesh(), Mesh(), Mesh()
    pump_action(body, trg, pump, .66, (.27, .45), .60)
    # The wrist curves down from behind the trigger into a straight belly to the toe (no hook under the grip).
    stock = [(-.100, .082), (-.100, .026), (-.030, .020), (-.045, -.012), (-.080, -.030), (-.160, -.032),
             (-.430, -.052), (-.440, -.052), (-.440, .080), (-.420, .082), (-.120, .086)]
    prism(body, stock, .021, WOOD, bev=.007)
    for x in (.0213, -.0213): prism(body, [(-.040, .012), (-.052, -.012), (-.080, -.022), (-.110, .000), (-.100, .040)], .0005, DARKWOOD, x=x)
    prism(body, [(-.460, -.056), (-.438, -.054), (-.438, .082), (-.460, .084)], .022, GRAPHITE, bev=.006)              # recoil pad
    prism(body, [(-.4395, -.054), (-.4365, -.054), (-.4365, .081), (-.4395, .081)], .0215, PAPER)
    body.tube((0, .36, -.030), (0, .36, -.042), .0035, 8, METAL); body.tube((-.009, .36, -.044), (.009, .36, -.044), .0035, 8, METAL)
    parts = {'body': (body, (0, 0, 0)), 'PUMP': (pump, fz(.36, .050)), 'TRIGGER': (trg, fz(.016, .025))}
    return parts, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.36, .035), 'MUZZLE': fz(.66, .068), 'STOCK': fz(-.46, .028)}


def build_shotgun_short():
    """Short pump shotgun (name list row 29; 194-list rows 132-133, 147-152): the same action with a short barrel, a
    rubber-wrapped pistol grip with a cap and a sling loop instead of a stock. Moves: PUMP, TRIGGER."""
    body, trg, pump = Mesh(), Mesh(), Mesh()
    pump_action(body, trg, pump, .36, (.17, .30), .30)
    grip = [(-.040, .030), (.008, .030), (-.012, -.082), (-.058, -.078)]
    prism(body, grip, .0175, WOOD, bev=.005)
    for x in (.0177, -.0177): prism(body, inset(grip, .010), .0005, DARKWOOD, x=x)
    prism(body, [(-.062, -.076), (-.010, -.081), (-.012, -.090), (-.064, -.085)], .0175, GRAPHITE, bev=.003)          # grip cap
    prism(body, [(-.128, .040), (-.106, .040), (-.106, .078), (-.128, .078)], .016, GRAPHITE, bev=.004)                # rear plug
    body.tube((-.010, .118, .060), (.010, .118, .060), .0055, 10, METAL)                                               # sling loop
    parts = {'body': (body, (0, 0, 0)), 'PUMP': (pump, fz(.235, .050)), 'TRIGGER': (trg, fz(.016, .025))}
    return parts, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.235, .035), 'MUZZLE': fz(.36, .068)}


def build_sniper_rifle():
    """Bolt-action sniper rifle (name list row 30; 194-list rows 154-160, 162-188): a tactical stock with an adjustable
    cheek riser, a rubber pistol grip and slotted fore-end, a fluted heavy barrel with a muzzle brake, a long scope
    with turrets, a detachable magazine and a folding bipod. Moves: BOLT, MAGAZINE, BIPOD, TRIGGER."""
    body, bolt, mag, bipod, trg = Mesh(), Mesh(), Mesh(), Mesh(), Mesh()
    stock = [(.52, .032), (.52, .064), (.18, .066), (-.080, .066), (-.100, .074), (-.480, .074), (-.495, .070),
             (-.495, -.040), (-.470, -.046), (-.300, -.030), (-.180, .010), (-.080, .010), (.10, .018)]
    prism(body, stock, .023, SAGE, bev=.007)
    for i in range(5): body.box((.0232, -(.22 + i * .055), .040), (.0242, -(.25 + i * .055), .054), GRAPHITE)       # fore-end slots (right)
    for i in range(5): body.box((-.0242, -(.22 + i * .055), .040), (-.0232, -(.25 + i * .055), .054), GRAPHITE)
    prism(body, [(-.440, .074), (-.200, .074), (-.200, .098), (-.215, .104), (-.425, .104), (-.440, .098)], .020, SAGE, bev=.005)  # cheek riser
    for f in (-.250, -.400): lathe(body, [(f - .004, .004), (f + .004, .004)], .078, 8, METAL)                                    # its posts
    for f in (-.250, -.400): body.tube((0, -f, .072), (0, -f, .080), .004, 8, METAL)
    prism(body, [(-.520, -.048), (-.493, -.046), (-.493, .076), (-.520, .078)], .024, GRAPHITE, bev=.006)              # butt pad
    body.tube((0, .40, -.032), (0, .40, -.070), .005, 8, METAL); body.ico(fz(-.40, -.072), (.007, .007, .007), GRAPHITE)  # monopod
    grip = [(-.040, .012), (.004, .012), (-.012, -.088), (-.058, -.084)]
    prism(body, grip, .0165, GRAPHITE, bev=.005)                                                                       # rubber pistol grip
    for k in range(4): body.box((-.0168, -(-.018 - k * .010), -.020 - k * .016), (.0168, -(-.012 - k * .010), -.024 - k * .016), METAL)
    lathe(body, [(-.100, .0165), (.170, .0165)], .072, 14, GRAPHITE)                                                    # receiver
    body.box((-.0075, .095, .086), (.0075, -.175, .093), METAL)                                                        # top rail
    for i in range(12): body.box((-.008, -(-.090 + i * .022), .0925), (.008, -(-.083 + i * .022), .0950), GRAPHITE)
    lathe(body, [(.168, .0150), (.200, .0135), (.760, .0130)], .072, 12, [GRAPHITE, GRAPHITE, METAL])                 # fluted heavy barrel
    lathe(body, [(.755, .0170), (.845, .0170)], .072, 12, GRAPHITE)                                                    # muzzle brake
    for f in (.775, .800, .825): body.box((-.0185, -f, .066), (.0185, -(f + .010), .078), METAL)
    lathe(body, [(.8445, .0060), (.8455, .0060)], .072, 10, METAL)
    loop(body, [(-.004, .012), (-.010, -.006), (.004, -.020), (.044, -.022), (.056, -.008), (.060, .012)], .005, .006, GRAPHITE)
    body.tube((.0165, -.000, .058), (.0200, -.000, .058), .0030, 8, 2)                                                 # safety (right)
    # scope: long tube, big objective, turrets, side focus, rings with clamp bolts
    lathe(body, [(-.110, .0210), (-.070, .0210), (-.058, .0150), (.120, .0150), (.155, .0260), (.215, .0260)], .140, 16, GRAPHITE)
    lathe(body, [(.214, .0225), (.2155, .0225)], .140, 16, CYAN); lathe(body, [(-.1115, .017), (-.110, .017)], .140, 16, CYAN)
    lathe(body, [(-.110, .0225), (-.094, .0225)], .140, 16, GRAPHITE)
    body.tube((0, -.025, .154), (0, -.025, .172), .0115, 14, GRAPHITE); body.tube((0, -.025, .171), (0, -.025, .175), .0090, 14, YELLOW)  # elevation
    body.tube((.014, -.025, .140), (.032, -.025, .140), .0105, 14, GRAPHITE)                                                            # windage
    body.tube((-.014, -.025, .140), (-.030, -.025, .140), .0125, 14, GRAPHITE)                                                          # side focus
    for f in (-.045, .085):
        lathe(body, [(f, .0175), (f + .014, .0175)], .140, 16, METAL)
        body.box((-.0075, -f, .093), (.0075, -(f + .014), .124), METAL)
        body.tube((.0170, -(f + .007), .147), (.0215, -(f + .007), .147), .0025, 6, GRAPHITE)
    # bolt with a big knob
    bolt.tube(fz(-.040, .072, .014), fz(-.052, .062, .046), .0050, 8, METAL)
    bolt.ico(fz(-.054, .061, .050), (.0115, .0115, .0115), GRAPHITE)
    lathe(bolt, [(-.112, .011), (-.098, .012)], .072, 12, METAL)
    prism(mag, [(.070, .012), (.128, .012), (.124, -.042), (.074, -.042)], .015, GRAPHITE, bev=.002)
    prism(mag, [(.066, -.040), (.132, -.040), (.132, -.050), (.066, -.050)], .0165, METAL, bev=.002)
    for x in (-.013, .013):                                                                                             # bipod, folded forward
        bipod.tube(fz(.44, .028, x * .6), fz(.70, .026, x), .0050, 8, METAL)
        bipod.tube(fz(.70, .026, x), fz(.74, .024, x), .0040, 8, GRAPHITE)
        bipod.ico(fz(.745, .024, x), (.007, .007, .007), GRAPHITE)
    bipod.box((-.016, -.425, .022), (.016, -.455, .032), GRAPHITE)
    prism(trg, [(.012, .012), (.022, .012), (.026, -.004), (.021, -.014), (.013, -.015), (.017, .000)], .0035, METAL)
    parts = {'body': (body, (0, 0, 0)), 'BOLT': (bolt, fz(-.040, .072)), 'MAGAZINE': (mag, fz(.099, .012)),
             'BIPOD': (bipod, fz(.44, .028)), 'TRIGGER': (trg, fz(.016, .012))}
    return parts, {'GRIP_R': (0, 0, 0), 'GRIP_L': fz(.36, .030), 'MUZZLE': fz(.8455, .072), 'STOCK': fz(-.52, .020), 'SCOPE': fz(-.110, .140)}


# id: (CSV row, builder, label, what it covers)
GUNS = {
    'compact_smg': (25, build_compact_smg, '小型サブマシンガン（収納対応）'),
    'shotgun': (28, build_shotgun, 'ショットガン（通常サイズ）'),
    'shotgun_short': (29, build_shotgun_short, 'ショットガン（短縮型）'),
    'sniper_rifle': (30, build_sniper_rifle, 'スナイパーライフル'),
    # second set: rows of the 194-item list (HITMAN_WoA_武器モデル_194項目) whose category had no model
    'revolver': ('194:23,66,67,84', build_revolver, '高威力型拳銃（リボルバー）'),
    'tranq_pistol': ('194:30,59,60,79', build_tranq_pistol, '鎮静ダーツ銃'),
    'machine_pistol': ('194:49-51,83', build_machine_pistol, 'フルオート式拳銃'),
    'hunting_rifle': ('194:153,161', build_hunting_rifle, '狩猟用ライフル'),
}


def make(gid):
    row, fn, label = GUNS[gid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    built, anchors = fn()
    # One mesh, or several parts: {'body': (mesh, pivot), 'HAMMER': (mesh, pivot), ...}; each moving part is its own
    # node with its origin on the pivot (Blender space), so turning or sliding it moves it the right way.
    parts = built if isinstance(built, dict) else {'body': (built, (0, 0, 0))}
    root = bpy.data.objects.new(gid, None); bpy.context.collection.objects.link(root)
    mat = base.palette_material()
    for name, (mesh, pivot) in parts.items():
        ob = mesh.build(gid + '_mesh' if name == 'body' else name, mat, shift=pivot); ob.parent = root; ob.location = pivot
    for name, p in anchors.items(): empty(name, p, root)
    folder = OUT / 'models' / gid; folder.mkdir(parents=True, exist_ok=True)
    glb = folder / (gid + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_yup=True, export_apply=True)
    (OUT / 'blends').mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'blends' / (gid + '.blend')))
    j, tris, size = glb_info(glb)
    to_gl = lambda p: [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]
    allv = [v for mesh, _ in parts.values() for v in mesh.v]
    xs = [v[0] for v in allv]; ys = [v[1] for v in allv]; zs = [v[2] for v in allv]
    return {'id': gid, 'csvRow': row, 'label': label, 'triangles': tris, 'bytes': size,
            'size_m': [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)],
            'anchors': {k: to_gl(v) for k, v in anchors.items()},
            'moving': {k: to_gl(p) for k, (_, p) in parts.items() if k != 'body'}}


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    info = [make(g) for g in (args or list(GUNS))]
    path = OUT / 'build-info.json'
    old = {e['id']: e for e in json.loads(path.read_text(encoding='utf-8'))} if path.exists() and args else {}
    old.update({e['id']: e for e in info})
    path.write_text(json.dumps([old[g] for g in GUNS if g in old], ensure_ascii=False, indent=2), encoding='utf-8')
    for e in info: print('BUILT', e['id'], e['triangles'], 'tris', e['bytes'], 'bytes', e['size_m'])

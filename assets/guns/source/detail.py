# Finer modelling helpers for the second set of guns (2026-11-05): chamfered extrusions, turned (lathe) parts with
# per-face colours, and grooves. Built on the M5.5 Mesh (flat faces, palette colours per face).
# Gun space as everywhere: forward f, up z, right x  ->  Blender (x, -f, z); glTF +Z is forward.
import math
from build_m55_assets import fz


def _area(p):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(p, p[1:] + p[:1])) / 2


def inset(profile, d):
    """The (forward, up) polygon moved inward by d (mitred corners, capped so sharp points do not shoot out)."""
    p = list(profile); n = len(p); ccw = _area(p) > 0; out = []
    for i in range(n):
        a, b, c = p[i - 1], p[i], p[(i + 1) % n]
        e1 = (b[0] - a[0], b[1] - a[1]); e2 = (c[0] - b[0], c[1] - b[1])
        l1 = math.hypot(*e1) or 1; l2 = math.hypot(*e2) or 1
        # left normals point inside for a counter-clockwise polygon
        n1 = (-e1[1] / l1, e1[0] / l1); n2 = (-e2[1] / l2, e2[0] / l2)
        if not ccw: n1 = (-n1[0], -n1[1]); n2 = (-n2[0], -n2[1])
        m = (n1[0] + n2[0], n1[1] + n2[1]); dot = 1 + n1[0] * n2[0] + n1[1] * n2[1]
        k = d / max(dot, .35)
        out.append((b[0] + m[0] * k, b[1] + m[1] * k))
    return out


def prism(m, profile, half, c, x=0.0, bev=0.0):
    """A side profile (forward, up) extruded across x±half; bev chamfers both side edges."""
    ring = lambda xx, pr: [(xx, -f, z) for f, z in pr]
    if bev <= 0:
        m.solid([ring(x - half, profile), ring(x + half, profile)], c); return
    inner = inset(profile, bev)
    m.solid([ring(x - half, inner), ring(x - half + bev, profile), ring(x + half - bev, profile), ring(x + half, inner)], c)


def lathe(m, prof, z, n, colors, x=0.0, phase=0.0, caps=True):
    """A part turned about the forward axis at height z: prof is [(forward, radius)]; colors is one palette index or a
    list repeated round the circumference (flutes, knurling)."""
    cols = colors if isinstance(colors, list) else [colors]
    rings = [[fz(f, z + r * math.sin(phase + i * math.tau / n), x + r * math.cos(phase + i * math.tau / n)) for i in range(n)] for f, r in prof]
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            m.face([a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]], cols[i % len(cols)])
    if caps:
        m.face(rings[0][::-1], cols[0]); m.face(rings[-1], cols[0])


def grooves(m, f0, f1, count, z0, z1, half, depth, c, x=0.0):
    """Vertical grooves (slide serrations, checkering bands) as thin dark slabs standing just proud of both sides."""
    step = (f1 - f0) / count
    for i in range(count):
        a = f0 + i * step + step * .25
        for s in (-1, 1):
            xx = x + s * (half + depth / 2)
            m.box((xx - depth / 2, -a, z0), (xx + depth / 2, -(a + step * .5), z1), c)


def screw(m, f, z, side_x, r, c):
    """A screw head on one side (side_x the face it sits on)."""
    s = 1 if side_x > 0 else -1
    m.tube((side_x, -f, z), (side_x + s * .0025, -f, z), r, 8, c)

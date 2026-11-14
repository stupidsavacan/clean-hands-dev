"""Geometry regressions for the connected coat and head cloth. Run in Blender."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_characters as bc
import stage_costumes as stage


def connected_faces(mesh, color):
    faces=[f for f,c in zip(mesh.f,mesh.c) if c==color]
    vertices=set(i for f in faces for i in f);neighbors={i:set() for i in vertices}
    for face in faces:
        for i in face:neighbors[i].update(face)
    seen=set();todo=[next(iter(vertices))]
    while todo:
        i=todo.pop()
        if i not in seen:seen.add(i);todo.extend(neighbors[i]-seen)
    return seen==vertices


class CostumeTests(unittest.TestCase):
    def test_bisht_is_one_connected_surface_across_waist(self):
        m=bc.Mesh('coat');stage.bisht(m)
        self.assertTrue(connected_faces(m,0))
        self.assertLess(min(v[2] for v in m.v),.4)
        self.assertGreater(max(v[2] for v in m.v),1.45)
        for weights in m.w:self.assertAlmostEqual(sum(weights.values()),1)
    def test_ghutra_crown_and_drape_share_vertices(self):
        m=bc.Mesh('cloth');stage.ghutra(m)
        self.assertTrue(connected_faces(m,1))
    def test_sunglasses_have_lenses_frames_and_follow_head(self):
        m=bc.Mesh('glasses');stage.magnate_sunglasses(m)
        self.assertEqual(sum(c==0 for c in m.c),2)
        self.assertGreater(sum(c==3 for c in m.c),10)
        self.assertTrue(all(w=={'head':1} for w in m.w))


if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(CostumeTests))
    if not result.wasSuccessful():raise RuntimeError('Costume regression')

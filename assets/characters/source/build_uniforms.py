# Copied from character-revision/source/build_uniforms.py; see source-provenance.json.
# Import performs no file writes. Build/export orchestration lives in build_recipe.py.

import bpy, math
from functools import lru_cache
from mathutils.geometry import tessellate_polygon
from mathutils import Vector
import build_characters as bc
from build_characters import Mesh, octring, box
ROWS=[(.89,.155,.09),(1.07,.145,.095),(1.29,.20,.105),(1.425,.215,.095)]

def uniform_torso(mesh,color):
    start=len(mesh.v);bc.torso(mesh,color)
    # Give the sleeve a short shoulder cap before the freely rotating upper arm.
    # The old .24/.285 rings bent immediately into the chest at arms-down/run.
    for i in range(start,len(mesh.v)):
        x,y,z=mesh.v[i];ax=abs(x);side='L' if x>0 else 'R'
        if abs(ax-.24)<1e-7:
            mesh.v[i]=(math.copysign(.255,x),y,z)
            mesh.w[i]={f'clavicle.{side}':.85,f'upper_arm.{side}':.15}
        elif abs(ax-.285)<1e-7:
            mesh.v[i]=(math.copysign(.305,x),y,z)
            mesh.w[i]={f'clavicle.{side}':.35,f'upper_arm.{side}':.65}

def body_wd(z):
    if z<=ROWS[0][0]:return ROWS[0][1:]
    for (z0,w0,d0),(z1,w1,d1) in zip(ROWS,ROWS[1:]):
        if z<=z1:t=(z-z0)/(z1-z0);return (w0+(w1-w0)*t,d0+(d1-d0)*t)
    return ROWS[-1][1:]

def surface_y(x,z,back=False):
    # Depth of the torso octagon at (x, z): the front edge bows out 4% at the centre line, the back is flat.
    w,d=body_wd(z);ax=abs(x)
    if ax<=.75*w:y=d if back else d*(1.04-.04*ax/(.75*w))
    else:y=d*max(0,1-(ax-.75*w)/(.25*w))
    return y if back else -y

def mix_vertex(a,b,t):
    p,w=a;q,v=b
    return (tuple(p[i]+(q[i]-p[i])*t for i in range(3)),
            {k:w.get(k,0)*(1-t)+v.get(k,0)*t for k in w.keys()|v.keys()})

@lru_cache(None)
def torso_faces(female=False):
    # Use the actual torso, including raised shoulder corners and clavicle blends.
    source=Mesh('Surface');uniform_torso(source,0)
    if female:bc.female_outfit(source)
    result=[]
    for face in source.f:
        if not all(abs(source.v[i][0])<=.22 for i in face):continue
        points=[Vector(source.v[i]) for i in face]
        for tri in tessellate_polygon([points]):
            ids=[face[p if isinstance(p,int) else points.index(p)] for p in tri]
            result.append([(source.v[i],source.w[i]) for i in ids])
    return result

def clip(poly,axis,value,greater):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=(a[0][axis]-value)*(1 if greater else -1);db=(b[0][axis]-value)*(1 if greater else -1)
        if da>=-1e-9:result.append(a)
        if (da>0 and db<0) or (da<0 and db>0):result.append(mix_vertex(a,b,da/(da-db)))
    return result

def garment_inlay(mesh,regions):
    # Cut colour regions into the garment itself. There is no second skinned
    # surface to intersect at shoulders or where a pocket meets its vest.
    faces=list(zip(mesh.f,mesh.c));mesh.f=[];mesh.c=[]
    for ids,color in faces:
        poly=[(mesh.v[i],mesh.w[i]) for i in ids]
        if not all(abs(p[0])<=.22 and .89<=p[2]<=1.46 for p,w in poly):
            mesh.face(ids,color);continue
        pieces=[(poly,color)]
        for x0,x1,z0,z1,c,back in regions:
            updated=[];s=1 if back else -1
            for poly,old in pieces:
                if not all(p[1]*s>=-1e-9 for p,w in poly) or not any(p[1]*s>1e-9 for p,w in poly):
                    updated.append((poly,old));continue
                inside=poly
                for axis,value,greater in [(0,x0,True),(0,x1,False),(2,z0,True),(2,z1,False)]:
                    outside=clip(inside,axis,value,not greater)
                    if len(outside)>=3:updated.append((outside,old))
                    inside=clip(inside,axis,value,greater)
                    if len(inside)<3:break
                if len(inside)>=3:updated.append((inside,c))
            pieces=updated
        for poly,c in pieces:
            # Skip boundary-only polygons emitted by inclusive clipping.
            points=[Vector(p) for p,w in poly]
            area=sum((points[i]-points[0]).cross(points[i+1]-points[0]).length for i in range(1,len(points)-1))
            if area>1e-9:mesh.face([mesh.vert(p,w) for p,w in poly],c)

def collar(mesh,c):
    for s in [-1,1]:mesh.poly([(s*.045,-.062,1.480),(s*.068,-.095,1.444),(s*.020,-.107,1.421)],c,'chest')

def camera(mesh):
    y=surface_y(0,1.22)-.008
    box(mesh,(-.062,y-.055,1.180),(.062,y,1.262),0,'chest');box(mesh,(-.026,y-.095,1.196),(.026,y-.055,1.246),15,'chest')
    for s in [-1,1]:mesh.poly([(s*.055,y-.02,1.262),(s*.048,y-.02,1.262),(s*.070,-.075,1.462),(s*.078,-.075,1.462)],0,'chest')

def palette(over=None):
    # The shared 4x4 palette; `over` swaps cells for one character (a target's own colours), packed into its GLB only.
    colors=[(over or {}).get(i,c) for i,c in enumerate(bc.COLORS)]
    im=bpy.data.images.new('CLEAN_HANDS_Palette_256',256,256,alpha=False);px=[]
    for y in range(256):
        for x in range(256):
            h=colors[(3-y//64)*4+x//64];px.extend([int(h[i:i+2],16)/255 for i in (0,2,4)]+[1])
    im.pixels=px;im.pack()
    m=bpy.data.materials.new('Palette');m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=1
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Closest';m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    return m

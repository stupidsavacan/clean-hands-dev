# Copied current uniforms helpers; no external imports or import-time writes.
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

def panel(mesh,x0,x1,z0,z1,c,nx=3,nz=3,back=False,off=.007,female=False):
    # Clip source triangles rather than spanning torso corners with an unrelated grid.
    # nx/nz remain accepted for existing callers; topology follows the body itself.
    s=1 if back else -1
    for tri in torso_faces(female):
        if not all(p[1]*s>=-1e-9 for p,w in tri) or not any(p[1]*s>1e-9 for p,w in tri):continue
        poly=tri
        for axis,value,greater in [(0,x0,True),(0,x1,False),(2,z0,True),(2,z1,False)]:
            poly=clip(poly,axis,value,greater)
            if len(poly)<3:break
        if len(poly)<3:continue
        area=sum(a[0][0]*b[0][2]-b[0][0]*a[0][2] for a,b in zip(poly,poly[1:]+poly[:1]))
        if abs(area)<1e-10:continue
        mesh.face([mesh.vert((p[0],p[1]+s*off,p[2]),w) for p,w in poly],c)

def wz(z):
    rows=[(.89,{'pelvis':1}),(1.07,{'spine':.8,'pelvis':.2}),(1.29,{'chest':1})]
    for (a,w),(b,v) in zip(rows,rows[1:]):
        if z<=b:return mix_vertex(((0,0,0),w),((0,0,0),v),max(0,(z-a)/(b-a)))[1]
    return {'chest':1}

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

def apron(mesh,top,bottom,c,half=.15,flare=.03,lean=.01):
    # Two fabric leaves with a narrow walking slit. Each follows its own leg;
    # shared opposite-thigh weights cancelled the stride and let the legs pierce it.
    levels=sorted({top,bottom,*[z for z in (.98,.89,.88,.74,.56,.50,.32) if bottom<z<top]},reverse=True)
    for side,sgn in [('L',1),('R',-1)]:
        rows=[]
        for z in levels:
            t=(top-z)/(top-bottom);h=half+flare*t
            if z>=.98:w=wz(z)
            elif z>=.88:
                thigh=(.98-z)/.10*.7;w={'pelvis':1-thigh,f'thigh.{side}':thigh}
            elif z>=.74:
                pelvis=(z-.74)/.14*.3;w={'pelvis':pelvis,f'thigh.{side}':1-pelvis}
            else:
                shin=0 if z>=.56 else (.15+(.56-z)/.06*.65 if z>=.50 else .8+min(1,(.50-z)/.18)*.2)
                w={f'thigh.{side}':1-shin,f'shin.{side}':shin}
            y=surface_y(0,z)-.016 if z>=.89 else -.112-lean*t
            gap=.004*min(1,max(0,(.89-z)/.15))
            rows.append([mesh.vert((sgn*x,y+(.008 if x>h*.7 else 0),z),w) for x in (gap,h*.55,h)])
        for a,b in zip(rows,rows[1:]):
            for i in range(2):mesh.face((a[i],a[i+1],b[i+1],b[i]),c)

def dot(mesh,x,z,c,r=.008,back=False):
    s=1 if back else -1;ids=[]
    for px,pz in [(x-r,z),(x,z-r),(x+r,z),(x,z+r)]:
        for tri in torso_faces():
            if not all(p[1]*s>=-1e-9 for p,w in tri):continue
            a,b,d=[v[0] for v in tri]
            den=(b[2]-d[2])*(a[0]-d[0])+(d[0]-b[0])*(a[2]-d[2])
            if abs(den)<1e-10:continue
            u=((b[2]-d[2])*(px-d[0])+(d[0]-b[0])*(pz-d[2]))/den
            v=((d[2]-a[2])*(px-d[0])+(a[0]-d[0])*(pz-d[2]))/den
            factors=(u,v,1-u-v)
            if min(factors)<-1e-6:continue
            y=sum(t*p[1] for t,(p,w) in zip(factors,tri));weights={}
            for t,(p,w) in zip(factors,tri):
                for k,value in w.items():weights[k]=weights.get(k,0)+max(0,t)*value
            total=sum(weights.values());weights={k:v/total for k,v in weights.items()}
            ids.append(mesh.vert((px,y+s*.009,pz),weights));break
        else:raise ValueError(('Decoration outside torso',px,pz))
    mesh.face(ids,c)

def tie(mesh,c):
    mesh.poly([(-.012,-.117,1.447),(.012,-.117,1.447),(.009,-.119,1.428),(-.009,-.119,1.428)],c,'chest')
    mesh.poly([(-.009,-.119,1.428),(.009,-.119,1.428),(.016,-.121,1.355),(0,-.123,1.333),(-.016,-.121,1.355)],c,'chest')

def bow(mesh,c):
    mesh.poly([(-.038,-.113,1.449),(-.038,-.116,1.422),(0,-.118,1.435)],c,'chest');mesh.poly([(.038,-.113,1.449),(.038,-.116,1.422),(0,-.118,1.435)],c,'chest')

def collar(mesh,c):
    for s in [-1,1]:mesh.poly([(s*.045,-.062,1.480),(s*.068,-.095,1.444),(s*.020,-.107,1.421)],c,'chest')

def short_sleeves(mesh,skin,cut=.474):
    # Arms bare past x=cut: .474 leaves a sleeve to just above the elbow, .28 a vest's shoulder.
    for k,ids in enumerate(mesh.f):
        if min(abs(mesh.v[i][0]) for i in ids)>=cut:mesh.c[k]=skin

def boots(mesh,c):
    for s,sgn in [('L',1),('R',-1)]:
        mesh.rings([octring(.056,.057,.015,cx=sgn*.095),octring(.054,.055,.36,cx=sgn*.095)],c,[{f'shin.{s}':1},{f'shin.{s}':.92,f'thigh.{s}':.08}])
        mesh.rings([[(sgn*.095-.058,-.172,.002),(sgn*.095+.058,-.172,.002),(sgn*.095+.058,.064,.002),(sgn*.095-.058,.064,.002)],[(sgn*.095-.053,-.150,.078),(sgn*.095+.053,-.150,.078),(sgn*.095+.053,.055,.11),(sgn*.095-.053,.055,.11)]],c,[f'foot.{s}']*2)

def shorts(mesh,c):
    for s,sgn in [('L',1),('R',-1)]:
        # The top ring tucks under the vest hem; the legs' hip rings are wider than the torso there, so cover them from 1.0 m.
        mesh.rings([octring(.060,.088,1.0,cx=sgn*.095),octring(.094,.098,.88,cx=sgn*.095),octring(.089,.088,.68,cx=sgn*.095)],c,[{'pelvis':1},{'pelvis':.3,f'thigh.{s}':.7},{f'thigh.{s}':1}],cap=False)

def sunglasses(mesh):
    for x in [-.045,.045]:mesh.poly([(x-.032,-.103,1.668),(x+.030,-.103,1.668),(x+.026,-.104,1.640),(x-.028,-.104,1.636)],0,'head')
    mesh.poly([(-.014,-.104,1.662),(.014,-.104,1.662),(.014,-.104,1.656),(-.014,-.104,1.656)],0,'head')
    for s in [-1,1]:mesh.poly([(s*.076,-.103,1.664),(s*.111,-.006,1.659),(s*.111,-.006,1.653),(s*.076,-.103,1.658)],0,'head')

def earpiece(mesh):
    box(mesh,(-.128,-.012,1.615),(-.112,.008,1.640),15,'head')
    mesh.poly([(-.118,.004,1.615),(-.112,.004,1.615),(-.088,.03,1.47),(-.094,.03,1.47)],15,{'neck':.6,'head':.4})

def peaked_cap(mesh,crown,band,brim,badge):
    mesh.rings([octring(.113,.099,1.712),octring(.115,.101,1.745)],band,['head']*2,cap=False)
    mesh.rings([octring(.115,.101,1.745),octring(.140,.128,1.800),octring(.132,.120,1.812)],crown,['head']*3)
    mesh.poly([(-.10,-.07,1.716),(-.085,-.158,1.703),(.085,-.158,1.703),(.10,-.07,1.716)],brim,'head')
    mesh.poly([(-.014,-.103,1.762),(.014,-.103,1.762),(.014,-.102,1.738),(0,-.101,1.731),(-.014,-.102,1.738)],badge,'head')

def ball_cap(mesh,c,brim):
    mesh.rings([octring(.114,.100,1.712),octring(.110,.096,1.775),octring(.070,.062,1.812)],c,['head']*3)
    mesh.poly([(-.085,-.085,1.722),(-.07,-.175,1.712),(.07,-.175,1.712),(.085,-.085,1.722)],brim,'head')

def beanie(mesh,c):
    mesh.rings([octring(.116,.101,1.700),octring(.117,.102,1.738)],c,['head']*2,cap=False)
    mesh.rings([octring(.111,.097,1.738),octring(.100,.088,1.790),octring(.060,.054,1.818)],c,['head']*3)

def toque(mesh):
    mesh.rings([octring(.112,.098,1.700),octring(.114,.100,1.790)],1,['head']*2,cap=False)
    mesh.rings([octring(.114,.100,1.790),octring(.140,.126,1.900),octring(.128,.114,1.950),octring(.070,.062,1.968)],1,['head']*4)

def camera(mesh):
    y=surface_y(0,1.22)-.008
    box(mesh,(-.062,y-.055,1.180),(.062,y,1.262),0,'chest');box(mesh,(-.026,y-.095,1.196),(.026,y-.055,1.246),15,'chest')
    for s in [-1,1]:mesh.poly([(s*.055,y-.02,1.262),(s*.048,y-.02,1.262),(s*.070,-.075,1.462),(s*.078,-.075,1.462)],0,'chest')

def epaulettes(mesh):
    for s in ['L','R']:
        sg=1 if s=='L' else -1;w={'chest':.4,f'clavicle.{s}':.6}
        box(mesh,(min(sg*.105,sg*.225),-.035,1.452),(max(sg*.105,sg*.225),.035,1.468),0,w)
        for x in [.17,.195]:box(mesh,(min(sg*x,sg*(x+.01)),-.036,1.468),(max(sg*x,sg*(x+.01)),.036,1.471),3,w)

def towel(mesh):
    # The hanging ends follow the shoulder surface instead of a rigid vertical box.
    panel(mesh,.105,.155,1.27,1.45,4,off=.012)
    panel(mesh,.105,.155,1.31,1.45,4,back=True,off=.012)
    box(mesh,(.105,-.095,1.452),(.155,.095,1.467),4,{'chest':.5,'clavicle.L':.5})

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

def bald(mesh,skin):
    mesh.rings([octring(.101,.081,1.745),octring(.088,.071,1.777),octring(.052,.042,1.795)],skin,['head']*3)

def slick(mesh,c):
    # Swept straight back: high at the forehead, down to the nape, the top sloping back.
    lower=[(x,y,[1.762,1.768,1.762,1.705,1.645,1.62,1.645,1.705][i]) for i,(x,y,z) in enumerate(octring(.108,.092,1.726))]
    mid=octring(.105,.091,1.775,cy=.012);top=octring(.062,.066,1.795,cy=.03)
    mesh.rings([lower,mid,top],c,['head']*3,cap=False);mesh.face([mesh.vert(p,'head') for p in top],c)

def spiky(mesh,c,z0=1.705):
    # Spiked crown: a band round the head and eight tips leaning out over it.
    band=mesh.rings([octring(.106,.091,z0),octring(.102,.088,z0+.06)],c,['head']*2,cap=False);top=band[-1];hub=mesh.vert((0,.01,z0+.105),'head')
    for i in range(8):
        # Tips lean back and up, shorter at the sides, so it reads as gelled hair rather than a crown.
        a,b=mesh.v[top[i]],mesh.v[top[(i+1)%8]];mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2;tip=mesh.vert((mx*.55,my*.55+.03,z0+.115+.035*max(0,-my/.09)),'head')
        mesh.face((top[i],top[(i+1)%8],tip),c);mesh.face((top[(i+1)%8],hub,tip),c);mesh.face((hub,top[i],tip),c)

def mustache(mesh,c):
    # Upturned, waxed ends (the wine merchant's own piece).
    for s in [-1,1]:
        mesh.poly([(0,-.093,1.603),(s*.032,-.089,1.601),(s*.056,-.080,1.611),(s*.066,-.073,1.632),(s*.060,-.076,1.607),(s*.030,-.088,1.589),(0,-.092,1.591)],c,'head')

def square_glasses(mesh,c=0):
    for x in [-.045,.045]:
        o=[(x-.037,1.676),(x+.037,1.676),(x+.037,1.632),(x-.037,1.632)];n=[(x-.027,1.668),(x+.027,1.668),(x+.027,1.640),(x-.027,1.640)]
        a=[mesh.vert((px,-.102,pz),'head') for px,pz in o];b=[mesh.vert((px,-.1025,pz),'head') for px,pz in n]
        for i in range(4):mesh.face((a[i],a[(i+1)%4],b[(i+1)%4],b[i]),c)
    mesh.poly([(-.010,-.103,1.663),(.010,-.103,1.663),(.010,-.103,1.669),(-.010,-.103,1.669)],c,'head')
    for s in [-1,1]:mesh.poly([(s*.082,-.101,1.669),(s*.111,-.006,1.662),(s*.111,-.006,1.655),(s*.082,-.101,1.661)],c,'head')

def earring(mesh,c,x=.116):
    mesh.face([mesh.vert((x,-.012+.011*math.cos(t),1.593+.011*math.sin(t)),'head') for t in [i*math.pi/4 for i in range(8)]],c)

def big_build(mesh):
    # 大柄: the torso garment widens and the belly comes forward; arms and legs keep the shared rig.
    for i,(x,y,z) in enumerate(mesh.v):
        if .86<z<1.5 and abs(x)<=.225:
            belly=1+.30*max(0,1-abs(z-1.08)/.22) if y<0 else 1
            mesh.v[i]=(x*1.11,y*1.12*belly,z)

def tee_front(mesh,c,female=False):
    # Cut the shirt opening into the already shaped jacket surface.
    half=.066 if female else .078
    garment_inlay(mesh,[(-half,half,.93,1.445,c,False)])

def recolor_feet(mesh,c):
    for k,ids in enumerate(mesh.f):
        if all(any(n.startswith('foot') for n in mesh.w[i]) for i in ids):mesh.c[k]=c

def helmet(mesh,c,strap):
    # Close-fitting shell: raised forehead/ear cuts, lower coverage at the nape.
    rim=[(x,y,[1.704,1.704,1.704,1.674,1.655,1.652,1.655,1.674][i]) for i,(x,y,z) in enumerate(octring(.118,.105,1.7))]
    mesh.rings([rim,octring(.118,.104,1.755),octring(.093,.083,1.803),octring(.045,.043,1.819)],c,['head']*4)
    for s in [-1,1]:mesh.poly([(s*.113,-.026,1.682),(s*.117,-.014,1.679),(s*.070,-.065,1.550),(s*.063,-.071,1.553)],strap,'head')

def carrier(mesh):
    # The carrier base is an inlay in the coat; two broad, shallow pouches
    # read as equipment without four dangling rods or floating shoulder boxes.
    for x in [-.057,.057]:
        panel(mesh,x-.044,x+.044,1.105,1.225,9,off=.018)
        panel(mesh,x-.044,x+.044,1.203,1.228,10,off=.021)

def response_torso(mesh,c):
    # Dedicated combat jacket: broader chest, substantial sleeves, short waist.
    rows=[]
    for j,(z,w,d) in enumerate([(.91,.165,.104),(1.07,.160,.106),(1.29,.219,.119),(1.425,.230,.106)]):
        ids=[]
        for i,(x,y,pz) in enumerate(octring(w,d,z)):
            if j==3 and i in (0,2,3,4,6,7):pz+=.026
            weights={'pelvis':1} if j==0 else ({'spine':.8,'pelvis':.2} if j==1 else {'chest':1})
            if j>=2 and i in (0,2,3,4,6,7):
                side='L' if x>0 else 'R';a=.3 if j==2 else .65;weights={'chest':1-a,f'clavicle.{side}':a}
            ids.append(mesh.vert((x,y,pz),weights))
        rows.append(ids)
    for j in range(3):
        for i in range(8):
            if j==2 and i in (2,3,6,7):continue
            mesh.face((rows[j][i],rows[j][(i+1)%8],rows[j+1][(i+1)%8],rows[j+1][i]),c)
    mesh.face(rows[0][::-1],c)
    neck=[mesh.vert(p,{'chest':.75,'neck':.25}) for p in octring(.049,.047,1.482)]
    for i in range(8):mesh.face((rows[-1][i],rows[-1][(i+1)%8],neck[(i+1)%8],neck[i]),c)
    for side,sgn,indices in [('L',1,[2,3,4]),('R',-1,[0,7,6])]:
        prev=[rows[2][i] for i in indices]+[rows[3][i] for i in indices[::-1]]
        cross=[(-.090,-.065),(0,-.084),(.090,-.065),(.090,.060),(0,.079),(-.090,.060)]
        for x,scale,clav,fore in [(.255,1,.65,0),(.305,.96,.20,0),(.40,.9,0,0),(.475,.83,0,.2),(.515,.80,0,.8),(.63,.69,0,1),(.735,.55,0,1)]:
            w={f'clavicle.{side}':clav,f'upper_arm.{side}':(1-clav)*(1-fore),f'forearm.{side}':(1-clav)*fore}
            section=[(-.114,-.085),(0,-.095),(.114,-.085),(.106,.060),(0,.079),(-.106,.060)] if x==.255 else cross
            cur=[mesh.vert((sgn*x,y*scale,1.385+z*scale),w) for y,z in section]
            for i in range(6):mesh.face((prev[i],prev[(i+1)%6],cur[(i+1)%6],cur[i]),15 if x==.735 else c)
            prev=cur
        mesh.face(prev,15)

def response_legs(mesh,c):
    for side,sgn in [('L',1),('R',-1)]:
        rings=[];weights=[]
        for z,w,d,shin in [(.98,.061,.084,0),(.88,.089,.092,0),(.74,.086,.086,0),(.56,.071,.071,.15),(.50,.068,.068,.8),(.32,.058,.059,1),(.10,.050,.051,1)]:
            rings.append(octring(w,d,z,cx=sgn*.095))
            weights.append({'pelvis':1} if z==.98 else ({'pelvis':.3,f'thigh.{side}':.7} if z==.88 else {f'thigh.{side}':1-shin,f'shin.{side}':shin}))
        mesh.rings(rings,c,weights)
        # Cargo pocket on the outer-front thigh, following that leg exclusively.
        x=sgn*.141
        box(mesh,(x-.032,-.080,.65),(x+.032,-.102,.78),15,f'thigh.{side}')
        # Ankle boot with a short shaft and a broad, grounded toe.
        mesh.rings([octring(.054,.056,.105,cx=sgn*.095),octring(.061,.063,.29,cx=sgn*.095)],15,[f'shin.{side}']*2)
        mesh.rings([[(sgn*.095-.057,-.169,0),(sgn*.095+.057,-.169,0),(sgn*.095+.057,.061,0),(sgn*.095-.057,.061,0)],[(sgn*.095-.052,-.151,.075),(sgn*.095+.052,-.151,.075),(sgn*.095+.052,.054,.113),(sgn*.095-.052,.054,.113)]],15,[f'foot.{side}']*2)

@lru_cache(None)
def response_surface():
    m=Mesh('Response surface');response_torso(m,0)
    triangles=[]
    for ids in m.f:
        if not all(abs(m.v[i][0])<=.23 for i in ids):continue
        points=[Vector(m.v[i]) for i in ids]
        for tri in tessellate_polygon([points]):
            indices=[ids[p if isinstance(p,int) else points.index(p)] for p in tri]
            triangles.append([(m.v[i],m.w[i]) for i in indices])
    return triangles

def response_point(x,z,back=False,offset=.018):
    sign=1 if back else -1
    for tri in response_surface():
        if not all(p[1]*sign>=-1e-8 for p,w in tri):continue
        a,b,c=[v[0] for v in tri]
        den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
        if abs(den)<1e-10:continue
        u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den
        v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
        ts=(u,v,1-u-v)
        if min(ts)<-1e-6:continue
        weights={}
        for t,(p,w) in zip(ts,tri):
            for k,value in w.items():weights[k]=weights.get(k,0)+max(0,t)*value
        total=sum(weights.values());weights={k:v/total for k,v in weights.items() if v>1e-8}
        return ((x,sum(t*p[1] for t,(p,w) in zip(ts,tri))+sign*offset,z),weights)
    raise ValueError(('Response fitting outside torso',x,z,back))

def response_plate(mesh,levels,c,back=False,offset=.020,thickness=.008):
    front=[];rear=[]
    for z,half in levels:
        front.append([mesh.vert(*response_point(x,z,back,offset)) for x in (-half,0,half)])
        rear.append([mesh.vert(*response_point(x,z,back,offset-thickness)) for x in (-half,0,half)])
    for j in range(len(levels)-1):
        for i in range(2):
            mesh.face((front[j][i],front[j][i+1],front[j+1][i+1],front[j+1][i]),c)
            mesh.face((rear[j][i],rear[j+1][i],rear[j+1][i+1],rear[j][i+1]),c)
        for i in [0,2]:mesh.face((front[j][i],rear[j][i],rear[j+1][i],front[j+1][i]),c)
    for j in [0,len(levels)-1]:
        for i in range(2):mesh.face((front[j][i],front[j][i+1],rear[j][i+1],rear[j][i]),c)

def response_carrier(mesh):
    # Beveled silhouette and real closed thickness, fitted to the dedicated jacket.
    response_plate(mesh,[(1.105,.118),(1.29,.137),(1.385,.094)],10)
    response_plate(mesh,[(1.12,.115),(1.29,.13),(1.385,.094)],10,True,offset=.014,thickness=.006)
    for sign in [-1,1]:
        x=sign*.103
        # Fitted front/back strap ends and the shoulder bridge.
        for back in [False,True]:
            pts=[response_point(px,pz,back,.015) for px,pz in [(x-.018,1.355),(x+.018,1.355),(x+.018,1.448),(x-.018,1.448)]]
            mesh.face([mesh.vert(p,w) for p,w in pts],10)
        side='L' if sign>0 else 'R'
        box(mesh,(x-.018,-.085,1.450),(x+.018,.085,1.466),10,{'chest':.5,f'clavicle.{side}':.5})
        # Two substantial pouches, fitted independently at each corner.
        corners=[(x*.52-.041,1.135),(x*.52+.041,1.135),(x*.52+.041,1.248),(x*.52-.041,1.248)]
        a=[mesh.vert(*response_point(px,pz,False,.024)) for px,pz in corners]
        b=[mesh.vert(*response_point(px,pz,False,.055)) for px,pz in corners]
        mesh.face(a[::-1],9);mesh.face(b,9)
        for i in range(4):mesh.face((a[i],a[(i+1)%4],b[(i+1)%4],b[i]),10 if i==2 else 9)

def fitted_box(mesh,corners,near,far,c,back=False):
    # A block standing off the response jacket: each corner is fitted to the surface (and its weights) at two depths.
    a=[mesh.vert(*response_point(px,pz,back,near)) for px,pz in corners];b=[mesh.vert(*response_point(px,pz,back,far)) for px,pz in corners]
    mesh.face(a[::-1],c);mesh.face(b,c)
    for i in range(4):mesh.face((a[i],a[(i+1)%4],b[(i+1)%4],b[i]),c)

def response_kit(mesh):
    """The details that make the response team read as special forces from the overhead camera and up close:
    a high-cut helmet with NVG mount, side rails and ear defenders, a face mask and smoked ballistic glasses,
    magazines in the pouches, an admin panel, a back radio with antenna, a shoulder ID patch, a drop-leg
    holster and moulded knee pads. Built on Astra's fitted jacket (response_point), not over it."""
    # Helmet hardware.
    box(mesh,(-.026,-.124,1.738),(.026,-.101,1.772),0,'head')
    box(mesh,(-.010,-.130,1.744),(.010,-.124,1.766),15,'head')
    for sg in [-1,1]:
        box(mesh,(min(sg*.111,sg*.124),-.062,1.716),(max(sg*.111,sg*.124),.052,1.734),0,'head')
        box(mesh,(min(sg*.114,sg*.150),-.040,1.598),(max(sg*.114,sg*.150),.032,1.678),0,'head')
        box(mesh,(min(sg*.146,sg*.156),-.030,1.610),(max(sg*.146,sg*.156),.022,1.666),15,'head')
    # Face mask from the neck to just under the nose; the glasses wrap over the eyes into the ear defenders.
    # The front peaks over the nose; the back rises to meet the helmet's nape so no skin shows between them.
    mid=octring(.084,.082,1.580);mid[1]=(0,-.110,1.585)
    top=octring(.108,.100,1.606)
    top[0]=(-.075,-.100,1.628);top[1]=(0,-.128,1.636);top[2]=(.075,-.100,1.628)
    for i in (3,4,5,6,7):top[i]=(top[i][0],top[i][1],1.668)
    mesh.rings([octring(.057,.055,1.468),octring(.062,.066,1.537),mid,top],0,[{'neck':1},{'head':.7,'neck':.3},{'head':1},{'head':1}],cap=False)
    mesh.poly([(-.084,-.099,1.673),(-.012,-.104,1.674),(.012,-.104,1.674),(.084,-.099,1.673),(.080,-.101,1.636),(.014,-.105,1.640),(0,-.106,1.632),(-.014,-.105,1.640),(-.080,-.101,1.636)],6,'head')
    for sg in [-1,1]:mesh.poly([(sg*.084,-.099,1.673),(sg*.115,-.030,1.664),(sg*.115,-.030,1.656),(sg*.082,-.100,1.660)],0,'head')
    # Magazines standing out of the two front pouches, an admin panel with its ID strip above them.
    for x0 in [-.0536,.0536]:
        for dx in [-.021,.021]:fitted_box(mesh,[(x0+dx-.013,1.246),(x0+dx+.013,1.246),(x0+dx+.013,1.286),(x0+dx-.013,1.286)],.030,.050,12)
    fitted_box(mesh,[(-.048,1.302),(.048,1.302),(.048,1.366),(-.048,1.366)],.021,.034,9)
    fitted_box(mesh,[(-.034,1.338),(.034,1.338),(.034,1.356),(-.034,1.356)],.034,.037,11)
    # Radio on the back, its antenna rising past the helmet.
    fitted_box(mesh,[(.060,1.170),(.112,1.170),(.112,1.300),(.060,1.300)],.016,.060,9,back=True)
    (p0,w0),(p1,w1)=response_point(.098,1.300,True,.040),response_point(.098,1.300,True,.046)
    mesh.rings([[(p0[0]-.004,p0[1]-.003,p0[2]),(p0[0]+.004,p0[1]-.003,p0[2]),(p0[0]+.004,p0[1]+.003,p0[2]),(p0[0]-.004,p0[1]+.003,p0[2])],
                [(p0[0]-.002,p0[1]+.030,1.80),(p0[0]+.002,p0[1]+.030,1.80),(p0[0]+.002,p0[1]+.034,1.80),(p0[0]-.002,p0[1]+.034,1.80)]],0,[w0,{'chest':1}])
    # ID patch on the left upper sleeve (outside of the arm once it hangs down).
    mesh.poly([(.315,-.032,1.466),(.375,-.032,1.466),(.375,.032,1.466),(.315,.032,1.466)],11,{'upper_arm.L':1})
    # Drop-leg holster on the right thigh, a pistol grip showing.
    box(mesh,(-.214,-.046,.600),(-.180,.030,.790),0,'thigh.R')
    box(mesh,(-.210,-.030,.790),(-.184,.004,.842),15,'thigh.R')
    for z in [.62,.73]:mesh.rings([octring(.090,.093,z,cx=-.095),octring(.090,.093,z+.018,cx=-.095)],0,['thigh.R']*2,cap=False)

def response_kneepads(mesh,c):
    # Moulded pads with a raised cap, weighted across the knee.
    for s,sgn in [('L',1),('R',-1)]:
        x=sgn*.095;w={f'thigh.{s}':.5,f'shin.{s}':.5}
        mesh.rings([[(x-.040,-.074,.480),(x+.040,-.074,.480),(x+.044,-.074,.585),(x-.044,-.074,.585)],[(x-.033,-.098,.492),(x+.033,-.098,.492),(x+.036,-.098,.572),(x-.036,-.098,.572)]],c,[w,w])

def kneepads(mesh,c):
    for s,sgn in [('L',1),('R',-1)]:
        x=sgn*.095
        mesh.poly([(x-.038,-.073,.55),(x-.028,-.080,.575),(x+.028,-.080,.575),(x+.038,-.073,.55),(x+.031,-.078,.485),(x-.031,-.078,.485)],c,{f'thigh.{s}':.5,f'shin.{s}':.5})

def low_toque(mesh):
    mesh.rings([octring(.112,.098,1.700),octring(.118,.104,1.795),octring(.110,.096,1.835)],1,['head']*3)

def bandana(mesh,c):
    # Tied tight over the head, the knot and its two tails on the left side so it reads from behind too.
    mesh.rings([octring(.112,.097,1.700),octring(.110,.095,1.748),octring(.094,.081,1.788),octring(.050,.044,1.806)],c,['head']*4)
    box(mesh,(.108,.010,1.695),(.132,.040,1.725),c,'head')
    for dz,dy in [(-.075,.055),(-.06,.075)]:mesh.poly([(.120,.018,1.700),(.124,.034,1.700),(.128,.025+dy*.6,1.700+dz),(.122,.014+dy*.6,1.700+dz)],c,'head')

def turtleneck(mesh,c):
    mesh.rings([octring(.057,.055,1.458),octring(.053,.051,1.536)],c,[{'chest':.5,'neck':.5},{'neck':.7,'head':.3}],cap=False)

def hood_collar(mesh,c):
    # The rain jacket's rolled hood behind the neck.
    mesh.rings([octring(.095,.082,1.440,cy=.018),octring(.080,.072,1.505,cy=.034)],c,[{'chest':1},{'chest':.5,'neck':.5}],cap=False)

def bib_apron(mesh,c):
    panel(mesh,-.10,.10,1.05,1.37,c,4,3,off=.012);apron(mesh,1.06,.30,c,half=.16,flare=.02,lean=.06)
    for sg in [-1,1]:mesh.poly([(sg*.095,-.113,1.37),(sg*.083,-.113,1.37),(sg*.043,-.064,1.472),(sg*.055,-.062,1.472)],c,'chest')

def headset(mesh,c=0):
    # Band over the head, a cup on each ear, a boom to the mouth on the left.
    pts=[(math.cos(t)*.126,math.sin(t)) for t in [i*math.pi/8 for i in range(9)]]
    for (x0,s0),(x1,s1) in zip(pts,pts[1:]):mesh.poly([(x0,-.012,1.665+.15*s0),(x1,-.012,1.665+.15*s1),(x1,.012,1.665+.15*s1),(x0,.012,1.665+.15*s0)],c,'head')
    for sg in [-1,1]:box(mesh,(min(sg*.112,sg*.142),-.035,1.605),(max(sg*.112,sg*.142),.028,1.678),c,'head')
    mesh.poly([(.128,-.036,1.625),(.128,-.036,1.615),(.040,-.102,1.580),(.040,-.102,1.590)],c,'head')

def dj_customize(meshes):
    # DJ-only tailoring: retain the cast's arm sections and all shared binds.
    m=Mesh('Outfit');uniform_torso(m,0)
    original=list(m.v);bare={}
    for k,ids in enumerate(m.f):
        if min(abs(original[i][0]) for i in ids)>=.39-1e-7:
            m.c[k]=7;face=[]
            for i in ids:
                if abs(abs(original[i][0])-.39)<1e-7:
                    if i not in bare:bare[i]=m.vert(original[i],m.w[i].copy())
                    face.append(bare[i])
                else:face.append(i)
            m.f[k]=tuple(face)
    for i,(x,y,z) in enumerate(original):
        ax=abs(x)
        if ax<=.22 and z<1.47:
            if z<1.0:x*=1.30;y*=1.30;z-=.035
            elif z<1.2:x*=1.31;y*=1.24
            else:x*=1.07;y*=1.15
        elif .25<ax<.40:
            y*=1.25;z=1.385+(z-1.385)*1.25
            if ax<.31:x+=math.copysign(.013,x);z-=.008
        m.v[i]=(x,y,z)
    # A real sleeve opening: connect loose fabric to the unchanged bare arm.
    for side in [-1,1]:
        cuff=[i for i in bare if original[i][0]*side>0]
        for a,b in zip(cuff,cuff[1:]+cuff[:1]):m.face((a,b,bare[b],bare[a]),0)
    bc.legs(m,5,7);recolor_feet(m,1);meshes['Outfit']=m
    a=meshes['Accessories'];ball_cap(a,0,0)
    # Small square print sits on the expanded chest, below the headphones.
    a.poly([(.055,-.125,1.315),(.090,-.124,1.315),(.090,-.124,1.350),(.055,-.125,1.350)],6,'chest')
    # Eight-sided oval cushions, recessed dark faces, and a narrow housing rim.
    for side in [-1,1]:
        center=Vector((side*.116,-.087,1.468))
        normal=Vector((side*.40,-.76,.51)).normalized()
        u=Vector((.885,side*.466,0)).normalized();v=normal.cross(u).normalized()
        rings=[]
        for depth,scale in [(-.019,.88),(.010,1),(.022,.82)]:
            rings.append([center+normal*depth+u*(.043*scale*math.cos(t))+v*(.064*scale*math.sin(t)) for t in [j*math.pi/4 for j in range(8)]])
        start=len(a.f);rows=a.rings(rings,0,['chest']*3,cap=False)
        for j in range(start+8,start+16):a.c[j]=15
        a.face(rows[0][::-1],0);a.face(rows[-1],0)
    # Broad padded U-band follows the back of the neck, clear of the skin.
    path=[(-.116,-.060,1.500),(-.130,.015,1.505),(-.094,.086,1.505),(0,.109,1.505),(.094,.086,1.505),(.130,.015,1.505),(.116,-.060,1.500)]
    rings=[]
    for i,p in enumerate(path):
        tangent=Vector(path[min(i+1,len(path)-1)])-Vector(path[max(0,i-1)])
        out=Vector((-tangent.y,tangent.x,0)).normalized()*.008
        p=Vector(p);up=Vector((0,0,.014))
        rings.append([p-out-up,p+out-up,p+out+up,p-out+up])
    a.rings(rings,0,['chest']*len(rings))
    # Visible nape and sideburns below the cap; no hidden hair through its crown.
    h=Mesh('Hair');lower=octring(.111,.096,1.683);upper=octring(.111,.097,1.724)
    lower=[(x,y,1.625 if j in (4,5,6) else 1.665) for j,(x,y,z) in enumerate(lower)]
    for j in range(2,8):
        k=(j+1)%8
        h.poly([lower[j],lower[k],upper[k],upper[j]],9,'head')
    meshes['Hair']=h

def dj_experiment_customize(meshes):
    # Free-design study: cropped teal flight jacket, dark tee, studio headphones.
    m=Mesh('Outfit');uniform_torso(m,4)
    garment_inlay(m,[(-.058,.058,.89,1.46,0,False)])
    for i,(x,y,z) in enumerate(m.v):
        ax=abs(x)
        if ax<=.22 and z<1.47:
            if z<1.1:x*=1.18;y*=1.22
            else:x*=1.05;y*=1.13
        elif .25<ax<.70:
            # Full sleeves taper to narrow ribbed cuffs, keeping the shared wrist.
            scale=1.25 if ax<.52 else 1.15
            y*=scale;z=1.385+(z-1.385)*scale
        m.v[i]=(x,y,z)
    for k,ids in enumerate(m.f):
        if min(abs(m.v[i][0]) for i in ids)>=.63:m.c[k]=0
    bc.legs(m,0,8);recolor_feet(m,1)
    meshes['Outfit']=m
    a=meshes['Accessories']
    # Rib-knit waist and collar, with the open front revealing the tee.
    a.rings([octring(.183,.111,.887),octring(.183,.111,.930)],0,['pelvis']*2,cap=False)
    a.rings([octring(.054,.052,1.465),octring(.053,.051,1.490)],0,[{'chest':.75,'neck':.25}]*2,cap=False)
    a.poly([(-.047,-.057,1.481),(.047,-.057,1.481),(.059,-.117,1.424),(-.059,-.117,1.424)],0,'chest')
    # Gold V-chain is a short chest detail, not a camera strap.
    for s in [-1,1]:
        a.poly([(s*.040,-.119,1.440),(s*.044,-.120,1.438),(s*.004,-.131,1.364),(0,-.133,1.362)],3,'chest')
    a.poly([(-.009,-.134,1.371),(.009,-.134,1.371),(.009,-.135,1.352),(-.009,-.135,1.352)],3,'chest')
    # The two earcups read as padded housings in profile, with a coloured inset.
    for s in [-1,1]:
        rings=[]
        for x,w,h in [(.116,.040,.059),(.140,.049,.069),(.160,.040,.060)]:
            rings.append([(s*x,-.006+w*math.cos(t),1.649+h*math.sin(t)) for t in [j*math.pi/4 for j in range(8)]])
        rows=a.rings(rings,0,['head']*3,cap=False)
        a.face(rows[0][::-1],0);a.face(rows[-1],4)
        a.poly([(s*.162,-.019,1.625),(s*.162,.007,1.625),(s*.162,.007,1.674),(s*.162,-.019,1.674)],3,'head')
    rings=[]
    for j in range(9):
        t=math.pi*j/8
        # Thick ribbon just above the swept hair, attached to both earcups.
        rings.append([(r*math.cos(t),y,1.660+r*math.sin(t)) for r,y in [(.142,-.025),(.155,-.025),(.155,.021),(.142,.021)]])
    a.rings(rings,0,['head']*9)
    # Pale stripes on the shoes and a small jacket sleeve patch.
    for s in [-1,1]:
        a.poly([(s*.095-.041,-.151,.069),(s*.095+.041,-.151,.069),(s*.095+.041,-.112,.080),(s*.095-.041,-.112,.080)],4,f'foot.{"L" if s>0 else "R"}')
    a.poly([(.315,-.105,1.363),(.352,-.099,1.363),(.352,-.099,1.398),(.315,-.105,1.398)],3,'upper_arm.L')

def dj_cast_customize(meshes):
    # Waiter's original silhouette, topology and weights, without any tailoring.
    m=Mesh('Outfit');bc.torso(m,4)
    for k,ids in enumerate(m.f):
        if min(abs(m.v[i][0]) for i in ids)>=.63:m.c[k]=0
    bc.legs(m,0,8);recolor_feet(m,1);meshes['Outfit']=m
    a=meshes['Accessories']
    # A surface-following chain leaves the common torso untouched.
    for s in [-1,1]:
        points=[(s*.040,1.446),(s*.028,1.414),(s*.014,1.380),(0,1.354)]
        for (x,z),(X,Z) in zip(points,points[1:]):
            a.poly([(x-.002,surface_y(x-.002,z)-.008,z),(x+.002,surface_y(x+.002,z)-.008,z),(X+.002,surface_y(X+.002,Z)-.008,Z),(X-.002,surface_y(X-.002,Z)-.008,Z)],3,'chest')
    a.poly([(-.008,surface_y(-.008,1.359)-.010,1.359),(.008,surface_y(.008,1.359)-.010,1.359),(.008,surface_y(.008,1.343)-.010,1.343),(-.008,surface_y(-.008,1.343)-.010,1.343)],3,'chest')
    for s in [-1,1]:
        rings=[]
        for x,w,h in [(.116,.040,.059),(.140,.049,.069),(.160,.040,.060)]:
            rings.append([(s*x,-.006+w*math.cos(t),1.649+h*math.sin(t)) for t in [j*math.pi/4 for j in range(8)]])
        rows=a.rings(rings,0,['head']*3,cap=False)
        a.face(rows[0][::-1],0);a.face(rows[-1],4)
        a.poly([(s*.162,-.019,1.625),(s*.162,.007,1.625),(s*.162,.007,1.674),(s*.162,-.019,1.674)],3,'head')
    rings=[]
    for j in range(9):
        t=math.pi*j/8
        rings.append([(r*math.cos(t),y,1.660+r*math.sin(t)) for r,y in [(.142,-.025),(.155,-.025),(.155,.021),(.142,.021)]])
    a.rings(rings,0,['head']*9)

def dress(id,m):
    if id=='chef':
        m.poly([(-.046,-.063,1.474),(.046,-.063,1.474),(0,-.108,1.418)],2,'chest')
        for x in [-.05,.05]:
            for z in [1.19,1.27,1.35]:dot(m,x,z,0,.011)
        apron(m,1.02,.55,1);toque(m)
    elif id=='cleaner':
        collar(m,1);apron(m,1.02,.70,1,half=.14,flare=.02);panel(m,.04,.11,.93,.99,11,1,1,off=.022)
    elif id=='delivery':
        ball_cap(m,0,0)
    elif id=='fisher':
        panel(m,-.006,.006,.95,1.44,1,1,4);panel(m,.05,.12,1.27,1.33,0,1,1,off=.010);boots(m,3);beanie(m,2)
    elif id=='bodyguard':
        bc.chest_details(m,0,'suit');tie(m,0);sunglasses(m);earpiece(m)
    elif id=='sommelier':
        bc.chest_details(m,0,'suit');bow(m,0);apron(m,1.02,.30,9,half=.16,flare=.02,lean=.06)
        y=surface_y(0,1.29)-.011;ring=[m.vert((.026*math.cos(t),y,1.29+.026*math.sin(t)),'chest') for t in [i*math.pi/4 for i in range(8)]];m.face(ring,3)
        m.poly([(-.003,y+.001,1.316),(.003,y+.001,1.316),(.003,-.112,1.42),(-.003,-.112,1.42)],3,'chest')
    elif id=='photographer':
        collar(m,13)
        camera(m)
    elif id=='driver':
        bc.chest_details(m,0,'suit');tie(m,0);peaked_cap(m,0,0,0,3)
    elif id=='beachbar':
        collar(m,6);apron(m,1.0,.72,0,half=.15,flare=.02)
        for x,z in [(-.12,1.30),(.08,1.36),(-.04,1.18),(.13,1.12),(-.10,1.06),(.02,1.28),(.10,1.24)]:dot(m,x,z,3,.014)
        for x,z in [(-.07,1.34),(.12,1.20),(-.13,1.18),(.05,1.10)]:dot(m,x,z,1,.011)
        for x,z in [(-.10,1.30),(.08,1.20),(-.02,1.10),(.12,1.36)]:dot(m,x,z,3,.014,back=True)
    elif id in ('pilot','pilot_sheet'):
        collar(m,12);turtleneck(m,12);panel(m,-.006,.006,.95,1.40,15,1,4);headset(m,0)
    elif id=='masseuse':
        collar(m,10);panel(m,.06,.11,1.31,1.335,3,1,1,off=.010);towel(m)
    elif id.startswith('underwear'):shorts(m,13)
    elif id=='wine_merchant':
        bc.chest_details(m,0,'suit');mustache(m,9);m.poly([(.105,-.118,1.335),(.135,-.112,1.335),(.13,-.113,1.318),(.11,-.118,1.322)],1,'chest')
    elif id=='lawyer':
        bc.chest_details(m,0,'suit');tie(m,15);square_glasses(m,0)
    elif id=='investor':
        sunglasses(m);earring(m,3)
    elif id=='response':
        response_carrier(m);response_kneepads(m,15);helmet(m,10,0);response_kit(m)
    elif id=='chef_sheet':
        for x in [-.05,.05]:
            for z in [1.19,1.27,1.35]:dot(m,x,z,0,.011)
        apron(m,1.02,.55,1);low_toque(m)
    elif id=='cleaner_sheet':
        panel(m,-.006,.006,.95,1.44,15,1,4);panel(m,.05,.12,1.27,1.33,4,1,1,off=.010);bandana(m,4)
    elif id=='delivery_sheet':
        panel(m,-.006,.006,.95,1.44,0,1,4);panel(m,.05,.12,1.27,1.33,0,1,1,off=.010);ball_cap(m,0,0)
    elif id=='fisher_sheet':
        panel(m,-.006,.006,.95,1.44,0,1,4);hood_collar(m,3);boots(m,0);beanie(m,5)
    elif id=='bodyguard_sheet':
        turtleneck(m,0);earpiece(m)
    elif id=='sommelier_sheet':
        bib_apron(m,0);y=surface_y(0,1.29)-.024;ring=[m.vert((.024*math.cos(t),y,1.27+.024*math.sin(t)),'chest') for t in [i*math.pi/4 for i in range(8)]];m.face(ring,15)
        m.poly([(-.003,y+.001,1.294),(.003,y+.001,1.294),(.003,-.112,1.42),(-.003,-.112,1.42)],15,'chest');panel(m,.11,.15,1.33,1.355,3,1,1,off=.010)

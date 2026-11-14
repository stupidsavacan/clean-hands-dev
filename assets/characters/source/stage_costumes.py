"""Stage-candidate costumes; fitted to cast.shared22.v1, no external assets."""
import math
import build_characters as bc
import build_uniforms as u


def magnate_sunglasses(m):
    """Gold double-bridge aviators, with inset dark lenses and full temples."""
    for s in [-1,1]:
        outline=[(.013,1.671),(.035,1.680),(.076,1.672),(.085,1.651),(.068,1.628),(.039,1.625),(.018,1.644)]
        outer=[(s*x,-.116,z) for x,z in outline]
        inner=[(s*(.049+(x-.049)*.84),-.118,1.653+(z-1.653)*.80) for x,z in outline]
        a=[m.vert(p,'head') for p in outer];b=[m.vert(p,'head') for p in inner]
        for i in range(len(a)):j=(i+1)%len(a);m.face((a[i],a[j],b[j],b[i]),3)
        m.face(b,0)
        m.poly([(s*.080,-.114,1.667),(s*.117,.025,1.662),(s*.117,.025,1.655),(s*.080,-.114,1.660)],3,'head')
    for z in [1.661,1.674]:bc.box(m,(-.019,-.119,z),(.019,-.114,z+.004),3,'head')


def refine_grid(points, weights, row_step, col_cuts):
    """Densify a rows x columns garment grid without changing its shape.

    Positions and skin weights are interpolated linearly on the existing
    faces, so the rest silhouette and the skinned deformation stay the same.
    Returns (points, weights, cell) where cell[r][c] is the coarse (row, column)
    a fine quad came from.
    """
    def mix(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
    def mixw(a,b,t):
        w={k:a.get(k,0)*(1-t)+b.get(k,0)*t for k in set(a)|set(b)}
        return {k:v for k,v in w.items() if v>1e-9}
    P,W,origin=[],[],[]
    for r in range(len(points)-1):
        height=max(math.dist(a,b) for a,b in zip(points[r],points[r+1]))
        for k in range(max(1,math.ceil(height/row_step))):
            t=k/max(1,math.ceil(height/row_step))
            P.append([mix(a,b,t) for a,b in zip(points[r],points[r+1])])
            W.append([mixw(a,b,t) for a,b in zip(weights[r],weights[r+1])]);origin.append(r)
    P.append(list(points[-1]));W.append(list(weights[-1]))
    FP,FW=[],[]
    for row,rw in zip(P,W):
        fp,fw=[],[]
        for c in range(len(row)-1):
            for k in range(col_cuts):
                fp.append(mix(row[c],row[c+1],k/col_cuts));fw.append(mixw(rw[c],rw[c+1],k/col_cuts))
        fp.append(row[-1]);fw.append(rw[-1]);FP.append(fp);FW.append(fw)
    cell=[[(origin[r],c//col_cuts) for c in range(len(FP[0])-1)] for r in range(len(FP)-1)]
    return FP,FW,cell


def bisht(m):
    # One continuous open-front shell: all waist and side seams share vertices.
    # Intermediate rows blend pelvis/leg weights instead of detaching the skirt.
    points,weights=[],[]
    for z,w,d in [(1.455,.225,.112),(1.30,.225,.125),(1.08,.188,.125),(.94,.210,.140),(.76,.222,.147),(.53,.255,.163),(.36,.270,.175)]:
        ring=[(.048,-d),(.75*w,-d),(w,0),(.75*w,d),(0,d*1.04),(-.75*w,d),(-w,0),(-.75*w,-d),(-.048,-d)]
        row=[]
        for x,y in ring:
            if z>=1.30:weight={'chest':1}
            elif z>=1.08:weight={'spine':.8,'pelvis':.2}
            elif z>=.94:weight={'pelvis':1}
            else:
                leg=min(.12,(.94-z)*.2);right=max(0,min(1,.5+x/.20))
                weight={'pelvis':1-leg,'thigh.L':leg*right,'thigh.R':leg*(1-right)}
            row.append(weight)
        points.append([(x,y,z) for x,y in ring]);weights.append(row)
    # Dense enough for the drape runtime: the cloth can bend around a leg.
    points,weights,cell=refine_grid(points,weights,.08,2)
    rows=[[m.vert(p,w) for p,w in zip(rp,rw)] for rp,rw in zip(points,weights)]
    for r,(a,b) in enumerate(zip(rows,rows[1:])):
        for i in range(len(a)-1):
            row,column=cell[r][i]
            if row < 2 and column in (1,2,5,6):continue # Actual arm openings, shoulder to underarm.
            m.face((a[i],a[i+1],b[i+1],b[i]),0)
    # Continuous gold front binding, attached to the same exact seam weights.
    for index,s in [(0,1),(-1,-1)]:
        for a,b in zip(rows,rows[1:]):
            ia,ib=a[index],b[index];x,y,z=m.v[ia];X,Y,Z=m.v[ib]
            m.face((m.vert((x,y-.002,z),m.w[ia]),m.vert((x+s*.010,y-.002,z),m.w[ia]),m.vert((X+s*.010,Y-.002,Z),m.w[ib]),m.vert((X,Y-.002,Z),m.w[ib])),3)
    # Shoulder yoke joins the outer shell to the neck, leaving arm openings.
    neck=[m.vert((x*.26,y*.43,1.477),{'chest':.8,'neck':.2}) for x,y,z in [m.v[i] for i in rows[0]]]
    for i in range(len(neck)-1):m.face((rows[0][i],rows[0][i+1],neck[i+1],neck[i]),0)


def ghutra(m):
    # Crown and drape share their upper ring. The front three edges stay open.
    rings=[bc.octring(.12,.108,1.72),bc.octring(.123,.111,1.79),bc.octring(.075,.070,1.825)]
    rows=m.rings(rings,1,['head']*3,cap=False);m.face(rows[-1],1)
    previous=rows[0]
    for z,w,d in [(1.61,.139,.120),(1.48,.164,.139),(1.425,.180,.148)]:
        points=bc.octring(w,d,z);current=[]
        for x,y,Z in points:current.append(m.vert((x,y,Z),{'head':1}))
        for i in range(2,7):m.face((previous[i],previous[i+1],current[i+1],current[i]),1)
        previous=current
    for z in [1.748,1.772]:m.rings([bc.octring(.128,.117,z),bc.octring(.128,.117,z+.010)],0,['head']*2,cap=False)


def badge(m, x, z):
    pts=[]
    for i in range(10):
        a=math.pi/2+i*math.pi/5;r=.025 if i%2==0 else .011
        X=x+r*math.cos(a);Z=z+r*math.sin(a)
        pts.append((X,u.surface_y(X,Z)-.014,Z))
    m.poly(pts,3,'chest')


def dress(m, role):
    if role=='us_police':
        u.collar(m,5);u.peaked_cap(m,5,0,0,3);badge(m,.085,1.335)
        for x in [-.12,.04]:u.panel(m,x,x+.075,1.23,1.28,5,off=.012)
        u.panel(m,-.12,-.05,1.31,1.325,15,off=.015)
        m.rings([bc.octring(.161,.102,.955),bc.octring(.161,.102,.992)],0,['pelvis']*2,cap=False)
        bc.box(m,(-.025,-.112,.957),(.025,-.105,.991),15,'pelvis')
        for x in [-.16,.12]:bc.box(m,(x,-.09,.91),(x+.04,-.035,1.02),0,'pelvis')
        u.epaulettes(m)
    elif role=='movie_star':
        bc.chest_details(m,0,'suit');u.sunglasses(m)
        # Silk lapels, bow tie, pocket square and gold lapel pin.
        for s in [-1,1]:
            m.poly([(s*.05,-.09,1.45),(s*.145,-.106,1.37),(s*.035,-.12,1.19)],0,'chest')
            m.poly([(0,-.12,1.397),(s*.033,-.12,1.415),(s*.033,-.12,1.38)],0,'chest')
        u.panel(m,.08,.13,1.31,1.337,1,off=.016);badge(m,-.11,1.36)
    elif role=='ferry_captain':
        u.collar(m,1);u.tie(m,0);u.peaked_cap(m,1,0,0,3);u.epaulettes(m)
        for x in [-.055,.055]:
            for z in [1.10,1.20,1.30]:u.dot(m,x,z,3,.008)
        # Four gold rank bands on each cuff, weighted to the forearm.
        for side,s in [('L',1),('R',-1)]:
            for x in [.635,.655,.675,.695]:
                rings=[[(s*X,y,1.385+z) for y,z in [(-.056,-.042),(0,-.055),(.056,-.042),(.056,.041),(0,.053),(-.056,.041)]] for X in [x,x+.009]]
                m.rings(rings,3,[f'forearm.{side}']*2,cap=False)
    elif role=='professor':
        bc.chest_details(m,9,'suit');u.tie(m,2);u.square_glasses(m,0)
        for s,side in [(1,'L'),(-1,'R')]:
            bc.box(m,(min(s*.43,s*.52),.047,1.35),(max(s*.43,s*.52),.057,1.42),9,f'forearm.{side}')
        u.panel(m,.075,.13,1.28,1.34,9,off=.013)
        for x in [.09,.103]:u.panel(m,x,x+.004,1.32,1.365,3,off=.017)
    elif role=='oil_magnate':
        # Gulf formal dress: ivory thobe, dark bisht, white ghutra and black agal.
        u.turtleneck(m,1)
        ghutra(m)


def thobe_legs(m, color, skin):
    """Split garment follows each leg independently for walking clearance."""
    bc.legs(m,color,skin)
    for side,s in [('L',1),('R',-1)]:
        m.rings([bc.octring(.089,.104,z,cx=s*.095) for z in [.91,.56,.18]],color,
                [{'pelvis':.2,f'thigh.{side}':.8},{f'thigh.{side}':.5,f'shin.{side}':.5},{f'shin.{side}':1}],cap=False)


# Registry consumed by build_recipe: each garment gets its own skinned mesh and
# a drape.v2 declaration read by app/src/garment-runtime.ts (GLB node extras).
#   colliders   meshes whose vertices size the limb capsules
#   innerBones  limbs worn under the cloth: the cloth stays outside them
#   outerBones  limbs worn over the cloth: the cloth gives way inward
#   pinAbove / freeBelow   heights (m) between which the cloth becomes free
#   slopeDown/Side/Up      how steeply a pushed point may fall back to rest
#   maxInward   how far the cloth may give way to an outer limb
#   floor       keep the hem above the ground
GARMENTS = {'stage.dress.oil_magnate.v1': ('Garment_Bisht', bisht, {
    'version': 2, 'profile': 'drape.v2',
    'colliders': ['Outfit', 'Body'],
    'innerBones': ['thigh.L','thigh.R','shin.L','shin.R','foot.L','foot.R'],
    'outerBones': ['forearm.L','forearm.R','hand.L','hand.R'],
    'clearance': .008, 'pinAbove': 1.20, 'freeBelow': 1.00,
    'slopeDown': .15, 'slopeSide': .6, 'slopeUp': .8,
    'maxInward': .03, 'floor': True,
    'runtime': 'clean-hands/garment-runtime.v2',
    'externalAnimation': 'Requires garment runtime after skeletal pose; skeletal walk alone is not cloth-safe'
})}

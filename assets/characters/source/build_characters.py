# Copied from character-revision/source/build_characters.py; see source-provenance.json.
# Import performs no file writes. Build/export orchestration lives in build_recipe.py.

import bpy, math, bmesh
from mathutils import Vector, Quaternion

COLORS=['2b2e35','efeadf','c22f21','f2c14e','17776c','3b5b8a','4fb8c9','d9b39a','9b7053','503f35','8b9c88','c8d7cf','ddd0b8','a9bcc9','f2d7c4','737a82']

def palette():
    im=bpy.data.images.new('CLEAN_HANDS_Palette_256',256,256,alpha=False)
    px=[]
    for y in range(256):
        for x in range(256):
            h=COLORS[(3-y//64)*4+x//64]; px.extend([int(h[i:i+2],16)/255 for i in (0,2,4)]+[1])
    im.pixels=px; im.pack()
    m=bpy.data.materials.new('Palette'); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=1
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Closest';m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    return m

class Mesh:
    def __init__(self,name): self.name=name;self.v=[];self.f=[];self.c=[];self.w=[];self.tags={}
    def vert(self,p,w): self.v.append(tuple(p));self.w.append(w if isinstance(w,dict) else {w:1});return len(self.v)-1
    def face(self,ids,c):self.f.append(tuple(ids));self.c.append(c)
    def poly(self,pts,c,w,tag=None):
        ids=[self.vert(p,w) for p in pts];self.face(ids,c)
        if tag:self.tags[tag]=ids
        return ids
    def rings(self,rings,c,weights,cap=True):
        rows=[[self.vert(p,weights[j]) for p in ring] for j,ring in enumerate(rings)]
        for a,b in zip(rows,rows[1:]):
            for i in range(len(a)):self.face((a[i],a[(i+1)%len(a)],b[(i+1)%len(a)],b[i]),c)
        if cap:self.face(rows[0][::-1],c);self.face(rows[-1],c)
        return rows
    def object(self,rig,mat):
        me=bpy.data.meshes.new(self.name);me.from_pydata(self.v,[],self.f);me.update(); ob=bpy.data.objects.new(self.name,me);bpy.context.collection.objects.link(ob);me.materials.append(mat)
        uv=me.uv_layers.new(name='PaletteUV')
        for p,c in zip(me.polygons,self.c):
            for li in p.loop_indices:uv.data[li].uv=((c%4+.5)/4,1-(c//4+.5)/4)
            p.use_smooth=False
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
        for name in sorted(set(k for w in self.w for k in w)):ob.vertex_groups.new(name=name)
        for i,w in enumerate(self.w):
            for name,value in w.items():
                if value:ob.vertex_groups[name].add([i],value,'REPLACE')
        ob.parent=rig;mod=ob.modifiers.new('Shared skeletal deformation','ARMATURE');mod.object=rig
        return ob

def octring(w,d,z,cx=0,cy=0):
    return [(cx+x,cy+y,z) for x,y in [(-w*.75,-d),(0,-d*1.04),(w*.75,-d),(w,0),(w*.75,d),(0,d),(-w*.75,d),(-w,0)]]

def box(mesh,lo,hi,c,w):
    x,y,z=lo;X,Y,Z=hi;mesh.rings([[(x,y,z),(X,y,z),(X,Y,z),(x,Y,z)],[(x,y,Z),(X,y,Z),(X,Y,Z),(x,Y,Z)]],c,[w,w])

def rig_create():
    ar=bpy.data.armatures.new('CLEAN_HANDS_shared_22');ob=bpy.data.objects.new('Rig',ar);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    spec=[('root',(0,0,0),(0,0,.12),None),('pelvis',(0,0,.88),(0,0,1.03),'root'),('spine',(0,0,1.03),(0,0,1.22),'pelvis'),('chest',(0,0,1.22),(0,0,1.43),'spine'),('neck',(0,0,1.43),(0,0,1.52),'chest'),('head',(0,0,1.52),(0,0,1.78),'neck')]
    for s,sgn in [('L',1),('R',-1)]:
        spec += [(f'clavicle.{s}',(sgn*.055,0,1.415),(sgn*.205,0,1.385),'chest'),(f'upper_arm.{s}',(sgn*.205,0,1.385),(sgn*.49,0,1.385),f'clavicle.{s}'),(f'forearm.{s}',(sgn*.49,0,1.385),(sgn*.735,0,1.385),f'upper_arm.{s}'),(f'hand.{s}',(sgn*.735,0,1.385),(sgn*.825,0,1.385),f'forearm.{s}'),(f'thumb.{s}',(sgn*.765,-.025,1.37),(sgn*.8,-.055,1.335),f'hand.{s}'),(f'thigh.{s}',(sgn*.095,0,.92),(sgn*.095,0,.53),'pelvis'),(f'shin.{s}',(sgn*.095,0,.53),(sgn*.095,0,.12),f'thigh.{s}'),(f'foot.{s}',(sgn*.095,0,.12),(sgn*.095,-.13,.055),f'shin.{s}')]
    for name,h,t,par in spec:
        b=ar.edit_bones.new(name);b.head=h;b.tail=t
        if par:b.parent=ar.edit_bones[par]
    bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False);return ob

def torso(mesh,color):
    rows=[]
    for j,(z,w,d) in enumerate([(.89,.155,.09),(1.07,.145,.095),(1.29,.20,.105),(1.425,.215,.095)]):
        ring=octring(w,d,z);ids=[]
        for i,p in enumerate(ring):
            x,y,z=p
            if j==3 and i in (0,2,3,4,6,7):z+=.023
            weights={'pelvis':1} if j==0 else ({'spine':.8,'pelvis':.2} if j==1 else {'chest':1})
            if j>=2 and i in (0,2,3,4,6,7):
                side='L' if x>0 else 'R';a=.30 if j==2 else .65
                weights={'chest':1-a,f'clavicle.{side}':a}
            ids.append(mesh.vert((x,y,z),weights))
        rows.append(ids)
    for j in range(3):
        for i in range(8):
            if j==2 and i in (2,3,6,7):continue
            mesh.face((rows[j][i],rows[j][(i+1)%8],rows[j+1][(i+1)%8],rows[j+1][i]),color)
    mesh.face(rows[0][::-1],color)
    neck=[mesh.vert(p,{'chest':.75,'neck':.25}) for p in octring(.047,.045,1.482)]
    for i in range(8):mesh.face((rows[-1][i],rows[-1][(i+1)%8],neck[(i+1)%8],neck[i]),color)
    for side,sgn,indices in [('L',1,[2,3,4]),('R',-1,[0,7,6])]:
        # Shared torso/sleeve boundary. No overlapping shoulder cylinder.
        prev=[rows[2][i] for i in indices]+[rows[3][i] for i in indices[::-1]]
        cross=[(-.082,-.060),(0,-.077),(.082,-.060),(.082,.055),(0,.072),(-.082,.055)]
        for x,scale,blend in [(.24,1,0),(.285,.96,0),(.39,.84,0),(.475,.78,.2),(.515,.75,.8),(.63,.64,1),(.735,.55,1)]:
            w={f'upper_arm.{side}':1-blend,f'forearm.{side}':blend}
            if x==.24:w={f'clavicle.{side}':.45,f'upper_arm.{side}':.55}
            if x==.285:w={f'clavicle.{side}':.08,f'upper_arm.{side}':.92}
            cur=[mesh.vert((sgn*x,y*scale,1.385+z*scale),w) for y,z in cross]
            for i in range(6):mesh.face((prev[i],prev[(i+1)%6],cur[(i+1)%6],cur[i]),color)
            prev=cur
        mesh.face(prev,color)

def head(mesh,skin):
    jaw=octring(.052,.055,1.537)
    jaw=[(x,y,1.511 if i==1 else (1.526 if i in (0,2) else z)) for i,(x,y,z) in enumerate(jaw)]
    mesh.rings([jaw,octring(.108,.092,1.635),octring(.101,.081,1.745)],skin,['head']*3)
    # Shallow nose with a broad bridge, short tip, and only four deliberate planes.
    a=mesh.vert((-.010,-.096,1.662),'head');b=mesh.vert((.010,-.096,1.662),'head');c=mesh.vert((.012,-.098,1.614),'head');d=mesh.vert((-.012,-.098,1.614),'head');t=mesh.vert((0,-.117,1.621),'head')
    for f in [(a,b,t),(b,c,t),(c,d,t),(d,a,t)]:mesh.face(f,skin)
    for s in [-1,1]:
        mesh.poly([(s*.108,-.010,1.652),(s*.129,-.014,1.642),(s*.122,-.012,1.601),(s*.108,-.022,1.611)],skin,'head')
        mesh.poly([(s*.108,-.010,1.652),(s*.108,.019,1.645),(s*.129,-.014,1.642)],skin,'head')
    mesh.rings([octring(.046,.044,1.465),octring(.043,.043,1.542)],skin,[{'neck':1},{'head':.7,'neck':.3}])

def face(mesh,hair):
    for side,x in [('L',.045),('R',-.045)]:
        y=-.0955;z=1.654
        mesh.poly([(x-.026,y,z),(x,y-.001,z-.013),(x+.026,y,z),(x,y-.001,z+.012)],1,'head','eye.'+side)
        mesh.poly([(x-.0065,y-.002,z),(x,y-.0025,z-.0065),(x+.0065,y-.002,z),(x,y-.0025,z+.0065)],0,'head','pupil.'+side)
        mesh.poly([(x-.026,y,1.683),(x+.026,y,1.683),(x+.026,y,1.689),(x-.026,y,1.689)],hair,'head','brow.'+side)
    mesh.poly([(-.020,-.079,1.570),(0,-.084,1.566),(.020,-.079,1.570),(0,-.084,1.573)],9,'head','mouth')

def female_head(mesh,skin):
    jaw=octring(.059,.055,1.551);jaw=[(x,y,1.535 if i==1 else (1.542 if i in (0,2) else z)) for i,(x,y,z) in enumerate(jaw)]
    mesh.rings([jaw,octring(.090,.074,1.590),octring(.102,.087,1.655),octring(.095,.080,1.742)],skin,['head']*4)
    a=mesh.vert((-.007,-.092,1.655),'head');b=mesh.vert((.007,-.092,1.655),'head');c=mesh.vert((.009,-.089,1.623),'head');d=mesh.vert((-.009,-.089,1.623),'head');t=mesh.vert((0,-.105,1.630),'head')
    for f in [(a,b,t),(b,c,t),(c,d,t),(d,a,t)]:mesh.face(f,skin)
    for s in [-1,1]:
        mesh.poly([(s*.101,-.005,1.644),(s*.119,-.008,1.637),(s*.114,-.012,1.610),(s*.102,-.017,1.616)],skin,'head')
        mesh.poly([(s*.101,-.005,1.644),(s*.101,.016,1.639),(s*.119,-.008,1.637)],skin,'head')
    mesh.rings([octring(.040,.039,1.477),octring(.040,.039,1.556)],skin,[{'neck':1},{'head':.7,'neck':.3}])

def female_face(mesh):
    mesh.female=True
    for side,s in [('L',1),('R',-1)]:
        x=s*.043;y=-.093;z=1.659
        mesh.poly([(x-.023,y,z),(x-.011,y-.0005,z+.008),(x+.010,y-.0005,z+.008),(x+.023,y,z),(x+.011,y-.0005,z-.007),(x-.011,y-.0005,z-.007)],1,'head','eye.'+side)
        mesh.poly([(x-.0055,y-.0015,z),(x,y-.0015,z-.0055),(x+.0055,y-.0015,z),(x,y-.0015,z+.0055)],9,'head','pupil.'+side)
        mesh.poly([(s*.021,-.090,1.683),(s*.042,-.089,1.687),(s*.065,-.089,1.684),(s*.062,-.089,1.686),(s*.042,-.089,1.689),(s*.021,-.090,1.685)],9,'head','brow.'+side)
    mesh.poly([(-.019,-.079,1.584),(-.008,-.080,1.584),(0,-.0805,1.583),(.008,-.080,1.584),(.019,-.079,1.584),(0,-.081,1.579)],9,'head','mouth')

def female_outfit(mesh):
    # Keep the skeleton/arm lengths; shape the garment's shoulders, waist, hips and cuffs.
    for i,(x,y,z) in enumerate(mesh.v):
        ax=abs(x)
        garment=any(n.startswith(('spine','chest','clavicle','upper_arm','forearm','neck')) for n in mesh.w[i])
        if z>=.89 and garment:
            if ax<=.22:
                if z<1.07:f=1.00-(z-.89)/.18*.23
                elif z<1.29:f=.77+(z-1.07)/.22*.08
                else:f=.85
                if z>1.475:f=.87
                x*=f;y*=.90
            else:
                if ax==.24:x=math.copysign(.232,x)
                y*=.74;z=1.385+(z-1.385)*.74
        if z<.58:
            s=1 if x>0 else -1;x=s*.095+(x-s*.095)*.78
            if z<.11:y*=.83
        mesh.v[i]=(x,y,z)

def female_hands(mesh,start):
    for i in range(start,len(mesh.v)):
        x,y,z=mesh.v[i];s=1 if x>0 else -1
        mesh.v[i]=(s*(.735+(abs(x)-.735)*.82),y*.8,1.385+(z-1.385)*.8)

def morphs(ob,mesh):
    ob.shape_key_add(name='Basis')
    female=getattr(mesh,'female',False);ez=1.641 if female else 1.654;mz=1.565 if female else 1.570
    for key in ['calm','curious','alert']:
        sk=ob.shape_key_add(name=key)
        for tag,ids in mesh.tags.items():
            for i in ids:
                co=sk.data[i].co
                if key=='calm':
                    if tag.startswith('brow'):co.z+=.001
                elif key=='curious':
                    if tag=='brow.L':co.z+=.013
                    if tag.startswith('pupil'):co.x+=.009
                    if tag=='mouth':co.x*=.4;co.z=mz+(co.z-mz)*1.5
                else:
                    if tag.startswith('brow'):
                        center=.045 if tag.endswith('L') else -.045
                        co.z+=(abs(co.x)-abs(center))*.26-.003
                    if tag.startswith('eye'):co.z=ez+(co.z-ez)*.57
                    if tag.startswith('pupil'):co.z=ez+(co.z-ez)*.72
                    if tag=='mouth':co.x*=.84;co.z=mz-.002+(co.z-mz)*(2.5 if female else 3.5);co.y-=.003
    ob.data.shape_keys.key_blocks['calm'].value=1

def hair(mesh,color,kind):
    lower=octring(.110,.095,1.726)
    if kind=='swept':
        lower=[(x,y,([1.730,1.748,1.732,1.697,1.699,1.700,1.699,1.697][i])) for i,(x,y,z) in enumerate(lower)]
        top=octring(.102,.094,1.785,cy=.005)
        top=[(x,y,min(1.8,1.8-abs(x)*.22+y*.08)) for x,y,z in top]
    elif kind=='parted':
        lower=[(x,y,1.724+(x*.12 if y<0 else -.017)) for x,y,z in lower];top=octring(.105,.097,1.790,cx=-.006)
        top=[(x,y,1.8-abs(x+.025)*.22) for x,y,z in top]
    elif kind=='bob':
        lower=[(x,y,1.714 if y<-.07 else 1.565) for x,y,z in lower];top=octring(.106,.094,1.778)
    else:top=octring(.090,.083,1.782)
    mesh.rings([lower,top],color,['head','head'],cap=False);mesh.face([mesh.vert(p,'head') for p in top],color)

def glasses(mesh):
    for x in [-.045,.045]:
        a=[];b=[]
        for i in range(10):
            t=i*2*math.pi/10
            a.append(mesh.vert((x+.036*math.cos(t),-.101,1.652+.036*math.sin(t)),'head'))
            b.append(mesh.vert((x+.0328*math.cos(t),-.1015,1.652+.0328*math.sin(t)),'head'))
        for i in range(10):mesh.face((a[i],a[(i+1)%10],b[(i+1)%10],b[i]),3)
    mesh.poly([(-.012,-.103,1.658),(.012,-.103,1.658),(.012,-.103,1.661),(-.012,-.103,1.661)],3,'head')
    for s in [-1,1]:mesh.poly([(s*.080,-.10,1.655),(s*.111,-.006,1.651),(s*.111,-.006,1.654),(s*.080,-.10,1.658)],3,'head')

def legs(mesh,color,skin,dress=False):
    for s,sgn in [('L',1),('R',-1)]:
        rings=[];weights=[]
        for z,w,d,blend in [(.98,.055,.075,0),(.88,.080,.084,0),(.74,.077,.075,0),(.56,.061,.06,.15),(.50,.06,.058,.8),(.32,.05,.05,1),(.10,.047,.048,1)]:
            if dress and z>.56:continue
            rings.append(octring(w,d,z,cx=sgn*.095))
            weights.append({'pelvis':1} if z==.98 else ({'pelvis':.3,f'thigh.{s}':.7} if z==.88 else {f'thigh.{s}':1-blend,f'shin.{s}':blend}))
        mesh.rings(rings,skin if dress else color,weights)
        mesh.rings([[(sgn*.095-.055,-.165,0),(sgn*.095+.055,-.165,0),(sgn*.095+.055,.060,0),(sgn*.095-.055,.060,0)],[(sgn*.095-.05,-.145,.067),(sgn*.095+.05,-.145,.067),(sgn*.095+.05,.05,.105),(sgn*.095-.05,.05,.105)]],0,[f'foot.{s}']*2)
    if dress:
        mesh.rings([octring(.117,.087,1.055),octring(.173,.115,.88),octring(.198,.139,.72),octring(.223,.155,.555)],1,[{'pelvis':1},{'pelvis':1},{'pelvis':.65,'thigh.L':.175,'thigh.R':.175},{'pelvis':.2,'thigh.L':.4,'thigh.R':.4}],cap=False)

def hands(mesh,skin):
    for s,sgn in [('L',1),('R',-1)]:
        # mitten palm and a single distinct thumb, no individual finger geometry
        mesh.rings([[(sgn*x,y,z) for y,z in [(-.034,1.357),(.032,1.357),(.032,1.413),(-.034,1.413)]] for x in [.727,.823,.846]],skin,[f'hand.{s}']*3)
        mesh.rings([[(sgn*x,y,z) for x,y in [(.757,-.032),(.785,-.032),(.785,-.058),(.757,-.058)]] for z in [1.370,1.324]],skin,[f'thumb.{s}']*2)

def chest_details(mesh,color,kind):
    if kind=='dress':return
    if kind in ['suit','guest']:
        mesh.poly([(-.045,-.060,1.481),(.045,-.060,1.481),(.048,-.105,1.425),(0,-.115,1.340),(-.048,-.105,1.425)],1,'chest')
    elif kind=='guard':
        mesh.poly([(-.032,-.061,1.481),(.032,-.061,1.481),(.032,-.108,1.430),(0,-.114,1.386),(-.032,-.108,1.430)],1,'chest')
    for s in [-1,1]:mesh.poly([(s*.045,-.062,1.480),(s*.065,-.094,1.446),(s*.021,-.106,1.421)],1,'chest')
    if kind in ['suit','guest']:
        for s in [-1,1]:mesh.poly([(s*.070,-.097,1.443),(s*.102,-.108,1.405),(s*.014,-.117,1.313),(s*.042,-.113,1.386)],0 if kind=='suit' else 4,'chest')
    if kind=='waiter':
        mesh.poly([(-.038,-.113,1.449),(-.038,-.116,1.422),(0,-.118,1.435)],0,'chest');mesh.poly([(.038,-.113,1.449),(.038,-.116,1.422),(0,-.118,1.435)],0,'chest')
    if kind=='guard':mesh.poly([(.075,-.109,1.355),(.102,-.109,1.355),(.102,-.109,1.323),(.088,-.109,1.311),(.075,-.109,1.323)],3,'chest')

def hat(mesh,kind):
    if kind=='guard':
        mesh.rings([octring(.125,.106,1.731),octring(.108,.092,1.800)],5,['head']*2)
        mesh.poly([(-.127,-.03,1.733),(-.125,-.143,1.727),(.125,-.143,1.727),(.127,-.03,1.733)],0,'head')
        mesh.poly([(-.016,-.106,1.781),(.016,-.106,1.781),(.016,-.107,1.756),(0,-.108,1.747),(-.016,-.107,1.756)],3,'head')
        box(mesh,(.115,-.010,1.625),(.135,.012,1.654),0,'head')
        mesh.poly([(.13,-.006,1.626),(.104,-.087,1.582),(.099,-.091,1.586),(.125,-.010,1.630)],0,'head')
        box(mesh,(.079,-.1,1.580),(.101,-.092,1.589),0,'head')
    else:
        brim=[mesh.vert(p,'head') for p in octring(.193,.150,1.735)]
        crown=mesh.rings([octring(.120,.102,1.735),octring(.101,.087,1.8)],0,['head']*2,cap=False)
        for i in range(8):mesh.face((brim[i],brim[(i+1)%8],crown[0][(i+1)%8],crown[0][i]),0)
        mesh.face(crown[-1],0)
        mesh.rings([octring(.122,.104,1.742),octring(.119,.101,1.755)],12,['head']*2,cap=False)
        for s in [-1,1]:
            cx=s*.119;cy=-.013;z=1.604;r=.006
            ids=[mesh.vert(p,'head') for p in [(cx-r,cy,z),(cx+r,cy,z),(cx,cy-r,z),(cx,cy+r,z),(cx,cy,z+r),(cx,cy,z-r)]]
            for a,b in [(0,2),(2,1),(1,3),(3,0)]:mesh.face((ids[a],ids[b],ids[4]),1);mesh.face((ids[b],ids[a],ids[5]),1)

def pose_clear(rig):
    for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0)

def global_rotation(rig,name,axis,angle):
    p=rig.pose.bones[name];q=p.bone.matrix_local.to_quaternion();p.rotation_quaternion=q.inverted()@Quaternion(Vector(axis),math.radians(angle))@q

def pose(rig,name,phase=0):
    pose_clear(rig)
    down={'arms_down':83,'arms_45':45,'arms_90':0,'forward_reach':83,'elbow_90':70,'walk':80}.get(name,0)
    for s,sgn in [('L',1),('R',-1)]:
        global_rotation(rig,f'upper_arm.{s}',(0,1,0),sgn*down)
        if name=='forward_reach':
            q=Quaternion((1,0,0),math.radians(-90))@Quaternion((0,1,0),math.radians(sgn*83));r=rig.pose.bones[f'upper_arm.{s}'].bone.matrix_local.to_quaternion();rig.pose.bones[f'upper_arm.{s}'].rotation_quaternion=r.inverted()@q@r
        if name=='elbow_90':global_rotation(rig,f'forearm.{s}',(0,0,1),-sgn*90)
        if name=='walk':
            a=math.sin(phase)*sgn
            q=Quaternion((1,0,0),math.radians(a*19))@Quaternion((0,1,0),math.radians(sgn*80));r=rig.pose.bones[f'upper_arm.{s}'].bone.matrix_local.to_quaternion();rig.pose.bones[f'upper_arm.{s}'].rotation_quaternion=r.inverted()@q@r
            global_rotation(rig,f'thigh.{s}',(1,0,0),-a*23);global_rotation(rig,f'shin.{s}',(1,0,0),max(a,0)*27)
    bpy.context.view_layer.update()

def walk(rig):
    for frame in range(1,26,3):
        pose(rig,'walk',2*math.pi*(frame-1)/24)
        rig.pose.bones['pelvis'].location.z=.012*(1-math.cos(4*math.pi*(frame-1)/24))
        for p in rig.pose.bones:p.keyframe_insert('rotation_quaternion',frame=frame,group=p.name);p.keyframe_insert('location',frame=frame,group=p.name)
    rig.animation_data.action.name='walk1'
    for fc in rig.animation_data.action.fcurves:
        for k in fc.keyframe_points:k.interpolation='LINEAR'
    return rig.animation_data.action

# Copied from character-revision/source/build_pool_characters.py; see source-provenance.json.
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

def rig_create():
    ar=bpy.data.armatures.new('CLEAN_HANDS_shared_22');ob=bpy.data.objects.new('Rig',ar);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    spec=[('root',(0,0,0),(0,0,.12),None),('pelvis',(0,0,.88),(0,0,1.03),'root'),('spine',(0,0,1.03),(0,0,1.22),'pelvis'),('chest',(0,0,1.22),(0,0,1.43),'spine'),('neck',(0,0,1.43),(0,0,1.52),'chest'),('head',(0,0,1.52),(0,0,1.78),'neck')]
    for s,sgn in [('L',1),('R',-1)]:
        spec += [(f'clavicle.{s}',(sgn*.055,0,1.415),(sgn*.205,0,1.385),'chest'),(f'upper_arm.{s}',(sgn*.205,0,1.385),(sgn*.49,0,1.385),f'clavicle.{s}'),(f'forearm.{s}',(sgn*.49,0,1.385),(sgn*.735,0,1.385),f'upper_arm.{s}'),(f'hand.{s}',(sgn*.735,0,1.385),(sgn*.825,0,1.385),f'forearm.{s}'),(f'thumb.{s}',(sgn*.765,-.025,1.37),(sgn*.8,-.055,1.335),f'hand.{s}'),(f'thigh.{s}',(sgn*.095,0,.92),(sgn*.095,0,.53),'pelvis'),(f'shin.{s}',(sgn*.095,0,.53),(sgn*.095,0,.12),f'thigh.{s}'),(f'foot.{s}',(sgn*.095,0,.12),(sgn*.095,-.13,.055),f'shin.{s}')]
    for name,h,t,par in spec:
        b=ar.edit_bones.new(name);b.head=h;b.tail=t
        if par:b.parent=ar.edit_bones[par]
    bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False);return ob

def morphs(ob,mesh):
    ob.shape_key_add(name='Basis')
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
                    if tag=='mouth':co.x*=.4;co.z=1.588+(co.z-1.588)*1.5
                else:
                    if tag.startswith('brow'):
                        center=.045 if tag.endswith('L') else -.045
                        co.z+=(abs(co.x)-abs(center))*.26-.003
                    if tag.startswith('eye'):co.z=1.654+(co.z-1.654)*.57
                    if tag.startswith('pupil'):co.z=1.654+(co.z-1.654)*.72
                    if tag=='mouth':co.x*=.84;co.z=1.587+(co.z-1.588)*2.5;co.y-=.003
    ob.data.shape_keys.key_blocks['calm'].value=1

def hands(mesh,skin):
    for s,sgn in [('L',1),('R',-1)]:
        # mitten palm and a single distinct thumb, no individual finger geometry
        mesh.rings([[(sgn*x,y,z) for y,z in [(-.034,1.357),(.032,1.357),(.032,1.413),(-.034,1.413)]] for x in [.727,.823,.846]],skin,[f'hand.{s}']*3)
        mesh.rings([[(sgn*x,y,z) for x,y in [(.757,-.032),(.785,-.032),(.785,-.058),(.757,-.058)]] for z in [1.370,1.324]],skin,[f'thumb.{s}']*2)

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

def pool_head(m,skin,kind):
    female=kind!='shorts'; fuller=kind=='resort'
    spec=[(1.535,.044,.047),(1.567,.073,.068),(1.625,.102 if fuller else .096,.084),(1.695,.099 if fuller else .093,.082),(1.749,.084,.074)] if female else [(1.528,.067,.06),(1.570,.092,.077),(1.637,.111,.09),(1.715,.106,.085),(1.755,.086,.075)]
    m.rings([octring(w,d,z) for z,w,d in spec],skin,['head']*len(spec))
    m.rings([octring(.045 if female else .057,.043,1.46),octring(.043 if female else .055,.043,1.552)],skin,[{'neck':1},{'head':.7,'neck':.3}])
    for s in [-1,1]:
        m.poly([(s*.096,-.007,1.658),(s*.116,-.012,1.646),(s*.113,-.012,1.611),(s*.096,-.018,1.615)],skin,'head')
    a=m.vert((-.009,-.087,1.651),'head');b=m.vert((.009,-.087,1.651),'head');c=m.vert((.010,-.086,1.620),'head');d=m.vert((-.010,-.086,1.620),'head');t=m.vert((0,-.101,1.624),'head')
    for f in [(a,b,t),(b,c,t),(c,d,t),(d,a,t)]:m.face(f,skin)

def pool_face(m,hc,kind):
    female=kind!='shorts'; y=-.087 if female else -.093
    for side,x in [('L',.041),('R',-.041)]:
        m.poly([(x-.022,y,1.655),(x-.012,y-.001,1.649),(x+.013,y-.001,1.649),(x+.023,y,1.656),(x+.010,y-.001,1.664),(x-.012,y-.001,1.663)],1,'head','eye.'+side)
        m.poly([(x-.006,y-.002,1.651),(x+.006,y-.002,1.651),(x+.006,y-.002,1.662),(x-.006,y-.002,1.662)],0,'head','pupil.'+side)
        m.poly([(x-.022,y+.001,1.681),(x,y,1.687),(x+.021,y+.001,1.682),(x+.021,y+.001,1.686),(x,y,1.692),(x-.022,y+.001,1.685)],hc,'head','brow.'+side)
    m.poly([(-.018,-.077 if female else -.089,1.588),(0,-.081 if female else -.093,1.585),(.018,-.077 if female else -.089,1.588),(.008,-.080 if female else -.092,1.591),(0,-.081 if female else -.093,1.590),(-.008,-.080 if female else -.092,1.591)],9,'head','mouth')

def pool_hair(m,hc,kind):
    if kind=='swimsuit':
        lo=octring(.102,.087,1.709);lo=[(x,y,1.718+(.015*x/.1) if y<-.06 else 1.64) for x,y,z in lo]
        m.rings([lo,octring(.101,.088,1.751,cy=.005),octring(.065,.058,1.786,cy=.005)],hc,['head']*3,cap=False)
        m.face([m.vert(p,'head') for p in octring(.065,.058,1.786,cy=.005)],hc)
        m.rings([octring(.043,.036,1.709,cy=.084),octring(.050,.043,1.757,cy=.084),octring(.031,.028,1.799,cy=.084)],hc,['head']*3)
    elif kind=='resort':
        lo=[(x,y,1.706+x*.14 if y<-.065 else 1.553) for x,y,z in octring(.120,.101,1.7)]
        m.rings([lo,octring(.112,.097,1.751),octring(.065,.062,1.797,cx=-.012)],hc,['head']*3,cap=False)
        m.face([m.vert(p,'head') for p in octring(.065,.062,1.797,cx=-.012)],hc)
    else:
        lo=[(x,y,1.726+x*.12 if y<-.06 else 1.66) for x,y,z in octring(.114,.094,1.72)]
        m.rings([lo,octring(.099,.089,1.794)],hc,['head']*2,cap=False);m.face([m.vert(p,'head') for p in octring(.099,.089,1.794)],hc)

def pool_torso(m,skin,kind):
    full=kind=='resort';male=kind=='shorts';color=skin if male else (4 if full else 5)
    specs=[(.88,.185,.105),(1.02,.20,.13),(1.15,.19,.13),(1.29,.218,.14),(1.425,.203,.103)] if full else ([ (.88,.17,.098),(1.05,.165,.103),(1.17,.178,.108),(1.29,.223,.12),(1.425,.235,.108)] if male else [(.88,.17,.09),(1.02,.165,.10),(1.15,.133,.089),(1.29,.174,.105),(1.425,.187,.085)])
    rows=[]
    for j,(z,w,d) in enumerate(specs):
        row=[]
        for i,(x,y,z) in enumerate(octring(w,d,z)):
            if j==4 and i in (0,2,3,4,6,7):z+=.016
            wt={'pelvis':1} if j<2 else ({'spine':.8,'chest':.2} if j==2 else {'chest':1})
            if j>=3 and i in (0,2,3,4,6,7):
                a=.20 if j==3 else .55;wt={'chest':1-a,'clavicle.'+('L' if x>0 else 'R'):a}
            row.append(m.vert((x,y,z),wt))
        rows.append(row)
    for j in range(4):
        for i in range(8):
            if j==3 and i in (2,3,6,7):continue
            m.face((rows[j][i],rows[j][(i+1)%8],rows[j+1][(i+1)%8],rows[j+1][i]),6 if male and j==0 else color)
    m.face(rows[0][::-1],6 if male else color)
    neck=[m.vert(p,{'chest':.8,'neck':.2}) for p in octring(.046 if not male else .057,.044,1.477)]
    for i in range(8):m.face((rows[-1][i],rows[-1][(i+1)%8],neck[(i+1)%8],neck[i]),skin)
    for side,sgn,indices in [('L',1,[2,3,4]),('R',-1,[0,7,6])]:
        prev=[rows[3][i] for i in indices]+[rows[4][i] for i in indices[::-1]]
        cross=[(-.067,-.055),(0,-.068),(.067,-.055),(.067,.047),(0,.064),(-.067,.047)]
        for x,scale,blend in [(.25,1.15 if full or male else .9,0),(.36,1.08 if full or male else .82,0),(.475,.82,.2),(.515,.80,.8),(.635,.67,1),(.735,.48,1)]:
            wt={f'upper_arm.{side}':1-blend,f'forearm.{side}':blend}
            if x==.25:wt={f'clavicle.{side}':.3,f'upper_arm.{side}':.7}
            cur=[m.vert((sgn*x,y*scale,1.385+z*scale),wt) for y,z in cross]
            for i in range(6):m.face((prev[i],prev[(i+1)%6],cur[(i+1)%6],cur[i]),color if full and x<=.36 else skin)
            prev=cur
        m.face(prev,skin)

def pool_legs(m,skin,kind):
    full=kind=='resort';male=kind=='shorts'
    for s,sgn in [('L',1),('R',-1)]:
        specs=[(.94,.072,.083),(.82,.079,.089),(.78,.078,.085),(.56,.057,.058),(.50,.056,.056),(.30,.048,.048),(.09,.035,.038)]
        if full:specs=[(.57,.068,.065),(.50,.066,.060),(.30,.055,.052),(.09,.04,.041)]
        if male:specs=[(.94,.086,.094),(.72,.093,.092),(.66,.087,.087),(.56,.062,.063),(.50,.060,.06),(.30,.055,.053),(.09,.041,.042)]
        rows=[]
        for z,w,d in specs:
            blend=0 if z>.56 else (.18 if z==.56 else (.8 if z==.50 else 1))
            rows.append([m.vert(p,{f'thigh.{s}':1-blend,f'shin.{s}':blend}) for p in octring(w,d,z,cx=sgn*.095)])
        for j in range(len(rows)-1):
            for i in range(8):m.face((rows[j][i],rows[j][(i+1)%8],rows[j+1][(i+1)%8],rows[j+1][i]),6 if male and j<2 else (5 if not full and not male and j==0 else skin))
        m.face(rows[0][::-1],6 if male else (skin if full else 5))
        m.rings([octring(.037 if not male else .043,.040,.115,cx=sgn*.095),octring(.047,.095,.035,cx=sgn*.095,cy=-.045),octring(.047,.095,0,cx=sgn*.095,cy=-.045)],skin,[f'foot.{s}']*3)
    if full:
        m.rings([octring(.202,.132,1.03),octring(.235,.148,.83),octring(.245,.16,.57)],4,[{'pelvis':1},{'pelvis':.65,'thigh.L':.175,'thigh.R':.175},{'pelvis':.2,'thigh.L':.4,'thigh.R':.4}],cap=False)
    elif male:m.rings([octring(.174,.103,1.02),octring(.175,.104,.91)],6,['pelvis']*2,cap=False)

def pool_details(m,kind):
    if kind=='resort':
        m.rings([octring(.201,.133,1.04),octring(.200,.133,1.075)],12,['spine']*2,cap=False)
        m.poly([(-.145,-.111,1.425),(-.05,-.145,1.29),(.030,-.139,1.20),(.013,-.141,1.20),(-.068,-.147,1.29)],12,'chest')
        m.poly([(.142,-.139,1.035),(.156,-.139,1.035),(-.066,-.165,.575),(-.078,-.165,.575)],10,{'pelvis':.55,'thigh.L':.225,'thigh.R':.225})
        m.poly([(.118,-.14,1.075),(.15,-.142,1.055),(.119,-.144,1.035),(.10,-.142,1.055)],12,'spine')
    elif kind=='swimsuit':
        for s in [-1,1]:m.poly([(s*.115,-.087,1.431),(s*.145,-.087,1.431),(s*.113,-.109,1.29),(s*.086,-.109,1.29)],6,'chest')
    else:
        m.poly([(-.02,-.108,.985),(.02,-.108,.985),(.02,-.108,.972),(-.02,-.108,.972)],1,'pelvis')

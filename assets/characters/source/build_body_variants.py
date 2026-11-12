# Copied body variant operations; private copied pool module only.
import math
import build_pool_characters as h
PROFILES={
 'pool_guest_slim':dict(label='細身の女性・ミント縁のティール水着',shoulder=.88,waist=.84,hip=.90,depth=.88,arm=.78,leg=.80,head=.94,jaw=.90,neck=.84,eye=.022,eyeheight=.006,eyespread=.039,skin=14),
 'pool_guest_lean':dict(label='細身の男性・アンバーのスイムショーツ',shoulder=.90,waist=.86,hip=.94,depth=.87,arm=.79,leg=.82,head=.94,jaw=.88,neck=.88,eye=.020,eyeheight=.005,eyespread=.043,skin=7),
 'pool_guest_strong':dict(label='筋肉質の女性・アンバーとティールの水着',shoulder=1.10,waist=1.08,hip=1.09,depth=1.10,arm=1.17,leg=1.15,head=1.03,jaw=1.04,neck=1.03,eye=.024,eyeheight=.007,eyespread=.041,skin=7),
}
active=None
def mix(a,b,t):return a+(b-a)*max(0,min(1,t))
def body_width(z,p):
 if z<1.02:return p['hip']
 if z<1.15:return mix(p['hip'],p['waist'],(z-1.02)/.13)
 return mix(p['waist'],p['shoulder'],(z-1.15)/.275)
def deform(v,name):
 p=PROFILES[active];x,y,z=v;ax=abs(x)
 if name in ['Head','Hair','Face']:
  if z<1.53:return (x*p['neck'],y*p['neck'],z)
  factor=mix(p['jaw'],p['head'],(z-1.54)/.13);x*=factor
  if name=='Head' and abs(x)<.015 and y<-.085 and 1.615<z<1.655:
   y=max(y,-.096 if active=='pool_guest_slim' else -.100)
  if name=='Hair' and active=='pool_guest_lean':z+=.015*x/.1
  return (x,y,z)
 if name=='Hands':return (x,y*p['arm'],1.385+(z-1.385)*p['arm'])
 if name=='Legs':
  center=.095 if x>=0 else -.095
  scale=mix(p['leg'],p['hip'],(z-.80)/.14)
  return (center+(x-center)*scale,y*scale,z)
 if name in ['Body','Details']:
  central=max(0,1-(ax/.32)**4)
  x*=1+(body_width(z,p)-1)*central
  arm_mix=max(0,min(1,(ax-.20)/.12))
  y*=mix(p['depth'],p['arm'],arm_mix)
  z=mix(z,1.385+(z-1.385)*p['arm'],arm_mix)
  return (x,y,z)
 return (x,y,z)

original_object=h.Mesh.object
def object_variant(self,rig,mat):
 if self.name!='Face':self.v=[deform(v,self.name) for v in self.v]
 p=PROFILES[active]
 # Skin and clothing remaps are confined to the appropriate logical parts.
 if active=='pool_guest_lean':
  self.c=[7 if c==8 else (3 if c==6 and self.name in ['Body','Legs'] else c) for c in self.c]
 elif active=='pool_guest_slim':
  if self.name in ['Body','Legs','Details']:self.c=[4 if c==5 else (11 if c==6 else c) for c in self.c]
 elif active=='pool_guest_strong':
  self.c=[7 if c==14 else c for c in self.c]
  if self.name in ['Body','Legs','Details']:self.c=[3 if c==5 else (4 if c==6 else c) for c in self.c]
 return original_object(self,rig,mat)
h.Mesh.object=object_variant

def face_variant(m,haircolor,kind):
 p=PROFILES[active];male=active=='pool_guest_lean';y=-.093 if male else -.088
 for side,sgn in [('L',1),('R',-1)]:
  x=sgn*p['eyespread'];w=p['eye'];hh=p['eyeheight'];z=1.656
  # Different eye width, spacing, outer-corner lift and eyebrow shape per face.
  lift=.001 if male else .002
  m.poly([(x-w,y,z),(x-w*.48,y-.001,z-hh),(x+w*.48,y-.001,z-hh),(x+w,y,z+lift),(x+w*.48,y-.001,z+hh),(x-w*.48,y-.001,z+hh)],1,'head','eye.'+side)
  pupil=.005 if male else .006
  m.poly([(x-pupil,y-.002,z-.005),(x+pupil,y-.002,z-.005),(x+pupil,y-.002,z+.006),(x-pupil,y-.002,z+.006)],0,'head','pupil.'+side)
  bz=1.681;arch=.003 if male else (.005 if active=='pool_guest_slim' else .004)
  m.poly([(x-w,y+.001,bz),(x,y,bz+arch),(x+w,y+.001,bz+.001),(x+w,y+.001,bz+.004),(x,y,bz+arch+.003),(x-w,y+.001,bz+.003)],haircolor,'head','brow.'+side)
 my=-.093 if male else -.081;mw=.021 if male else .016
 m.poly([(-mw,my,1.588),(0,my-.001,1.585),(mw,my,1.589),(mw*.45,my-.001,1.591),(0,my-.001,1.589),(-mw*.45,my-.001,1.590)],9,'head','mouth')
h.pool_face=face_variant
original_morphs=h.morphs
def morph_variant(ob,mesh):
 original_morphs(ob,mesh)
 for key in ob.data.shape_keys.key_blocks:
  for vertex in key.data:vertex.co=deform(vertex.co,'Face')
h.morphs=morph_variant
original_hair=h.pool_hair
def hair_variant(mesh,color,kind):
 original_hair(mesh,0 if active=='pool_guest_strong' else color,'resort' if active=='pool_guest_strong' else kind)
h.pool_hair=hair_variant

import bpy, math, json, struct, os
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
# Inspect the shared 16-color atlas from the existing locker; select darkest neutral pixels.
ref='C:/Users/gamit/Documents/Codex/2026-10-26/https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page/outputs/repaired/models/locker/locker.glb'
bpy.ops.import_scene.gltf(filepath=ref)
imgs=[i for i in bpy.data.images if i.type=='IMAGE' and i.size[0]>0]
colors=[]
for img in imgs:
 p=list(img.pixels)
 colors.extend(set(tuple(round(v,5) for v in p[k:k+3]) for k in range(0,len(p),4)))
neutral=sorted([c for c in set(colors) if max(c)-min(c)<.08],key=sum)
chosen=neutral[:2] if len(neutral)>=2 else [(0.035,0.04,0.045),(.10,.11,.12)]
for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
def mat(name,col):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.86;bs.inputs['Metallic'].default_value=.18
 return m
chosen=[tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c) for c in [chosen[0],chosen[0]]]
black=mat('CH_dark_grip',chosen[0]);grey=mat('CH_dark_wire',chosen[1])
def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
# Authoring Blender coordinates x/right, z/up, -y/front; glTF exporter maps to Y-up,+Z-front.
root=empty('Wire_asset');coiled=empty('Wire_coiled',parent=root);taut=empty('Wire_taut',parent=root)
def rod(name,a,b,r,material,parent,vertices=8):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2)
 o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(material);o.parent=parent
 return o
def grip(name,x,y,parent): return rod(name,(x,y,-.035),(x,y,.035),.009,black,parent)
for x,side in [(-.16,'L'),(.16,'R')]:
 grip('Taut_grip_'+side,x,0,taut)
rod('Taut_cable',(-.16,0,0),(.16,0,0),.0018,grey,taut,6)
# Coiled pair sits at right-hand attachment, compact 85 mm bundle.
for x,side in [(.142,'L'),(.16,'R')]: grip('Coiled_grip_'+side,x,0,coiled)
points=[]
for i in range(49):
 t=i/48*math.tau*2;points.append((.135+.032*math.cos(t),.032*math.sin(t),-.008+i/48*.016))
for i in range(48):rod('Coil_%02d'%i,points[i],points[i+1],.0018,grey,coiled,6)
empty('GRIP_L',(-.16,0,0),root);empty('GRIP_R',(.16,0,0),root);empty('ATTACH_R',(.16,0,0),root)
# Join each state's parts to keep runtime draw calls small.
for group in [coiled,taut]:
 bpy.ops.object.select_all(action='DESELECT')
 parts=[o for o in group.children if o.type=='MESH']
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
 for uv in list(parts[0].data.uv_layers):parts[0].data.uv_layers.remove(uv)
# Export both states; runtime sets exactly one group visible.
bpy.ops.export_scene.gltf(filepath=OUT+'/wire.glb',export_format='GLB',export_yup=True,export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/wire.blend')
# Separate orthographic proof views; both variants are individually visible.
world=bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.36,.39,.43,1)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=1000;scene.render.resolution_y=400;scene.render.resolution_percentage=100
bpy.ops.object.light_add(type='AREA',location=(0,-1,1));bpy.context.object.data.energy=80;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=2
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=.43
for state,group,other in [('taut',taut,coiled),('coiled',coiled,taut)]:
 for obj in group.children:obj.hide_render=False
 for obj in other.children:obj.hide_render=True
 center=Vector((0,0,0) if state=='taut' else (.135,0,0));cam.data.ortho_scale=.43 if state=='taut' else .23
 for view,offset in [('front',(0,-1,0)),('back',(0,1,0)),('side',(1,0,.05))]:
  cam.location=center+Vector(offset);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=OUT+'/'+state+'-'+view+'.png';bpy.ops.render.render(write_still=True)
# Read exported data for actual node/material/geometry report.
b=open(OUT+'/wire.glb','rb').read();j=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
report={'units':'meter','axes':'glTF Y-up, +Z forward','root':'Wire_asset','stateNodes':['Wire_coiled','Wire_taut'],'anchors':{'GRIP_L':[-.16,0,0],'GRIP_R':[.16,0,0],'ATTACH_R':[.16,0,0]},'tautGripCenterSpan_m':.32,'gripLength_m':.07,'gripDiameter_m':.018,'cableDiameter_m':.0036,'paletteSource':ref,'paletteColorsLinear':chosen,'nodes':[{'name':n.get('name'),'translation':n.get('translation',[0,0,0])} for n in j['nodes']],'meshCount':len(j['meshes']),'triangles':sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives'])}
json.dump(report,open(OUT+'/model-info.json','w'),indent=2)


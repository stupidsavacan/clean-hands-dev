"""Optional, new-character-only appearance and skinned surface marks."""
import base64
from pathlib import Path
import bpy
from mathutils import Vector

OUTERS = ('Jacket','JacketCollar','JacketLong','JacketLongCollar',
          'Bomber','BomberCollar','BomberLong','BomberLongCollar','Blazer')


def outer(rig, model, library, is_outer=True):
    with bpy.data.libraries.load(str(library), link=False) as (_, dest):
        dest.objects = [model]
    ob = dest.objects[0]
    ob.name = 'Outer' if is_outer else model
    ob.parent = rig
    for modifier in ob.modifiers:
        if modifier.type == 'ARMATURE':
            modifier.object = rig
    bpy.context.collection.objects.link(ob)
    return ob


def layer_inner(objects, recipe):
    # A closed cropped flight jacket covers the inner sleeves and torso. Keep
    # the visible untucked hem, but avoid two intersecting sleeve surfaces.
    if not any(p['part']=='outer.layer.v1' and p['parameters']['model'].startswith('Bomber') for p in recipe['parts']):
        return
    import bmesh
    for ob in objects:
        if ob.name not in ('TShirt','Shirt'):
            continue
        bm=bmesh.new();bm.from_mesh(ob.data)
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
            dist=1e-7,plane_co=Vector((0,0,1.045)),plane_no=Vector((0,0,1)),clear_outer=True)
        bm.to_mesh(ob.data);bm.free();ob.data.update()


def recolor(objects, recipe):
    colors = recipe.get('appearanceColors', {})
    skin_cells = {p['colors']['skin'] for p in recipe['parts'] if 'skin' in p['colors']}
    if recipe['body']['profile']=='pool.variant.lean.v1':skin_cells={7 if c==8 else c for c in skin_cells}
    if recipe['body']['profile']=='pool.variant.strong.v1':skin_cells={7 if c==14 else c for c in skin_cells}
    materials = {}
    for ob in objects:
        uv = ob.data.uv_layers.active
        if not uv:
            continue
        for polygon in ob.data.polygons:
            cell_uv = uv.data[polygon.loop_indices[0]].uv
            cell = int(cell_uv.x*4)+4*int((1-cell_uv.y)*4)
            groups = {ob.vertex_groups[g.group].name for i in polygon.vertices for g in ob.data.vertices[i].groups if g.weight > 0}
            if ob.get('garment'):
                role = 'outer' if cell == 0 else 'accessories'
            elif ob.name == 'Outer':
                role = 'outer' if cell == 4 else None
            elif ob.name == 'Hair':
                role = 'hair'
            elif ob.name == 'Face':
                role = None
            elif cell in skin_cells:
                role = 'skin'
            elif groups and all(g.startswith('foot.') for g in groups):
                role = 'shoes'
            elif ob.name in ('Body','Head','Hands'):
                role = None
            elif ob.name in ('Accessories','Details'):
                role = 'accessories'
            elif ob.name == 'Legs' or (groups and all(g.startswith(('thigh.','shin.','foot.','pelvis')) for g in groups)):
                role = 'pants'
            else:
                role = 'top'
            if role not in colors:
                continue
            value = colors[role]
            if role not in materials:
                mat = bpy.data.materials.new('Role_'+role)
                mat.use_nodes = True
                bs = mat.node_tree.nodes.get('Principled BSDF')
                rgb = [int(value[i:i+2],16)/255 for i in (1,3,5)]
                # UI hex is sRGB; glTF factors are linear.
                bs.inputs['Base Color'].default_value = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]+[1]
                bs.inputs['Roughness'].default_value = 1
                materials[role] = mat
            mat = materials[role]
            if mat.name not in ob.data.materials:
                ob.data.materials.append(mat)
            polygon.material_index = ob.data.materials.find(mat.name)


def mark(objects, rig, description, folder):
    if not description or not description.get('png'):
        return None
    source = next((ob for ob in objects if ob.name == description['mesh']), None)
    if source is None:
        raise ValueError('Mark target is missing')
    def convert(v):
        return Vector((v[0],-v[2],v[1]))
    center, normal = convert(description['point']), convert(description['normal']).normalized()
    vertical = Vector((0,0,1)) if abs(normal.z) < .94 else Vector((0,1,0))
    right = vertical.cross(normal).normalized()
    from mathutils import Quaternion
    import math
    right = Quaternion(normal, math.radians(description['angle'])) @ right
    up = normal.cross(right)
    size = description['size']
    def interpolate(a,b,t):
        return (a[0].lerp(b[0],t), a[1].lerp(b[1],t), {k:a[2].get(k,0)*(1-t)+b[2].get(k,0)*t for k in a[2].keys()|b[2].keys()})
    def clip(poly, axis, limit, sign):
        result=[]
        for a,b in zip(poly,poly[1:]+poly[:1]):
            da=sign*(a[1][axis]-limit);db=sign*(b[1][axis]-limit)
            if da<=0:result.append(a)
            if (da<=0)!=(db<=0):result.append(interpolate(a,b,da/(da-db)))
        return result
    vertices=[];faces=[];uvs=[];weights=[]
    source.data.calc_loop_triangles()
    for tri in source.data.loop_triangles:
        points=[source.data.vertices[i].co.copy() for i in tri.vertices]
        n=(points[1]-points[0]).cross(points[2]-points[0]).normalized()
        if abs(n.dot(normal))<.25:continue
        if n.dot(normal)<0:n=-n
        poly=[]
        for i,p in zip(tri.vertices,points):
            d=p-center
            w={source.vertex_groups[g.group].name:g.weight for g in source.data.vertices[i].groups}
            poly.append((p,Vector((d.dot(right),d.dot(up),d.dot(normal))),w))
        for axis in range(3):
            limit=min(.065,size*.65) if axis==2 else size/2
            poly=clip(clip(poly,axis,limit,1),axis,-limit,-1) if poly else []
        for j in range(1,len(poly)-1):
            face=[]
            for p,d,w in (poly[0],poly[j],poly[j+1]):
                face.append(len(vertices));vertices.append(p+n*.002)
                uvs.append((d.x/size+.5,d.y/size+.5));weights.append(w)
            faces.append(face)
    if not faces:
        raise ValueError('The mark did not intersect the selected garment')
    mesh=bpy.data.meshes.new('Mark_Surface');mesh.from_pydata(vertices,[],faces);mesh.update()
    ob=bpy.data.objects.new('Mark_Surface',mesh);bpy.context.collection.objects.link(ob);ob.parent=rig
    uv=mesh.uv_layers.new(name='MarkUV')
    for loop in mesh.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
    for name in sorted({k for w in weights for k in w}):ob.vertex_groups.new(name=name)
    for i,w in enumerate(weights):
        for name,value in w.items():
            if value:ob.vertex_groups[name].add([i],value,'REPLACE')
    ob.modifiers.new('Skinned mark','ARMATURE').object=rig
    folder.mkdir(parents=True,exist_ok=True)
    png=folder/'mark.png';png.write_bytes(base64.b64decode(description['png'].split(',',1)[1],validate=True))
    image=bpy.data.images.load(str(png));image.pack()
    mat=bpy.data.materials.new('Mark');mat.use_nodes=True
    if hasattr(mat,'surface_render_method'):mat.surface_render_method='DITHERED'
    bs=mat.node_tree.nodes.get('Principled BSDF');tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);mat.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
    bs.inputs['Roughness'].default_value=1;mat.diffuse_color=(1,1,1,1);mesh.materials.append(mat)
    return ob

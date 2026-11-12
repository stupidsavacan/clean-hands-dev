"""Blender 4.2: blender -b -P build_recipe.py -- ../recipes/waiter.json.

Only local versioned part functions execute. No external character source imports.
One recipe per Blender process keeps palette, scene and naming state isolated.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_characters as bc
import build_pool_characters as bp
import build_uniforms as bu
from normalize_skin_roots import normalize

ASSETS = HERE.parent
CAST = ('cast.male.v1',)
POOL = ('pool.resort.v1',)


def photographer_inlay(mesh, vest, pocket):
    bu.garment_inlay(mesh, [(-.165,-.04,1.0,1.40,vest,False),(.04,.165,1.0,1.40,vest,False),
                          (-.165,.165,1.0,1.40,vest,True),(-.145,-.06,1.08,1.16,pocket,False),
                          (.06,.145,1.08,1.16,pocket,False)])


# Parameters (including palette roles) are explicit; recipes contain no code.
PARTS = {
    'cast.head.male.v1': (bc.head, CAST, {'skin': ('cell',)}, {}),
    'cast.face.male.v1': (bc.face, CAST, {'hair': ('cell',)}, {}),
    'cast.torso.v1': (bc.torso, CAST, {'color': ('cell',)}, {}),
    'uniform.torso.v1': (bu.uniform_torso, CAST, {'color': ('cell',)}, {}),
    'cast.legs.v1': (bc.legs, CAST, {'color': ('cell',), 'skin': ('cell',)}, {}),
    'cast.hands.v1': (bc.hands, CAST, {'skin': ('cell',)}, {}),
    'cast.hair.v1': (bc.hair, CAST, {'color': ('cell',)}, {'kind': ('parted', 'swept')}),
    'cast.chest-details.v1': (bc.chest_details, CAST, {'color': ('cell',)}, {'kind': ('waiter',)}),
    'photographer.vest-inlay.v1': (photographer_inlay, CAST, {'vest': ('cell',), 'pocket': ('cell',)}, {}),
    'uniform.collar.v1': (bu.collar, CAST, {'c': ('cell',)}, {}),
    'uniform.camera.v1': (bu.camera, CAST, {}, {}),
    'pool.head.v1': (bp.pool_head, POOL, {'skin': ('cell',)}, {'kind': ('resort',)}),
    'pool.face.v1': (bp.pool_face, POOL, {'hc': ('cell',)}, {'kind': ('resort',)}),
    'pool.hair.v1': (bp.pool_hair, POOL, {'hc': ('cell',)}, {'kind': ('resort',)}),
    'pool.torso.v1': (bp.pool_torso, POOL, {'skin': ('cell',)}, {'kind': ('resort',)}),
    'pool.legs.v1': (bp.pool_legs, POOL, {'skin': ('cell',)}, {'kind': ('resort',)}),
    'pool.hands.v1': (bp.hands, POOL, {'skin': ('cell',)}, {}),
    'pool.details.v1': (bp.pool_details, POOL, {}, {'kind': ('resort',)}),
}


def validate(recipe):
    if recipe['schemaVersion'] != 1 or recipe['assetMode'] != 'generated':
        raise ValueError('Only generated v1 pilot recipes are supported')
    if recipe['rig'] != 'cast.shared22.v1':
        raise ValueError('Unknown rig')
    if recipe['id'] not in ('waiter', 'photographer', 'pool_guest_resort'):
        raise ValueError('Only the three approved pilot outputs may be written')
    if recipe['body']['profile'] not in CAST + POOL:
        raise ValueError('Unknown body profile')
    if recipe['body'].get('parameters'):
        raise ValueError('Pilot body profiles have no free parameters')
    palette = recipe['palette']
    if palette['id'] not in ('cast.palette.v1', 'uniform.palette.v1', 'pool.palette.v1') or palette.get('overrides'):
        raise ValueError('Unknown/modified pilot palette')
    output = recipe['output']
    if output['animationProfile'] != 'cast.walk1.v1' or output['exportProfile'] != 'blender42.cast-nla.v1':
        raise ValueError('Unknown export profile')
    meshes = output['meshOrder']
    if not meshes or len(set(meshes)) != len(meshes) or any(n not in ('Head','Body','Legs','Hands','Hair','Details','Face','Outfit','Accessories') for n in meshes):
        raise ValueError('Invalid mesh order')
    for p in recipe['parts']:
        if set(p) != {'part', 'mesh', 'colors', 'parameters'} or p['part'] not in PARTS or p['mesh'] not in meshes:
            raise ValueError('Invalid part')
        _, compatible, colors, parameters = PARTS[p['part']]
        if recipe['body']['profile'] not in compatible:
            raise ValueError('Incompatible part/body')
        if p['colors'].keys() != colors.keys() or p['parameters'].keys() != parameters.keys():
            raise ValueError('Invalid part parameter names')
        for cell in p['colors'].values():
            if type(cell) is not int or not 0 <= cell <= 15:
                raise ValueError('Invalid palette cell')
        for k, v in p['parameters'].items():
            if v not in parameters[k]:
                raise ValueError('Invalid part parameter value')
    if recipe['specialOperations'] != [
        {'operation': 'cast.face-morphs.v1', 'phase': 'afterObjects', 'mesh': 'Face'},
        {'operation': 'skin-roots.normalize.v1', 'phase': 'afterExport'}]:
        raise ValueError('Unknown/incorrect operation order')


def build(path):
    recipe = json.loads(path.read_text(encoding='utf-8'))
    validate(recipe)
    # Importing the copied helpers must never reach outside this source folder.
    for module in (bc, bp, bu):
        if Path(module.__file__).resolve().parent != HERE:
            raise RuntimeError('Unexpected external helper module')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    family = bp if recipe['body']['profile'] in POOL else bc
    palettes = {'cast.palette.v1': bc.palette, 'uniform.palette.v1': bu.palette, 'pool.palette.v1': bp.palette}
    mat = palettes[recipe['palette']['id']]()
    rig = family.rig_create()
    meshes = {name: family.Mesh(name) for name in recipe['output']['meshOrder']}
    for p in recipe['parts']:
        fn = PARTS[p['part']][0]
        fn(meshes[p['mesh']], **p['colors'], **p['parameters'])
    objects = []
    for name, mesh in meshes.items():
        if mesh.v:
            ob = mesh.object(rig, mat)
            objects.append(ob)
            if name == 'Face':
                family.morphs(ob, mesh)
    action = family.walk(rig)
    rig.animation_data.action = None
    family.pose_clear(rig)
    track = rig.animation_data.nla_tracks.new()
    track.name = 'walk1'
    track.strips.new('walk1', 1, action)
    track.mute = True
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end, sc.render.fps = 1, 25, 24
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    rig.select_set(True)
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = rig
    track.mute = False
    dest = ASSETS / 'models' / recipe['id'] / (recipe['id'] + '.glb')
    dest.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True,
        export_yup=True, export_animations=True, export_animation_mode='NLA_TRACKS',
        export_force_sampling=True, export_frame_range=True, export_rest_position_armature=True,
        export_morph=True, export_skins=True, export_materials='EXPORT', export_extras=True)
    normalize(dest)
    result = {'id': recipe['id'], 'recipe': path.relative_to(ASSETS).as_posix(), 'output': dest.relative_to(ASSETS).as_posix(),
              'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
              'blender': bpy.app.version_string,
              'meshes': {ob.name: {'vertices': len(ob.data.vertices),
                          'triangles': sum(len(p.vertices)-2 for p in ob.data.polygons)} for ob in objects}}
    (dest.parent / 'build.json').write_bytes((json.dumps(result, indent=2)+'\n').encode())
    print('RECIPE_BUILT ' + json.dumps(result), flush=True)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipe', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    build(args.recipe.resolve())

"""Blender 4.2: blender -b -P build_recipe.py -- ../recipes/waiter.json.

Only local versioned part functions execute. No external character source imports.
One recipe per Blender process keeps palette, scene and naming state isolated.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import re
from functools import partial

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from new_character_effects import OUTERS
import build_characters as bc
import build_pool_characters as bp
import build_uniforms as bu
from normalize_skin_roots import normalize

ASSETS = HERE.parent
CAST = ('cast.male.v1', 'cast.female.v1')
POOL = ('pool.resort.v1', 'pool.swimsuit.v1', 'pool.shorts.v1', 'pool.variant.slim.v1', 'pool.variant.lean.v1', 'pool.variant.strong.v1')
VARIANTS = {'pool.variant.slim.v1': 'pool_guest_slim', 'pool.variant.lean.v1': 'pool_guest_lean', 'pool.variant.strong.v1': 'pool_guest_strong'}


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
    'cast.hair.v1': (bc.hair, CAST, {'color': ('cell',)}, {'kind': ('parted', 'swept', 'short', 'bob')}),
    'cast.chest-details.v1': (bc.chest_details, CAST, {'color': ('cell',)}, {'kind': ('waiter', 'suit', 'guard', 'guest', 'dress')}),
    'photographer.vest-inlay.v1': (photographer_inlay, CAST, {'vest': ('cell',), 'pocket': ('cell',)}, {}),
    'uniform.collar.v1': (bu.collar, CAST, {'c': ('cell',)}, {}),
    'uniform.camera.v1': (bu.camera, CAST, {}, {}),
    'pool.head.v1': (bp.pool_head, POOL, {'skin': ('cell',)}, {'kind': ('resort', 'swimsuit', 'shorts')}),
    'pool.face.v1': (lambda m, hc, kind: bp.pool_face(m, hc, kind), POOL, {'hc': ('cell',)}, {'kind': ('resort', 'swimsuit', 'shorts')}),
    'pool.hair.v1': (lambda m, hc, kind: bp.pool_hair(m, hc, kind), POOL, {'hc': ('cell',)}, {'kind': ('resort', 'swimsuit', 'shorts')}),
    'pool.torso.v1': (bp.pool_torso, POOL, {'skin': ('cell',)}, {'kind': ('resort', 'swimsuit', 'shorts')}),
    'pool.legs.v1': (bp.pool_legs, POOL, {'skin': ('cell',)}, {'kind': ('resort', 'swimsuit', 'shorts')}),
    'pool.hands.v1': (bp.hands, POOL, {'skin': ('cell',)}, {}),
    'pool.details.v1': (bp.pool_details, POOL, {}, {'kind': ('resort', 'swimsuit', 'shorts')}),
}



def female_hands(mesh, skin):
    start = len(mesh.v)
    bc.hands(mesh, skin)
    bc.female_hands(mesh, start)


def lower_head(meshes):
    for m in meshes.values():
        for i, (x, y, z) in enumerate(m.v):
            if 'head' in m.w[i] or (m.name == 'Body' and 'neck' in m.w[i]):
                m.v[i] = (x, y, z-.018)


def delivery_inlay(mesh, vest, stripe):
    bu.garment_inlay(mesh, [(-.165,-.035,1.0,1.42,vest,False),(.035,.165,1.0,1.42,vest,False),
        (-.165,.165,1.0,1.42,vest,True),(-.165,-.035,1.12,1.16,stripe,False),
        (.035,.165,1.12,1.16,stripe,False),(-.165,.165,1.12,1.16,stripe,True)])


def swimsuit_hip_fit(mesh, skin):
    # The adopted GLB has a .082/.100 top leg ring; the archived generator
    # still says .072/.083. Preserve that adopted geometry as a named part.
    for i, (x, y, z) in enumerate(mesh.v):
        if abs(z-.94) < 1e-7:
            center = .095 if x > 0 else -.095
            mesh.v[i] = (center+(x-center)*(.082/.072), y*(.100/.083), z)
    # Adopted cap faces are skin-coloured, unlike the archived source's blue cap.
    for i, face in enumerate(mesh.f):
        if all(abs(mesh.v[j][2]-.94) < 1e-7 for j in face):
            mesh.c[i] = skin


PARTS.update({
    'outer.layer.v1': (lambda mesh, model: None, ('cast.male.v1',), {}, {'model': OUTERS}),
    'legacy.top.v1': (lambda mesh, model: None, ('cast.male.v1',), {}, {'model': ('TShirt','Shirt')}),
    'legacy.pants.v1': (lambda mesh, model: None, ('cast.male.v1',), {}, {'model': ('Jeans','WideJeans','Trousers')}),
    'legacy.accessories.v1': (lambda mesh, model: None, ('cast.male.v1',), {}, {'model': ('Sunglasses','Cap','Tie')}),
    'pool.swimsuit-hip-fit.v1': (swimsuit_hip_fit, ('pool.swimsuit.v1',), {'skin': ('cell',)}, {}),
    'cast.head.female.v1': (bc.female_head, ('cast.female.v1',), {'skin': ('cell',)}, {}),
    'cast.face.female.v1': (bc.female_face, ('cast.female.v1',), {}, {}),
    'cast.hands.female.v1': (female_hands, ('cast.female.v1',), {'skin': ('cell',)}, {}),
    'cast.female-outfit.v1': (bc.female_outfit, ('cast.female.v1',), {}, {}),
    'cast.dress-legs.v1': (lambda m, color, skin: bc.legs(m, color, skin, True), ('cast.female.v1',), {'color': ('cell',), 'skin': ('cell',)}, {}),
    'cast.glasses.v1': (bc.glasses, CAST, {}, {}),
    'cast.hat.v1': (bc.hat, CAST, {}, {'kind': ('guard', 'wide')}),
    'uniform.delivery-inlay.v1': (delivery_inlay, CAST, {'vest': ('cell',), 'stripe': ('cell',)}, {}),
    'uniform.short-sleeves.v1': (bu.short_sleeves, CAST, {'skin': ('cell',)}, {'cut': (.474, .28)}),
    'uniform.feet.v1': (bu.recolor_feet, CAST, {'c': ('cell',)}, {}),
    'uniform.big-build.v1': (bu.big_build, CAST, {}, {}),
    'uniform.tee.v1': (bu.tee_front, CAST, {'c': ('cell',)}, {'female': (False, True)}),
    'uniform.bald.v1': (bu.bald, CAST, {'skin': ('cell',)}, {}),
    'uniform.slick.v1': (bu.slick, CAST, {'c': ('cell',)}, {}),
    'uniform.spiky.v1': (bu.spiky, CAST, {'c': ('cell',)}, {}),
    'response.torso.v1': (bu.response_torso, CAST, {'c': ('cell',)}, {}),
    'response.legs.v1': (bu.response_legs, CAST, {'c': ('cell',)}, {}),
})
# Keep role-specific decoration intact until it can be split without geometry changes.
for role in ('chef','cleaner','delivery','fisher','bodyguard','sommelier','driver','beachbar',
             'pilot','masseuse','underwear','underwear_dark','underwear_female',
             'wine_merchant','lawyer','investor','response'):
    PARTS['uniform.dress.'+role+'.v1'] = (partial(bu.dress, role), CAST, {}, {})

# New combinations use the body families the original fitted parts were built for.
for name in ('cast.head.male.v1','cast.face.male.v1','uniform.collar.v1','uniform.camera.v1',
             'photographer.vest-inlay.v1','uniform.delivery-inlay.v1','uniform.big-build.v1',
             'uniform.bald.v1','uniform.slick.v1','response.torso.v1','response.legs.v1'):
    fn, _, colors, params = PARTS[name]
    PARTS[name] = (fn, ('cast.male.v1',), colors, params)
for role in ('chef','cleaner','delivery','fisher','bodyguard','sommelier','driver','beachbar',
             'pilot','masseuse','underwear','underwear_dark','underwear_female',
             'wine_merchant','lawyer','investor','response'):
    name='uniform.dress.'+role+'.v1';fn, _, colors, params=PARTS[name]
    PARTS[name]=(fn, ('cast.female.v1',) if role in ('investor','underwear_female') else ('cast.male.v1',), colors, params)
for name in ('uniform.spiky.v1','uniform.tee.v1'):
    fn, _, colors, params=PARTS[name];PARTS[name]=(fn, ('cast.female.v1',), colors, params)
PARTS['uniform.boots.v1']=(bu.boots, ('cast.male.v1',), {'c': ('cell',)}, {})

BEFORE_OBJECTS = {
    'cast.lower-head.v1': lower_head,
    'dj.customize.v1': bu.dj_customize,
    'dj.experiment-customize.v1': bu.dj_experiment_customize,
    'dj.cast-customize.v1': bu.dj_cast_customize,
}


def validate(recipe):
    if recipe['schemaVersion'] != 1:
        raise ValueError('Unknown recipe version')
    if recipe['assetMode'] == 'fixed':
        sources = {'wardrobe': '../player-wardrobe/models/player_wardrobe.glb',
                   **{id: '../protagonist-studies-20261028/models/'+id+'.glb' for id in ('architect','operative','veteran','agent47')}}
        if recipe['source'] != sources.get(recipe['id']) or not re.fullmatch(r'[0-9a-f]{64}', recipe['sha256']):
            raise ValueError('Invalid fixed asset reference')
        return
    if recipe['assetMode'] == 'alias':
        if recipe['id'] != 'guest_male' or recipe['aliasOf'] != 'wardrobe':
            raise ValueError('Unknown alias')
        return
    if recipe['schemaVersion'] != 1 or recipe['assetMode'] != 'generated':
        raise ValueError('Only generated v1 recipes are supported')
    if recipe['rig'] != 'cast.shared22.v1':
        raise ValueError('Unknown rig')
    if not re.fullmatch(r'[a-z][a-z0-9_]*', recipe['id']) or recipe['id'] in ('wardrobe','architect','operative','veteran','agent47','guest_male'):
        raise ValueError('Invalid output id')
    if recipe['body']['profile'] not in CAST + POOL:
        raise ValueError('Unknown body profile')
    if recipe['body'].get('parameters'):
        raise ValueError('Pilot body profiles have no free parameters')
    palette = recipe['palette']
    if palette['id'] not in ('cast.palette.v1', 'uniform.palette.v1', 'pool.palette.v1'):
        raise ValueError('Unknown palette')
    for cell, value in palette.get('overrides', {}).items():
        if cell not in {str(i) for i in range(16)} or not re.fullmatch(r'[0-9a-f]{6}', value):
            raise ValueError('Invalid palette override')
    if palette.get('imageName', 'palette') not in ('palette', 'CLEAN_HANDS_Palette_256'):
        raise ValueError('Unknown palette image name')
    if palette.get('overrides') and palette['id'] != 'uniform.palette.v1':
        raise ValueError('Overrides require uniform palette')
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
    operations = recipe['specialOperations']
    before = [op for op in operations if op.get('phase') == 'beforeObjects']
    if any(set(op) != {'operation', 'phase'} or op['operation'] not in BEFORE_OBJECTS for op in before):
        raise ValueError('Unknown pre-object operation')
    if operations != before + [
        {'operation': 'cast.face-morphs.v1', 'phase': 'afterObjects', 'mesh': 'Face'},
        {'operation': 'skin-roots.normalize.v1', 'phase': 'afterExport'}]:
        raise ValueError('Unknown/incorrect operation order')


def build(path):
    recipe = json.loads(path.read_text(encoding='utf-8'))
    validate(recipe)
    if recipe['assetMode'] == 'alias':
        return build(ASSETS / 'recipes' / (recipe['aliasOf']+'.json'))
    if recipe['assetMode'] == 'fixed':
        source = ASSETS.parents[1] / recipe['source']
        if hashlib.sha256(source.read_bytes()).hexdigest() != recipe['sha256']:
            raise ValueError('Fixed asset SHA-256 mismatch')
        result = {'id': recipe['id'], 'assetMode': 'fixed', 'source': recipe['source'], 'sha256': recipe['sha256']}
        print('FIXED_ASSET '+json.dumps(result), flush=True)
        return result
    # Importing the copied helpers must never reach outside this source folder.
    for module in (bc, bp, bu):
        if Path(module.__file__).resolve().parent != HERE:
            raise RuntimeError('Unexpected external helper module')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    family = bp if recipe['body']['profile'] in POOL else bc
    palettes = {'cast.palette.v1': bc.palette, 'uniform.palette.v1': bu.palette, 'pool.palette.v1': bp.palette}
    palette_id = recipe['palette']['id']
    mat = palettes[palette_id]({int(k): v for k, v in recipe['palette'].get('overrides', {}).items()}) if palette_id == 'uniform.palette.v1' else palettes[palette_id]()
    if palette_id in ('cast.palette.v1', 'pool.palette.v1'):
        next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').name = 'palette'
    if 'imageName' in recipe['palette']:
        next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').name = recipe['palette']['imageName']
    if recipe['body']['profile'] in VARIANTS:
        import build_body_variants as variant
        variant.active = VARIANTS[recipe['body']['profile']]
    rig = family.rig_create()
    meshes = {name: family.Mesh(name) for name in recipe['output']['meshOrder']}
    for p in recipe['parts']:
        fn = PARTS[p['part']][0]
        fn(meshes[p['mesh']], **p['colors'], **p['parameters'])
    for op in recipe['specialOperations']:
        if op['phase'] == 'beforeObjects':
            BEFORE_OBJECTS[op['operation']](meshes)
    new_mode = path.parent.resolve() == (ASSETS/'recipes'/'new').resolve()
    if new_mode and not re.fullmatch(r'new_[a-f0-9]{32}', recipe['id']):
        raise ValueError('New recipes require a server-assigned id')
    # Live previews in the outfit lab (2026-11-12): built like a new character, kept apart under preview/.
    preview_mode = path.parent.resolve() == (ASSETS/'recipes'/'preview').resolve()
    if preview_mode and not re.fullmatch(r'preview_[a-f0-9]{32}', recipe['id']):
        raise ValueError('Preview recipes require a server-assigned id')
    folder = 'new' if new_mode else 'preview' if preview_mode else ''
    new_mode = new_mode or preview_mode
    objects = []
    for name, mesh in meshes.items():
        if mesh.v:
            ob = mesh.object(rig, mat)
            objects.append(ob)
            if name == 'Face':
                family.morphs(ob, mesh)
    if new_mode:
        import new_character_effects as effects
        for part in recipe['parts']:
            if part['part'] == 'outer.layer.v1' or part['part'].startswith('legacy.'):
                objects.append(effects.outer(rig, part['parameters']['model'], ASSETS.parents[0]/'outfits'/'agent07-jacket'/'catalog.blend', part['part']=='outer.layer.v1'))
        effects.layer_inner(objects, recipe)
        effects.recolor(objects, recipe)
        stamp = effects.mark(objects, rig, recipe.get('surfaceMark'), ASSETS/'models'/'new'/recipe['id'])
        if stamp is not None:
            objects.append(stamp)
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
    dest = ASSETS / 'models' / folder / recipe['id'] / (recipe['id'] + '.glb')
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

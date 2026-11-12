"""Export the actual versioned Blender registry for the editor and server."""
from pathlib import Path
import sys
import json
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from build_recipe import PARTS, CAST, POOL

def slot(name,mesh=''):
    if name.startswith('legacy.'):return name.split('.')[1]
    if 'head.' in name:return 'head'
    if 'face.' in name:return 'face'
    if '.hair.' in name or name.startswith(('uniform.bald','uniform.slick','uniform.spiky')):return 'hair'
    if 'outer.' in name:return 'outer'
    if 'inlay' in name or 'chest-details' in name or 'details.' in name:return 'patterns'
    if 'feet' in name or 'boots' in name:return 'shoes'
    if '.legs.' in name or 'dress-legs' in name:return 'pants'
    if '.torso.' in name:return 'top'
    if any(x in name for x in ('hands','female-outfit','short-sleeves','hip-fit','big-build','tee.')):return 'structure'
    return 'accessories'

if __name__=='__main__':
    parts=[]
    for id,(_,bodies,colors,parameters) in PARTS.items():
        parts.append({'id':id,'label':id,'bodies':bodies,'colors':list(colors),
                      'parameters':parameters,'slot':slot(id)})
    dest=HERE.parent/'catalog'/'catalog.json';dest.parent.mkdir(exist_ok=True)
    dest.write_bytes((json.dumps({'version':1,'bodies':CAST+POOL,'parts':parts},indent=2)+'\n').encode())

// Hand-held item models (2026-11-05): the GLBs from assets/items (embedded in item-data.ts). Shared by the game
// (detection-view.ts: in hand and on the floor) and the labs. Until they are loaded, or for an item with no GLB, the
// caller falls back to its simple stand-in shapes.
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ITEM_MODELS} from './item-data.ts';
import {PROP_MODELS} from './prop-data.ts';
const templates=new Map<string,T.Object3D>();
let loading:Promise<void>|null=null;
export function loadItemModels(){
 return loading??=(async()=>{const loader=new GLTFLoader();
  // Gesture props (assets/props: phone, glass, radio, desk) load with them and are made the same way.
  for(const [id,b64] of [...Object.entries(ITEM_MODELS),...Object.entries(PROP_MODELS)]){try{templates.set(id,(await loader.parseAsync(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer,'')).scene);}catch(e){console.error('item model failed',id,e);}}})();
}
export const hasItemModel=(id:string)=>templates.has(id);
// A fresh copy, grip at its origin, handle along +Z (assets/items/source/build_items.py).
export function itemModel(id:string):T.Object3D|null{
 const t=templates.get(id);if(!t)return null;
 const o=t.clone(true);o.name='item-'+id;o.traverse(c=>{if((c as T.Mesh).isMesh){c.castShadow=true;c.receiveShadow=true;c.userData.carried=true;}});return o;
}
// Lying on the floor: a group whose origin is on the floor, the item resting on its lowest point.
export function onFloor(o:T.Object3D){const g=new T.Group();g.add(o);o.updateMatrixWorld(true);const b=new T.Box3().setFromObject(o);o.position.y-=b.min.y;return g;}

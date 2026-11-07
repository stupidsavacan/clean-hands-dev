import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
type Entry={mesh:T.Object3D;in:number[]};
// Only immutable, opaque scenery with the same material, parent, shadow flags and
// section membership may share a draw. Fadeable objects and interactive models stay separate.
export function batchScenery(entries:Entry[],materials:Set<T.Material>){
 const groups=new Map<string,Entry[]>(),removed=new Set<T.Object3D>(),added:Entry[]=[];
 for(const entry of entries){const m=entry.mesh as T.Mesh;if(!m.isMesh||Array.isArray(m.material)||!materials.has(m.material)||m.material.transparent||m.children.length||!m.parent)continue;
  const key=[m.parent.uuid,m.material.uuid,m.castShadow,m.receiveShadow,entry.in.join(','),Object.keys(m.geometry.attributes).sort().join(',')].join('/');
  const list=groups.get(key)??[];list.push(entry);groups.set(key,list);
 }
 for(const list of groups.values()){if(list.length<2)continue;const first=list[0].mesh as T.Mesh,geos=list.map(e=>{const m=e.mesh as T.Mesh;m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);}),geometry=mergeGeometries(geos);geos.forEach(g=>g.dispose());if(!geometry)continue;
  const batch=new T.Mesh(geometry,first.material);batch.name='static-scenery-batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.userData.sources=list.map(e=>e.mesh.name);first.parent!.add(batch);
  for(const e of list){removed.add(e.mesh);e.mesh.removeFromParent();(e.mesh as T.Mesh).geometry.dispose();}added.push({mesh:batch,in:list[0].in});
 }
 return [...entries.filter(e=>!removed.has(e.mesh)),...added];
}

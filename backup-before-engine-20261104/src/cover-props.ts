import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {COMBAT_MODELS} from './combat-data.ts';
import type {Block} from './world.ts';
/** The gunfight cover (assets/m55-combat) drawn in place of the plain collision boxes: cars, crates, planters and counters.
 * Collision and sight still use the blockers in hotel.json; the models were built to the same footprints.
 * Each model is one InstancedMesh per floor, so all of them cost a handful of draws. */
export type CoverPlacement={model:string;x:number;y:number;z:number;rotation:number;scale:[number,number,number];floor:number};
const near=(a:number,b:number)=>Math.abs(a-b)<.05;
const CARS=['car_sedan_blue','car_sedan_white','car_sedan_grey'];
/** Which blockers become which model; anything else stays a box. Counters are rows of the 2 m module, stretched to fit. */
export function coverPlacements(blockers:Block[]):CoverPlacement[]{const out:CoverPlacement[]=[];let car=0;
 for(const b of blockers){const floor=b.floor??0,y=b.y,turned=b.d>b.w,long=Math.max(b.w,b.d),short=Math.min(b.w,b.d),rotation=turned?Math.PI/2:0;
  if(b.id.startsWith('car'))out.push({model:CARS[car++%CARS.length],x:b.x,y,z:b.z,rotation:b.w>b.d?Math.PI/2:0,scale:[1,1,1],floor});
  else if(b.id.startsWith('crate')&&near(b.w,1.2)&&near(b.d,1.2)&&near(b.h,1.2))out.push({model:'crate',x:b.x,y,z:b.z,rotation:0,scale:[1,1,1],floor});
  else if(b.id.startsWith('planter')&&near(short,1.2)&&(near(long,1.2)||near(long,3)))out.push({model:near(long,3)?'planter_3x1':'planter_1x1',x:b.x,y,z:b.z,rotation,scale:[1,1,1],floor});
  else if(b.id.startsWith('counter')){const n=Math.max(1,Math.round(long/2)),step=long/n;
   for(let i=0;i<n;i++){const along=-long/2+step*(i+.5);out.push({model:'counter_bar_2m',x:b.x+(turned?0:along),y,z:b.z+(turned?along:0),rotation,scale:[step/2,b.h/1.1,short],floor});}}}
 return out;}
/** The blocker ids drawn by a model (the world builder skips their boxes). */
export function coveredIds(blockers:Block[]){const ids=new Set<string>();for(const b of blockers){const one=coverPlacements([b]);if(one.length)ids.add(b.id);}return ids;}
export async function buildCover(blockers:Block[]):Promise<{floor:number;mesh:T.InstancedMesh}[]>{
 const loader=new GLTFLoader(),places=coverPlacements(blockers),out:{floor:number;mesh:T.InstancedMesh}[]=[],m=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0);
 for(const model of [...new Set(places.map(p=>p.model))]){const b64=COMBAT_MODELS[model];if(!b64)continue;
  const scene=(await loader.parseAsync(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer,'')).scene;let source:T.Mesh|undefined;scene.traverse(o=>{if((o as T.Mesh).isMesh&&!source)source=o as T.Mesh;});if(!source)continue;
  scene.updateMatrixWorld(true);const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
  for(const floor of [...new Set(places.filter(p=>p.model===model).map(p=>p.floor))]){const list=places.filter(p=>p.model===model&&p.floor===floor),mesh=new T.InstancedMesh(geometry,source.material as T.Material,list.length);
   list.forEach((p,i)=>mesh.setMatrixAt(i,m.compose(new T.Vector3(p.x,p.y,p.z),q.setFromAxisAngle(up,p.rotation),new T.Vector3(...p.scale))));
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='cover-'+model;out.push({floor,mesh});}}
 return out;}

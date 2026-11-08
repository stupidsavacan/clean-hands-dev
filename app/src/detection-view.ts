import * as T from 'three';
import {isCase} from './melee.ts';
import type {DetectionSystem} from './detection.ts';
import type {Rig} from './rig.ts';
import {plateY,type Level} from './world.ts';
import {itemModel,onFloor} from './item-models.ts';
import {gripOf} from './hold-pose.ts';
/** What M5.6 draws: each camera's view as a blue fan on the floor (gone once it is shot), the things lying around and
 * the one in the agent's hand, and a ring at every BLEND_ spot the current outfit can use. */
const ITEM_COLOR:Record<string,string>={wrench:'#8d969c',bottle:'#2f5a3c',mop:'#c9b48c',camera:'#25282c',tray:'#d9dcd6'};
// The item's GLB (item-models.ts) when it is loaded; the simple stand-in shapes below otherwise.
export function itemMesh(item:string){return itemModel(item)??standIn(item);}
// On the floor: GLBs lie on their side resting on the lowest point; the stand-ins were drawn standing on y=0.
export function floorItem(item:string){const o=itemModel(item);return o?onFloor(o):standIn(item);}
function standIn(item:string){const g=new T.Group(),m=(c:string)=>new T.MeshStandardMaterial({color:c,roughness:.7});
 if(item==='bottle'){const b=new T.Mesh(new T.CylinderGeometry(.04,.045,.24,8),m(ITEM_COLOR.bottle));b.position.y=.12;const n=new T.Mesh(new T.CylinderGeometry(.015,.02,.09,6),m(ITEM_COLOR.bottle));n.position.y=.28;g.add(b,n);}
 else if(item==='mop'){const s=new T.Mesh(new T.CylinderGeometry(.015,.015,1.2,6),m(ITEM_COLOR.mop));s.position.y=.6;const h=new T.Mesh(new T.BoxGeometry(.3,.06,.12),m('#e7e3d6'));h.position.y=.03;g.add(s,h);}
 else if(item==='camera'){const b=new T.Mesh(new T.BoxGeometry(.14,.09,.07),m(ITEM_COLOR.camera));b.position.y=.045;const l=new T.Mesh(new T.CylinderGeometry(.03,.03,.06,10),m('#4fb8c9'));l.rotation.x=Math.PI/2;l.position.set(0,.045,.06);g.add(b,l);}
 else{const s=new T.Mesh(new T.BoxGeometry(.03,.02,.26),m(ITEM_COLOR[item]??'#8d969c'));s.position.y=.012;const j=new T.Mesh(new T.TorusGeometry(.035,.012,4,8,Math.PI*1.4),m(ITEM_COLOR[item]??'#8d969c'));j.rotation.x=Math.PI/2;j.position.set(0,.012,.14);g.add(s,j);}
 g.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=true;});g.name='item-'+item;return g;}
// How a carried thing sits in the right hand (shared with the labs so they check what the game shows).
// Hand bone axes on this rig: +Y runs to the fingers, -Z is the palm side, -X the thumb side (Item Lab handAxes).
// The item's grip is its origin with the handle on +Z (assets/items/source/build_items.py).
const FIST=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,-1),new T.Vector3(0,-1,0),new T.Vector3(-1,0,0)));
export function inHand(hand:T.Object3D,o:T.Object3D,item=''){o.scale.setScalar(1/Math.max(.001,hand.getWorldScale(new T.Vector3()).x));
 if(gripOf(item)==='fist'){o.quaternion.copy(FIST);o.position.set(0,.075,-.025);}else{o.rotation.set(-Math.PI/2,0,0);o.position.set(0,.06,0);}
 hand.add(o);return o;}
// A sword on the back: the grip over one shoulder, the blade down across the back to the other hip, the edge outward;
// the second one crosses it. Placed in the body's frame, then kept on the chest bone so it moves with the body.
// How far a case lid opens (radians, about its hinge; the briefcase and the toolbox are built alike).
export const CASE_OPEN=1.6;
export const BACK_SLOTS=[{grip:[-.20,1.64,-.17],tip:[.36,.86,-.20]},{grip:[.20,1.64,-.19],tip:[-.36,.86,-.22]}];
export function onBack(o:T.Object3D,avatar:T.Object3D,chest:T.Object3D,slot:number){const s=BACK_SLOTS[slot%2];avatar.updateMatrixWorld(true);
 const grip=avatar.localToWorld(new T.Vector3(...s.grip)),tip=avatar.localToWorld(new T.Vector3(...s.tip)),z=tip.clone().sub(grip).normalize();
 const out=avatar.localToWorld(new T.Vector3(0,0,-1)).sub(avatar.getWorldPosition(new T.Vector3())).normalize(),x=new T.Vector3().crossVectors(out,z).normalize(),y=new T.Vector3().crossVectors(z,x);
 o.matrix.makeBasis(x,y,z).setPosition(grip);o.matrix.decompose(o.position,o.quaternion,o.scale);o.scale.setScalar(avatar.getWorldScale(new T.Vector3()).x);avatar.parent?.add(o);o.updateMatrixWorld(true);chest.attach(o);}
export class DetectionView{
 readonly root=new T.Group();private fans=new Map<string,T.Mesh>();private floor=new Map<number,T.Object3D>();private rings:{spot:string;mesh:T.Mesh;disguises:string[]}[]=[];private held?:T.Object3D;private heldId='';private broken=new Set<string>();
 constructor(scene:T.Scene,det:DetectionSystem,level:Level,groupOf:(floor:number)=>T.Object3D){scene.add(this.root);this.root.name='detection';
  for(const c of det.cameras){const pos:number[]=[],steps=14,half=c.fov/2*Math.PI/180,y=plateY(level,c.floor)+.035;
   for(let i=0;i<steps;i++){const a=c.heading-half+2*half*i/steps,b=c.heading-half+2*half*(i+1)/steps;pos.push(c.x,y,c.z,c.x+Math.sin(a)*c.range,y,c.z+Math.cos(a)*c.range,c.x+Math.sin(b)*c.range,y,c.z+Math.cos(b)*c.range);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));const fan=new T.Mesh(g,new T.MeshBasicMaterial({color:'#5b8fd6',transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide}));fan.name='camera-view-'+c.id;fan.renderOrder=2;groupOf(c.floor).add(fan);this.fans.set(c.id,fan);}
  for(const b of det.data.blend){const r=new T.Mesh(new T.RingGeometry(.42,.5,24),new T.MeshBasicMaterial({color:'#9fe0c8',transparent:true,opacity:.7,depthWrite:false}));r.rotation.x=-Math.PI/2;r.position.set(b.x,plateY(level,b.floor)+.04,b.z);r.visible=false;groupOf(b.floor).add(r);this.rings.push({spot:b.id,mesh:r,disguises:b.disguises});}}
 reset(){for(const o of this.backs)o.removeFromParent();this.backs=[];for(const o of this.floor.values())o.removeFromParent();this.floor.clear();for(const f of this.fans.values())f.visible=true;this.broken.clear();this.held?.removeFromParent();this.held=undefined;this.heldId='';}
 // Swords on the back (2026-11-06): their own models, apart from the one in hand.
 private backs:T.Object3D[]=[];
 render(det:DetectionSystem,disguise:string,scene:T.Scene,rig:Rig|undefined,now:number,avatar?:T.Object3D){
  for(const [id,f] of this.fans){const dead=det.destroyed.has(id);f.visible=!dead;if(dead&&!this.broken.has(id)){this.broken.add(id);const cam=scene.getObjectByName(id);if(cam){cam.rotation.x=.9;cam.updateMatrix();cam.traverse(o=>{const m=(o as T.Mesh).material as T.MeshStandardMaterial|undefined;if(m?.emissive){m.emissive.set('#000');m.color.set('#3a2a2a');}});}}}
  const keys=new Set(det.floor.map(f=>f.key));for(const [k,o] of this.floor)if(!keys.has(k)){o.removeFromParent();this.floor.delete(k);}
  for(const f of det.floor){if(this.floor.has(f.key))continue;const o=floorItem(f.item);o.position.set(f.pos.x,f.pos.y,f.pos.z);o.rotation.y=(f.pos.x*1000+f.pos.z)%6;this.root.add(o);this.floor.set(f.key,o);}
  // The thing in hand rides on the right hand bone.
  // Re-attached when the body changes too (a change of clothes swaps the agent's model and its bones, 2026-11-06).
  const hand=rig?.joints.get('handr')?.bone;if(this.heldId!==det.held||this.held&&this.held.parent!==hand){this.held?.removeFromParent();this.held=undefined;this.heldId=det.held;if(det.held&&hand){this.held=itemMesh(det.held);inHand(hand,this.held,det.held);}}
  // A case lid (its LID node, turning on the hinge) swings open while something goes in or comes out.
  if(this.held&&isCase(det.held)){const lid=this.held.getObjectByName('LID');if(lid){const s=(now-det.caseOpenedAt)/1000,e=(a:number,b:number)=>{const u=Math.min(1,Math.max(0,(s-a)/(b-a)));return u*u*(3-2*u);};lid.rotation.z=-CASE_OPEN*e(0,.25)*(1-e(.65,.9));}}
  const chest=rig?.joints.get('chest')?.bone;
  if(this.backs.some(o=>o.parent!==chest)){for(const o of this.backs)o.removeFromParent();this.backs=[];}
  while(this.backs.length>det.back.length)this.backs.pop()!.removeFromParent();
  while(chest&&avatar&&this.backs.length<det.back.length){const o=itemMesh(det.back[this.backs.length]);onBack(o,avatar,chest,this.backs.length);this.backs.push(o);}
  const pulse=.45+.3*Math.sin(now/300);for(const r of this.rings){r.mesh.visible=r.disguises.includes(disguise)&&det.blend?.id!==r.spot;(r.mesh.material as T.MeshBasicMaterial).opacity=pulse;}}
}

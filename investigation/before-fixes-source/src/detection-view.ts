import * as T from 'three';
import type {DetectionSystem} from './detection';
import type {Rig} from './rig';
import {plateY,type Level} from './world';
/** What M5.6 draws: each camera's view as a blue fan on the floor (gone once it is shot), the things lying around and
 * the one in the agent's hand, and a ring at every BLEND_ spot the current outfit can use. */
const ITEM_COLOR:Record<string,string>={wrench:'#8d969c',bottle:'#2f5a3c',mop:'#c9b48c',camera:'#25282c',tray:'#d9dcd6'};
function itemMesh(item:string){const g=new T.Group(),m=(c:string)=>new T.MeshStandardMaterial({color:c,roughness:.7});
 if(item==='bottle'){const b=new T.Mesh(new T.CylinderGeometry(.04,.045,.24,8),m(ITEM_COLOR.bottle));b.position.y=.12;const n=new T.Mesh(new T.CylinderGeometry(.015,.02,.09,6),m(ITEM_COLOR.bottle));n.position.y=.28;g.add(b,n);}
 else if(item==='mop'){const s=new T.Mesh(new T.CylinderGeometry(.015,.015,1.2,6),m(ITEM_COLOR.mop));s.position.y=.6;const h=new T.Mesh(new T.BoxGeometry(.3,.06,.12),m('#e7e3d6'));h.position.y=.03;g.add(s,h);}
 else if(item==='camera'){const b=new T.Mesh(new T.BoxGeometry(.14,.09,.07),m(ITEM_COLOR.camera));b.position.y=.045;const l=new T.Mesh(new T.CylinderGeometry(.03,.03,.06,10),m('#4fb8c9'));l.rotation.x=Math.PI/2;l.position.set(0,.045,.06);g.add(b,l);}
 else{const s=new T.Mesh(new T.BoxGeometry(.03,.02,.26),m(ITEM_COLOR[item]??'#8d969c'));s.position.y=.012;const j=new T.Mesh(new T.TorusGeometry(.035,.012,4,8,Math.PI*1.4),m(ITEM_COLOR[item]??'#8d969c'));j.rotation.x=Math.PI/2;j.position.set(0,.012,.14);g.add(s,j);}
 g.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=true;});g.name='item-'+item;return g;}
export class DetectionView{
 readonly root=new T.Group();private fans=new Map<string,T.Mesh>();private floor=new Map<number,T.Object3D>();private rings:{spot:string;mesh:T.Mesh;disguises:string[]}[]=[];private held?:T.Object3D;private heldId='';private broken=new Set<string>();
 constructor(scene:T.Scene,det:DetectionSystem,level:Level,groupOf:(floor:number)=>T.Object3D){scene.add(this.root);this.root.name='detection';
  for(const c of det.cameras){const pos:number[]=[],steps=14,half=c.fov/2*Math.PI/180,y=plateY(level,c.floor)+.035;
   for(let i=0;i<steps;i++){const a=c.heading-half+2*half*i/steps,b=c.heading-half+2*half*(i+1)/steps;pos.push(c.x,y,c.z,c.x+Math.sin(a)*c.range,y,c.z+Math.cos(a)*c.range,c.x+Math.sin(b)*c.range,y,c.z+Math.cos(b)*c.range);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));const fan=new T.Mesh(g,new T.MeshBasicMaterial({color:'#5b8fd6',transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide}));fan.name='camera-view-'+c.id;fan.renderOrder=2;groupOf(c.floor).add(fan);this.fans.set(c.id,fan);}
  for(const b of det.data.blend){const r=new T.Mesh(new T.RingGeometry(.42,.5,24),new T.MeshBasicMaterial({color:'#9fe0c8',transparent:true,opacity:.7,depthWrite:false}));r.rotation.x=-Math.PI/2;r.position.set(b.x,plateY(level,b.floor)+.04,b.z);r.visible=false;groupOf(b.floor).add(r);this.rings.push({spot:b.id,mesh:r,disguises:b.disguises});}}
 reset(){for(const o of this.floor.values())o.removeFromParent();this.floor.clear();for(const f of this.fans.values())f.visible=true;this.broken.clear();this.held?.removeFromParent();this.held=undefined;this.heldId='';}
 render(det:DetectionSystem,disguise:string,scene:T.Scene,rig:Rig|undefined,now:number){
  for(const [id,f] of this.fans){const dead=det.destroyed.has(id);f.visible=!dead;if(dead&&!this.broken.has(id)){this.broken.add(id);const cam=scene.getObjectByName(id);if(cam){cam.rotation.x=.9;cam.updateMatrix();cam.traverse(o=>{const m=(o as T.Mesh).material as T.MeshStandardMaterial|undefined;if(m?.emissive){m.emissive.set('#000');m.color.set('#3a2a2a');}});}}}
  const keys=new Set(det.floor.map(f=>f.pos.x*1000+f.pos.z));for(const [k,o] of this.floor)if(!keys.has(k)){o.removeFromParent();this.floor.delete(k);}
  for(const f of det.floor){const k=f.pos.x*1000+f.pos.z;if(this.floor.has(k))continue;const o=itemMesh(f.item);o.position.set(f.pos.x,f.pos.y,f.pos.z);o.rotation.y=k%6;this.root.add(o);this.floor.set(k,o);}
  // The thing in hand rides on the right hand bone.
  if(this.heldId!==det.held){this.held?.removeFromParent();this.held=undefined;this.heldId=det.held;const hand=rig?.joints.get('handr')?.bone;if(det.held&&hand){this.held=itemMesh(det.held);this.held.scale.setScalar(1/Math.max(.001,hand.getWorldScale(new T.Vector3()).x));this.held.rotation.set(-Math.PI/2,0,0);this.held.position.set(0,.06,0);hand.add(this.held);}}
  const pulse=.45+.3*Math.sin(now/300);for(const r of this.rings){r.mesh.visible=r.disguises.includes(disguise)&&det.blend?.id!==r.spot;(r.mesh.material as T.MeshBasicMaterial).opacity=pulse;}}
}

import * as T from 'three';
import {COIN_GRASP,COIN_STOW,type CoinPickup} from './coin-pickup.ts';
import {twoBone} from './gestures.ts';
import {sampleCoinPickupMotion} from './motion.ts';
import {applyMotion,bonePoint} from './motion-runtime.ts';
import type {Rig} from './rig.ts';
import type {NpcView} from './npc-view.ts';

type Actor={rig:Rig;model:T.Object3D;group:T.Object3D};
const GRIP_LENGTH=.098;

export function coinMesh(){
 const mesh=new T.Mesh(new T.CylinderGeometry(.05,.05,.012,10),new T.MeshStandardMaterial({color:'#e2c25a',metalness:.7,roughness:.35}));
 mesh.castShadow=true;
 return mesh;
}

export function poseCoinPickup({rig,model,group}:Actor,{at,progress:t}:CoinPickup,ground:(x:number,z:number,y:number)=>number){
 const pose=sampleCoinPickupMotion(t);
 const settle=T.MathUtils.smoothstep(t,0,.18)*(1-T.MathUtils.smoothstep(t,.89,1));
 const near=group.worldToLocal(new T.Vector3(at.x,at.y,at.z));
 const stoop=T.MathUtils.smoothstep(t,0,.39)*(1-T.MathUtils.smoothstep(t,.49,.78));
 pose.root.z+=(near.z-.55)*.64*stoop;
 applyMotion(rig,model,pose);
 const heading=group.getWorldQuaternion(new T.Quaternion());
 for(const [side,x,z] of [['l',.095,.12],['r',-.095,-.09]] as const){
  const foot=rig.joints.get('foot'+side);
  if(!foot?.bone.parent)continue;
  const at=group.localToWorld(new T.Vector3(x,0,z*settle));
  at.y=ground(at.x,at.z,at.y)+foot.bone.getWorldScale(new T.Vector3()).y*.12;
  twoBone(rig,side,at,group.localToWorld(new T.Vector3(x*2.6,.46,.65)),1,true);
  foot.bone.quaternion.copy(foot.bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(heading).multiply(foot.w0));
 }

 const weight=T.MathUtils.smoothstep(t,.11,COIN_GRASP)*(1-T.MathUtils.smoothstep(t,.76,1));
 if(weight===0)return;
 const lift=T.MathUtils.smoothstep(t,COIN_GRASP,.76);
 const wrist=new T.Vector3(at.x,at.y+GRIP_LENGTH,at.z)
  .lerp(group.localToWorld(new T.Vector3(-.23,.84,.07)),lift);
 twoBone(rig,'r',wrist,group.localToWorld(new T.Vector3(-.64,.6,-.16)),weight);
 const hand=rig.joints.get('handr')?.bone;
 if(hand?.parent){
  const q=hand.getWorldQuaternion(new T.Quaternion());
  const turn=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0).applyQuaternion(q),new T.Vector3(0,-1,0));
  q.slerp(turn.multiply(q.clone()),weight*(1-lift));
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));
 }
}

export function placePickupCoin(mesh:T.Mesh,rig:Rig,{at,progress}:CoinPickup){
 mesh.visible=progress<COIN_STOW;
 const hand=progress>=COIN_GRASP&&bonePoint(rig,'handr',new T.Vector3(0,GRIP_LENGTH,0));
 const point=hand||new T.Vector3(at.x,at.y,at.z);
 mesh.position.copy(mesh.parent?mesh.parent.worldToLocal(point):point);
 mesh.rotation.z=Math.PI/3*T.MathUtils.smoothstep(progress,COIN_GRASP,.65);
}

export function placePickupWeapon(o:T.Object3D,rig:Rig,{at,progress}:CoinPickup,yaw:number){
 const hand=rig.joints.get('handr')?.bone;
 o.visible=progress<COIN_STOW;
 if(progress<COIN_GRASP||!hand){
  const point=new T.Vector3(at.x,at.y,at.z);
  o.position.copy(o.parent?o.parent.worldToLocal(point):point);
  o.rotation.set(0,yaw,Math.PI/2);
  return;
 }
 const grip=bonePoint(rig,'handr',new T.Vector3(0,GRIP_LENGTH,0))!;
 const rotation=hand.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0)));
 o.position.copy(o.parent?o.parent.worldToLocal(grip):grip);
 if(o.parent)rotation.premultiply(o.parent.getWorldQuaternion(new T.Quaternion()).invert());
 o.quaternion.copy(rotation);
 const anchor=o.getObjectByName('GRIP_R');
 if(anchor){
  const local=o.worldToLocal(anchor.getWorldPosition(new T.Vector3()));
  o.position.sub(local.multiply(o.scale).applyQuaternion(rotation));
 }
}

export function renderHeldCoins(pickups:Iterable<{npc:NpcView['npc'];mesh:T.Mesh}&CoinPickup>,views:readonly NpcView[]){
 for(const pickup of pickups){
  const view=views.find(v=>v.npc===pickup.npc);
  pickup.mesh.visible=!!view?.group.visible;
  if(view?.group.visible)placePickupCoin(pickup.mesh,view.rig,pickup);
 }
}

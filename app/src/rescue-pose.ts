import {Vector3,MathUtils} from 'three';
import {sampleRescueMotion} from './motion.ts';
import {applyMotion,bonePoint,groundBody,reach} from './motion-runtime.ts';
import type {Rig} from './rig.ts';
import type {Object3D} from 'three';

type Actor={rig:Rig;model:Object3D;group:Object3D};
const {smoothstep}=MathUtils;
// Both hands stay on the person from the first touch until they are up on one knee (sampleRescueMotion giver keys).
export const rescueTouch=(t:number)=>smoothstep(t,.10,.24)*(1-smoothstep(t,.84,.96));
// The person's palms on the floor while pressing up and on all fours.
export const rescuePalms=(t:number)=>smoothstep(t,.30,.42)*(1-smoothstep(t,.64,.76));

export function poseRescue(guard:Actor,body:Actor,t:number,ground:(x:number,z:number,y:number)=>number){
 for(const [a,role] of [[guard,'giver'],[body,'receiver']] as const){
  applyMotion(a.rig,a.model,sampleRescueMotion(role,t));
  const {x,y,z}=a.group.position;
  groundBody(a.model,ground(x,z,y));
 }
 const floor=ground(body.group.position.x,body.group.position.z,body.group.position.y);
 const palms=rescuePalms(t);
 if(palms>0){
  const forward=body.group.localToWorld(new Vector3(0,0,1)).sub(body.group.getWorldPosition(new Vector3())).setY(0).normalize();
  for(const side of ['l','r'] as const){
   const shoulder=bonePoint(body.rig,'upperarm'+side);
   if(shoulder)reach(body.rig,side,shoulder.setY(floor+.10).addScaledVector(forward,.06),palms);
  }
 }
 const touch=rescueTouch(t);
 if(touch===0)return;
 // The near shoulder takes the right hand, the upper back the left.
 const side=body.group.worldToLocal(guard.group.getWorldPosition(new Vector3())).x>0?'l':'r';
 const arm=bonePoint(body.rig,'upperarm'+side),chest=bonePoint(body.rig,'chest'),pelvis=bonePoint(body.rig,'pelvis'),
  l=bonePoint(body.rig,'upperarml'),r=bonePoint(body.rig,'upperarmr');
 if(arm)reach(guard.rig,'r',arm.add(new Vector3(0,.08,0)),touch);
 // On the upper back, whether the person lies face down or kneels: out of the chest, away from the front.
 if(chest&&pelvis&&l&&r){
  const back=new Vector3().crossVectors(chest.clone().sub(pelvis),l.sub(r)).normalize();
  reach(guard.rig,'l',chest.addScaledVector(back,.15),touch*.85);
 }
}

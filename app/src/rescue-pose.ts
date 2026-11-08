import {Vector3,MathUtils} from 'three';
import {sampleRescueMotion} from './motion.ts';
import {applyMotion,bonePoint,groundBody,reach} from './motion-runtime.ts';
import type {Rig} from './rig.ts';
import type {Object3D} from 'three';

type Actor={rig:Rig;model:Object3D;group:Object3D};
export function poseRescue(guard:Actor,body:Actor,t:number,ground:(x:number,z:number,y:number)=>number){
 for(const [a,role] of [[guard,'giver'],[body,'receiver']] as const){
  applyMotion(a.rig,a.model,sampleRescueMotion(role,t));
  const {x,y,z}=a.group.position;
  groundBody(a.model,ground(x,z,y));
 }
 const side=body.group.worldToLocal(guard.group.getWorldPosition(new Vector3())).x>0?'l':'r';
 const at=bonePoint(body.rig,'upperarm'+side);
 if(at)reach(guard.rig,'r',at.add(new Vector3(0,.09,0)),MathUtils.smoothstep(t,.12,.29)*(1-MathUtils.smoothstep(t,.46,.68)));
}

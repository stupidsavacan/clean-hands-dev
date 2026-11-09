import * as T from 'three';
import poses from './data/party-motions.json' with {type:'json'};
import type {TraversalFrame} from './party/traversal.ts';
import {LADDER} from './ladder-motion.ts';
import {reach} from './motion-runtime.ts';
import type {Rig} from './rig.ts';

const base=new T.Quaternion(),target=new T.Vector3();

/** The traversal layer on top of the normal rig, the same for the player, NPCs and the lab. The frame's heading is
 * the body's whole heading (the game keeps the player's heading in step with it, so nothing snaps at the end). */
export function applyTraversalPose(rig:Rig,avatar:T.Object3D,lean:T.Object3D,frame:TraversalFrame){
 avatar.rotation.y=frame.heading;
 const {weight,cycle,vault}=frame;
 if(weight<=0&&frame.hands<=0&&frame.feet<=0){avatar.updateMatrixWorld(true);return;}
 const pose=poses[vault?'vault':'climb'];
 lean.rotation.x=T.MathUtils.lerp(lean.rotation.x,vault?pose.root.pitch:LADDER.lean,weight);
 const swing=vault?0:Math.sin(cycle*2*Math.PI);
 for(const [name,[x,y,z]] of Object.entries(pose.bones)){
  const bone=rig.joints.get(name)?.bone;
  if(!bone)continue;
  const side=name.endsWith('l')?1:-1;
  base.copy(bone.quaternion);
  const step=name.startsWith('thigh')||name.startsWith('upperarm')?swing*.25*side:0;
  rig.rotate(name,x+step,y,z);
  bone.quaternion.slerp(base,1-weight);
 }
 avatar.updateMatrixWorld(true);
 for(const [side,sign] of [['l',1],['r',-1]] as const){
  const hand=frame.hand?.(sign),foot=frame.foot?.(sign);
  if(hand&&frame.hands>0)reach(rig,side,target.set(hand.x,hand.y,hand.z),frame.hands);
  if(foot&&frame.feet>0)reach(rig,side,target.set(foot.x,foot.y,foot.z),frame.feet,true);
 }
}

export function traversalContacts(rig:Rig,frame:TraversalFrame,transform=(p:T.Vector3)=>p){
 return ([['hand',frame.hand,frame.hands],['foot',frame.foot,frame.feet]] as const).flatMap(([kind,goal,weight])=>!goal||weight<1?[]:
  ([['l',1],['r',-1]] as const).flatMap(([side,sign])=>{
   const bone=rig.joints.get(kind+side)?.bone;
   if(!bone)return [];
   const {x,y,z}=goal(sign),target=transform(new T.Vector3(x,y,z)),actual=bone.getWorldPosition(new T.Vector3());
   return [{kind,side,target,actual,error:target.distanceTo(actual)}];
  }));
}

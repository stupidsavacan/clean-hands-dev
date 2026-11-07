import * as T from 'three';
import type {Rig} from './rig.ts';
import {applyMotion,plantFeetAt,reach,bonePoint} from './motion-runtime.ts';
import {katanaGiver,katanaReceiver} from './katana-motion.ts';
// Poses the sword take-down (katana-motion.ts) on two rigs: shared by the game (m3-view.ts) and the Animation Lab.
// Order matters: the one struck first (the left hand may go to their face), then the striker's body, feet, right fist,
// the sword turned to the data's blade/edge (not left to the wrist), then the left hand onto the grip's GRIP_L.
type Body={rig:Rig;model:T.Object3D};
const toWorld=(model:T.Object3D,root:{x:number;y:number;z:number})=>{const base=model.position.clone().sub(new T.Vector3(root.x,root.y,root.z));
 return {point:(v:number[])=>model.parent!.localToWorld(base.clone().add(new T.Vector3(v[0],v[1],v[2]))),dir:(v:number[])=>{const o=model.parent!.localToWorld(base.clone());return model.parent!.localToWorld(base.clone().add(new T.Vector3(v[0],v[1],v[2]))).sub(o).normalize();}};};
/** place: moves the striker's model into position after the pose's own root is set (the caller's spacing). */
export function poseKatana(g:Body,r:Body|null,behind:boolean,t:number,ground:(x:number,z:number,y:number)=>number,place?:(model:T.Object3D)=>void){
 if(r){const rv=katanaReceiver(behind,t);applyMotion(r.rig,r.model,rv.pose);plantFeetAt(r.rig,r.model,rv.pose,rv.feet,ground);}
 const k=katanaGiver(behind,t);applyMotion(g.rig,g.model,k.pose);place?.(g.model);g.model.updateMatrixWorld(true);plantFeetAt(g.rig,g.model,k.pose,k.feet,ground);
 const w=toWorld(g.model,k.pose.root);reach(g.rig,'r',w.point(k.fist));
 const hand=g.rig.joints.get('handr')?.bone,sword=hand?.children.find(c=>c.name==='item-katana');
 if(hand&&sword){const z=w.dir(k.blade),e=w.dir(k.edge).negate(),y=e.sub(z.clone().multiplyScalar(z.dot(e))).normalize(),x=new T.Vector3().crossVectors(y,z);
  const want=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));sword.quaternion.copy(hand.getWorldQuaternion(new T.Quaternion()).invert().multiply(want));sword.updateMatrixWorld(true);
  const grip=sword.getObjectByName('GRIP_L');if(grip&&k.leftOnTarget<1)reach(g.rig,'l',grip.getWorldPosition(new T.Vector3()));}
 // Behind: the left hand over the mouth (in front of the face, a little below the head bone).
 if(r&&k.leftOnTarget>0){const head=bonePoint(r.rig,'head');if(head){const fwd=new T.Vector3(0,0,1).applyQuaternion(r.model.getWorldQuaternion(new T.Quaternion()));fwd.y=0;fwd.normalize();reach(g.rig,'l',head.addScaledVector(fwd,.10).add(new T.Vector3(0,.02,0)),k.leftOnTarget);}}
 return k;}

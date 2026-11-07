import * as T from 'three';
import type { Rig } from './rig.ts';
import { sampleMotion, type MotionPose } from './motion.ts';

export function neutral(rig:Rig){for(const j of rig.joints.values()){j.bone.quaternion.copy(j.q0);j.bone.position.copy(j.p0);}}
export function applyMotion(rig:Rig,root:T.Object3D,pose:MotionPose){neutral(rig);root.position.set(pose.root.x,pose.root.y,pose.root.z);root.rotation.set(pose.root.pitch,0,pose.root.roll);for(const [name,xyz]of Object.entries(pose.bones))rig.rotate(name,...xyz);root.parent?.updateWorldMatrix(true,false);root.updateMatrixWorld(true);}

// Solve against the current world matrices, so height/body presets keep the same contact points.
export function reach(rig:Rig,side:'l'|'r',target:T.Vector3,weight=1,leg=false){const end=rig.joints.get((leg?'foot':'hand')+side)?.bone;if(!end)return 0;
 const chain=(leg?['shin','thigh']:['forearm','upperarm']).map(n=>rig.joints.get(n+side)?.bone).filter((b):b is T.Bone=>!!b);
 const wanted=end.getWorldPosition(new T.Vector3()).lerp(target,T.MathUtils.clamp(weight,0,1)),pivot=new T.Vector3(),tip=new T.Vector3(),from=new T.Vector3(),to=new T.Vector3(),q=new T.Quaternion(),world=new T.Quaternion(),parent=new T.Quaternion();
 for(let pass=0;pass<24;pass++){for(const bone of chain){bone.getWorldPosition(pivot);end.getWorldPosition(tip);from.copy(tip).sub(pivot);to.copy(wanted).sub(pivot);if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)continue;q.setFromUnitVectors(from.normalize(),to.normalize());bone.getWorldQuaternion(world);world.premultiply(q);bone.parent!.getWorldQuaternion(parent).invert();bone.quaternion.copy(parent.multiply(world));bone.updateWorldMatrix(true,true);}if(end.getWorldPosition(tip).distanceTo(wanted)<.002)break;}
 return end.getWorldPosition(tip).distanceTo(wanted);
}
export function plantedFeet(rig:Rig,actor:T.Object3D,ground:(x:number,z:number,y:number)=>number){const scale=actor.getWorldScale(new T.Vector3());for(const [side,x]of [['l',.1],['r',-.1]]as const){const p=actor.localToWorld(new T.Vector3(x,0,.03));p.y=ground(p.x,p.z,actor.getWorldPosition(new T.Vector3()).y)+.075*Math.abs(scale.y);reach(rig,side,p,1,true);}}
export function bonePoint(rig:Rig,name:string,local=new T.Vector3()){const bone=rig.joints.get(name)?.bone;return bone?bone.localToWorld(local.clone()):null;}

// Match the lowest deformed vertex to the visible floor; querying bind-pose bounds is insufficient.
export function groundBody(model:T.Object3D,y:number,weight=1,bodySupport=false){model.parent?.updateWorldMatrix(true,false);model.updateMatrixWorld(true);model.traverse(o=>{const m=o as T.SkinnedMesh;if(m.isSkinnedMesh)m.skeleton.update();});const box=new T.Box3();if(!bodySupport)box.setFromObject(model,true);else model.traverse(o=>{const m=o as T.SkinnedMesh;if(!m.isSkinnedMesh)return;const g=m.geometry,index=g.getAttribute('skinIndex'),weights=g.getAttribute('skinWeight'),position=g.getAttribute('position');for(let i=0;i<position.count;i++){let joint=0,max=-1;for(let k=0;k<4;k++){const w=weights.getComponent(i,k);if(w>max){max=w;joint=index.getComponent(i,k);}}if(/clavicle|upperarm|forearm|hand|thumb/i.test((m.skeleton.bones[joint]?.name??'').replace(/[^a-z]/gi,'')))continue;const p=new T.Vector3();m.getVertexPosition(i,p);box.expandByPoint(p.applyMatrix4(m.matrixWorld));}});const delta=y+.008-box.min.y;if(Number.isFinite(delta)){const world=new T.Vector3(0,delta*(delta>0?1:weight),0),parent=model.parent!;const zero=parent.worldToLocal(new T.Vector3()),local=parent.worldToLocal(world).sub(zero);model.position.add(local);model.updateMatrixWorld(true);}}

export const PICKUP_SECONDS=1.5;
const pickupEase=(a:number,b:number,t:number)=>{const u=T.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
/** Establish a real wrist grip before raising it. Stateless evaluation also supports scrubbing. */
export function pickupContact(giver:Rig,giverActor:T.Object3D,giverModel:T.Object3D,receiver:Rig,receiverActor:T.Object3D,receiverModel:T.Object3D,t:number,ground:(x:number,z:number,y:number)=>number){
 const approach=.48*pickupEase(.02,.28,t)*(1-pickupEase(.55,1,t)),toward=receiverActor.getWorldPosition(new T.Vector3()).sub(giverActor.getWorldPosition(new T.Vector3()));toward.y=0;toward.normalize().multiplyScalar(approach);
 const parent=giverModel.parent!,zero=parent.worldToLocal(new T.Vector3()),delta=parent.worldToLocal(toward).sub(zero);giverModel.position.add(delta);plantedFeet(giver,giverModel,ground);
 const origin=receiverActor.getWorldPosition(new T.Vector3()),floor=ground(origin.x,origin.z,origin.y);
 applyMotion(receiver,receiverModel,sampleMotion('pickup','receiver',0));groundBody(receiverModel,floor,1,true);const rest={l:bonePoint(receiver,'handr')!,r:bonePoint(receiver,'handl')!};
 applyMotion(receiver,receiverModel,sampleMotion('pickup','receiver',t));groundBody(receiverModel,floor,1,true);
 let error=0;const grip=pickupEase(.20,.40,t),lift=pickupEase(.55,1,t);
 for(const [side,sign]of [['l',1],['r',-1]]as const){const other=side==='l'?'r':'l',end=giverActor.localToWorld(new T.Vector3(sign*.15,.65,.35)),target=rest[side].clone().lerp(end,lift);reach(receiver,other,target,pickupEase(.40,.55,t));const actual=bonePoint(receiver,'hand'+other)!;error=Math.max(error,reach(giver,side,actual,grip));}
 giverModel.updateMatrixWorld(true);receiverModel.updateMatrixWorld(true);return error;
}


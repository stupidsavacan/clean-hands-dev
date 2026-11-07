import * as T from 'three';
import { HIP_HEIGHT, type Pose } from './locomotion.ts';
type Joint={bone:T.Bone;q0:T.Quaternion;p0:T.Vector3;w0:T.Quaternion;w0i:T.Quaternion;axis:[number,number,number]};
const q=new T.Quaternion(),e=new T.Euler();
export const canonical=(n:string)=>n.replace(/[^a-zA-Z]/g,'').toLowerCase();
// Captures the rest pose of a loaded skeleton and writes procedural poses onto it.
// Which local axis of a bone points along the character's X (lateral), Y (up) and Z (forward) at rest.
function localAxes(w:T.Quaternion):[number,number,number]{const dirs=[new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)].map(v=>v.applyQuaternion(w));
 return [0,1,2].map(c=>dirs.reduce((best,d,i)=>Math.abs(d.getComponent(c))>Math.abs(dirs[best].getComponent(c))?i:best,0)) as [number,number,number];}
export type Body={shoulders:number;build:number;head:number};
export class Rig{
 readonly joints=new Map<string,Joint>();headScale=1;
 // Rest orientations are taken relative to the model root, so the facing of whatever holds the model does not leak in.
 constructor(root:T.Object3D){root.updateMatrixWorld(true);const rootInv=root.getWorldQuaternion(new T.Quaternion()).invert();root.traverse(o=>{if((o as T.Bone).isBone){const w0=o.getWorldQuaternion(new T.Quaternion()).premultiply(rootInv);this.joints.set(canonical(o.name),{bone:o as T.Bone,q0:o.quaternion.clone(),p0:o.position.clone(),w0,w0i:w0.clone().invert(),axis:localAxes(w0)});}});}
 // Proportions as bone scales in the character's own axes: build widens/deepens the pelvis and everything below the chest
 // that inherits it, shoulders widen the chest; the neck cancels both so the head keeps its size, then head scales it.
 setBody(b:Body){const set=(name:string,x:number,y:number,z:number)=>{const j=this.joints.get(name);if(!j)return;const v=[1,1,1];v[j.axis[0]]=x;v[j.axis[1]]=y;v[j.axis[2]]=z;j.bone.scale.set(v[0],v[1],v[2]);};
  set('pelvis',b.build,1,b.build);set('spine',1,1,1);set('chest',b.shoulders,1,1);set('neck',1/(b.build*b.shoulders),1,1/b.build);set('head',b.head,b.head,b.head);this.headScale=b.head;}
 has(names:string[]){return names.every(n=>this.joints.has(n));}
 // Rotation offset expressed in the character's rest axes (X lateral, Y up, Z forward), applied on top of the rest pose.
 rotate(name:string,x:number,y=0,z=0){const j=this.joints.get(name);if(!j)return;q.setFromEuler(e.set(x,y,z,'XYZ'));j.bone.quaternion.copy(j.w0i).multiply(q).multiply(j.w0).premultiply(j.q0);}
 apply(p:Pose){const pelvis=this.joints.get('pelvis');this.rotate('pelvis',0,p.pelvisYaw,p.pelvisRoll);if(pelvis)pelvis.bone.position.copy(pelvis.p0).add(new T.Vector3(p.pelvisShift,p.hip-HIP_HEIGHT,0));
  this.rotate('spine',p.spine);this.rotate('chest',p.chest,p.chestYaw,p.chestRoll);this.rotate('neck',p.neck);this.rotate('head',p.head,p.headYaw);
  ['l','r'].forEach((s,i)=>{const leg=p.legs[i],arm=p.arms[i],side=i?1:-1;this.rotate('thigh'+s,leg.thigh,0,leg.roll);this.rotate('shin'+s,leg.knee);this.rotate('foot'+s,leg.foot,leg.toeOut,leg.footRoll);
   // Shoulders sit back and down; arms hang close to the body and swing from there.
   this.rotate('clavicle'+s,0,-side*arm.shoulder,side*arm.shoulder*.5);this.rotate('upperarm'+s,arm.swing,0,side*ARM_DROP);this.rotate('forearm'+s,0,side*arm.elbow);});}
}
export const ARM_DROP=1.45;


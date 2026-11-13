import * as T from 'three';
import {sampleCombat} from './combat-motion.ts';
import {applyMotion,bonePoint} from './motion-runtime.ts';
import type {MotionPose} from './motion.ts';
import type {Rig} from './rig.ts';
export const FLASH_THROW_SECONDS=1.2,FLASH_RELEASE=.65;
const smooth=(u:number)=>{const t=Math.max(0,Math.min(1,u));return t*t*(3-2*t);};
/** Original CLEAN HANDS toss, with a signed, forward-bending elbow throughout. */
export function sampleFlashThrow(progress:number,cover=false):MotionPose{const t=Math.max(0,Math.min(1,progress)),base=sampleCombat(cover?'cover':'holster','pistol',cover?0:1).pose,stand=sampleCombat('holster','pistol',1).pose;
 const envelope=Math.min(smooth(t/.22),smooth((1-t)/.25));
 for(const k of Object.keys(base.root) as (keyof MotionPose['root'])[])base.root[k]+=(stand.root[k]-base.root[k])*envelope;
 for(const name of Object.keys(base.bones))for(let i=0;i<3;i++)base.bones[name][i]+=(stand.bones[name][i]-base.bones[name][i])*envelope;
 const keys=[{t:0,upper:[-.05,0,1.45],elbow:.24},{t:.28,upper:[-.65,-.15,1.3],elbow:1.25},{t:FLASH_RELEASE/FLASH_THROW_SECONDS,upper:[-1.5,0,1.4],elbow:.18},{t:.76,upper:[-1.0,.12,1.4],elbow:.4},{t:1,upper:[-.05,0,1.45],elbow:.24}];
 let a=keys[0],b=keys[1];for(let i=1;i<keys.length;i++){a=keys[i-1];b=keys[i];if(t<=b.t)break;}const u=smooth((t-a.t)/(b.t-a.t));
 for(let i=0;i<3;i++)base.bones.upperarmr[i]+=(a.upper[i]+(b.upper[i]-a.upper[i])*u-base.bones.upperarmr[i])*envelope;
 base.bones.forearmr=[0,base.bones.forearmr[1]+(a.elbow+(b.elbow-a.elbow)*u-base.bones.forearmr[1])*envelope,0];base.bones.chest[1]+=.15*Math.sin(t*Math.PI)*envelope;
 return base;
}
export function poseFlashThrow(rig:Rig,actor:T.Object3D,model:T.Object3D,progress:number,cover=false){const t=Math.max(0,Math.min(1,progress)),blend=Math.min(smooth(t/.15),smooth((1-t)/.15));
 if(cover)applyMotion(rig,model,sampleCombat('cover','pistol',0).pose);
 const previous=new Map([...rig.joints].map(([name,j])=>[name,{q:j.bone.quaternion.clone(),p:j.bone.position.clone()}])),position=model.position.clone();
 applyMotion(rig,model,sampleFlashThrow(t,cover));for(const [name,j] of rig.joints){const from=previous.get(name)!;j.bone.quaternion.slerpQuaternions(from.q,j.bone.quaternion.clone(),blend);j.bone.position.lerpVectors(from.p,j.bone.position.clone(),blend);}model.position.lerpVectors(position,model.position.clone(),blend);actor.updateMatrixWorld(true);

}
export function flashMesh(){const group=new T.Group();group.name='clean-hands-flash';const body=new T.Mesh(new T.CylinderGeometry(.034,.034,.16,8),new T.MeshStandardMaterial({color:'#83b8b2',roughness:.8}));group.add(body);const band=new T.Mesh(new T.BoxGeometry(.074,.025,.074),new T.MeshStandardMaterial({color:'#d1b680',roughness:.9}));band.position.y=.015;group.add(band);return group;}
export const flashGrip=(rig:Rig)=>bonePoint(rig,'handr',new T.Vector3(0,.06,0));
export function placeHeldFlash(prop:T.Object3D,rig:Rig,parent:T.Object3D,seconds:number){prop.visible=seconds>=0&&seconds<FLASH_RELEASE;const hand=rig.joints.get('handr')?.bone,at=flashGrip(rig);if(!at||!hand){prop.visible=false;return;}parent.updateWorldMatrix(true,false);prop.position.copy(parent.worldToLocal(at));prop.quaternion.copy(parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(hand.getWorldQuaternion(new T.Quaternion())).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2)));}

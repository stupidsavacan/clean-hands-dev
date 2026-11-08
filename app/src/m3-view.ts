import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { M3System } from './m3';
import type { Rig } from './rig';
import type { NpcView } from './npc-view';
import type { Npc } from './ai';
import { sampleMotion, type MotionPose } from './motion';
import { brawlMotion, BRAWL_GAP } from './brawl-motion';
import { KATANA_GAP } from './katana-motion';
import { poseKatana } from './katana-pose';
import { applyMotion, plantFeetAt, reachHandsAt, aimFists, plantedFeet, bonePoint, reach, groundBody, pickupContact, PICKUP_SECONDS } from './motion-runtime';
import { M3_MODELS } from './m3-data';
import { RESCUE_SECONDS } from './body-rescue';
import { poseRescue } from './rescue-pose';

export class M3View{
 private owner?:M3System;private previousAction:{id:number;kind:'ko'|'kill'|'hide';npc:Npc;progress:number;offset?:T.Vector3}|null=null;private previousDrag:Npc|null=null;private transition:{kind:'pickup'|'drop'|'recover';npc:Npc;at:number;pose?:MotionPose;received?:MotionPose;offset?:T.Vector3}|null=null;metrics={handError:0};
 lockers:{id:string;root:T.Object3D;door?:T.Object3D}[]=[];wire?:T.Object3D;
 get transferKind(){return this.transition?.kind??null;}
 get transferProgress(){return this.transition&&this.owner?Math.min(1,(this.owner.elapsed-this.transition.at)/(this.transition.kind==='pickup'?PICKUP_SECONDS:.65)):0;}
 get transferBusy(){return !!this.transition&&this.transition.kind!=='recover';}
 constructor(readonly scene:T.Scene){}
 async load(system:M3System){const loader=new GLTFLoader();const parse=async(id:keyof typeof M3_MODELS)=>(await loader.parseAsync(Uint8Array.from(atob(M3_MODELS[id]),c=>c.charCodeAt(0)).buffer,'')).scene;
  const locker=await parse('locker');for(const h of system.hides){const root=clone(locker);root.position.set(h.x,h.y,h.z);root.rotation.y=h.heading;root.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;}});this.scene.add(root);this.lockers.push({id:h.id,root,door:root.getObjectByName('Door')});}
  this.wire=await parse('wire');this.wire.visible=false;this.scene.add(this.wire);}
 render(system:M3System,rig:Rig|undefined,avatar:T.Object3D,model:T.Object3D|undefined,views:NpcView[],ground:(x:number,z:number,y:number)=>number){
  if(this.owner!==system){this.owner=system;this.previousAction=null;this.previousDrag=null;this.transition=null;}
  const a=system.action,p=system.progress,view=(n:Npc)=>views.find(v=>v.npc===n),now=system.elapsed;
  if(!a&&this.previousAction){const old=this.previousAction;if(old.kind!=='hide')this.transition={kind:'recover',npc:old.npc,at:now,pose:sampleMotion(old.kind,'giver',old.progress),received:sampleMotion(old.kind,'receiver',old.progress),offset:old.offset};}
  if(!a&&system.dragged!==this.previousDrag){if(system.dragged)this.transition={kind:'pickup',npc:system.dragged,at:now};else if(this.previousDrag&&this.previousDrag.bodyMode==='ground')this.transition={kind:'drop',npc:this.previousDrag,at:now};}
  if(a)this.transition=null;
  for(const l of this.lockers){const open=a?.kind==='hide'&&a.container?.id===l.id;if(l.door)l.door.rotation.y=open?-1.65*Math.min(1,p/.18,(1-p)/.12):0;}
  this.metrics.handError=0;
  if(rig&&model){
   // A swing or a stab with a thing in hand (2026-11-06): the game poses the arm (hold-pose.ts strikePose); no grab, no sync.
   // The fight and the punch (brawl-motion.ts): both bodies, the agent standing BRAWL_GAP in front of the guard.
   if(a&&(a.mode==='brawl'||a.mode==='punch')&&system.blows){const b=system.blows,target=view(a.npc),g=brawlMotion('giver',b.blows,b.since,b.single);
    // The guard first, so the agent's fists can find his face and stomach where they really are.
    if(target){const r=brawlMotion('receiver',b.blows,b.since,b.single);applyMotion(target.rig,target.body,r.pose);plantFeetAt(target.rig,target.body,r.pose,r.feet,ground);reachHandsAt(target.rig,target.body,r.pose,r.hands);}
    applyMotion(rig,model,g.pose);
    const toward=new T.Vector3(avatar.position.x-a.npc.pos.x,0,avatar.position.z-a.npc.pos.z);if(toward.lengthSq()<1e-6)toward.set(Math.sin(a.npc.heading),0,Math.cos(a.npc.heading));toward.normalize();
    const close=ease(0,.25,a.elapsed),desired=new T.Vector3(a.npc.pos.x,avatar.position.y,a.npc.pos.z).addScaledVector(toward,BRAWL_GAP).lerp(avatar.position,1-close);
    model.position.add(model.parent!.worldToLocal(desired.clone()).sub(model.parent!.worldToLocal(avatar.position.clone())));model.updateMatrixWorld(true);plantFeetAt(rig,model,g.pose,g.feet,ground);reachHandsAt(rig,model,g.pose,g.hands);
    if(target)aimFists(rig,target.rig,g.aim,b.single?avatar:undefined);}
   // The sword (katana-motion.ts): both bodies, the striker standing in front of (or right behind) the one struck.
   else if(a&&a.item==='katana'){const target=view(a.npc),gap=a.behind?KATANA_GAP.behind:KATANA_GAP.front;
    poseKatana({rig,model},target?{rig:target.rig,model:target.body}:null,!!a.behind,p,ground,m=>{const toward=new T.Vector3(avatar.position.x-a.npc.pos.x,0,avatar.position.z-a.npc.pos.z);if(toward.lengthSq()<1e-6)toward.set(-Math.sin(a.npc.heading),0,-Math.cos(a.npc.heading));toward.normalize();
     const close=ease(0,.2,p),desired=new T.Vector3(a.npc.pos.x,avatar.position.y,a.npc.pos.z).addScaledVector(toward,gap).lerp(avatar.position,1-close);m.position.add(m.parent!.worldToLocal(desired.clone()).sub(m.parent!.worldToLocal(avatar.position.clone())));});}
   else if(a&&(a.item||a.mode)){model.position.set(0,0,0);model.rotation.set(0,0,0);}
   else if(a){const target=view(a.npc),kind=a.kind==='kill'?'kill':a.kind==='ko'?'ko':'hide';applyMotion(rig,model,sampleMotion(kind,'giver',p));
    if(target){applyMotion(target.rig,target.body,sampleMotion(kind,'receiver',p));
     if(a.kind==='hide'&&a.container){const h=a.container,t=ease(.24,.88,p);target.group.position.set(T.MathUtils.lerp(a.targetStart.x,h.x,t),T.MathUtils.lerp(a.targetStart.y,h.y,t),T.MathUtils.lerp(a.targetStart.z,h.z,t));target.group.rotation.y=a.targetHeading+T.MathUtils.euclideanModulo(h.heading-a.targetHeading+Math.PI,2*Math.PI)*t-Math.PI*t;}
     else{const close=ease(.02,.25,p),gap=T.MathUtils.lerp(.62,.40,ease(.5,.88,p)),desired=new T.Vector3(a.npc.pos.x-Math.sin(a.npc.heading)*gap,avatar.position.y,a.npc.pos.z-Math.cos(a.npc.heading)*gap);desired.lerp(avatar.position,1-close);const local=model.parent!.worldToLocal(desired.clone()),origin=model.parent!.worldToLocal(avatar.position.clone());model.position.add(local.sub(origin));plantedFeet(target.rig,target.group,ground);}
     plantedFeet(rig,model,ground);avatar.updateMatrixWorld(true);target.group.updateMatrixWorld(true);
     if(a.kind!=='hide'){const contact=ease(.12,.33,p)*(1-ease(.88,1,p));const neck=bonePoint(target.rig,'neck');if(neck)for(const [side,sign] of [['l',1],['r',-1]] as const){const at=neck.clone().add(new T.Vector3(sign*.13,.015,.06).applyQuaternion(target.group.quaternion));this.metrics.handError=Math.max(this.metrics.handError,reach(rig,side,at,contact));reach(target.rig,side,at,ease(.12,.35,p)*(1-ease(.65,.92,p)));}}
    }
   }else if(this.transition){const tr=this.transition,t=Math.min(1,(now-tr.at)/(tr.kind==='recover'?.45:tr.kind==='pickup'?PICKUP_SECONDS:.65)),target=view(tr.npc);
    if(tr.kind==='recover'){const to=sampleMotion('fall','giver',1);applyMotion(rig,model,mixPose(tr.pose!,to,ease(0,1,t)));if(tr.offset)model.position.addScaledVector(tr.offset,1-ease(0,1,t));if(tr.npc.active&&target){applyMotion(target.rig,target.body,mixPose(tr.received!,sampleMotion('ko','receiver',0),ease(0,1,t)));plantedFeet(target.rig,target.group,ground);}}
    else{applyMotion(rig,model,sampleMotion(tr.kind,'giver',t));if(target&&target.npc.bodyMode!=='hidden'){applyMotion(target.rig,target.body,sampleMotion(tr.kind,'receiver',t));groundBody(target.body,ground(target.group.position.x,target.group.position.z,target.npc.pos.y));}}
    plantedFeet(rig,model,ground);if(tr.kind==='pickup'&&target)this.metrics.handError=pickupContact(rig,avatar,model,target.rig,target.group,target.body,t,ground);if(t>=1)this.transition=null;
   }else if(system.dragged){const target=view(system.dragged),phase=now*.85%1,pose=sampleMotion('drag','giver',phase);model.position.set(0,0,0);model.rotation.set(0,0,pose.root.roll);for(const [name,xyz]of Object.entries(pose.bones))if(/^(spine|chest|neck|head|clavicle|upperarm|forearm|hand)/.test(name))rig.rotate(name,...xyz);
    if(target){applyMotion(target.rig,target.body,sampleMotion('drag','receiver',phase));groundBody(target.body,ground(target.npc.pos.x,target.npc.pos.z,target.npc.pos.y));target.group.updateMatrixWorld(true);avatar.updateMatrixWorld(true);for(const [side,sign]of [['l',1],['r',-1]]as const){const desired=avatar.localToWorld(new T.Vector3(sign*.15,.65,.35));const other=side==='l'?'r':'l';reach(target.rig,other,desired);const hand=bonePoint(target.rig,'hand'+other);if(hand)this.metrics.handError=Math.max(this.metrics.handError,reach(rig,side,hand));}}
   }else{model.position.set(0,0,0);model.rotation.set(0,0,0);}
  }
  for(const rescue of system.rescue.playing){
   const guard=view(rescue.guard),body=view(rescue.body);
   if(guard&&body&&(guard.group.visible||body.group.visible))poseRescue(
    {rig:guard.rig,model:guard.body,group:guard.group},{rig:body.rig,model:body.body,group:body.group},rescue.elapsed/RESCUE_SECONDS,ground);
  }
  if(this.wire){this.wire.visible=!!a&&a.kind==='kill'&&!a.item&&!a.mode&&p>.16&&p<.94;if(this.wire.visible&&rig){avatar.updateMatrixWorld(true);const l=bonePoint(rig,'handl'),r=bonePoint(rig,'handr');if(l&&r){this.wire.position.copy(l).add(r).multiplyScalar(.5);this.wire.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),r.clone().sub(l).normalize());this.wire.scale.set(Math.max(.1,l.distanceTo(r)/.32),1,1);}this.wire.getObjectByName('Wire_coiled')!.visible=false;this.wire.getObjectByName('Wire_taut')!.visible=true;}}
  const sourceRoot=a?sampleMotion(a.kind,'giver',p).root:null;
  this.previousAction=a&&!a.item&&!a.mode?{id:a.id,kind:a.kind,npc:a.npc,progress:p,offset:model&&sourceRoot?model.position.clone().sub(new T.Vector3(sourceRoot.x,sourceRoot.y,sourceRoot.z)):undefined}:null;this.previousDrag=system.dragged;
 }
}
function ease(a:number,b:number,t:number){const u=T.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);}
function mixPose(a:MotionPose,b:MotionPose,t:number):MotionPose{const root={...a.root};for(const k of Object.keys(root)as(keyof MotionPose['root'])[])root[k]=T.MathUtils.lerp(a.root[k],b.root[k],t);return {root,bones:Object.fromEntries(Object.entries(a.bones).map(([n,v])=>[n,v.map((x,k)=>T.MathUtils.lerp(x,b.bones[n][k],t)) as [number,number,number]]))};}


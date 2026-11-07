import * as T from 'three';
import {NpcGroup} from './npc-group';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Locomotion, type Pose } from './locomotion';
import { Rig } from './rig';
import type { Npc } from './ai';
import { neutral, applyMotion, groundBody } from './motion-runtime';
import { sampleMotion } from './motion';
import {schedulePose} from './schedule-motion';
// Each NPC is a clone of its own character GLB (Astra's cast on the agent's 22-bone rig), so the procedural gait drives them unchanged.
// Face morphs calm / curious / alert follow the AI state.
const EXPRESSION:Record<string,number>={patrol:0,distracted:1,curious:1,investigate:1,search:1,verify:1,alert:2,report:2,combat:2,flee:2};
export const STATE_COLOR:Record<string,string>={patrol:'#efeadf',curious:'#f2c14e',distracted:'#9fd1c2',investigate:'#ef9a4a',search:'#ef9a4a',alert:'#e0524a',report:'#e0524a',verify:'#ffffff',combat:'#ff3b30',flee:'#b58ad9'};
export class NpcView{
 readonly group=new NpcGroup();readonly body:T.Object3D;readonly rig:Rig;private readonly loco=new Locomotion();private pose?:Pose;
 private prev={x:0,y:0,z:0,h:0};private last={x:0,z:0};private turnRate=0;private gaitSpeed=0;private slope=0;private skipped=0;private owed=0;npc:Npc;
 // Set each frame from the camera frustum (last frame's view is close enough).
 offscreen=false;culled=false;
 // The character GLB this actor was cloned from (hotel.json model), so a looted body can be undressed to match it.
 model='';
 // Runs after the gait is posed, every rendered frame of a visible NPC (gunfight upper body, held weapon).
 onPosed?:(view:NpcView,dt:number)=>void;
 face?:T.Mesh;
 private phone?:T.Mesh;
 constructor(template:T.Object3D,npc:Npc,parent:T.Object3D){this.npc=npc;const body=clone(template);this.body=body;
  body.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;m.castShadow=true;m.receiveShadow=true;if(m.morphTargetInfluences?.length===3)this.face=m;});
  this.rig=new Rig(body);
  if(npc.target){const hand=this.rig.joints.get('handr')?.bone;if(hand){this.phone=new T.Mesh(new T.BoxGeometry(.065,.12,.018),new T.MeshStandardMaterial({color:'#222b30',roughness:.7}));this.phone.visible=false;hand.add(this.phone);}}
  const lean=new T.Group();lean.add(body);this.group.add(lean);this.group.name='npc-'+npc.id;parent.add(this.group);
  this.bind(npc);}
 bind(npc:Npc){this.npc=npc;this.body.rotation.set(0,0,0);this.body.position.set(0,0,0);this.group.visible=true;neutral(this.rig);this.prev={...npc.pos,h:npc.heading};this.last={x:npc.pos.x,z:npc.pos.z};this.loco.reset();this.group.position.set(npc.pos.x,npc.pos.y-.025,npc.pos.z);this.group.rotation.y=npc.heading;}
 // Called before each fixed AI step so rendering can interpolate between steps.
 snapshot(){const n=this.npc;this.prev={x:n.pos.x,y:n.pos.y,z:n.pos.z,h:n.heading};}
 render(dt:number,blend:number,ground:(x:number,z:number,baseY:number)=>number){const n=this.npc,p=this.prev,g=this.group;
  if(this.phone)this.phone.visible=n.active&&!n.busy&&n.state==='patrol'&&n.scheduleAction==='phone'&&n.speed<.3;
  g.visible=n.bodyMode!=='hidden'&&!n.scheduledAway&&!this.culled;if(!g.visible){if(n.active)g.position.set(n.pos.x,n.pos.y-.025,n.pos.z);return;}if(!n.active){const o=n.fallOrigin,t=n.fall;g.position.set(o?T.MathUtils.lerp(o.x,n.pos.x,t):n.pos.x,(o?T.MathUtils.lerp(o.y,n.pos.y,t):n.pos.y)+.03,o?T.MathUtils.lerp(o.z,n.pos.z,t):n.pos.z);g.rotation.y=n.heading;const pose=sampleMotion('fall','receiver',n.fall);const along=(t:number)=>ground(n.pos.x+Math.sin(n.heading)*t,n.pos.z+Math.cos(n.heading)*t,n.pos.y),incline=(along(.6)-along(-.6))/1.2;pose.root.pitch-=Math.atan(incline)*n.fall;pose.root.y-=.8*incline*n.fall;applyMotion(this.rig,this.body,pose);if(!n.fallOrigin||n.fall>=1)groundBody(this.body,ground(n.pos.x,n.pos.z,n.pos.y),T.MathUtils.smoothstep(n.fall,.65,1));return;}
  this.body.rotation.set(0,0,0);this.body.position.set(0,0,0);if(n.busy){g.position.set(n.pos.x,n.pos.y-.025,n.pos.z);g.rotation.y=n.heading;neutral(this.rig);return;}
  // The receiver rests face-up on the existing massage table, beside their navigation anchor.
  if(n.state==='patrol'&&n.scheduleAction==='massage'&&n.speed<.3){this.body.rotation.set(-Math.PI/2,Math.PI/2,0,'YXZ');this.body.position.set(1,.9,-1.2);}
  const d=Math.atan2(Math.sin(n.heading-p.h),Math.cos(n.heading-p.h));
  g.position.set(T.MathUtils.lerp(p.x,n.pos.x,blend),T.MathUtils.lerp(p.y,n.pos.y,blend)-.025,T.MathUtils.lerp(p.z,n.pos.z,blend));const oldH=g.rotation.y;g.rotation.y=p.h+d*blend;if(dt<=0){if(this.pose)this.rig.apply(this.pose);return;}
  // Re-pose less often when it cannot be seen well: off screen every 8th frame, far every 4th, mid every 2nd; the skipped time is caught up in one step.
  const every=this.offscreen?8:n.tier==='far'?4:n.tier==='mid'?2:1;this.owed+=dt;if(++this.skipped%every!==0)return;dt=Math.min(this.owed,.25);this.owed=0;
  let distance=Math.hypot(g.position.x-this.last.x,g.position.z-this.last.z);if(distance>1)distance=0;this.last={x:g.position.x,z:g.position.z};
  this.turnRate=T.MathUtils.damp(this.turnRate,Math.atan2(Math.sin(g.rotation.y-oldH),Math.cos(g.rotation.y-oldH))/dt,12,dt);this.gaitSpeed=T.MathUtils.damp(this.gaitSpeed,n.speed,10,dt);this.slope=T.MathUtils.damp(this.slope,distance>1e-4?(n.pos.y-p.y)/Math.max(distance,1e-3):0,10,dt);
  const baseY=g.position.y+.025,h=g.rotation.y,x=g.position.x,z=g.position.z;
  this.pose=this.loco.update(dt,{speed:this.gaitSpeed,crouch:0,slope:T.MathUtils.clamp(this.slope,-.6,.6),turn:this.turnRate,distance,ground:q=>ground(x+Math.sin(h)*q,z+Math.cos(h)*q,baseY)-baseY,actual:n.speed});
  n.actionTime+=dt;if(n.state==='patrol'&&n.speed<.3&&(n.scheduleAction||n.talking))schedulePose(this.pose,n.scheduleAction==='phone'?'phone':n.talking?'chat':n.scheduleAction,n.actionTime);
  // Curious or alarmed people turn their head toward what they noticed.
  if(n.lastSeen&&n.state!=='patrol'&&n.state!=='distracted'){const want=Math.atan2(n.lastSeen.x-x,n.lastSeen.z-z),off=T.MathUtils.clamp(Math.atan2(Math.sin(want-h),Math.cos(want-h)),-1,1);this.pose.headYaw+=off*.8;}
  this.rig.apply(this.pose);this.onPosed?.(this,dt);
  if(this.face){const want=EXPRESSION[n.state]??0,w=this.face.morphTargetInfluences!;for(let k=0;k<3;k++)w[k]=T.MathUtils.damp(w[k],k===want?1:0,6,dt);}}
}

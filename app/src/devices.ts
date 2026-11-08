import type {Director,Npc} from './ai.ts';
import {segmentClear} from './sight.ts';
import {floorOf,type Position} from './world.ts';
// ROADMAP H15 (2026-11-06): things the agent can switch on to move people (HITMAN's radio). A radio switched on is
// heard nearby; the nearest person who can leave what they are doing walks over (Director.noise, the same as a coin)
// and, after a moment at it, switches it off and goes back. While they stand there they face the radio, back to the room.
// Shared by every map: the engine reads the map's `devices` and draws them (engine/game.ts).
export type DeviceKind='radio'|'tv'|'vacuum';
export type DeviceDef={id:string;kind:DeviceKind;label:string;x:number;z:number;floor:number;
 /** Height of the surface it stands on and its heading (its front, +Z of the model, turned by this). */
 y:number;heading:number;
 /** Where someone stands to switch it off (on the floor in front of it). */
 approach:{x:number;z:number}};
export const OFF_SECONDS=2.5,CALL_EVERY=2,USE_RADIUS=1.4;
// 2026-11-06 (H16, H17): what each kind is drawn with, how long the one who comes stays at it before switching it off
// (a TV is watched for a while), and how far it is heard (a vacuum cleaner is loud).
export const DEVICE_KINDS:Record<DeviceKind,{model:string;stay:number;radius:number;doing:string}>={
 radio:{model:'boombox',stay:OFF_SECONDS,radius:8,doing:'消しに来る'},
 tv:{model:'tv',stay:10,radius:8,doing:'見に来て、しばらく見てから消す'},
 vacuum:{model:'vacuum',stay:OFF_SECONDS,radius:14,doing:'うるさくて、遠くからも止めに来る'}};
const flat=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

export class DeviceSystem{
 readonly on=new Set<string>();
 private readonly assignments=new Map<string,{npc:Npc;goal:Position;standing:number}>();
 private calledAt=new Map<string,number>();private clock=0;
 get responders(){return new Map([...this.assignments].map(([id,job])=>[id,job.npc]));}
 /** What happened, for the HUD (cleared every step). */
 notices:string[]=[];
 readonly director:Director;readonly devices:DeviceDef[];readonly plate:(floor:number)=>number;
 // Own copies: a device can be carried about (chores.ts moves the vacuum) without touching the map data.
 constructor(director:Director,devices:DeviceDef[],plate:(floor:number)=>number){this.director=director;this.devices=devices.map(d=>({...d,approach:{...d.approach}}));this.plate=plate;}
 /** Running because someone is working with it (chores.ts): nobody comes to switch it off. */
 readonly operated=new Set<string>();
 operate(id:string,on:boolean){if(on){this.operated.add(id);this.on.add(id);this.assignments.delete(id);}else{this.operated.delete(id);this.on.delete(id);}}
 /** The floor point in front of the device. */
 spot(d:DeviceDef):Position{return {x:d.approach.x,y:this.plate(d.floor),z:d.approach.z};}
 near(p:Position){return this.devices.find(d=>floorOf(p.y)===d.floor&&flat(d,p)<USE_RADIUS);}
 prompt(p:Position){const d=this.near(p);return d?`E ${d.label}を${this.on.has(d.id)?'消す':'点ける'}`:'';}
 toggle(p:Position){const d=this.near(p);if(!d||this.operated.has(d.id))return null;if(this.on.has(d.id))this.off(d);else{this.on.add(d.id);this.calledAt.set(d.id,-Infinity);}return d;}
 private off(d:DeviceDef){this.on.delete(d.id);this.assignments.delete(d.id);}
 step(dt:number){this.clock+=dt;this.notices=[];
  for(const d of this.devices){
   if(!this.on.has(d.id)||this.operated.has(d.id))continue;
   const at=this.spot(d),job=this.assignments.get(d.id),n=job?.npc;
   const near=!!n&&flat(n.pos,at)<.8&&Math.abs(n.pos.y-at.y)<.5&&
    segmentClear(this.director.boxes,{...n.pos,y:n.pos.y+.25},{...at,y:at.y+.25});
   if(job&&n?.active&&!n.busy&&!n.scriptedGoal&&n.state==='distracted'&&n.goal===job.goal&&(!n.arrived||near)){
    // Keep the investigation alive while the responder walks, then apply the device's usual wait.
    n.timer=Math.max(n.timer,1);
    if(!near){job.standing=0;continue;}
    n.heading=Math.atan2(d.x-n.pos.x,d.z-n.pos.z);
    job.standing+=dt;
    if(job.standing>=DEVICE_KINDS[d.kind].stay){
     this.off(d);
     n.timer=Math.min(n.timer,1);
     this.notices.push(`${n.label}が${d.label}を消した。`);
    }
    continue;
   }
   // A different investigation, an interruption or an unreachable approach frees the device.
   this.assignments.delete(d.id);
   if(this.clock-(this.calledAt.get(d.id)??-Infinity)<CALL_EVERY)continue;
   this.calledAt.set(d.id,this.clock);
   const replacement=this.director.noise(at,undefined,DEVICE_KINDS[d.kind].radius,
    candidate=>!candidate.scriptedGoal&&candidate.state!=='distracted');
   if(replacement?.goal)this.assignments.set(d.id,{npc:replacement,goal:replacement.goal,standing:0});
  }
 }
 snapshot(){return {on:[...this.on],responders:Object.fromEntries([...this.responders].map(([k,n])=>[k,n.id]))};}
}

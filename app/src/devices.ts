import type {Director,Npc} from './ai.ts';
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
 readonly on=new Set<string>();readonly responders=new Map<string,Npc>();
 private calledAt=new Map<string,number>();private standing=new Map<string,number>();private clock=0;
 /** What happened, for the HUD (cleared every step). */
 notices:string[]=[];
 readonly director:Director;readonly devices:DeviceDef[];readonly plate:(floor:number)=>number;
 // Own copies: a device can be carried about (chores.ts moves the vacuum) without touching the map data.
 constructor(director:Director,devices:DeviceDef[],plate:(floor:number)=>number){this.director=director;this.devices=devices.map(d=>({...d,approach:{...d.approach}}));this.plate=plate;}
 /** Running because someone is working with it (chores.ts): nobody comes to switch it off. */
 readonly operated=new Set<string>();
 operate(id:string,on:boolean){if(on){this.operated.add(id);this.on.add(id);this.responders.delete(id);this.standing.delete(id);}else{this.operated.delete(id);this.on.delete(id);}}
 /** The floor point in front of the device. */
 spot(d:DeviceDef):Position{return {x:d.approach.x,y:this.plate(d.floor),z:d.approach.z};}
 near(p:Position){return this.devices.find(d=>floorOf(p.y)===d.floor&&flat(d,p)<USE_RADIUS);}
 prompt(p:Position){const d=this.near(p);return d?`E ${d.label}を${this.on.has(d.id)?'消す':'点ける'}`:'';}
 toggle(p:Position){const d=this.near(p);if(!d||this.operated.has(d.id))return null;if(this.on.has(d.id))this.off(d);else{this.on.add(d.id);this.calledAt.set(d.id,-Infinity);}return d;}
 private off(d:DeviceDef){this.on.delete(d.id);this.responders.delete(d.id);this.standing.delete(d.id);}
 step(dt:number){this.clock+=dt;this.notices=[];
  for(const d of this.devices){if(!this.on.has(d.id)||this.operated.has(d.id))continue;const at=this.spot(d);let n=this.responders.get(d.id);
   // The one walking over gave up (alerted, knocked out, called away): someone else may come.
   if(n&&(!n.active||!['distracted','curious'].includes(n.state))){this.responders.delete(d.id);this.standing.delete(d.id);n=undefined;}
   if(!n){if(this.clock-(this.calledAt.get(d.id)??-Infinity)<CALL_EVERY)continue;this.calledAt.set(d.id,this.clock);n=this.director.noise(at,undefined,DEVICE_KINDS[d.kind].radius);if(n&&n.goal)this.responders.set(d.id,n);continue;}
   // Keep them coming until it is off (the noise look would otherwise time out on the way).
   if(n.state==='distracted'&&n.timer<1)n.timer=1;
   if(flat(n.pos,at)<.8&&Math.abs(n.pos.y-at.y)<1){n.heading=Math.atan2(d.x-n.pos.x,d.z-n.pos.z);const t=(this.standing.get(d.id)??0)+dt;this.standing.set(d.id,t);
    if(t>=DEVICE_KINDS[d.kind].stay){this.off(d);n.timer=Math.min(n.timer,1);this.notices.push(`${n.label}が${d.label}を消した。`);}}}}
 snapshot(){return {on:[...this.on],responders:Object.fromEntries([...this.responders].map(([k,n])=>[k,n.id]))};}
}

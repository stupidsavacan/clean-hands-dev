// 2026-11-10 (Issue #1): HITMAN's VIP protection as a shared engine part (moved out of club/chances.ts). Which NPC is
// protected, who their escort is, the safe rooms and every number come from the map's data (club: club-stage3.json
// `vip`). Parts switched off in the data (`escape`, `searchEnforcers` in the club) stay off.
//  - lockdown: a shot, a scream, a body or a crime near the target sends them to the farther safe room, up to `guards`
//    guards (their escort first) take the posts round it, and after `holdSeconds` everyone goes back to the schedule.
//  - escortCheck: the target down (dead or out cold): after `seconds` the nearest guard goes to look; if the body is
//    still not found, `widenGuards` more search round the spot.
//  - escape (off in the club): after `afterLockdowns` lockdowns the target runs for `exit` instead; reaching it fails.
//  - searchEnforcers (on in the club since 2026-11-10): a dead or unconscious body found (not an accident) makes every
//    guard see through every outfit for a while (HD16).
import type {Director,Npc} from '../ai.ts';
import type {M3System} from '../m3.ts';
import type {MissionClock} from '../schedule.ts';
import type {MissionEvents} from '../events.ts';
import type {Position} from '../world.ts';
import type {Errands} from './errands.ts';

export type SafeRoom={id:string;label:string;at:Position;posts:Position[]};
export type VipConfig={
 /** The protected NPC and their escort (NPC ids of the map). */
 target:string;escort?:string;
 lockdown:{enabled:boolean;guards:number;guardRadius:number;gunshotSmall:number;gunshotLoud:number;screamRadius:number;holdSeconds:number;rooms:SafeRoom[]};
 escortCheck:{enabled:boolean;seconds:number;widenSeconds:number;widenGuards:number;widenRadius:number};
 escape:{enabled:boolean;afterLockdowns:number;exit:Position};
 searchEnforcers:{enabled:boolean;seconds:number};
};
export type AlarmReason='gunshot'|'scream'|'body'|'witness';
const SOURCE='vip';

export class VipProtection{
 readonly target:Npc;readonly escort:Npc|undefined;
 escaped=false;
 private lockdown:{room:SafeRoom;posts:Map<Npc,Position>;holdUntil:number|null}|null=null;
 private lockdowns=0;
 private down:{pos:Position;time:number;phase:number}|null=null;
 private fleeing=false;
 private searchUntil=-Infinity;
 private readonly searchFaces=new Map<Npc,string[]>();
 /** Called before the target runs (the map ends its own scenes then), and for the lines shown on screen. */
 onLockdown?:()=>void;
 private readonly director:Director;private readonly m3:M3System;private readonly clock:MissionClock;private readonly errands:Errands;
 readonly config:VipConfig;private readonly flag:(id:string,reason?:string)=>void;private readonly say:(text:string)=>void;
 constructor(director:Director,m3:M3System,clock:MissionClock,events:MissionEvents,errands:Errands,config:VipConfig,
  flag:(id:string,reason?:string)=>void,say:(text:string)=>void){
  this.director=director;this.m3=m3;this.clock=clock;this.errands=errands;this.config=config;this.flag=flag;this.say=say;
  const find=(id:string)=>director.npcs.find(n=>n.id===id);
  const target=find(config.target);if(!target)throw new Error('要人のNPCがありません: '+config.target);
  this.target=target;this.escort=config.escort?find(config.escort):undefined;
  events.on(e=>{if(e.type==='body.found'&&e.judgement!=='accident'&&config.searchEnforcers.enabled)this.startSearch();});
 }
 get lockedDown(){return !!this.lockdown;}
 /** A body found by the target or their escort alarms them (the engine calls this from m3.onFound). */
 bodyFound(_body:Npc,witness:Npc){if(witness===this.target||witness===this.escort)this.alarm(_body.pos,'body');}
 /** Something near the target: a shot (kind small/loud), a crowd's scream, a body, the target seeing a crime. */
 alarm(at:Position,reason:AlarmReason,kind:'small'|'loud'='small'){
  const l=this.config.lockdown,n=this.target;
  if(!l.enabled||n.life!=='active'||n.busy||this.lockdown||this.fleeing)return;
  const range=reason==='gunshot'?(kind==='small'?l.gunshotSmall:l.gunshotLoud):reason==='scream'?l.screamRadius:Infinity;
  if(Math.hypot(n.pos.x-at.x,n.pos.z-at.z)>range||Math.abs(n.pos.y-at.y)>4)return;
  this.startLockdown(at,reason);
 }
 private startLockdown(at:Position,reason:string){
  const v=this.config,n=this.target,d=this.director;
  this.onLockdown?.();
  if(v.escape.enabled&&this.lockdowns>=v.escape.afterLockdowns){
   n.state='flee';n.goal={...v.escape.exit};n.arrived=false;n.timer=1e9;n.suspicion=0;this.fleeing=true;
   this.flag('target_fleeing',reason);this.say(`${n.label}が車へ逃げ出した！`);return;
  }
  // The safe room farther from the trouble (a floor apart counts as ten metres).
  const far=(r:SafeRoom)=>Math.hypot(r.at.x-at.x,r.at.z-at.z)+Math.abs(r.at.y-at.y)/3.5*10;
  const room=[...v.lockdown.rooms].sort((a,b)=>far(b)-far(a))[0];
  if(!room)return;
  // The target runs there (the flee state keeps them deaf to further alarms on the way).
  n.state='flee';n.goal={...room.at};n.arrived=false;n.timer=1e9;n.suspicion=0;
  const dist=(m:Npc)=>Math.hypot(m.pos.x-n.pos.x,m.pos.z-n.pos.z);
  const guards=d.npcs.filter(m=>m.active&&!m.busy&&m.guard&&m.state!=='combat'&&dist(m)<v.lockdown.guardRadius)
   .sort((a,b)=>(a===this.escort?-1:b===this.escort?1:0)||dist(a)-dist(b)).slice(0,v.lockdown.guards);
  const posts=new Map<Npc,Position>();
  guards.forEach((m,i)=>{
   const post=this.free(room.posts[i%room.posts.length]);if(!post)return;
   m.state='patrol';m.goal=null;m.arrived=false;m.suspicion=Math.min(m.suspicion,d.rules.thresholds.curious-1);
   this.errands.send(m,SOURCE,post,'idle',Math.atan2(post.x-room.at.x,post.z-room.at.z));
   posts.set(m,post);
  });
  this.lockdown={room,posts,holdUntil:null};this.lockdowns++;
  this.flag('vip_lockdown',reason);
  this.say(`${n.label}が${room.label}へ避難する。警備が囲んでいる。`);
 }
 /** A standing spot at or near `at` (posts may sit on furniture once the layout moves). */
 free(at:Position):Position|null{
  const w=this.director.world;
  for(let r=0;r<=1.2;r+=.4)for(let k=0;k<(r?8:1);k++){
   const x=at.x+Math.sin(k*Math.PI/4)*r,z=at.z+Math.cos(k*Math.PI/4)*r,y=w.surface(x,z,at.y);
   if(y!==null&&!w.blocked(x,y,z))return {x,y,z};
  }
  return null;
 }
 private endLockdown(){
  if(!this.lockdown)return;
  this.errands.releaseAll(SOURCE);
  const n=this.target;if(n.active&&n.state==='flee'){n.state='patrol';n.goal=null;n.arrived=false;}
  this.lockdown=null;
  this.flag('vip_lockdown_end');
 }
 step(time:number){
  const v=this.config,n=this.target,d=this.director,l=this.lockdown;
  if(l){
   if(n.life!=='active')this.endLockdown();
   else if(l.holdUntil===null&&Math.hypot(n.pos.x-l.room.at.x,n.pos.z-l.room.at.z)<1&&Math.abs(n.pos.y-l.room.at.y)<.5)l.holdUntil=time+v.lockdown.holdSeconds;
   else if(l.holdUntil!==null&&time>=l.holdUntil)this.endLockdown();
   // Nothing else moves them while running or holding (a flee that ended early is put back on course).
   else if(n.state!=='flee'){n.state='flee';n.goal={...l.room.at};n.arrived=l.holdUntil!==null;n.timer=1e9;}
  }
  // The target noticed a crime themselves (the AI put them in 'report').
  if(!this.lockdown&&n.active&&(n.state==='report'||n.witness))this.alarm(n.pos,'witness');
  if(this.fleeing&&n.active&&!this.escaped&&Math.hypot(n.pos.x-v.escape.exit.x,n.pos.z-v.escape.exit.z)<1.2){this.escaped=true;this.flag('target_escaped');}
  const c=v.escortCheck;
  if(c.enabled&&n.life!=='active'){
   if(!this.down)this.down={pos:{...n.pos},time,phase:0};
   const dn=this.down,found=this.m3.deadFound.has(n.id)||this.m3.unconsciousFound.has(n.id);
   const gap=(m:Npc)=>Math.hypot(m.pos.x-dn.pos.x,m.pos.z-dn.pos.z);
   const guards=()=>d.npcs.filter(m=>m.active&&!m.busy&&m.guard&&['patrol','curious','distracted'].includes(m.state))
    .sort((a,b)=>(a===this.escort?-1:b===this.escort?1:0)||gap(a)-gap(b));
   if(found)dn.phase=Math.max(dn.phase,2);
   else if(dn.phase===0&&time>=dn.time+c.seconds){
    dn.phase=1;const g=guards()[0];
    if(g){this.errands.clear(g);g.radio(dn.pos,d.rules);this.flag('vip_check',g.id);this.say(`${g.label}が${n.label}の様子を見に行く。`);}
   }else if(dn.phase===1&&time>=dn.time+c.seconds+c.widenSeconds){
    dn.phase=2;
    guards().slice(0,c.widenGuards).forEach((g,i)=>{
     const a=i*2.4+1,spot=this.free({x:dn.pos.x+Math.sin(a)*c.widenRadius,y:dn.pos.y,z:dn.pos.z+Math.cos(a)*c.widenRadius})??dn.pos;
     this.errands.clear(g);g.radio(spot,d.rules);
    });
    this.flag('vip_search');this.say(`警備が${n.label}を探している。`);
   }
  }
  if(this.searchFaces.size&&time>=this.searchUntil){
   for(const [g,added] of this.searchFaces)for(const o of added){const i=g.knowsFaces.indexOf(o);if(i>=0)(g.knowsFaces as string[]).splice(i,1);}
   this.searchFaces.clear();
  }
 }
 private startSearch(){
  const d=this.director,outfits=Object.keys(d.rules.disguises);
  this.searchUntil=this.clock.elapsed+this.config.searchEnforcers.seconds;
  for(const g of d.npcs)if(g.guard&&g.active){
   const added=outfits.filter(o=>!g.knowsFaces.includes(o));
   (g.knowsFaces as string[]).push(...added);
   this.searchFaces.set(g,[...(this.searchFaces.get(g)??[]),...added]);
  }
  this.flag('search_enforcers');
 }
}

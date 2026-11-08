import {zoneAt,type Director,type Npc,type PlayerView} from '../ai.ts';
import type {M3System} from '../m3.ts';
import type {M4System} from '../m4.ts';
import type {MissionClock,ScheduleSystem} from '../schedule.ts';
import type {MissionEvents} from '../events.ts';
import type {ClubCrowd} from './crowd.ts';
import {Chances,type ChancesData} from '../chances.ts';
import {judgeKill,markDead,type KillRecord} from '../kills.ts';
import {segmentClear} from '../sight.ts';
import {floorOf,type Position} from '../world.ts';
import actions from '../data/club-actions.json' with {type:'json'};
import config from '../data/club-stage3.json' with {type:'json'};

type Act=typeof config.acts[number];
type Drop={kind:'drop';due:number;waypoint:number;pressed:boolean};
type Meeting={kind:'meet';due:number;waypoint:number;arrivedAt:number|null};
const dockAction='meet_dock';
const formatTime=(time:number)=>`${Math.floor(time/60)}:${String(time%60).padStart(2,'0')}`;

export class ClubChances {
 readonly director:Director;readonly m3:M3System;readonly m4:M4System;readonly clock:MissionClock;readonly events:MissionEvents;
 readonly chances:Chances;
 readonly flags=new Set<string>();readonly kills:KillRecord[]=[];
 private readonly investor:Npc;private readonly escort:Npc;
 private readonly schedule:ScheduleSystem;
 private readonly dockWorker:Npc;
 private readonly dockWorkerWait:Position;
 private readonly deaths=new Set<string>();
 private readonly drops=new Set<number>();
 private scene:Drop|Meeting|null=null;
 private naturalAttempted=false;
 private meetingHeld=false;
 private released=true;
 private lastDisguise='';
 private blackoutUntil=-Infinity;
 private targetDown=false;
 // HITMAN's VIP protection (config.vip). lockdown: the target taken to a safe room with up to four guards round them.
 private lockdown:{room:typeof config.vip.lockdown.rooms[number];escorts:Map<Npc,Position>;holdUntil:number|null}|null=null;
 private lockdowns=0;
 // Escort check: where and when the target stopped (dead or out cold), and how far the check has gone (0 none, 1 one
 // guard sent, 2 the wider search).
 private down:{pos:Position;time:number;phase:number}|null=null;
 // Escape (off): the target running for the car, and whether they got there.
 private fleeing=false;
 escaped=false;
 // Searching (off): until when every guard sees through every outfit, and the outfits added to each guard.
 private searchUntil=-Infinity;
 private readonly searchFaces=new Map<Npc,string[]>();
 private gathered:{npc:Npc;until:number}[]=[];
 onTargetDown?:(at:Position,time:number)=>void;
 action:{id:string;elapsed:number;duration:number;start:Position;tool?:string}|null=null;
 poison=1;notices:string[]=[];reactionText='';reactionUntil=0;

 constructor(d:Director,m3:M3System,m4:M4System,c:MissionClock,e:MissionEvents,data:ChancesData,schedule:ScheduleSystem){
  this.director=d;this.m3=m3;this.m4=m4;this.clock=c;this.events=e;this.chances=new Chances(data,e);
  this.investor=d.npcs.find(n=>n.id==='investor')!;
  this.escort=d.npcs.find(n=>n.id==='escort')!;
  this.schedule=schedule;
  this.dockWorker=d.npcs.find(n=>n.id===config.meet.dockWorker)!;
  this.dockWorkerWait=schedule.places[config.meet.dockWorkerWaitPlace];
  for(const cl of actions.clothes)m4.clothes.push(structuredClone(cl));
  m4.extraInventory=()=>this.poison?['poison_lethal']:[];
  e.on(event=>{
   // Searching (config.vip.searchEnforcers, off): a murdered body found puts every guard on the lookout for any outfit.
   if(event.type==='body.found'&&event.judgement!=='accident'&&config.vip.searchEnforcers.enabled)this.startSearch();
   if(event.type!=='dialogue.heard')return;
   if(event.id==='drop_tech'){
    this.flag('drop_tech');
    this.discover('drop_clue');
   }else if(event.id==='drop_mic'||event.id==='drop_mic_late')this.discover('drop_clue');
   else if(event.id==='meet_rumor')this.discover('meet_clue');
   else if(event.id==='meet_clue')this.flag('meet_hint');
  });
 }
 get locked(){return !!this.action;}
 get tampering(){return this.action?.id==='drop_wires'||this.action?.id==='drop_lights';}
 get progress(){return this.action?this.action.elapsed/this.action.duration:0;}
 get blackout(){return this.clock.elapsed<this.blackoutUntil;}
 applyBlackout(crowd:ClubCrowd){
  const dark=this.blackout;
  if(!dark&&crowd.floorSightScale===1)return;
  const {zone,sightScale}=config.drop.blackout;
  crowd.floorSightScale=dark?sightScale:1;
  for(const n of this.director.npcs)n.visionScale=dark&&zoneAt(this.director.mission.zones,n.pos.x,n.pos.z,floorOf(n.pos.y))?.id===zone?sightScale:1;
 }
 private flag(id:string,reason?:string){
  this.flags.add(id);
  this.events.emit({type:'flag.set',time:this.clock.elapsed,id,reason});
 }
 private discover(id:string){if(!this.chances.facts.some(e=>e.type==='dialogue.heard'&&e.id===id))this.events.emit({type:'dialogue.heard',time:this.clock.elapsed,id});}
 private close(a:Position,b:Position,r:number){return Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y)<=r;}
 private near(a:Position,b:Position){
  return this.close(a,b,actions.radius)&&segmentClear(this.director.boxes,{...a,y:a.y+1.1},{...b,y:b.y+1.1});
 }
 private unsafe(){
  return this.m3.hotel.level>=config.meet.blockAlert||this.investor.state!=='patrol'||this.investor.busy;
 }
 private blocked(act:Act,p:PlayerView){
  if(act.id!=='meet_call')return '';
  if(!config.meet.callerDisguises.includes(p.disguise))return '内線は店長か用心棒の服で使える。';
  if(this.flags.has('meet_call'))return '内線はもう使った。';
  if(this.clock.elapsed>=config.meet.time||this.meetingHeld||!this.investor.active)return '今は投資家を呼び出せない。';
  return this.unsafe()?'投資家は警戒している。今は内線に応じない。':'';
 }
 private spot(p:PlayerView){
  let best:Act|undefined,nearest=Infinity;
  for(const a of config.acts){
   if(a.id!=='meet_call'&&this.flags.has(a.id))continue;
   const distance=Math.hypot(p.x-a.at.x,p.z-a.at.z,p.y-a.at.y);
   if(distance<nearest&&this.near(p,a.at)){best=a;nearest=distance;}
  }
  return best;
 }
 prompt(p:PlayerView){
  if(this.action)return {text:'E 長押し 操作中…',progress:this.progress};
  const spot=this.spot(p);
  if(!spot)return null;
  const tool=spot.tool&&this.m3.heldItem?.()===spot.tool.item?spot.tool:undefined;
  return {text:this.blocked(spot,p)||`E 長押し ${tool?.label??spot.label}`,progress:0};
 }
 step(dt:number,p:PlayerView,keys:Set<string>,suppressed=false){
  this.notices=[];
  const held=keys.has('KeyE');
  if(!held)this.released=true;
  if(this.lastDisguise!==this.m4.disguise){
   this.lastDisguise=this.m4.disguise;
   this.events.emit({type:'disguise.changed',time:this.clock.elapsed,id:this.m4.disguise});
  }
  if(this.action){
   const a=this.action,spot=this.spot(p);
   if(suppressed||!held||spot?.id!==a.id||!this.near(p,a.start)||this.blocked(spot,p)||a.tool&&this.m3.heldItem?.()!==a.tool){this.action=null;this.released=false;return true;}
   a.elapsed+=dt;
   if(a.elapsed>=a.duration){if(a.tool)this.events.emit({type:'item.used',time:this.clock.elapsed,id:a.tool});this.complete(spot);this.action=null;this.released=false;}
   return true;
  }
  if(suppressed||!held||!this.released)return false;
  const spot=this.spot(p);
  if(!spot||this.blocked(spot,p))return false;
  const tool=spot.tool&&this.m3.heldItem?.()===spot.tool.item?spot.tool:undefined;
  this.action={id:spot.id,elapsed:0,duration:tool?.seconds??spot.seconds,start:{x:p.x,y:p.y,z:p.z},tool:tool?.item};
  return true;
 }
 private complete(spot:Act){
  this.flag(spot.id);
  switch(spot.id){
   case 'drop_wires':this.notices.push('配線を外した。12:00か24:00に投資家がボタンを押す。');break;
   case 'drop_lights':this.notices.push('照明を仕込んだ。ドロップの瞬間にフロアが暗くなる。');break;
   case 'meet_note':this.discover('meet_clue');this.say('机のメモ「18時、搬入口。相手は車で来る」');break;
   case 'meet_call':{
    const due=Math.min(config.meet.time,this.clock.elapsed+config.meet.callSeconds);
    if(this.scene?.kind==='meet')this.scene.due=due;
    else this.startMeeting(due);
    this.say('「相手が早く着いた」― 投資家が搬入口へ向かう。');
    break;
   }
  }
 }
 // The target down (playtest 2026-11-03): an assassination is not an ordinary death. The escort and nearby guards
 // stand over the body and the people close by come to look, facing it; the dancers near it stop and turn. Only those
 // who see it happen (the target still on their feet) react (a quiet kill in the dock draws nobody). Nobody is told who did it, so an accident stays an
 // accident. They go back to their evening after 45 s.
 private gatherAround(at:Position,time:number){
  const d=this.director,w=d.world;
  const fallen={...at,floor:floorOf(at.y),disguise:'',speed:0,running:false,crouched:false,tampering:false} as PlayerView;
  const sees=(m:Npc)=>{const r={reason:'',visibility:0,distance:0,blockedBy:[] as string[]};m.perceive(fallen,d.boxes,d.rules,r);return r.visibility>0;};
  const near=d.npcs.filter(m=>m!==this.investor&&m.active&&!m.busy&&['patrol','curious','distracted'].includes(m.state)&&
   Math.abs(m.pos.y-at.y)<1.5&&Math.hypot(m.pos.x-at.x,m.pos.z-at.z)<16&&sees(m))
   .sort((a,b)=>Math.hypot(a.pos.x-at.x,a.pos.z-at.z)-Math.hypot(b.pos.x-at.x,b.pos.z-at.z)).slice(0,8);
  this.gathered=[];
  near.forEach((m,i)=>{
   const r=m.guard?1.1:1.7+(i%3)*.45,start=Math.atan2(m.pos.x-at.x,m.pos.z-at.z);
   for(let k=0;k<12;k++){
    const a=start+(k%2?1:-1)*Math.ceil(k/2)*.5,x=at.x+Math.sin(a)*r,z=at.z+Math.cos(a)*r,y=w.surface(x,z,at.y);
    if(y===null||w.blocked(x,y,z))continue;
    this.goal(m,{x,y,z},'idle',Math.atan2(at.x-x,at.z-z));this.gathered.push({npc:m,until:time+45});break;
   }
  });
  if(!near.length)return;
  this.say('投資家が倒れた。周りの人が驚いて駆け寄る。');
  this.onTargetDown?.(at,time);
 }
 // A disturbance near the target: a gunshot (kind small/loud), a crowd's scream, a body the target or escort found, or
 // the target witnessing a crime. Starts the lockdown when the target is near enough to notice (config.vip.lockdown).
 // A body found by the target or their escort alarms them (the engine calls this from m3.onFound).
 bodyFound(body:Npc,witness:Npc){if(witness===this.investor||witness.securityRole==='escort')this.alarm(body.pos,'body');}
 alarm(at:Position,reason:'gunshot'|'scream'|'body'|'witness',kind:'small'|'loud'='small'){
  const v=config.vip,n=this.investor,l=v.lockdown;
  if(!l.enabled||n.life!=='active'||n.busy||this.lockdown||this.fleeing)return;
  const range=reason==='gunshot'?(kind==='small'?l.gunshotSmall:l.gunshotLoud):reason==='scream'?l.screamRadius:Infinity;
  if(Math.hypot(n.pos.x-at.x,n.pos.z-at.z)>range||Math.abs(n.pos.y-at.y)>4)return;
  this.startLockdown(at,reason);
 }
 private startLockdown(at:Position,reason:string){
  const v=config.vip,n=this.investor,d=this.director;
  this.clearScene();
  // Escape (off): after enough lockdowns the target makes for the car instead of a safe room.
  if(v.escape.enabled&&this.lockdowns>=v.escape.afterLockdowns){
   n.state='flee';n.goal={...v.escape.exit};n.arrived=false;n.timer=1e9;n.suspicion=0;this.fleeing=true;
   this.flag('target_fleeing',reason);this.say('投資家が車へ逃げ出した！');return;
  }
  // The safe room farther from the trouble (a floor apart counts as ten metres).
  const far=(r:{at:Position})=>Math.hypot(r.at.x-at.x,r.at.z-at.z)+Math.abs(r.at.y-at.y)/3.5*10;
  const room=[...v.lockdown.rooms].sort((a,b)=>far(b)-far(a))[0];
  // The target runs there (the flee state keeps them deaf to further alarms on the way).
  n.state='flee';n.goal={...room.at};n.arrived=false;n.timer=1e9;n.suspicion=0;
  // Up to four guards nearest the target, their own escort first, leave what they were doing and take the posts.
  const dist=(m:Npc)=>Math.hypot(m.pos.x-n.pos.x,m.pos.z-n.pos.z);
  const escorts=d.npcs.filter(m=>m.active&&!m.busy&&m.guard&&m.state!=='combat'&&dist(m)<v.lockdown.guardRadius)
   .sort((a,b)=>(a===this.escort?-1:b===this.escort?1:0)||dist(a)-dist(b))
   .slice(0,v.lockdown.guards);
  const posts=new Map<Npc,Position>();
  escorts.forEach((m,i)=>{
   const post=this.free(room.posts[i%room.posts.length]);if(!post)return;
   m.state='patrol';m.goal=null;m.arrived=false;m.suspicion=Math.min(m.suspicion,d.rules.thresholds.curious-1);
   this.goal(m,post,'idle',Math.atan2(post.x-room.at.x,post.z-room.at.z));
   posts.set(m,post);
  });
  this.lockdown={room,escorts:posts,holdUntil:null};this.lockdowns++;
  this.flag('vip_lockdown',reason);
  this.say(`投資家が${room.label}へ避難する。警備が囲んでいる。`);
 }
 // A standing spot at or near `at` (posts may sit on furniture once the layout moves).
 private free(at:Position):Position|null{
  const w=this.director.world;
  for(let r=0;r<=1.2;r+=.4)for(let k=0;k<(r?8:1);k++){
   const x=at.x+Math.sin(k*Math.PI/4)*r,z=at.z+Math.cos(k*Math.PI/4)*r,y=w.surface(x,z,at.y);
   if(y!==null&&!w.blocked(x,y,z))return {x,y,z};
  }
  return null;
 }
 private endLockdown(){
  if(!this.lockdown)return;
  for(const [m,post] of this.lockdown.escorts)if(m.scriptedGoal===post)this.goal(m,null);
  const n=this.investor;if(n.active&&n.state==='flee'){n.state='patrol';n.goal=null;n.arrived=false;}
  this.lockdown=null;
  this.flag('vip_lockdown_end');
 }
 private stepVip(time:number){
  const v=config.vip,n=this.investor,d=this.director;
  // Lockdown: hold once the target reaches the room; end after holdSeconds or if the target falls.
  const l=this.lockdown;
  if(l){
   if(n.life!=='active')this.endLockdown();
   else if(l.holdUntil===null&&Math.hypot(n.pos.x-l.room.at.x,n.pos.z-l.room.at.z)<1&&Math.abs(n.pos.y-l.room.at.y)<.5)l.holdUntil=time+v.lockdown.holdSeconds;
   else if(l.holdUntil!==null&&time>=l.holdUntil)this.endLockdown();
   // Nothing else moves them while running or holding (a flee that ended early is put back on course).
   else if(n.state!=='flee'){n.state='flee';n.goal={...l.room.at};n.arrived=l.holdUntil!==null;n.timer=1e9;}
  }
  // The target noticed a crime themselves (the AI put them in 'report').
  if(!this.lockdown&&n.active&&(n.state==='report'||n.witness))this.alarm(n.pos,'witness');
  // Escape (off): reaching the car fails the mission (main.ts reads `escaped`).
  if(this.fleeing&&n.active&&!this.escaped&&Math.hypot(n.pos.x-v.escape.exit.x,n.pos.z-v.escape.exit.z)<1.2){this.escaped=true;this.flag('target_escaped');}
  // Escort check: the target stopped (dead or out cold). After `seconds` the nearest guard, their escort first, goes
  // to where they were last; if the body is not found there, `widenGuards` more search round it.
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
    if(g){this.goal(g,null);g.radio(dn.pos,d.rules);this.flag('vip_check',g.id);this.say(`${g.label}が投資家の様子を見に行く。`);}
   }else if(dn.phase===1&&time>=dn.time+c.seconds+c.widenSeconds){
    dn.phase=2;
    guards().slice(0,c.widenGuards).forEach((g,i)=>{
     const a=i*2.4+1,spot=this.free({x:dn.pos.x+Math.sin(a)*c.widenRadius,y:dn.pos.y,z:dn.pos.z+Math.cos(a)*c.widenRadius})??dn.pos;
     this.goal(g,null);g.radio(spot,d.rules);
    });
    this.flag('vip_search');this.say('警備が投資家を探している。');
   }
  }
  // Searching (off): when it runs out, the guards forget the outfits they were given.
  if(this.searchFaces.size&&time>=this.searchUntil){
   for(const [g,added] of this.searchFaces)for(const o of added){const i=g.knowsFaces.indexOf(o);if(i>=0)(g.knowsFaces as string[]).splice(i,1);}
   this.searchFaces.clear();
  }
 }
 // Searching (off): every guard sees through every outfit for config.vip.searchEnforcers.seconds.
 private startSearch(){
  const d=this.director,outfits=Object.keys(d.rules.disguises);
  this.searchUntil=this.clock.elapsed+config.vip.searchEnforcers.seconds;
  for(const g of d.npcs)if(g.guard&&g.active){
   const added=outfits.filter(o=>!g.knowsFaces.includes(o));
   (g.knowsFaces as string[]).push(...added);
   this.searchFaces.set(g,[...(this.searchFaces.get(g)??[]),...added]);
  }
  this.flag('search_enforcers');
 }
 private say(text:string){this.reactionText=text;this.reactionUntil=this.clock.elapsed+config.drop.sceneSeconds;}
 private goal(n:Npc,at:Position|null,action='',heading:number|null=null){
  // The trip back to the regular schedule gets a fresh travel budget.
  if(!at&&n.scriptedGoal)this.schedule.states.delete(n.id);
  n.scriptedGoal=at;n.scriptedAction=action;n.scriptedHeading=heading;
 }
 private clearScene(){
  if(this.scene?.kind==='meet')this.goal(this.dockWorker,null);
  this.scene=null;
  this.goal(this.investor,null);
  // An escort standing over the fallen target stays there until the gathering ends.
  if(!this.gathered.some(g=>g.npc===this.escort))this.goal(this.escort,null);
 }
 seek(){
  this.clearScene();
  this.blackoutUntil=-Infinity;
  this.reactionUntil=0;
 }
 private startMeeting(due:number){
  this.clearScene();
  this.scene={kind:'meet',due,waypoint:0,arrivedAt:null};
  this.goal(this.investor,config.meet.kitchen);
  this.goal(this.dockWorker,this.dockWorkerWait,'clean');
 }
 beforeAi(){
  if(!this.investor.active){if(this.scene)this.clearScene();return;}
  const time=this.clock.elapsed,meet=config.meet,drop=config.drop;
  if(!this.naturalAttempted&&time>=meet.time-meet.callSeconds&&time<=meet.time+meet.graceSeconds){
   this.naturalAttempted=true;
   if(!this.meetingHeld&&this.scene?.kind!=='meet'){
    if(this.unsafe())this.flag('meet_cancelled','警戒中');
    else this.startMeeting(meet.time);
   }
  }
  if(this.scene?.kind==='meet'){
   const s=this.scene;
   if(s.arrivedAt===null){
    if(this.unsafe()||time>s.due+meet.graceSeconds){this.flag('meet_cancelled',this.unsafe()?'警戒中':'時間切れ');this.clearScene();}
    else if(s.waypoint===1&&time>=s.due-meet.dockLeadSeconds){
     s.waypoint=2;this.goal(this.investor,meet.dock,dockAction,meet.heading);
    }
   }else if(time>=s.arrivedAt+meet.staySeconds||this.m3.hotel.level>=meet.blockAlert||this.investor.state!=='patrol')this.clearScene();
   return;
  }
  if(this.scene?.kind==='drop'){
   const s=this.scene;
   if(time>s.due+(s.pressed?drop.sceneSeconds:drop.graceSeconds))this.clearScene();
   return;
  }
  const start=drop.times.find(at=>this.clock.time>=at-drop.leadSeconds&&this.clock.time<=at+drop.graceSeconds);
  if(start===undefined)return;
  const due=this.clock.cycle*this.clock.rules.loop+start;
  if(this.drops.has(due))return;
  this.drops.add(due);
  this.scene={kind:'drop',due,waypoint:0,pressed:false};
  this.goal(this.investor,drop.route[0]);
 }
 private arrived(n:Npc,at:Position){
  return n.active&&!n.busy&&n.state==='patrol'&&this.close(n.pos,at,this.clock.rules.arrival);
 }
 afterAi(p:PlayerView){
  const n=this.investor,s=this.scene,time=this.clock.elapsed;
  this.stepVip(time);
  if(!this.targetDown&&n.life!=='active'){this.targetDown=true;this.gatherAround(n.pos,time);}
  if(this.gathered.length&&time>=this.gathered[0].until){for(const g of this.gathered)if(g.npc.active)this.goal(g.npc,null);this.gathered=[];}
  if(s?.kind==='drop'&&!s.pressed&&this.arrived(n,config.drop.route[s.waypoint])){
   if(s.waypoint<config.drop.route.length-1){
    s.waypoint++;
    this.goal(n,config.drop.route[s.waypoint],'idle',config.drop.heading);
    // On the open stage the escort waits beside the decks instead of taking the button's spot (2026-11-03).
    if(s.waypoint===config.drop.route.length-1)this.goal(this.escort,config.drop.escortPost,'idle',config.drop.heading);
   }else if(time>=s.due){
    s.pressed=true;
    this.goal(n,config.drop.route[s.waypoint],'club_press',config.drop.heading);
    n.scheduleAction='club_press';n.actionTime=0;
    this.flag('drop_pressed');
    this.say('DJ「ドロップ！」');
    if(this.flags.has('drop_lights')){
     this.blackoutUntil=time+config.drop.blackout.seconds;
     this.flag('drop_blackout');
     this.say('DJ「ドロップ！」 フロアの照明が落ちた。');
    }
    if(this.flags.has('drop_wires')){
     const method='club_electrocution';
     const judgement=judgeKill(this.director,p,[],false,[n.id],false);
     markDead(n,method,judgement);
     this.kills.push({victim:n.id,method,time,position:{...n.pos},judgement});
     this.flag('drop_accident');
     this.say('ドロップのボタンが火花を散らした。投資家が感電した。');
    }
   }
  }else if(s?.kind==='meet'){
   const m=config.meet;
   if(s.waypoint===0&&this.arrived(n,m.kitchen)){
    s.waypoint=1;this.goal(n,m.hold);this.goal(this.escort,m.escortPost,'idle',Math.PI);
   }else if(s.waypoint===2&&s.arrivedAt===null&&this.arrived(n,m.dock)){
    s.arrivedAt=time;this.meetingHeld=true;
    this.flag('meet_arrived');
    this.say('投資家が搬入口に着いた。護衛は厨房の入口で待っている。');
   }
  }
  for(const victim of this.director.npcs)if(victim.life==='dead'&&!this.deaths.has(victim.id)){
   this.deaths.add(victim.id);
   const {x,y,z}=victim.pos;
   const zone=zoneAt(this.director.mission.zones,x,z,floorOf(y));
   const place=zone?.id==='K'&&zone.minZ>=config.meet.hold.z?'club_dock':undefined;
   this.events.emit({type:'npc.killed',time,id:victim.id,method:victim.deathMethod,judgement:victim.deathKind,place});
  }
 }
 chanceSnapshot(){
  return this.chances.snapshot(this.clock.time,this.clock.rules.loop).map(s=>{
   if(s.id==='meet'){
    const pending=this.scene?.kind==='meet'&&this.scene.arrivedAt===null;
    const over=this.scene?.kind!=='meet'&&(this.meetingHeld||this.clock.elapsed>=config.meet.time);
    const step=s.status==='active'&&over?'密会は終わった。':s.status==='active'&&pending&&this.flags.has('meet_call')?'呼び出した。搬入口で投資家を待つ。':s.step;
    return {...s,step,waitSeconds:pending||over||this.meetingHeld?0:s.waitSeconds};
   }
   const next=config.drop.times.find(t=>this.clock.time<t+config.drop.graceSeconds);
   const due=next??config.drop.times[0]+this.clock.rules.loop;
   return {...s,window:[due,due+config.drop.graceSeconds],waitSeconds:Math.max(0,due-this.clock.time),
    step:s.status==='active'&&this.flags.has('drop_wires')?`投資家がボタンを押すのを待つ（${formatTime(due%this.clock.rules.loop)}）`:s.step};
  });
 }
 snapshot(){return {flags:[...this.flags],kills:this.kills,poison:this.poison,action:this.action,blackout:this.blackout,scene:this.scene&&{...this.scene}};}
}

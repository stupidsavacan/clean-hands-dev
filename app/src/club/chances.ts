// The club's mission script: the DJ drop and the dock meeting (their times, lines, routes and story stay here).
// 2026-11-10 (Issue #1): what any map can use moved to the engine — temporary orders and the return to the schedule
// (engine/errands.ts), VIP protection (engine/vip.ts), the hold-E spots (engine/hold-actions.ts), and the target-down
// gathering and npc.killed events (engine/target-watch.ts). This file only wires them to the club's data.
import {zoneAt,type Director,type Npc,type PlayerView} from '../ai.ts';
import type {M3System} from '../m3.ts';
import type {M4System} from '../m4.ts';
import type {MissionClock,ScheduleSystem} from '../schedule.ts';
import type {MissionEvents} from '../events.ts';
import type {ClubCrowd} from './crowd.ts';
import {Chances,type ChancesData} from '../chances.ts';
import {judgeKill,markDead,type KillRecord} from '../kills.ts';
import {floorOf,type Position} from '../world.ts';
import {Errands} from '../engine/errands.ts';
import {VipProtection,type AlarmReason,type VipConfig} from '../engine/vip.ts';
import {HoldActions,type HoldSpot} from '../engine/hold-actions.ts';
import {KillEvents,TargetWatch} from '../engine/target-watch.ts';
import actions from '../data/club-actions.json' with {type:'json'};
import config from '../data/club-stage3.json' with {type:'json'};

type Drop={kind:'drop';due:number;waypoint:number;pressed:boolean};
type Meeting={kind:'meet';due:number;waypoint:number;arrivedAt:number|null};
const dockAction='meet_dock';
const SCENE='scene';
const formatTime=(time:number)=>`${Math.floor(time/60)}:${String(time%60).padStart(2,'0')}`;

export class ClubChances {
 readonly director:Director;readonly m3:M3System;readonly m4:M4System;readonly clock:MissionClock;readonly events:MissionEvents;
 readonly chances:Chances;
 readonly flags=new Set<string>();readonly kills:KillRecord[]=[];
 readonly errands:Errands;readonly vip:VipProtection;readonly holds:HoldActions;readonly watch:TargetWatch;
 private readonly killEvents:KillEvents;
 private readonly investor:Npc;private readonly escort:Npc;
 private readonly dockWorker:Npc;
 private readonly dockWorkerWait:Position;
 private readonly drops=new Set<number>();
 private scene:Drop|Meeting|null=null;
 private naturalAttempted=false;
 private meetingHeld=false;
 private lastDisguise='';
 private blackoutUntil=-Infinity;
 onTargetDown?:(at:Position,time:number)=>void;
 poison=1;notices:string[]=[];reactionText='';reactionUntil=0;

 constructor(d:Director,m3:M3System,m4:M4System,c:MissionClock,e:MissionEvents,data:ChancesData,schedule:ScheduleSystem){
  this.director=d;this.m3=m3;this.m4=m4;this.clock=c;this.events=e;this.chances=new Chances(data,e);
  this.errands=new Errands(schedule);
  this.vip=new VipProtection(d,m3,c,e,this.errands,config.vip as VipConfig,(id,reason)=>this.flag(id,reason),text=>this.say(text));
  this.vip.onLockdown=()=>this.clearScene();
  this.investor=this.vip.target;this.escort=this.vip.escort!;
  this.dockWorker=d.npcs.find(n=>n.id===config.meet.dockWorker)!;
  this.dockWorkerWait=schedule.places[config.meet.dockWorkerWaitPlace];
  this.holds=new HoldActions(config.acts as HoldSpot[],actions.radius,()=>d.boxes,c,e);
  this.holds.heldItem=()=>m3.heldItem?.();
  this.holds.blocked=(spot,p)=>this.blocked(spot,p);
  this.holds.onComplete=spot=>this.complete(spot);
  this.watch=new TargetWatch(d,this.errands,[this.investor]);
  this.watch.onGathered=(target,at,time)=>{this.say(`${target.label}が倒れた。周りの人が驚いて駆け寄る。`);this.onTargetDown?.(at,time);};
  this.killEvents=new KillEvents(d,e);
  // The dock is the back alley past the meeting spot (a chance can require a kill there).
  this.killEvents.placeOf=v=>{const zone=zoneAt(d.mission.zones,v.pos.x,v.pos.z,floorOf(v.pos.y));return zone?.id==='K'&&zone.minZ>=config.meet.hold.z?'club_dock':undefined;};
  for(const cl of actions.clothes)m4.clothes.push(structuredClone(cl));
  m4.extraInventory=()=>this.poison?['poison_lethal']:[];
  e.on(event=>{
   if(event.type!=='dialogue.heard')return;
   if(event.id==='drop_tech'){
    this.flag('drop_tech');
    this.discover('drop_clue');
   }else if(event.id==='drop_mic'||event.id==='drop_mic_late')this.discover('drop_clue');
   else if(event.id==='meet_rumor')this.discover('meet_clue');
   else if(event.id==='meet_clue')this.flag('meet_hint');
  });
 }
 get action(){return this.holds.action;}
 get locked(){return !!this.holds.action;}
 get tampering(){return this.holds.action?.id==='drop_wires'||this.holds.action?.id==='drop_lights';}
 get progress(){return this.holds.progress;}
 get escaped(){return this.vip.escaped;}
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
 private unsafe(){
  return this.m3.hotel.level>=config.meet.blockAlert||this.investor.state!=='patrol'||this.investor.busy;
 }
 private blocked(act:HoldSpot,p:PlayerView){
  if(act.id!=='meet_call')return '';
  if(!config.meet.callerDisguises.includes(p.disguise))return '内線は店長か用心棒の服で使える。';
  if(this.flags.has('meet_call'))return '内線はもう使った。';
  if(this.clock.elapsed>=config.meet.time||this.meetingHeld||!this.investor.active)return '今は投資家を呼び出せない。';
  return this.unsafe()?'投資家は警戒している。今は内線に応じない。':'';
 }
 prompt(p:PlayerView){return this.holds.prompt(p);}
 step(dt:number,p:PlayerView,keys:Set<string>,suppressed=false){
  this.notices=[];
  if(this.lastDisguise!==this.m4.disguise){
   this.lastDisguise=this.m4.disguise;
   this.events.emit({type:'disguise.changed',time:this.clock.elapsed,id:this.m4.disguise});
  }
  return this.holds.step(dt,p,keys,suppressed);
 }
 private complete(spot:HoldSpot){
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
 bodyFound(body:Npc,witness:Npc){this.vip.bodyFound(body,witness);}
 alarm(at:Position,reason:AlarmReason,kind:'small'|'loud'='small'){this.vip.alarm(at,reason,kind);}
 private say(text:string){this.reactionText=text;this.reactionUntil=this.clock.elapsed+config.drop.sceneSeconds;}
 private goal(n:Npc,at:Position|null,action='',heading:number|null=null){
  if(at)this.errands.send(n,SCENE,at,action,heading);else this.errands.release(n,SCENE);
 }
 private clearScene(){
  this.scene=null;
  this.errands.releaseAll(SCENE);
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
  this.vip.step(time);
  this.watch.step(time);
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
  this.killEvents.step(time);
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

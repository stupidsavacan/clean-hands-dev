import type {Director,Npc} from './ai.ts';
import type {MissionEvents} from './events.ts';
import {floorOf,type Position} from './world.ts';

export type ScheduleRules={loop:number;indoorTimeout:number;outdoorTimeout:number;arrival:number;fastForward:number;movementSpeed:number};
export type SchedulePlace=Position&{label:string;outdoor:boolean;heading:number};
export type PlanEntry={from:number;to:number;place:string;do:string;with?:string;event?:string};
// standOff: where the escort stands instead while the leader does a given thing (bodyguards step back from the speech).
export type ActorPlan={plan:PlanEntry[];follow?:string;offset?:number[];standOff?:Record<string,number[]>};
export type ScheduleData={actors:Record<string,ActorPlan>};
export type ActorState={id:string;slot:number;cycle:number;place:string;action:string;phase:'moving'|'acting'|'paused'|'inactive'|'away';travel:number;limit:number;timedOut:boolean};
export class MissionClock{
 elapsed=0;rate=1;
 readonly rules:ScheduleRules;readonly events:MissionEvents;
 constructor(rules:ScheduleRules,events:MissionEvents){this.rules=rules;this.events=events;}
 get time(){return this.elapsed%this.rules.loop;}
 get cycle(){return Math.floor(this.elapsed/this.rules.loop);}
 step(dt:number){this.elapsed+=dt;this.events.emit({type:'clock.tick',time:this.elapsed,value:this.time});}
 jump(seconds:number){if(!Number.isFinite(seconds)||seconds<0)throw new Error('時間は0以上の秒数で指定してください');this.elapsed=seconds;this.events.emit({type:'clock.tick',time:this.elapsed,value:this.time});}
 setRate(rate:number){if(rate!==1&&rate!==this.rules.fastForward)throw new Error('早送りは1倍か4倍です');this.rate=rate;}
 snapshot(){return {elapsed:this.elapsed,time:this.time,cycle:this.cycle,rate:this.rate,loop:this.rules.loop};}
}

export function validateSchedule(data:ScheduleData,places:Record<string,SchedulePlace>,director:Director,rules:ScheduleRules){
 const errors:string[]=[];
 for(const [id,actor] of Object.entries(data.actors)){
  if(!director.npcs.some(n=>n.id===id))errors.push(`予定の人物がありません: ${id}`);
  if(actor.follow&&!data.actors[actor.follow])errors.push(`付き添い先がありません: ${id}`);
  let end=0;for(const entry of actor.plan){if(entry.from!==end||entry.to<=entry.from)errors.push(`予定の抜け・重なり: ${id} ${entry.from}`);end=entry.to;if(!places[entry.place])errors.push(`場所がありません: ${entry.place}`);if(entry.with&&!director.npcs.some(n=>n.id===entry.with))errors.push(`会話相手がありません: ${entry.with}`);}
  if(!actor.follow&&end!==rules.loop)errors.push(`予定が一巡しません: ${id}`);
 }
 return errors;
}

export class ScheduleSystem{
 readonly states=new Map<string,ActorState>();
 private readonly actors=new Map<string,Npc>();
 readonly data:ScheduleData;readonly places:Record<string,SchedulePlace>;readonly director:Director;readonly clock:MissionClock;readonly events:MissionEvents;
 constructor(data:ScheduleData,places:Record<string,SchedulePlace>,director:Director,clock:MissionClock,events:MissionEvents){
  this.data=data;this.places=places;this.director=director;this.clock=clock;this.events=events;
  const errors=validateSchedule(data,places,director,clock.rules);if(errors.length)throw new Error(errors.join('\n'));
  for(const id of Object.keys(data.actors)){const n=director.npcs.find(n=>n.id===id)!;n.scheduled=true;n.scheduleSpeed=clock.rules.movementSpeed;this.actors.set(id,n);}
  this.sync(0);
 }
 sync(dt:number){for(const [id,actor] of Object.entries(this.data.actors)){
  const n=this.actors.get(id)!,source=actor.follow?this.data.actors[actor.follow]:actor;
  const slot=source.plan.findIndex(e=>this.clock.time>=e.from&&this.clock.time<e.to),entry=source.plan[slot];
  const old=this.states.get(id),previousPhase=old?.phase,changed=!old||old.slot!==slot||old.cycle!==this.clock.cycle;
  const s:ActorState=changed?{id,slot,cycle:this.clock.cycle,place:entry.place,action:actor.follow?'escort':entry.do,phase:'moving',travel:0,limit:this.places[entry.place].outdoor||this.director.outdoorAt(n.pos)?this.clock.rules.outdoorTimeout:this.clock.rules.indoorTimeout,timedOut:false}:old;
  this.states.set(id,s);n.scheduleAction='';n.scheduleTarget=null;n.scheduleHeading=null;
  n.scheduledAway=entry.do==='absent'&&n.life==='active';if(changed&&n.scheduledAway){n.pos={x:this.places[entry.place].x,y:this.places[entry.place].y,z:this.places[entry.place].z};n.speed=0;}
  if(!n.active){s.phase=n.scheduledAway?'away':'inactive';n.speed=0;continue;}
  if(n.busy||n.state!=='patrol'){s.phase='paused';continue;}
  if(!changed&&old?.phase==='paused'){s.travel=0;s.limit=this.places[entry.place].outdoor||this.director.outdoorAt(n.pos)?this.clock.rules.outdoorTimeout:this.clock.rules.indoorTimeout;s.timedOut=false;s.phase='moving';}
  let goal:Position=n.scriptedGoal??this.places[entry.place];
  // A scripted errand (a chance, a safe room, an evacuation) takes the escort off their leader too.
  if(actor.follow&&!n.scriptedGoal){const leader=this.actors.get(actor.follow)!;if(!leader.active){s.phase='paused';n.speed=0;continue;}goal={...leader.pos};const usual=actor.offset??[1,1],aside=actor.standOff?.[leader.scheduleAction];
   // The stood-back spot if it is open, else the usual one; never onto the leader herself unless both are blocked.
   if(floorOf(n.pos.y)===floorOf(goal.y))for(const o of aside?[aside,usual]:[usual]){const candidate={x:goal.x+o[0],y:goal.y,z:goal.z+o[1]};if(this.director.nav.clear(goal,candidate)){goal=candidate;break;}}}
  const arrived=Math.hypot(n.pos.x-goal.x,n.pos.z-goal.z)<=this.clock.rules.arrival&&Math.abs(n.pos.y-goal.y)<.3;
  if(!arrived&&(!s.timedOut||n.scriptedGoal)){s.travel+=dt;const timeout=s.limit;
   if(s.travel>=timeout&&!actor.follow&&!n.scriptedGoal)s.timedOut=true;else{n.scheduleTarget=goal;s.phase='moving';continue;}}
  s.phase='acting';n.scheduleAction=n.scriptedGoal?n.scriptedAction:s.action;n.scheduleHeading=n.scriptedGoal?n.scriptedHeading??this.places[entry.place].heading:this.places[entry.place].heading;
  if(changed||previousPhase==='moving')this.events.emit({type:'schedule.action',time:this.clock.elapsed,id,value:slot});
 }
 // Chance scenes also give unscheduled bystanders a temporary errand; their normal patrol resumes afterwards.
 for(const n of this.director.npcs){if(this.actors.has(n.id))continue;n.scheduled=!!n.scriptedGoal;if(!n.scriptedGoal)continue;
  n.scheduleSpeed=this.clock.rules.movementSpeed;const arrived=Math.hypot(n.pos.x-n.scriptedGoal.x,n.pos.z-n.scriptedGoal.z)<=this.clock.rules.arrival&&Math.abs(n.pos.y-n.scriptedGoal.y)<.3;
  n.scheduleTarget=arrived?null:n.scriptedGoal;n.scheduleHeading=n.scriptedHeading;n.scheduleAction=arrived?n.scriptedAction:'';}}
 snapshot(){return [...this.states.values()].map(s=>({...s,position:{...this.actors.get(s.id)!.pos}}));}
}

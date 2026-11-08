import { permission, type Director, type Npc, type PlayerView } from '../ai.ts';
import type { Position } from '../world.ts';
import type { IncidentEvent } from '../incidents.ts';

const round = (n:number) => Math.round(n*100)/100;
type CrowdSight = {visible:number;places:string[]};
type Context = {p:PlayerView; time:number; held:string; hand:string; actions:string[]};

export class ClubTrace {
 private enabled=false;
 private pending:unknown[]=[];
 private actions=new Set<string>();
 private nextFoot=0;
 private nextSight=0;
 private drawPending=false;
 private drawReactions=new Map<string,{reaction:string;reason:string;sense:string;distance:number;visibility?:number}>();
 crowdSight?: (p:PlayerView)=>CrowdSight;
 private readonly director:Director;
 constructor(director:Director){this.director=director;}
 get recording(){return this.enabled;}
 drain(enable?:boolean){
  const rows=this.pending;this.pending=[];
  if(enable!==undefined&&enable!==this.enabled){
   this.enabled=enable;this.actions.clear();this.nextFoot=0;this.nextSight=0;
   this.drawPending=false;this.drawReactions.clear();
  }
  return rows;
 }
 private sight(n:Npc,p:PlayerView){
  const reading={reason:'inactive',visibility:0,distance:Math.hypot(n.pos.x-p.x,n.pos.z-p.z),blockedBy:[] as string[]};
  if(n.active&&!n.busy){reading.reason='outside_cone';n.perceive(p,this.director.boxes,this.director.rules,reading);}
  else if(n.busy)reading.reason='busy';
  return {...reading,distance:round(reading.distance)};
 }
 private location(p:PlayerView){
  const area=this.director.zone(p);
  return {x:round(p.x),y:round(p.y),z:round(p.z),floor:p.floor,zone:area?.id??'',disguise:p.disguise};
 }
 action(time:number,p:PlayerView,action:string,phase:'start'|'end',detail?:string){
  if(!this.enabled)return;
  const crowd=phase==='start'?this.crowdSight?.(p)?.places:undefined;
  this.pending.push({kind:'action',t:round(time),action,phase,...this.location(p),detail,crowd});
 }
 instant(time:number,p:PlayerView,action:string,detail?:string){
  this.action(time,p,action,'start',detail);this.action(time,p,action,'end',detail);
 }
 incident(time:number,event:IncidentEvent){
  if(!this.enabled)return;
  const {x,y,z}=event.at;
  this.pending.push({kind:'incident',t:round(time),...event,at:{x:round(x),y:round(y),z:round(z)}});
 }
 reaction(time:number,id:string,role:string,reaction:string,reason:string,sense:'sight'|'sound'|'none',distance:number,at:Position,visibility?:number){
  if(!this.enabled)return;
  if(this.drawPending)this.drawReactions.set(id,{reaction,reason,sense,distance:round(distance),visibility:sense==='sight'?visibility:undefined});
  this.pending.push({kind:'reaction',t:round(time),id,role,reaction,reason,sense,distance:round(distance),visibility:sense==='sight'?visibility:undefined,
                     at:{x:round(at.x),y:round(at.y),z:round(at.z)}});
 }
 before({p,time,actions,hand}:Context){
  if(!this.enabled)return;
  const area=this.director.zone(p);
  const next=new Set(actions);
  if(hand)next.add('draw');
  if(permission(this.director.rules,p.disguise,area)==='deny')next.add('trespass');
  for(const a of this.actions)if(!next.has(a))this.action(time,p,a,'end');
  for(const a of next)if(!this.actions.has(a)){
   this.action(time,p,a,'start');
   if(a==='draw'){this.drawPending=true;this.drawReactions.clear();}
  }
  this.actions=next;
 }
 after({p,time,held,hand}:Context){
  if(!this.enabled)return;
  if(this.drawPending){
   this.drawPending=false;
   const people=this.director.npcs.filter(n=>n.active&&Math.hypot(n.pos.x-p.x,n.pos.z-p.z)<=20).map(n=>{
    const sight=this.sight(n,p),response=this.drawReactions.get(n.id);
    return {id:n.id,name:n.label,role:n.role,reaction:'ignore',...sight,
            reason:sight.visibility?(n.witnessCooldown>0?'witness_cooldown':n.state==='combat'?'already_fighting':'visible_no_new_reaction'):sight.reason,...response};
   });
   this.pending.push({kind:'draw',t:round(time),...this.location(p),people,crowd:this.crowdSight?.(p)});
  }
  if(time+1e-6>=this.nextFoot){
   this.nextFoot=(Math.floor((time+1e-6)*2)+1)/2;
   this.pending.push({kind:'foot',t:round(time),...this.location(p),posture:p.crouched?'crouch':p.running?'run':p.speed>.15?'walk':'stand',held,hand,blend:!!p.blending,actions:[...this.actions]});
  }
  if(time+1e-6>=this.nextSight){
   this.nextSight=Math.floor(time+1e-6)+1;
   const people=[],blocked=[];
   for(const n of this.director.npcs){
    if(!n.active||n.busy)continue;
    const sight=this.sight(n,p);
    if(sight.visibility)people.push([n.id,n.label,n.role,sight.distance,sight.visibility]);
    if(sight.reason==='crowd')blocked.push([n.id,sight.blockedBy]);
   }
   this.pending.push({kind:'sight',t:round(time),...this.location(p),people,blocked,
                      crowd:this.crowdSight?.(p)??{visible:0,places:[]},actions:[...this.actions]});
  }
 }
}

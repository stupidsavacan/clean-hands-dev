import type { Npc, PlayerView } from '../ai.ts';
import type { CombatSystem, Dropped } from '../combat.ts';
import type { M4System } from '../m4.ts';
import { segmentClear } from '../sight.ts';
import type { Position } from '../world.ts';
import { COIN_GRASP,COIN_PICKUP_SECONDS,type CoinPickup } from '../coin-pickup.ts';

const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
type Recovery={drop:Dropped;goal:Npc['goal'];lift?:CoinPickup&{started:number}};
const GRAB_RANGE=.68;

export class ClubWeapons {
 private nextScan=0;
 private recovering=new Map<Npc,Recovery>();
 private readonly retry=new WeakMap<Dropped,Map<Npc,number>>();
 private readonly combat:CombatSystem;
 private readonly m4:M4System;
 private readonly scanSeconds:number;
 onReaction?:(n:Npc,drop:Dropped,action:'collect'|'curious',player?:PlayerView)=>void;

 constructor(combat:CombatSystem,m4:M4System,scanSeconds:number){
  this.combat=combat;
  this.m4=m4;
  this.scanSeconds=scanSeconds;
  m4.restrictPickups=true;
  m4.strictGate=true;
  // Playtest 2026-11-03: two coins drew the frisk guard 5 m off his line and it opened. The entrance pair look at a
  // coin but keep their posts; the line opens only when one is knocked out, killed or busy elsewhere.
  // 2026-11-04 (checkpoint spec): the post is where they start; ai.ts noise() decides when one may still go and look.
  for(const n of combat.director.npcs)if(n.securityRole==='gate'){n.holdsPost=true;n.postAt={...n.pos};n.frisks=m4.checkpoints.some(c=>c.guardId===n.id);}
  combat.canPickUp=this.reach;
  m4.guardRecovering=id=>[...this.recovering.keys()].some(n=>n.id===id&&n.active&&n.state==='distracted');
 }

 // Within reach: on the same side of a checkpoint, and not through a wall (playtest 2026-11-03: a pistol dropped on
 // the street was picked up through the front wall from the lobby).
 readonly reach=(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number})=>
  this.m4.canPickUp(from,to)&&segmentClear(this.combat.director.boxes,{...from,y:from.y+.6},{...to,y:to.y+.35});

 pickup(p:PlayerView){
  const drop=this.combat.nearestDrop(p);
  if(!drop)return null;
  const label=this.combat.pickup(p);
  const d=this.combat.director,{curious,investigate}=d.rules.thresholds;
  for(const n of d.npcs){
   if(!n.active||!n.guard)continue;
   const sight={reason:'',visibility:0,distance:0,blockedBy:[]};
   n.perceive(p,d.boxes,d.rules,sight);
   if(!sight.visibility)continue;
   this.release(n);
   n.suspicion=Math.max(n.suspicion,(curious+investigate)/2);
   n.lastSeen={x:p.x,y:p.y,z:p.z};
   this.onReaction?.(n,drop,'curious',p);
  }
  this.combat.director.incidents.end(drop,'cancelled',drop.pos,'player');
  return label;
 }

 private release(n:Npc,completed=false){
  const job=this.recovering.get(n);
  if(job&&n.state==='distracted'&&n.goal===job.goal){
   n.state='patrol';n.goal=null;n.arrived=false;
  }
  if(job){
   if(n.coinPickup===job.lift)n.coinPickup=null;
   if(job.drop.beingLiftedBy===n)delete job.drop.beingLiftedBy;
   const incidents=this.combat.director.incidents;
   if(completed)incidents.end(job.drop,'completed',job.drop.pos,n.id);
   else incidents.write(incidents.identify(job.drop,'weapon',job.drop.gun.id),'released',job.drop.pos,n.id);
  }
  this.recovering.delete(n);
 }

 private seesFloor(n:Npc,drop:Dropped){
  const d=this.combat.director,{pos}=drop,range=distance(n.pos,pos);
  if(Math.abs(n.pos.y-pos.y)>.35)return false;
  const vision=n.vision(d.rules),{peripheral,touch,eye}=d.rules.vision;
  const facing=(pos.x-n.pos.x)*Math.sin(n.heading)+(pos.z-n.pos.z)*Math.cos(n.heading);
  if(range>touch&&!(range<=vision.range&&facing>=range*Math.cos(vision.half*Math.PI/180))
                &&!(range<=peripheral.range&&facing>=range*Math.cos(peripheral.half*Math.PI/180)))return false;
  const from={...n.pos,y:n.pos.y+eye},to={...pos,y:pos.y+.05};
  return segmentClear(d.boxes,from,to)&&!n.crowdOcclusion?.(from,to);
 }

 private approach(n:Npc,drop:Dropped):Position|null{
  const d=this.combat.director,{nav}=d,{pos}=drop,range=GRAB_RANGE;
  if(distance(n.pos,pos)<range||nav.clear(n.pos,pos))return pos;
  const end=nav.find(n.pos,pos)?.at(-1);
  return end&&distance(end,pos)<range&&Math.abs(end.y-pos.y)<.35&&
   segmentClear(d.boxes,{...end,y:end.y+.65},{...pos,y:pos.y+.05})?end:null;
 }

 step(time:number){
  if(!this.combat.dropped.length&&!this.recovering.size)return;
  const scan=time>=this.nextScan;
  if(scan)this.nextScan=time+this.scanSeconds;
  const d=this.combat.director;
  for(const [n,job] of this.recovering){
   const {drop,goal,lift}=job;
   const index=this.combat.dropped.indexOf(drop);
   if(index<0||!n.active||n.busy||n.state!=='distracted'||n.goal!==goal){this.release(n);if(index<0)d.incidents.end(drop,'cancelled',drop.pos);continue;}
   if(lift){
    n.timer=Math.max(n.timer,.4);
    lift.progress=Math.min(1,(time-lift.started)/COIN_PICKUP_SECONDS);
    if(lift.progress>=COIN_GRASP)drop.beingLiftedBy=n;
    if(lift.progress>=1){
     this.combat.dropped.splice(index,1);
     this.release(n,true);
     this.onReaction?.(n,drop,'collect');
    }
    continue;
   }
   if(!scan)continue;
   if(distance(n.pos,drop.pos)<GRAB_RANGE&&this.seesFloor(n,drop)&&!n.coinPickup&&
      segmentClear(d.boxes,{...n.pos,y:n.pos.y+.32},{...drop.pos,y:drop.pos.y+.05})){
    n.arrived=true;n.speed=0;n.timer=Math.max(n.timer,.4);
    if(distance(n.pos,drop.pos)>.04)n.heading=Math.atan2(drop.pos.x-n.pos.x,drop.pos.z-n.pos.z);
    n.scanBase=n.heading;n.scanT=0;
    job.lift={at:{...drop.pos,y:drop.pos.y+.03},progress:0,started:time};
    n.coinPickup=job.lift;
   }else if(n.arrived){
    const deferred=this.retry.get(drop)??new Map<Npc,number>();
    deferred.set(n,time+d.rules.timers.noiseLook);this.retry.set(drop,deferred);
    this.release(n);
   }
  }
  if(!scan)return;
  for(const drop of this.combat.dropped){
   if(drop.stocked)continue;
   if([...this.recovering.values()].some(job=>job.drop===drop))continue;
   // The checkpoint attendant can recover nearby evidence while still covering the entrance.
   const deferred=this.retry.get(drop);
   const candidates=d.npcs.filter(n=>n.guard&&n.active&&!n.busy&&!n.scriptedGoal&&['patrol','curious'].includes(n.state)&&
    (deferred?.get(n)??0)<=time&&this.seesFloor(n,drop)&&
    !this.m4.checkpoints.some(c=>c.guardId===n.id&&distance(c,drop.pos)>=this.m4.rules.guardRadius))
    .sort((a,b)=>distance(a.pos,drop.pos)-distance(b.pos,drop.pos));
   for(const guard of candidates){
    const at=this.approach(guard,drop);
    if(!at||!guard.hear(at,d.rules,true))continue;
    const incident=d.incidents.identify(drop,'weapon',drop.gun.id);
    d.incidents.write(incident,'noticed',drop.pos,guard.id,'sight');
    this.recovering.set(guard,{drop,goal:guard.goal});
    d.incidents.write(incident,'assigned',at,guard.id);
    break;
   }
  }
 }
}

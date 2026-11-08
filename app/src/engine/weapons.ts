import type { Npc, PlayerView } from '../ai.ts';
import type { CombatSystem, Dropped } from '../combat.ts';
import type { M4System } from '../m4.ts';
import { segmentClear } from '../sight.ts';
import type { Position } from '../world.ts';

const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
type Recovery={drop:Dropped;goal:Npc['goal']};

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
  return label;
 }

 private release(n:Npc){
  const job=this.recovering.get(n);
  if(job&&n.state==='distracted'&&n.goal===job.goal){
   n.state='patrol';n.goal=null;n.arrived=false;
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
  const d=this.combat.director,{nav}=d,{pos}=drop,range=this.m4.rules.lootRadius;
  if(distance(n.pos,pos)<range||nav.clear(n.pos,pos))return pos;
  const end=nav.find(n.pos,pos)?.at(-1);
  return end&&distance(end,pos)<range&&Math.abs(end.y-pos.y)<.35&&
   segmentClear(d.boxes,{...end,y:end.y+.65},{...pos,y:pos.y+.05})?end:null;
 }

 step(time:number){
  if(time<this.nextScan||!this.combat.dropped.length&&!this.recovering.size)return;
  this.nextScan=time+this.scanSeconds;
  const d=this.combat.director;
  for(const [n,{drop,goal}] of this.recovering){
   const index=this.combat.dropped.indexOf(drop);
   if(index<0||!n.active||n.busy||n.state!=='distracted'||n.goal!==goal){this.release(n);continue;}
   if(distance(n.pos,drop.pos)<this.m4.rules.lootRadius&&this.seesFloor(n,drop)){
    this.combat.dropped.splice(index,1);
    this.release(n);
    this.onReaction?.(n,drop,'collect');
   }else if(n.arrived){
    const deferred=this.retry.get(drop)??new Map<Npc,number>();
    deferred.set(n,time+d.rules.timers.noiseLook);this.retry.set(drop,deferred);
    this.release(n);
   }
  }
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
    if(at&&guard.hear(at,d.rules,true)){this.recovering.set(guard,{drop,goal:guard.goal});break;}
   }
  }
 }
}

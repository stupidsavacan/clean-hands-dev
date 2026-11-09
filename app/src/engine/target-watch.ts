// 2026-11-10 (Issue #1): what happens around a target who goes down, and the npc.killed events, as shared engine parts
// (moved out of club/chances.ts).
// - TargetWatch: a target dropping in front of people (playtest 2026-11-03: an assassination is not an ordinary death).
//   Those who see it happen walk over and stand round them, facing them, for `seconds`; nobody is told who did it, so an
//   accident stays an accident. Bodies found later are the ordinary body rules' (m3), which this does not touch.
// - KillEvents: one npc.killed per death, with the place the map names for it (the club's dock), so chances can close.
import type {Director,Npc,PlayerView} from '../ai.ts';
import type {MissionEvents} from '../events.ts';
import {floorOf,type Position} from '../world.ts';
import type {Errands} from './errands.ts';

const SOURCE='gather';

export class TargetWatch{
 private readonly down=new Set<string>();
 private gathered:{npc:Npc;until:number}[]=[];
 /** A target fell in front of someone: the map's line and the crowd's gasp. */
 onGathered?:(target:Npc,at:Position,time:number)=>void;
 private readonly director:Director;private readonly errands:Errands;private readonly targets:Npc[];
 private readonly options:{seconds:number;radius:number;max:number};
 constructor(director:Director,errands:Errands,targets:Npc[],options={seconds:45,radius:16,max:8}){
  this.director=director;this.errands=errands;this.targets=targets;this.options=options;
 }
 /** Is this NPC standing round a fallen target now. */
 gathering(n:Npc){return this.gathered.some(g=>g.npc===n);}
 step(time:number){
  for(const t of this.targets)if(t.life!=='active'&&!this.down.has(t.id)){this.down.add(t.id);this.gather(t,{...t.pos},time);}
  if(this.gathered.length&&time>=this.gathered[0].until){this.errands.releaseAll(SOURCE);this.gathered=[];}
 }
 private gather(target:Npc,at:Position,time:number){
  const d=this.director,w=d.world,o=this.options;
  const fallen={...at,floor:floorOf(at.y),disguise:'',speed:0,running:false,crouched:false,tampering:false} as PlayerView;
  const sees=(m:Npc)=>{const r={reason:'',visibility:0,distance:0,blockedBy:[] as string[]};m.perceive(fallen,d.boxes,d.rules,r);return r.visibility>0;};
  const near=d.npcs.filter(m=>!this.targets.includes(m)&&m.active&&!m.busy&&['patrol','curious','distracted'].includes(m.state)&&
   Math.abs(m.pos.y-at.y)<1.5&&Math.hypot(m.pos.x-at.x,m.pos.z-at.z)<o.radius&&sees(m))
   .sort((a,b)=>Math.hypot(a.pos.x-at.x,a.pos.z-at.z)-Math.hypot(b.pos.x-at.x,b.pos.z-at.z)).slice(0,o.max);
  near.forEach((m,i)=>{
   const r=m.guard?1.1:1.7+(i%3)*.45,start=Math.atan2(m.pos.x-at.x,m.pos.z-at.z);
   for(let k=0;k<12;k++){
    const a=start+(k%2?1:-1)*Math.ceil(k/2)*.5,x=at.x+Math.sin(a)*r,z=at.z+Math.cos(a)*r,y=w.surface(x,z,at.y);
    if(y===null||w.blocked(x,y,z))continue;
    this.errands.send(m,SOURCE,{x,y,z},'idle',Math.atan2(at.x-x,at.z-z));this.gathered.push({npc:m,until:time+o.seconds});break;
   }
  });
  if(near.length)this.onGathered?.(target,at,time);
 }
}

export class KillEvents{
 private readonly deaths=new Set<string>();
 /** The map's name for where someone died (a chance can require it), or undefined. */
 placeOf:(victim:Npc)=>string|undefined=()=>undefined;
 private readonly director:Director;private readonly events:MissionEvents;
 constructor(director:Director,events:MissionEvents){this.director=director;this.events=events;}
 step(time:number){
  for(const victim of this.director.npcs)if(victim.life==='dead'&&!this.deaths.has(victim.id)){
   this.deaths.add(victim.id);
   this.events.emit({type:'npc.killed',time,id:victim.id,method:victim.deathMethod,judgement:victim.deathKind,place:this.placeOf(victim)});
  }
 }
}

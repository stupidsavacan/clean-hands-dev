import type {Director,Npc,PlayerView} from './ai.ts';
import type {MissionEvents} from './events.ts';
import type {GuardTeams} from './guard-team.ts';
import {segmentClear,type Aabb} from './sight.ts';
import type {Position} from './world.ts';
export type FlashRules={hold:number;range:number;perGuard:number;windup:number;recover:number;flight:number;fuse:number;radius:number;duration:number;spread:number;cooldown:number;arc:number};
export const FLASH_DEFAULTS:FlashRules={hold:12,range:15,perGuard:1,windup:.65,recover:.55,flight:.65,fuse:1.2,radius:6,duration:3,spread:.045,cooldown:3,arc:1.8};
export type FlashThrow={owner:Npc;start:number;release:number;detonate:number;from:Position;target:Position;pos:Position;released:boolean;stopped:boolean};
export function flashPosition(from:Position,to:Position,t:number,arc:number):Position{const u=Math.max(0,Math.min(1,t));if(u===0)return {...from};if(u===1)return {...to};return {x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u+4*arc*u*(1-u),z:from.z+(to.z-from.z)*u};}
export function flashPathClear(boxes:Aabb[],from:Position,to:Position,arc:number){let previous=from;
 // Check both the forward throw line and every piece of the actual arc. Walls/closed doors are never bypassed.
 if(!segmentClear(boxes,from,{...to,y:from.y}))return false;
 for(let i=1;i<=24;i++){const q=flashPosition(from,to,i/24,arc);if(!segmentClear(boxes,previous,q))return false;previous=q;}return true;}
export function flashStrength(boxes:Aabb[],at:Position,p:PlayerView,radius:number){const eye={x:p.x,y:p.y+(p.crouched?1.05:1.55),z:p.z},d=Math.hypot(at.x-eye.x,at.y-eye.y,at.z-eye.z);
 return d>=radius||!segmentClear(boxes,at,eye)?0:1-d/radius;}
/** Simulation only: screen wash and warnings belong to the UI lab until approved. */
export class GuardFlashes{
 readonly active:FlashThrow[]=[];readonly used=new Map<Npc,number>();thrown=0;burst=0;private session:object|null=null;private next=0;private effect:{start:number;strength:number}|null=null;
 readonly director:Director;readonly events:MissionEvents;readonly rules:FlashRules;
 constructor(director:Director,events:MissionEvents,rules:FlashRules){this.director=director;this.events=events;this.rules=rules;}
 amount(time:number){const e=this.effect;return e?e.strength*Math.max(0,1-(time-e.start)/this.rules.duration):0;}
 preparing(n:Npc,time:number){return time>=n.flashThrowAt&&time<n.flashThrowAt+this.rules.windup+this.rules.recover;}
 step(p:PlayerView,time:number,fight:object|null,teams:GuardTeams){const r=this.rules;
  if(fight!==this.session){this.session=fight;this.used.clear();}
  for(let i=this.active.length-1;i>=0;i--){const t=this.active[i];
   if(!t.released&&(!t.owner.active||t.owner.state!=='combat'||t.owner.busy)){t.owner.flashThrowAt=-Infinity;this.active.splice(i,1);continue;}
   if(!t.released&&time>=t.release){if(!flashPathClear(this.director.boxes,t.from,t.target,r.arc)){t.owner.flashThrowAt=-Infinity;this.active.splice(i,1);continue;}
    t.released=true;this.used.set(t.owner,(this.used.get(t.owner)??0)+1);this.thrown++;this.events.emit({type:'flash.thrown',time,id:t.owner.id});}
   if(t.released&&!t.stopped){const q=flashPosition(t.from,t.target,(time-t.release)/r.flight,r.arc);if(segmentClear(this.director.boxes,t.pos,q))t.pos=q;else t.stopped=true;}
   if(t.released&&time>=t.detonate){const strength=flashStrength(this.director.boxes,t.pos,p,r.radius);this.burst++;this.events.emit({type:'flash.detonated',time,id:t.owner.id,value:strength});
    if(strength>0){const previous=this.amount(time);this.effect={start:time,strength:Math.max(previous,strength)};this.events.emit({type:'player.flashed',time,value:strength});}
    this.active.splice(i,1);}}
  if(!fight||time<this.next||this.active.length)return;
  for(const n of this.director.npcs){if(!n.guard||!n.active||n.busy||n.scheduledAway||n.state!=='combat'||n.visibility<=0||(this.used.get(n)??0)>=r.perGuard)continue;
   const known=teams.camped(n,time,r.hold);if(!known||!teams.covered(n,known)||Math.abs(known.y-n.pos.y)>.5||Math.hypot(known.x-n.pos.x,known.z-n.pos.z)>r.range)continue;
   const from={x:n.pos.x,y:n.pos.y+1.5,z:n.pos.z},target={x:known.x,y:known.y+.08,z:known.z};
   if(!flashPathClear(this.director.boxes,from,target,r.arc))continue;
   n.flashThrowAt=time;n.flashThrowCover=n.posture==='cover';n.combatGoal=null;this.next=time+r.windup+r.fuse+r.cooldown;
   this.active.push({owner:n,start:time,release:time+r.windup,detonate:time+r.windup+r.fuse,from,target,pos:{...from},released:false,stopped:false});break;
  }
 }
}

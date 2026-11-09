// 2026-11-10 (Issue #1): a mission's "hold E here" spots as a shared engine part (moved out of club/chances.ts).
// Finding the nearest spot in reach and in sight, the tool that makes it quicker, the time it takes, cancelling when E
// is let go, the player walks off, the tool leaves the hand or the spot becomes unavailable, and the events on
// completion. What a finished spot does is the map's (onComplete).
import type {PlayerView} from '../ai.ts';
import type {MissionClock} from '../schedule.ts';
import type {MissionEvents} from '../events.ts';
import {segmentClear,type Aabb} from '../sight.ts';
import type {Position} from '../world.ts';

export type HoldSpot={id:string;label:string;at:Position;seconds:number;
 /** Held in the hand, the spot takes `seconds` instead and shows `label`. */
 tool?:{item:string;label:string;seconds:number};
 /** Can be used again after it is done (the club's office intercom). */
 repeat?:boolean};
export type HoldAction={id:string;elapsed:number;duration:number;start:Position;tool?:string};

export class HoldActions{
 action:HoldAction|null=null;
 private released=true;
 /** Spots done once (repeatable spots are never added). */
 readonly done=new Set<string>();
 /** Why a spot cannot be used now ('' when it can): shown instead of its label, and it cancels a hold in progress. */
 blocked:(spot:HoldSpot,p:PlayerView)=>string=()=>'';
 /** The item in the player's hand (the club passes m3.heldItem). */
 heldItem:()=>string|undefined=()=>undefined;
 onComplete:(spot:HoldSpot)=>void=()=>{};
 readonly spots:HoldSpot[];private readonly radius:number;private readonly boxes:()=>Aabb[];
 private readonly clock:MissionClock;private readonly events:MissionEvents;
 constructor(spots:HoldSpot[],radius:number,boxes:()=>Aabb[],clock:MissionClock,events:MissionEvents){
  this.spots=spots;this.radius=radius;this.boxes=boxes;this.clock=clock;this.events=events;
 }
 get progress(){return this.action?this.action.elapsed/this.action.duration:0;}
 private reach(a:Position,b:Position){
  return Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y)<=this.radius&&segmentClear(this.boxes(),{...a,y:a.y+1.1},{...b,y:b.y+1.1});
 }
 /** The nearest usable spot in reach. */
 spot(p:PlayerView){
  let best:HoldSpot|undefined,nearest=Infinity;
  for(const s of this.spots){
   if(!s.repeat&&this.done.has(s.id))continue;
   const d=Math.hypot(p.x-s.at.x,p.z-s.at.z,p.y-s.at.y);
   if(d<nearest&&this.reach(p,s.at)){best=s;nearest=d;}
  }
  return best;
 }
 private tool(s:HoldSpot){return s.tool&&this.heldItem()===s.tool.item?s.tool:undefined;}
 prompt(p:PlayerView){
  if(this.action)return {text:'E 長押し 操作中…',progress:this.progress};
  const s=this.spot(p);if(!s)return null;
  return {text:this.blocked(s,p)||`E 長押し ${this.tool(s)?.label??s.label}`,progress:0};
 }
 /** True while E is used here (so nothing else takes it this frame). */
 step(dt:number,p:PlayerView,keys:Set<string>,suppressed=false){
  const held=keys.has('KeyE');
  if(!held)this.released=true;
  if(this.action){
   const a=this.action,s=this.spot(p);
   if(suppressed||!held||s?.id!==a.id||!this.reach(p,a.start)||this.blocked(s,p)||a.tool&&this.heldItem()!==a.tool){this.action=null;this.released=false;return true;}
   a.elapsed+=dt;
   if(a.elapsed>=a.duration){
    if(a.tool)this.events.emit({type:'item.used',time:this.clock.elapsed,id:a.tool});
    if(!s.repeat)this.done.add(s.id);
    this.action=null;this.released=false;this.onComplete(s);
   }
   return true;
  }
  if(suppressed||!held||!this.released)return false;
  const s=this.spot(p);
  if(!s||this.blocked(s,p))return false;
  const tool=this.tool(s);
  this.action={id:s.id,elapsed:0,duration:tool?.seconds??s.seconds,start:{x:p.x,y:p.y,z:p.z},tool:tool?.item};
  return true;
 }
}

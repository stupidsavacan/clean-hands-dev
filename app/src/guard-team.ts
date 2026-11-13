import type {Director,Npc,PlayerView} from './ai.ts';
import {hiddenFrom,shootsFrom,type CoverSpot} from './cover-spots.ts';
import {segmentClear} from './sight.ts';
import {floorOf,type Position} from './world.ts';
export type TeamRules={hold:number;moveRadius:number;angle:number;counts:number[][];peekScale:number;hop:number;search:number;recheck:number};
export const TEAM_DEFAULTS:TeamRules={hold:8,moveRadius:1,angle:60,counts:[[2,1],[4,2]],peekScale:1.5,hop:8,search:30,recheck:.5};
type Flank={route:CoverSpot[];final:CoverSpot};
type Group={anchor:Position;since:number;next:number};
const distance=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);
export function flankAngle(a:Position,b:Position,threat:Position){const ax=a.x-threat.x,az=a.z-threat.z,bx=b.x-threat.x,bz=b.z-threat.z;
 return Math.acos(Math.max(-1,Math.min(1,(ax*bx+az*bz)/(Math.hypot(ax,az)*Math.hypot(bx,bz)||1))))*180/Math.PI;}
/** Only guards already fighting participate. It never dispatches a patrol or changes perception. */
export class GuardTeams{
 readonly flanks=new Map<Npc,Flank>();private readonly suppressors=new Set<Npc>();private readonly groups=new Map<number,Group>();
 private readonly director:Director;private readonly spots:CoverSpot[];readonly rules:TeamRules;private readonly free:(s:CoverSpot,n:Npc)=>boolean;
 constructor(director:Director,spots:CoverSpot[],rules:TeamRules,free:(s:CoverSpot,n:Npc)=>boolean){this.director=director;this.spots=spots;this.rules=rules;this.free=free;}
 role(n:Npc){return this.flanks.has(n)?'flank':this.suppressors.has(n)?'suppress':null;}
 available(s:CoverSpot,n:Npc){return this.free(s,n)&&![...this.flanks].some(([other,f])=>other!==n&&(f.final===s||f.route[0]===s));}
 private clear(n:Npc){if(this.flanks.delete(n))n.coverT=0;this.suppressors.delete(n);}
 target(n:Npc){const f=this.flanks.get(n);if(!f)return null;
  if(f.route.length>1&&n.tactic?.spot===f.route[0]&&n.tactic.phase!=='move'){f.route.shift();n.coverT=0;}
  return f.route[0];}
 step(p:PlayerView,time:number){const live=this.director.npcs.filter(n=>n.guard&&n.active&&!n.busy&&!n.scheduledAway&&n.state==='combat');
  for(const n of new Set([...this.flanks.keys(),...this.suppressors]))if(!live.includes(n))this.clear(n);
  const floors=new Set(live.map(n=>floorOf(n.pos.y)));for(const f of this.groups.keys())if(!floors.has(f))this.groups.delete(f);
  for(const floor of floors){const guards=live.filter(n=>floorOf(n.pos.y)===floor),witness=guards.find(n=>n.visibility>0),known=witness?{x:p.x,y:p.y,z:p.z}:guards.find(n=>n.lastSeen)?.lastSeen;
   if(!known)continue;let group=this.groups.get(floor);
   if(!group||distance(group.anchor,known)>this.rules.moveRadius){group={anchor:{...known},since:time,next:time};this.groups.set(floor,group);for(const n of guards)this.clear(n);}
   if(guards.length<2||time-group.since<this.rules.hold){for(const n of guards)this.clear(n);continue;}
   if(time<group.next)continue;group.next=time+this.rules.recheck;
   // The obstacle must be near the agent, rather than the guard's own cover.
   const near=this.director.boxes.filter(b=>Math.hypot(Math.max(b.minX-known.x,0,known.x-b.maxX),Math.max(b.minZ-known.z,0,known.z-b.maxZ))<=2&&b.maxY>known.y+.5&&b.minY<known.y+1.6);
   const covered=guards.some(n=>!segmentClear(near,{x:n.pos.x,y:n.pos.y+this.director.rules.vision.eye,z:n.pos.z},{x:known.x,y:known.y+.78,z:known.z}));
   if(!covered){for(const n of guards)this.clear(n);continue;}
   const max=this.rules.counts.reduce((value,[count,limit])=>guards.length>=count?limit:value,0),failed=new Set<Npc>();
   for(const n of guards){const plan=this.flanks.get(n);if(plan&&(!this.valid(plan.final,known,p.crouched,n)||!this.valid(plan.route[0],known,p.crouched,n))){this.clear(n);failed.add(n);}}
   while(guards.filter(n=>this.flanks.has(n)).length>max)this.clear(guards.filter(n=>this.flanks.has(n)).at(-1)!);
   const reference=guards.find(n=>!this.flanks.has(n))?.tactic?.spot??guards.find(n=>!this.flanks.has(n))?.pos;
   if(reference)for(const n of guards.slice().reverse()){
    if(guards.filter(g=>this.flanks.has(g)).length>=max)break;if(this.flanks.has(n)||failed.has(n))continue;
    const route=this.path(n,known,p.crouched,reference);if(route){this.flanks.set(n,{route,final:route.at(-1)!});n.coverT=0;}
   }
   for(const n of guards)if(!this.flanks.has(n))this.suppressors.add(n);else this.suppressors.delete(n);
  }
 }
 private valid(s:CoverSpot,threat:Position,crouched:boolean,n:Npc){return this.available(s,n)&&hiddenFrom(s,threat,crouched,this.director.boxes)&&shootsFrom(s,threat,crouched,this.director.boxes,this.director.rules.vision.eye);}
 private path(n:Npc,threat:Position,crouched:boolean,reference:Position){const r=this.rules,nav=this.director.nav;
  const candidates=this.spots.filter(s=>s.floor===floorOf(n.pos.y)&&distance(s,n.pos)<=r.search&&distance(s,threat)>=4&&this.valid(s,threat,crouched,n));
  const goals=new Set(candidates.filter(s=>flankAngle(s,reference,threat)>=r.angle));if(!goals.size)return null;
  const queue:{at:Position;route:CoverSpot[]}[]=[{at:n.pos,route:[]}],seen=new Set<CoverSpot>();
  for(let i=0;i<queue.length;i++){const {at,route}=queue[i];for(const s of candidates){if(seen.has(s)||distance(at,s)>r.hop)continue;
    // A navigation path may turn around the source crate, but must stay a short hop and away from the agent.
    const walk=nav.find(at,s);if(!walk)continue;let previous=at,length=0;for(const q of walk){length+=distance(previous,q);previous=q;}
    if(length>r.hop*1.5||walk.some(q=>distance(q,threat)<4))continue;
    seen.add(s);const next=[...route,s];if(goals.has(s))return next;queue.push({at:s,route:next});}}
  return null;
 }
}

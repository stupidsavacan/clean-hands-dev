import type {Director,PlayerView} from '../ai.ts';
import type {Position} from '../world.ts';
import {WALK_SPEED} from '../locomotion.ts';
import {LADDER,ladderClimb,ladderExitBottom,ladderExitTop,type LadderMove,type LadderPoint,type LadderPose} from '../ladder-motion.ts';
// A ladder or drainpipe needs only its path (and, when its rungs do not face +z, `facing`): the motion is the generic one
// in ladder-motion.ts and its length follows from the height. Windows and ledges still play over `seconds`.
export type Traversal={id:string;a:string;b:string;kind:string;start:Position;end:Position;seconds?:number;via?:Position[];
 /** Which way a climber faces on the ladder (radians, 0 = +z); the rungs stand LADDER.standoff that way. */
 facing?:number};
export const RUNG=LADDER.rung;
const clamp=(t:number)=>Math.min(1,Math.max(0,t));
const ease=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const along=(a:Position,b:Position,t:number):Position=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t)});
const flat=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);
const rising=(a:Position,b:Position)=>Math.abs(a.y-b.y)>.5;
const facing=(a:Position,b:Position)=>Math.atan2(b.x-a.x,b.z-a.z);
const turnTo=(from:number,to:number,t:number)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;
export const traversalPoints=(link:Traversal)=>[link.start,...link.via??[],link.end];
const climbs=(link:Traversal)=>link.kind==='ladder'||link.kind==='drainpipe';

/** The ladder in a link: the climbing column at its foot, its height and the way the climber faces. */
export function ladderOf(link:Traversal){
 if(!climbs(link))return null;
 const points=traversalPoints(link),i=points.slice(1).findIndex((b,k)=>rising(points[k],b)&&flat(points[k],b)<.2);
 if(i<0)return null;
 const a=points[i],b=points[i+1],foot=a.y<b.y?a:b;
 return {foot:{...foot},height:Math.abs(b.y-a.y),facing:link.facing??0};
}
type Ladder=NonNullable<ReturnType<typeof ladderOf>>;
/** From the ladder's own frame (ladder-motion.ts) to the world. */
function toWorld({foot,facing:f}:Ladder,p:LadderPoint):Position{
 const s=Math.sin(f),c=Math.cos(f);
 return {x:foot.x+p.x*c+p.z*s,y:foot.y+p.y,z:foot.z-p.x*s+p.z*c};
}
/** The rails and rungs to draw (the same in every map and in the lab). */
export function ladderGeometry(link:Traversal){
 const ladder=ladderOf(link);
 if(!ladder)return null;
 const {rung,standoff,halfWidth,above}=LADDER,top=ladder.height+above,at=(x:number,y:number)=>toWorld(ladder,{x,y,z:standoff});
 return {rails:[-1,1].map(side=>[at(side*halfWidth,0),at(side*halfWidth,top)] as const),
  rungs:Array.from({length:Math.floor(top/rung+1e-6)+1},(_,i)=>[at(-halfWidth,i*rung),at(halfWidth,i*rung)] as const)};
}

export function traversalSill(link:Traversal){
 const v=link.via??[];
 return {...along(v[0]??link.start,v.at(-1)??link.end,.5),y:Math.min(...traversalPoints(link).map(p=>p.y))+1.05};
}

export type TraversalPhase=LadderMove|'walk'|'enter'|'ledge'|'vault'|'exit-window';
type Side=1|-1;
export type TraversalFrame={
 position:Position;heading:number;phase:TraversalPhase;
 // The traversal layer (body pose and lean), the hands' and the feet's IK.
 weight:number;hands:number;feet:number;cycle:number;
 vault:boolean;hand?:(side:Side)=>Position;foot?:(side:Side)=>Position;
};

// A polyline walked by distance.
function length(points:Position[]){let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);return total;}
function walk(points:Position[],d:number){
 // Corners are rounded over CORNER metres each side so the body turns instead of snapping.
 const CORNER=.3,pieces:{a:Position;b:Position;from:number;length:number;heading:number}[]=[];
 for(let i=1,from=0;i<points.length;i++){const a=points[i-1],b=points[i],l=flat(a,b);if(l>1e-6){pieces.push({a,b,from,length:l,heading:facing(a,b)});from+=l;}}
 if(!pieces.length)return {position:{...points[0]},heading:0};
 const k=Math.max(0,pieces.findIndex((p,i)=>d<=p.from+p.length||i===pieces.length-1)),p=pieces[k];
 let heading=p.heading;
 const next=pieces[k+1],prev=pieces[k-1];
 if(next&&d>p.from+p.length-CORNER)heading=turnTo(p.heading,next.heading,ease((d-(p.from+p.length-CORNER))/(2*CORNER)));
 else if(prev&&d<p.from+CORNER)heading=turnTo(prev.heading,p.heading,ease((d-(p.from-CORNER))/(2*CORNER)));
 const u=(d-p.from)/p.length;
 return {position:u>=1-1e-9?{...p.b}:along(p.a,p.b,clamp(u)),heading};
}

// The order of moves along a ladder link, in the direction travelled.
function ladderPlan(link:Traversal,reverse:boolean,ladder:Ladder){
 const forward=traversalPoints(link),points=reverse?[...forward].reverse():forward;
 const i=points.slice(1).findIndex((b,k)=>rising(points[k],b)&&flat(points[k],b)<.2);
 const before=points.slice(0,i+1),after=points.slice(i+1),up=points[i+1].y>points[i].y;
 const {height}=ladder,beforeLength=length(before),afterLength=length(after);
 const enterStep=Math.min(beforeLength,up?LADDER.bottomStep:LADDER.topStep),exitStep=Math.min(afterLength,up?LADDER.topStep:LADDER.bottomStep);
 const approach=beforeLength>0?walk(before,beforeLength).heading:ladder.facing,leave=afterLength>0?walk(after,0).heading:ladder.facing;
 const parts=[
  {kind:'walk-before',seconds:(beforeLength-enterStep)/WALK_SPEED},
  {kind:up?'mount':'mount-top',seconds:up?LADDER.bottom:LADDER.top},
  {kind:up?'climb':'descend',seconds:height/LADDER.climbSpeed},
  {kind:up?'exit-top':'exit-bottom',seconds:up?LADDER.top:LADDER.bottom},
  {kind:'walk-after',seconds:(afterLength-exitStep)/WALK_SPEED},
 ] as const;
 return {before,after,beforeLength,enterStep,exitStep,approach,leave,parts,seconds:parts.reduce((t,p)=>t+p.seconds,0)};
}

/** The moves of a ladder link in order, with when each starts (seconds), for the lab and the checks. */
export function traversalParts(link:Traversal,reverse:boolean){
 const ladder=ladderOf(link);
 if(!ladder)return null;
 let start=0;
 return ladderPlan(link,reverse,ladder).parts.map(({kind,seconds})=>{const part={kind,start,seconds};start+=seconds;return part;});
}

/** How long a traversal takes: ladders from their height, windows and ledges from their `seconds`. */
export function traversalSeconds(link:Traversal){
 const ladder=ladderOf(link);
 return ladder?ladderPlan(link,false,ladder).seconds:link.seconds??1;
}

function sampleLadder(link:Traversal,reverse:boolean,progress:number,ladder:Ladder):TraversalFrame{
 const plan=ladderPlan(link,reverse,ladder);
 let t=clamp(progress)*plan.seconds,k=0;
 while(k<plan.parts.length-1&&t>plan.parts[k].seconds){t-=plan.parts[k].seconds;k++;}
 const part=plan.parts[k],u=part.seconds>0?clamp(t/part.seconds):1;
 const still={weight:0,hands:0,feet:0,cycle:0,vault:false};
 if(part.kind==='walk-before'){const w=walk(plan.before,t*WALK_SPEED);return {...w,phase:'walk',...still};}
 if(part.kind==='walk-after'){const w=walk(plan.after,plan.exitStep+t*WALK_SPEED);return {...w,phase:'walk',...still};}
 const {height,facing:f}=ladder;
 let pose:LadderPose,position:Position,heading:number;
 if(part.kind==='climb'||part.kind==='descend'){
  const y=height*(part.kind==='climb'?u:1-u);
  pose=ladderClimb(y,height);position={...ladder.foot,y:ladder.foot.y+y};heading=f;
 }else{
  const entering=part.kind==='mount'||part.kind==='mount-top',top=part.kind.endsWith('top');
  const step=entering?plan.enterStep:plan.exitStep;
  pose=top?ladderExitTop(entering?1-u:u,height,step):ladderExitBottom(entering?1-u:u,step);
  // Off the ladder along the floor the climber came from or goes on to.
  position=entering?walk(plan.before,plan.beforeLength-pose.away).position:walk(plan.after,pose.away).position;
  heading=turnTo(f,entering?plan.approach:plan.leave,pose.turn);
 }
 // Hanging back from the rungs (opposite the way the climber faces on the ladder).
 position={...position,x:position.x-Math.sin(f)*pose.hang,z:position.z-Math.cos(f)*pose.hang};
 return {position,heading,phase:part.kind,weight:pose.weight,hands:pose.hands,feet:pose.feet,cycle:pose.y/(2*LADDER.rung),vault:false,
  hand:side=>toWorld(ladder,pose.hand(side)),foot:side=>toWorld(ladder,pose.foot(side))};
}

export function sampleTraversal(link:Traversal,reverse:boolean,progress:number):TraversalFrame{
 const ladder=ladderOf(link);
 if(ladder)return sampleLadder(link,reverse,progress,ladder);
 const original=traversalPoints(link),points=reverse?[...original].reverse():original;
 const last=points.length-1,t=clamp(progress)*last,i=Math.min(last-1,Math.floor(t)),u=t-i;
 const a=points[i],b=points[i+1],position=along(a,b,u);
 const fromAxes=(origin:Position,heading:number,x:number,y:number,z:number):Position=>({
  x:origin.x+x*Math.cos(heading)+z*Math.sin(heading),y:origin.y+y,z:origin.z-x*Math.sin(heading)+z*Math.cos(heading),
 });
 const envelope=ease(t/.22)*ease((last-t)/.28);
 if(link.kind==='window'){
  const heading=facing(points[0],points[last]),sill=traversalSill(link);
  const phase=t<.22?'enter':t>last-.28?'exit-window':'vault';
  return {position,heading,phase,weight:envelope,hands:envelope,feet:envelope,cycle:0,vault:true,hand:side=>fromAxes(sill,heading,side*.28,0,0)};
 }
 // A ledge (or a fence crossed on a slope): hands and feet follow the body along the path.
 const climb=rising(a,b),heading=facing(a,b);
 if(!climb&&link.kind!=='ledge')return {position,heading,phase:'walk',weight:0,hands:0,feet:0,cycle:0,vault:false};
 const cycle=(position.y+flat(points[0],position))/(2*RUNG);
 return {position,heading,phase:'ledge',weight:envelope,hands:envelope,feet:envelope,cycle,vault:false,
  hand:side=>fromAxes(position,heading,side*.22,1.28+.12*Math.sin((cycle+(side===1?0:.5))*2*Math.PI),.3),
  foot:side=>fromAxes(position,heading,side*.12,.25+.12*Math.sin((cycle+(side===1?.5:0))*2*Math.PI),.22),
 };
}

export class PartyTraversal{
 action:{link:Traversal;from:Position;to:Position;elapsed:number;reverse:boolean;seconds:number}|null=null;
 private release=false; transfer:Position|null=null;notices:string[]=[];
 readonly director:Director;readonly links:Traversal[];readonly rules:{radius:number;suspicionPerSecond:number};
 constructor(d:Director,links:Traversal[],rules:{radius:number;suspicionPerSecond:number}){this.director=d;this.links=links;this.rules=rules;}
 get locked(){return !!this.action;}get tampering(){return !!this.action;}get progress(){return this.action?this.action.elapsed/this.action.seconds:0;}
 near(p:Position,q:Position){return Math.hypot(p.x-q.x,p.z-q.z,p.y-q.y)<=this.rules.radius;}
 candidate(p:Position){for(const link of this.links){if(this.near(p,link.start))return {link,reverse:false};if(this.near(p,link.end))return {link,reverse:true};}return null;}
 prompt(p:Position){const a=this.action,c=this.candidate(p);return a?{text:'E 長押し 移動中。離すと元へ戻る',progress:this.progress}:c?{text:`E 長押し ${c.link.kind==='window'?'窓':c.link.kind==='ladder'?'はしご':c.link.kind==='drainpipe'?'雨どい':'外の縁'}を使う`,progress:0}:null;}
 step(dt:number,p:PlayerView,keys:Set<string>,suppressed=false){this.notices=[];if(!keys.has('KeyE'))this.release=false;
 if(this.action){const a=this.action;if(!keys.has('KeyE')||suppressed){this.transfer={...a.from};this.action=null;this.release=true;return true;}
 a.elapsed=Math.min(a.seconds,a.elapsed+dt);this.transfer=sampleTraversal(a.link,a.reverse,this.progress).position;
 const seen={...p,...this.transfer};for(const n of this.director.npcs){if(!n.active||n.busy)continue;n.perceive(seen,this.director.boxes,this.director.rules);if(n.visibility>0)n.suspicion=Math.min(100,n.suspicion+dt*this.rules.suspicionPerSecond*n.visibility);}
 if(a.elapsed>=a.seconds){this.transfer={...a.to};this.action=null;this.release=true;}return true;}
 if(suppressed||this.release||!keys.has('KeyE'))return false;const c=this.candidate(p);if(!c)return false;this.action={...c,from:{x:p.x,y:p.y,z:p.z},to:{...(c.reverse?c.link.start:c.link.end)},elapsed:0,seconds:traversalSeconds(c.link)};return true;}
 frame(){const a=this.action;return a?sampleTraversal(a.link,a.reverse,this.progress):undefined;}
 takeTransfer(){const p=this.transfer;this.transfer=null;return p;}
 snapshot(){return {action:this.action,progress:this.progress};}
}

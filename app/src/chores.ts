import type {Director,Npc} from './ai.ts';
import type {DeviceSystem} from './devices.ts';
import {segmentClear} from './sight.ts';
import {floorOf,type Position} from './world.ts';
// ROADMAP H06/H14/H17 (2026-11-06): messes that stay until someone cleans them, and the cleaner's job.
// - A bloody death (a blade, a shot, a finishing blow) leaves a pool of blood where it happened. It stays there when
//   the body is carried away.
// - Whoever sees it first raises it: a guard comes to look (radio), anyone else turns to it. From then it is a job.
// - The cleaner (the map's cleaner ids) fetches the vacuum cleaner, carries it over, cleans with it running
//   (CLEAN_SECONDS, the 'clean' gesture), and takes it back. If the cleaner is alerted or put down, the job stops and the
//   vacuum stays where it was; another cleaner may take it up later.
// The errands use the schedule's scripted goals (schedule.ts), the same way chance scenes move people.
export type Mess={id:number;kind:'blood'|'water';pos:Position;seen:boolean;cleaned:number;victim:string;source?:string};
type Phase='fetch'|'carry'|'clean'|'return';
export type Job={mess:Mess;cleaner:Npc;phase:Phase;t:number;vacuum?:string;goal:Position|null;lastStep:Position;idle:number};
export const BLOODY=new Set(['gun','kitchen_knife','thrown_kitchen_knife','katana','thrown_katana','finish']);
export const CLEAN_SECONDS=8,SEE_RANGE=10,ARRIVE=.7;
const STUCK_SECONDS=3,RETRY_SECONDS=5;
const flat=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

export class ChoreSystem{
 readonly messes:Mess[]=[];notices:string[]=[];
 private readonly jobs=new Map<Mess,Job>();
 get job(){return this.jobs.values().next().value??null;}
 private nextId=1;private bled=new Set<string>();private home=new Map<string,{x:number;z:number;y:number;heading:number;approach:{x:number;z:number}}>();
 private pendingReturn:{mess:Mess;vacuum:string}|null=null;
 private clock=0;
 private readonly retryAfter=new Map<Mess,number>();
 readonly director:Director;readonly devices:DeviceSystem|null;readonly cleaners:string[];
 /** Called when an errand starts or ends (the schedule forgets its travel so the walk gets a fresh budget). */
 onErrand?: (n:Npc)=>void;
 constructor(director:Director,devices:DeviceSystem|null,cleaners:string[]){this.director=director;this.devices=devices;this.cleaners=cleaners;
  for(const d of devices?.devices??[])if(d.kind==='vacuum')this.home.set(d.id,{x:d.x,z:d.z,y:d.y,heading:d.heading,approach:{...d.approach}});}
 add(kind:Mess['kind'],pos:Position,victim='',source?:string){const m={id:this.nextId++,kind,pos:{...pos},seen:false,cleaned:0,victim,source};this.messes.push(m);return m;}
 private errand(j:Job,at:Position|null,action='',heading:number|null=null){
  const n=j.cleaner;
  j.goal=n.scriptedGoal=at&&{...at};n.scriptedAction=action;n.scriptedHeading=heading;
  j.lastStep={...n.pos};j.idle=0;this.onErrand?.(n);
 }
 private incident(m:Mess){return this.director.incidents.identify(m,'cleaning',m.kind+':'+m.id);}
 private vacuum(){return this.devices?.devices.find(d=>d.kind==='vacuum');}
 step(dt:number){this.clock+=dt;this.notices=[];const d=this.director;
  for(const sink of this.devices?.devices??[]){
   if(!this.devices!.overflowing.has(sink.id))continue;
   const water=this.messes.find(m=>m.kind==='water'&&m.source===sink.id);
   if(water)water.cleaned=0;
   else this.add('water',this.devices!.spot(sink),'',sink.id).seen=true;
  }
  // New bloody deaths bleed where the body lies now.
  for(const n of d.npcs)if(n.life==='dead'&&!this.bled.has(n.id)){this.bled.add(n.id);if(BLOODY.has(n.deathMethod)&&n.bodyMode==='ground')this.add('blood',n.pos,n.id);}
  // Someone notices a pool: a guard comes to look, a bystander turns to it. Then it is a job for the cleaner.
  for(const m of this.messes){if(m.seen)continue;for(const n of d.npcs){if(!n.active||n.busy||this.cleaners.includes(n.id)||!this.sees(n,m.pos))continue;m.seen=true;d.incidents.write(this.incident(m),'noticed',m.pos,n.id,'sight');
   if(n.guard)n.radio({...m.pos},d.rules);else n.hear({...m.pos},d.rules);this.notices.push(`${n.label}が血だまりに気づいた。`);break;}}
  this.assign();
  for(const job of this.jobs.values())this.stepJob(job,dt);
 }
 private assign(){
  const pending=this.pendingReturn,available=this.director.npcs.filter(n=>this.cleaners.includes(n.id)&&n.active&&!n.busy&&
   !n.scriptedGoal&&n.state==='patrol');
  if(!available.length)return;
  const waiting=pending?[pending.mess,...this.messes]:this.messes;
  for(const m of waiting){
   if(this.jobs.has(m)||!m.seen||m.source&&this.devices?.on.has(m.source)||(this.retryAfter.get(m)??0)>this.clock)continue;
   const returning=pending?.mess===m;
   const v=returning?this.devices!.devices.find(d=>d.id===pending.vacuum):m.kind==='blood'?this.vacuum():undefined;
   if(v&&(!returning&&pending?.vacuum===v.id||[...this.jobs.values()].some(j=>j.vacuum===v.id)))continue;
   const target=returning&&v?this.devices!.spot(v):m.pos;
   const c=available.filter(n=>floorOf(n.pos.y)===floorOf(target.y)).sort((a,b)=>flat(a.pos,target)-flat(b.pos,target))[0];
   if(!c)continue;
   const job:Job={mess:m,cleaner:c,phase:v?'fetch':'carry',t:m.cleaned*CLEAN_SECONDS,vacuum:v?.id,goal:null,lastStep:{...c.pos},idle:0};
   if(!this.go(job)){this.defer(job);continue;}
   this.jobs.set(m,job);
   available.splice(available.indexOf(c),1);
   this.director.incidents.write(this.incident(m),'assigned',target,c.id);
   this.notices.push(c.label+(returning?'が掃除機を戻しに向かう。':'が掃除に向かう。'));
   if(!available.length)break;
  }
 }
 private stepJob(j:Job,dt:number){
  const d=this.director,c=j.cleaner,v=j.vacuum?this.devices!.devices.find(x=>x.id===j.vacuum):undefined;
 // Alerted, called away or put down: the job stops; the vacuum stays where it is.
  if(!c.active||c.state!=='patrol'||c.busy||c.scriptedGoal!==j.goal||j.mess.source&&this.devices?.on.has(j.mess.source)){this.stop(j);return;}
  const goal=j.goal,there=j.phase!=='clean'&&!!goal&&flat(c.pos,goal)<=(j.mess.kind==='water'?.4:ARRIVE)&&Math.abs(c.pos.y-goal.y)<.5&&d.nav.clear(c.pos,goal);
  if(j.phase!=='clean'&&!there){
   if(Math.hypot(flat(c.pos,j.lastStep),c.pos.y-j.lastStep.y)>=.12){j.lastStep={...c.pos};j.idle=0;}
   else if((j.idle+=dt)>=STUCK_SECONDS){this.defer(j);return;}
  }
  if(v&&(j.phase==='carry'||j.phase==='clean'||j.phase==='return')){const side=c.heading+Math.PI/2;v.x=c.pos.x+Math.sin(side)*.35+Math.sin(c.heading)*.25;v.z=c.pos.z+Math.cos(side)*.35+Math.cos(c.heading)*.25;v.y=0;v.heading=c.heading;v.approach={x:c.pos.x,z:c.pos.z};}
  if(j.phase==='fetch'&&there){j.phase=this.pendingReturn?.mess===j.mess?'return':'carry';if(!this.go(j))this.defer(j);}
  else if(j.phase==='carry'&&there){j.phase='clean';this.go(j);if(v)this.devices!.operate(v.id,true);}
  else if(j.phase==='clean'){j.t+=dt;j.mess.cleaned=Math.min(1,j.t/CLEAN_SECONDS);if(j.t>=CLEAN_SECONDS){this.messes.splice(this.messes.indexOf(j.mess),1);this.retryAfter.delete(j.mess);if(v)this.devices!.operate(v.id,false);this.notices.push(`${c.label}が${j.mess.kind==='water'?'水たまり':'血だまり'}を掃除した。`);
   if(v){this.pendingReturn={mess:j.mess,vacuum:v.id};j.phase='return';if(!this.go(j))this.defer(j);}else this.complete(j);}}
  else if(j.phase==='return'&&there){
   const h=this.home.get(v!.id)!;Object.assign(v!,{x:h.x,z:h.z,y:h.y,heading:h.heading,approach:{...h.approach}});
   this.pendingReturn=null;this.retryAfter.delete(j.mess);this.complete(j);
  }
 }
 private go(j:Job){const c=j.cleaner,v=j.vacuum?this.devices!.devices.find(x=>x.id===j.vacuum):undefined,y=c.pos.y;
  if(j.phase==='fetch'&&v)this.errand(j,this.devices!.spot(v));
  else if(j.phase==='carry'){
   const m=j.mess.pos,heading=Math.atan2(c.pos.x-m.x,c.pos.z-m.z);
   const {nav,boxes}=this.director;
   for(const offset of [0,1,-1,2,-2,3,-3,4]){
    const a=heading+offset*Math.PI/4,at={x:m.x+Math.sin(a)*.6,y:m.y,z:m.z+Math.cos(a)*.6};
    if(!nav.clear(at,at)||!segmentClear(boxes,{...at,y:at.y+.15},{...m,y:m.y+.05}))continue;
    if(!nav.clear(c.pos,at)){const end=nav.find(c.pos,at)?.at(-1);if(!end||!nav.clear(end,at))continue;}
    this.errand(j,at);
    return true;
   }
   return false;
  }
  else if(j.phase==='clean'){const m=j.mess.pos;this.errand(j,j.goal,j.mess.kind==='water'?'mop_floor':'clean',Math.atan2(m.x-c.pos.x,m.z-c.pos.z));}
  else if(j.phase==='return'&&v){const h=this.home.get(v.id)!;this.errand(j,{x:h.approach.x,y,z:h.approach.z});}
  return true;
 }
 private defer(j:Job){this.retryAfter.set(j.mess,this.clock+RETRY_SECONDS);this.stop(j);}
 private finish(j:Job){if(j.cleaner.scriptedGoal===j.goal)this.errand(j,null);this.jobs.delete(j.mess);}
 private complete(j:Job){this.director.incidents.end(j.mess,'completed',j.mess.pos,j.cleaner.id);this.finish(j);}
 private stop(j:Job){if(j.goal)this.director.incidents.write(this.incident(j.mess),'released',j.mess.pos,j.cleaner.id);if(j.phase==='clean'&&j.vacuum)this.devices!.operate(j.vacuum,false);this.finish(j);}
 /** In the view cone and the line of sight, within SEE_RANGE, on the same floor. */
 sees(n:Npc,p:Position){const v=n.vision(this.director.rules),dx=p.x-n.pos.x,dz=p.z-n.pos.z,dist=Math.hypot(dx,dz);if(dist>Math.min(SEE_RANGE,v.range)||Math.abs(p.y-n.pos.y)>1.5)return false;
  const off=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-n.heading),Math.cos(Math.atan2(dx,dz)-n.heading)))*180/Math.PI;
  return off<=v.half&&segmentClear(this.director.boxes,{...n.pos,y:n.pos.y+this.director.rules.vision.eye},{x:p.x,y:p.y+.05,z:p.z});}
 snapshot(){const jobs=[...this.jobs.values()].map(j=>({cleaner:j.cleaner.id,phase:j.phase,t:+j.t.toFixed(1),mess:j.mess.id}));return {jobs,messes:this.messes.map(m=>({id:m.id,kind:m.kind,seen:m.seen,cleaned:+m.cleaned.toFixed(2),pos:m.pos})),job:this.job&&{cleaner:this.job.cleaner.id,phase:this.job.phase,t:+this.job.t.toFixed(1)}};}
}

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
export type Mess={id:number;kind:'blood';pos:Position;seen:boolean;cleaned:number;victim:string};
type Phase='fetch'|'carry'|'clean'|'return';
export type Job={mess:Mess;cleaner:Npc;phase:Phase;t:number;vacuum?:string};
export const BLOODY=new Set(['gun','kitchen_knife','thrown_kitchen_knife','katana','thrown_katana','finish']);
export const CLEAN_SECONDS=8,SEE_RANGE=10,ARRIVE=.7;
const flat=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

export class ChoreSystem{
 readonly messes:Mess[]=[];job:Job|null=null;notices:string[]=[];
 private nextId=1;private bled=new Set<string>();private home=new Map<string,{x:number;z:number;y:number;heading:number;approach:{x:number;z:number}}>();
 readonly director:Director;readonly devices:DeviceSystem|null;readonly cleaners:string[];
 /** Called when an errand starts or ends (the schedule forgets its travel so the walk gets a fresh budget). */
 onErrand?: (n:Npc)=>void;
 constructor(director:Director,devices:DeviceSystem|null,cleaners:string[]){this.director=director;this.devices=devices;this.cleaners=cleaners;
  for(const d of devices?.devices??[])if(d.kind==='vacuum')this.home.set(d.id,{x:d.x,z:d.z,y:d.y,heading:d.heading,approach:{...d.approach}});}
 add(kind:Mess['kind'],pos:Position,victim=''){const m={id:this.nextId++,kind,pos:{...pos},seen:false,cleaned:0,victim};this.messes.push(m);return m;}
 private errand(n:Npc,at:Position|null,action='',heading:number|null=null){n.scriptedGoal=at&&{...at};n.scriptedAction=action;n.scriptedHeading=heading;this.onErrand?.(n);}
 private vacuum(){return this.devices?.devices.find(d=>d.kind==='vacuum');}
 step(dt:number){this.notices=[];const d=this.director;
  // New bloody deaths bleed where the body lies now.
  for(const n of d.npcs)if(n.life==='dead'&&!this.bled.has(n.id)){this.bled.add(n.id);if(BLOODY.has(n.deathMethod)&&n.bodyMode==='ground')this.add('blood',n.pos,n.id);}
  // Someone notices a pool: a guard comes to look, a bystander turns to it. Then it is a job for the cleaner.
  for(const m of this.messes){if(m.seen)continue;for(const n of d.npcs){if(!n.active||n.busy||this.cleaners.includes(n.id)||!this.sees(n,m.pos))continue;m.seen=true;
   if(n.guard)n.radio({...m.pos},d.rules);else n.hear({...m.pos},d.rules);this.notices.push(`${n.label}が血だまりに気づいた。`);break;}}
  if(!this.job){const m=this.messes.find(m=>m.seen);const c=m&&this.cleaners.map(id=>d.npcs.find(n=>n.id===id)).filter((n):n is Npc=>!!n&&n.active&&!n.busy&&n.state==='patrol'&&floorOf(n.pos.y)===floorOf(m.pos.y)).sort((a,b)=>flat(a.pos,m.pos)-flat(b.pos,m.pos))[0];
   if(m&&c){const v=this.vacuum();this.job={mess:m,cleaner:c,phase:v?'fetch':'carry',t:0,vacuum:v?.id};this.go(this.job);this.notices.push(`${c.label}が掃除に向かう。`);}}
  const j=this.job;if(!j)return;const c=j.cleaner,v=j.vacuum?this.devices!.devices.find(x=>x.id===j.vacuum):undefined;
  // Alerted, called away or put down: the job stops; the vacuum stays where it is.
  if(!c.active||c.state!=='patrol'||c.busy){this.stop(j);return;}
  if(v&&(j.phase==='carry'||j.phase==='clean'||j.phase==='return')){const side=c.heading+Math.PI/2;v.x=c.pos.x+Math.sin(side)*.35+Math.sin(c.heading)*.25;v.z=c.pos.z+Math.cos(side)*.35+Math.cos(c.heading)*.25;v.y=0;v.heading=c.heading;v.approach={x:c.pos.x,z:c.pos.z};}
  const goal=c.scriptedGoal,there=!!goal&&flat(c.pos,goal)<=ARRIVE&&Math.abs(c.pos.y-goal.y)<.5;
  if(j.phase==='fetch'&&there){j.phase='carry';this.go(j);}
  else if(j.phase==='carry'&&there){j.phase='clean';j.t=0;this.go(j);if(v)this.devices!.operate(v.id,true);}
  else if(j.phase==='clean'){j.t+=dt;j.mess.cleaned=Math.min(1,j.t/CLEAN_SECONDS);if(j.t>=CLEAN_SECONDS){this.messes.splice(this.messes.indexOf(j.mess),1);if(v)this.devices!.operate(v.id,false);this.notices.push(`${c.label}が血だまりを掃除した。`);
   if(v){j.phase='return';this.go(j);}else this.finish(j);}}
  else if(j.phase==='return'&&there){const h=this.home.get(v!.id)!;Object.assign(v!,{x:h.x,z:h.z,y:h.y,heading:h.heading,approach:{...h.approach}});this.finish(j);}}
 private go(j:Job){const c=j.cleaner,v=j.vacuum?this.devices!.devices.find(x=>x.id===j.vacuum):undefined,y=c.pos.y;
  if(j.phase==='fetch'&&v)this.errand(c,{x:v.approach.x,y,z:v.approach.z});
  else if(j.phase==='carry'){const m=j.mess.pos,a=Math.atan2(c.pos.x-m.x,c.pos.z-m.z);this.errand(c,{x:m.x+Math.sin(a)*.6,y:m.y,z:m.z+Math.cos(a)*.6});}
  else if(j.phase==='clean'){const m=j.mess.pos;this.errand(c,{...c.scriptedGoal!},'clean',Math.atan2(m.x-c.pos.x,m.z-c.pos.z));}
  else if(j.phase==='return'&&v){const h=this.home.get(v.id)!;this.errand(c,{x:h.approach.x,y,z:h.approach.z});}}
 private finish(j:Job){this.errand(j.cleaner,null);this.job=null;}
 private stop(j:Job){if(j.vacuum)this.devices!.operate(j.vacuum,false);if(j.cleaner.scriptedGoal)this.errand(j.cleaner,null);this.job=null;}
 /** In the view cone and the line of sight, within SEE_RANGE, on the same floor. */
 sees(n:Npc,p:Position){const v=n.vision(this.director.rules),dx=p.x-n.pos.x,dz=p.z-n.pos.z,dist=Math.hypot(dx,dz);if(dist>Math.min(SEE_RANGE,v.range)||Math.abs(p.y-n.pos.y)>1.5)return false;
  const off=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-n.heading),Math.cos(Math.atan2(dx,dz)-n.heading)))*180/Math.PI;
  return off<=v.half&&segmentClear(this.director.boxes,{...n.pos,y:n.pos.y+this.director.rules.vision.eye},{x:p.x,y:p.y+.05,z:p.z});}
 snapshot(){return {messes:this.messes.map(m=>({id:m.id,kind:m.kind,seen:m.seen,cleaned:+m.cleaned.toFixed(2),pos:m.pos})),job:this.job&&{cleaner:this.job.cleaner.id,phase:this.job.phase,t:+this.job.t.toFixed(1)}};}
}

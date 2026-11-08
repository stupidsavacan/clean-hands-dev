import type {Director,Npc} from './ai.ts';
import {segmentClear} from './sight.ts';
import type {Position} from './world.ts';

export const RESCUE_SECONDS=2.4;
const distance=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);
const near=(a:Position,b:Position,radius:number)=>distance(a,b)<radius&&Math.abs(a.y-b.y)<.35;
const down=(body:Npc)=>body.life==='unconscious'&&body.bodyMode==='ground'&&body.fall>=1;
type Rescue={body:Npc;guard:Npc;at:Position;elapsed:number};
type Request={origin:Position;unreachable:Set<Npc>;rescue?:Rescue};

export class BodyRescue{
 private readonly requests=new Map<Npc,Request>();
 private readonly director:Director;
 constructor(director:Director){this.director=director;}
 request(body:Npc){
  if(down(body)&&!this.requests.has(body))this.requests.set(body,{origin:{...body.pos},unreachable:new Set()});
 }
 assigned(guard:Npc){return [...this.requests.values()].some(r=>r.rescue?.guard===guard);}
 get playing(){return [...this.requests.values()].flatMap(({rescue})=>rescue&&rescue.elapsed>0?[rescue]:[]);}

 assign(){
  for(const [body,request] of this.requests){
   if(request.rescue||!down(body)||body.busy)continue;
   const responding=(guard:Npc)=>guard.state==='investigate'&&guard.evidenceGoal&&near(guard.evidenceGoal,body.pos,1.5);
   const candidates=this.director.npcs.filter(g=>g.guard&&g.active&&!g.busy&&!this.assigned(g)&&!request.unreachable.has(g)&&
    (g.state==='patrol'||g.state==='curious'||g.state==='distracted'||responding(g)));
   const cost=(g:Npc)=>distance(g.pos,body.pos)+Math.abs(g.pos.y-body.pos.y)*3;
   candidates.sort((a,b)=>Number(!!responding(b))-Number(!!responding(a))||cost(a)-cost(b));
   for(const guard of candidates){
    const at=this.approach(body,guard);
    if(!at){request.unreachable.add(guard);continue;}
    guard.radio(at,this.director.rules);
    // The current body alert may already have sent this guard to the middle of the body.
    guard.goal={...at};guard.evidenceGoal={...at};guard.arrived=false;
    request.rescue={body,guard,at,elapsed:0};
    this.director.incidents.write(this.incident(body),'assigned',at,guard.id);
    break;
   }
  }
 }

 step(dt:number,onRevived:(body:Npc)=>void){
  for(const [body,request] of this.requests){
   if(!down(body)||!near(request.origin,body.pos,.25)){
    this.requests.delete(body);
    if(body.bodyMode==='ground'&&body.life==='unconscious'){
     if(request.rescue)this.release(request,request.rescue);
    }else this.director.incidents.end(body,'cancelled',body.pos,request.rescue?.guard.id,body.id+':unconscious');
    continue;
   }
   const rescue=request.rescue;
   if(!rescue)continue;
   const {guard,at}=rescue;
   if(body.busy||!guard.active||guard.busy||guard.state!=='investigate'||!guard.evidenceGoal||!near(guard.evidenceGoal,at,.2)){
    this.release(request,rescue);
    continue;
   }
   if(!near(guard.pos,body.pos,1.02)||!segmentClear(this.director.boxes,{...guard.pos,y:guard.pos.y+.9},{...body.pos,y:body.pos.y+.35})){
    if(guard.arrived){request.unreachable.add(guard);this.release(request,rescue);}
    else rescue.elapsed=0;
    continue;
   }
   guard.arrived=true;guard.speed=0;guard.heading=Math.atan2(body.pos.x-guard.pos.x,body.pos.z-guard.pos.z);
   guard.timer=Math.max(guard.timer,2*dt);
   rescue.elapsed+=dt;
   if(rescue.elapsed<RESCUE_SECONDS)continue;
   this.requests.delete(body);
   this.director.incidents.end(body,'completed',body.pos,guard.id);
   body.life='active';body.fall=0;body.fallOrigin=null;body.arrived=false;body.arrest=false;body.detainT=0;
   body.state=body.witness?'report':'patrol';
   if(body.witness)body.timer=this.director.rules.timers.report;
   onRevived(body);
  }
 }

 private incident(body:Npc){return this.director.incidents.identify(body,'body',body.id+':unconscious');}
 private release(request:Request,rescue:Rescue){
  this.director.incidents.write(this.incident(rescue.body),'released',rescue.at,rescue.guard.id);
  request.rescue=undefined;
 }
 private approach(body:Npc,guard:Npc){
  const {nav}=this.director,c=Math.cos(body.heading)*.40,s=Math.sin(body.heading)*.40;
  const positions=[{...body.pos,x:body.pos.x+c,z:body.pos.z-s},{...body.pos,x:body.pos.x-c,z:body.pos.z+s}];
  return positions.sort((a,b)=>distance(a,guard.pos)-distance(b,guard.pos)).find(at=>
   nav.clear(at,at)&&segmentClear(this.director.boxes,{...at,y:at.y+.9},{...body.pos,y:body.pos.y+.35}));
 }
}

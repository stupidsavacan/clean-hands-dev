import type {Director,Npc,PlayerView} from './ai.ts';
import type {MissionEvents} from './events.ts';
import type {HotelAlert} from './m3.ts';
import {segmentClear} from './sight.ts';
import {floorOf,plateY,type Level,type Position} from './world.ts';
/** M5.6 ways of being found, besides the face-knowers (M4, kept in ai.ts):
 * - witnesses: a bystander who saw a crime or a murdered body runs to the nearest guard; only on arrival does the
 *   hotel alert rise and the guard set off. Knocking them out on the way stops it. (Guards radio in at once.)
 * - items: illegal / suspicious / normal; a suspicious thing is fine in the outfits allowed to carry it.
 * - cameras: what they see of a crime, a forbidden zone or a body being carried leaves a recording; the monitor man
 *   at his desk reports it. The recorder in the security room erases it (quietly in staff clothes, or by smashing it).
 *   A recording left at the exit costs points and the ghost rating. Shooting a camera stops it but draws guards.
 * - blending: doing the outfit's job at a BLEND_ spot — no suspicion, and face-knowers need to come within 2 m. */
export type Legality='illegal'|'suspicious'|'normal';
export type ItemDef={label:string;legality:Legality;concealable:boolean;allowedFor?:string[]};
export type BlendSpot={id:string;label:string;disguises:string[];action:string;x:number;z:number;floor:number;heading:number};
export type DetectionData={items:Record<string,ItemDef>;worldItems:{id:string;item:string;x:number;z:number;floor:number}[];blend:BlendSpot[];
 recorder:{x:number;z:number;floor:number;eraseSeconds:number;breakSeconds:number;noise:number};monitor:{id:string;radio:number;reportEvery:number};witness:{reach:number};cameraTick:number;useRadius:number};
export type Camera={id:string;label:string;x:number;y:number;z:number;floor:number;heading:number;fov:number;range:number};
export type Act={illegal:boolean;trespass:boolean;carrying:boolean};
const flat=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

export class DetectionSystem{
 held='';blend:BlendSpot|null=null;recorded=false;recordReason='';readonly destroyed=new Set<string>();
 readonly floor:{key:number;item:string;pos:Position}[]=[];action:{kind:'erase'|'break';elapsed:number;duration:number}|null=null;
 private tick=0;private nextKey=1;private lastReport=new Map<string,number>();private running=new Set<string>();
 readonly director:Director;readonly events:MissionEvents;readonly hotel:HotelAlert;readonly cameras:Camera[];readonly data:DetectionData;readonly level:Level;
 constructor(director:Director,events:MissionEvents,hotel:HotelAlert,cameras:Camera[],data:DetectionData,level:Level){
  this.director=director;this.events=events;this.hotel=hotel;this.cameras=cameras;this.data=data;this.level=level;
  for(const w of data.worldItems)this.floor.push({key:this.nextKey++,item:w.item,pos:{x:w.x,y:plateY(level,w.floor),z:w.z}});}
 get workingCameras(){return this.cameras.filter(c=>!this.destroyed.has(c.id));}
 // ---- items ----
 legality(item:string,disguise:string):{legality:Legality;ok:boolean}{const d=this.data.items[item];if(!d)return {legality:'normal',ok:true};
  return {legality:d.legality,ok:d.legality==='normal'||!!d.allowedFor?.includes(disguise)};}
 /** A suspicious thing in hand that this outfit should not have. */
 suspiciousHeld(disguise:string){return !!this.held&&this.legality(this.held,disguise).legality==='suspicious'&&!this.legality(this.held,disguise).ok;}
 nearestItem(p:Position){return this.floor.filter(f=>flat(f.pos,p)<this.data.useRadius&&Math.abs(f.pos.y-p.y)<.5).sort((a,b)=>flat(a.pos,p)-flat(b.pos,p))[0];}
 /** Picks up a thing; whatever was in hand is put down in its place. */
 pickup(p:Position){const f=this.nearestItem(p);if(!f)return null;this.floor.splice(this.floor.indexOf(f),1);if(this.held)this.floor.push({key:this.nextKey++,item:this.held,pos:{...f.pos}});this.held=f.item;return this.data.items[f.item]?.label??f.item;}
 putDown(p:Position){if(!this.held)return null;const item=this.held;this.floor.push({key:this.nextKey++,item,pos:{x:p.x,y:p.y,z:p.z}});this.held='';return this.data.items[item]?.label??item;}
 // ---- blending ----
 blendSpot(p:PlayerView){return this.data.blend.find(b=>b.disguises.includes(p.disguise)&&floorOf(p.y)===b.floor&&flat(b,p)<this.data.useRadius);}
 /** Spots near the agent for some other outfit (to tell the player why E does nothing there). */
 otherBlend(p:PlayerView){return this.data.blend.find(b=>!b.disguises.includes(p.disguise)&&floorOf(p.y)===b.floor&&flat(b,p)<this.data.useRadius);}
 startBlend(p:PlayerView){const b=this.blendSpot(p);if(!b)return null;this.blend=b;return b;}
 stopBlend(){this.blend=null;}
 // ---- the recorder ----
 nearRecorder(p:Position){const r=this.data.recorder;return floorOf(p.y)===r.floor&&flat(r,p)<this.data.useRadius;}
 /** Hold E at the recorder: staff clothes erase quietly; anything else smashes it, which is heard. */
 beginRecorder(quiet:boolean){if(this.action)return;this.action={kind:quiet?'erase':'break',elapsed:0,duration:quiet?this.data.recorder.eraseSeconds:this.data.recorder.breakSeconds};}
 cancel(){this.action=null;}
 private finishRecorder(kind:'erase'|'break',time:number){const was=this.recorded;this.recorded=false;this.recordReason='';
  if(was)this.events.emit({type:'camera.cleared',time,reason:kind});
  if(kind==='break'){const r=this.data.recorder,at={x:r.x,y:plateY(this.level,r.floor),z:r.z};for(const n of this.director.npcs)if(n.active&&!n.busy&&n.guard&&flat(n.pos,at)<=r.noise)n.radio(at,this.director.rules);}}
 // ---- cameras ----
 sees(c:Camera,p:PlayerView){if(this.destroyed.has(c.id)||c.floor!==floorOf(p.y))return false;const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz);
  if(d>c.range||Math.abs(wrap(Math.atan2(dx,dz)-c.heading))*180/Math.PI>c.fov/2)return false;
  return segmentClear(this.director.boxes,{x:c.x,y:c.y,z:c.z},{x:p.x,y:p.y+(p.crouched?.9:1.2),z:p.z});}
 /** A shot whose line passes a working camera (before it hit anyone) breaks it; guards come to look. */
 shotAt(from:Position,to:Position,time:number){const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,l2=dx*dx+dy*dy+dz*dz||1;
  for(const c of this.cameras){if(this.destroyed.has(c.id))continue;const t=Math.max(0,Math.min(1,((c.x-from.x)*dx+(c.y-from.y)*dy+(c.z-from.z)*dz)/l2)),q={x:from.x+dx*t,y:from.y+dy*t,z:from.z+dz*t};
   if(Math.hypot(q.x-c.x,q.y-c.y,q.z-c.z)>.35)continue;this.destroyed.add(c.id);this.events.emit({type:'camera.destroyed',time,id:c.id});
   for(const n of this.director.npcs)if(n.active&&!n.busy&&n.guard&&flat(n.pos,c)<=20)n.radio({x:c.x,y:plateY(this.level,c.floor),z:c.z},this.director.rules);return c;}
  return null;}
 record(c:Camera,reason:string,p:PlayerView,time:number){if(!this.recorded){this.recorded=true;this.recordReason=reason;this.events.emit({type:'camera.recorded',time,id:c.id,reason});}
  // The monitor man at his desk sees it live and calls the guards near the agent, who now know the outfit.
  const m=this.director.npcs.find(n=>n.id===this.data.monitor.id);if(!m||!m.active||m.busy||!['patrol','curious'].includes(m.state)||!m.atPost(this.director.mission.zones,0))return;
  if(time-(this.lastReport.get(c.id)??-Infinity)<this.data.monitor.reportEvery)return;this.lastReport.set(c.id,time);
  this.director.compromised.add(p.disguise);this.director.onSpotted?.(m);this.events.emit({type:'witness.reported',time,id:m.id,reason:'camera:'+c.id});
  for(const n of this.director.npcs)if(n.active&&!n.busy&&n.guard&&n!==m&&flat(n.pos,p)<=this.data.monitor.radio)n.radio({x:p.x,y:p.y,z:p.z},this.director.rules);}
 /** Is a working camera watching the agent right now (for the HUD and the debug view)? */
 watching(p:PlayerView){return this.cameras.filter(c=>this.sees(c,p)).map(c=>c.id);}

 step(dt:number,p:PlayerView,act:Act,time:number,moving:boolean,eHeld:boolean){
  if(this.blend&&(moving||p.disguise&&!this.blend.disguises.includes(p.disguise)))this.blend=null;
  if(this.action){if(moving||!eHeld||!this.nearRecorder(p))this.action=null;else if((this.action.elapsed+=dt)>=this.action.duration){const k=this.action.kind;this.action=null;this.finishRecorder(k,time);}}
  // Witnesses run to the nearest guard and tell them on arrival.
  for(const n of this.director.npcs){if(!n.active||n.state!=='report'||!n.witness){if(this.running.has(n.id)&&(!n.active||!n.witness))this.running.delete(n.id);continue;}
   if(!this.running.has(n.id)){this.running.add(n.id);this.events.emit({type:'witness.started',time,id:n.id,reason:n.witness.what});}
   const g=this.nearestGuard(n);if(!g){this.deliver(n,null,time);continue;}
   n.goal={...g.pos};n.arrived=false;if(flat(n.pos,g.pos)<=this.data.witness.reach&&Math.abs(n.pos.y-g.pos.y)<1)this.deliver(n,g,time);}
  // Cameras look a few times a second.
  if((this.tick+=dt)<this.data.cameraTick)return;this.tick=0;const reason=act.illegal?'違法行為':act.carrying?'身体の運搬':act.trespass?'立入禁止区域':'';
  if(reason)for(const c of this.cameras)if(this.sees(c,p))this.record(c,reason,p,time);}
 private nearestGuard(n:Npc){let best:Npc|null=null,d=Infinity;for(const g of this.director.npcs){if(!g.active||g.busy||!g.guard||g.state==='combat')continue;const k=flat(g.pos,n.pos)+Math.abs(g.pos.y-n.pos.y)*20;if(k<d){d=k;best=g;}}return best;}
 private deliver(n:Npc,g:Npc|null,time:number){const w=n.witness!;n.witness=null;n.state='patrol';n.suspicion=0;n.goal=null;this.running.delete(n.id);
  this.hotel.discover(w.key);this.events.emit({type:'witness.reported',time,id:n.id,reason:w.what});if(g){g.radio(w.at,this.director.rules);g.evidenceGoal=w.what==='body'?{...w.at}:null;}}
 snapshot(p?:PlayerView){return {held:this.held,blend:this.blend?.id??null,recorded:this.recorded,recordReason:this.recordReason,destroyed:[...this.destroyed],action:this.action&&{...this.action},
  witnesses:this.director.npcs.filter(n=>n.active&&n.witness).map(n=>({id:n.id,what:n.witness!.what})),floor:this.floor.map(f=>({item:f.item,pos:f.pos})),watching:p?this.watching(p):[]};}
}

import type {Director,Npc,PlayerView} from './ai.ts';
import type {MissionEvents} from './events.ts';
import type {HotelAlert} from './m3.ts';
import {segmentClear} from './sight.ts';
import {defaultCarry,evaluateItemLegality,itemMaster,type ItemMaster} from './items.ts';
import {floorOf,plateY,type Level,type Position} from './world.ts';
import {BACK_ITEMS,BACK_MAX,LARGE_ITEMS,isCase} from './melee.ts';
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
 recorder:{x:number;z:number;floor:number;eraseSeconds:number;breakSeconds:number;noise:number};monitor:{id:string;radio:number;reportEvery:number};witness:{reach:number;repeatSeconds:number};cameraTick:number;useRadius:number};
export type Camera={id:string;label:string;x:number;y:number;z:number;floor:number;heading:number;fov:number;range:number};
export type Act={illegal:boolean;trespass:boolean;carrying:boolean};
const flat=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

export type CaseGun={id:string;mag:number;reserve:number};
export class DetectionSystem{
 // ROADMAP M09/N22 (2026-11-06): what the case in hand holds (one gun, out of sight; a frisk still finds it).
 // 2026-11-07: a case put down, thrown or swapped keeps its own gun (CaseGun on the floor entry), so two cases never share one.
 caseGun:CaseGun|null=null;
 // When the case was last opened to put something in or take it out (performance.now ms; the view swings the lid).
 caseOpenedAt=-Infinity;
 // Swords on the agent's back (full spec rows 32/64/120): up to BACK_MAX, never the same one in hand and on the back.
 readonly back:string[]=[];
 // Small things put away out of sight (2026-11-06, HITMAN-style inventory): not seen by anyone, still found by a frisk.
 readonly pocket:string[]=[];
 /** HITMAN-style pockets (2026-11-06). Off in the game until the inventory strip is finished in the UI lab. */
 pockets=false;
 canPocket(item:string){return !!item&&!LARGE_ITEMS.includes(item);}
 /** The thing in hand put away: in a pocket if small, on the back if a sword with room; otherwise it stays (false). */
 stow(){if(!this.held)return true;if(this.canHolster()){this.back.push(this.held);this.held='';return true;}if(this.canPocket(this.held)){this.pocket.push(this.held);this.held='';return true;}return false;}
 /** Out of the pocket (or off the back) into the hand; what was in hand is put away first, or put down at p if it cannot be. */
 take(item:string,from:'pocket'|'back',p:Position){const list=from==='pocket'?this.pocket:this.back,i=list.lastIndexOf(item);if(i<0)return false;if(!this.stow())this.putDown(p);list.splice(i,1);this.held=item;return true;}
 held='';blend:BlendSpot|null=null;recorded=false;recordReason='';readonly destroyed=new Set<string>();
 readonly floor:{key:number;item:string;pos:Position;contents?:CaseGun|null}[]=[];action:{kind:'erase'|'break';elapsed:number;duration:number}|null=null;
 private tick=0;private nextKey=1;private lastReport=new Map<string,number>();private running=new Set<string>();
 readonly director:Director;readonly events:MissionEvents;readonly hotel:HotelAlert;readonly cameras:Camera[];readonly data:DetectionData;readonly level:Level;
 constructor(director:Director,events:MissionEvents,hotel:HotelAlert,cameras:Camera[],data:DetectionData,level:Level){
  this.director=director;this.events=events;this.hotel=hotel;this.cameras=cameras;this.data=data;this.level=level;this.items=itemMaster(data.items);
  for(const w of data.worldItems)this.floor.push({key:this.nextKey++,item:w.item,pos:{x:w.x,y:plateY(level,w.floor),z:w.z}});}
 get workingCameras(){return this.cameras.filter(c=>!this.destroyed.has(c.id));}
 // ---- items ----
 // F01: the shared item table (main.ts hands in the merged one; alone it knows detection.json's items).
 items:ItemMaster;
 legality(item:string,disguise:string):{legality:Legality;ok:boolean}{const d=this.items[item];if(!d)return {legality:'normal',ok:true};
  return {legality:d.legality,ok:evaluateItemLegality(this.items,item,disguise,defaultCarry(this.items,item)).possessionAllowed};}
 /** A suspicious thing in hand that this outfit should not have. */
 suspiciousHeld(disguise:string){return !!this.held&&this.legality(this.held,disguise).legality==='suspicious'&&!this.legality(this.held,disguise).ok;}
 canPickUp?: (from:Position,to:Position)=>boolean;
 nearestItem(p:Position){return this.floor.filter(f=>flat(f.pos,p)<this.data.useRadius&&Math.abs(f.pos.y-p.y)<.5&&this.canPickUp?.(p,f.pos)!==false).sort((a,b)=>flat(a.pos,p)-flat(b.pos,p))[0];}
 /** Picks up a thing; whatever was in hand is put down in its place. */
 pickup(p:Position){const f=this.nearestItem(p);if(!f)return null;this.floor.splice(this.floor.indexOf(f),1);
  // A sword in hand goes onto the back if there is room; anything else is left where the new thing lay.
  if(this.held&&!(this.pockets?this.stow():this.canHolster()&&this.holster())){const {item,contents}=this.releaseHeld();this.floor.push({key:this.nextKey++,item,pos:{...f.pos},contents});}this.held=f.item;if(isCase(f.item))this.caseGun=f.contents??null;return this.data.items[f.item]?.label??f.item;}
 canHolster(){return BACK_ITEMS.includes(this.held)&&this.back.length<BACK_MAX;}
 /** The sword in hand onto the back, or (empty-handed) the last one off the back into the hand. */
 holster():'on'|'off'|null{if(this.canHolster()){this.back.push(this.held);this.held='';return 'on';}if(!this.held&&this.back.length){this.held=this.back.pop()!;return 'off';}return null;}
 /** An illegal thing in view that this outfit may not have: in hand (a knife, a sword) or on the back. */
 illegalShown(disguise:string){return [this.held,...this.back].some(i=>!!i&&this.legality(i,disguise).legality==='illegal'&&!this.legality(i,disguise).ok);}
 /** A thing left somewhere other than at the agent's feet (thrown, 2026-11-06). */
 place(item:string,pos:Position,contents:CaseGun|null=null){this.floor.push({key:this.nextKey++,item,pos:{...pos},contents});}
 /** The thing in hand leaves it (put down, thrown, swapped): a case takes what it holds along. */
 releaseHeld(){const item=this.held,contents=isCase(item)?this.caseGun:null;if(isCase(item))this.caseGun=null;this.held='';return {item,contents};}
 putDown(p:Position){if(!this.held)return null;const {item,contents}=this.releaseHeld();this.floor.push({key:this.nextKey++,item,pos:{x:p.x,y:p.y,z:p.z},contents});return this.data.items[item]?.label??item;}
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
 sees(c:Camera,p:PlayerView){if(p.hidden||this.destroyed.has(c.id)||c.floor!==floorOf(p.y))return false;const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz);
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
 private deliver(n:Npc,g:Npc|null,time:number){const w=n.witness!;n.witness=null;n.witnessCooldown=this.data.witness.repeatSeconds;n.state=g?'patrol':'flee';n.suspicion=0;n.goal=null;n.arrived=!g;n.timer=this.data.witness.repeatSeconds;this.running.delete(n.id);
  // F08: someone acting oddly is looked into; a crime or a body raises the hotel alert, and a named outfit is now blown.
  if(w.what!=='suspect')this.hotel.discover(w.key);if(w.disguise)this.director.compromised.add(w.disguise);this.director.raiseZone(w.at,w.what==='suspect'?1:2);
  this.events.emit({type:'witness.reported',time,id:n.id,reason:w.what});
  if(g){g.radio(w.at,this.director.rules,{eventType:'report',estimatedOrigin:{...w.at},identifiedDisguise:w.disguise,confirmedActor:!!w.disguise,confidence:.6,observedAt:time,sourceNpcId:n.id});if(w.disguise)g.knownDisguises.add(w.disguise);g.evidenceGoal=w.what==='body'?{...w.at}:null;}}
 snapshot(p?:PlayerView){return {held:this.held,back:[...this.back],pocket:[...this.pocket],caseGun:this.caseGun?.id??null,blend:this.blend?.id??null,recorded:this.recorded,recordReason:this.recordReason,destroyed:[...this.destroyed],action:this.action&&{...this.action},
  witnesses:this.director.npcs.filter(n=>n.active&&n.witness).map(n=>({id:n.id,what:n.witness!.what})),floor:this.floor.map(f=>({item:f.item,pos:f.pos})),watching:p?this.watching(p):[]};}
}

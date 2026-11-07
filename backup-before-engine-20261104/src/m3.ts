import type { Director, Npc, PlayerView } from './ai.ts';
import type { Position } from './world.ts';
import { segmentClear } from './sight.ts';

export type HideDef={id:string;label:string;x:number;y:number;z:number;heading:number;capacity:number;approach:{x:number;z:number};size:{w:number;h:number;d:number}};
export type M3Rules={distance:number;backAngle:number;koSeconds:number;killSeconds:number;hideSeconds:number;dragSpeed:number;hideRadius:number;discoverSeconds:number;cooldownSeconds:number};
export type Action={id:number;kind:'ko'|'kill'|'hide';npc:Npc;elapsed:number;duration:number;start:Position;targetStart:Position;targetHeading:number;container?:HideDef};
const flat=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
export class HotelAlert{
 level=0;quiet=0;readonly reported=new Set<string>();
 discover(id:string){if(this.reported.has(id))return false;this.reported.add(id);this.level=Math.min(3,this.level+1);this.quiet=0;return true;}
 step(dt:number,calm:boolean,seconds=600){if(!calm){this.quiet=0;return;}this.quiet+=dt;if(this.quiet>=seconds){if(this.level>1)this.level--;this.quiet=0;}}
}

// Simulation state is independent of meshes and render frame rate.
export class M3System{
 onAccidentFound?: (body:Npc,witness:Npc)=>void;
 // Every body's first discovery (unconscious or dead, accident or not), for scoring.
 onFound?: (body:Npc,witness:Npc)=>void;
 onReaction?: (n:Npc, reaction:string, reason:string, at:Position)=>void;
 action:Action|null=null;dragged:Npc|null=null;readonly hotel=new HotelAlert();
 readonly slots=new Map<string,string[]>();readonly discovered=new Map<string,Set<string>>();readonly deadFound=new Set<string>();readonly unconsciousFound=new Set<string>();
 stats={knockouts:0,kills:0,hidden:0,witnesses:0};notices:string[]=[];elapsed=0;private sequence=0;private held=new Set<string>();private witnessed=new Set<string>();private discoverClock=0;
 readonly director:Director;readonly hides:HideDef[];readonly rules:M3Rules;
 constructor(director:Director,hides:HideDef[],rules:M3Rules){this.director=director;this.hides=hides;this.rules=rules;for(const h of hides)this.slots.set(h.id,[]);}
 get locked(){return this.action!==null;}
 get progress(){return this.action?this.action.elapsed/this.action.duration:0;}
 cancel(){if(this.action){this.action.npc.busy=false;this.action=null;}}
 canAttack(p:Position,n:Npc){if(!n.active||n.busy||n.state==='alert'||Math.abs(p.y-n.pos.y)>.35||flat(p,n.pos)>this.rules.distance)return false;
  const d=flat(p,n.pos);if(d<.25)return false;const back=((p.x-n.pos.x)*Math.sin(n.heading)+(p.z-n.pos.z)*Math.cos(n.heading))/d;
  return [0,Math.PI/2,-Math.PI/2,Math.PI].some(a=>this.bodyFits(n.pos,n.heading+a))&&back<=-Math.cos(this.rules.backAngle*Math.PI/180)&&segmentClear(this.director.boxes,{...p,y:p.y+1.1},{...n.pos,y:n.pos.y+1.1});}
 target(p:Position){return this.director.npcs.filter(n=>this.canAttack(p,n)).sort((a,b)=>flat(a.pos,p)-flat(b.pos,p))[0];}
 body(p:Position){return this.director.npcs.filter(n=>n.life!=='active'&&n.bodyMode==='ground'&&flat(p,n.pos)<1.3&&Math.abs(p.y-n.pos.y)<.35&&segmentClear(this.director.boxes,{...p,y:p.y+.5},{...n.pos,y:n.pos.y+.2})).sort((a,b)=>flat(a.pos,p)-flat(b.pos,p))[0];}
 container(p:Position){return this.hides.find(h=>Math.abs(p.y-h.y)<.35&&flat(p,{x:h.x+h.approach.x,z:h.z+h.approach.z})<this.rules.hideRadius&&segmentClear(this.director.boxes,{...p,y:p.y+.7},{x:h.x+h.approach.x,y:h.y+.7,z:h.z+h.approach.z}));}
 prompt(p:Position){if(this.action)return `${this.action.kind==='ko'?'F 気絶させている':this.action.kind==='kill'?'X 排除している':'E 隠している'}…`;
  if(this.dragged){const h=this.container(p);return h?`E ${h.label}に隠す · ${this.slots.get(h.id)!.length}/${h.capacity}${this.slots.get(h.id)!.length>=h.capacity?' 満杯':''}`:'E 身体を置く · 運搬中（走行不可）';}
  const body=this.body(p);if(body)return `E ${body.life==='dead'?'死者':'気絶した人'}を運ぶ`;
  const n=this.target(p);if(n)return `F 長押し 気絶 ／ X 長押し 排除（致死） · ${n.label}`;
  const h=this.container(p);return h?`${h.label} · ${this.slots.get(h.id)!.length}/${h.capacity} · 身体を運んでくる`:'';}
 step(dt:number,p:PlayerView,heading:number,keys:Set<string>,suppressNewActions=false){this.elapsed+=dt;this.notices=[];const fresh=(k:string)=>!suppressNewActions&&keys.has(k)&&!this.held.has(k);let usesE=false;
  const moving=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k));
  if(this.action){const a=this.action,key=a.kind==='ko'?'KeyF':a.kind==='kill'?'KeyX':'KeyE';usesE=a.kind==='hide';
   if(!keys.has(key)||moving||flat(p,a.start)>.16||Math.abs(p.y-a.start.y)>.2||flat(a.npc.pos,a.targetStart)>.1||a.npc.active&&a.npc.state==='alert'||a.kind!=='hide'&&(!a.npc.active||Math.abs(a.npc.heading-a.targetHeading)>.15)){this.cancel();}
   else{a.elapsed+=dt;if(a.elapsed>=a.duration){this.complete(a);this.action=null;}}}
  else if(fresh('KeyE')){if(this.dragged){usesE=true;const h=this.container(p);if(h){if(this.slots.get(h.id)!.length>=h.capacity)this.notices.push('ロッカーは満杯です。');else this.begin('hide',this.dragged,p,h);}else if(this.bodyFits(this.dragged.pos,this.dragged.heading)){this.dragged.bodyMode='ground';this.dragged=null;}else this.notices.push('ここには置けません。広い場所へ移動してください。');}
   else{const body=this.body(p);if(body){usesE=true;body.bodyMode='dragged';this.dragged=body;}}}
  else if(!this.dragged&&!moving&&(fresh('KeyF')||fresh('KeyX'))){const n=this.target(p);if(n)this.begin(fresh('KeyX')?'kill':'ko',n,p);else this.notices.push('背後から近づいてください。壁際では倒れる空間も必要です。');}
  if(this.action&&this.action.kind!=='hide')this.witness(p,`action-${this.action.id}`);
  if(this.dragged)this.witness(p,'drag-'+this.dragged.id);
  for(const n of this.director.npcs)if(n.life!=='active')n.fall=Math.min(1,n.fall+dt/n.fallSeconds);
  this.discoverClock+=dt;if(this.discoverClock>=this.rules.discoverSeconds){this.discoverClock=0;this.discover();}
  this.hotel.step(dt,!this.action&&!this.dragged&&!this.director.npcs.some(n=>n.active&&['alert','report','investigate','search'].includes(n.state)),this.rules.cooldownSeconds);
  this.held=new Set(keys);void heading;return usesE;}
 private begin(kind:Action['kind'],npc:Npc,p:Position,container?:HideDef){npc.busy=true;npc.speed=0;this.action={id:++this.sequence,kind,npc,container,elapsed:0,duration:kind==='ko'?this.rules.koSeconds:kind==='kill'?this.rules.killSeconds:this.rules.hideSeconds,start:{...p},targetStart:{...npc.pos},targetHeading:npc.heading};}
 private complete(a:Action){const n=a.npc;n.busy=false;
  if(a.kind==='hide'){const h=a.container!;const slots=this.slots.get(h.id)!;if(slots.length>=h.capacity){this.notices.push('収納できませんでした。');return;}slots.push(n.id);n.bodyMode='hidden';n.pos={x:h.x,y:h.y,z:h.z};this.dragged=null;this.stats.hidden++;this.notices.push('身体を隠した。');}
  else{const fallHeading=[0,Math.PI/2,-Math.PI/2,Math.PI].map(a=>n.heading+a).find(h=>this.bodyFits(n.pos,h));if(fallHeading!==undefined)n.heading=fallHeading;n.life=a.kind==='ko'?'unconscious':'dead';n.bodyMode='ground';n.speed=0;n.suspicion=0;n.visibility=0;n.fall=0;n.evidenceGoal=null;n.goal=null;n.state='patrol';if(a.kind==='ko')this.stats.knockouts++;else this.stats.kills++;this.notices.push(a.kind==='ko'?'気絶させた。Eで運べます。':'排除した。Eで運べます。');}}
 private witness(p:PlayerView,event:string){for(const n of this.director.npcs){if(!n.active||n.busy)continue;n.perceive(p,this.director.boxes,this.director.rules);if(!n.visibility)continue;const id=event+':'+n.id;if(this.witnessed.has(id))continue;this.witnessed.add(id);this.stats.witnesses++;this.director.accuse(n,p);
   this.onReaction?.(n,n.guard?'alert':'report',event.startsWith('drag')?'carry':this.action?.kind??'crime',p);
   this.notices.push(`${n.label}に${event.startsWith('drag')?'運搬':'犯行'}を見られた！`);}}
 private sees(n:Npc,body:Npc){const v=n.vision(this.director.rules),dx=body.pos.x-n.pos.x,dz=body.pos.z-n.pos.z,d=Math.hypot(dx,dz),angle=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-n.heading),Math.cos(Math.atan2(dx,dz)-n.heading)))*180/Math.PI;
  if(d>v.range||angle>v.half||Math.abs(n.pos.y-body.pos.y)>2)return false;
  return [-.45,0,.45].some(t=>segmentClear(this.director.boxes,{...n.pos,y:n.pos.y+this.director.rules.vision.eye},{x:body.pos.x+Math.sin(body.heading)*t,y:body.pos.y+.22,z:body.pos.z+Math.cos(body.heading)*t}));}
 discover(){for(const body of this.director.npcs){if(body.life==='active'||body.bodyMode!=='ground'||body.fall<1)continue;
   for(const n of this.director.npcs){if(!n.active||n.busy||n===body||!n.guard&&n.witnessCooldown>0||!this.sees(n,body))continue;const key=body.id+':'+body.life;let known=this.discovered.get(key);if(!known){known=new Set();this.discovered.set(key,known);}if(known.has(n.id))continue;known.add(n.id);
    const first=body.life==='dead'?!this.deadFound.has(body.id):!this.unconsciousFound.has(body.id);// A guard radios a murder in at once; a bystander has to get to a guard first (M5.6 witness), which can be stopped.
    if(body.life==='dead'){this.deadFound.add(body.id);if(body.deathKind==='murder'&&n.guard)this.hotel.discover(body.id);}else this.unconsciousFound.add(body.id);if(first)this.onFound?.(body,n);
    if(body.life==='dead'&&body.deathKind==='combat')continue;
    if(body.life==='dead'&&body.deathKind==='accident'){if(first){this.notices.push('事故だ！ 警備が現場を立入禁止にする。');this.onAccidentFound?.(body,n);}continue;}
    if(first)this.notices.push(body.life==='dead'?'死体が発見された。ホテル警戒度が上がった。':'気絶した人が発見された。');
    // Evidence alone identifies a location, never the perpetrator.
    if(n.state!=='alert'&&n.state!=='search'){if(n.guard){n.radio(body.pos,this.director.rules);n.evidenceGoal={...body.pos};}else{n.state='report';n.timer=this.director.rules.timers.report;this.director.reports++;if(body.life==='dead'&&body.deathKind==='murder')n.witness={what:'body',at:{...body.pos},key:body.id};}
     this.onReaction?.(n,n.guard?'investigate':n.witness?'report':'alert',body.life==='dead'?'body':'unconscious_body',body.pos);}
    if(n.guard)for(const g of this.director.npcs)if(g.active&&!g.busy&&g.guard&&g.state!=='alert'&&g.state!=='search'&&flat(g.pos,n.pos)<this.director.rules.radio){g.radio(body.pos,this.director.rules);g.evidenceGoal={...body.pos};}
   }}}
 bodyFits(p:Position,heading:number){for(const t of [-.6,-.3,0,.3,.6]){const x=p.x+Math.sin(heading)*t,z=p.z+Math.cos(heading)*t,y=this.director.world.surface(x,z,p.y);if(y===null||Math.abs(y-p.y)>.3||this.director.world.blocked(x,y,z,.5))return false;}return true;}
 constrainMove(from:Position,to:Position,heading:number):Position{if(!this.dragged)return to;const n=this.dragged,w=this.director.world;
  // The drag anchor follows the path, not a teleport behind a sharply turned player.
  const dx=to.x-n.pos.x,dz=to.z-n.pos.z,d=Math.hypot(dx,dz),length=1.05;const target=d>length?w.move(n.pos,dx/d*(d-length),dz/d*(d-length),.5):{...n.pos};
  const h=d>.1?Math.atan2(dx,dz):heading;if(!this.bodyFits(target,h)||flat(target,to)>1.55||!segmentClear(this.director.boxes,{...target,y:target.y+.3},{...to,y:to.y+.3}))return from;
  n.pos=target;n.heading=h;return to;}
}


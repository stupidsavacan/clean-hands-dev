import type { Director, Npc, PlayerView } from './ai.ts';
import type { Position } from './world.ts';
import { segmentClear } from './sight.ts';
import { meleeOf, MELEE_REACH, PUNCH_SECONDS, FINISH_SECONDS, BRAWL_WINDOW, BRAWL_KEYS, keyLabel } from './melee.ts';
import { BRAWL_FINISH } from './brawl-motion.ts';

export type HideDef={id:string;label:string;x:number;y:number;z:number;heading:number;capacity:number;approach:{x:number;z:number};size:{w:number;h:number;d:number}};
export type M3Rules={distance:number;backAngle:number;koSeconds:number;killSeconds:number;hideSeconds:number;dragSpeed:number;hideRadius:number;discoverSeconds:number;cooldownSeconds:number};
export type Action={id:number;kind:'ko'|'kill'|'hide';npc:Npc;elapsed:number;duration:number;start:Position;targetStart:Position;targetHeading:number;container?:HideDef;item?:string;
 // Bare-hand variants (melee.ts): a punch from the front, a fight with a guard (stage, when it began, last landed blow),
 // a finishing blow to someone out cold.
 mode?:'punch'|'brawl'|'finish';stage?:number;stageAt?:number;hitAt?:number;
 // Struck from behind (M15) rather than from the front (M14): a sword stabs instead of cutting.
 behind?:boolean};
const flat=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
export class HotelAlert{
 level=0;quiet=0;readonly reported=new Set<string>();
 discover(id:string){if(this.reported.has(id))return false;this.reported.add(id);this.level=Math.min(3,this.level+1);this.quiet=0;return true;}
 step(dt:number,calm:boolean,seconds=600){if(!calm){this.quiet=0;return;}this.quiet+=dt;if(this.quiet>=seconds){if(this.level>1)this.level--;this.quiet=0;}}
}

// Simulation state is independent of meshes and render frame rate.
// HD09: how many guards answer a body found, and what a floor of stairs counts as in metres when picking the nearest.
export const BODY_BACKUP=2,BACKUP_FLOOR_M=8;
export class M3System{
 onAccidentFound?: (body:Npc,witness:Npc)=>void;
 // Every body's first discovery (unconscious or dead, accident or not), for scoring.
 onFound?: (body:Npc,witness:Npc)=>void;
 onReaction?: (n:Npc, reaction:string, reason:string, at:Position)=>void;
 action:Action|null=null;dragged:Npc|null=null;readonly hotel=new HotelAlert();
 // 2026-11-06: the thing in the agent's hand (DetectionSystem.held); a blunt one swings (F), a blade stabs (X), melee.ts.
 heldItem?: ()=>string;
 // ROADMAP H33 (2026-11-06): the agent hiding in a locker (it takes one of its places, like a body). A guard who saw
 // the agent get in comes to look (checkers) and pulls them out on arrival; nobody else can see the agent inside.
 hiddenIn:HideDef|null=null;private checkers=new Set<Npc>();
 // Opt-in: the map says when E may hide the agent (only when no other E action is offered there). Unset, lockers only take bodies.
 canHide?: ()=>boolean;
 readonly slots=new Map<string,string[]>();readonly discovered=new Map<string,Set<string>>();readonly deadFound=new Set<string>();readonly unconsciousFound=new Set<string>();
 stats={knockouts:0,kills:0,hidden:0,witnesses:0};notices:string[]=[];elapsed=0;private sequence=0;private held=new Set<string>();private witnessed=new Set<string>();private discoverClock=0;
 readonly director:Director;readonly hides:HideDef[];readonly rules:M3Rules;
 constructor(director:Director,hides:HideDef[],rules:M3Rules){this.director=director;this.hides=hides;this.rules=rules;for(const h of hides)this.slots.set(h.id,[]);}
 get locked(){return this.action!==null||!!this.hiddenIn;}
 get progress(){return this.action?this.action.elapsed/this.action.duration:0;}
 cancel(){if(this.action){this.action.npc.busy=false;this.action=null;}}
 canAttack(p:Position,n:Npc){if(!n.active||n.busy||n.state==='alert'||Math.abs(p.y-n.pos.y)>.35||flat(p,n.pos)>this.rules.distance)return false;
  const d=flat(p,n.pos);if(d<.25)return false;const back=((p.x-n.pos.x)*Math.sin(n.heading)+(p.z-n.pos.z)*Math.cos(n.heading))/d;
  return [0,Math.PI/2,-Math.PI/2,Math.PI].some(a=>this.bodyFits(n.pos,n.heading+a))&&back<=-Math.cos(this.rules.backAngle*Math.PI/180)&&segmentClear(this.director.boxes,{...p,y:p.y+1.1},{...n.pos,y:n.pos.y+1.1});}
 // With a weapon in hand the agent can strike from the front too: anyone close, not already alerted or fighting,
 // in front of the agent (within 60 degrees of where they face), with room to fall.
 meleeTarget(p:Position,heading:number,fighting=false){return this.director.npcs.filter(n=>{if(!n.active||n.busy||!fighting&&(n.state==='alert'||n.state==='combat')||Math.abs(p.y-n.pos.y)>.35)return false;const d=flat(p,n.pos);if(d<.25||d>MELEE_REACH)return false;
  const off=Math.abs(Math.atan2(Math.sin(Math.atan2(n.pos.x-p.x,n.pos.z-p.z)-heading),Math.cos(Math.atan2(n.pos.x-p.x,n.pos.z-p.z)-heading)));
  return off<=Math.PI/3&&[0,Math.PI/2,-Math.PI/2,Math.PI].some(a=>this.bodyFits(n.pos,n.heading+a))&&segmentClear(this.director.boxes,{...p,y:p.y+1.1},{...n.pos,y:n.pos.y+1.1});}).sort((a,b)=>flat(a.pos,p)-flat(b.pos,p))[0];}
 fromBehind(p:Position,n:Npc){return (p.x-n.pos.x)*Math.sin(n.heading)+(p.z-n.pos.z)*Math.cos(n.heading)<0;}
 /** Bare hands from the front: anyone unarmed to punch; a guard (even one already fighting) to fight. */
 frontTarget(p:Position,heading:number){const n=this.meleeTarget(p,heading,true);return n&&(n.guard||n.state!=='alert'&&n.state!=='combat')?n:undefined;}
 /** Where the take-down is now, for the agent's arm (hold-pose.ts strikePose): a swing, a stab, a punch. */
 get strike():{kind:'blunt'|'blade'|'punch';t:number}|null{const a=this.action;if(!a)return null;
  // The sword is a whole-body two-handed motion of its own (katana-motion.ts), not an arm swing.
  if(a.item==='katana')return null;if(a.item){const m=meleeOf(a.item)!;return {kind:a.behind?m.kind:m.swing??m.kind,t:this.progress};}if(a.mode==='finish')return {kind:'blunt',t:this.progress};
  return null;}
 /** The fight (brawl) and the single punch as whole-body blows (brawl-motion.ts): blows landed and seconds since the
  * last key press. The punch is the fight's last blow (the right hook), thrown PUNCH_SECONDS-BRAWL_FINISH in. */
 get blows():{blows:number;since:number;single?:boolean}|null{const a=this.action;if(!a)return null;
  if(a.mode==='brawl')return {blows:a.stage!,since:a.elapsed-(a.hitAt??0)};
  if(a.mode==='punch'){const at=PUNCH_SECONDS-BRAWL_FINISH;return a.elapsed<at?{blows:0,since:a.elapsed,single:true}:{blows:3,since:a.elapsed-at,single:true};}return null;}
 target(p:Position){return this.director.npcs.filter(n=>this.canAttack(p,n)).sort((a,b)=>flat(a.pos,p)-flat(b.pos,p))[0];}
 body(p:Position){return this.director.npcs.filter(n=>n.life!=='active'&&n.bodyMode==='ground'&&flat(p,n.pos)<1.3&&Math.abs(p.y-n.pos.y)<.35&&segmentClear(this.director.boxes,{...p,y:p.y+.5},{...n.pos,y:n.pos.y+.2})).sort((a,b)=>flat(a.pos,p)-flat(b.pos,p))[0];}
 container(p:Position){return this.hides.find(h=>Math.abs(p.y-h.y)<.35&&flat(p,{x:h.x+h.approach.x,z:h.z+h.approach.z})<this.rules.hideRadius&&segmentClear(this.director.boxes,{...p,y:p.y+.7},{x:h.x+h.approach.x,y:h.y+.7,z:h.z+h.approach.z}));}
 prompt(p:Position){if(this.hiddenIn)return `E ${this.hiddenIn.label}から出る · 隠れている`;const a=this.action;if(a){if(a.mode==='brawl')return a.stage!>=BRAWL_KEYS.length?'格闘：決まった…':`格闘中：${keyLabel(BRAWL_KEYS[a.stage!])} を押す（${a.stage!+1}/${BRAWL_KEYS.length}）`;if(a.mode==='finish')return 'X とどめを刺している…';if(a.mode==='punch')return 'F 殴っている…';
   return `${a.kind==='ko'?'F 気絶させている'+(a.item?'':' · X で致死に切り替え'):a.kind==='kill'?'X 排除している':'E 隠している'}…`;}
  if(this.dragged){const h=this.container(p);return h?`E ${h.label}に隠す · ${this.slots.get(h.id)!.length}/${h.capacity}${this.slots.get(h.id)!.length>=h.capacity?' 満杯':''}`:'E 身体を置く · 運搬中（走行不可）';}
  const body=this.body(p);if(body)return `E ${body.life==='dead'?'死者':'気絶した人'}を運ぶ${body.life==='unconscious'?' ／ X 長押し とどめ（致死）':''}`;
  const m=meleeOf(this.heldItem?.()),mt=m&&this.meleeTarget(p,this.facing);if(m&&mt)return m.kind==='blunt'?`F ${m.label}で殴って気絶させる · ${mt.label}`:`X ${m.label}で${m.swing&&!this.fromBehind(p,mt)?'斬る':'刺す'}（致死） · ${mt.label}`;
  const n=this.target(p);if(n)return `F 長押し 気絶 ／ X 長押し 排除（致死） · ${n.label}`;
  const f=this.frontTarget(p,this.facing);if(f)return f.guard?`F 格闘する（表示されたキーを順に押す） · ${f.label}`:`F 長押し 殴って気絶させる · ${f.label}`;
  const h=this.container(p);if(!h)return '';const used=this.slots.get(h.id)!.length;return used<h.capacity&&this.canHide?.()?`E ${h.label}に隠れる · ${used}/${h.capacity}`:`${h.label} · ${used}/${h.capacity}${used>=h.capacity?' 満杯':' · 身体を運んでくる'}`;}
 step(dt:number,p:PlayerView,heading:number,keys:Set<string>,suppressNewActions=false){this.elapsed+=dt;this.notices=[];const fresh=(k:string)=>!suppressNewActions&&keys.has(k)&&!this.held.has(k);let usesE=false;
  const moving=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k));
  if(this.action?.mode==='brawl')this.brawlStep(this.action,dt,p,fresh,moving);
  else if(this.action){const a=this.action;
   // M04: X while choking from behind with bare hands: the same hold, now lethal (as far along as the choke was).
   if(a.kind==='ko'&&!a.item&&!a.mode&&fresh('KeyX')){a.elapsed=a.elapsed/a.duration*this.rules.killSeconds;a.duration=this.rules.killSeconds;a.kind='kill';}
   const key=a.kind==='ko'?'KeyF':a.kind==='kill'?'KeyX':'KeyE';usesE=a.kind==='hide';
   if(!keys.has(key)||moving||flat(p,a.start)>.16||Math.abs(p.y-a.start.y)>.2||flat(a.npc.pos,a.targetStart)>.1||a.npc.active&&a.npc.state==='alert'||a.mode==='finish'&&a.npc.life!=='unconscious'||a.kind!=='hide'&&a.mode!=='finish'&&(!a.npc.active||Math.abs(a.npc.heading-a.targetHeading)>.15)){this.cancel();}
   else{a.elapsed+=dt;if(a.elapsed>=a.duration){this.complete(a);this.action=null;}}}
  else if(fresh('KeyE')&&this.hiddenIn){usesE=true;this.leaveHide();this.notices.push('外に出た。');}
  else if(fresh('KeyE')){if(this.dragged){usesE=true;const h=this.container(p);if(h){if(this.slots.get(h.id)!.length>=h.capacity)this.notices.push('ロッカーは満杯です。');else this.begin('hide',this.dragged,p,h);}else if(this.bodyFits(this.dragged.pos,this.dragged.heading)){this.dragged.bodyMode='ground';this.dragged=null;}else this.notices.push('ここには置けません。広い場所へ移動してください。');}
   else{const body=this.body(p);if(body){usesE=true;body.bodyMode='dragged';this.dragged=body;}else{const h=this.container(p);if(h&&this.slots.get(h.id)!.length<h.capacity&&this.canHide?.()){usesE=true;this.enterHide(h,p);}}}}
  else if(!this.dragged&&!moving&&(fresh('KeyF')||fresh('KeyX'))){const item=this.heldItem?.()??'',m=meleeOf(item),strike=m&&(m.kind==='blunt'?fresh('KeyF'):fresh('KeyX'))?this.meleeTarget(p,heading):undefined;
   if(m&&strike)this.begin(m.kind==='blunt'?'ko':'kill',strike,p,undefined,item);else{const n=this.target(p),body=this.body(p),front=fresh('KeyF')?this.frontTarget(p,heading):undefined;
    if(n)this.begin(fresh('KeyX')?'kill':'ko',n,p);
    else if(fresh('KeyX')&&body?.life==='unconscious')this.begin('kill',body,p,undefined,undefined,'finish');
    else if(front)this.begin('ko',front,p,undefined,undefined,front.guard?'brawl':'punch');
    else this.notices.push(m?'相手の近くで、相手の方を向いてください。':'背後から近づくか、正面から相手の方を向いてください。壁際では倒れる空間も必要です。');}}
  if(this.hiddenIn)this.watchHide(p);
  if(this.action&&this.action.kind!=='hide')this.witness(p,`action-${this.action.id}`);
  if(this.dragged)this.witness(p,'drag-'+this.dragged.id);
  for(const n of this.director.npcs)if(n.life!=='active')n.fall=Math.min(1,n.fall+dt/n.fallSeconds);
  this.discoverClock+=dt;if(this.discoverClock>=this.rules.discoverSeconds){this.discoverClock=0;this.discover();}
  this.hotel.step(dt,!this.action&&!this.dragged&&!this.director.npcs.some(n=>n.active&&['alert','report','investigate','search'].includes(n.state)),this.rules.cooldownSeconds);
  this.held=new Set(keys);this.facing=heading;return usesE;}
 private facing=0;
 private begin(kind:Action['kind'],npc:Npc,p:Position,container?:HideDef,item?:string,mode?:Action['mode']){npc.busy=true;npc.speed=0;const behind=(p.x-npc.pos.x)*Math.sin(npc.heading)+(p.z-npc.pos.z)*Math.cos(npc.heading)<0;if(mode==='brawl'||mode==='punch')npc.heading=Math.atan2(p.x-npc.pos.x,p.z-npc.pos.z);this.action={id:++this.sequence,kind,npc,container,item,mode,behind,stage:0,stageAt:0,elapsed:0,
  duration:item?meleeOf(item)!.seconds:mode==='punch'?PUNCH_SECONDS:mode==='finish'?FINISH_SECONDS:mode==='brawl'?BRAWL_KEYS.length*BRAWL_WINDOW:kind==='ko'?this.rules.koSeconds:kind==='kill'?this.rules.killSeconds:this.rules.hideSeconds,start:{...p},targetStart:{...npc.pos},targetHeading:npc.heading};if(kind!=='hide')this.closeCombatNoise(p,npc);}
 // HITMAN "Close Combat Heard" (2026-11-05): a struggle is heard close by (rules closeCombatHear, default 2 m). Someone
 // who does not see it looks: a guard comes to the spot, anyone else turns and walks over. Hearing never names anyone;
 // those who see it are witnesses (witness() below).
 closeCombatNoise(at:Position,victim:Npc){const r=(this.rules as {closeCombatHear?:number}).closeCombatHear??2,rules=this.director.rules;
  for(const n of this.director.npcs){if(n===victim||!n.active||n.busy||n.visibility>0||Math.abs(n.pos.y-at.y)>1.5||flat(n.pos,at)>r)continue;
   if(n.guard)n.radio({...at},rules);else n.hear({...at},rules);this.onReaction?.(n,n.guard?'investigate':'heard','close_combat',at);}}
 private complete(a:Action){const n=a.npc;n.busy=false;
  if(a.kind==='hide'){const h=a.container!;const slots=this.slots.get(h.id)!;if(slots.length>=h.capacity){this.notices.push('収納できませんでした。');return;}slots.push(n.id);n.bodyMode='hidden';n.pos={x:h.x,y:h.y,z:h.z};this.dragged=null;this.stats.hidden++;this.notices.push('身体を隠した。');}
  else if(a.mode==='finish'){n.life='dead';n.deathMethod='finish';this.stats.kills++;this.notices.push('とどめを刺した。');}
  else{this.down(n,a.kind==='ko'?'ko':'kill',a.item);this.notices.push(a.kind==='ko'?'気絶させた。Eで運べます。':'排除した。Eで運べます。');}}
 private enterHide(h:HideDef,p:PlayerView){const at={x:h.x+h.approach.x,y:h.y,z:h.z+h.approach.z};let seen=false;
  for(const n of this.director.npcs){if(!n.active||n.busy)continue;n.perceive({...p,hidden:false},this.director.boxes,this.director.rules);if(!n.visibility)continue;seen=true;
   if(n.guard){n.radio(at,this.director.rules);this.checkers.add(n);this.onReaction?.(n,'investigate','hide_seen',at);}else{n.hear(at,this.director.rules);this.onReaction?.(n,'heard','hide_seen',at);}}
  this.slots.get(h.id)!.push('agent');this.hiddenIn=h;this.notices.push(seen?`${h.label}に隠れた。入るところを見られた！`:`${h.label}に隠れた。Eで出る。`);}
 leaveHide(){const h=this.hiddenIn;if(!h)return;const s=this.slots.get(h.id)!;s.splice(s.indexOf('agent'),1);this.hiddenIn=null;this.checkers.clear();}
 // A guard who saw the agent get in opens the locker on arrival; one who gave up forgets it.
 private watchHide(p:PlayerView){const h=this.hiddenIn!,at={x:h.x+h.approach.x,z:h.z+h.approach.z};
  for(const n of [...this.checkers]){if(!n.active||n.state==='patrol'){this.checkers.delete(n);continue;}
   if(!n.busy&&flat(n.pos,at)<1.6&&Math.abs(n.pos.y-h.y)<1){this.leaveHide();this.director.accuse(n,{...p,hidden:false});this.notices.push(`${n.label}に${h.label}を開けられた！`);return;}}}
 // M02: each blow lands only when the key shown is pressed in time.
 private brawlStep(a:Action,dt:number,p:PlayerView,fresh:(k:string)=>boolean,moving:boolean){a.elapsed+=dt;const need=BRAWL_KEYS[a.stage!],pressed=['KeyF','KeyX'].find(k=>fresh(k));
  if(!a.npc.active){this.cancel();return;}
  // The third blow lands, the guard sags, and only then is he out (the motion plays to the end).
  if(a.stage===BRAWL_KEYS.length){if(a.elapsed-a.hitAt!>=BRAWL_FINISH){this.action=null;this.down(a.npc,'ko');this.notices.push('格闘で気絶させた。Eで運べます。');}return;}
  if(moving||a.elapsed-a.stageAt!>BRAWL_WINDOW||pressed&&pressed!==need){this.action=null;const n=a.npc;n.busy=false;this.director.accuse(n,p);n.sawViolence=true;this.notices.push(`${n.label}に振りほどかれた！ 撃ってくる。`);return;}
  if(!pressed)return;a.stage!++;a.stageAt=a.elapsed;a.hitAt=a.elapsed;}
 /** Puts someone down where they stand (a finished take-down, or a thrown thing that hit them). */
 down(n:Npc,kind:'ko'|'kill',method?:string){const fallHeading=[0,Math.PI/2,-Math.PI/2,Math.PI].map(a=>n.heading+a).find(h=>this.bodyFits(n.pos,h));if(fallHeading!==undefined)n.heading=fallHeading;n.life=kind==='ko'?'unconscious':'dead';if(kind==='kill'&&method)n.deathMethod=method;n.bodyMode='ground';n.busy=false;n.speed=0;n.suspicion=0;n.visibility=0;n.fall=0;n.evidenceGoal=null;n.goal=null;n.state='patrol';n.scheduleTarget=null;n.scheduleAction='';if(kind==='ko')this.stats.knockouts++;else this.stats.kills++;}
 /** A thing thrown at someone (engine/game.ts): they go down, the impact is heard close by and anyone who saw the throw is a witness. */
 thrownHit(n:Npc,p:PlayerView,kind:'ko'|'kill',method:string){this.closeCombatNoise(n.pos,n);this.down(n,kind,method);this.witness(p,'throw-'+(++this.sequence),kind==='kill');}
 witness(p:PlayerView,event:string,violent=this.action?.kind==='kill'){for(const n of this.director.npcs){if(!n.active||n.busy)continue;n.perceive(p,this.director.boxes,this.director.rules);if(!n.visibility)continue;const id=event+':'+n.id;if(this.witnessed.has(id))continue;this.witnessed.add(id);this.stats.witnesses++;this.director.accuse(n,p);if(n.guard&&violent)n.sawViolence=true;
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
    if(n.state!=='alert'&&n.state!=='search'){if(n.guard)n.radio(body.pos,this.director.rules);else{n.state='report';n.timer=this.director.rules.timers.report;this.director.reports++;if(body.life==='dead'&&body.deathKind==='murder')n.witness={what:'body',at:{...body.pos},key:body.id};}
     this.onReaction?.(n,n.guard?'investigate':n.witness?'report':'alert',body.life==='dead'?'body':'unconscious_body',body.pos);}
    // radio() leaves a guard alone who is fighting or already on the way to this body (2026-11-04, AI report P0-A/P1-A).
    // HD09 (2026-11-07, the user's choice): backup comes from any floor of the building — the two nearest free guards
    // (a floor apart counts as BACKUP_FLOOR_M metres), instead of everyone within a flat radio radius.
    if(n.guard)for(const g of this.backup(n,body.pos))g.radio(body.pos,this.director.rules);
   }}}
 /** The guards who answer a body radio call: the nearest free ones, any floor (HD09). */
 backup(caller:Npc,at:Position,count=BODY_BACKUP){const floorGap=(g:Npc)=>Math.abs(Math.round((g.pos.y-at.y)/3));
  return this.director.npcs.filter(g=>g.active&&!g.busy&&g.guard&&g!==caller&&g.state!=='alert'&&g.state!=='search'&&g.state!=='combat')
   .map(g=>({g,d:flat(g.pos,at)+floorGap(g)*BACKUP_FLOOR_M})).sort((a,b)=>a.d-b.d).slice(0,count).map(x=>x.g);}
 bodyFits(p:Position,heading:number){for(const t of [-.6,-.3,0,.3,.6]){const x=p.x+Math.sin(heading)*t,z=p.z+Math.cos(heading)*t,y=this.director.world.surface(x,z,p.y);if(y===null||Math.abs(y-p.y)>.3||this.director.world.blocked(x,y,z,.5))return false;}return true;}
 constrainMove(from:Position,to:Position,heading:number):Position{if(!this.dragged)return to;const n=this.dragged,w=this.director.world;
  // The drag anchor follows the path, not a teleport behind a sharply turned player.
  const dx=to.x-n.pos.x,dz=to.z-n.pos.z,d=Math.hypot(dx,dz),length=1.05;const target=d>length?w.move(n.pos,dx/d*(d-length),dz/d*(d-length),.5):{...n.pos};
  const h=d>.1?Math.atan2(dx,dz):heading;if(!this.bodyFits(target,h)||flat(target,to)>1.55||!segmentClear(this.director.boxes,{...target,y:target.y+.3},{...to,y:to.y+.3}))return from;
  n.pos=target;n.heading=h;return to;}
}


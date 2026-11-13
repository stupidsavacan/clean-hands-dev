import { inside, floorOf, plateY, type CollisionWorld, type Level, type Position } from './world.ts';
import type { NavGrid } from './nav.ts';
import type {DoorSystem,GuardDoorRoute} from './doors.ts';
import { segmentClear, type Aabb } from './sight.ts';
import type {CoinPickup} from './coin-pickup.ts';
import type {TraversalFrame} from './party/traversal.ts';
import {visibleCarry,type CarrySight} from './carry-sight.ts';
import {IncidentLog,type IncidentRef} from './incidents.ts';
import type {CoverSpot} from './cover-spots.ts';
export type Role='guard'|'guest'|'waiter';
// Guard AI stage 1: 'cover' kneels behind low cover, 'peek' has risen over it to shoot. Standing behind a wall end is 'stand'.
export type Posture='stand'|'cover'|'peek';
// move: on the way to the spot. hide: behind it, not shooting. peek: shooting from it (risen, or stepped out past the end).
export type CoverPlan={spot:CoverSpot;phase:'move'|'hide'|'peek';t:number};
// combat: a guard in a gunfight (driven by CombatSystem); flee: a bystander running from gunfire, then cowering.
export type State='patrol'|'curious'|'investigate'|'alert'|'search'|'report'|'distracted'|'verify'|'combat'|'flee';
export type ZoneType='public'|'staff'|'secure'|'outer';
export type Permission='allow'|'caution'|'deny';
export type Zone={id:string;label:string;floor:number;type:string;allowedDisguises?:string[];minX:number;maxX:number;minZ:number;maxZ:number};
// knowsFaces: the one or two outfits whose wearers this person knows by face. post: the zone ids where they normally work.
// outfit: the disguise their clothes give when taken (defaults to the role's).
// F09: faction (who they work for), securityRole, combatProfile (guard/bodyguard/response/civilian: health and gun),
// loadout (the gun carried) and disguiseId are written out per person instead of guessed from the id.
export type NpcDef={id:string;role:string;label:string;floor:number;model?:string;route:number[][];look?:number[];knowsFaces?:string[];post?:string|string[];target?:boolean;outfit?:string;
 faction?:string;securityRole?:string;combatProfile?:string;loadout?:string;disguiseId?:string};
// rooms: indoor rooms shorten sight; outdoors (no indoor room around) uses the longer outdoor ranges.
export type Mission=Level&{zones:Zone[];npcs:NpcDef[];rooms?:(Zone&{indoor:boolean})[];objectives:{panel:{x:number;z:number;radius:number;seconds:number;label:string};exit:{x:number;z:number;radius:number;label:string}}};
type Vision={range:number;half:number;sensitivity:number};
/** Vision (2026-11-13, the user's choice: "the further, the slower they notice"). range: the clear distance, noticed at the
 * full rate (and the distance for bodies, guns on the floor and messes). far: the furthest distance, range x far[role];
 * between the two the gauge fills more slowly, down to farMin at the far end, and only someone already paying attention
 * (curious, alerted, searching, fighting...) sees the agent there outright. combat: how far a guard in a gunfight sees.
 * scale: multipliers over everything, kept for difficulty settings. */
export type VisionNow={range:number;far:number;half:number;sensitivity:number};
export type Rules={disguises:Record<string,Record<string,string>>;rates:{run:number;crouchPublic:number;deny:number;caution:number;tamper:number;unseen:number;weapon?:number};
 multipliers:{crowd:number;crowdCount:number;crowdRadius:number;stillOrCover:number;nearMax:number;nearFull:number;nearNone:number};thresholds:{curious:number;investigate:number;alert:number};
 vision:{guard:Vision;guest:Vision;waiter:Vision;outdoor?:Record<Role,number>;far?:Partial<Record<Role,number>>;farMin?:number;combat?:number;scale?:{range?:number;half?:number;sensitivity?:number};peripheral:{range:number;half:number};touch:number;eye:number};speeds:{walk:number;investigate:number;chase:number;search:number};
 timers:{curiousHold:number;lookAround:number;evidenceLook?:number;lose:number;search:number;report:number;noiseLook:number};noise:{coin:number;coins:number;throw:number;postLeave?:number};catch:number;radio:number;
 lod?:Lod;m4?:{enforcerSpeed?:EnforcerSpeed};arrest?:Arrest;
 // Who recognises a reported outfit on sight: everyone (default) or only guards, as in HITMAN, where a guest who saw
 // the agent tells security and not the cook across the building (club playtest 2026-11-03).
 compromisedBy?:'all'|'guards'};
// F04 / HITMAN "Found Trespassing": a guard walks up to warnDistance and tells the agent to leave. Doing nothing wrong
// for complySeconds ends it; still trespassing after warnSeconds within warnRange turns it into an arrest.
// hostileZones: zone types where guards arrest at once (HITMAN's hostile areas).
// handsUpSeconds (M06, 2026-11-08): a guard who starts an arrest first orders hands up; only after this long can the
// arrest by touch be made, so the agent has a moment to (fake) surrender even when the guard is already beside them.
export type Arrest={warnSeconds:number;warnDistance:number;warnRange:number;complySeconds:number;hostileZones:string[];handsUpSeconds?:number};
export const HANDS_UP_SECONDS=2.5;
const ARREST:Arrest={warnSeconds:3,warnDistance:2,warnRange:4,complySeconds:1,hostileZones:['secure']};
// Seconds to fill the white gauge at a distance: [[metres, seconds], ...], interpolated, nothing beyond range.
export type EnforcerSpeed={range:number;front:number;table:number[][];boost:number;crowdRange:number;decay:number;verify:number;postMargin:number;verifyStop:number};
// Perception tiers by distance from the agent: near every `nearEvery` steps, mid every `midEvery`, far not at all.
export type Lod={near:number;far:number;nearEvery:number;midEvery:number;planMs?:number};
export type Tier='near'|'mid'|'far';
// blending: doing the outfit's job at a BLEND_ spot; suspiciousItem: a suspicious thing the outfit may not carry (M5.6).
// F05 keeps three things apart: weaponDrawn: a gun in hand; illegalVisibleCarry: a long gun on the back this outfit may
// not carry openly (security uniforms may, as in HITMAN); illegal: either of them (illegal weapon handling).
export type PlayerView={x:number;y:number;z:number;floor:number;speed:number;running:boolean;crouched:boolean;tampering:boolean;disguise:string;outfitOwner?:string;carrySight?:CarrySight;surrendering?:boolean;restricted?:boolean;blending?:boolean;illegal?:boolean;suspiciousItem?:boolean;weaponDrawn?:boolean;illegalVisibleCarry?:boolean;
 // Inside a locker (2026-11-06, ROADMAP H33): nobody and no camera sees the agent.
 hidden?:boolean};
// warn: a guard tells a trespasser to leave; arrest: a guard moves to detain (only then can the agent be caught).
export type AiEvent={type:'curious'|'investigate'|'alert'|'search'|'calm'|'report'|'heard'|'caught'|'verify'|'compromised'|'warn'|'arrest';npc:Npc;stimuli?:string[];pursuitReason?:'lost_contact'|'search_expired'};
// F04 / HITMAN: why a guard turned on the agent. trespass and suspicious get a warning first; the rest are an arrest.
export type Cause=''|'trespass'|'suspicious'|'identity'|'crime'|'hostile';
// F06: what one person knows about one event. A sound gives an estimated origin; only sight gives lastSeenPosition.
export type Knowledge={eventType:'gunshot'|'impact'|'noise'|'wounded'|'sighting'|'body'|'report';estimatedOrigin?:Position;lastSeenPosition?:Position;confirmedActor?:boolean;identifiedDisguise?:string;confidence:number;observedAt:number;sourceNpcId?:string;incidentId?:number};
// What the director tells each person about the agent this step, besides the suspicion rate.
export type Situation={base:number;trespass:boolean;hostile:boolean;crime:boolean;time:number};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v)),wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a)),flat=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);
export function enforcerSeconds(f:EnforcerSpeed,d:number){const t=f.table;if(d<=t[0][0])return t[0][1];for(let i=1;i<t.length;i++)if(d<=t[i][0]){const k=(d-t[i-1][0])/(t[i][0]-t[i-1][0]);return t[i-1][1]+(t[i][1]-t[i-1][1])*k;}return Infinity;}
export function zoneAt(zones:Zone[],x:number,z:number,floor:number){return zones.find(r=>r.floor===floor&&inside(r,x,z));}
export function permission(rules:Rules,disguise:string,zone?:Zone):Permission{return (zone?.allowedDisguises?.includes(disguise)?'allow':zone?rules.disguises[disguise]?.[zone.type]:'allow') as Permission||(zone?'deny':'allow');}
// What the agent is doing that would look wrong to a watcher (per second, before distance and cover).
export function baseRate(rules:Rules,p:PlayerView,perm:Permission,zone?:string,stimuli?:string[]){
 const r=rules.rates;let v=0;
 if(p.weaponDrawn||p.illegalVisibleCarry){v=r.weapon??r.deny*3;stimuli?.push(p.weaponDrawn?'gun_drawn':'visible_weapon');}
 if(p.blending)return v;
 if(p.suspiciousItem){v+=r.caution;stimuli?.push('suspicious_item');}
 if(p.running){v+=r.run;stimuli?.push('running');}
 if(p.crouched&&(zone??'public')==='public'){v+=r.crouchPublic;stimuli?.push('crouching');}
 if(perm==='deny'){v+=r.deny;stimuli?.push('trespass');}
 else if(perm==='caution'){v+=r.caution;stimuli?.push('caution_zone');}
 if(p.tampering){v+=r.tamper;stimuli?.push('tamper');}
 return v;
}
export function nearMultiplier(rules:Rules,d:number){const m=rules.multipliers;return 1+(m.nearMax-1)*clamp((m.nearNone-d)/(m.nearNone-m.nearFull),0,1);}
export function suspicionRate(rules:Rules,base:number,o:{distance:number;visibility:number;still:boolean;crowd:number;sensitivity:number}){
 if(o.visibility<=0)return rules.rates.unseen;
 // Seen behaving normally: interest fades, but slower than when out of view.
 if(base<=0)return rules.rates.unseen*.5;
 const m=rules.multipliers;let r=base*nearMultiplier(rules,o.distance)*o.sensitivity;if(o.visibility<1||o.still)r*=m.stillOrCover;if(o.crowd>=m.crowdCount)r*=m.crowd;return r;}

export class Npc{
 fallOrigin:Position|null=null;fallSeconds=.6;
 deathKind:'accident'|'murder'|'combat'='murder';deathMethod='direct';scriptedGoal:Position|null=null;scriptedAction='';scriptedHeading:number|null=null;scriptedImmune=false;
 // M5.5 gunfights: health, the gun carried (guards), where to stand, and timers CombatSystem keeps.
 hp=100;weapon='';kind:'guard'|'bodyguard'|'response'|'civilian'='civilian';reinforcement=false;combatGoal:Position|null=null;reactT=0;fireT=0;coverT=0;shotAt=-Infinity;
 // Guard AI stage 1 (2026-11-13): how the body stands in a fight (kneeling behind low cover, risen to shoot over it), when
 // that last changed and from what (NpcView animates the change), and the cover plan CombatSystem keeps.
 flashThrowAt=-Infinity;flashThrowCover=false;posture:Posture='stand';posturePrev:Posture='stand';postureAt=-Infinity;tactic:CoverPlan|null=null;
 // M5.6: a bystander who saw a crime or a body and is running to tell a guard (what, where, and a key so it counts once).
 witnessCooldown=0;
 // suspect: they only saw someone behaving oddly (a guard comes to look; the outfit is not blown); disguise: the outfit
 // they can name, told to the guard on arrival (F08: a report travels only as fast as the witness).
 witness:{what:'act'|'body'|'suspect'|'unconscious';at:Position;key:string;disguise?:string;incident?:IncidentRef}|null=null;
 // F04: why this guard is after the agent, whether they are detaining (not just warning), and the warning clocks.
 cause:Cause='';arrest=false;warnT=0;complyT=0;now=0;
 /** Seconds this guard has been detaining (M06 hands-up order). */ detainT=0;
 // F06: the last few things this person learned (not a log).
 readonly knowledge:Knowledge[]=[];
 readonly faction:string;readonly securityRole:string;readonly combatProfile?:string;readonly loadout?:string;readonly disguiseId?:string;
 scheduled=false;scheduledAway=false;scheduleTarget:Position|null=null;scheduleHeading:number|null=null;scheduleAction='';scheduleSpeed=0;talking=false;actionTime=0;
 readonly id:string;readonly role:Role;readonly label:string;readonly route:number[][];readonly look?:number[];
 readonly knowsFaces:string[];readonly post:string[];readonly target:boolean;readonly outfit?:string;outdoor=false;readonly homeY:number;
 // F07: outfits this person identified the agent in, or was told about by radio — theirs alone.
 readonly knownDisguises=new Set<string>();
 // Outfits reported as blown (the Director's compromised set, shared by everyone): only reports reach it.
 readonly shared:Set<string>;
 // Whether this person learns of reported outfits (Rules.compromisedBy); set by the Director.
 hearsReports=true;
 life:'active'|'unconscious'|'dead'='active';bodyMode:'ground'|'dragged'|'hidden'='ground';busy=false;fall=0;evidenceGoal:Position|null=null;
 pos:Position;heading:number;state:State='patrol';suspicion=0;visibility=0;distance=Infinity;off=180;lastSeen:Position|null=null;goal:Position|null=null;
 coinPickup:CoinPickup|null=null;
 // On a ladder (or other traversal): the same generic motion as the player (ladder-motion.ts), drawn by NpcView.
 traversal:TraversalFrame|null=null;
 speed=0;arrived=false;timer=0;scanBase=0;scanT=0;loseT=0;routeIndex=0;wait=0;face=0;tier:Tier='near';
 private routeStatus:'idle'|'waiting'|'no-route'|'moving'|'blocked'='idle';
 get navigationStatus(){return this.busy?'busy':this.routeStatus;}
 navigationDebug(){return {status:this.navigationStatus,destination:this.pathGoal&&{...this.pathGoal},path:this.path.map(p=>({...p}))};}
 private path:Position[]=[];private pathGoal:Position|null=null;private lastPos:Position|null=null;private repath=0;private stuck=0;private noticed=false;
 constructor(def:NpcDef,level:Level,shared=new Set<string>()){this.id=def.id;this.role=def.role as Role;this.label=def.label;this.route=def.route.map(r=>[...r]);this.look=def.look&&[...def.look];this.knowsFaces=[...def.knowsFaces??[]];this.post=def.post===undefined?[]:[def.post].flat();this.target=!!def.target;this.outfit=def.outfit;this.shared=shared;const r=def.route[0];this.homeY=plateY(level,def.floor);this.pos={x:r[0],y:this.homeY,z:r[1]};
  this.faction=def.faction??'';this.securityRole=def.securityRole??'';this.combatProfile=def.combatProfile;this.loadout=def.loadout;this.disguiseId=def.disguiseId??def.outfit;
  const next=def.route[1]??def.look;this.heading=next?Math.atan2(next[0]-r[0],next[1]-r[1]):0;}
 knowsFace(disguise:string,outfitOwner?:string){return this.id===outfitOwner||this.knowsFaces.includes(disguise);}
 // F07: three different questions instead of one recognizes().
 /** Can see through this outfit with the white gauge (the face-knowers), whatever their rank. */
 isEnforcerFor(disguise:string){return this.knowsFace(disguise);}
 /** The outfit has been reported as blown. */
 isDisguiseCompromised(disguise:string){return this.shared.has(disguise);}
 /** This person knows the agent in this outfit is the intruder: seen themselves, told by radio, or reported. */
 hasConfirmedIdentity(p:{disguise:string}){return this.knownDisguises.has(p.disguise)||this.hearsReports&&this.shared.has(p.disguise);}
 learn(k:Knowledge){
  const last=this.knowledge.at(-1),at=k.estimatedOrigin,previous=last?.estimatedOrigin;
  if(k.eventType==='noise'&&last?.eventType==='noise'&&at&&previous&&at.x===previous.x&&at.y===previous.y&&at.z===previous.z){
   last.observedAt=k.observedAt;
   return;
  }
  this.knowledge.push(k);if(this.knowledge.length>8)this.knowledge.shift();
 }
 /** From a warning to detaining: they now know the agent in this outfit. */
 detain(p:PlayerView){if(!this.arrest)this.detainT=0;this.arrest=true;this.knownDisguises.add(p.disguise);this.learn({eventType:'sighting',lastSeenPosition:{x:p.x,y:p.y,z:p.z},confirmedActor:true,identifiedDisguise:p.disguise,confidence:1,observedAt:this.now});}
 // Away from their usual post a face-knower is just passing through and does not look closely.
 atPost(zones:Zone[],margin:number){if(!this.post.length)return true;return this.post.some(id=>{const z=zones.find(z=>z.id===id);return !!z&&floorOf(this.pos.y)===z.floor&&inside(z,this.pos.x,this.pos.z,-margin);});}
 // Witnesses, the alerted and anyone checking a face keep full-rate perception wherever they are.
 get priority(){return this.target||this.face>0||['alert','search','report','verify','investigate','combat','flee'].includes(this.state);}
 get active(){return this.life==='active'&&!this.scheduledAway;}
 get guard(){return this.role==='guard';}
 visionScale=1;
 vision(rules:Rules):VisionNow{const r=rules.vision,v=r[this.role],k=r.scale??{},range=(this.outdoor?r.outdoor?.[this.role]??v.range:v.range)*(k.range??1)*this.visionScale;
  return {range,far:range*Math.max(1,r.far?.[this.role]??1),half:v.half*(k.half??1),sensitivity:v.sensitivity*(k.sensitivity??1)*this.visionScale};}
 /** Beyond the clear distance the gauge fills more slowly: x1 at range, down to farMin at far. */
 farFactor(rules:Rules,d:number){const v=this.vision(rules);if(d<=v.range||v.far<=v.range)return 1;const min=rules.vision.farMin??1;return 1+(min-1)*clamp((d-v.range)/(v.far-v.range),0,1);}
 /** Paying attention to something already: beyond the clear distance they see the agent outright, not only slowly. */
 get attentive(){return !['patrol','distracted'].includes(this.state);}
 // What was glimpsed beyond the clear distance by someone not paying attention: it only fills the gauge (slowly).
 farSight=0;
 // Eye-to-body rays inside the view cone. The club recorder can inspect this same decision without updating memory.
 crowdOcclusion?: (eye:Position,body:Position)=>string|undefined;
 perceive(p:PlayerView,boxes:Aabb[],rules:Rules,inspect?:{reason:string;visibility:number;distance:number;blockedBy:string[]}){const v=this.vision(rules),pv=rules.vision.peripheral,dx=p.x-this.pos.x,dz=p.z-this.pos.z,d=Math.hypot(dx,dz);
  const off=Math.abs(wrap(Math.atan2(dx,dz)-this.heading))*180/Math.PI,dy=Math.abs(p.y-this.pos.y);
  if(inspect)inspect.distance=d;else{this.distance=d;this.off=off;}
  const peripheralRange=pv.range*this.visionScale,far=this.state==='combat'?Math.max(v.far,rules.vision.combat??0):v.far;
  const inCone=!p.hidden&&dy<2.6&&(d<=far&&off<=v.half||d<=peripheralRange&&off<=pv.half||d<=rules.vision.touch);
  if(!inCone){if(inspect)inspect.reason=dy>=2.6?'height':d>Math.max(far,peripheralRange,rules.vision.touch)?'distance':'outside_cone';else this.visibility=this.farSight=0;return;}
  const glimpse=d>v.range&&!this.attentive;
  const eye={x:this.pos.x,y:this.pos.y+rules.vision.eye,z:this.pos.z};let n=0;
  for(const h of p.crouched?[1.05,.78,.5]:[1.55,1.15,.82]){
   const body={x:p.x,y:p.y+h,z:p.z};if(!segmentClear(boxes,eye,body))continue;
   const crowd=this.crowdOcclusion?.(eye,body);
   if(!crowd)n++;else if(inspect&&!inspect.blockedBy.includes(crowd))inspect.blockedBy.push(crowd);
  }
  if(inspect){inspect.visibility=glimpse?0:n/3;inspect.reason=n?glimpse?'far':'sight':inspect.blockedBy.length?'crowd':'solid';return;}
  this.visibility=glimpse?0:n/3;this.farSight=glimpse?n/3:0;if(n&&!glimpse&&(!['alert','search'].includes(this.state)||this.hasConfirmedIdentity(p)||this.state==='alert'&&!this.arrest))this.lastSeen={x:p.x,y:p.y,z:p.z};}
 think(dt:number,p:PlayerView,base:number,crowd:number,rules:Rules,s?:Situation):AiEvent['type'][]{const out:AiEvent['type'][]=[],t=rules.thresholds,a=rules.arrest??ARREST,known=this.hasConfirmedIdentity(p),warning=this.state==='alert'&&!this.arrest;
  if(s)this.now=s.time;const seen=this.visibility>0&&(!['alert','search'].includes(this.state)||known||base>=rules.rates.deny||warning);
  const go=(s:State,goal:Position|null,timer:number)=>{this.state=s;this.goal=goal&&{...goal};this.arrived=false;this.timer=timer;};
  const calm=()=>{this.state='patrol';this.cause='';this.arrest=false;this.warnT=this.complyT=0;out.push('calm');};
  if(this.state==='combat'||this.state==='flee'||!this.guard&&this.witnessCooldown>0)return out;
  if(this.evidenceGoal&&base<=0&&this.state==='investigate'){this.goal={...this.evidenceGoal};if(this.arrived&&(this.timer-=dt)<=0){this.evidenceGoal=null;this.state='patrol';this.suspicion=0;out.push('calm');}return out;}
  if(this.state==='alert'||this.state==='search'){
   // A warning: doing nothing wrong in view for a moment (having left) ends it; staying on after it is an arrest.
   if(warning&&this.visibility>0){if(base<=0){if((this.complyT+=dt)>=a.complySeconds){this.suspicion=t.curious-1;calm();}return out;}
    // A crime in front of them ends the warning at once.
    this.complyT=0;if(s?.crime||this.distance<=a.warnRange&&(this.warnT+=dt)>=a.warnSeconds){this.cause=s?.crime?'crime':s?.hostile?'hostile':this.cause;this.detain(p);out.push('arrest');}}
   if(seen){this.suspicion=100;this.loseT=0;if(this.state==='search'){this.state='alert';out.push(this.arrest?'alert':'warn');}}
   else if(this.state==='alert'){this.loseT+=dt;if(this.loseT>rules.timers.lose){go('search',this.lastSeen,rules.timers.search);out.push('search');}}
   else if(this.arrived&&(this.timer-=dt)<=0){this.suspicion=t.investigate-1;calm();}
   return out;}
  if(this.state==='report'){if(this.witness)return out;if((this.timer-=dt)<=0){this.suspicion=t.investigate-1;this.state='patrol';}return out;}
  this.suspicion=clamp(this.suspicion+suspicionRate(rules,base,{distance:this.distance,visibility:this.visibility||this.farSight,still:p.speed<.15,crowd,sensitivity:this.vision(rules).sensitivity*this.farFactor(rules,this.distance)})*dt,0,100);
  // An outfit this person knows to be the intruder's is recognised on sight.
  if(this.visibility>0&&known)this.suspicion=100;
  if(this.suspicion>=t.alert){
   // F04 / HITMAN: trespassing or acting oddly gets "leave" first; a known face, a crime or a hostile area does not.
   const cause:Cause=known?'identity':s?.crime?'crime':s?.trespass?(s.hostile?'hostile':'trespass'):'suspicious',warn=cause==='trespass'||cause==='suspicious';this.cause=cause;
   if(this.guard){go('alert',this.lastSeen,0);this.loseT=0;this.warnT=this.complyT=0;this.arrest=false;if(warn)out.push('warn');else{this.detain(p);out.push('alert');}}
   else{if(!warn)this.knownDisguises.add(p.disguise);go('report',null,rules.timers.report);out.push('report');}return out;}
  if(this.state==='verify')return out;
  if(this.state==='distracted'){if(this.suspicion>=t.investigate&&this.guard){go('investigate',this.lastSeen,rules.timers.lookAround);out.push('investigate');}else if(this.arrived&&(this.timer-=dt)<=0){this.state='patrol';out.push('calm');}return out;}
  if(this.state==='investigate'){
   if(seen&&this.suspicion>=t.investigate&&this.lastSeen){this.goal={...this.lastSeen};this.arrived=false;this.timer=rules.timers.lookAround;}
   if(this.suspicion<t.curious&&!seen){this.state='patrol';this.evidenceGoal=null;out.push('calm');}
   else if(this.arrived&&(this.timer-=dt)<=0){if(this.suspicion>=t.curious){this.state='curious';this.timer=rules.timers.curiousHold;}else{this.state='patrol';out.push('calm');}}
   return out;}
  if(this.guard&&this.suspicion>=t.investigate&&this.lastSeen){go('investigate',this.lastSeen,rules.timers.lookAround);out.push('investigate');}
  else if(this.suspicion>=t.curious){if(this.state!=='curious'){this.state='curious';this.timer=rules.timers.curiousHold;if(!this.noticed)out.push('curious');this.noticed=true;}else this.timer-=dt;}
  else if(this.state==='curious'){if((this.timer-=dt)<=0){this.state='patrol';this.noticed=false;out.push('calm');}}
  else if(this.suspicion<=0)this.noticed=false;
  return out;}
 // The white gauge of a face-knower: separate from suspicion, it fills only up close, in front and at their post.
 watchFace(dt:number,p:PlayerView,crowd:number,rules:Rules,zones:Zone[]):AiEvent['type'][]{const f=rules.m4?.enforcerSpeed,out:AiEvent['type'][]=[];if(!f)return out;
  const relevant=!this.scriptedImmune&&this.knowsFace(p.disguise,p.outfitOwner)&&!this.hasConfirmedIdentity(p)&&['patrol','curious','distracted','verify'].includes(this.state);
  const d=this.distance,front=relevant&&this.visibility>0&&d<=f.range&&this.off<=f.front&&(this.state==='verify'||this.id===p.outfitOwner||this.atPost(zones,f.postMargin));
  // In a crowd the face is lost unless they are right next to the agent.
  const hidden=(crowd>=rules.multipliers.crowdCount||!!p.blending)&&d>f.crowdRange;
  if(front&&!hidden)this.face=Math.min(1,this.face+dt/enforcerSeconds(f,d)*(p.running||p.illegal?f.boost:1));else this.face=Math.max(0,this.face-f.decay*dt);
  if(!relevant){if(this.state==='verify'){this.state='patrol';out.push('calm');}return out;}
  if(this.face>=1){this.face=0;out.push('compromised');return out;}
  if(this.state!=='verify'&&this.face>=f.verify){this.state='verify';this.arrived=false;this.goal=this.lastSeen&&{...this.lastSeen};out.push('verify');}
  else if(this.state==='verify'&&this.face<=0){this.state='patrol';out.push('calm');}
  return out;}
 // A sound (thrown coin) pulls one idle NPC over to look. One who holds a post (a checkpoint guard, HITMAN) only turns
 // toward it and stays put; leavePost sends them anyway (a gun lying in reach is collected).
 holdsPost=false;
 // Where that post is (set with holdsPost). Guards whose posts are within 6 m are partners (a two-man checkpoint).
 postAt:Position|null=null;
 // The one at a checkpoint who does the frisks: stays while the agent is near, partner or not (the line must not open).
 frisks=false;
 // 2026-11-04 (HITMAN report G-03): a guard who saw the agent kill someone fights (combat.ts) instead of only chasing.
 sawViolence=false;
 hear(point:Position,rules:Rules,leavePost=false,mayLeave=false){if(this.state!=='patrol'&&this.state!=='curious'&&this.state!=='distracted')return false;
  if(mayLeave)leavePost=true;
  if(this.holdsPost&&!leavePost){this.state='distracted';this.goal=null;this.arrived=true;this.timer=rules.timers.noiseLook;this.heading=Math.atan2(point.x-this.pos.x,point.z-this.pos.z);return true;}
 this.state='distracted';this.goal={...point};this.arrived=false;this.timer=rules.timers.noiseLook;return true;}
 // A colleague's radio call or a guest's report sends a guard to look at the spot.
 // 2026-11-04 (AI report P0-A, AI lab): a guard in a fight keeps fighting (the call is only remembered); the guard
 // walks all the way to the spot and looks round before giving up (the call used to fade in about 5 s, so anything
 // farther than ~7 m was never reached); a second call about the same spot does not restart the errand.
 radio(point:Position,rules:Rules,k?:Knowledge){if(k)this.learn(k);if(!this.guard||this.state==='alert'||this.state==='search'||this.state==='combat')return;
  if(this.state==='investigate'&&this.evidenceGoal&&flat(this.evidenceGoal,point)<1.5&&Math.abs(this.evidenceGoal.y-point.y)<1)return;
  this.suspicion=Math.max(this.suspicion,75);this.state='investigate';this.goal={...point};this.evidenceGoal={...point};this.arrived=false;
  // Looking round a reported spot takes longer than a glance (P1-C): rules.timers.evidenceLook, default 6 s.
  this.timer=rules.timers.evidenceLook??Math.max(rules.timers.lookAround,6);}
 move(dt:number,world:CollisionWorld,nav:NavGrid,rules:Rules,p:PlayerView,doors?:DoorSystem){const sp=rules.speeds;let want:Position|null=null,speed=sp.walk,face:number|null=null;
  const toward=(q:{x:number;z:number})=>Math.atan2(q.x-this.pos.x,q.z-this.pos.z);
  const reached=(q:Position,range:number)=>flat(this.pos,q)<range&&Math.abs(this.pos.y-q.y)<.45;
  switch(this.state){
   case 'patrol':{if(this.scheduled){want=this.scheduleTarget;face=this.scheduleHeading;speed=this.scheduleSpeed;break;}// The route is on the person's own floor: after a chase upstairs they walk back down to it (they used to aim at
    // the route's x,z at the height they stood, found no path and stood there for good).
    const r=this.route[this.routeIndex],at={x:r[0],y:this.homeY,z:r[1]};
    if(this.route.length===1){if(!reached(at,.3))want=at;else face=this.look?toward({x:this.look[0],z:this.look[1]}):null;break;}
    if(this.wait>0){this.wait-=dt;if(r[3]!==undefined)face=r[3]*Math.PI/180;if(this.wait<=0)this.routeIndex=(this.routeIndex+1)%this.route.length;break;}
    if(reached(at,.3)){this.wait=r[2]||.01;break;}want=at;break;}
   case 'curious':if(this.lastSeen)face=toward(this.lastSeen);break;
   // A witness runs to the nearest guard (goal kept current by the detection system); others just stare.
   case 'report':if(this.witness&&this.goal){want=this.goal;speed=sp.chase;}else if(this.lastSeen)face=toward(this.lastSeen);break;
   // "I don't know your face": walk up to the agent and stop at arm's length.
   case 'verify':speed=sp.investigate;if(this.lastSeen){if(flat(this.pos,this.lastSeen)>(rules.m4?.enforcerSpeed?.verifyStop??1.4))want=this.lastSeen;else face=toward(this.lastSeen);}break;
   // Detaining: run at the agent. Warning: walk up to speaking distance and face them.
   case 'alert':{const at=this.visibility>0?{x:p.x,y:p.y,z:p.z}:this.lastSeen;speed=sp.chase;if(!this.arrest&&at&&this.visibility>0){speed=sp.investigate;if(!reached(at,(rules.arrest??ARREST).warnDistance))want=at;else face=toward(at);}else want=at;break;}
   // In a gunfight: run to the chosen spot (cover, or closer), and keep facing the agent.
   case 'combat':speed=sp.chase;if(this.combatGoal&&!reached(this.combatGoal,.4))want=this.combatGoal;else if(this.lastSeen)face=toward(this.lastSeen);break;
   case 'flee':speed=sp.chase*1.1;if(this.goal&&!this.arrived){want=this.goal;if(reached(this.goal,.6))this.arrived=true;}break;
   default:speed=this.state==='search'?sp.search:sp.investigate;if(this.goal&&!this.arrived){want=this.goal;if(reached(this.goal,.6)){this.arrived=true;this.scanBase=this.heading;this.scanT=0;}}
  }
  // After arriving, sweep the head side to side to look around.
  if(this.arrived&&this.state!=='patrol'&&this.state!=='alert'&&this.state!=='flee'&&this.state!=='combat'&&!want){this.scanT+=dt;face=this.scanBase+Math.sin(this.scanT*1.7)*1.1+(this.state==='search'||this.evidenceGoal?Math.floor(this.scanT/1.6)*Math.PI/2:0);}
  // AI report P1-C (2026-11-05): at a body or a search spot the look-round also turns a quarter every 1.6 s, so it covers
  // all sides instead of the same ±63° (a coin is still only glanced at).
  if(this.state==='alert'&&want&&reached(want,.5))want=null;
  // Progress is judged on where the body actually got since the last step, after the crowd pushed it: two people
  // heading for the same waypoint push each other back every frame, each stepping forward, and otherwise never stop.
  const net=this.lastPos?Math.hypot(this.pos.x-this.lastPos.x,this.pos.z-this.lastPos.z):Infinity;this.lastPos={...this.pos};
  if(want){const moved=Math.min(this.travel(dt,world,nav,want,speed,this.guard?doors:undefined),net);if(moved<.002*dt*60){this.stuck+=dt;if(this.stuck>1.2){this.path=[];this.pathGoal=null;this.stuck=0;if(this.routeStatus==='moving')this.routeStatus='blocked';if(this.state==='patrol')this.wait=.5;else this.arrived=true;}}else this.stuck=0;}
  else{this.routeStatus='idle';this.speed=Math.max(0,this.speed-6*dt);this.path=[];this.pathGoal=null;}
  if(face!==null)this.turn(face,dt,4);}
 private turn(target:number,dt:number,rate:number){const d=wrap(target-this.heading);this.heading=wrap(this.heading+clamp(d,-rate*dt,rate*dt));}
 private routeRevision=0;
 private doorRoute:GuardDoorRoute|null=null;
 private travel(dt:number,world:CollisionWorld,nav:NavGrid,target:Position,speed:number,doors?:DoorSystem){this.repath-=dt;
  if(this.routeRevision!==world.revision){this.routeRevision=world.revision;this.pathGoal=null;this.path=[];}
  if(!this.pathGoal||flat(this.pathGoal,target)>.6||Math.abs(this.pathGoal.y-target.y)>.3||(this.state==='alert'&&this.repath<=0)){const found=nav.findSoon(this.pos,target);if(found===undefined){this.routeStatus='waiting';this.stuck=0;return 1;}this.doorRoute=found?null:doors?.guardRoute(nav,this.pos,target)??null;this.path=found??this.doorRoute?.path??[];this.routeStatus=this.path.length?'moving':'no-route';this.pathGoal={...target};this.repath=.4;}
  const doorRoute=this.doorRoute;
  if(doorRoute&&doors&&flat(this.pos,doorRoute.approach)<.2&&doors.openForGuard(doorRoute.door,this.pos))return 1;
  while(this.path.length>1&&Math.hypot(this.pos.x-this.path[0].x,this.pos.y-this.path[0].y,this.pos.z-this.path[0].z)<.1&&nav.clear(this.pos,this.path[1]))this.path.shift();const next=this.path[0];if(!next)return 0;
  const dx=next.x-this.pos.x,dz=next.z-this.pos.z,d=Math.hypot(dx,dz),left=Math.hypot(this.pos.x-target.x,this.pos.y-target.y,this.pos.z-target.z);
  // Ease into a stop so the gait settles instead of snapping.
  const want=Math.min(speed,left*2.2+.25);this.speed+=clamp(want-this.speed,-6*dt,(this.state==='alert'?9:4)*dt);if(d<1e-4)return 0;
  const step=Math.min(this.speed*dt,d),q=world.move(this.pos,dx/d*step,dz/d*step),moved=flat(q,this.pos);this.pos=q;this.turn(Math.atan2(dx,dz),dt,this.state==='alert'?9:5);return moved;}
}

export class Director{
 readonly incidents=new IncidentLog();
 doors?:DoorSystem;
 soundClear?:(at:Position,listener:Position)=>boolean;
 readonly npcs:Npc[];frame=0;time=0;caught=false;alerts=0;reports=0;
 // Someone recognised the agent as an intruder (alerted on them, ran to report them, or saw them do something).
 onSpotted?:(n:Npc)=>void;
 captureStimuli=false;
 // Outfits that are blown for everyone: reported by radio or by a witness who reached a guard, or seen in a fight.
 readonly compromised=new Set<string>();
 // F08: alert per zone (1 a shot heard there, 2 a report or an arrest there), apart from each person's knowledge and
 // from the hotel-wide level (m3 HotelAlert).
 readonly zoneAlert=new Map<string,number>();
 readonly mission:Mission;readonly world:CollisionWorld;readonly nav:NavGrid;readonly boxes:Aabb[];readonly rules:Rules;
 constructor(mission:Mission,world:CollisionWorld,nav:NavGrid,boxes:Aabb[],rules:Rules){this.mission=mission;this.world=world;this.nav=nav;this.boxes=boxes;this.rules=rules;this.npcs=mission.npcs.map(d=>new Npc(d,mission,this.compromised));for(const n of this.npcs)this.setHearsReports(n);}
 private setHearsReports(n:Npc){n.hearsReports=this.rules.compromisedBy!=='guards'||n.guard;}
 // People on another floor are no crowd to blend into (2026-11-03: a guest on 2F above five kitchen staff counted as
 // in a crowd, and a party route passed only through that).
 crowdAt(x:number,z:number,y?:number){return this.npcs.filter(n=>n.active&&!n.guard&&(y===undefined||Math.abs(n.pos.y-y)<1.5)&&Math.hypot(n.pos.x-x,n.pos.z-z)<=this.rules.multipliers.crowdRadius).length;}
 zone(p:PlayerView){return zoneAt(this.mission.zones,p.x,p.z,p.floor);}
 step(dt:number,p:PlayerView){
  if(this.doors?.hasPendingClosure)this.doors.step(dt,[p,...this.npcs.filter(n=>n.active).map(n=>n.pos)]);
  this.nav.frame(this.lod.planMs??4);const events:AiEvent[]=[],zone=this.zone(p),perm=permission(this.rules,p.disguise,zone),stimuli=this.captureStimuli?[] as string[]:undefined,base=baseRate(this.rules,p,p.restricted?'deny':perm,zone?.type,stimuli),crowd=this.crowdAt(p.x,p.z,p.y);this.frame++;this.time+=dt;
  const trespass=!!p.restricted||perm==='deny',s:Situation={base,trespass,hostile:trespass&&!!zone&&(this.rules.arrest??ARREST).hostileZones.includes(zone.type),crime:!!(p.tampering||p.weaponDrawn||p.illegalVisibleCarry),time:this.time};
  // Perception is tiered by distance and staggered so the NPCs do not all cast rays on the same step.
  this.npcs.forEach((n,i)=>{n.witnessCooldown=Math.max(0,n.witnessCooldown-dt);if(!n.active||n.busy)return;n.tier=this.tier(n,p);n.outdoor=this.outdoorAt(n.pos);const every=n.tier==='mid'?this.lod.midEvery:this.lod.nearEvery;
   if(n.tier==='far'){n.visibility=0;n.distance=flat(n.pos,p);}else if((this.frame+i)%every===0)n.perceive(p,this.boxes,this.rules);});
  for(const n of this.npcs)if(n.active&&!n.busy&&(n.knowsFaces.length||n.id===p.outfitOwner||n.state==='verify'))for(const type of n.watchFace(dt,visibleCarry(n,p,this.boxes,this.rules),crowd,this.rules,this.mission.zones)){if(type==='compromised')this.accuse(n,p,'identity');events.push(stimuli?{type,npc:n,stimuli:['known_face']}:{type,npc:n});}
  for(const n of this.npcs)if(n.active&&!n.busy){
   const seen=visibleCarry(n,p,this.boxes,this.rules),localStimuli=seen===p?stimuli:stimuli?[]:undefined;
   const rate=seen===p?base:baseRate(this.rules,seen,p.restricted?'deny':perm,zone?.type,localStimuli);
   const situation=seen===p?s:{...s,base:rate,crime:!!(seen.tampering||seen.weaponDrawn||seen.illegalVisibleCarry)};
   const before=n.state;
   for(const type of n.think(dt,seen,rate,crowd,this.rules,situation)){
    const event:AiEvent={type,npc:n};
    if(type==='search')event.pursuitReason='lost_contact';
    if(type==='calm'&&before==='search')event.pursuitReason='search_expired';
    if(localStimuli)event.stimuli=n.cause==='identity'?['confirmed_identity']:localStimuli;
    events.push(event);
   }
  }
  for(const e of events){const at=e.npc.lastSeen;if(!at)continue;
   // A guard who identified the agent radios it in: the outfit is blown and colleagues in radio range come.
   if(e.type==='alert'&&e.npc.arrest||e.type==='arrest')this.radioIn(e.npc,p,at);
   // A bystander runs to tell a guard (a gun seen is combat.ts's witness). Nothing is known elsewhere until they arrive.
   // Only a crime seen raises the hotel alert on arrival ('act'); a known intruder seen again is named to the guard
   // but is not a new incident (four guests seeing a blown outfit are not alert 3).
   if(e.type==='report'&&!e.npc.witness){
    const seen=visibleCarry(e.npc,p,this.boxes,this.rules);if(seen.weaponDrawn||seen.illegalVisibleCarry)continue;
    const c=e.npc.cause,named=c!=='trespass'&&c!=='suspicious',crime=c==='crime';this.reports++;if(named)this.onSpotted?.(e.npc);
    e.npc.witness={what:crime?'act':'suspect',at:{...at},key:(crime?'act:':'suspect:')+e.npc.id,disguise:named?p.disguise:undefined};}}
  for(const n of this.npcs)if(n.active&&!n.busy)n.move(dt,this.world,this.nav,this.rules,p,this.doors);
  // Keep bodies from overlapping one another.
  for(let i=0;i<this.npcs.length;i++)for(let j=i+1;j<this.npcs.length;j++){const a=this.npcs[i],b=this.npcs[j];if(!a.active||!b.active||a.busy||b.busy)continue;const dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z;if(Math.abs(dx)>=.55||Math.abs(dz)>=.55||Math.abs(a.pos.y-b.pos.y)>=1)continue;const d=Math.hypot(dx,dz);if(d>1e-3&&d<.55){const push=(.55-d)/2;a.pos=this.world.move(a.pos,-dx/d*push,-dz/d*push);b.pos=this.world.move(b.pos,dx/d*push,dz/d*push);}}
  // F04: caught only by a guard who is detaining (not warning), knows who the agent is and reaches them. A gun in hand
  // is not detained but fought (combat.ts).
  // M06: not while the agent stands with hands up (the fake surrender's counter decides it, m3.ts).
  for(const n of this.npcs)if(n.arrest&&n.state==='alert')n.detainT+=dt;
  const handsUp=(this.rules.arrest??ARREST).handsUpSeconds??HANDS_UP_SECONDS;
  if(!this.caught&&!p.surrendering)for(const n of this.npcs)if(n.active&&!n.busy&&n.guard&&n.state==='alert'&&n.arrest&&n.detainT>=handsUp&&!p.weaponDrawn&&n.visibility>0&&n.hasConfirmedIdentity(p)&&flat(n.pos,p)<this.rules.catch&&Math.abs(n.pos.y-p.y)<1){this.caught=true;events.push({type:'caught',npc:n});break;}
  return events;}
 /** A guard's radio call about the agent: blown outfit, zone alert 2, colleagues within radio range come to the spot. */
 private radioIn(n:Npc,p:PlayerView,at:Position){this.alerts++;this.onSpotted?.(n);this.compromised.add(p.disguise);this.raiseZone(at,2);
  const incident=this.incidents.identify(at,'report',n.id);
  const k:Knowledge={eventType:'report',estimatedOrigin:{...at},identifiedDisguise:p.disguise,confirmedActor:true,confidence:.8,observedAt:this.time,sourceNpcId:n.id,incidentId:incident.id};
  for(const g of this.npcs)if(g.active&&!g.busy&&g!==n&&flat(g.pos,n.pos)<=this.rules.radio){
   g.radio(at,this.rules,k);this.incidents.write(incident,'reported',at,g.id,'radio',n.id);
   if(g.guard)g.knownDisguises.add(p.disguise);
  }}
 raiseZone(at:Position,level:number){const z=zoneAt(this.mission.zones,at.x,at.z,floorOf(at.y));if(z)this.zoneAlert.set(z.id,Math.max(level,this.zoneAlert.get(z.id)??0));}

 // Reinforcements arrive during the mission; they join the same shared state (compromised outfits) as everyone else.
 addNpc(def:NpcDef){const n=new Npc(def,this.mission,this.compromised);this.setHearsReports(n);this.npcs.push(n);return n;}
 outdoorAt(q:Position){const f=floorOf(q.y);return !(this.mission.rooms??[]).some(r=>r.indoor&&r.floor===f&&inside(r,q.x,q.z));}
 get lod():Lod{return this.rules.lod??{near:25,far:60,nearEvery:6,midEvery:30};}
 // near: full 10 Hz perception; mid: 2 Hz; far (or another floor): perception stops and the NPC only keeps walking its route.
 tier(n:Npc,p:PlayerView):Tier{if(n.priority)return 'near';const d=flat(n.pos,p);if(d>=this.lod.far||Math.abs(n.pos.y-p.y)>2.6)return 'far';return d>this.lod.near?'mid':'near';}
 // A direct witness identifies the current outfit; anonymous evidence does not.
 accuse(n:Npc,p:PlayerView,cause:Cause='crime'){if(!n.guard&&n.witnessCooldown>0)return;n.evidenceGoal=null;n.now=this.time;n.lastSeen={x:p.x,y:p.y,z:p.z};n.suspicion=100;n.loseT=0;n.cause=cause;
  // D01 (2026-11-06): someone already fighting stays in combat; a witness or face report only adds what they learned.
  const fighting=n.state==='combat';if(!fighting){n.state=n.guard?'alert':'report';n.timer=this.rules.timers.report;}
  if(n.guard){if(fighting)n.knownDisguises.add(p.disguise);else n.detain(p);this.alerts++;this.compromised.add(p.disguise);this.raiseZone(p,2);}else{n.knownDisguises.add(p.disguise);this.reports++;n.witness={what:'act',at:{x:p.x,y:p.y,z:p.z},key:'act:'+n.id,disguise:p.disguise};}this.onSpotted?.(n);
  // A guard's radio reaches colleagues at once; a bystander's word only arrives when they reach a guard (M5.6).
  if(n.guard){const k:Knowledge={eventType:'report',estimatedOrigin:{x:p.x,y:p.y,z:p.z},identifiedDisguise:p.disguise,confirmedActor:true,confidence:.8,observedAt:this.time,sourceNpcId:n.id};
   for(const g of this.npcs)if(g.active&&!g.busy&&g.guard&&g!==n&&g.state!=='combat'&&flat(g.pos,n.pos)<this.rules.radio){g.radio(p,this.rules,k);g.evidenceGoal=null;g.knownDisguises.add(p.disguise);g.lastSeen={x:p.x,y:p.y,z:p.z};g.suspicion=100;g.state='search';g.goal={...g.lastSeen};g.arrived=false;g.timer=this.rules.timers.search;}}}
 /** Debug view (spec 12): what each person knows and is doing, read-only. */
 debug(){return this.npcs.map(n=>({npcId:n.id,role:n.role,faction:n.faction,securityRole:n.securityRole,combatProfile:n.combatProfile??n.kind,disguiseId:n.disguiseId??'',aiState:n.state,cause:n.cause,arrest:n.arrest,suspicion:Math.round(n.suspicion),
  lastHeardOrigin:[...n.knowledge].reverse().find(k=>k.eventType==='gunshot'||k.eventType==='noise')?.estimatedOrigin??null,lastSeenPosition:n.lastSeen,confirmedActor:n.knowledge.some(k=>k.confirmedActor),
  enforcerDisguises:[...n.knowsFaces],knownDisguises:[...n.knownDisguises],knowledge:n.knowledge.map(k=>({...k})),currentWeapon:n.weapon}));}
 // The nearest NPC that can hear the coin walks over; only one answers.
 // 2026-11-04 (checkpoint spec): the one who would answer but saw the coin thrown turns on the thrower instead. A guard
 // holding a post goes to look only when the post stays covered: a partner is still at it (two-man checkpoint; the
 // last one stays), or, alone, the agent is not near it (rules.noise.postLeave m). Otherwise they only turn.
 // radius: how far it is heard (a coin by default; a loud machine further, devices.ts).
 noise(point:Position,p?:PlayerView,radius=this.rules.noise.coin,eligible?:(n:Npc)=>boolean,incident?:IncidentRef){let turned:Npc|undefined;
  for(const n of this.npcs.filter(n=>n.active&&!n.busy&&Math.abs(n.pos.y-point.y)<1.5&&flat(n.pos,point)<=radius&&(!eligible||eligible(n))&&this.soundClear?.(point,n.pos)!==false).sort((a,b)=>flat(a.pos,point)-flat(b.pos,point))){
   if(p&&n.visibility>0&&['patrol','curious','distracted'].includes(n.state)){this.sawThrow(n,p,incident??this.incidents.identify(point,'noise'));return n;}
   const go=this.mayLeavePost(n,p);if(!n.hear(point,this.rules,false,go))continue;
   incident??=this.incidents.identify(point,'noise');
   n.learn({eventType:'noise',estimatedOrigin:{...point},confidence:.5,observedAt:this.time,incidentId:incident.id});
   this.incidents.write(incident,'noticed',point,n.id,'sound');
   // A post guard who stays only turns toward it; someone else may still walk over.
   if(n.holdsPost&&!go){turned??=n;continue;}
   return n;}
  return turned;}
 lastThrowSeen=false;
 private sawThrow(n:Npc,p:PlayerView,incident:IncidentRef){const t=this.rules.thresholds;n.suspicion=Math.max(n.suspicion,t.curious);n.lastSeen={x:p.x,y:p.y,z:p.z};
  n.learn({eventType:'sighting',lastSeenPosition:{...n.lastSeen},confidence:1,observedAt:this.time,incidentId:incident.id});
  this.incidents.write(incident,'noticed',n.lastSeen,n.id,'sight');
  n.state='curious';n.timer=this.rules.timers.curiousHold;n.heading=Math.atan2(p.x-n.pos.x,p.z-n.pos.z);this.lastThrowSeen=true;return true;}
 mayLeavePost(n:Npc,p?:PlayerView){if(!n.holdsPost||!n.postAt)return true;const at=n.postAt;
  const partners=this.npcs.filter(m=>m!==n&&m.holdsPost&&m.postAt&&flat(m.postAt,at)<6&&Math.abs(m.postAt.y-at.y)<1);
  const away=!!p&&flat(p,at)>(this.rules.noise.postLeave??10);if(away)return true;
  // The agent is near: a partner may go while someone else still covers the post; the one who frisks never does.
  return !n.frisks&&partners.some(m=>m.active&&!m.busy&&!['alert','search','combat','investigate'].includes(m.state)&&flat(m.pos,m.postAt!)<1.5);}
 hottest(){return this.npcs.filter(n=>n.active).reduce<Npc|undefined>((m,n)=>!m||n.suspicion>m.suspicion?n:m,undefined);}
}

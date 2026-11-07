import combatPose from './data/combat-pose.json' with {type:'json'};
import type {Director,Knowledge,Npc,NpcDef,PlayerView} from './ai.ts';
import {defaultCarry,evaluateItemLegality,itemMaster,type ItemMaster} from './items.ts';
import type {MissionEvents} from './events.ts';
import type {HotelAlert} from './m3.ts';
import {markDead,markUnconscious} from './kills.ts';
import {segmentClear} from './sight.ts';
import {floorOf,type Block,type Position} from './world.ts';
/** M5.5 guns and gunfights ("the trump card when things fall apart").
 * The agent's pistol is concealed until drawn; a drawn gun seen by a guard starts a fight, by a bystander a flight.
 * Shots are hitscan with a noise radius; guards in a fight take cover, react after a delay and fire with a
 * distance-based hit chance, halved when the agent is partly behind something. Hotel alert 3 brings waves of
 * reinforcements and closes two exits. Losing sight of the agent ends the fight; changing clothes unseen
 * (the existing 30 m rule) returns the agent to infiltration. Every number is in combat.json / weapons.json. */
export type WeaponDef={label:string;class:'pistol'|'long';concealable:boolean;legality:string;noise:'small'|'loud';damage:number;headshot:number;mag:number;reserve:number|number[];rate:number;npcOnly?:boolean;allowedFor?:string[];playerPickupId?:string;
 // A dart gun (2026-11-06): the hit person falls asleep after sedateSeconds instead of being hurt.
 sedative?:boolean;sedateSeconds?:number};
type LocalResponse={radius:number;count:number;seconds:number;protectedRoles:string[];protectedIds?:string[]};
export type CombatRules={player:{health:number;regen:{delay:number;perSecond:number}};enemies:Record<string,{health:number;weapon?:string;hit?:number}>;accuracy:{near:number[];far:number[]};coverMultiplier:number;reactionTime:number;
 localResponse?:LocalResponse;
 reinforcements:{atAlert:number;spawn:string[];size:number;waves:number;interval:number;firstDelay?:number;model?:string;sweepSeconds?:number};placed?:{gun:string;x:number;y:number;z:number;where:string}[];compromised:{clearDistance:number};reloadSeconds:number;range:number;noiseSmall:number;noiseLoudOutdoor:number;noiseLoudIndoor?:number;noiseFloorFactor?:number;noiseWallFactor?:number;loseSeconds:number;endSeconds:number;coverSearch:number;fleeDistance:number;cowerSeconds:number;closedExitsAtAlert3:string[];alert3After?:number};
export type Gun={id:string;mag:number;reserve:number};
export type Dropped={key:number;gun:Gun;pos:Position;stocked?:true};
export type Fight={start:number;end:number|null;hits:number;damage:number;shots:number;kills:number;survived:boolean|null;returned:boolean|null};
export type Tracer={from:Position;to:Position;time:number;npc:boolean;hit:boolean};
export type ShotResult={fired:boolean;hit:Npc|null;head:boolean;killed:boolean;to:Position};
const flat=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const chest=(p:Position,crouched=false)=>({x:p.x,y:p.y+(crouched?combatPose.chest.crouched:combatPose.chest.standing),z:p.z});
/** F09: the combat profile written in the person's definition. Maps whose data predate it (the party prototype) fall
 * back to the old guess from the id, so they keep working until their generator writes the field. */
export function kindOf(n:{id:string;role:string;combatProfile?:string}):Npc['kind']{const c=n.combatProfile;if(c==='guard'||c==='bodyguard'||c==='response'||c==='civilian')return c;
 return n.id.startsWith('response')?'response':n.id.startsWith('bodyguard')?'bodyguard':n.role==='guard'?'guard':'civilian';}
/** Hit chance at a distance: linear between the near and far points of combat.json, clamped outside them. */
export function hitChance(rules:CombatRules,d:number){const [d0,p0]=rules.accuracy.near,[d1,p1]=rules.accuracy.far;if(d<=d0)return p0;if(d>=d1)return p1;return p0+(p1-p0)*(d-d0)/(d1-d0);}

export class CombatSystem{
 onReaction?: (n:Npc,reaction:string,reason:string,sense:'sight'|'sound',at:Position)=>void;
 onGunshot?: (origin:Position,kind:'small'|'loud')=>void;
 canPickUp?: (from:Position,to:Position)=>boolean;
 hp:number;lastHit=-Infinity;hand='';guns:Gun[]=[];reloadT=0;fireT=0;dead=false;
 readonly dropped:Dropped[]=[];readonly fights:Fight[]=[];fight:Fight|null=null;readonly tracers:Tracer[]=[];
 // F01: the shared item table (main.ts hands in the merged one; alone it knows the guns).
 items:ItemMaster;
 waves=0;nextWave=Infinity;private lastEngage=-Infinity;private nextKey=1;private spawned=0;private lastKnown:Position|null=null;private lastSighted=-Infinity;
 readonly director:Director;readonly events:MissionEvents;readonly hotel:HotelAlert;readonly rules:CombatRules;readonly weapons:Record<string,WeaponDef>;readonly points:{id:string;x:number;z:number}[];readonly rng:()=>number;
 private readonly cover:Block[];
 private readonly responders=new Map<Npc,Position>();
 constructor(director:Director,events:MissionEvents,hotel:HotelAlert,rules:CombatRules,weapons:Record<string,WeaponDef>,points:{id:string;x:number;z:number}[],rng:()=>number=Math.random){
  this.director=director;this.events=events;this.hotel=hotel;this.rules=rules;this.weapons=weapons;this.points=points.filter(p=>rules.reinforcements.spawn.includes(p.id));this.rng=rng;this.hp=rules.player.health;this.items=itemMaster(weapons);
  // Waist- to chest-high solids are cover: cars, crates, planters, counters, tables.
  this.cover=director.mission.blockers.filter(b=>b.h>=.7&&b.h<=1.6&&b.w<12&&b.d<12&&!b.id.startsWith('water')&&b.id!=='pool');
  for(const n of director.npcs)this.arm(n);}
 private arm(n:Npc){n.kind=kindOf(n);const e=this.rules.enemies[n.kind]??this.rules.enemies.civilian;n.hp=e.health;n.weapon=n.loadout??e.weapon??'';}
 def(id:string){return this.weapons[id];}
 get held(){return this.guns.find(g=>g.id===this.hand)??null;}
 /** Seen by anyone: a gun in hand, or a long gun that cannot be hidden. */
 get armed(){return !!this.hand||this.guns.some(g=>!this.def(g.id).concealable);}
 /** A long gun on the back that this outfit may not carry openly (security uniforms may, as in HITMAN). */
 shown(disguise:string){return this.guns.some(g=>g.id!==this.hand&&!evaluateItemLegality(this.items,g.id,disguise,defaultCarry(this.items,g.id)).visibleCarryAllowed);}
 /** Illegal to be seen with right now in this outfit: a gun in hand (any outfit) or a long gun it may not carry. */
 illegalIn(disguise:string){return !!this.hand||this.shown(disguise);}
 get inFight(){return !!this.fight;}
 /** ROADMAP H46 (2026-11-06): a gun left in advance at a hidden pickup (a crate, a planter). Like the stocked guns,
  * nobody reports or collects it; the agent picks it up with E. */
 stash(id:string,pos:Position){const d=this.def(id);if(!d||d.npcOnly)return;this.dropped.push({key:this.nextKey++,gun:{id,mag:d.mag,reserve:Array.isArray(d.reserve)?d.reserve[1]:d.reserve},pos:{...pos},stocked:true});}
 equip(id:string){const d=this.def(id);if(!d||d.npcOnly)return;const slot=this.guns.findIndex(g=>this.def(g.id).class===d.class);const gun={id,mag:d.mag,reserve:Array.isArray(d.reserve)?d.reserve[1]:d.reserve};if(slot>=0)this.guns[slot]=gun;else this.guns.push(gun);}
 /** Holstered → pistol → long gun → holstered. */
 cycle(){const order=['',...this.guns.map(g=>g.id)];this.hand=order[(order.indexOf(this.hand)+1)%order.length];this.reloadT=0;return this.hand;}
 holster(){this.hand='';this.reloadT=0;}
 reload(){const g=this.held;if(!g||this.reloadT>0||g.mag>=this.def(g.id).mag||g.reserve<=0)return false;this.reloadT=this.rules.reloadSeconds;return true;}
 // With nothing in hand the gun is put down without drawing it (playtest 2026-11-02: a picked-up SMG or guard pistol
 // could only be dropped by drawing it in view, so a frisk checkpoint stayed shut): the long gun first, then the pistol.
 drop(p:Position){const g=this.held??this.guns.find(g=>this.def(g.id).class==='long')??this.guns[0];if(!g)return null;this.guns.splice(this.guns.indexOf(g),1);this.hand='';this.reloadT=0;this.dropped.push({key:this.nextKey++,gun:g,pos:{...p}});return g;}
 nearestDrop(p:Position){return this.dropped.filter(d=>flat(d.pos,p)<1.3&&d.pos.y-p.y>-.5&&d.pos.y-p.y<1.3&&this.canPickUp?.(p,d.pos)!==false).sort((a,b)=>flat(a.pos,p)-flat(b.pos,p))[0];}
 /** Picks up a dropped gun: the same model adds its rounds as reserve; a different one of the same class (one pistol,
  * one long gun) is swapped, leaving the old one on the floor. */
 pickup(p:Position){const d=this.nearestDrop(p);if(!d)return null;const def=this.def(d.gun.id),same=this.guns.find(g=>g.id===d.gun.id);this.dropped.splice(this.dropped.indexOf(d),1);
  if(same)same.reserve+=d.gun.mag+d.gun.reserve;else{const slot=this.guns.findIndex(g=>this.def(g.id).class===def.class);if(slot>=0){const old=this.guns[slot];if(this.hand===old.id)this.hand=d.gun.id;this.dropped.push({key:this.nextKey++,gun:old,pos:{...d.pos}});this.guns[slot]={...d.gun};}else this.guns.push({...d.gun});}
  return def.label;}

 /** The first person a line from `from` along unit `u` meets within `range` (not behind a wall), and how far along. */
 private firstPerson(from:Position,u:Position,range:number,near=.3){let best:Npc|null=null,bestT=range,head=false;
  for(const n of this.director.npcs){if(!n.active||n.scheduledAway||n.bodyMode==='hidden')continue;
   // Closest approach of the line to the person's vertical axis, then the height there.
   const ox=n.pos.x-from.x,oz=n.pos.z-from.z,h2=u.x*u.x+u.z*u.z;if(h2<1e-6)continue;const t=(ox*u.x+oz*u.z)/h2;if(t<near||t>bestT)continue;
   const cx=from.x+u.x*t-n.pos.x,cz=from.z+u.z*t-n.pos.z;if(cx*cx+cz*cz>.32*.32)continue;const y=from.y+u.y*t-n.pos.y;if(y<0||y>1.85)continue;
   if(!segmentClear(this.director.boxes,from,{x:from.x+u.x*t,y:from.y+u.y*t,z:from.z+u.z*t}))continue;best=n;bestT=t;head=y>1.5;}
  return {npc:best,t:bestT,head};}
 /** What the crosshair is on: the first person or solid along the view ray (camera or cursor). The shot is then fired
  * from the agent's chest at that point, so it lands where the crosshair is, not parallel to it. */
 sightHit(origin:Position,dir:Position){const len=Math.hypot(dir.x,dir.y,dir.z)||1,u={x:dir.x/len,y:dir.y/len,z:dir.z/len},range=this.rules.range+8;let wall=range;
  for(const b of this.director.boxes){let t0=0,t1=wall;for(const [o,d,lo,hi] of [[origin.x,u.x,b.minX,b.maxX],[origin.y,u.y,b.minY,b.maxY],[origin.z,u.z,b.minZ,b.maxZ]]){if(Math.abs(d)<1e-12){if(o<lo||o>hi){t0=Infinity;break;}continue;}let a=(lo-o)/d,c=(hi-o)/d;if(a>c)[a,c]=[c,a];t0=Math.max(t0,a);t1=Math.min(t1,c);if(t0>t1)break;}
   if(t0<=t1&&t0>.05&&t0<wall)wall=t0;}
  const person=this.firstPerson(origin,u,wall,.05),t=person.npc?person.t:wall;
  return {point:{x:origin.x+u.x*t,y:origin.y+u.y*t,z:origin.z+u.z*t},npc:person.npc,head:person.head};}
 /** One shot from the agent's chest toward `aim`: the first person on the line (not behind a wall) is hit. */
 fire(p:PlayerView,aim:Position,time:number):ShotResult{const g=this.held,from=chest(p,p.crouched);if(!g||this.reloadT>0||this.fireT>0||g.mag<=0)return {fired:false,hit:null,head:false,killed:false,to:aim};
  const def=this.def(g.id);g.mag--;this.fireT=1/def.rate;if(this.fight)this.fight.shots++;
  const dx=aim.x-from.x,dy=aim.y-from.y,dz=aim.z-from.z,len=Math.hypot(dx,dy,dz)||1,ux=dx/len,uy=dy/len,uz=dz/len;
  // A point the crosshair is on may lie just short of the axis: carry the line on past it.
  // AI report P2 (2026-11-05): a shot reaches `range` at most, even when the aim point is farther.
  const shot=this.firstPerson(from,{x:ux,y:uy,z:uz},this.rules.range),best=shot.npc,bestT=best?shot.t:Math.min(len,this.rules.range),headHit=shot.head;
  const to={x:from.x+ux*bestT,y:from.y+uy*bestT,z:from.z+uz*bestT};this.tracers.push({from,to,time,npc:false,hit:!!best});
  this.events.emit({type:'shot.fired',time,id:g.id,method:def.noise});
  let killed=false;
  // A dart: no wound and no outcry; the person walks on for a moment, then falls asleep (sedating, step()).
  if(best&&def.sedative){if(!this.sedating.some(s=>s.n===best))this.sedating.push({n:best,at:time+(def.sedateSeconds??2.5)});this.events.emit({type:'npc.sedated',time,id:best.id});}
  else if(best){best.hp-=def.damage*(headHit?def.headshot:1);if(best.hp<=0){this.kill(best,'gun',time);killed=true;if(this.fight)this.fight.kills++;}
   else this.wounded(best,p,from,time);}
  this.noise(from,def.noise,p,time);
  return {fired:true,hit:best,head:headHit,killed,to};}
 /** F02: hit and still standing. A bystander runs; a guard who can see the shooter fights; one who cannot goes to
  * where the shot came from (HITMAN's search: they know where, not who) and fights only on finding the agent armed. */
 private wounded(n:Npc,p:PlayerView,from:Position,time:number){const origin={x:from.x,y:from.y-1.4,z:from.z};
  n.learn({eventType:'wounded',estimatedOrigin:origin,confidence:.7,observedAt:time});
  if(!n.guard){this.flee(n,from);return;}if(n.state==='combat')return;
  n.perceive(p,this.director.boxes,this.director.rules);if(n.visibility>0){this.engage(n,p,time);return;}
  n.evidenceGoal=null;n.suspicion=100;n.state='search';n.goal={...origin};n.arrived=false;n.timer=this.director.rules.timers.search;}
 private kill(n:Npc,method:string,time:number){markDead(n,method,{kind:this.fight?'combat':'murder',witnesses:[],cameras:[],illegal:true,reasons:[this.fight?'撃ち合いの中で倒した':'銃で撃った']});
  this.disarm(n);void time;}
 /** A guard's pistol, a bodyguard's or response member's SMG drops next to the body, with what is left in it — however
  * they went down (shot, knocked out, garrotted, an accident), as a subdued guard's gun lies by them in HITMAN. */
 // F12: what lands on the floor is the gun's playerPickupId (the response rifle leaves an SMG, a deliberate limit).
 private disarm(n:Npc){const id=this.def(n.weapon)?.playerPickupId??n.weapon;n.weapon='';if(!id||!this.def(id)||this.def(id).npcOnly)return;const d=this.def(id),r=d.reserve,reserve=Array.isArray(r)?Math.round(r[0]+(r[1]-r[0])*this.rng()):r;
  this.dropped.push({key:this.nextKey++,gun:{id,mag:Math.max(1,Math.round(d.mag*(.35+.65*this.rng()))),reserve},pos:{x:n.pos.x+Math.sin(n.heading+1.6)*.7,y:n.pos.y,z:n.pos.z+Math.cos(n.heading+1.6)*.7}});}
 /** Guns left in the hotel (combat.json placed): a pistol on the security desk, the bodyguards' spare SMG in B's room.
  * Loaded and with a full reserve. Kept out of the constructor so a bare system starts with an empty floor. */
 stock(){for(const s of this.rules.placed??[]){const d=this.def(s.gun);if(!d)continue;const r=d.reserve;this.dropped.push({key:this.nextKey++,gun:{id:s.gun,mag:d.mag,reserve:Array.isArray(r)?r[1]:r},pos:{x:s.x,y:s.y,z:s.z},stocked:true});}return this;}
 /** F03: whether one person hears a shot. Every case has a finite range: small (suppressed) noiseSmall; loud
  * noiseLoudOutdoor when both are outdoors, else noiseLoudIndoor. One floor apart scales it by noiseFloorFactor, two
  * floors are out of reach, and a wall or floor between them scales it by noiseWallFactor. */
 canHearGunshot(n:Npc,origin:Position,kind:'small'|'loud',outdoor:boolean){const R=this.rules,df=Math.abs(floorOf(n.pos.y)-floorOf(origin.y));if(df>1)return false;
  let range=kind==='small'?R.noiseSmall:outdoor&&n.outdoor?R.noiseLoudOutdoor:R.noiseLoudIndoor??R.noiseLoudOutdoor;if(df===1)range*=R.noiseFloorFactor??.5;
  const d=Math.hypot(n.pos.x-origin.x,n.pos.y-origin.y,n.pos.z-origin.z);if(d>range)return false;
  return d<=range*(R.noiseWallFactor??.5)||segmentClear(this.director.boxes,{x:origin.x,y:origin.y+1.4,z:origin.z},{x:n.pos.x,y:n.pos.y+1.6,z:n.pos.z});}
 /** Who hears a shot, and what they do: guards come to look where it was, bystanders run. The list is returned. */
 noise(from:Position,kind:'small'|'loud',p:PlayerView,time:number){const origin={x:from.x,y:from.y-1.4,z:from.z},outdoor=this.director.outdoorAt(origin),heard:Npc[]=[];
  for(const n of this.director.npcs){if(!n.active||n.busy||n.scheduledAway||n.state==='combat'||!this.canHearGunshot(n,origin,kind,outdoor))continue;heard.push(n);
   // Who fired is only known by seeing them armed or in the blown outfit; the sound gives where, not who.
   const k:Knowledge={eventType:'gunshot',estimatedOrigin:{...origin},confidence:kind==='loud'?.6:.8,observedAt:time};
   if(n.guard){if(this.rules.localResponse)n.learn(k);else n.radio(origin,this.director.rules,k);if(!this.rules.localResponse)this.onReaction?.(n,'investigate','gunshot','sound',origin);}
   else{n.learn(k);if(n.state!=='flee'){this.flee(n,from);this.onReaction?.(n,'flee','gunshot','sound',origin);}}}
  // F03/F08: a shot nobody heard changes nothing. A loud one heard is an uproar (alert 2: the targets go to their safe
  // rooms); alert 3 — the lockdown, evacuation and reinforcements — comes when the fight goes on, see step.
  // HITMAN "Gunshot Heard" (2026-11-04, AI lab): with localResponse, the nearest guards who heard it (up to count, not the
  // protected posts) go and look where it came from; the rest only remember it. Hearing never names the shooter.
  const lr=this.rules.localResponse;if(lr){const go=heard.filter(n=>n.guard&&n.state!=='combat'&&!(lr.protectedRoles??[]).includes(n.securityRole??'')&&!(lr.protectedIds??[]).includes(n.id)&&!n.holdsPost).sort((a,b)=>Math.hypot(a.pos.x-origin.x,a.pos.z-origin.z)-Math.hypot(b.pos.x-origin.x,b.pos.z-origin.z)).slice(0,lr.count);
   for(const n of heard.filter(n=>n.guard))this.onReaction?.(n,go.includes(n)?'investigate':'heard','gunshot','sound',origin);for(const n of go)n.radio(origin,this.director.rules);}
  if(heard.length){this.director.raiseZone(origin,1);if(heard.some(n=>n.guard)){this.lastKnown={...origin};this.lastSighted=time;}if(kind==='loud'){if(this.hotel.level<2)this.hotel.level=2;this.hotel.quiet=0;}}
  this.onGunshot?.(origin,kind);void p;return heard;}
 /** A guard joins the fight on seeing the agent armed (or in the blown outfit while a fight is on). Only sight puts the
  * agent's position into what they know. */
 engage(n:Npc,p:PlayerView,time:number){if(!n.active||n.state==='combat')return;const first=!this.fight;
  n.learn({eventType:'sighting',lastSeenPosition:{x:p.x,y:p.y,z:p.z},confirmedActor:true,identifiedDisguise:p.disguise,confidence:1,observedAt:time});n.knownDisguises.add(p.disguise);
  n.state='combat';n.lastSeen={x:p.x,y:p.y,z:p.z};n.loseT=0;n.reactT=0;n.combatGoal=null;n.coverT=0;n.suspicion=100;this.lastEngage=time;this.lastKnown={x:p.x,y:p.y,z:p.z};this.lastSighted=time;
  this.director.compromised.add(p.disguise);this.director.onSpotted?.(n);
  this.onReaction?.(n,'engage',p.weaponDrawn?'gun_drawn':p.illegalVisibleCarry?'visible_weapon':'confirmed_identity','sight',p);
  if(first){this.fight={start:time,end:null,hits:0,damage:0,shots:0,kills:0,survived:null,returned:null};this.fights.push(this.fight);this.events.emit({type:'combat.started',time});}}
 /** A bystander runs away from the danger, then cowers for a while. */
 flee(n:Npc,from:{x:number;z:number}){const dx=n.pos.x-from.x,dz=n.pos.z-from.z,nav=this.director.nav,here=nav.nearest(n.pos),sec=here>=0?nav.nodes[here].sec:-1;
  // Away from the danger, but somewhere in this part of the map or the next (a spot behind a wall would need a
  // search of the whole map, and ninety of those at once is what made a loud shot stutter).
  let i=-1;search:for(const turn of [0,.8,-.8,1.6,-1.6])for(const k of [1,.66,.33]){const a=Math.atan2(dx,dz)+turn,target={x:n.pos.x+Math.sin(a)*this.rules.fleeDistance*k,y:n.pos.y,z:n.pos.z+Math.cos(a)*this.rules.fleeDistance*k},j=nav.nearest(target);if(j<0)continue;const s=nav.nodes[j].sec;if(sec<0||s===sec||nav.links.get(sec)?.has(s)){i=j;break search;}if(i<0)i=j;}
  n.state='flee';n.goal=i>=0?{...this.director.nav.nodes[i]}:{...n.pos};n.arrived=false;n.timer=this.rules.cowerSeconds;n.suspicion=0;}
 closedExits(){return this.hotel.level>=3?this.rules.closedExitsAtAlert3:[];}

 // People hit by a dart and when they fall asleep.
 readonly sedating:{n:Npc;at:number}[]=[];
 step(dt:number,p:PlayerView,time:number){
  for(const s of [...this.sedating])if(time>=s.at||!s.n.active){this.sedating.splice(this.sedating.indexOf(s),1);if(s.n.active){markUnconscious(s.n);this.disarm(s.n);}}
  for(const n of this.director.npcs)if(n.weapon&&!n.active&&n.life!=='active'&&n.bodyMode==='ground'&&n.fall>=1)this.disarm(n);
  if(this.fireT>0)this.fireT-=dt;
  if(this.reloadT>0){this.reloadT-=dt;const g=this.held;if(this.reloadT<=0&&g){const take=Math.min(this.def(g.id).mag-g.mag,g.reserve);g.mag+=take;g.reserve-=take;}}
  if(time-this.lastHit>=this.rules.player.regen.delay)this.hp=Math.min(this.rules.player.health,this.hp+this.rules.player.regen.perSecond*dt);
  // A gun in hand is seen at once; a long gun on the back first fills the watcher's gauge (ai.ts baseRate).
  const drawn=!!this.hand,shown=this.shown(p.disguise),target={x:p.x,y:p.y,z:p.z};
  for(const n of this.director.npcs){if(!n.active||n.busy||n.scheduledAway)continue;
   // Being seen with a gun out, or noticed with a gun on the back (or by a guard while the fight is on, in the blown outfit) starts or joins the fight.
   if(n.visibility>0&&n.state!=='combat'){const armed=drawn||shown&&n.suspicion>=100;
    // A guard who saw the agent kill someone fights on sight (HITMAN report G-03, 2026-11-04).
    if(n.guard&&(armed||n.sawViolence&&n.hasConfirmedIdentity(p)||this.fight&&n.hasConfirmedIdentity(p)))this.engage(n,p,time);
    // A bystander who sees a gun out runs to tell a guard (M5.6 witness); once shots are flying they just run away.
    else if(!n.guard&&armed&&n.state!=='flee'&&!n.witness&&n.witnessCooldown<=0){this.director.reports++;this.director.onSpotted?.(n);n.knownDisguises.add(p.disguise);if(this.fight)this.flee(n,p);else{n.state='report';n.lastSeen={x:p.x,y:p.y,z:p.z};n.witness={what:'act',at:{x:p.x,y:p.y,z:p.z},key:'act:'+n.id,disguise:p.disguise};}this.onReaction?.(n,this.fight?'flee':'report',drawn?'gun_drawn':'visible_weapon','sight',p);}}
   if(n.state==='combat')this.fightStep(n,p,dt,time);
   // Once shots fly, someone running to tell a guard runs for cover instead (the fight has already raised the alarm).
   else if(this.fight&&n.witness&&n.state==='report'){n.witness=null;this.flee(n,p);}
   else if(n.state==='flee'&&n.arrived&&(n.timer-=dt)<=0){n.state='patrol';n.goal=null;}}
  if(this.fight){if(this.director.npcs.some(n=>n.active&&n.state==='combat'))this.lastEngage=time;
   else if(time-this.lastEngage>=this.rules.endSeconds){this.fight.end=time;this.fight.survived=true;this.events.emit({type:'combat.ended',time});this.fight=null;}}
  // Back to infiltration: the fight is over, the outfit worn is not blown and nobody is chasing or shooting at the agent
  // (guards still searching are looking for the old outfit).
  const last=this.fights[this.fights.length-1];if(!this.fight&&last&&last.returned===null&&!this.director.compromised.has(p.disguise)&&!this.director.npcs.some(n=>n.active&&(n.state==='alert'||n.state==='combat')))last.returned=true;
  // Hotel alert 3: waves of reinforcements from the parking lot and the loading dock.
  if(this.fight&&time-this.fight.start>=(this.rules.alert3After??0)&&this.hotel.level<3){this.hotel.level=3;this.hotel.quiet=0;}
  const R=this.rules.reinforcements;if(this.hotel.level>=R.atAlert&&this.waves<R.waves){if(this.nextWave===Infinity)this.nextWave=time+(R.firstDelay??0);if(time>=this.nextWave){this.spawnWave(time,p);this.waves++;this.nextWave=time+R.interval;}}
  if(this.rules.localResponse)this.dispatchLocal(time,this.rules.localResponse);
  // F11 (playtest 2026-11-02「不動の増援」): during the lockdown a response member whose search ended searches again,
  // somewhere 4-14 m from where the agent was last known (or from where they stand), instead of standing still.
  // Only for sweepSeconds after the agent was last seen or heard; then they go back to their post (the exit they came
  // in by) and the hotel can calm down (playtest 2026-11-03: they searched for ever, so the alert never ended).
  if(this.hotel.level>=R.atAlert&&time-this.lastSighted<(R.sweepSeconds??120))for(const n of this.director.npcs){if(!n.reinforcement||!n.active||n.busy||n.state!=='patrol')continue;const c=this.lastKnown??n.pos,nav=this.director.nav;
   // Four directions a quarter turn apart, so a point off the map or inside a wall does not stall them.
   let j=-1;const a0=this.rng(),r=4+this.rng()*10;for(let k=0;k<4&&j<0;k++){const a=(a0+k/4)*Math.PI*2;j=nav.nearest({x:c.x+Math.sin(a)*r,y:c.y,z:c.z+Math.cos(a)*r});}if(j<0)continue;const q=nav.nodes[j];
   n.state='search';n.goal={x:q.x,y:q.y,z:q.z};n.lastSeen=null;n.arrived=false;n.timer=this.director.rules.timers.search;}
  for(let i=this.tracers.length-1;i>=0;i--)if(time-this.tracers[i].time>.12)this.tracers.splice(i,1);
  if(this.hp<=0&&!this.dead){this.dead=true;if(this.fight){this.fight.end=time;this.fight.survived=false;}}
  void target;}
 private dispatchLocal(time:number,r:LocalResponse){
  const active=this.hotel.level>=3&&time-this.lastSighted<r.seconds;
  for(const [n,goal] of this.responders){
   if(n.active&&n.state==='search'&&n.goal===goal&&active)continue;
   if(n.state==='search'&&n.goal===goal){n.state='patrol';n.goal=null;n.suspicion=0;}
   this.responders.delete(n);
  }
  const at=this.lastKnown;
  if(!active||!at||this.responders.size>=r.count)return;
  const candidates=this.director.npcs.filter(n=>n.guard&&n.active&&!n.busy&&(n.state==='patrol'||n.state==='investigate')&&!r.protectedRoles.includes(n.securityRole)&&!r.protectedIds?.includes(n.id)&&flat(n.pos,at)<=r.radius)
   .sort((a,b)=>flat(a.pos,at)-flat(b.pos,at));
  for(const n of candidates){
   if(this.responders.size>=r.count)break;
   if(!this.director.nav.find(n.pos,at))continue;
   const goal={...at};n.evidenceGoal=null;n.state='search';n.goal=goal;n.lastSeen=null;n.arrived=false;n.timer=r.seconds;
   this.responders.set(n,goal);
  }
 }
 private fightStep(n:Npc,p:PlayerView,dt:number,time:number){const seen=n.visibility>0&&(this.illegalIn(p.disguise)||n.hasConfirmedIdentity(p));
  if(seen){n.lastSeen={x:p.x,y:p.y,z:p.z};this.lastKnown={...n.lastSeen};this.lastSighted=time;n.loseT=0;n.reactT+=dt;n.fireT-=dt;n.coverT-=dt;const d=flat(n.pos,p);
   // Find cover once in a while: the far side of a nearby low solid, as seen from the agent; else close in when far.
   if(n.coverT<=0){n.coverT=3;n.combatGoal=this.coverPoint(n,p)??(d>16?{x:p.x+(n.pos.x-p.x)/d*10,y:n.pos.y,z:p.z+(n.pos.z-p.z)/d*10}:null);}
   const e=this.rules.enemies[n.kind]??this.rules.enemies.guard,w=this.def(n.weapon);
   if(w&&n.reactT>=this.rules.reactionTime&&n.fireT<=0){n.fireT=1/w.rate*(.8+.4*this.rng());n.shotAt=time;const chance=hitChance(this.rules,d)*(n.visibility<1?this.rules.coverMultiplier:1),hit=this.rng()<chance;
    const from={x:n.pos.x,y:n.pos.y+1.4,z:n.pos.z};this.tracers.push({from,to:hit?chest(p,p.crouched):{x:p.x+(this.rng()-.5)*1.2,y:p.y+.5+this.rng(),z:p.z+(this.rng()-.5)*1.2},time,npc:true,hit});
    this.onReaction?.(n,'shoot',p.weaponDrawn?'gun_drawn':'confirmed_identity','sight',p);
    if(hit){this.hp-=e.hit??10;this.lastHit=time;if(this.fight){this.fight.hits++;this.fight.damage+=e.hit??10;}this.events.emit({type:'player.hit',time,id:n.id,value:e.hit});}
    if(w.noise==='loud'&&this.rng()<.25)this.noise(from,'loud',p,time);}}
  else{n.loseT+=dt;n.reactT=0;n.combatGoal=n.lastSeen&&{...n.lastSeen};
   if(n.loseT>this.rules.loseSeconds){n.state='search';n.goal=n.lastSeen&&{...n.lastSeen};n.arrived=false;n.timer=this.director.rules.timers.search;n.combatGoal=null;}}}
 private coverPoint(n:Npc,p:PlayerView){let best:Position|null=null,score=Infinity;
  for(const b of this.cover){if((b.floor??0)!==floorOf(n.pos.y))continue;const c={x:b.x,z:b.z},d=flat(c,n.pos);if(d>this.rules.coverSearch)continue;
   const away=Math.hypot(c.x-p.x,c.z-p.z)||1,r=Math.max(b.w,b.d)/2+.6,spot={x:c.x+(c.x-p.x)/away*r,y:n.pos.y,z:c.z+(c.z-p.z)/away*r};
   if(this.director.world.blocked(spot.x,spot.y,spot.z)||flat(spot,p)<4)continue;const s=flat(spot,n.pos);if(s<score){score=s;best=spot;}}
  return best;}
 /** F11: a spawn point the agent cannot see from close by, else any (the waves are finite either way). */
 private spawnPoint(k:number,p?:PlayerView){const pts=this.points.map((_,j)=>this.points[(this.waves+k+j)%this.points.length]);
  return pts.find(at=>!p||Math.hypot(at.x-p.x,at.z-p.z)>12||!segmentClear(this.director.boxes,{x:at.x,y:1.5,z:at.z},{x:p.x,y:p.y+1.5,z:p.z}))??pts[0];}
 private spawnWave(time:number,p?:PlayerView){const R=this.rules.reinforcements,goal=this.lastKnown;
  for(let k=0;k<R.size;k++){const at=this.spawnPoint(k,p),i=++this.spawned;let x=at.x+(k%2?.8:-.8),z=at.z+(k>1?.8:-.8);
   // Off the walkable floor (a car parked on the point): the nearest free spot instead.
   if(this.director.world.blocked(x,0,z)){const j=this.director.nav.nearest({x,y:0,z});if(j>=0){x=this.director.nav.nodes[j].x;z=this.director.nav.nodes[j].z;}}
   const def:NpcDef={id:`response_${i}`,role:'guard',label:'増援部隊',floor:0,model:R.model??'guard',route:[[x,z]],faction:'response_team',securityRole:'response',combatProfile:'response',loadout:this.rules.enemies.response?.weapon,disguiseId:'guard'};const n=this.director.addNpc(def);this.arm(n);n.reinforcement=true;
   if(goal){n.state='search';n.goal={...goal};n.lastSeen={...goal};n.arrived=false;n.timer=this.director.rules.timers.search*2;n.suspicion=100;}}
  this.events.emit({type:'alert.level',time,value:this.hotel.level,reason:'reinforcements'});}
 snapshot(){return {hp:Math.round(this.hp),hand:this.hand,guns:this.guns.map(g=>({...g})),reloading:this.reloadT>0,armed:this.armed,fight:this.fight&&{...this.fight},fights:this.fights.map(f=>({...f})),waves:this.waves,dropped:this.dropped.map(d=>({id:d.gun.id,pos:d.pos})),closedExits:this.closedExits(),reinforcementWave:this.waves,reinforcementRemaining:Math.max(0,this.rules.reinforcements.waves-this.waves)*this.rules.reinforcements.size,inCombat:this.director.npcs.filter(n=>n.active&&n.state==='combat').map(n=>n.id),fleeing:this.director.npcs.filter(n=>n.active&&n.state==='flee').length};}
}

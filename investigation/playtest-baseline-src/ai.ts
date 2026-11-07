import { inside, floorOf, plateY, type CollisionWorld, type Level, type Position } from './world.ts';
import type { NavGrid } from './nav.ts';
import { segmentClear, type Aabb } from './sight.ts';
export type Role='guard'|'guest'|'waiter';
// combat: a guard in a gunfight (driven by CombatSystem); flee: a bystander running from gunfire, then cowering.
export type State='patrol'|'curious'|'investigate'|'alert'|'search'|'report'|'distracted'|'verify'|'combat'|'flee';
export type ZoneType='public'|'staff'|'secure'|'outer';
export type Permission='allow'|'caution'|'deny';
export type Zone={id:string;label:string;floor:number;type:string;minX:number;maxX:number;minZ:number;maxZ:number};
// knowsFaces: the one or two outfits whose wearers this person knows by face. post: the zone ids where they normally work.
// outfit: the disguise their clothes give when taken (defaults to the role's).
export type NpcDef={id:string;role:string;label:string;floor:number;model?:string;route:number[][];look?:number[];knowsFaces?:string[];post?:string|string[];target?:boolean;outfit?:string};
// rooms: indoor rooms shorten sight; outdoors (no indoor room around) uses the longer outdoor ranges.
export type Mission=Level&{zones:Zone[];npcs:NpcDef[];rooms?:(Zone&{indoor:boolean})[];objectives:{panel:{x:number;z:number;radius:number;seconds:number;label:string};exit:{x:number;z:number;radius:number;label:string}}};
type Vision={range:number;half:number;sensitivity:number};
export type Rules={disguises:Record<string,Record<string,string>>;rates:{run:number;crouchPublic:number;deny:number;caution:number;tamper:number;unseen:number;weapon?:number};
 multipliers:{crowd:number;crowdCount:number;crowdRadius:number;stillOrCover:number;nearMax:number;nearFull:number;nearNone:number};thresholds:{curious:number;investigate:number;alert:number};
 vision:{guard:Vision;guest:Vision;waiter:Vision;outdoor?:Record<Role,number>;peripheral:{range:number;half:number};touch:number;eye:number};speeds:{walk:number;investigate:number;chase:number;search:number};
 timers:{curiousHold:number;lookAround:number;lose:number;search:number;report:number;noiseLook:number};noise:{coin:number;coins:number;throw:number};catch:number;radio:number;
 lod?:Lod;m4?:{enforcerSpeed?:EnforcerSpeed}};
// Seconds to fill the white gauge at a distance: [[metres, seconds], ...], interpolated, nothing beyond range.
export type EnforcerSpeed={range:number;front:number;table:number[][];boost:number;crowdRange:number;decay:number;verify:number;postMargin:number;verifyStop:number};
// Perception tiers by distance from the agent: near every `nearEvery` steps, mid every `midEvery`, far not at all.
export type Lod={near:number;far:number;nearEvery:number;midEvery:number;planMs?:number};
export type Tier='near'|'mid'|'far';
// blending: doing the outfit's job at a BLEND_ spot; illegal: an illegal thing in hand (gun out); suspiciousItem: a suspicious thing
// the outfit may not carry (M5.6); weaponShown: a long gun on the back that this outfit may not carry openly (security uniforms may, as in HITMAN).
export type PlayerView={x:number;y:number;z:number;floor:number;speed:number;running:boolean;crouched:boolean;tampering:boolean;disguise:string;restricted?:boolean;blending?:boolean;illegal?:boolean;suspiciousItem?:boolean;weaponShown?:boolean};
export type AiEvent={type:'curious'|'investigate'|'alert'|'search'|'calm'|'report'|'heard'|'caught'|'verify'|'compromised';npc:Npc};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v)),wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a)),flat=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);
export function enforcerSeconds(f:EnforcerSpeed,d:number){const t=f.table;if(d<=t[0][0])return t[0][1];for(let i=1;i<t.length;i++)if(d<=t[i][0]){const k=(d-t[i-1][0])/(t[i][0]-t[i-1][0]);return t[i-1][1]+(t[i][1]-t[i-1][1])*k;}return Infinity;}
export function zoneAt(zones:Zone[],x:number,z:number,floor:number){return zones.find(r=>r.floor===floor&&inside(r,x,z));}
export function permission(rules:Rules,disguise:string,zone?:Zone):Permission{return (zone?rules.disguises[disguise]?.[zone.type]:'allow') as Permission||(zone?'deny':'allow');}
// What the agent is doing that would look wrong to a watcher (per second, before distance and cover).
export function baseRate(rules:Rules,p:PlayerView,perm:Permission,zone?:string){const r=rules.rates;let v=p.weaponShown?r.weapon??r.deny*3:0;if(p.blending)return v;if(p.suspiciousItem)v+=r.caution;if(p.running)v+=r.run;if(p.crouched&&(zone??'public')==='public')v+=r.crouchPublic;if(perm==='deny')v+=r.deny;else if(perm==='caution')v+=r.caution;if(p.tampering)v+=r.tamper;return v;}
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
 // M5.6: a bystander who saw a crime or a body and is running to tell a guard (what, where, and a key so it counts once).
 witness:{what:'act'|'body';at:Position;key:string}|null=null;
 scheduled=false;scheduledAway=false;scheduleTarget:Position|null=null;scheduleHeading:number|null=null;scheduleAction='';scheduleSpeed=0;talking=false;actionTime=0;
 readonly id:string;readonly role:Role;readonly label:string;readonly route:number[][];readonly look?:number[];
 readonly knowsFaces:string[];readonly post:string[];readonly target:boolean;readonly outfit?:string;outdoor=false;
 // Compromised outfits. The Director hands every NPC the same set, so the state belongs to the outfit, not to one witness.
 knownDisguises:Set<string>;
 life:'active'|'unconscious'|'dead'='active';bodyMode:'ground'|'dragged'|'hidden'='ground';busy=false;fall=0;evidenceGoal:Position|null=null;
 pos:Position;heading:number;state:State='patrol';suspicion=0;visibility=0;distance=Infinity;off=180;lastSeen:Position|null=null;goal:Position|null=null;
 speed=0;arrived=false;timer=0;scanBase=0;scanT=0;loseT=0;routeIndex=0;wait=0;face=0;tier:Tier='near';
 private path:Position[]=[];private pathGoal:Position|null=null;private repath=0;private stuck=0;private noticed=false;
 constructor(def:NpcDef,level:Level,known=new Set<string>()){this.id=def.id;this.role=def.role as Role;this.label=def.label;this.route=def.route.map(r=>[...r]);this.look=def.look&&[...def.look];this.knowsFaces=def.knowsFaces??[];this.post=def.post===undefined?[]:[def.post].flat();this.target=!!def.target;this.outfit=def.outfit;this.knownDisguises=known;const r=def.route[0];this.pos={x:r[0],y:plateY(level,def.floor),z:r[1]};
  const next=def.route[1]??def.look;this.heading=next?Math.atan2(next[0]-r[0],next[1]-r[1]):0;}
 knowsFace(disguise:string){return this.knowsFaces.includes(disguise);}
 // Away from their usual post a face-knower is just passing through and does not look closely.
 atPost(zones:Zone[],margin:number){if(!this.post.length)return true;return this.post.some(id=>{const z=zones.find(z=>z.id===id);return !!z&&floorOf(this.pos.y)===z.floor&&inside(z,this.pos.x,this.pos.z,-margin);});}
 // Witnesses, the alerted and anyone checking a face keep full-rate perception wherever they are.
 get priority(){return this.target||this.face>0||['alert','search','report','verify','investigate','combat','flee'].includes(this.state);}
 recognizes(p:PlayerView){return !this.knownDisguises.size||this.knownDisguises.has(p.disguise)||this.knowsFace(p.disguise);}
 get active(){return this.life==='active'&&!this.scheduledAway;}
 get guard(){return this.role==='guard';}
 vision(rules:Rules){const v=rules.vision[this.role],far=this.outdoor?rules.vision.outdoor?.[this.role]:undefined;return far?{...v,range:far}:v;}
 // Eye-to-body rays (head, chest, hips) inside the view cone; visibility is the fraction that reach.
 perceive(p:PlayerView,boxes:Aabb[],rules:Rules){const v=this.vision(rules),pv=rules.vision.peripheral,dx=p.x-this.pos.x,dz=p.z-this.pos.z,d=Math.hypot(dx,dz);this.distance=d;
  const off=Math.abs(wrap(Math.atan2(dx,dz)-this.heading))*180/Math.PI,dy=Math.abs(p.y-this.pos.y);this.off=off;
  const inCone=dy<2.6&&(d<=v.range&&off<=v.half||d<=pv.range&&off<=pv.half||d<=rules.vision.touch);
  if(!inCone){this.visibility=0;return;}const eye={x:this.pos.x,y:this.pos.y+rules.vision.eye,z:this.pos.z};let n=0;
  for(const h of p.crouched?[1.05,.78,.5]:[1.55,1.15,.82])if(segmentClear(boxes,eye,{x:p.x,y:p.y+h,z:p.z}))n++;this.visibility=n/3;if(n&&(!['alert','search'].includes(this.state)||this.recognizes(p)))this.lastSeen={x:p.x,y:p.y,z:p.z};}
 think(dt:number,p:PlayerView,base:number,crowd:number,rules:Rules):AiEvent['type'][]{const out:AiEvent['type'][]=[],t=rules.thresholds,seen=this.visibility>0&&(!['alert','search'].includes(this.state)||this.recognizes(p)||base>=rules.rates.deny);
  const go=(s:State,goal:Position|null,timer:number)=>{this.state=s;this.goal=goal&&{...goal};this.arrived=false;this.timer=timer;};
  if(this.state==='combat'||this.state==='flee')return out;
  if(this.evidenceGoal&&base<=0&&this.state==='investigate'){this.goal={...this.evidenceGoal};if(this.arrived&&(this.timer-=dt)<=0){this.evidenceGoal=null;this.state='patrol';this.suspicion=0;out.push('calm');}return out;}
  if(this.state==='alert'||this.state==='search'){
   if(seen){this.suspicion=100;this.loseT=0;if(this.state==='search'){this.state='alert';out.push('alert');}}
   else if(this.state==='alert'){this.loseT+=dt;if(this.loseT>rules.timers.lose){go('search',this.lastSeen,rules.timers.search);out.push('search');}}
   else if(this.arrived&&(this.timer-=dt)<=0){this.suspicion=t.investigate-1;this.state='patrol';out.push('calm');}
   return out;}
  if(this.state==='report'){if(this.witness)return out;if((this.timer-=dt)<=0){this.suspicion=t.investigate-1;this.state='patrol';}return out;}
  this.suspicion=clamp(this.suspicion+suspicionRate(rules,base,{distance:this.distance,visibility:this.visibility,still:p.speed<.15,crowd,sensitivity:this.vision(rules).sensitivity})*dt,0,100);
  // A compromised outfit is recognised by everyone on sight.
  if(this.visibility>0&&this.knownDisguises.has(p.disguise))this.suspicion=100;
  if(this.suspicion>=t.alert){this.knownDisguises.add(p.disguise);if(this.guard){go('alert',this.lastSeen,0);this.loseT=0;out.push('alert');}else{go('report',null,rules.timers.report);out.push('report');}return out;}
  if(this.state==='verify')return out;
  if(this.state==='distracted'){if(this.suspicion>=t.investigate&&this.guard){go('investigate',this.lastSeen,rules.timers.lookAround);out.push('investigate');}else if(this.arrived&&(this.timer-=dt)<=0){this.state='patrol';out.push('calm');}return out;}
  if(this.state==='investigate'){
   if(seen&&this.suspicion>=t.investigate&&this.lastSeen){this.goal={...this.lastSeen};this.arrived=false;this.timer=rules.timers.lookAround;}
   if(this.suspicion<t.curious&&!seen){this.state='patrol';out.push('calm');}
   else if(this.arrived&&(this.timer-=dt)<=0){if(this.suspicion>=t.curious){this.state='curious';this.timer=rules.timers.curiousHold;}else{this.state='patrol';out.push('calm');}}
   return out;}
  if(this.guard&&this.suspicion>=t.investigate&&this.lastSeen){go('investigate',this.lastSeen,rules.timers.lookAround);out.push('investigate');}
  else if(this.suspicion>=t.curious){if(this.state!=='curious'){this.state='curious';this.timer=rules.timers.curiousHold;if(!this.noticed)out.push('curious');this.noticed=true;}else this.timer-=dt;}
  else if(this.state==='curious'){if((this.timer-=dt)<=0){this.state='patrol';this.noticed=false;out.push('calm');}}
  else if(this.suspicion<=0)this.noticed=false;
  return out;}
 // The white gauge of a face-knower: separate from suspicion, it fills only up close, in front and at their post.
 watchFace(dt:number,p:PlayerView,crowd:number,rules:Rules,zones:Zone[]):AiEvent['type'][]{const f=rules.m4?.enforcerSpeed,out:AiEvent['type'][]=[];if(!f)return out;
  const relevant=!this.scriptedImmune&&this.knowsFace(p.disguise)&&!this.knownDisguises.has(p.disguise)&&['patrol','curious','distracted','verify'].includes(this.state);
  const d=this.distance,front=relevant&&this.visibility>0&&d<=f.range&&this.off<=f.front&&(this.state==='verify'||this.atPost(zones,f.postMargin));
  // In a crowd the face is lost unless they are right next to the agent.
  const hidden=(crowd>=rules.multipliers.crowdCount||!!p.blending)&&d>f.crowdRange;
  if(front&&!hidden)this.face=Math.min(1,this.face+dt/enforcerSeconds(f,d)*(p.running||p.illegal?f.boost:1));else this.face=Math.max(0,this.face-f.decay*dt);
  if(!relevant){if(this.state==='verify'){this.state='patrol';out.push('calm');}return out;}
  if(this.face>=1){this.face=0;out.push('compromised');return out;}
  if(this.state!=='verify'&&this.face>=f.verify){this.state='verify';this.arrived=false;this.goal=this.lastSeen&&{...this.lastSeen};out.push('verify');}
  else if(this.state==='verify'&&this.face<=0){this.state='patrol';out.push('calm');}
  return out;}
 // A sound (thrown coin) pulls one idle NPC over to look.
 hear(point:Position,rules:Rules){if(this.state!=='patrol'&&this.state!=='curious'&&this.state!=='distracted')return false;this.state='distracted';this.goal={...point};this.arrived=false;this.timer=rules.timers.noiseLook;return true;}
 // A colleague's radio call or a guest's report sends a guard to look at the spot.
 radio(point:Position,rules:Rules){if(!this.guard||this.state==='alert'||this.state==='search')return;this.evidenceGoal=null;this.suspicion=Math.max(this.suspicion,75);this.state='investigate';this.goal={...point};this.arrived=false;this.timer=rules.timers.lookAround;}
 move(dt:number,world:CollisionWorld,nav:NavGrid,rules:Rules,p:PlayerView){const sp=rules.speeds;let want:Position|null=null,speed=sp.walk,face:number|null=null;
  const toward=(q:{x:number;z:number})=>Math.atan2(q.x-this.pos.x,q.z-this.pos.z);
  switch(this.state){
   case 'patrol':{if(this.scheduled){want=this.scheduleTarget;face=this.scheduleHeading;speed=this.scheduleSpeed;break;}const r=this.route[this.routeIndex],at={x:r[0],y:this.pos.y,z:r[1]};
    if(this.route.length===1){if(flat(this.pos,at)>.3)want=at;else face=this.look?toward({x:this.look[0],z:this.look[1]}):null;break;}
    if(this.wait>0){this.wait-=dt;if(r[3]!==undefined)face=r[3]*Math.PI/180;if(this.wait<=0)this.routeIndex=(this.routeIndex+1)%this.route.length;break;}
    if(flat(this.pos,at)<.3){this.wait=r[2]||.01;break;}want=at;break;}
   case 'curious':if(this.lastSeen)face=toward(this.lastSeen);break;
   // A witness runs to the nearest guard (goal kept current by the detection system); others just stare.
   case 'report':if(this.witness&&this.goal){want=this.goal;speed=sp.chase;}else if(this.lastSeen)face=toward(this.lastSeen);break;
   // "I don't know your face": walk up to the agent and stop at arm's length.
   case 'verify':speed=sp.investigate;if(this.lastSeen){if(flat(this.pos,this.lastSeen)>(rules.m4?.enforcerSpeed?.verifyStop??1.4))want=this.lastSeen;else face=toward(this.lastSeen);}break;
   case 'alert':want=this.visibility>0?{x:p.x,y:p.y,z:p.z}:this.lastSeen;speed=sp.chase;break;
   // In a gunfight: run to the chosen spot (cover, or closer), and keep facing the agent.
   case 'combat':speed=sp.chase;if(this.combatGoal&&flat(this.pos,this.combatGoal)>.4)want=this.combatGoal;else if(this.lastSeen)face=toward(this.lastSeen);break;
   case 'flee':speed=sp.chase*1.1;if(this.goal&&!this.arrived){want=this.goal;if(flat(this.pos,this.goal)<.6)this.arrived=true;}break;
   default:speed=this.state==='search'?sp.search:sp.investigate;if(this.goal&&!this.arrived){want=this.goal;if(flat(this.pos,this.goal)<.6){this.arrived=true;this.scanBase=this.heading;this.scanT=0;}}
  }
  // After arriving, sweep the head side to side to look around.
  if(this.arrived&&this.state!=='patrol'&&this.state!=='alert'&&this.state!=='flee'&&this.state!=='combat'&&!want){this.scanT+=dt;face=this.scanBase+Math.sin(this.scanT*1.7)*1.1;}
  if(this.state==='alert'&&want&&flat(this.pos,want)<.5)want=null;
  if(want){const moved=this.travel(dt,world,nav,want,speed);if(moved<.002*dt*60){this.stuck+=dt;if(this.stuck>1.2){this.path=[];this.pathGoal=null;this.stuck=0;if(this.state==='patrol')this.wait=.5;else this.arrived=true;}}else this.stuck=0;}
  else{this.speed=Math.max(0,this.speed-6*dt);this.path=[];this.pathGoal=null;}
  if(face!==null)this.turn(face,dt,4);}
 private turn(target:number,dt:number,rate:number){const d=wrap(target-this.heading);this.heading=wrap(this.heading+clamp(d,-rate*dt,rate*dt));}
 private travel(dt:number,world:CollisionWorld,nav:NavGrid,target:Position,speed:number){this.repath-=dt;
  if(!this.pathGoal||flat(this.pathGoal,target)>.6||Math.abs(this.pathGoal.y-target.y)>.3||(this.state==='alert'&&this.repath<=0)){const found=nav.findSoon(this.pos,target);if(found===undefined){this.stuck=0;return 1;}this.path=found??[];this.pathGoal={...target};this.repath=.4;}
  while(this.path.length>1&&Math.hypot(this.pos.x-this.path[0].x,this.pos.y-this.path[0].y,this.pos.z-this.path[0].z)<.1&&nav.clear(this.pos,this.path[1]))this.path.shift();const next=this.path[0];if(!next)return 0;
  const dx=next.x-this.pos.x,dz=next.z-this.pos.z,d=Math.hypot(dx,dz),left=Math.hypot(this.pos.x-target.x,this.pos.y-target.y,this.pos.z-target.z);
  // Ease into a stop so the gait settles instead of snapping.
  const want=Math.min(speed,left*2.2+.25);this.speed+=clamp(want-this.speed,-6*dt,(this.state==='alert'?9:4)*dt);if(d<1e-4)return 0;
  const step=Math.min(this.speed*dt,d),q=world.move(this.pos,dx/d*step,dz/d*step),moved=flat(q,this.pos);this.pos=q;this.turn(Math.atan2(dx,dz),dt,this.state==='alert'?9:5);return moved;}
}

export class Director{
 readonly npcs:Npc[];frame=0;caught=false;alerts=0;reports=0;
 // Someone recognised the agent as an intruder (alerted on them, ran to report them, or saw them do something).
 onSpotted?:(n:Npc)=>void;
 // Outfits that are blown for everyone (seen being identified, changed into in view, or in a fight).
 readonly compromised=new Set<string>();
 readonly mission:Mission;readonly world:CollisionWorld;readonly nav:NavGrid;readonly boxes:Aabb[];readonly rules:Rules;
 constructor(mission:Mission,world:CollisionWorld,nav:NavGrid,boxes:Aabb[],rules:Rules){this.mission=mission;this.world=world;this.nav=nav;this.boxes=boxes;this.rules=rules;this.npcs=mission.npcs.map(d=>new Npc(d,mission,this.compromised));}
 crowdAt(x:number,z:number){return this.npcs.filter(n=>n.active&&!n.guard&&Math.hypot(n.pos.x-x,n.pos.z-z)<=this.rules.multipliers.crowdRadius).length;}
 zone(p:PlayerView){return zoneAt(this.mission.zones,p.x,p.z,p.floor);}
 step(dt:number,p:PlayerView){this.nav.frame(this.lod.planMs??4);const events:AiEvent[]=[],zone=this.zone(p),perm=permission(this.rules,p.disguise,zone),base=baseRate(this.rules,p,p.restricted?'deny':perm,zone?.type),crowd=this.crowdAt(p.x,p.z);this.frame++;
  // Perception is tiered by distance and staggered so the NPCs do not all cast rays on the same step.
  this.npcs.forEach((n,i)=>{if(!n.active||n.busy)return;n.tier=this.tier(n,p);n.outdoor=this.outdoorAt(n.pos);const every=n.tier==='mid'?this.lod.midEvery:this.lod.nearEvery;
   if(n.tier==='far'){n.visibility=0;n.distance=flat(n.pos,p);}else if((this.frame+i)%every===0)n.perceive(p,this.boxes,this.rules);});
  for(const n of this.npcs)if(n.active&&!n.busy&&n.knowsFaces.length)for(const type of n.watchFace(dt,p,crowd,this.rules,this.mission.zones)){if(type==='compromised')this.accuse(n,p);events.push({type,npc:n});}
  for(const n of this.npcs)if(n.active&&!n.busy)for(const type of n.think(dt,p,base,crowd,this.rules))events.push({type,npc:n});
  for(const e of events){const at=e.npc.lastSeen;if(!at)continue;
   if(e.type==='alert'||e.type==='report')this.onSpotted?.(e.npc);
   if(e.type==='alert'){this.alerts++;for(const g of this.npcs)if(g.active&&!g.busy&&g!==e.npc&&flat(g.pos,e.npc.pos)<=this.rules.radio)g.radio(at,this.rules);}
   // A bystander who noticed a gun on the back runs to tell a guard instead (combat.ts makes them a witness).
   if(e.type==='report'&&!p.weaponShown){this.reports++;const g=this.npcs.filter(n=>n.active&&!n.busy&&n.guard&&n.state!=='alert').sort((a,b)=>flat(a.pos,at)-flat(b.pos,at))[0];g?.radio(at,this.rules);}}
  for(const n of this.npcs)if(n.active&&!n.busy)n.move(dt,this.world,this.nav,this.rules,p);
  // Keep bodies from overlapping one another.
  for(let i=0;i<this.npcs.length;i++)for(let j=i+1;j<this.npcs.length;j++){const a=this.npcs[i],b=this.npcs[j];if(!a.active||!b.active||a.busy||b.busy)continue;const dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z;if(Math.abs(dx)>=.55||Math.abs(dz)>=.55||Math.abs(a.pos.y-b.pos.y)>=1)continue;const d=Math.hypot(dx,dz);if(d>1e-3&&d<.55){const push=(.55-d)/2;a.pos=this.world.move(a.pos,-dx/d*push,-dz/d*push);b.pos=this.world.move(b.pos,dx/d*push,dz/d*push);}}
  if(!this.caught)for(const n of this.npcs)if(n.active&&!n.busy&&n.guard&&n.state==='alert'&&!p.weaponShown&&n.visibility>0&&(n.recognizes(p)||base>=this.rules.rates.deny)&&flat(n.pos,p)<this.rules.catch&&Math.abs(n.pos.y-p.y)<1){this.caught=true;events.push({type:'caught',npc:n});break;}
  return events;}

 // Reinforcements arrive during the mission; they join the same shared state (compromised outfits) as everyone else.
 addNpc(def:NpcDef){const n=new Npc(def,this.mission,this.compromised);this.npcs.push(n);return n;}
 outdoorAt(q:Position){const f=floorOf(q.y);return !(this.mission.rooms??[]).some(r=>r.indoor&&r.floor===f&&inside(r,q.x,q.z));}
 get lod():Lod{return this.rules.lod??{near:25,far:60,nearEvery:6,midEvery:30};}
 // near: full 10 Hz perception; mid: 2 Hz; far (or another floor): perception stops and the NPC only keeps walking its route.
 tier(n:Npc,p:PlayerView):Tier{if(n.priority)return 'near';const d=flat(n.pos,p);if(d>=this.lod.far||Math.abs(n.pos.y-p.y)>2.6)return 'far';return d>this.lod.near?'mid':'near';}
 // A direct witness identifies the current outfit; anonymous evidence does not.
 accuse(n:Npc,p:PlayerView){n.evidenceGoal=null;n.knownDisguises.add(p.disguise);n.lastSeen={x:p.x,y:p.y,z:p.z};n.suspicion=100;n.loseT=0;n.state=n.guard?'alert':'report';n.timer=this.rules.timers.report;
  if(n.guard)this.alerts++;else{this.reports++;n.witness={what:'act',at:{x:p.x,y:p.y,z:p.z},key:'act:'+n.id};}this.onSpotted?.(n);
  // A guard's radio reaches colleagues at once; a bystander's word only arrives when they reach a guard (M5.6).
  if(n.guard)for(const g of this.npcs)if(g.active&&!g.busy&&g.guard&&g!==n&&flat(g.pos,n.pos)<this.rules.radio){g.radio(p,this.rules);g.evidenceGoal=null;g.knownDisguises.add(p.disguise);g.lastSeen={x:p.x,y:p.y,z:p.z};g.suspicion=100;g.state='search';g.goal={...g.lastSeen};g.arrived=false;g.timer=this.rules.timers.search;}}
 // The nearest NPC that can hear the coin walks over; only one answers.
 noise(point:Position){const n=this.npcs.filter(n=>n.active&&!n.busy&&Math.abs(n.pos.y-point.y)<1.5&&flat(n.pos,point)<=this.rules.noise.coin).sort((a,b)=>flat(a.pos,point)-flat(b.pos,point)).find(n=>n.hear(point,this.rules));return n;}
 hottest(){return this.npcs.filter(n=>n.active).reduce<Npc|undefined>((m,n)=>!m||n.suspicion>m.suspicion?n:m,undefined);}
}

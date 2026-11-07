// B1 investigation only: run from app with node --experimental-strip-types ../investigation/b1-collateral.ts.
// Uses the real systems; never clears the crowd or changes the game source/data.
// `evidence --baseline`: controlled original-data matrix; omit --baseline for current data.
// `walk --baseline`: exploratory real walk/KO/outfit attempt (witnessed; NOT a ghost test).
// `baseline --baseline`: uninterrupted original crowd positions, no knockouts.
// collateralCase(count,at) is exported for a deterministic causal regression.
// --baseline requires investigation/playtest-baseline-src, saved by the parent task.
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
// Run from outputs/m5-prototype/app:  node --experimental-strip-types ../investigation/ghost-sim.ts > ../investigation/ghost-sim.json
const APP=new URL(process.argv.includes('--baseline')?'./playtest-baseline-src/':'../app/src/',import.meta.url).href;
const {Director}=await import(APP+'ai.ts');const {CollisionWorld,floorOf}=await import(APP+'world.ts');const {NavGrid}=await import(APP+'nav.ts');const {sightBoxes}=await import(APP+'sight.ts');
const {MissionEvents}=await import(APP+'events.ts');const {MissionClock,ScheduleSystem}=await import(APP+'schedule.ts');const {M3System}=await import(APP+'m3.ts');const {M4System}=await import(APP+'m4.ts');
const {M53System}=await import(APP+'m53.ts');const {M57System}=await import(APP+'m57.ts');const {CombatSystem}=await import(APP+'combat.ts');const {MissionFlow}=await import(APP+'mission.ts');
const {ScoreLedger,computeResult}=await import(APP+'score.ts');const {DetectionSystem}=await import(APP+'detection.ts');
const json=(n:string)=>JSON.parse(readFileSync(new URL(APP+`data/${n}.json`),'utf8'));
const hotel=json('hotel'),rules=json('rules'),chances=json('chances'),plans=json('schedule'),mission=json('mission'),scoring=json('scoring'),det=json('detection');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel),map=hotel.m57;
type P={x:number;y:number;z:number;floor:number;speed:number;running:boolean;crouched:boolean;tampering:boolean;disguise:string};
const view=(p:{x:number;y:number;z:number},disguise:string):P=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise});
export function game(){
 const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),e=new MissionEvents(),c=new MissionClock(rules.schedule,e),schedule=new ScheduleSystem(plans,hotel.schedulePlaces,d,c,e),
  m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),f=new M53System(d,m3,m4,c,e,rules.m53,hotel.m53,hotel.cameras,chances),g=new M57System(d,m3,m4,f,c,e,map,hotel.cameras),
  combat=new CombatSystem(d,e,m3.hotel,json('combat'),json('weapons'),hotel.reinforcements,()=>.5),flow=new MissionFlow(mission.targets,d,e),detection=new DetectionSystem(d,e,m3.hotel,hotel.cameras,det,hotel),
  ledger=new ScoreLedger(e,(id:string)=>{const n=d.npcs.find((n:any)=>n.id===id);return n&&{role:n.role,target:n.target};});
 const spottedBy:string[]=[],found:string[]=[];
 d.onSpotted=(n:any)=>{spottedBy.push(n.id);e.emit({type:'player.spotted',time:c.elapsed,id:n.id});};
 m3.onFound=(b:any)=>{found.push(b.id+':'+b.deathKind);e.emit({type:'body.found',time:c.elapsed,id:b.id,life:b.life==='dead'?'dead':'unconscious',judgement:b.deathKind});};
 f.bindDetection(detection);f.illegal=()=>combat.illegalIn(m4.disguise);let hand='';g.held_item=()=>hand;g.illegal=f.illegal;
 const S:any={d,e,c,schedule,m3,m4,f,g,combat,flow,detection,ledger,spottedBy,found,p:view({x:1000,y:0,z:1000},'suit'),heading:0,give:(x:string)=>{hand=x;detection.held=x;}};
 S.tick=(keys:Set<string>=new Set())=>{const p={...S.p,tampering:f.tampering||g.tampering,blending:!!detection.blend||g.inCar,illegal:combat.illegalIn(m4.disguise),weaponDrawn:!!combat.hand,illegalVisibleCarry:combat.shown(m4.disguise),suspiciousItem:detection.suspiciousHeld(m4.disguise)};c.step(.1);schedule.sync(.1);d.step(.1,p);f.step(.1,p,S.heading,keys);g.step(.1,p,keys);m3.step(.1,p,S.heading,keys);combat.step(.1,p,c.elapsed);
  detection.step(.1,p,{illegal:combat.illegalIn(m4.disguise)||!!m3.action||f.tampering||g.tampering,carrying:!!m3.dragged,trespass:false},c.elapsed,false,keys.has('KeyE'));schedule.sync(0);f.afterAi(p);m3.discover();flow.update(c.elapsed);};
 S.at=(pt:{x:number;y:number;z:number})=>{S.p=view(pt,m4.disguise);};
 S.dress=(x:string)=>{m4.disguise=x;S.p={...S.p,disguise:x};e.emit({type:'disguise.changed',time:c.elapsed,id:x});};
 S.hold=(key:string,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*10)+2;i++)S.tick(new Set([key]));S.tick();};
 S.until=(ok:()=>boolean,seconds:number,stay?:()=>void)=>{for(let i=0;i<seconds*10&&!ok();i++){stay?.();S.tick();}return ok();};
 S.npc=(id:string)=>d.npcs.find((n:any)=>n.id===id);
 S.hear=(id:string)=>e.emit({type:'dialogue.heard',time:c.elapsed,id});
 S.beside=(id:string)=>{const n=S.npc(id);S.p=view({x:n.pos.x+Math.sin(n.heading),y:n.pos.y,z:n.pos.z+Math.cos(n.heading)},m4.disguise);};
 S.behind=(id:string)=>{const n=S.npc(id);S.p=view({x:n.pos.x-Math.sin(n.heading)*.8,y:n.pos.y,z:n.pos.z-Math.cos(n.heading)*.8},m4.disguise);S.heading=n.heading;};
 S.away=()=>{S.p=view({x:1000,y:0,z:1000},m4.disguise);};
 S.reach=(id:string,doing:string,seconds:number)=>S.until(()=>{const n=S.npc(id);return n.scheduleAction===doing&&!n.scheduleTarget&&n.state==='patrol';},seconds,S.away);
 return S;}

const act=(id:string)=>map.acts[id].at;
const round=(v:number)=>+v.toFixed(5);
function setup(){const S=game();S.p={...S.p,x:14.8,y:0,z:-30};const tick=S.tick;S.tick=(keys=new Set<string>())=>{tick(keys);S.m4.step(.1,S.p,S.heading,keys);S.p.disguise=S.m4.disguise;};return S;}
function walk(S:any,goal:any){const path=S.d.nav.find(S.p,goal);if(!path)throw new Error('no path '+JSON.stringify(goal));for(const point of path){let guard=0;while(Math.hypot(S.p.x-point.x,S.p.z-point.z)>.07||Math.abs(S.p.y-point.y)>.2){if(++guard>1200)throw new Error('stuck '+JSON.stringify(point));const dx=point.x-S.p.x,dz=point.z-S.p.z,len=Math.hypot(dx,dz),dist=Math.min(2.6*.1,len);S.heading=Math.atan2(dx,dz);S.p={...S.p,...S.d.world.move(S.p,dx/len*dist,dz/len*dist),speed:2.6};S.p.floor=floorOf(S.p.y);S.tick();}}S.p.speed=0;}
const trace=(S:any)=>{const a=S.g.map.areas.chandelier;return Object.fromEntries(['lawyer','bodyguard_1','bodyguard_captain','bodyguard_2'].map(id=>{const n=S.npc(id);return [id,{pos:n.pos,state:n.state,action:n.scheduleAction,distance:round(Math.hypot(n.pos.x-a.x,n.pos.z-a.z)),evidence:n.evidenceGoal,target:n.scheduleTarget}]}));};
const wait=(S:any,t:number)=>{while(S.c.time<t-.05)S.tick();};
const mode=process.argv[1]===fileURLToPath(import.meta.url)?process.argv[2]??'evidence':'import';
if(mode==='walk'){
for(const at of [360.3,428.3]){const S=setup(),events:any[]=[];S.e.on((e:any)=>{if(['body.found','trap.fired','disguise.changed'].includes(e.type))events.push(e);});
 const guard=S.npc('guard_check_lobby'),behind={x:guard.pos.x-Math.sin(guard.heading)*.8,y:guard.pos.y,z:guard.pos.z-Math.cos(guard.heading)*.8};walk(S,behind);for(let i=0;i<4;i++){const b={x:guard.pos.x-Math.sin(guard.heading)*.8,y:guard.pos.y,z:guard.pos.z-Math.cos(guard.heading)*.8};walk(S,b);}S.heading=guard.heading;S.hold('KeyF',S.m3.rules.koSeconds+.3);S.hold('KeyT',S.m4.rules.changeSeconds+.3);
 const acquired={time:round(S.c.time),life:guard.life,outfit:S.m4.disguise};
 walk(S,act('chandelier_clamp'));S.give('wrench');S.hold('KeyE',4.3);wait(S,at-1.1);const before=trace(S);S.hold('KeyE',1.1);
 console.log(JSON.stringify({mode,at,acquired,events,before,dead:S.d.npcs.filter((n:any)=>n.life==='dead').map((n:any)=>n.id+':'+n.deathKind),found:S.found,alert:S.m3.hotel.level,spotted:S.spottedBy},null,1));}}
if(mode==='baseline')for(const at of [360.3,428.3]){const S=setup();wait(S,at);console.log(JSON.stringify({mode,at,before:trace(S)}));}

// Controlled evidence-location diagnostics. These seed unconscious NPCs in place
// and call fire directly; they test AI/area causality, not outfit acquisition.
export function collateralCase(count=2,at=428.3){const S=setup(),events:any[]=[],entries:any[]=[];S.e.on((e:any)=>{if(e.type==='body.found')events.push(e);});let inside=false;
 while(S.c.time<at-.05){for(const [i,id] of ['guard_check_lobby','guard_check_marina','harbor_master'].entries())if((count===2?i>0:i<count)&&S.c.time>=[60,270,290][i]&&S.npc(id).life==='active'){Object.assign(S.npc(id),{life:'unconscious',bodyMode:'ground',fall:1,speed:0,state:'patrol',goal:null,evidenceGoal:null});}S.tick();const b=S.npc('bodyguard_1'),a=S.g.map.areas.chandelier,now=Math.abs(b.pos.y-a.y)<1.5&&Math.hypot(b.pos.x-a.x,b.pos.z-a.z)<=a.r;if(now&&!inside)entries.push({time:round(S.c.time),b:{...b.pos},state:b.state,action:b.scheduleAction,neighbors:S.d.npcs.filter((n:any)=>n!==b&&n.active&&Math.abs(n.pos.y-b.pos.y)<1&&Math.hypot(n.pos.x-b.pos.x,n.pos.z-b.pos.z)<.65).map((n:any)=>n.id)});inside=now;}
 const before=trace(S);S.g.fire('chandelier',S.p,false);return {count,at,events,entries,before,dead:S.d.npcs.filter((n:any)=>n.life==='dead').map((n:any)=>n.id+':'+n.deathKind),alert:S.m3.hotel.level};}
if(mode==='evidence')for(const count of [0,1,2,3])for(const at of [360.3,428.3])console.log(JSON.stringify(collateralCase(count,at)));

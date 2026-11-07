// Walking chance simulations: keep the crowd, acquire clothes in game and retain bodies until hidden.
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
// Run from app: node --experimental-strip-types ../investigation/ghost-sim.ts (writes ghost-sim.walk.json).
const APP=new URL('../app/src/',import.meta.url).href;
const {Director,permission,zoneAt}=await import(APP+'ai.ts');const {CollisionWorld,floorOf}=await import(APP+'world.ts');const {NavGrid}=await import(APP+'nav.ts');const {sightBoxes}=await import(APP+'sight.ts');
const {MissionEvents}=await import(APP+'events.ts');const {MissionClock,ScheduleSystem}=await import(APP+'schedule.ts');const {M3System}=await import(APP+'m3.ts');const {M4System}=await import(APP+'m4.ts');
const {M53System}=await import(APP+'m53.ts');const {M57System}=await import(APP+'m57.ts');const {CombatSystem}=await import(APP+'combat.ts');const {MissionFlow}=await import(APP+'mission.ts');
const {ScoreLedger,computeResult}=await import(APP+'score.ts');const {DetectionSystem}=await import(APP+'detection.ts');
const json=(n:string)=>JSON.parse(readFileSync(new URL(APP+`data/${n}.json`),'utf8'));
const hotel=json('hotel'),rules=json('rules'),chances=json('chances'),plans=json('schedule'),mission=json('mission'),scoring=json('scoring'),det=json('detection');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel),map=hotel.m57;
const sim=JSON.parse(readFileSync(new URL('./ghost-walk.routes.json',import.meta.url),'utf8')).simulation,DT=sim.step;
type P={x:number;y:number;z:number;floor:number;speed:number;running:boolean;crouched:boolean;tampering:boolean;disguise:string};
const view=(p:{x:number;y:number;z:number},disguise:string):P=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise});
export function game(options:{poison?:boolean}={}){
 const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),e=new MissionEvents(),c=new MissionClock(rules.schedule,e),schedule=new ScheduleSystem(plans,hotel.schedulePlaces,d,c,e),
  m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4,hotel.hides),f=new M53System(d,m3,m4,c,e,rules.m53,hotel.m53,hotel.cameras,chances),g=new M57System(d,m3,m4,f,c,e,map,hotel.cameras),
  combat=new CombatSystem(d,e,m3.hotel,json('combat'),json('weapons'),hotel.reinforcements,()=>.5),flow=new MissionFlow(mission.targets,d,e),detection=new DetectionSystem(d,e,m3.hotel,hotel.cameras,det,hotel),
  ledger=new ScoreLedger(e,(id:string)=>{const n=d.npcs.find((n:any)=>n.id===id);return n&&{role:n.role,target:n.target};});
 if(options.poison===false)f.poison=0;
 const spottedBy:string[]=[],found:string[]=[],procedureEvents:any[]=[];e.on((event:any)=>{if(['trap.fired','disguise.changed','body.found','flag.set','npc.killed','witness.started','target.escaped'].includes(event.type))procedureEvents.push({...event});});
 d.onSpotted=(n:any)=>{spottedBy.push(n.id);e.emit({type:'player.spotted',time:c.elapsed,id:n.id});};
 m3.onFound=(b:any)=>{found.push(b.id+':'+b.deathKind);e.emit({type:'body.found',time:c.elapsed,id:b.id,life:b.life==='dead'?'dead':'unconscious',judgement:b.deathKind});};
 f.bindDetection(detection);f.illegal=()=>combat.illegalIn(m4.disguise);g.held_item=()=>detection.held;g.illegal=f.illegal;
 const S:any={d,e,c,schedule,m3,m4,f,g,combat,flow,detection,ledger,spottedBy,found,procedureEvents,p:view({x:hotel.spawn.x,y:0,z:hotel.spawn.z},'suit'),heading:0};
 S.tick=(keys:Set<string>=new Set())=>{if(flow.outcome)return;
  const player=()=>({...S.p,disguise:m4.disguise,tampering:f.tampering||g.tampering,restricted:f.isRestricted(S.p),blending:!!detection.blend||g.inCar,illegal:combat.illegalIn(m4.disguise),weaponDrawn:!!combat.hand,illegalVisibleCarry:combat.shown(m4.disguise),suspiciousItem:detection.suspiciousHeld(m4.disguise)});
  const e53=f.step(DT,player(),S.heading,keys,m3.locked||m4.locked||!!m3.dragged),e57=g.step(DT,player(),keys,m3.locked||m4.locked||!!m3.dragged||f.locked);
  m3.step(DT,player(),S.heading,e53||e57?new Set([...keys].filter(k=>k!=='KeyE')):keys,m4.locked||f.locked);
  m4.step(DT,player(),S.heading,keys,!!m3.action||!!m3.dragged||f.locked);
  for(const n of d.npcs){if(!n.active||n.busy)continue;const dx=S.p.x-n.pos.x,dz=S.p.z-n.pos.z,len=Math.hypot(dx,dz);if(len>0&&len<sim.bodySeparation&&Math.abs(S.p.y-n.pos.y)<sim.floorSeparation){const q=world.move(S.p,dx/len*(sim.bodySeparation-len),dz/len*(sim.bodySeparation-len),S.p.crouched?sim.crouchHeight:sim.standingHeight);S.p={...S.p,...q};}}
  S.p.disguise=m4.disguise;c.step(DT);schedule.sync(DT);const aiEvents=d.step(DT,player());schedule.sync(0);g.afterAi();f.afterAi(player());
  if(aiEvents.some((e:any)=>e.type==='caught')){flow.fail('caught',c.elapsed);return;}
  combat.step(DT,player(),c.elapsed);const p=player();detection.step(DT,p,{illegal:combat.illegalIn(m4.disguise)||!!m3.action||f.tampering||g.tampering,carrying:!!m3.dragged,trespass:permission(d.rules,m4.disguise,zoneAt(d.mission.zones,p.x,p.z,p.floor))==='deny'},c.elapsed,S.p.speed>0,keys.has('KeyE'));
  if(combat.dead)flow.fail('killed',c.elapsed);if(g.escaped.size)flow.fail('target_escaped',c.elapsed);flow.update(c.elapsed);};
 S.hold=(key:string,seconds:number)=>{for(let i=0;i<Math.ceil(seconds/DT)+sim.holdPaddingSteps;i++)S.tick(new Set([key]));S.tick();};
 S.until=(ok:()=>boolean,seconds:number,stay?:()=>void)=>{for(let i=0;i<Math.ceil(seconds/DT)&&!ok();i++){stay?.();S.tick();}return ok();};
 S.npc=(id:string)=>d.npcs.find((n:any)=>n.id===id);
 S.hear=(id:string)=>e.emit({type:'dialogue.heard',time:c.elapsed,id});
 return S;}
export const act=(id:string)=>map.acts[id].at;
export {hotel,rules,scoring,world,nav};
export {walkScenarios as scenarios,simulateWalk as simulate} from './ghost-walk.ts';
import {walkScenarios,simulateWalk} from './ghost-walk.ts';
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const results=walkScenarios.map(simulateWalk);
 const {writeFileSync}=await import('node:fs');writeFileSync(new URL('./ghost-sim.walk.json',import.meta.url),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,1));
}

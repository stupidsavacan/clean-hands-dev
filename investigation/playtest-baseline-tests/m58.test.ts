import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {MissionClock,ScheduleSystem}from '../src/schedule.ts';import {M3System}from '../src/m3.ts';import {M4System}from '../src/m4.ts';import {M53System}from '../src/m53.ts';
import {M57System,type M57Map}from '../src/m57.ts';import {CombatSystem,type CombatRules,type WeaponDef}from '../src/combat.ts';import {MissionFlow}from '../src/mission.ts';import {ScoreLedger,computeResult}from '../src/score.ts';
// M5.8 play-through on the real systems: the three targets by three different methods in one mission, then an exit.
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),chances=json('chances'),plans=json('schedule'),mission=json('mission'),scoring=json('scoring');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),map=hotel.m57 as M57Map;
const view=(p:{x:number;y:number;z:number},disguise:string):PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise});

test('M5.8 one mission, three methods: the poisoned barrel (A2), the loose balcony rail (C1) and the driver\'s seat (B4), then out by an exit',()=>{
 const d=new Director(hotel,world,nav,sightBoxes(hotel),structuredClone(rules)),e=new MissionEvents(),c=new MissionClock(rules.schedule,e),schedule=new ScheduleSystem(plans,hotel.schedulePlaces,d,c,e),
  m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),f=new M53System(d,m3,m4,c,e,rules.m53,hotel.m53,hotel.cameras,chances),g=new M57System(d,m3,m4,f,c,e,map,hotel.cameras);
 const flow=new MissionFlow(mission.targets,d,e),ledger=new ScoreLedger(e,id=>{const n=d.npcs.find(n=>n.id===id);return n&&{role:n.role,target:n.target};});
 d.onSpotted=n=>e.emit({type:'player.spotted',time:c.elapsed,id:n.id});m3.onFound=b=>e.emit({type:'body.found',time:c.elapsed,id:b.id,life:b.life==='dead'?'dead':'unconscious',judgement:b.deathKind});
 let p=view({x:-60,y:0,z:-35},'suit');const keys=new Set<string>();
 const tick=(dt=.1)=>{c.step(dt);schedule.sync(dt);d.step(dt,p);f.step(dt,p,0,keys);g.step(dt,p,keys);schedule.sync(0);f.afterAi(p);m3.discover();flow.update(c.elapsed);};
 const hold=(at:PlayerView,seconds:number)=>{p=at;keys.add('KeyE');for(let i=0;i<Math.ceil(seconds*10)+2;i++)tick();keys.delete('KeyE');tick();};
 const dress=(x:string)=>{m4.disguise=x;p={...p,disguise:x};};
 for(const id of ['loading_limited_wine','penthouse_phone_hint','parking_phone'])e.emit({type:'dialogue.heard',time:0,id});
 // A2: staff clothes in the cellar, poison into the limited wine.
 dress('waiter');hold(view(hotel.m53.barrel.approach,'waiter'),rules.m53.poisonSeconds+.2);assert.equal(f.barrel,'armed');
 // C1: the key card from the room service wagon, the bolts on the balcony rail.
 hold(view(map.acts.take_keycard.at!,'waiter'),1.7);dress('bodyguard');hold(view(map.acts.rail_bolts.at!,'bodyguard'),4.2);assert.ok(g.armed.has('balcony_rail'));
 // B4: the lawyer's driver's clothes (taken here directly), into the driver's seat before 20 minutes, and wait.
 dress('driver');p=view({x:-60,y:0,z:-35},'driver');for(let i=0;i<10;i++)tick();
 c.jump(1150);hold(view(map.acts.car_sit.at!,'driver'),1.7);assert.ok(g.inCar);
 for(let i=0;i<3000&&!g.flags.has('lawyer_in_car');i++)tick();assert.ok(g.flags.has('lawyer_in_car'));hold(p,3.2);
 // The investor's call comes round on the next loop (7 min); the tasting at 19 min.
 p=view({x:-60,y:0,z:-35},'driver');for(let i=0;i<20000&&flow.phase==='targets';i++)tick();
 const kinds=Object.fromEntries(['wine_merchant','lawyer','investor'].map(id=>{const n=d.npcs.find(n=>n.id===id)!;return [id,`${n.life}:${n.deathMethod}:${n.deathKind}`];}));
 assert.equal(flow.phase,'escape',JSON.stringify(kinds));assert.deepEqual(kinds,{wine_merchant:'dead:wine_barrel:accident',lawyer:'dead:car_wire:murder',investor:'dead:balcony_rail:accident'});
 assert.ok(flow.exit('E5',c.elapsed));const r=computeResult(scoring,ledger.counts,c.elapsed,true);
 assert.equal(r.lines.find(l=>l.key==='accident_kill')!.count,2,'two accidents');assert.equal(r.lines.find(l=>l.key==='chance_complete')!.count,3);
 assert.equal(r.lines.find(l=>l.key==='civilian_kill')!.count,0,'nobody else');assert.ok(['A','B','C'].includes(r.rank));
 assert.equal(r.ghost,true,'and nobody saw a thing: '+r.ghostBrokenBy.join(','));});

// The same systems as the game, for the routes without chances.
function game(rng=Math.random){const d=new Director(hotel,world,nav,sightBoxes(hotel),structuredClone(rules)),e=new MissionEvents(),c=new MissionClock(rules.schedule,e),schedule=new ScheduleSystem(plans,hotel.schedulePlaces,d,c,e),
  m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),f=new M53System(d,m3,m4,c,e,rules.m53,hotel.m53,hotel.cameras,chances),g=new M57System(d,m3,m4,f,c,e,map,hotel.cameras),
  combat=new CombatSystem(d,e,m3.hotel,json('combat') as CombatRules,json('weapons') as Record<string,WeaponDef>,hotel.reinforcements,rng),flow=new MissionFlow(mission.targets,d,e);
 const s={d,e,c,schedule,m3,m4,f,g,combat,flow,p:view({x:-60,y:0,z:-35},'suit'),keys:new Set<string>(),heading:0};
 const tick=(dt=.1)=>{c.step(dt);schedule.sync(dt);d.step(dt,s.p);f.step(dt,s.p,s.heading,new Set());g.step(dt,s.p,new Set());m3.step(dt,s.p,s.heading,s.keys);combat.step(dt,s.p,c.elapsed);schedule.sync(0);f.afterAi(s.p);m3.discover();flow.update(c.elapsed);};
 // Stand just behind someone, facing them.
 const behind=(id:string)=>{const n=d.npcs.find(n=>n.id===id)!;s.p=view({x:n.pos.x-Math.sin(n.heading)*.8,y:n.pos.y,z:n.pos.z-Math.cos(n.heading)*.8},s.p.disguise);s.heading=n.heading;return n;};
 return {...s,s,tick,behind};}

test('M5.8 without any chance: the three targets by hand (X from behind), then out — possible, though every body is a murder',()=>{
 const G=game();G.c.jump(60);for(let i=0;i<30;i++)G.tick();
 for(const id of ['wine_merchant','lawyer','investor']){const n=G.behind(id);G.s.keys.add('KeyX');for(let i=0;i<40&&n.life==='active';i++){G.behind(id);G.tick();}G.s.keys.delete('KeyX');G.tick();
  assert.equal(n.life,'dead',id);assert.equal(n.deathKind,'murder');}
 assert.equal(G.flow.phase,'escape');assert.ok(G.flow.exit('E5',G.c.elapsed));});

test('M5.8 the loud route: shooting all three is possible too; a shot only raises alert 2 and the others run to their safe rooms',()=>{
 const G=game(()=>.99);G.combat.equip('pistol_guard');G.combat.hand='pistol_guard';G.c.jump(60);for(let i=0;i<30;i++)G.tick();
 const shoot=(id:string)=>{const n=G.d.npcs.find(n=>n.id===id)!;// From around her until the line is clear of her bodyguards.
  for(let k=0;k<16&&n.life==='active';k++){const a=n.heading+Math.PI+k*Math.PI/4;G.s.p=view({x:n.pos.x+Math.sin(a)*4,y:n.pos.y,z:n.pos.z+Math.cos(a)*4},'suit');G.combat.fireT=0;G.combat.held!.mag=12;G.combat.fire(G.s.p,{x:n.pos.x,y:n.pos.y+1.65,z:n.pos.z},G.c.elapsed);G.tick();}return n;};
 assert.equal(shoot('wine_merchant').life,'dead');assert.ok(G.m3.hotel.level>=2);
 for(const id of ['lawyer','investor'])assert.deepEqual(G.d.npcs.find(n=>n.id===id)!.scriptedGoal,{...map.safeRooms[id]},id+' runs to the safe room');
 assert.equal(shoot('lawyer').life,'dead');assert.equal(shoot('investor').life,'dead');assert.equal(G.flow.phase,'escape');
 assert.ok(!G.combat.closedExits().includes('E5'));assert.ok(G.flow.exit('E5',G.c.elapsed));});

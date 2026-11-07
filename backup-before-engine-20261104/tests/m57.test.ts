import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type Npc,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {MissionClock,ScheduleSystem}from '../src/schedule.ts';import {M3System}from '../src/m3.ts';import {M4System}from '../src/m4.ts';import {M53System}from '../src/m53.ts';
import {M57System,type M57Map}from '../src/m57.ts';import {Chances}from '../src/chances.ts';
// The real schedule and AI run; the agent is placed at each spot (walking there is M5.8's play-through).
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),chances=json('chances'),plans=json('schedule'),kills=json('kills'),dialogue=json('dialogue');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),map=hotel.m57 as M57Map;
function setup(){const d=new Director(hotel,world,nav,sightBoxes(hotel),structuredClone(rules)),e=new MissionEvents(),c=new MissionClock(rules.schedule,e),schedule=new ScheduleSystem(plans,hotel.schedulePlaces,d,c,e),m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),
 f=new M53System(d,m3,m4,c,e,rules.m53,hotel.m53,hotel.cameras,chances),g=new M57System(d,m3,m4,f,c,e,map,hotel.cameras),seen:string[]=[];let hand='';g.held_item=()=>hand;e.on(x=>{if(x.type!=='clock.tick')seen.push(x.type+':'+(x.id??''));});
 return {d,e,c,schedule,m3,m4,f,g,seen,give:(item:string)=>{hand=item;}};}
type S=ReturnType<typeof setup>;
const view=(p:{x:number;y:number;z:number},disguise:string):PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise});
const far=view({x:1000,y:0,z:1000},'suit');
const npc=(s:S,id:string)=>s.d.npcs.find(n=>n.id===id)!;
function tick(s:S,p:PlayerView,dt=.1,keys=new Set<string>()){s.c.step(dt);s.schedule.sync(dt);s.d.step(dt,p);s.f.step(dt,p,0,new Set());s.g.step(dt,p,keys);s.f.afterAi(p);}
function hold(s:S,p:PlayerView,seconds:number){for(let i=0;i<Math.ceil(seconds*10)+2;i++)tick(s,p,.1,new Set(['KeyE']));tick(s,p);}
function until(s:S,p:PlayerView|(()=>PlayerView),ok:()=>boolean,seconds:number){for(let i=0;i<seconds*10&&!ok();i++)tick(s,typeof p==='function'?p():p);return ok();}
function hear(s:S,id:string){s.e.emit({type:'dialogue.heard',time:s.c.elapsed,id});}
// Nobody else nearby to witness (the people a test cares about stay).
function clearAround(s:S,keep:string[]){for(const n of s.d.npcs)if(!keep.includes(n.id)&&!n.target){n.pos={x:300+Math.random(),y:0,z:300};n.scheduled=false;n.route=[[n.pos.x,n.pos.z,999]];n.routeIndex=0;}}
const at=(id:string)=>map.acts[id].at!;

test('M5.7 data: 14 chances, each started by a trigger line and timed by the schedule; 9 traps; every act stands on walkable floor',()=>{
 assert.equal(Object.keys(chances).length,14);for(const [id,c] of Object.entries<{trigger:{heard:string};steps:unknown[]}>(chances)){assert.ok(dialogue[c.trigger.heard]?.trigger,`${id} trigger`);assert.equal(c.steps.length,3,id);}
 assert.equal(Object.keys(kills).length,9);for(const [id,a] of Object.entries(map.acts))if(a.at)assert.ok(nav.nearest(a.at)>=0,id);
 for(const d of ['photographer','driver','beachbar','pilot','masseuse'])assert.ok(rules.disguises[d],d);
 assert.equal(rules.disguises.masseuse.secure,'allow','the masseuse is invited into the penthouse');});

test('M5.7 A3: with a wrench the panel is broken; when the wine merchant lounges by the pool the light knocked into the water kills her — an accident if unseen',()=>{
 const s=setup();hear(s,'pool_exposed_wire');s.c.jump(880);clearAround(s,['wine_merchant']);s.give('wrench');
 const panel=view(at('pool_panel'),'suit');assert.match(s.g.prompt(panel)?.text??'',/E 長押し 配電盤/);hold(s,panel,3.2);assert.ok(s.g.armed.has('pool_light'));
 assert.ok(until(s,far,()=>s.g.flags.has('wine_at_pool'),120),'she comes to the pool at 15 min');
 const stand=view(at('pool_light'),'suit');hold(s,stand,1.7);const w=npc(s,'wine_merchant');
 assert.equal(w.life,'dead');assert.equal(w.deathMethod,'electrocution');assert.equal(w.deathKind,'accident');
 tick(s,far);assert.equal(s.f.chances.states.get('a3')!.status,'complete');});

test('M5.7 a trap takes everyone in its area: a bystander under the chandelier dies with the lawyer; her bodyguards stand back from the speech',()=>{
 const s=setup();hear(s,'lobby_chandelier');s.c.jump(330);clearAround(s,['lawyer','bodyguard_captain','bodyguard_1','bodyguard_2']);s.give('wrench');
 assert.ok(until(s,far,()=>npc(s,'lawyer').scheduleAction==='speech'&&!npc(s,'lawyer').scheduleTarget,90));
 const extra=npc(s,'waiter_5');const L=npc(s,'lawyer');const area=map.areas.chandelier;extra.pos={x:area.x-area.r/2,y:area.y,z:area.z};extra.scheduled=false;extra.route=[[extra.pos.x,extra.pos.z,999]];
 s.m4.disguise='waiter';const catwalk=view(at('chandelier_clamp'),'waiter');tick(s,catwalk);assert.ok(s.g.flags.has('catwalk'));hold(s,catwalk,4.2);assert.ok(s.g.armed.has('chandelier'));
 hold(s,catwalk,1.2);assert.equal(L.life,'dead');assert.equal(L.deathMethod,'chandelier');assert.equal(extra.life,'dead','anyone under it');
 for(const id of ['bodyguard_captain','bodyguard_1','bodyguard_2'])assert.equal(npc(s,id).life,'active',id+' stood aside');tick(s,far);
 assert.equal(s.f.chances.states.get('b1')!.status,'complete');});

test('M5.7 B4: in the driver\'s seat the agent waits; the lawyer gets in for her call and is killed unseen inside — a quiet murder, body out of sight',()=>{
 const s=setup();hear(s,'parking_phone');s.c.jump(1150);s.m4.disguise='driver';s.e.emit({type:'disguise.changed',time:s.c.elapsed,id:'driver'});
 const seat=view(at('car_sit'),'driver');hold(s,seat,1.7);assert.equal(s.g.inCar,true);assert.match(s.g.prompt(seat)?.text??'',/待つ/);
 assert.ok(until(s,seat,()=>s.g.flags.has('lawyer_in_car'),200),'she comes at 20 min and gets in');hold(s,seat,3.2);
 const L=npc(s,'lawyer');assert.equal(L.life,'dead');assert.equal(L.deathKind,'murder');assert.equal(L.bodyMode,'hidden');tick(s,seat);assert.equal(s.f.chances.states.get('b4')!.status,'complete');});

test('M5.7 C1: the room service key card, the loose rail, and the investor falls on her phone call',()=>{
 const s=setup();hear(s,'penthouse_phone_hint');s.c.jump(60);clearAround(s,['investor']);
 const wagon=view(at('take_keycard'),'waiter');hold(s,wagon,1.7);assert.equal(s.g.keycard,true);
 const rail=view(at('rail_bolts'),'bodyguard');hold(s,rail,4.2);assert.ok(s.g.armed.has('balcony_rail'));
 s.c.jump(400);assert.ok(until(s,far,()=>npc(s,'investor').life==='dead',120));const n=npc(s,'investor');assert.equal(n.deathMethod,'balcony_rail');assert.equal(n.deathKind,'accident');
 assert.ok(n.pos.y<1,'she lands below');tick(s,far);assert.equal(s.f.chances.states.get('c1')!.status,'complete');});

test('M5.7 alert: 2 sends the targets to their safe rooms and back; 3 evacuates them — a target who reaches the car escapes, the sabotaged boat explodes',()=>{
 const s=setup();s.c.jump(60);for(let i=0;i<20;i++)tick(s,far);s.m3.hotel.level=2;tick(s,far);
 for(const id of ['wine_merchant','lawyer','investor'])assert.deepEqual(npc(s,id).scriptedGoal,{...map.safeRooms[id]},id);
 s.m3.hotel.level=1;tick(s,far);assert.equal(npc(s,'lawyer').scriptedGoal,null,'back to the schedule');
 hear(s,'marina_escape');const fuel=view(at('boat_fuel'),'fisher');hold(s,fuel,4.2);assert.ok(s.g.armed.has('boat_fuel'));
 const bell=view(at('alarm_bell'),'guard');hold(s,bell,1.2);assert.equal(s.m3.hotel.level,1);assert.ok(s.g.flags.has('investor_evacuation'));
 s.m3.hotel.level=3;tick(s,far); // A real hotel-wide alarm still evacuates every target.
 // Bring them close to their way out so the test does not wait for the walk across the hotel.
 const I=npc(s,'investor'),L=npc(s,'lawyer');I.pos={x:40,y:0,z:27.5};L.pos={x:-27,y:0,z:-22};for(const n of [I,L] as Npc[]){n.state='patrol';n.busy=false;n.path=[];n.pathGoal=null;}
 assert.ok(until(s,far,()=>I.life==='dead'&&s.g.escaped.has('lawyer'),60));
 assert.equal(I.deathMethod,'boat_explosion');assert.ok(s.seen.includes('target.escaped:lawyer'));tick(s,far);assert.equal(s.f.chances.states.get('c2')!.status,'complete');});

test('M5.7 chances: an undiscovered chance is not lost; flags and armed traps advance the steps in order',()=>{
 const e=new MissionEvents(),c=new Chances(chances,e);e.emit({type:'trap.armed',time:1,id:'fireworks'});assert.equal(c.states.get('c5')!.stage,0);
 e.emit({type:'dialogue.heard',time:2,id:'beach_fireworks'});assert.equal(c.states.get('c5')!.stage,0,'the outfit comes first');
 e.emit({type:'disguise.changed',time:3,id:'beachbar'});assert.equal(c.states.get('c5')!.stage,2,'the earlier arming then counts');
 e.emit({type:'npc.killed',time:4,id:'investor',method:'fireworks'});assert.equal(c.states.get('c5')!.status,'complete');});

function push(s:S,p:PlayerView){for(let i=0;i<20;i++){s.c.step(.1);s.schedule.sync(.1);s.d.step(.1,p);s.f.step(.1,p,0,new Set(['KeyP']));s.g.step(.1,p,new Set());s.f.afterAi(p);}tick(s,p);}
function dress(s:S,d:string){s.m4.disguise=d;s.e.emit({type:'disguise.changed',time:s.c.elapsed,id:d});}
const reach=(s:S,id:string,doing:string,seconds:number)=>until(s,far,()=>{const n=npc(s,id);return n.scheduleAction===doing&&!n.scheduleTarget&&n.state==='patrol';},seconds);
const beside=(s:S,id:string,d:string)=>{const n=npc(s,id);return view({x:n.pos.x+Math.sin(n.heading)*1,y:n.pos.y,z:n.pos.z+Math.cos(n.heading)*1},d);};

test('M5.7 A4 and C3: posed at the edge by the photographer or the pilot, the target is pushed off from behind',()=>{
 const s=setup();hear(s,'terrace_photo');hear(s,'investor_helicopter');s.c.jump(370);clearAround(s,['wine_merchant','investor']);dress(s,'photographer');
 assert.ok(reach(s,'wine_merchant','photo',90));const front=beside(s,'wine_merchant','photographer');assert.match(s.g.prompt(front)?.text??'',/手すり際/);hold(s,front,2.2);
 const W=npc(s,'wine_merchant');assert.ok(until(s,far,()=>Math.hypot(W.pos.x-map.posed.wine_merchant.x,W.pos.z-map.posed.wine_merchant.z)<.5&&!W.scheduleTarget,40));for(let i=0;i<20;i++)tick(s,far);
 push(s,view({x:W.pos.x-.9,y:0,z:W.pos.z},'photographer'));assert.equal(W.life,'dead');assert.equal(W.deathMethod,'push');tick(s,far);assert.equal(s.f.chances.states.get('a4')!.status,'complete');
 s.c.jump(1210);dress(s,'pilot');assert.ok(reach(s,'investor','wait',150));hold(s,beside(s,'investor','pilot'),2.2);const I=npc(s,'investor');
 assert.ok(until(s,far,()=>Math.hypot(I.pos.x-map.posed.investor.x,I.pos.z-map.posed.investor.z)<.5&&!I.scheduleTarget,60));for(let i=0;i<20;i++)tick(s,far);
 push(s,view({x:I.pos.x-.9,y:I.pos.y,z:I.pos.z},'pilot'));assert.equal(I.life,'dead');tick(s,far);assert.equal(s.f.chances.states.get('c3')!.status,'complete');});

test('M5.7 A5, C5 and B2 gas: the crane load on the deck, the fireworks at the 18-minute signal, the gas at the tasting stove',()=>{
 const s=setup();hear(s,'marina_crane_loose');s.c.jump(610);clearAround(s,['wine_merchant']);dress(s,'fisher');
 hold(s,view(at('crane_pin'),'fisher'),5.2);assert.ok(s.g.armed.has('yacht_crane'));assert.ok(reach(s,'wine_merchant','tour',150));
 hold(s,view(at('crane_panel'),'fisher'),1.2);assert.equal(npc(s,'wine_merchant').deathMethod,'falling_object');tick(s,far);assert.equal(s.f.chances.states.get('a5')!.status,'complete');
 const s2=setup();hear(s2,'beach_fireworks');s2.c.jump(905);clearAround(s2,['investor']);dress(s2,'beachbar');hold(s2,view(at('fireworks_aim'),'beachbar'),3.2);
 assert.ok(until(s2,far,()=>npc(s2,'investor').life==='dead',200));assert.equal(npc(s2,'investor').deathMethod,'fireworks');assert.ok(s2.c.time>=map.signal);
 tick(s2,far);assert.equal(s2.f.chances.states.get('c5')!.status,'complete');
 const s3=setup();hear(s3,'kitchen_tasting');s3.c.jump(600);clearAround(s3,['lawyer','head_chef']);dress(s3,'chef');s3.give('wrench');
 hold(s3,view(at('gas_pipe'),'chef'),4.2);assert.ok(s3.g.armed.has('gas_leak'));assert.ok(reach(s3,'head_chef','cook',30));hold(s3,beside(s3,'head_chef','chef'),3.2);assert.ok(s3.g.flags.has('chef_away'));
 assert.ok(reach(s3,'lawyer','tasting',150));hold(s3,view(at('stove_light'),'chef'),1.7);assert.ok(s3.g.fuse);
 const away=view({x:-30,y:0,z:5},'chef');for(let i=0;i<40;i++)tick(s3,away);const L=npc(s3,'lawyer');assert.equal(L.deathMethod,'gas_explosion');assert.equal(npc(s3,'head_chef').life,'active','the head chef was sent away first');
 tick(s3,away);assert.equal(s3.f.chances.states.get('b2')!.status,'complete');});

test('M5.7 B3 and C4: escorting the lawyer as her relief bodyguard, then a kill away from people; the masseuse with the wire',()=>{
 const s=setup();hear(s,'bodyguard_change');s.c.jump(965);clearAround(s,['lawyer','bodyguard_captain']);dress(s,'bodyguard');
 assert.ok(reach(s,'lawyer','wait',120));hold(s,beside(s,'lawyer','bodyguard'),2.2);assert.ok(s.g.escorting);
 // Walk off down the corridor: she follows.
 let p=beside(s,'lawyer','bodyguard');for(let i=0;i<80;i++){p=view({x:p.x-.1,y:p.y,z:p.z},'bodyguard');tick(s,p);}const L=npc(s,'lawyer');assert.ok(Math.hypot(L.pos.x-p.x,L.pos.z-p.z)<2.5,'she keeps a step behind');
 markDeadFor(L);tick(s,p);assert.ok(s.g.flags.has('escort_kill'));tick(s,p);assert.equal(s.f.chances.states.get('b3')!.status,'complete');
 const s2=setup();hear(s2,'reception_massage');s2.c.jump(665);clearAround(s2,['investor']);dress(s2,'masseuse');
 const room=view({x:-26,y:7,z:-10},'masseuse');tick(s2,room);assert.ok(s2.g.flags.has('masseuse_in'));
 assert.ok(reach(s2,'investor','massage',150));hold(s2,beside(s2,'investor','masseuse'),3.2);const I=npc(s2,'investor');assert.equal(I.deathMethod,'massage_wire');assert.equal(I.deathKind,'murder');
 tick(s2,far);assert.equal(s2.f.chances.states.get('c4')!.status,'complete');});
// The agent's own takedown (M3) of the escorted lawyer.
function markDeadFor(n:Npc){n.life='dead';n.deathKind='murder';n.deathMethod='wire';}

test('M5.7 B2 the other ending: with the head chef sent away, the chef serves the lawyer a poisoned dish — an accident',()=>{
 const s=setup();hear(s,'kitchen_tasting');s.c.jump(600);clearAround(s,['lawyer','head_chef']);dress(s,'chef');
 assert.ok(reach(s,'head_chef','cook',30));hold(s,beside(s,'head_chef','chef'),3.2);assert.ok(reach(s,'lawyer','tasting',150));
 const p=beside(s,'lawyer','chef');assert.match(s.g.prompt(p)?.text??'',/毒入りの試食/);hold(s,p,2.2);const L=npc(s,'lawyer');
 assert.equal(L.deathMethod,'poison_dish');assert.equal(L.deathKind,'accident');assert.equal(s.f.poison,0);tick(s,far);assert.equal(s.f.chances.states.get('b2')!.status,'complete');});

import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {MissionClock,ScheduleSystem}from '../src/schedule.ts';import {M3System}from '../src/m3.ts';import {M4System}from '../src/m4.ts';import {M53System}from '../src/m53.ts';
// These run the real schedule and AI and reach each situation by walking, instead of placing people where the action works.
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),chances=json('chances'),plans=json('schedule');
const world=new CollisionWorld(hotel),nav=new NavGrid(world);
function setup(){const d=new Director(hotel,world,nav,sightBoxes(hotel),structuredClone(rules)),e=new MissionEvents(),c=new MissionClock(rules.schedule,e),schedule=new ScheduleSystem(plans,hotel.schedulePlaces,d,c,e),m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),f=new M53System(d,m3,m4,c,e,rules.m53,hotel.m53,hotel.cameras,chances);return {d,e,c,schedule,m3,m4,f};}
type S=ReturnType<typeof setup>;
const view=(p:{x:number;y:number;z:number},disguise:string,speed=0):PlayerView=>({...p,floor:floorOf(p.y),speed,running:false,crouched:false,tampering:false,disguise});
const far=view({x:1000,y:0,z:1000},'suit');
function tick(s:S,p:PlayerView,dt=.1){s.c.step(dt);s.schedule.sync(dt);s.d.step(dt,p);s.f.step(dt,p,0,new Set());s.f.afterAi(p);}
function hold(s:S,key:string,p:PlayerView,seconds:number){for(let i=0;i<Math.ceil(seconds*60)+2;i++){s.c.step(1/60);s.schedule.sync(1/60);s.d.step(1/60,p);s.f.step(1/60,p,0,new Set([key]));s.f.afterAi(p);}s.f.step(0,p,0,new Set());}
// Walk straight at someone from `start` metres in front of them at walking pace, stopping 1.3 m short.
function approach(s:S,id:string,disguise:string,start=8){const n=s.d.npcs.find(n=>n.id===id)!,fwd={x:Math.sin(n.heading),z:Math.cos(n.heading)};let p={x:n.pos.x+fwd.x*start,y:n.pos.y,z:n.pos.z+fwd.z*start};
 for(let i=0;i<120;i++){const d=Math.hypot(n.pos.x-p.x,n.pos.z-p.z);if(d<=1.3)break;p={x:p.x+(n.pos.x-p.x)/d*.165,y:p.y,z:p.z+(n.pos.z-p.z)/d*.165};tick(s,view(p,disguise,1.65));}return view(p,disguise);}

test('M5.3 play: the sommelier walks up to the head waiter from the front and can greet him; after the key he checks faces again',()=>{
 const s=setup();s.c.jump(400);for(let i=0;i<300;i++)tick(s,far);s.m4.disguise='sommelier';
 // Arrive and take a moment, as a player would, before pressing J.
 const p=approach(s,'head_waiter','sommelier');for(let i=0;i<15;i++)tick(s,p);assert.equal(s.d.compromised.has('sommelier'),false,'outfit blown on the way in');
 assert.match(s.f.prompt(p,0)?.text??'',/挨拶/);hold(s,'KeyJ',p,rules.m53.talkSeconds+.2);assert.equal(s.f.cellarKey,true);
 // Walk away for the grace period, then come back: the expected visitor has been received, so the outfit is checked again.
 for(let i=0;i<120;i++)tick(s,far);const back=approach(s,'head_waiter','sommelier');for(let i=0;i<40;i++)tick(s,back);
 assert.equal(s.d.compromised.has('sommelier'),true);});

test('M5.3 play: before the key the head waiter still knows waiters by face',()=>{
 const s=setup();s.c.jump(400);for(let i=0;i<300;i++)tick(s,far);s.m4.disguise='waiter';const p=approach(s,'head_waiter','waiter');for(let i=0;i<40;i++)tick(s,p);
 assert.equal(s.d.compromised.has('waiter'),true);});

test('M5.3 play: the poisoned barrel is an accident while the player stands in plain view in the lobby',()=>{
 const s=setup();s.m4.disguise='waiter';hold(s,'KeyE',view(hotel.m53.barrel.approach,'waiter'),rules.m53.poisonSeconds+.2);assert.equal(s.f.barrel,'armed');
 s.c.jump(1100);const lobby=view({x:12,y:0,z:-1},'suit');let seen=0;for(let i=0;i<3000&&!s.f.kills.length;i++){tick(s,lobby);seen=Math.max(seen,s.d.npcs.filter(n=>n.active&&n.visibility>0).length);}
 assert.ok(seen>0,'nobody could see the player, so this proves nothing');assert.equal(s.f.kills[0]?.judgement.kind,'accident',JSON.stringify(s.f.kills[0]?.judgement));});

test('M5.3 play: serving the poisoned glass as the sommelier at the tasting is an accident',()=>{
 const s=setup();s.m4.disguise='sommelier';s.f.cellarKey=true;s.c.jump(1140);for(let i=0;i<1200&&!(s.f.wine.scheduleAction==='tasting'&&!s.f.wine.scheduleTarget);i++)tick(s,far);
 const p=view(hotel.m53.glass.approach,'sommelier');assert.match(s.f.prompt(p,0)?.text??'',/毒入りの一杯/);hold(s,'KeyE',p,rules.m53.serveSeconds+.2);
 assert.equal(s.f.wine.life,'dead');assert.equal(s.f.kills[0].judgement.kind,'accident');});

test('M5.3 play: during the balcony call C stands at the rail facing the sea and can be pushed from behind',()=>{
 const s=setup();s.c.jump(400);let eligible=0,pushedAt:PlayerView|null=null;const c=s.d.npcs.find(n=>n.id==='investor')!;
 for(let i=0;i<2400&&s.c.time<660;i++){tick(s,far);const behind=view({x:c.pos.x-Math.sin(c.heading)*.8,y:c.pos.y,z:c.pos.z-Math.cos(c.heading)*.8},'suit');if(s.f.pushTarget(behind,c.heading)?.npc===c){eligible+=.1;pushedAt??=behind;}}
 assert.ok(eligible>60,`pushable for only ${eligible.toFixed(1)} s of the 7-11 min call`);
 const s2=setup();s2.c.jump(400);const c2=s2.d.npcs.find(n=>n.id==='investor')!;for(let i=0;i<2400;i++){tick(s2,far);if(s2.c.time>500&&s2.f.pushTarget(view({x:c2.pos.x-Math.sin(c2.heading)*.8,y:c2.pos.y,z:c2.pos.z-Math.cos(c2.heading)*.8},'suit'),c2.heading))break;}
 hold(s2,'KeyP',view({x:c2.pos.x-Math.sin(c2.heading)*.8,y:c2.pos.y,z:c2.pos.z-Math.cos(c2.heading)*.8},'suit'),rules.m53.pushSeconds+.2);
 assert.equal(c2.life,'dead');assert.ok(c2.pos.y<1,'fell to the ground');});

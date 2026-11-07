// HD14 / M06 (2026-11-08; S03 M06 「正面・偽装投降からの格闘」 — HITMAN 2016's Fake Surrender): before a guard who comes to arrest,
// F raises the hands; when he is in reach the counter is the fight's keys in turn. Success knocks him out; a miss is the
// arrest. While the hands are up the guard does not make the arrest by touch.
import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type Npc,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {M3System,SURRENDER_RANGE,SURRENDER_REACH}from '../src/m3.ts';import {BRAWL_KEYS}from '../src/melee.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules');
// The hotel's start, on walkable floor (the guard walks up to the agent there).
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel),LOT={x:hotel.spawn.x,y:0,z:hotel.spawn.z};
const S08=readFileSync(new URL('../../investigation/material-audit-20261106/sources/03-attack-actions.csv',import.meta.url),'utf8');
function setup(){const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),m3=new M3System(d,hotel.hides,rules.m3);
 for(const n of d.npcs){n.pos={x:200+Math.random(),y:0,z:200};n.state='patrol';n.scheduled=false;}
 // The parking guard, 3 m off, coming to arrest (as ai.ts think leaves him: alert, detaining, the spot as his goal).
 const g=d.npcs.find((n:Npc)=>n.id==='guard_parking')!;g.pos={x:LOT.x,y:0,z:LOT.z+3};g.heading=Math.PI;g.state='alert';g.arrest=true;g.knownDisguises.add('suit');g.suspicion=100;g.lastSeen={...LOT};g.goal={...LOT};g.arrived=false;
 return {d,m3,g};}
const view=(o:Partial<PlayerView>={}):PlayerView=>({...LOT,floor:floorOf(0),speed:0,running:false,crouched:false,tampering:false,disguise:'suit',...o});
// Perception runs every few frames (ai.ts lod.nearEvery): let the guard look a few times first.
const warm=(s:ReturnType<typeof setup>,p=view())=>{for(let i=0;i<8;i++)s.d.step(.05,p);};
function run(s:ReturnType<typeof setup>,presses:(t:number)=>string[],seconds:number){let t=0,caughtWhileUp=false;
 for(;t<seconds;t+=.05){const p=view({surrendering:!!s.m3.surrendering});s.d.step(.05,p);s.m3.step(.05,p,0,new Set(presses(t)));if(s.m3.surrendering&&s.d.caught)caughtWhileUp=true;if(s.m3.failedCounter)break;}return {caughtWhileUp};}

test('S03 M06 is the fake surrender (the source row is still there)',()=>{assert.match(S08,/M06,素手,正面・偽装投降からの格闘/);assert.match(S08,/QTE成功時に相手が気絶/);assert.ok(SURRENDER_RANGE>SURRENDER_REACH);});

test('M06: F before a detaining guard raises the hands; the counter F→X→F knocks him out',()=>{
 const s=setup();warm(s);assert.match(s.m3.prompt(LOT),/F 投降する/);
 let began=-1;const r=run(s,t=>{if(t<.1)return ['KeyF'];if(began<0&&s.m3.action?.surrender)began=t;if(began<0)return [];const k=Math.floor((t-began)/.4);return k<BRAWL_KEYS.length&&(t-began)%.4<.1?[BRAWL_KEYS[k]]:[];},12);
 assert.ok(began>=0,'the counter started when the guard came within reach');assert.equal(r.caughtWhileUp,false,'no arrest while the hands are up');
 assert.equal(s.g.life,'unconscious');assert.equal(s.d.caught,false);assert.equal(s.m3.failedCounter,null);});

test('M06: a wrong key in the counter is the arrest',()=>{
 const s=setup();warm(s);let began=-1;
 run(s,t=>{if(t<.1)return ['KeyF'];if(began<0&&s.m3.action?.surrender)began=t;return began>=0&&t-began<.1?['KeyX']:[];},12);
 assert.ok(s.m3.failedCounter,'the counter failed');assert.equal(s.g.life,'active');});

test('M06: moving puts the hands down; with a gun drawn there is no surrender',()=>{
 const s=setup();warm(s);s.m3.step(.05,view(),0,new Set(['KeyF']));assert.ok(s.m3.surrendering);
 s.m3.step(.05,view(),0,new Set(['KeyW']));assert.equal(s.m3.surrendering,null);
 const t=setup();warm(t,view({weaponDrawn:true}));assert.equal(t.m3.detainer(view({weaponDrawn:true})),undefined);});

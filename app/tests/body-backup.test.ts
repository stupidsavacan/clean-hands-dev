// HD09 (2026-11-07, the user's choice): when a guard finds a body, backup comes from any floor of the building — the two
// nearest free guards, a floor apart counting as BACKUP_FLOOR_M metres — instead of everyone within a flat radio radius.
import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type Npc}from '../src/ai.ts';import {CollisionWorld,plateY}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {M3System,BODY_BACKUP,BACKUP_FLOOR_M}from '../src/m3.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules');
const world=new CollisionWorld(hotel);
function setup(){const d=new Director(hotel,world,new NavGrid(world),sightBoxes(hotel),structuredClone(rules)),m3=new M3System(d,hotel.hides,rules.m3);
 for(const n of d.npcs){n.pos={x:300,y:0,z:300};n.state='patrol';n.scheduled=false;}return {d,m3};}

test('HD09: the two nearest free guards answer, one of them a floor up',()=>{
 const {d,m3}=setup(),guards=d.npcs.filter((n:Npc)=>n.guard);assert.ok(guards.length>=5,'enough guards in the hotel');
 const [caller,near,above,far,busy]=guards,at={x:0,y:0,z:0},up=plateY(hotel,1);
 caller.pos={x:1,y:0,z:0};near.pos={x:6,y:0,z:0};above.pos={x:2,y:up,z:0};far.pos={x:30,y:0,z:0};busy.pos={x:3,y:0,z:0};busy.state='search';
 const got=m3.backup(caller,at);assert.equal(BODY_BACKUP,2);assert.ok(BACKUP_FLOOR_M>0);
 assert.deepEqual(got.map(g=>g.id).sort(),[near.id,above.id].sort(),'the nearest two, across floors; not the far one, not one already searching, not the caller');});

test('HD09: a floor apart weighs more than the same distance on the same floor',()=>{
 const {d,m3}=setup(),[caller,a,b,c]=d.npcs.filter((n:Npc)=>n.guard),up=plateY(hotel,1);
 caller.pos={x:0,y:0,z:0};a.pos={x:4,y:up,z:0};b.pos={x:5,y:0,z:0};c.pos={x:6,y:0,z:0};
 assert.deepEqual(m3.backup(caller,{x:0,y:0,z:0}).map(g=>g.id),[b.id,c.id]);});

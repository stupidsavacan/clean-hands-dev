// HD08 (2026-11-07, the user's choice: as in HITMAN): a guard who finds the agent in a hostile area (zone type secure)
// opens fire without a warning, instead of only moving to arrest.
import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type Npc,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf,plateY}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {M3System}from '../src/m3.ts';
import {CombatSystem,type CombatRules,type WeaponDef}from '../src/combat.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),combatRules:CombatRules=json('combat'),weapons:Record<string,WeaponDef>=json('weapons');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel);
function setup(){const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),e=new MissionEvents(),m3=new M3System(d,hotel.hides,rules.m3),c=new CombatSystem(d,e,m3.hotel,combatRules,weapons,hotel.reinforcements,()=>0);
 for(const n of d.npcs){n.pos={x:200+Math.random(),y:0,z:200};n.state='patrol';n.scheduled=false;}return {d,c};}
const view=(p:{x:number;y:number;z:number},o:Partial<PlayerView>={}):PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise:'suit',...o});
const zone=hotel.zones.find((z:{type:string})=>z.type==='secure');
// The guard has just found the agent and moved to detain (ai.ts think: cause 'hostile' in a secure zone, 'trespass' elsewhere).
function run(cause:'hostile'|'trespass'){const s=setup(),g=s.d.npcs.find((n:Npc)=>n.guard)!,y=plateY(hotel,zone.floor),at={x:(zone.minX+zone.maxX)/2,y,z:(zone.minZ+zone.maxZ)/2};
 g.pos={x:at.x,y,z:at.z+2.5};g.heading=Math.PI;g.state='alert';g.arrest=true;g.cause=cause;g.suspicion=100;g.lastSeen={...at};
 const p=view(at,{restricted:true});for(let i=0;i<20;i++){s.d.step(.1,p);s.c.step(.1,p,i*.1);}return g;}

test('HD08: a guard detaining the agent in a hostile area opens fire (no arrest first)',()=>{
 assert.ok(zone,'the hotel has a secure zone');const g=run('hostile');assert.equal(g.state,'combat',`the guard is ${g.state}`);});

test('HD08: elsewhere a trespass is still an arrest, not a fight',()=>{const g=run('trespass');assert.notEqual(g.state,'combat');});

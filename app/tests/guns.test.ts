import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf,HEIGHT}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {M3System}from '../src/m3.ts';import {CombatSystem,type CombatRules,type WeaponDef}from '../src/combat.ts';
// Ways to a gun other than shooting someone: anyone armed who goes down drops theirs, and two guns lie in the hotel.
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),combatRules:CombatRules=json('combat'),weapons:Record<string,WeaponDef>=json('weapons');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel);
function setup(){const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),e=new MissionEvents(),m3=new M3System(d,hotel.hides,rules.m3);return {d,c:new CombatSystem(d,e,m3.hotel,combatRules,weapons,hotel.reinforcements,()=>0)};}
const view=(p:{x:number;y:number;z:number}):PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise:'suit'});
const down=(s:ReturnType<typeof setup>,id:string,life:'unconscious'|'dead',bodyMode:'ground'|'hidden'='ground')=>{const n=s.d.npcs.find(n=>n.id===id)!;n.life=life;n.fall=1;n.bodyMode=bodyMode;return n;};

test('a guard knocked out (not shot) drops the pistol by the body, a bodyguard the SMG; their holster is then empty',()=>{
 const s=setup(),guard=down(s,'guard_parking','unconscious'),bg=down(s,'bodyguard_1','dead');s.c.step(.1,view({x:0,y:0,z:0}),1);
 assert.deepEqual(s.c.dropped.map(d=>d.gun.id).sort(),['pistol_guard','smg']);assert.equal(guard.weapon,'');assert.equal(bg.weapon,'');
 const gun=s.c.dropped.find(d=>d.gun.id==='pistol_guard')!;assert.ok(Math.hypot(gun.pos.x-guard.pos.x,gun.pos.z-guard.pos.z)<1);
 assert.ok(gun.gun.mag>=1&&gun.gun.mag<=weapons.pistol_guard.mag);
 s.c.step(.1,view({x:0,y:0,z:0}),2);assert.equal(s.c.dropped.length,2,'each gun drops once');
 assert.equal(s.c.pickup({...gun.pos}),weapons.pistol_guard.label);assert.deepEqual(s.c.guns.map(g=>g.id),['pistol_guard']);});

test('a body still falling, or one already in a hiding place, does not drop a gun yet; civilians carry none',()=>{
 const s=setup(),falling=down(s,'guard_parking','unconscious');falling.fall=.4;down(s,'guard_terrace','unconscious','hidden');down(s,'waiter_1','dead');
 s.c.step(.1,view({x:0,y:0,z:0}),1);assert.equal(s.c.dropped.length,0);assert.equal(falling.weapon,'pistol_guard');});

test('two guns lie in the hotel: a pistol on the security desk and the bodyguards\' spare SMG in B\'s room, each reachable on foot',()=>{
 const s=setup();assert.equal(s.c.dropped.length,0,'a bare system starts with an empty floor');s.c.stock();
 assert.deepEqual(s.c.dropped.map(d=>d.gun.id),['pistol_guard','smg']);
 for(const d of [...s.c.dropped]){const def=weapons[d.gun.id];assert.equal(d.gun.mag,def.mag);
  // Somewhere within reach a person can stand: on that floor, not inside furniture or a wall.
  const floorY=Math.floor((d.pos.y+.01)/3.5)*3.5;let stand:{x:number;y:number;z:number}|null=null;
  for(let a=0;a<16&&!stand;a++)for(const r of [.6,.9,1.2]){const x=d.pos.x+Math.cos(a/16*Math.PI*2)*r,z=d.pos.z+Math.sin(a/16*Math.PI*2)*r,y=world.surface(x,z,floorY);if(y!==null&&Math.abs(y-floorY)<.05&&!world.blocked(x,y,z,HEIGHT)){stand={x,y,z};break;}}
  assert.ok(stand,`${d.gun.id} at ${JSON.stringify(d.pos)} has a place to stand`);
  const zone=hotel.zones.find((z:{floor:number;minX:number;maxX:number;minZ:number;maxZ:number})=>z.floor===floorOf(stand!.y)&&stand!.x>=z.minX&&stand!.x<=z.maxX&&stand!.z>=z.minZ&&stand!.z<=z.maxZ);
  assert.equal(zone?.type,d.gun.id==='smg'?'secure':'staff');
  assert.equal(s.c.pickup(stand!),def.label);}
 assert.deepEqual(s.c.guns.map(g=>g.id).sort(),['pistol_guard','smg']);});

// 2026-11-06: the dart pistol is in the weapon table, sedates instead of wounding, is legal nowhere and is stopped at a
// no-weapons checkpoint like any gun (the AI lab scenario "鎮静ダーツで眠らせる" checks the sleep itself).
import weaponsTable from '../src/data/weapons.json' with {type:'json'};
test('tranq_pistol: a sedating, single-shot, quiet pistol',()=>{
 const t=(weaponsTable as Record<string,{sedative?:boolean;damage:number;mag:number;noise:string;class:string;legality:string}>).tranq_pistol;
 assert.ok(t&&t.sedative&&t.damage===0&&t.mag===1&&t.noise==='small'&&t.class==='pistol'&&t.legality==='illegal');
});
test('H46: a pistol left at a pickup is not carried, is never collected by guards, and is picked up with E',()=>{const {c}=setup();const at={x:3,y:0,z:8};c.stash('pistol_silenced',at);
 assert.equal(c.guns.length,0);assert.equal(c.dropped.length,1);assert.equal(c.dropped[0].stocked,true);assert.equal(c.nearestDrop({x:3.4,y:0,z:8})?.gun.id,'pistol_silenced');
 c.pickup({x:3.4,y:0,z:8});assert.deepEqual(c.guns.map(g=>g.id),['pistol_silenced']);
 const mission=JSON.parse(readFileSync(new URL('../src/data/club-mission.json',import.meta.url),'utf8'));assert.deepEqual(mission.pickups.map((p:{id:string})=>p.id),['P1','P2','P3']);});

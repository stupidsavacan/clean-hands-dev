import assert from 'node:assert/strict';
import { test } from 'node:test';
import map from '../src/data/club-map.json' with { type: 'json' };
import rules from '../src/data/club-rules.json' with { type: 'json' };
import config from '../src/data/club-combat.json' with { type: 'json' };
import weapons from '../src/data/weapons.json' with { type: 'json' };
import { Director, type Mission, type PlayerView, type Rules } from '../src/ai.ts';
import { CombatSystem, type CombatRules, type WeaponDef } from '../src/combat.ts';
import { ClubWeapons } from '../src/club/weapons.ts';
import { MissionEvents } from '../src/events.ts';
import { markDead } from '../src/kills.ts';
import { HotelAlert } from '../src/m3.ts';
import { M4System, type Checkpoint } from '../src/m4.ts';
import { itemMaster } from '../src/items.ts';
import { NavGrid } from '../src/nav.ts';
import { sightBoxes } from '../src/sight.ts';
import { CollisionWorld } from '../src/world.ts';

function club() {
 const mission = map as unknown as Mission;
 const world = new CollisionWorld(mission);
 const director = new Director(mission, world, new NavGrid(world), sightBoxes(mission), rules as Rules);
 const hotel = new HotelAlert();
 const combat = new CombatSystem(director, new MissionEvents(), hotel, config as CombatRules,
                                 weapons as Record<string,WeaponDef>, []);
 const player:PlayerView = { x: 28, y: 0, z: 26, floor: 0, speed: 0, running: false,
                             crouched: false, tampering: false, disguise: 'suit' };
 return { director, hotel, combat, player };
}

test('club lockdown calls existing nearby guards, keeps posts, and never replenishes casualties', () => {
 const { director, hotel, combat, player } = club();
 const guards = director.npcs.filter(n => n.guard);
 assert.equal(guards.length, 7);
 const post = guards.find(n => n.id === 'gate_frisk')!;
 const escort = guards.find(n => n.id === 'escort')!;
 const patrol = guards.find(n => n.id === 'patrol')!;
 const origin = { ...player, y: 1.4 };
 assert.ok(combat.noise(origin, 'loud', player, 0).includes(patrol));
 hotel.level = 3;
 combat.step(1/60, player, 0);
 assert.equal(patrol.state, 'search');
 assert.deepEqual(patrol.goal, { x: player.x, y: player.y, z: player.z });
 assert.equal(post.state, 'patrol');
 assert.equal(escort.state, 'patrol');
 for (let i = 0; i < 60; i++) director.step(1/60, player);
 assert.ok(patrol.pos.x < 29.5);
 combat.step(1/60, player, config.localResponse.seconds + 1);
 assert.equal(patrol.state, 'patrol');
 assert.equal(patrol.goal, null);
 for (let i = 0; i < 180; i++) director.step(1/60, player);
 assert.ok(Math.abs(patrol.pos.x - 30) < .45);

 markDead(patrol, 'test', { kind: 'direct' });
 for (let t = 26; t <= 300; t++) combat.step(1, player, t);
 assert.equal(director.npcs.length, 36);
 assert.equal(director.npcs.filter(n => n.guard).length, 7);
 assert.equal(director.npcs.filter(n => n.guard && n.active).length, 6);
 assert.equal(patrol.life, 'dead');
 assert.equal(combat.waves, 0);
});

test('club entrance accepts wire, poison and coins and blocks guns', () => {
 const { director } = club();
 const m4 = new M4System(director, map.checkpoints as Checkpoint[], rules.m4, []);
 m4.items = itemMaster(weapons, rules.m4.items);
 const checkpoint = m4.checkpoints[0];
 const player:PlayerView = { x: 22, y: 0, z: 5.7, floor: 0, speed: 0, running: false,
                             crouched: false, tampering: false, disguise: 'suit' };
 m4.extraInventory = () => ['poison_lethal', 'coin', 'pistol_silenced'];
 assert.deepEqual(m4.friskFinds(checkpoint), ['pistol_silenced']);
 const beyond = { x: 22, y: 0, z: 6.1 };
 assert.equal(m4.constrain(player, beyond), player);
 m4.extraInventory = () => ['poison_lethal', 'coin'];
 assert.deepEqual(m4.friskFinds(checkpoint), []);
 for (let i = 0; i < 360; i++) m4.step(1/60, player, 0, new Set(['KeyB']));
 assert.equal(m4.stats.frisks, 1);
 assert.equal(m4.constrain(player, beyond), beyond);
});

function entranceWeapons() {
 const {director,combat,player}=club();
 const m4=new M4System(director,map.checkpoints as Checkpoint[],rules.m4);
 const weapons=new ClubWeapons(combat,m4,config.weaponRecoveryScanSeconds);
 const outside={...player,x:22.06,z:6};
 return {director,combat,m4,weapons,outside};
}

test('club pickup cannot reach across the checkpoint even with a valid frisk pass',()=>{
 const {director,combat,m4,weapons,outside}=entranceWeapons();
 combat.equip('pistol_silenced');
 combat.drop(outside);
 m4.extraInventory=()=>combat.guns.map(g=>g.id);
 const held=new Set(['KeyB']);
 for(let i=0;i<360;i++)m4.step(1/60,outside,0,held);
 const inside={...outside,x:21.99,z:6.55};
 const crossed=director.world.move(outside,inside.x-outside.x,inside.z-outside.z);
 assert.equal(m4.stats.frisks,1);
 assert.equal(m4.constrain(outside,crossed),crossed);
 assert.equal(combat.nearestDrop({...inside,...crossed}),undefined);
 assert.equal(weapons.pickup({...inside,...crossed}),null);
 assert.equal(m4.canPickUp(outside,inside),false);
 assert.equal(combat.nearestDrop(outside)?.gun.id,'pistol_silenced');
});

test('a club guard walks to a visible dropped gun and removes it without opening the checkpoint',()=>{
 const {director,combat,m4,weapons,outside}=entranceWeapons();
 const guard=director.npcs.find(n=>n.id==='gate_frisk')!;
 combat.equip('pistol_silenced');
 combat.drop(outside);
 const beyond={...outside,z:6.55};
 const home={...guard.pos};
 const collected:string[]=[];
 weapons.onReaction=(n,_drop,action)=>{if(action==='collect')collected.push(n.id);};
 for(let i=0;i<240;i++){
  director.step(1/60,outside);
  weapons.step(i/60);
  assert.equal(m4.constrain(outside,beyond),outside);
 }
 assert.deepEqual(collected,[guard.id]);
 assert.equal(combat.dropped.length,0);
 assert.ok(Math.hypot(guard.pos.x-home.x,guard.pos.z-home.z)<.35);
});

test('a club guard who sees a same-side gun pickup becomes suspicious',()=>{
 const {director,combat,weapons,outside}=entranceWeapons();
 const guard=director.npcs.find(n=>n.id==='gate_frisk')!;
 combat.equip('pistol_silenced');
 combat.drop(outside);
 const witnessed:string[]=[];
 weapons.onReaction=(n,_drop,action)=>{if(action==='curious')witnessed.push(n.id);};
 assert.equal(weapons.pickup(outside),'消音ピストル');
 assert.ok(witnessed.includes(guard.id));
 director.step(1/60,outside);
 assert.equal(guard.state,'curious');
 assert.ok(guard.suspicion>=rules.thresholds.curious);
});

// Claude 2026-11-03 playtest fixes: a reported outfit reaches guards only, enforcers are set per staff outfit,
// nothing is picked up through a wall, and the bartender uniform hangs in the cloak's back room.
test('club: a reported outfit is known to guards, not to staff who never saw the agent', () => {
 const { director } = club();
 director.compromised.add('bartender');
 const chef = director.npcs.find(n => n.id === 'chef')!, patrol = director.npcs.find(n => n.id === 'patrol')!;
 assert.equal(chef.hasConfirmedIdentity({ disguise: 'bartender' }), false);
 assert.equal(patrol.hasConfirmedIdentity({ disguise: 'bartender' }), true);
 chef.knownDisguises.add('bartender');
 assert.equal(chef.hasConfirmedIdentity({ disguise: 'bartender' }), true);
});

test('club: every staff and security outfit has someone who knows its faces', () => {
 const { director } = club();
 for (const outfit of ['bartender', 'bottle_server', 'technician', 'dj', 'chef', 'cleaner', 'manager', 'guard', 'bodyguard'])
  assert.ok(director.npcs.some(n => n.knowsFace(outfit)), outfit);
 assert.ok(director.npcs.filter(n => n.knowsFace('bartender')).length <= 2);
});

test('club: a dropped gun cannot be picked up through a wall', () => {
 const { director, combat } = club();
 const m4 = new M4System(director, map.checkpoints as Checkpoint[], rules.m4);
 new ClubWeapons(combat, m4, config.weaponRecoveryScanSeconds);
 combat.guns.push({ id: 'pistol_silenced', mag: 7, reserve: 0 });
 combat.drop({ x: 19.8, y: 0, z: 5.6 });
 assert.equal(combat.nearestDrop({ x: 19.8, y: 0, z: 6.4 }), undefined);
 assert.ok(combat.nearestDrop({ x: 19.8, y: 0, z: 5.0 }));
});

test('club: the bartender uniform is in the staff-only cloak back room', () => {
 const zone = map.zones.find(z => z.id === 'Q')!;
 assert.equal(zone.type, 'staff');
 assert.ok(zone.allowedDisguises.includes('bartender'));
 assert.equal(rules.compromisedBy, 'guards');
});

test('club: the gate stays shut while its guard looks into a runner beside it', () => {
 const { director, combat } = club();
 const m4 = new M4System(director, map.checkpoints as Checkpoint[], rules.m4);
 new ClubWeapons(combat, m4, config.weaponRecoveryScanSeconds);
 m4.extraInventory = () => combat.guns.map(g => g.id);
 combat.guns.push({ id: 'pistol_silenced', mag: 8, reserve: 0 });
 const guard = director.npcs.find(n => n.id === 'gate_frisk')!;
 guard.state = 'investigate';
 const from = { x: 22, y: 0, z: 5.7 }, to = { x: 22, y: 0, z: 6.3 };
 assert.deepEqual(m4.constrain(from, to), from);
 guard.life = 'unconscious';
 assert.deepEqual(m4.constrain(from, to), to);
});

test('club: the frisk guard turns to a coin but keeps his post, so the line stays shut', () => {
 const { director, combat, player } = club();
 const m4 = new M4System(director, map.checkpoints as Checkpoint[], rules.m4);
 new ClubWeapons(combat, m4, config.weaponRecoveryScanSeconds);
 m4.extraInventory = () => ['pistol_silenced'];
 const guard = director.npcs.find(n => n.id === 'gate_frisk')!, home = { ...guard.pos };
 for (const at of [{ x: 17, y: 0, z: 4 }, { x: 16, y: 0, z: 3 }]) {
  assert.equal(director.noise(at), guard);
  for (let i = 0; i < 300; i++) director.step(1/60, { ...player, x: 22, z: 2 });
 }
 assert.ok(Math.hypot(guard.pos.x - home.x, guard.pos.z - home.z) < .3, JSON.stringify(guard.pos));
 const from = { x: 22, y: 0, z: 5.7 }, to = { x: 22, y: 0, z: 6.3 };
 assert.deepEqual(m4.constrain(from, to), from);
});

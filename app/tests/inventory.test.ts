// 2026-11-06: the HITMAN-style inventory — small things in a pocket (out of sight, found by a frisk), large ones in hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Director,type Mission,type Rules} from '../src/ai.ts';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {DetectionSystem} from '../src/detection.ts';
import {HotelAlert} from '../src/m3.ts';
import {MissionEvents} from '../src/events.ts';
const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
function system(){const map=json('marina.json') as Mission,level={...structuredClone(map),npcs:[]};const w=new CollisionWorld(level);const d=new Director(level,w,new NavGrid(w),sightBoxes(level),json('rules.json') as Rules);
 return new DetectionSystem(d,new MissionEvents(),new HotelAlert(),[],{...json('club-detection.json'),worldItems:[]},json('club-map.json'));}
const at={x:0,y:0,z:0};
test('a small thing goes into a pocket and out of sight; a large one cannot',()=>{const s=system();s.held='kitchen_knife';assert.ok(s.illegalShown('suit'));assert.equal(s.stow(),true);assert.deepEqual(s.pocket,['kitchen_knife']);assert.equal(s.held,'');assert.equal(s.illegalShown('suit'),false,'hidden in the pocket');
 s.held='briefcase';assert.equal(s.stow(),false);assert.equal(s.held,'briefcase');s.held='katana';assert.equal(s.stow(),true);assert.deepEqual(s.back,['katana'],'a sword goes to the back');});
test('taking from the pocket puts the thing in hand away first, or down if it is large',()=>{const s=system();s.pocket.push('hammer');s.held='crowbar';assert.ok(s.take('hammer','pocket',at));assert.equal(s.held,'hammer');assert.deepEqual(s.pocket,['crowbar']);
 s.held='briefcase';s.take('crowbar','pocket',at);assert.equal(s.held,'crowbar');assert.ok(s.floor.some(f=>f.item==='briefcase'),'the case is put down');});
test('pockets on: picking up with something small in hand pockets it instead of dropping it',()=>{const s=system();s.pockets=true;s.held='hammer';s.floor.push({key:99,item:'brick',pos:{x:0,y:0,z:0}});s.pickup({x:.2,y:0,z:0});assert.equal(s.held,'brick');assert.deepEqual(s.pocket,['hammer']);assert.equal(s.floor.length,0);});
// 2026-11-07: the game keeps pockets off until the inventory strip is finished in the UI lab; then the old thing is put down.
test('pockets off (the game now): picking up puts the old thing down where the new one was',()=>{const s=system();assert.equal(s.pockets,false);s.held='hammer';s.floor.push({key:99,item:'brick',pos:{x:0,y:0,z:0}});s.pickup({x:.2,y:0,z:0});assert.equal(s.held,'brick');assert.deepEqual(s.pocket,[]);assert.ok(s.floor.some(f=>f.item==='hammer'));});
test('a frisk still finds what is in the pockets',()=>{const g=readFileSync(new URL('../src/engine/game.ts',import.meta.url),'utf8');assert.match(g,/\.\.\.detection\.back,\.\.\.detection\.pocket,/);});

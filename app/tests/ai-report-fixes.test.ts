// 2026-11-04: fixes from CLEAN_HANDS_AI不具合_総括調査報告書 on the hotel data (the rest are AI lab scenarios,
// tests/ai-lab.test.ts).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {Director,type Mission,type Rules} from '../src/ai.ts';
const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
const hotel=json('hotel.json') as Mission,rules=json('rules.json') as Rules;
const world=new CollisionWorld(hotel),d=new Director({...hotel,npcs:[]},world,new NavGrid(world),sightBoxes(hotel),rules);
test('VISION-INDOOR-01: the passage between the kitchen and the lobby is indoors (14 m sight, not 25 m)',()=>{
 assert.equal(d.outdoorAt({x:-10.08,y:0,z:-9.68}),false);
 for(const z of [-18.9,-12,-1.5])assert.equal(d.outdoorAt({x:-11,y:0,z}),false,String(z));});
test('VISION-INDOOR-02: the pool and the quay stay outdoors',()=>{
 assert.equal(d.outdoorAt({x:0,y:0,z:8}),true);
 assert.equal(d.outdoorAt({x:0,y:0,z:22}),true);});
test('D01 (2026-11-06): a guard already in combat stays in combat when they witness a crime',()=>{
 const dd=new Director(structuredClone(hotel),world,new NavGrid(world),sightBoxes(hotel),structuredClone(rules));
 const g=dd.npcs.find(n=>n.id==='bodyguard_captain')!;
 const p={...g.pos,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
 g.state='combat';dd.accuse(g,p);
 assert.equal(g.state,'combat');assert.ok(g.knownDisguises.has('suit'));assert.deepEqual(g.lastSeen,{x:p.x,y:p.y,z:p.z});});

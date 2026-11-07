// HD12 (2026-11-07): two cases (briefcase, toolbox) each keep their own gun — put down, swapped, thrown and picked up
// again. Before, the one stored gun belonged to "the case", so with two cases it would have moved between them.
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
import {CASE_ITEMS,isCase,MELEE,LARGE_ITEMS} from '../src/melee.ts';
import {HOLD_KIND} from '../src/hold-pose.ts';

const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
function system(){const map=json('marina.json') as Mission,level={...structuredClone(map),npcs:[]};const w=new CollisionWorld(level);const d=new Director(level,w,new NavGrid(w),sightBoxes(level),json('rules.json') as Rules);
 return new DetectionSystem(d,new MissionEvents(),new HotelAlert(),[],{...json('club-detection.json'),worldItems:[]},json('club-map.json'));}
const gun={id:'pistol_silenced',mag:7,reserve:14};
const here={x:0,y:0,z:0},there={x:.3,y:0,z:0};

test('both cases swing, throw, hang from the hand and are too big for a pocket',()=>{
 assert.deepEqual(CASE_ITEMS,['briefcase','toolbox']);
 for(const id of CASE_ITEMS){assert.ok(isCase(id));assert.equal(MELEE[id].kind,'blunt');assert.equal(MELEE[id].throwable,true);assert.equal(HOLD_KIND[id],'hang');assert.ok(LARGE_ITEMS.includes(id));}
 assert.equal(isCase('katana'),false);});

test('a case put down keeps its gun; picking it up again brings the gun back',()=>{
 const s=system();s.held='briefcase';s.caseGun={...gun};s.putDown(here);
 assert.equal(s.caseGun,null,'nothing in hand holds the gun');assert.deepEqual(s.floor.find(f=>f.item==='briefcase')?.contents,gun);
 s.pickup(here);assert.equal(s.held,'briefcase');assert.deepEqual(s.caseGun,gun);});

test('swapping one case for the other: each keeps what it holds',()=>{
 const s=system();s.floor.push({key:90,item:'toolbox',pos:{...there},contents:null});
 s.held='briefcase';s.caseGun={...gun};s.pickup(there);
 assert.equal(s.held,'toolbox');assert.equal(s.caseGun,null,'the toolbox is empty');
 const left=s.floor.find(f=>f.item==='briefcase');assert.deepEqual(left?.contents,gun,'the gun stayed in the briefcase');
 s.pickup(there);assert.equal(s.held,'briefcase');assert.deepEqual(s.caseGun,gun);assert.equal(s.floor.find(f=>f.item==='toolbox')?.contents,null);});

test('a thrown case lands with its gun inside',()=>{
 const s=system();s.held='toolbox';s.caseGun={...gun};const {item,contents}=s.releaseHeld();
 assert.equal(item,'toolbox');assert.equal(s.held,'');assert.equal(s.caseGun,null);s.place(item,there,contents);
 s.pickup(there);assert.equal(s.held,'toolbox');assert.deepEqual(s.caseGun,gun);});

test('something that is not a case never takes the case gun along',()=>{
 const s=system();s.held='hammer';s.caseGun=null;s.putDown(here);assert.equal(s.floor.find(f=>f.item==='hammer')?.contents,null);});

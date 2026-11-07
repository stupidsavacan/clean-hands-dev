// 2026-11-06 (ROADMAP H33): the agent hiding in a locker, in the shared M3System.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Director,type Mission,type PlayerView,type Rules} from '../src/ai.ts';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {M3System,type HideDef} from '../src/m3.ts';
const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
const map=json('marina.json'),rules=json('rules.json');
const locker=(map.hides as HideDef[]).find(h=>h.id==='locker-courtyard')!;
const at:PlayerView={x:locker.x+locker.approach.x,y:0,z:locker.z+locker.approach.z,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
// A guard 4 m from the locker, looking at it (or away).
function setup(looking:boolean){const level=structuredClone(map) as Mission;level.npcs=[{id:'g',role:'guard',label:'警備',floor:0,route:[[at.x+4,at.z,600]],look:[at.x+5,at.z]}];
 const world=new CollisionWorld(level),d=new Director(level,world,new NavGrid(world),sightBoxes(level),rules as Rules),m=new M3System(d,map.hides as HideDef[],rules.m3);
 d.npcs[0].heading=looking?-Math.PI/2:Math.PI/2;m.canHide=()=>true;return {m,d,g:d.npcs[0]};}
const tap=(m:M3System,key:string,p=at)=>{m.step(1/60,p,0,new Set([key]));m.step(1/60,p,0,new Set());};
test('E at a free locker hides the agent; nobody sees them inside; E again comes out',()=>{const {m,g}=setup(false);
 assert.match(m.prompt(at),/に隠れる/);tap(m,'KeyE');assert.equal(m.hiddenIn?.id,locker.id);assert.ok(m.locked);assert.deepEqual(m.slots.get(locker.id),['agent']);assert.match(m.prompt(at),/から出る/);
 g.heading=-Math.PI/2;g.perceive({...at,hidden:true},m.director.boxes,m.director.rules);assert.equal(g.visibility,0);
 tap(m,'KeyE',{...at,hidden:true});assert.equal(m.hiddenIn,null);assert.deepEqual(m.slots.get(locker.id),[]);});
test('a guard who saw the agent get in comes and opens the locker',()=>{const {m,d,g}=setup(true);tap(m,'KeyE');assert.ok(m.hiddenIn);assert.equal(g.state,'investigate');
 const inside={...at,hidden:true};for(let t=0;t<20&&m.hiddenIn;t+=1/30){d.step(1/30,inside);m.step(1/30,inside,0,new Set());}
 assert.equal(m.hiddenIn,null);assert.equal(g.state,'alert');assert.ok(g.knownDisguises.has('suit'));});
test('a locker with a body in it has no room for the agent',()=>{const {m}=setup(false);m.slots.get(locker.id)!.push('someone');tap(m,'KeyE');assert.equal(m.hiddenIn,null);assert.match(m.prompt(at),/満杯/);});
test('without the map opting in (canHide), E at a locker does nothing for the agent',()=>{const {m}=setup(false);m.canHide=undefined;tap(m,'KeyE');assert.equal(m.hiddenIn,null);assert.doesNotMatch(m.prompt(at),/隠れる/);
 m.canHide=()=>false;tap(m,'KeyE');assert.equal(m.hiddenIn,null);});

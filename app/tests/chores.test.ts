// 2026-11-06 (ROADMAP H06/H14/H17): blood stays until the cleaner cleans it with the vacuum.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Director,type Mission,type Rules} from '../src/ai.ts';
import {CollisionWorld,plateY} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {DeviceSystem,type DeviceDef} from '../src/devices.ts';
import {ChoreSystem,CLEAN_SECONDS} from '../src/chores.ts';
const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
const map=json('marina.json'),rules=json('rules.json');
const vacuum:DeviceDef={id:'v',kind:'vacuum',label:'掃除機',x:-2,z:4,y:0,floor:0,heading:0,approach:{x:-2,z:4.7}};
function setup(){const level=structuredClone(map) as Mission;level.npcs=[
  {id:'victim',role:'waiter',label:'給仕',floor:0,route:[[-8,7,600]],look:[-8,6]},
  {id:'g',role:'guard',label:'警備',floor:0,route:[[-4,7,600]],look:[-5,7]},
  {id:'c',role:'waiter',label:'清掃員',floor:0,route:[[0,8,600]],look:[1,8]}];
 const world=new CollisionWorld(level),d=new Director(level,world,new NavGrid(world),sightBoxes(level),rules as Rules),dev=new DeviceSystem(d,[vacuum],f=>plateY(level,f));
 const [victim,g,c]=d.npcs;g.heading=-Math.PI/2;return {d,dev,ch:new ChoreSystem(d,dev,['c']),victim,g,c};}
const at=(n:{pos:{x:number;y:number;z:number}},p:{x:number;y:number;z:number}|null)=>{n.pos={...p!};};
test('a shot leaves blood; a guard who sees it looks; the cleaner fetches the vacuum, cleans and takes it back',()=>{const {dev,ch,victim,g,c}=setup();
 victim.life='dead';victim.deathMethod='gun';ch.step(.1);assert.equal(ch.messes.length,1);assert.equal(ch.messes[0].seen,true);assert.notEqual(g.state,'patrol');
 assert.equal(ch.job?.phase,'fetch');assert.deepEqual([c.scriptedGoal!.x,c.scriptedGoal!.z],[-2,4.7]);
 at(c,c.scriptedGoal);ch.step(.1);assert.equal(ch.job?.phase,'carry');at(c,c.scriptedGoal);ch.step(.1);assert.equal(ch.job?.phase,'clean');assert.equal(c.scriptedAction,'clean');
 assert.ok(dev.on.has('v')&&dev.operated.has('v'),'running');const v=dev.devices[0];assert.ok(Math.hypot(v.x-c.pos.x,v.z-c.pos.z)<.6,'vacuum beside the cleaner');
 for(let t=0;t<CLEAN_SECONDS+.2;t+=.1)ch.step(.1);assert.equal(ch.messes.length,0);assert.equal(dev.on.size,0);assert.equal(ch.job?.phase,'return');
 at(c,c.scriptedGoal);ch.step(.1);assert.equal(ch.job,null);assert.equal(c.scriptedGoal,null);assert.deepEqual([v.x,v.z],[-2,4]);});
test('a wire kill leaves no blood; unseen blood is not cleaned; an alerted cleaner drops the job',()=>{const a=setup();a.victim.life='dead';a.victim.deathMethod='direct';a.ch.step(.1);assert.equal(a.ch.messes.length,0);
 const b=setup();b.g.heading=Math.PI/2;b.victim.life='dead';b.victim.deathMethod='kitchen_knife';b.ch.step(.1);assert.equal(b.ch.messes[0].seen,false);assert.equal(b.ch.job,null);
 const c=setup();c.victim.life='dead';c.victim.deathMethod='finish';c.ch.step(.1);at(c.c,c.c.scriptedGoal);c.ch.step(.1);c.c.state='alert';c.ch.step(.1);assert.equal(c.ch.job,null);assert.equal(c.c.scriptedGoal,null);assert.equal(c.ch.messes.length,1);});
test('the club has a cleaner and a vacuum for the job',()=>{const m=json('club-mission.json');assert.deepEqual(m.cleaners,['cleaner']);assert.ok(m.devices.some((d:{kind:string})=>d.kind==='vacuum'));});

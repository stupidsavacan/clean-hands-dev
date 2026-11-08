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
function setup(twoCleaners=false,blockers:Mission['blockers']=[]){const level=structuredClone(map) as Mission;level.blockers.push(...blockers);level.npcs=[
  {id:'victim',role:'waiter',label:'給仕',floor:0,route:[[-8,7,600]],look:[-8,6]},
  {id:'g',role:'guard',label:'警備',floor:0,route:[[-4,7,600]],look:[-5,7]},
  {id:'c',role:'waiter',label:'清掃員',floor:0,route:[[0,8,600]],look:[1,8]}];
 const world=new CollisionWorld(level),d=new Director(level,world,new NavGrid(world),sightBoxes(level),rules as Rules),dev=new DeviceSystem(d,[vacuum],f=>plateY(level,f));
 const [victim,g,c]=d.npcs;const other=twoCleaners?d.addNpc({...level.npcs[2],id:'other',route:[[4,8,600]]}):undefined;
 g.heading=-Math.PI/2;return {d,dev,ch:new ChoreSystem(d,dev,other?['c',other.id]:['c']),victim,g,c,other};}
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
test('C12 another cleaner resumes from the same partial cleanup after the first is called away',()=>{
 const {ch,dev,c,other}=setup(true);
 const m=ch.add('blood',{x:-8,y:0,z:7});m.seen=true;
 ch.step(.1);assert.equal(ch.job?.cleaner,c);
 at(c,c.scriptedGoal);ch.step(.1);at(c,c.scriptedGoal);ch.step(.1);
 ch.step(CLEAN_SECONDS*.5);
 assert.equal(m.cleaned,.5);
 const otherTask={x:9,y:0,z:8};c.scriptedGoal=otherTask;
 ch.step(.1);
 assert.equal(ch.job,null);assert.equal(c.scriptedGoal,otherTask);assert.equal(dev.on.size,0);
 ch.step(.1);
 assert.equal(ch.job?.cleaner,other);
 at(other!,other!.scriptedGoal);ch.step(.1);at(other!,other!.scriptedGoal);ch.step(.1);
 assert.equal(ch.job?.phase,'clean');assert.equal(m.cleaned,.5);
 ch.step(CLEAN_SECONDS*.25);
 assert.equal(m.cleaned,.75);
 ch.step(CLEAN_SECONDS*.25);
 assert.equal(ch.messes.length,0);assert.equal(ch.job?.phase,'return');
});

test('E09 an interrupted return leaves the vacuum where it was and another cleaner brings it home',()=>{
 const {ch,dev,c,other}=setup(true);
 const m=ch.add('blood',{x:-8,y:0,z:7});m.seen=true;
 ch.step(.1);at(c,c.scriptedGoal);ch.step(.1);at(c,c.scriptedGoal);ch.step(.1);
 ch.step(CLEAN_SECONDS);assert.equal(ch.job?.phase,'return');assert.equal(ch.messes.length,0);
 const v=dev.devices[0],leftAt=dev.spot(v);
 c.life='unconscious';ch.step(.1);
 assert.equal(ch.job,null);assert.deepEqual(dev.spot(v),leftAt);
 ch.step(.1);
 assert.equal(ch.job?.cleaner,other);assert.equal(ch.job?.phase,'fetch');
 assert.deepEqual(other!.scriptedGoal,leftAt);
 at(other!,other!.scriptedGoal);ch.step(.1);
 assert.equal(ch.job?.phase,'return');assert.equal(dev.on.size,0);
 at(other!,other!.scriptedGoal);ch.step(.1);
 assert.equal(ch.job,null);assert.deepEqual([v.x,v.z],[-2,4]);
 assert.equal(other!.scriptedGoal,null);
});

test('a cleaner goes around a blocked approach to reach a blood pool',()=>{
 const obstacle={id:'cleanup-obstacle',x:-7.44,z:6.79,y:0,floor:0,w:.26,d:.26,h:1};
 const {ch,d,c}=setup(false,[obstacle]);
 const m=ch.add('blood',{x:-8,y:0,z:7});m.seen=true;
 ch.step(.1);at(c,c.scriptedGoal);
 const direction=Math.atan2(c.pos.x-m.pos.x,c.pos.z-m.pos.z);
 const blocked={x:m.pos.x+Math.sin(direction)*.6,y:0,z:m.pos.z+Math.cos(direction)*.6};
 assert.equal(d.nav.clear(blocked,blocked),false);
 ch.step(.1);
 assert.equal(ch.job?.phase,'carry');
 assert.notDeepEqual(c.scriptedGoal,blocked);
 assert.ok(d.nav.clear(c.scriptedGoal!,c.scriptedGoal!));
});

test('a cleaner drops a stalled errand and can take another cleanup',()=>{
 const {ch,c}=setup();
 const first=ch.add('blood',{x:-8,y:0,z:7});first.seen=true;
 const second=ch.add('blood',{x:-6,y:0,z:7});second.seen=true;
 ch.step(.1);assert.equal(ch.job?.mess,first);
 ch.step(3);
 assert.equal(ch.job,null);assert.equal(c.scriptedGoal,null);
 ch.step(.1);
 assert.equal(ch.job?.mess,second);
 assert.equal(first.cleaned,0);
});

test('C09 water remains after the tap closes and is mopped up with the vacuum left at home',()=>{
 const {d,c}=setup(),sink={...vacuum,id:'sink',kind:'sink' as const,label:'蛇口',x:-8,z:7,approach:{x:-8,z:7.6}};
 const dev=new DeviceSystem(d,[sink,vacuum],()=>0,['c']),ch=new ChoreSystem(d,dev,['c']);
 const spot=dev.spot(sink);
 dev.toggle(spot);dev.step(2);ch.step(.1);ch.step(.1);
 assert.equal(ch.messes.length,1);assert.equal(ch.messes[0].kind,'water');assert.equal(ch.job,null);
 c.pos={...spot};c.arrived=true;dev.step(3);
 assert.equal(dev.on.size,0);c.state='patrol';ch.step(.1);
 assert.equal(ch.job?.phase,'carry');assert.equal(ch.job?.vacuum,undefined);
 at(c,c.scriptedGoal);ch.step(.1);
 assert.equal(c.scriptedAction,'mop_floor');
 ch.step(CLEAN_SECONDS);
 assert.equal(ch.messes.length,0);assert.equal(ch.job,null);
 const v=dev.devices.find(d=>d.kind==='vacuum')!;
 assert.deepEqual([v.x,v.z],[vacuum.x,vacuum.z]);assert.equal(dev.operated.size,0);
});

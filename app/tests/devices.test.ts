// 2026-11-06 (ROADMAP H15): a radio switched on brings someone over to switch it off.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Director,type Mission,type Rules} from '../src/ai.ts';
import {CollisionWorld,plateY} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {CALL_EVERY,DeviceSystem,DEVICE_KINDS,type DeviceDef} from '../src/devices.ts';
const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
const map=json('marina.json'),rules=json('rules.json');
const radio:DeviceDef={id:'r',kind:'radio',label:'ラジカセ',x:-8,z:7,y:.9,floor:0,heading:0,approach:{x:-8,z:8}};
function setup(){const level=structuredClone(map) as Mission;level.npcs=[{id:'w',role:'waiter',label:'給仕',floor:0,route:[[-3,8,600]],look:[-2,8]}];
 const world=new CollisionWorld(level),d=new Director(level,world,new NavGrid(world),sightBoxes(level),rules as Rules);return {d,s:new DeviceSystem(d,[radio],f=>plateY(level,f)),n:d.npcs[0]};}
const far={x:30,y:0,z:30,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
test('C07 simultaneous devices assign different responders and preserve each destination',()=>{
 const {d,n}=setup();
 d.addNpc({...d.mission.npcs[0],id:'other',route:[[-2,8,600]]});
 const tv={...radio,id:'t',kind:'tv' as const,x:-7,z:10,approach:{x:-7,z:10.8}};
 const s=new DeviceSystem(d,[radio,tv],()=>0);
 s.toggle(s.spot(radio));s.toggle(s.spot(tv));
 s.step(1/60);
 assert.equal(s.responders.get('r'),n);
 assert.equal(s.responders.get('t')?.id,'other');
 assert.deepEqual(n.goal,s.spot(radio));
 assert.deepEqual(s.responders.get('t')?.goal,s.spot(tv));
});

test('C07 and G11 a new investigation interrupts the responder and the powered device waits for the replacement',()=>{
 const {d,s,n}=setup(),spot=s.spot(radio);
 const other=d.addNpc({...d.mission.npcs[0],id:'other',route:[[-2,8,600]]});
 s.toggle(spot);s.step(1/60);
 n.pos={...spot};n.arrived=true;s.step(DEVICE_KINDS.radio.stay-.25);
 assert.ok(s.on.has('r'));
 const interruption={x:-1,y:0,z:8};
 n.hear(interruption,d.rules);
 s.step(CALL_EVERY);
 assert.deepEqual(n.goal,interruption);
 assert.equal(s.responders.get('r'),other);
 assert.ok(s.on.has('r'));
 other.pos={...spot};other.arrived=true;s.step(.5);
 assert.ok(s.on.has('r'),'the replacement gets its own wait');
 s.step(DEVICE_KINDS.radio.stay);
 assert.equal(s.on.size,0);
 assert.equal(s.responders.size,0);
});
test('E by the radio switches it on; someone nearby walks over, switches it off and goes back',()=>{const {d,s,n}=setup();
 assert.match(s.prompt({x:-8,y:0,z:7.8}),/点ける/);s.toggle({x:-8,y:0,z:7.8});assert.ok(s.on.has('r'));
 let offAt=-1;for(let t=0;t<25&&offAt<0;t+=1/30){d.step(1/30,far);s.step(1/30);if(!s.on.has('r'))offAt=t;}
 assert.ok(offAt>0,'switched off');assert.ok(Math.hypot(n.pos.x+8,n.pos.z-8)<1,'at the radio');
 for(let t=0;t<15;t+=1/30)d.step(1/30,far);assert.equal(n.state,'patrol');});
test('E again switches it off at once and no one is called',()=>{const {d,s,n}=setup();s.toggle({x:-8,y:0,z:7.8});s.toggle({x:-8,y:0,z:7.8});assert.equal(s.on.size,0);for(let t=0;t<3;t+=1/30){d.step(1/30,far);s.step(1/30);}assert.equal(n.state,'patrol');});
test('the club radio stands on a crate at the loading dock, its front on open floor',()=>{const m=json('club-mission.json'),w=new CollisionWorld(json('club-map.json'));const r=m.devices.find((d:DeviceDef)=>d.kind==='radio');
 assert.equal(r.kind,'radio');assert.ok(w.blocked(r.x,0,r.z,.3),'on the crate');assert.equal(w.blocked(r.approach.x,0,r.approach.z,.3),false);});
// H16, H17: the kinds differ in how long the one who comes stays, and how far they are heard.
test('a TV is watched for a while before it is switched off; a vacuum cleaner is heard from further away',()=>{
 const tv={...radio,id:'t',kind:'tv' as const,label:'テレビ'};const {d,s}=(()=>{const level=structuredClone(map) as Mission;level.npcs=[{id:'w',role:'waiter',label:'給仕',floor:0,route:[[-3,8,600]],look:[-2,8]}];
  const world=new CollisionWorld(level),d=new Director(level,world,new NavGrid(world),sightBoxes(level),rules as Rules);return {d,s:new DeviceSystem(d,[tv],f=>plateY(level,f))};})();
 s.toggle({x:-8,y:0,z:7.8});let arrived=-1,off=-1;for(let t=0;t<40&&off<0;t+=1/30){d.step(1/30,far);s.step(1/30);const n=d.npcs[0];if(arrived<0&&Math.hypot(n.pos.x+8,n.pos.z-8)<.8)arrived=t;if(!s.on.size)off=t;}
 assert.ok(arrived>0&&off-arrived>=9.5,`watched ${off-arrived}s`);
 assert.ok(DEVICE_KINDS.vacuum.radius>DEVICE_KINDS.radio.radius);
 const level=structuredClone(map) as Mission;level.npcs=[{id:'w',role:'waiter',label:'給仕',floor:0,route:[[3,8,600]],look:[4,8]}];// 11 m away: too far for a radio
 const world=new CollisionWorld(level),dd=new Director(level,world,new NavGrid(world),sightBoxes(level),rules as Rules);
 const r=new DeviceSystem(dd,[radio],f=>plateY(level,f));r.toggle({x:-8,y:0,z:7.8});r.step(1/30);assert.equal(r.responders.size,0);
 const v=new DeviceSystem(dd,[{...radio,id:'v',kind:'vacuum',label:'掃除機'}],f=>plateY(level,f));v.toggle({x:-8,y:0,z:7.8});v.step(1/30);assert.equal(v.responders.size,1);});
test('the club TV stands on the office desk and the vacuum in the back corridor, each with open floor in front',()=>{const m=json('club-mission.json'),w=new CollisionWorld(json('club-map.json'));
 assert.deepEqual(m.devices.filter((d:DeviceDef)=>d.kind!=='sink').map((d:DeviceDef)=>d.kind),['radio','tv','vacuum']);for(const d of m.devices)assert.equal(w.blocked(d.approach.x,0,d.approach.z,.3),false,d.id);});
test('C08 the sink overflows after running and calls a cleaner rather than a closer visitor',()=>{
 const {d,n}=setup();
 const cleaner=d.addNpc({...d.mission.npcs[0],id:'cleaner',route:[[-2,8,600]]});
 const sink={...radio,kind:'sink' as const,label:'蛇口'},s=new DeviceSystem(d,[sink],()=>0,['cleaner']);
 const at=s.spot(sink);
 assert.match(s.prompt(at),/開ける/);
 s.toggle(at);s.step(.5);
 assert.equal(s.overflowing.size,0);
 assert.match(s.prompt(at),/閉める/);
 s.step(1.1);
 assert.ok(s.overflowing.has(sink.id));assert.equal(s.responders.get(sink.id),cleaner);assert.equal(n.state,'patrol');
 cleaner.pos={...at};cleaner.arrived=true;s.step(DEVICE_KINDS.sink.stay);
 assert.equal(s.on.size,0);assert.equal(s.overflowing.size,0);
});

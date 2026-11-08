import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {segmentClear,sightBoxes} from '../src/sight.ts';
import {Director,baseRate,permission,suspicionRate,zoneAt,type Mission,type PlayerView,type Rules} from '../src/ai.ts';
const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
const map=json('marina.json') as Mission,rules=json('rules.json') as Rules;
const world=new CollisionWorld(map),nav=new NavGrid(world),boxes=sightBoxes(map);
const player=(x:number,z:number,o:Partial<PlayerView>={}):PlayerView=>({x,y:0,z,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit',...o});
// A director with only the named NPCs, so a scenario is not disturbed by the rest of the cast.
const only=(...ids:string[])=>new Director({...map,npcs:map.npcs.filter(n=>ids.includes(n.id))},world,nav,boxes,rules);
const run=(d:Director,p:PlayerView|((t:number)=>PlayerView),seconds:number)=>{const events:string[]=[];for(let t=0;t<seconds;t+=1/60){for(const e of d.step(1/60,typeof p==='function'?p(t):p))events.push(e.type);if(d.caught)break;}return events;};
test('walls and the upper floor block sight; a hedge hides a crouching agent but not a standing one',()=>{
 assert.equal(segmentClear(boxes,{x:-8,y:1.6,z:5},{x:-12,y:1.5,z:-5}),false,'lobby wall');
 assert.equal(segmentClear(boxes,{x:-8,y:1.6,z:5},{x:5,y:1.5,z:-5}),true,'open courtyard');
 assert.equal(segmentClear(boxes,{x:-8,y:1.6,z:-4},{x:-8,y:4.6,z:-4}),false,'2F slab');
 assert.equal(segmentClear(boxes,{x:-10,y:1.6,z:4},{x:-15,y:.6,z:4}),false,'crouched behind planter');
 assert.equal(segmentClear(boxes,{x:-10,y:1.6,z:4},{x:-15,y:1.75,z:4}),true,'head above the hedge');});
test('the nav grid finds clear routes into the service corridor and up the stairs',()=>{
 for(const [from,to] of [[{x:-8,y:0,z:9.5},{x:-13.15,y:0,z:-8.6}],[{x:5,y:0,z:-2},{x:-12.6,y:0,z:1.5}],[{x:-8,y:0,z:6},{x:-9,y:3.5,z:-4}]]){
  const path=nav.find(from,to);assert.ok(path&&path.length,'no path');let at=from;for(const q of path!){assert.ok(nav.clear(at,q),`blocked leg ${JSON.stringify(at)}→${JSON.stringify(q)}`);at=q;}
  assert.ok(Math.hypot(at.x-to.x,at.z-to.z)<.4&&Math.abs(at.y-to.y)<.1);}});
test('initial suspicion values follow the design rules',()=>{
 const staff=zoneAt(map.zones,-12,-6,0),pool=zoneAt(map.zones,0,8,0);assert.equal(staff?.type,'staff');assert.equal(permission(rules,'suit',staff),'deny');assert.equal(permission(rules,'suit',pool),'allow');
 assert.equal(baseRate(rules,player(0,8,{speed:1.6}),'allow','public'),0);assert.equal(baseRate(rules,player(0,8,{running:true}),'allow','public'),15);assert.equal(baseRate(rules,player(0,8,{crouched:true}),'allow','public'),5);assert.equal(baseRate(rules,player(-12,-6,{tampering:true}),'deny','staff'),45);
 const o={distance:8,visibility:1,still:false,crowd:0,sensitivity:1};assert.equal(suspicionRate(rules,25,o),25);assert.equal(suspicionRate(rules,25,{...o,distance:1.5}),50);assert.equal(suspicionRate(rules,25,{...o,visibility:2/3}),12.5);
 assert.equal(suspicionRate(rules,15,{...o,crowd:3}),15*.4);assert.equal(suspicionRate(rules,25,{...o,visibility:0}),-10);assert.ok(suspicionRate(rules,0,o)<0);});
test('walking normally past the pool guard raises nothing',()=>{const d=only('guard-pool');const ev=run(d,t=>player(-1+t*.8,8.2,{speed:1.6}),14);assert.equal(d.npcs[0].suspicion,0);assert.ok(!ev.includes('curious'));});
// F04 / HITMAN (2026-11-02): trespassing gets a warning first; staying on after it is an arrest, and only then a catch.
test('standing in the service corridor in view: curious, investigate, a warning, then an arrest and the catch',()=>{const d=only('guard-service');
 const g=d.npcs[0];g.pos={x:-11.15,y:0,z:-1.2};g.heading=Math.PI;g.routeIndex=2;const ev=run(d,player(-11.2,-5.6,{speed:1.65}),20);
 assert.deepEqual(ev.filter(e=>e!=='calm').slice(0,5),['curious','investigate','warn','arrest','caught']);});
test('leaving after the warning ends it: no arrest, no catch, the outfit is not blown',()=>{const d=only('guard-service');
 const g=d.npcs[0];g.pos={x:-11.15,y:0,z:-1.2};g.heading=Math.PI;g.routeIndex=2;let warned=-1;const ev:string[]=[];
 for(let t=0;t<20;t+=1/60){const out=warned>=0&&t>warned+1;for(const e of d.step(1/60,out?player(-8,6,{speed:1.2}):player(-11.2,-5.6,{speed:1.65})))ev.push(e.type);if(warned<0&&ev.includes('warn'))warned=t;}
 assert.ok(ev.includes('warn'),ev.join());assert.ok(!ev.includes('arrest')&&!d.caught,ev.join());assert.equal(d.compromised.has('suit'),false);assert.notEqual(g.state,'alert');});
test('a running agent in public makes a guard curious but not alarmed in a short dash',()=>{const d=only('guard-pool');const g=d.npcs[0];g.pos={x:-1.4,y:0,z:8.8};g.heading=Math.PI/2;
 const ev=run(d,t=>player(0+t*4.8,10.5,{speed:4.8,running:true}),2.2);assert.ok(ev.includes('curious'));assert.ok(!ev.includes('alert'));});
test('losing the guard leads to a search, then he calms down and returns to patrol',()=>{const d=only('guard-service');const g=d.npcs[0];g.pos={x:-11.15,y:0,z:-1.2};g.heading=Math.PI;g.routeIndex=2;
 for(let t=0;t<8&&g.state!=='alert';t+=1/60)d.step(1/60,player(-11.2,-6.5,{speed:1}));assert.equal(g.state,'alert');const pursuit=[];
 for(let t=0;t<30;t+=1/60)for(const e of d.step(1/60,player(10,10)))if(e.pursuitReason)pursuit.push([e.type,e.pursuitReason]);
 assert.deepEqual(pursuit,[['search','lost_contact'],['calm','search_expired']]);assert.equal(d.caught,false);assert.ok(g.suspicion<60);});
test('a guard at the right x and z on the wrong floor keeps travelling to the evidence',()=>{
 const d=only('guard-service'),g=d.npcs[0];
 const ground={x:-12.6,y:0,z:-4};
 g.pos={...ground,y:3.5};
 g.radio(ground,d.rules);
 g.move(1/60,world,nav,rules,player(10,10));
 assert.equal(g.arrived,false);
 assert.equal(g.state,'investigate');
});

test('a thrown coin pulls the nearest NPC over to look, then he goes back',()=>{const d=only('guard-lobby','guard-service');const spot={x:-8,y:0,z:-5};const n=d.noise(spot);assert.equal(n?.id,'guard-lobby');assert.equal(n!.state,'distracted');
 let near=9;for(let t=0;t<16;t+=1/60){d.step(1/60,player(10,10));near=Math.min(near,Math.hypot(n!.pos.x-spot.x,n!.pos.z-spot.z));}assert.ok(near<1,'walked to the coin');assert.equal(n!.state,'patrol');});
test('blending into a group of three guests slows how fast running is noticed',()=>{const d=only('guest-a','guest-b','guest-c','guard-pool');assert.equal(d.crowdAt(2.4,10),3);});
test('patrols keep moving for a minute without getting stuck',()=>{const d=new Director(map,world,nav,boxes,rules);const start=d.npcs.map(n=>({...n.pos}));const seen=d.npcs.map(()=>new Set<number>());
 for(let t=0;t<60;t+=1/60){d.step(1/60,player(14,-10));d.npcs.forEach((n,i)=>seen[i].add(n.routeIndex));}
 d.npcs.forEach((n,i)=>{if(n.route.length>1)assert.equal(seen[i].size,n.route.length,`${n.id} reached ${[...seen[i]]}`);else assert.ok(Math.hypot(n.pos.x-start[i].x,n.pos.z-start[i].z)<.5);});});

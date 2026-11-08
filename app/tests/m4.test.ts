import {test}from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from 'node:fs';
import {Director,Npc,permission,type Mission,type PlayerView,type Rules}from '../src/ai.ts';
import {CollisionWorld}from '../src/world.ts';
import {NavGrid}from '../src/nav.ts';
import {sightBoxes}from '../src/sight.ts';
import {M4System}from '../src/m4.ts';
import type {HideDef}from '../src/m3.ts';
import {CHARACTERS,sanitizeLook,encodeLook,decodeLook}from '../src/wardrobe.ts';
import {sampleM4Motion}from '../src/m4-motion.ts';
const map=JSON.parse(readFileSync(new URL('../src/data/marina.json',import.meta.url),'utf8')),rules=JSON.parse(readFileSync(new URL('../src/data/rules.json',import.meta.url),'utf8'));
const player=(x=-8,z=7.9,disguise='suit'):PlayerView=>({x,y:0,z,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise});
function setup(hides:HideDef[]=[]){const level=structuredClone(map)as Mission;level.npcs=[{id:'source',role:'guard',label:'制服の持ち主',floor:0,route:[[-8,7,600]],look:[-8,6]},{id:'guard-service',role:'guard',label:'検査員',floor:0,route:[[-12.6,1.7,600]],look:[-12.6,0]},{id:'observer',role:'guard',label:'目撃者',floor:0,route:[[-4,7,600]],look:[-3,7]}];const world=new CollisionWorld(level),d=new Director(level,world,new NavGrid(world),sightBoxes(level),structuredClone(rules)as Rules),m=new M4System(d,map.checkpoints,rules.m4,hides);d.npcs[0].life='unconscious';d.npcs[0].fall=1;d.npcs[2].heading=Math.PI/2;return{m,d,source:d.npcs[0],guard:d.npcs[1],observer:d.npcs[2]};}
function hold(m:M4System,key:string,seconds:number,p=player()){for(let t=0;t<seconds;t+=1/60)m.step(1/60,{...p,disguise:m.disguise},0,new Set([key]));m.step(1/60,{...p,disguise:m.disguise},0,new Set());}
test('every disguise row (nine, and five outsiders added in M5.7) is data driven and unknown outfits do not grant access',()=>{const {d}=setup(),staff={...map.zones.find((z:{type:string})=>z.type==='staff')};assert.equal(Object.keys(d.rules.disguises).length,14);assert.equal(permission(d.rules,'suit',staff),'deny');assert.equal(permission(d.rules,'waiter',staff),'allow');assert.equal(permission(d.rules,'guard',staff),'allow');assert.equal(permission(d.rules,'unknown',staff),'deny');d.rules.disguises.waiter.staff='deny';assert.equal(permission(d.rules,'waiter',staff),'deny');});
test('taking a uniform consumes one source and leaves recoverable original clothes',()=>{const {m,source}=setup();hold(m,'KeyT',2);assert.equal(m.disguise,'guard');assert.ok(m.taken.has(source.id));assert.equal(m.clothes.length,1);assert.equal(m.clothes[0].disguise,'suit');assert.equal(m.stats.changes,1);hold(m,'KeyT',2);assert.equal(m.disguise,'suit');assert.equal(m.clothes.length,1);assert.equal(m.clothes[0].disguise,'guard');assert.equal(m.stats.changes,2);});
test('the revived owner recognises their own uniform even after it has been put down and picked up again',()=>{
 const {m,d,source,observer}=setup();
 hold(m,'KeyT',2);assert.equal(m.outfitOwner,source.id);
 hold(m,'KeyT',2);assert.equal(m.outfitOwner,undefined);
 assert.equal(m.clothes[0].owner,source.id);
 hold(m,'KeyT',2);assert.equal(m.outfitOwner,source.id);
 source.life='active';source.fall=0;source.heading=0;source.look!.splice(0,2,-8,9);
 source.post.push('ZONE_public_lobby');
 const p=player(-8,8.5,'guard');
 for(let i=0;i<30;i++)d.step(1/60,p);
 assert.equal(source.face,0,'an identical uniform from another source is insufficient');
 d.boxes.push({minX:-9,maxX:-7,minY:0,maxY:3,minZ:7.5,maxZ:7.6});
 for(let i=0;i<30;i++)d.step(1/60,{...p,outfitOwner:m.outfitOwner});
 assert.equal(source.face,0,'the owner must see the uniform');
 d.boxes.pop();
 let checked=false;
 for(let i=0;i<140&&!checked;i++)checked=d.step(1/60,{...p,outfitOwner:m.outfitOwner}).some(e=>e.npc===source&&e.type==='verify');
 assert.ok(checked);
 assert.equal(observer.face,0);
 m.disguise='guard';assert.equal(m.outfitOwner,undefined);
});
test('active, hidden, distant or wall-obstructed people are not uniform sources',()=>{const {m,d,source}=setup();source.life='active';assert.equal(m.source(player()),undefined);source.life='unconscious';source.bodyMode='hidden';assert.equal(m.source(player()),undefined);source.bodyMode='ground';assert.equal(m.source(player(5,9)),undefined);d.boxes.push({minX:-9,maxX:-7,minY:0,maxY:3,minZ:7.3,maxZ:7.4});assert.equal(m.source(player()),undefined);});
test('an undressed NPC changes only at a stocked locker and an interruption leaves the outfit missing',()=>{
 const locker:HideDef={id:'locker',label:'ロッカー',x:-8,y:0,z:10,heading:0,capacity:1,spareClothes:true,approach:{x:0,z:-1},size:{w:.65,h:1.9,d:.55}};
 const {m,source}=setup([{...locker,id:'empty',x:-7,z:7,spareClothes:false},locker]);
 hold(m,'KeyT',2);
 assert.ok(m.isUndressed(source));assert.equal(source.scriptedGoal,null);
 source.life='active';source.fall=0;
 const step=(dt:number)=>m.step(dt,{...player(-12,8,m.disguise),hidden:true},0,new Set());
 step(.1);
 const at={x:-8,y:0,z:9};
 assert.deepEqual(source.scriptedGoal,at);assert.ok(m.isUndressed(source));
 source.pos=at;
 step(m.rules.changeSeconds/2);
 source.state='search';step(.1);
 assert.ok(m.isUndressed(source));assert.equal(source.scriptedGoal,null);
 source.state='patrol';step(m.rules.changeSeconds/2);
 assert.ok(m.isUndressed(source));
 step(m.rules.changeSeconds);
 assert.equal(m.isUndressed(source),false);assert.equal(source.scriptedGoal,null);
 assert.equal(m.outfitOwner,source.id,'the player still wears the original uniform');
 m.disguise='suit';source.life='unconscious';source.fall=1;
 assert.equal(m.source(player(-8,9.4)),undefined,'the original source cannot be looted a second time');
});
test('cancelled clothes changes leave outfit and sources intact',()=>{const {m,source}=setup();hold(m,'KeyT',.5);assert.equal(m.disguise,'suit');assert.equal(m.taken.has(source.id),false);assert.equal(m.action,null);assert.equal(m.clothes.length,0);});
function faceSetup(knows=['guard']){const {d,observer}=setup();d.npcs.splice(0,2);observer.pos={x:-8,y:0,z:7};observer.heading=0;observer.route.splice(0,1,[-8,7,600]);observer.look?.splice(0,2,-8,10);observer.knowsFaces.push(...knows);return{d,observer};}
test('only a face-knower fills the white gauge, separate from suspicion, then checks and blows the outfit',()=>{const {d,observer}=faceSetup([]);const p={...player(-8,9,'guard'),speed:1.65};for(let i=0;i<90;i++)d.step(1/60,p);assert.equal(observer.face,0);assert.equal(observer.suspicion,0);
 observer.knowsFaces.push('guard');let verified=false;for(let i=0;i<60&&!d.compromised.size;i++){d.step(1/60,p);if(observer.state==='verify'){verified=true;assert.equal(observer.suspicion,0);}}
 assert.ok(verified);assert.ok(d.compromised.has('guard'));assert.equal(observer.state,'alert');});
test('the white gauge needs the front view within 8 m and at the post; crowds hide the face beyond 2 m',()=>{const run=(f:(o:ReturnType<typeof faceSetup>)=>PlayerView)=>{const o=faceSetup();const p=f(o);for(let i=0;i<120;i++)o.d.step(1/60,p);return o.observer.face;};
 assert.equal(run(()=>player(-8,15.5,'guard')),0);
 assert.equal(run(o=>{o.observer.heading=Math.PI;o.observer.look?.splice(0,2,-8,4);return player(-8,12,'guard');}),0);
 assert.equal(run(o=>{(o.observer as {post:string[]}).post.push('ZONE_public_lobby');return player(-8,12,'guard');}),0);
 assert.equal(run(o=>{for(const [i,x] of [-9,-8.6,-7.4].entries())o.d.npcs.push(new Npc({id:'crowd'+i,role:'guest',label:'客',floor:0,route:[[x,12.4,600]],look:[x,13]},map,o.d.compromised));return player(-8,12,'guard');}),0);
 assert.ok(run(()=>player(-8,12,'guard'))>0);
 assert.ok(run(()=>player(-8,9,'suit'))===0);});
// HD06 (hitman-decisions.json, ROADMAP D02): a blown outfit is known to everyone, as in HITMAN.
test('a blown outfit is recognised by everyone until changed out of and left 30 m behind unseen',()=>{const {m,d,observer}=setup();d.compromised.add('suit');assert.ok(m.compromised);
 const other=d.npcs[1];other.pos={x:-8,y:0,z:6};other.heading=0;other.route.splice(0,1,[-8,6,600]);other.look?.splice(0,2,-8,9);for(let i=0;i<12;i++)d.step(1/60,player(-8,8.5));assert.equal(other.state,'alert');
 m.disguise='guard';for(const n of d.npcs)n.visibility=0;const at=(z:number)=>m.step(1/60,{...player(0,z),disguise:m.disguise},0,new Set());
 at(0);at(20);assert.ok(d.compromised.has('suit'));observer.visibility=1;at(31);assert.ok(d.compromised.has('suit'),'seen: the walk starts again');observer.visibility=0;at(45);assert.ok(d.compromised.has('suit'));at(62);assert.equal(d.compromised.has('suit'),false);assert.equal(m.stats.cleared,1);
 d.compromised.add('waiter');m.disguise='waiter';at(0);at(100);assert.ok(d.compromised.has('waiter'),'another copy of the same outfit stays blown');});
test('a disguised innocent is not automatically pursued using the previous outfit memory',()=>{const {d,observer}=setup();d.npcs.splice(0,2);observer.pos={x:-8,y:0,z:7};observer.heading=0;observer.state='alert';observer.arrest=true;observer.knownDisguises.add('suit');observer.lastSeen={x:-2,y:0,z:7};const p=player(-8,7.8,'waiter');for(let i=0;i<210;i++)d.step(1/60,p);assert.equal(d.caught,false);assert.equal(observer.state,'search');assert.equal(observer.lastSeen.x,-2);});
test('a witnessed clothes change identifies both old and new outfits',()=>{const {m,observer}=setup();observer.heading=-Math.PI/2;hold(m,'KeyT',2);assert.equal(m.disguise,'guard');assert.ok(observer.knownDisguises.has('suit'));assert.ok(observer.knownDisguises.has('guard'));assert.equal(observer.state,'alert');assert.equal(m.stats.changeWitnesses,1);});
test('checkpoint refuses the wrong outfit and permits a valid inspected uniform',()=>{const {m}=setup(),at=player(-12.6,1.1);hold(m,'KeyB',3,at);assert.equal(m.stats.frisks,0);m.disguise='waiter';m.hasWire=false;hold(m,'KeyB',3,{...at,disguise:'waiter'});assert.equal(m.stats.frisks,1);assert.ok(m.passed(m.checkpoints[0]));const a={x:-12.6,y:0,z:.7},b={x:-12.6,y:0,z:.4};assert.deepEqual(m.constrain(a,b),b);m.elapsed+=91;assert.deepEqual(m.constrain(a,b),a);});
test('a frisk takes nothing: the wire is not found and the pass is granted',()=>{const {m,guard}=setup();m.disguise='guard';assert.equal(m.hasWire,true);hold(m,'KeyB',3,player(-12.6,1.1,'guard'));assert.equal(m.hasWire,true);assert.equal(m.stats.found,0);assert.equal(guard.busy,false);assert.equal(guard.state,'patrol');assert.ok(m.passed(m.checkpoints[0]));});
// HD07 (2026-11-07, replaces the F04 rule of 2026-11-02 that refused to start the frisk): as in HITMAN, the frisk starts,
// finds the illegal thing, and the guard turns on the agent — the outfit is blown and no pass is given.
test('HD07: an illegal item is found by the frisk and the guard moves to arrest; no pass',()=>{const {d,guard}=setup(),m=new M4System(d,map.checkpoints,{...rules.m4,items:{wire:{legality:'illegal',concealable:true}}});m.disguise='guard';const at=player(-12.6,1.1,'guard');
 assert.match(m.prompt(at)!.text,/^B 長押し/,'no warning before: the frisk is offered as usual');hold(m,'KeyB',3,at);for(let i=0;i<60;i++)m.step(1/60,at,0,new Set());
 assert.equal(m.stats.frisks,1);assert.equal(m.stats.found,1);assert.equal(m.passed(m.checkpoints[0]),false);assert.equal(guard.state,'alert');assert.equal(guard.arrest,true,'the guard detains');assert.ok(d.compromised.has('guard'),'the outfit is blown');});
test('cancelling inspection unlocks the guard without confiscation or a pass',()=>{const {m,guard}=setup();m.disguise='guard';hold(m,'KeyB',.5,player(-12.6,1.1,'guard'));for(let i=0;i<120;i++)m.step(1/60,player(-12.6,1.1,'guard'),0,new Set());assert.equal(guard.busy,false);assert.equal(m.hasWire,true);assert.equal(m.passes.size,0);});
test('putting down and retrieving the wire invalidates previous inspection passes',()=>{const {m}=setup(),p=player();m.passes.set('fake',{until:100,disguise:'suit',wire:true});hold(m,'KeyH',.1,p);assert.equal(m.hasWire,false);assert.equal(m.stashes.length,1);assert.equal(m.passes.size,0);hold(m,'KeyH',.1,p);assert.equal(m.hasWire,true);assert.equal(m.stashes.length,0);});
test('an inactive checkpoint guard cannot enforce an invisible barrier',()=>{const {m,guard}=setup();const a={x:-12.6,y:0,z:.7},b={x:-12.6,y:0,z:.4};assert.deepEqual(m.constrain(a,b),a);guard.life='unconscious';assert.deepEqual(m.constrain(a,b),b);});
test('all five character choices survive save/share validation and old saves migrate',()=>{for(const c of CHARACTERS){const l=sanitizeLook({character:c.id,codename:'TEST'});assert.equal(decodeLook(encodeLook(l))?.character,c.id);}assert.equal(sanitizeLook({codename:'OLD'}).character,'wardrobe');assert.equal(sanitizeLook({character:'invalid'}).character,'wardrobe');});
test('M4 action poses keep finite 22-bone output and return to neutral endpoints',()=>{for(const kind of ['change','frisk']as const)for(const role of ['giver','receiver']as const){const start=sampleM4Motion(kind,role,0),end=sampleM4Motion(kind,role,1);for(const n of Object.keys(start.bones))for(let j=0;j<3;j++)assert.ok(Math.abs(start.bones[n][j]-end.bones[n][j])<1e-9);for(let i=0;i<=100;i++){const p=sampleM4Motion(kind,role,i/100);assert.equal(Object.keys(p.bones).length,22);for(const v of Object.values(p.bones).flat())assert.ok(Number.isFinite(v));}}});


// 2026-11-10 (Issue #1): engine features that used to know club ids, checked with ids the club does not have.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Director,type Mission,type Rules} from '../src/ai.ts';
import {TraversalSchedule,type NpcTraversal} from '../src/engine/schedule.ts';
import {MissionEvents} from '../src/events.ts';
import {NavGrid} from '../src/nav.ts';
import {MissionClock,type ScheduleData} from '../src/schedule.ts';
import {sightBoxes} from '../src/sight.ts';
import {CollisionWorld,floorOf} from '../src/world.ts';
import {Errands} from '../src/engine/errands.ts';
import {VipProtection,type VipConfig} from '../src/engine/vip.ts';
import {HoldActions} from '../src/engine/hold-actions.ts';
import {KillEvents,TargetWatch} from '../src/engine/target-watch.ts';
import {M3System} from '../src/m3.ts';
import {markDead} from '../src/kills.ts';
import type {PlayerView} from '../src/ai.ts';
import {readFileSync,readdirSync} from 'node:fs';
import {buildGameMap,type MapLayout} from '../src/map-layout.ts';
import layout from '../src/data/club-layout.json' with {type:'json'};
import clubMission from '../src/data/club-mission.json' with {type:'json'};
import map from '../src/data/club-map.json' with {type:'json'};
import rules from '../src/data/club-rules.json' with {type:'json'};

function stage(npcs:{id:string;at:[number,number];role?:string}[],links:NpcTraversal[],places:Record<string,{x:number;y:number;z:number}>,plans:Record<string,string>){
 const base=map.npcs[0];
 const mission={...map,npcs:npcs.map(n=>({...(n.role==='guard'?map.npcs.find(x=>x.role==='guard')!:base),id:n.id,label:n.id,route:[[n.at[0],n.at[1],0]],floor:0}))} as unknown as Mission;
 const world=new CollisionWorld(mission),director=new Director(mission,world,new NavGrid(world),sightBoxes(mission),rules as Rules);
 const loop=rules.schedule.loop,events=new MissionEvents(),clock=new MissionClock(rules.schedule,events);
 const allPlaces=Object.fromEntries(Object.entries(places).map(([k,p])=>[k,{...p,heading:0,label:k,outdoor:false}]));
 const data:ScheduleData={actors:Object.fromEntries(Object.entries(plans).map(([id,place])=>[id,{plan:[{from:0,to:loop,place,do:'work'}]}]))};
 const schedule=new TraversalSchedule(data,allPlaces,director,clock,events,links);
 const far={x:0,y:0,z:0,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
 const run=(seconds:number)=>{for(let t=0;t<seconds;t+=1/30){clock.step(1/30);schedule.sync(1/30);schedule.step(1/30);director.step(1/30,far);schedule.sync(0);}};
 return {director,schedule,run,clock,events,npc:(id:string)=>director.npcs.find(n=>n.id===id)!};
}

test('any scheduled NPC climbs whichever listed ladder is nearest, and two climb at once',()=>{
 const [club]=map.traversals as NpcTraversal[];
 // A second shaft ladder that is not the club's, used by two NPCs the club does not have.
 const west:NpcTraversal={id:'W9',a:'',b:'',kind:'ladder',users:['rigger_a','rigger_b'],start:{x:24,y:0,z:27.3},via:[{x:24,y:3.5,z:27.3}],end:{x:24,y:3.5,z:28.8}};
 const g=stage([{id:'rigger_a',at:[25,24]},{id:'rigger_b',at:[34.7,31.5]}],[{...club,users:['rigger_b']},west],
  {catwalk_a:{x:26,y:3.5,z:29},catwalk_b:{x:30,y:3.5,z:29.2}},{rigger_a:'catwalk_a',rigger_b:'catwalk_b'});
 let both=false;
 for(let i=0;i<40&&!(floorOf(g.npc('rigger_a').pos.y)===1&&floorOf(g.npc('rigger_b').pos.y)===1);i++){
  g.run(.5);
  if(g.schedule.climbing('rigger_a')&&g.schedule.climbing('rigger_b'))both=true;
  const a=g.schedule.climbing('rigger_a'),b=g.schedule.climbing('rigger_b');
  if(a)assert.equal(a.link.id,'W9');
  if(b)assert.equal(b.link.id,club.id);
 }
 assert.equal(floorOf(g.npc('rigger_a').pos.y),1);
 assert.equal(floorOf(g.npc('rigger_b').pos.y),1);
 assert.ok(both,'the two climbs overlapped');
 // Off the ladder they walk on to their places.
 g.run(12);
 assert.ok(Math.hypot(g.npc('rigger_a').pos.x-26,g.npc('rigger_a').pos.z-29)<1.2);
});

test('an NPC not listed on a ladder never uses it, and one knocked out on it stays put',()=>{
 const [club]=map.traversals as NpcTraversal[];
 const g=stage([{id:'walker',at:[34.7,31.5]},{id:'rigger',at:[34.7,32.5]}],[{...club,users:['rigger']}],
  {up:{x:30,y:3.5,z:29.2}},{walker:'up',rigger:'up'});
 g.run(2);
 assert.equal(g.schedule.climbing('walker'),undefined);
 for(let i=0;i<40&&!g.schedule.climbing('rigger');i++)g.run(.25);
 g.run(1);
 const rigger=g.npc('rigger'),y=rigger.pos.y;
 assert.ok(rigger.traversal&&y>.3,'mid-climb');
 rigger.life='unconscious';g.run(1);
 assert.equal(g.schedule.climbing('rigger'),undefined);
 assert.equal(rigger.traversal,null);
 assert.equal(rigger.busy,false);
});

const viewAt=(x:number,z:number):PlayerView=>({x,y:0,z,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'});

test('errands: the newest order wins, releasing it returns to the one under it, then to the schedule',()=>{
 const g=stage([{id:'clerk',at:[20,20]}],[],{desk:{x:20,y:0,z:22}},{clerk:'desk'}),n=g.npc('clerk'),e=new Errands(g.schedule);
 e.send(n,'meeting',{x:10,y:0,z:10},'talk');e.send(n,'alarm',{x:30,y:0,z:30},'idle',1);
 assert.deepEqual(n.scriptedGoal,{x:30,y:0,z:30});
 e.release(n,'alarm');assert.deepEqual(n.scriptedGoal,{x:10,y:0,z:10});assert.equal(n.scriptedAction,'talk');
 // Another system gives a newer order directly: releasing ours does not undo it.
 const chore={x:5,y:0,z:5};n.scriptedGoal=chore;e.release(n,'meeting');assert.equal(n.scriptedGoal,chore);
 n.scriptedGoal=null;e.send(n,'meeting',{x:10,y:0,z:10});e.releaseAll('meeting');
 assert.equal(n.scriptedGoal,null);assert.equal(g.schedule.states.has('clerk'),false,'back on the schedule with a fresh travel budget');
});

test('VIP protection runs on any map: its own target, escort and safe room, then everyone back',()=>{
 const g=stage([{id:'mayor',at:[24,20]},{id:'aide',at:[25,20],role:'guard'},{id:'officer',at:[22,22],role:'guard'}],[],
  {stage_spot:{x:24,y:0,z:20},post:{x:25,y:0,z:20},beat:{x:22,y:0,z:22}},{mayor:'stage_spot',aide:'post',officer:'beat'});
 const errands=new Errands(g.schedule),m3=new M3System(g.director,[],rules.m3 as never),flags:string[]=[];
 const room={id:'green_room',label:'控室',at:{x:16.4,y:0,z:32.6},posts:[{x:16,y:0,z:35.1},{x:17.3,y:0,z:33.4}]};
 const config:VipConfig={target:'mayor',escort:'aide',
  lockdown:{enabled:true,guards:2,guardRadius:30,gunshotSmall:10,gunshotLoud:30,screamRadius:14,holdSeconds:20,rooms:[room]},
  escortCheck:{enabled:true,seconds:5,widenSeconds:5,widenGuards:1,widenRadius:4},
  escape:{enabled:false,afterLockdowns:2,exit:{x:0,y:0,z:0}},searchEnforcers:{enabled:false,seconds:0}};
 const vip=new VipProtection(g.director,m3,g.clock,g.events,errands,config,id=>flags.push(id),()=>{});
 const step=(s:number)=>{for(let t=0;t<s;t+=1/30){g.run(1/30);vip.step(g.clock.elapsed);}};
 vip.alarm({x:26,y:0,z:21},'gunshot','small');
 assert.ok(vip.lockedDown);assert.equal(g.npc('mayor').state,'flee');
 assert.ok(errands.holds(g.npc('aide'),'vip'),'their own escort takes a post first');
 const nav=g.director.nav,find=nav.findSoon.bind(nav),resumeAt=g.clock.elapsed+2;
 nav.findSoon=(from,to)=>to===g.npc('mayor').goal&&g.clock.elapsed<resumeAt?null:find(from,to);
 step(2);
 assert.equal(g.npc('mayor').navigationStatus,'no-route');
 assert.equal(g.npc('mayor').arrived,false,'the VIP retries a temporarily unavailable route');
 for(let i=0;i<60&&Math.hypot(g.npc('mayor').pos.x-room.at.x,g.npc('mayor').pos.z-room.at.z)>=1;i++)step(1);
 assert.ok(Math.hypot(g.npc('mayor').pos.x-room.at.x,g.npc('mayor').pos.z-room.at.z)<1.2,JSON.stringify(g.npc('mayor').pos));
 step(22);
 assert.ok(flags.includes('vip_lockdown_end'));assert.equal(errands.holders('vip').length,0);
 assert.notEqual(g.npc('mayor').state,'flee');
 // Down: the escort is sent to look after `seconds`.
 markDead(g.npc('mayor'),'test',{kind:'murder',witnesses:[],cameras:[],illegal:false,reasons:[]});
 step(6);assert.ok(flags.includes('vip_check'));
});

test('hold actions: a tool makes it quicker, letting go cancels, done spots disappear unless repeatable',()=>{
 const g=stage([{id:'x',at:[30,10]}],[],{p:{x:30,y:0,z:10}},{x:'p'});
 const spots=[{id:'valve',label:'弁を閉める',at:{x:20,y:0,z:20},seconds:3,tool:{item:'wrench',label:'スパナで閉める',seconds:1}},
  {id:'phone',label:'電話する',at:{x:20,y:0,z:21.2},seconds:1,repeat:true}];
 const h=new HoldActions(spots,1.4,()=>g.director.boxes,g.clock,g.events),done:string[]=[],used:string[]=[];
 g.events.on(e=>{if(e.type==='item.used')used.push(String(e.id));});
 let hand:string|undefined;h.heldItem=()=>hand;h.onComplete=s=>done.push(s.id);
 const p=viewAt(20,20.3),E=new Set(['KeyE']),none=new Set<string>();
 assert.equal(h.prompt(p)?.text,'E 長押し 弁を閉める');
 h.step(0,p,E);h.step(1.5,p,E);h.step(0,p,none);assert.equal(done.length,0,'let go: cancelled');h.step(0,p,none);
 hand='wrench';assert.equal(h.prompt(p)?.text,'E 長押し スパナで閉める');
 h.step(0,p,E);h.step(1.1,p,E);assert.deepEqual(done,['valve']);assert.deepEqual(used,['wrench']);
 h.step(0,p,none);assert.equal(h.spot(p)?.id,'phone','the valve is done; the phone stays');
 h.step(0,p,E);h.step(1.1,p,E);h.step(0,p,none);h.step(0,p,E);h.step(1.1,p,E);assert.deepEqual(done,['valve','phone','phone']);
});

test('a target going down: onlookers gather and go back, and npc.killed is sent once with the map place',()=>{
 const g=stage([{id:'heir',at:[24,20]},{id:'fan',at:[26,21]}],[],{a:{x:24,y:0,z:20},b:{x:26,y:0,z:21}},{heir:'a',fan:'b'});
 const errands=new Errands(g.schedule),watch=new TargetWatch(g.director,errands,[g.npc('heir')],{seconds:5,radius:16,max:8});
 const killed:unknown[]=[];g.events.on(e=>{if(e.type==='npc.killed')killed.push({id:e.id,place:e.place});});
 const kills=new KillEvents(g.director,g.events);kills.placeOf=v=>v.id==='heir'?'stage':undefined;
 let gathered=0;watch.onGathered=()=>gathered++;
 markDead(g.npc('heir'),'test',{kind:'accident',witnesses:[],cameras:[],illegal:false,reasons:[]});
 watch.step(g.clock.elapsed);kills.step(g.clock.elapsed);kills.step(g.clock.elapsed);
 assert.equal(gathered,1);assert.ok(watch.gathering(g.npc('fan')));assert.ok(g.npc('fan').scriptedGoal);
 assert.deepEqual(killed,[{id:'heir',place:'stage'}]);
 g.run(6);watch.step(g.clock.elapsed);
 assert.equal(watch.gathering(g.npc('fan')),false);assert.equal(g.npc('fan').scriptedGoal,null);
});

test('the shared engine names none of the club NPCs, zones, rooms, props, starts or exits',()=>{
 const ids=new Set<string>([...layout.npcs.map(n=>n.id),...layout.rooms.map(r=>r.id),...layout.furniture.map(f=>f.id),...layout.exits.map(e=>e.id),
  ...clubMission.starts.map(s=>s.id),...Object.keys(layout.schedulePlaces),'gate_frisk','safe-office','sink-kitchen','locker-static','shelf-F21']);
 // Ids that are also ordinary words in code.
 for(const word of ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','Q','R','escort','patrol'])ids.delete(word);
 const dir=new URL('../src/engine/',import.meta.url);
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.ts'))){
  const src=readFileSync(new URL(file,dir),'utf8').replace(/\/\/.*$/gm,'');
  for(const id of ids)assert.ok(!src.includes(`'${id}'`)&&!src.includes(`"${id}"`),`${file} names ${id}`);
 }
});

test('any layout builds a complete game map the same way the club does',()=>{
 const blank={name:'検証ステージ',ground:{minX:0,maxX:20,minZ:0,maxZ:12},spawn:{x:2,z:2},rooms:[{id:'hall',label:'ホール',floor:0,minX:0,maxX:20,minZ:0,maxZ:12}],
  walls:[],furniture:[],stairs:[],traversals:[],geometry:{floors:[],shafts:[]}} as MapLayout;
 const map=buildGameMap(blank);
 for(const key of ['water','palms','labels','reinforcements','cameras','exits','walls','blockers','floors','zones','sections','guide'] as const)assert.ok(Array.isArray(map[key]),key);
 assert.equal(map.sections[0].label,'検証ステージ');
 assert.equal('pool' in map,false);
});

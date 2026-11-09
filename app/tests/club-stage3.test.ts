import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Director,type Mission,type PlayerView,type Rules} from '../src/ai.ts';
import {ClubChances} from '../src/club/chances.ts';
import {ClubCrowd} from '../src/club/crowd.ts';
import {TraversalSchedule} from '../src/engine/schedule.ts';
import {DialogueSystem} from '../src/dialogue.ts';
import {MissionEvents} from '../src/events.ts';
import {markDead} from '../src/kills.ts';
import {M3System} from '../src/m3.ts';
import {M4System,type Checkpoint} from '../src/m4.ts';
import {NavGrid} from '../src/nav.ts';
import {PartyTraversal,traversalSeconds} from '../src/party/traversal.ts';
import {ClubTrace} from '../src/engine/trace.ts';
import {MissionClock} from '../src/schedule.ts';
import {computeResult,ScoreLedger} from '../src/score.ts';
import {segmentClear,sightBoxes} from '../src/sight.ts';
import {CollisionWorld,floorOf,type Position} from '../src/world.ts';
import map from '../src/data/club-map.json' with {type:'json'};
import rules from '../src/data/club-rules.json' with {type:'json'};
import stage from '../src/data/club-stage3.json' with {type:'json'};
import plans from '../src/data/club-schedule.json' with {type:'json'};
import lines from '../src/data/club-dialogue.json' with {type:'json'};
import chances from '../src/data/club-chances.json' with {type:'json'};
import crowdData from '../src/data/club-crowd.json' with {type:'json'};
import scoring from '../src/data/scoring.json' with {type:'json'};

const step=1/30;
const none=new Set<string>(),holdE=new Set(['KeyE']);
const at=(id:string)=>stage.acts.find(a=>a.id===id)!;
const gap=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y);
test('the catwalk rail blocks walking and rays through its bar, but not a shot below the bar',()=>{
 const walls=map.walls.filter(w=>!map.collisionOnlyIds.includes(w.id));
 const boxes=sightBoxes({...map,walls}),world=new CollisionWorld(map);
 const from={x:16.82,y:4.9,z:29.63};
 assert.ok(world.blocked(16.8,3.5,30));
 assert.equal(segmentClear(boxes,from,{x:16.2,y:1.6,z:32.8}),false);
 assert.equal(segmentClear(boxes,from,{x:16.2,y:.85,z:32.8}),true);
});
test('S08 row 2: the club lighting can be prepared with the wrench, which must stay in hand',()=>{
 const spot=at('drop_lights'),g=club(spot.at);
 let held='wrench';g.m3.heldItem=()=>held;
 assert.match(g.field.prompt(g.p())?.text??'',/スパナ/);
 g.run(.55,holdE);held='';g.run(.65,holdE);
 assert.ok(!g.field.flags.has('drop_lights'));
 g.tick();held='wrench';g.run(1.1,holdE);
 assert.ok(g.field.flags.has('drop_lights'));
 assert.ok(g.log.some(e=>e.type==='item.used'&&e.id==='wrench'));
});

function club(start:Position={...map.spawn,y:0}){
 const mission=map as unknown as Mission,world=new CollisionWorld(mission),nav=new NavGrid(world);
 const director=new Director(mission,world,nav,sightBoxes({...mission,walls:mission.walls.filter(w=>!map.collisionOnlyIds.includes(w.id))}),rules as Rules);
 const events=new MissionEvents(),clock=new MissionClock(rules.schedule,events);
 const m3=new M3System(director,map.hides,rules.m3),m4=new M4System(director,map.checkpoints as Checkpoint[],rules.m4,map.hides);
 const schedule=new TraversalSchedule(plans,map.schedulePlaces,director,clock,events,map.traversals);
 const field=new ClubChances(director,m3,m4,clock,events,chances,schedule);
 const dialogue=new DialogueSystem(lines,map.schedulePlaces,director,clock,rules.dialogue,events);
 const crowd=new ClubCrowd(director,crowdData,1);
 const ledger=new ScoreLedger(events,id=>director.npcs.find(n=>n.id===id));
 const log:typeof events.recent=[];
 events.on(e=>{if(e.type!=='clock.tick'&&e.type!=='schedule.action')log.push(e);});
 const investor=director.npcs.find(n=>n.id==='investor')!,escort=director.npcs.find(n=>n.id==='escort')!;
 let pos={...start};
 const p=():PlayerView=>({...pos,floor:floorOf(pos.y),disguise:m4.disguise,speed:0,running:false,crouched:false,tampering:field.tampering});
 const traverse=new PartyTraversal(director,map.traversals,map.traversalRules);
 let frontSteps=0;
 let caughtAt:unknown=null;
 function tick(keys=none){
  const used=field.step(step,p(),keys,m3.locked||m4.locked||!!m3.dragged);
  if(!used&&!m3.dragged&&traverse.step(step,p(),keys,m3.locked||m4.locked)){
   const to=traverse.takeTransfer();
   if(to)pos=to;
  }else m3.step(step,p(),0,used?none:keys,field.locked||m4.locked);
  m4.step(step,p(),0,keys,m3.locked||field.locked||!!m3.dragged);
  clock.step(step);field.beforeAi();field.applyBlackout(crowd);schedule.sync(step);schedule.step(step);
  const seen=director.step(step,p()).find(e=>e.type==='caught');
  if(seen)caughtAt={time:clock.time,position:{...pos},guard:seen.npc.id};
  schedule.sync(0);
  dialogue.step(step,p(),m3.hotel.level);field.afterAi(p());field.applyBlackout(crowd);
  if(investor.pos.x>=12&&investor.pos.x<=14&&investor.pos.y>.15&&investor.pos.y<3.35)frontSteps++;
 }
 function run(seconds:number,keys=none){for(let i=0;i<Math.ceil(seconds/step);i++)tick(keys);}
 function jump(time:number){clock.jump(time);field.seek();schedule.sync(0);dialogue.seek();}
 function walk(to:Position){
  const path=nav.find(pos,to);
  assert.ok(path,`path from ${JSON.stringify(pos)} to ${JSON.stringify(to)}`);
  for(const q of path)for(let i=0;Math.hypot(q.x-pos.x,q.z-pos.z)>.027;i++){
   const d=Math.hypot(q.x-pos.x,q.z-pos.z),length=Math.min(d,1.65*step);
   const next=world.move(pos,(q.x-pos.x)/d*length,(q.z-pos.z)/d*length);
   const arrived=m4.constrain(pos,m3.constrainMove(pos,next,0));
   assert.ok(i<400&&gap(pos,arrived)>.0001,`walk blocked at ${JSON.stringify(pos)} towards ${JSON.stringify(q)}`);
   pos=arrived;tick();
  }
  assert.ok(gap(pos,to)<.43,`walk ended at ${JSON.stringify(pos)}`);
 }
 function use(id:string){
  assert.match(field.prompt(p())?.text??'',/^E 長押し/);
  run(at(id).seconds+2*step,holdE);tick();
  assert.ok(field.flags.has(id),`no ${id} at ${JSON.stringify(pos)}`);
 }
 return {world,nav,director,events,clock,m3,m4,field,crowd,dialogue,ledger,log,schedule,investor,escort,p,tick,run,jump,walk,use,
  frontSteps:()=>frontSteps,caughtAt:()=>caughtAt};
}

test('club drop announcement reaches the far corner and unprepared 12:00 leaves the investor alive',()=>{
 const g=club({x:16,y:0,z:16});
 g.run(rules.dialogue.lineSeconds+.2);
 assert.ok(g.dialogue.heard.has('drop_mic'));
 assert.equal(g.field.chances.states.get('drop')?.status,'active');
 g.jump(610);g.run(112);
 assert.equal(g.investor.life,'active');
 assert.ok(g.frontSteps()>0);
 assert.ok(Math.abs(g.log.find(e=>e.id==='drop_pressed')!.time-720)<.1);
 assert.equal(g.field.blackout,false);
});

test('club drop clue, live wiring, second performance and accident score',()=>{
 const g=club({x:16,y:0,z:16});
 g.run(4);
 g.jump(1210);
 const access=[[24,20],[36,20],[36,28.6],[39,28.6],[41,29],[41,32],[41,35],[34,35],[34,33]];
 for(const [x,z] of access)g.walk({x,y:0,z});
 g.walk(at('drop_wires').at);
 g.run(4);
 assert.ok(g.dialogue.heard.has('drop_tech'));
 g.use('drop_wires');
 for(const [x,z] of access.toReversed())g.walk({x,y:0,z});
 g.jump(1338);
 g.run(104);
 assert.equal(g.investor.deathKind,'accident');
 assert.equal(g.investor.life,'dead');
 assert.equal(g.director.caught,false,JSON.stringify(g.caughtAt()));
 assert.ok(g.frontSteps()>0);
 assert.equal(g.field.chances.states.get('drop')?.status,'complete');
 const result=computeResult(scoring,g.ledger.counts,g.clock.elapsed,true);
 assert.equal(result.lines.find(l=>l.key==='accident_kill')?.count,1);
 assert.equal(result.lines.find(l=>l.key==='chance_complete')?.count,1);
});

test('F02: a visible drawn gun can panic another crowd by sound, but a hidden gun cannot start the panic',()=>{
 const {director,p}=club({x:0,y:0,z:0});
 const data=structuredClone(crowdData);
 const template=data.places[0],person=template.points[0];
 data.places=[
  {...template,id:'sees',x:0,z:4,floor:0,count:1,points:[{...person,x:0,z:4,heading:Math.PI}]},
  {...template,id:'hears',x:5,z:4,floor:0,count:1,points:[{...person,x:5,z:4,heading:0}]},
  {...template,id:'upstairs',x:5,z:4,floor:1,count:1,points:[{...person,x:5,z:4,heading:0}]},
 ];
 data.hear=10;
 director.boxes.splice(0,director.boxes.length,{minX:-.29,maxX:-.12,minY:0,maxY:2,minZ:.95,maxZ:1.35});
 const crowd=new ClubCrowd(director,data,1),events:string[]=[];
 crowd.reaction=(id,action,reason)=>{if(action==='scream')events.push(id+':'+reason);};
 const agent={...p(),weaponDrawn:true,carrySight:{drawn:{x:-.25,y:1.24,z:.37},illegalTools:[]}};
 crowd.violence(agent,0,'gun_drawn');
 assert.deepEqual(events,[]);
 director.boxes.length=0;
 crowd.violence(agent,1,'gun_drawn');
 assert.deepEqual(events,['sees:gun_drawn','hears:crowd_scream']);
});

test('club blackout scales floor NPC and crowd vision and restores it afterwards',()=>{
 const g=club(at('drop_lights').at);
 g.use('drop_lights');
 g.jump(610);g.run(112);
 assert.equal(g.field.blackout,true);
 const n=g.director.npcs.find(n=>g.director.zone({...n.pos,floor:0} as PlayerView)?.id==='C'&&n.pos.y===0)!;
 assert.ok(n);
 assert.equal(n.vision(rules as Rules).range,rules.vision[n.role].range*stage.drop.blackout.sightScale);
 assert.equal(n.vision(rules as Rules).sensitivity,rules.vision[n.role].sensitivity*stage.drop.blackout.sightScale);
 assert.equal(g.crowd.floorSightScale,stage.drop.blackout.sightScale);
 assert.equal(g.escort.visionScale,1);
 g.run(stage.drop.blackout.seconds);
 assert.equal(g.field.blackout,false);
 assert.equal(n.visionScale,1);
 assert.equal(g.crowd.floorSightScale,1);
});

test('club wiring can be reached in the technician uniform or from the catwalk ladder',()=>{
 const uniform=club({x:33.8,y:0,z:31.95});
 const tech=uniform.director.npcs.find(n=>n.id==='technician')!;
 assert.equal(uniform.m3.target(uniform.p()),tech);
 uniform.run(rules.m3.koSeconds+2*step,new Set(['KeyF']));uniform.run(2);
 uniform.run(rules.m4.changeSeconds+2*step,new Set(['KeyT']));uniform.tick();
 assert.equal(uniform.m4.disguise,'technician');
 uniform.walk(at('drop_wires').at);uniform.use('drop_wires');

 const ladder=map.traversals[0];
 const above=club({x:25,y:3.5,z:29});
 above.walk({x:36,y:3.5,z:29});above.walk(ladder.end);
 above.run(traversalSeconds(ladder)+2*step,holdE);above.tick();
 assert.ok(gap(above.p(),ladder.start)<.1);
 assert.equal(above.m4.disguise,'suit');
 above.walk(at('drop_wires').at);above.use('drop_wires');
});

test('club intercom advances the meeting once, leaving the escort at the kitchen entrance',()=>{
 const g=club({x:17.3,y:0,z:32.6});
 const manager=g.director.npcs.find(n=>n.id==='manager')!;
 assert.equal(g.m3.target(g.p()),manager);
 g.run(rules.m3.koSeconds+2*step,new Set(['KeyF']));
 g.run(2);
 g.run(rules.m4.changeSeconds+2*step,new Set(['KeyT']));g.tick();
 assert.equal(g.m4.disguise,'manager');
 g.walk(at('meet_note').at);g.use('meet_note');
 g.jump(150);g.run(22);
 assert.ok(g.director.npcs.find(n=>n.id==='cleaner')!.pos.z>=36,'cleaner was in the dock before the call');
 g.walk(at('meet_call').at);g.use('meet_call');
 g.run(3,holdE);g.tick();
 assert.equal(g.log.filter(e=>e.type==='flag.set'&&e.id==='meet_call').length,1);
 for(const [x,z] of [[16,35],[16,37],[10,37.9]])g.walk({x,y:0,z});
 g.run(62-(g.clock.elapsed-g.log.find(e=>e.id==='meet_call')!.time));
 const call=g.log.find(e=>e.id==='meet_call')!,arrived=g.log.find(e=>e.id==='meet_arrived')!;
 assert.ok(arrived&&Math.abs(arrived.time-call.time-60)<6,JSON.stringify(g.field.snapshot()));
 assert.ok(gap(g.escort.pos,stage.meet.escortPost)<.5,JSON.stringify(g.escort.pos));
 assert.ok(gap(g.investor.pos,stage.meet.dock)<.5,JSON.stringify(g.investor.pos));
 assert.deepEqual(g.director.npcs.filter(n=>n.active&&n.pos.y===0&&n.pos.z>=36&&n.pos.x<20).map(n=>n.id),['investor']);
 assert.equal(g.m3.target(g.p()),g.investor);
 g.run(rules.m3.killSeconds+2*step,new Set(['KeyX']));g.tick();
 assert.equal(g.investor.life,'dead');
 assert.equal(g.field.chances.states.get('meet')?.status,'complete');
 g.tick(holdE);g.tick();
 assert.equal(g.m3.dragged,g.investor);
 for(const [x,z] of [[6,37.8],[6,35],[6.5,34],[12.1,34],[11.85,31]])g.walk({x,y:0,z});
 g.run(rules.m3.hideSeconds+2*step,holdE);g.tick();
 assert.equal(g.investor.bodyMode,'hidden');
 assert.deepEqual(g.m3.slots.get('machine-freezer'),['investor']);
 assert.equal(g.director.caught,false);
});

test('club scheduled 18:00 meeting goes through the kitchen with the escort left behind',()=>{
 const g=club();
 g.jump(1010);g.run(73);
 assert.ok(Math.abs(g.log.find(e=>e.id==='meet_arrived')!.time-1080)<2);
 assert.ok(gap(g.escort.pos,stage.meet.escortPost)<.5);
 assert.ok(gap(g.investor.pos,stage.meet.dock)<.5);
 g.run(stage.meet.staySeconds+25);
 assert.equal(g.investor.pos.y,3.5,'the investor returns to the VIP schedule after the meeting');
 assert.equal(g.escort.pos.y,3.5);
});

test('club scheduled meeting and intercom are blocked by alert or target distress',()=>{
 const g=club(at('meet_call').at);
 const player={...g.p(),disguise:'manager'};
 g.m3.hotel.level=2;
 assert.match(g.field.prompt(player)?.text??'',/警戒/);
 assert.equal(g.field.step(step,player,holdE),false);
 g.jump(stage.meet.time-stage.meet.callSeconds);g.tick();
 assert.ok(g.field.flags.has('meet_cancelled'));
 assert.equal(g.investor.scriptedGoal,null);
 g.m3.hotel.level=0;
 g.jump(stage.meet.time);
 assert.match(g.field.prompt(player)?.text??'',/呼び出せない/);
 g.jump(10);g.investor.state='flee';
 assert.match(g.field.prompt(player)?.text??'',/警戒/);
 assert.equal(g.field.step(step,player,holdE),false);
});

// Claude 2026-11-03: the accident at the drop draws the people nearby to the body; the club gate stays shut while its
// guard is investigating a runner.
test('club target down: people who see the fall gather round the body, then go back',()=>{
 const g=club(at('drop_wires').at);
 g.field.onTargetDown=(a,t)=>g.crowd.gasp(a,t);
 g.use('drop_wires');
 g.jump(610);g.run(112);
 assert.equal(g.investor.deathKind,'accident');
 g.run(12);
 const body=g.investor.pos,close=g.director.npcs.filter(n=>n.active&&Math.hypot(n.pos.x-body.x,n.pos.z-body.z)<3.2);
 assert.ok(close.length>=2,`gathered ${close.map(n=>n.id)}`);
 assert.ok(g.crowd.people.some(n=>n.heading!==n.home.heading),'dancers turned');
 g.run(40);g.crowd.step(g.clock.elapsed,g.p());
 assert.ok(g.crowd.people.every(n=>n.heading===n.home.heading),'dancers back');
});

// Claude 2026-11-03: HITMAN's VIP protection (config.vip). Lockdown and escort check are on; escape and searching
// enforcers are off and not tested yet.
test('club VIP lockdown: a shot near the investor sends them to a safe room with guards round them, then back',()=>{
 const g=club({x:2,y:0,z:20});
 g.run(1);
 const at={x:g.investor.pos.x+3,y:g.investor.pos.y,z:g.investor.pos.z};
 g.field.alarm(at,'gunshot','small');
 assert.ok(g.log.some(e=>e.type==='flag.set'&&e.id==='vip_lockdown'));
 const room=stage.vip.lockdown.rooms.find(r=>r.id==='office')!;
 g.run(40);
 assert.ok(Math.hypot(g.investor.pos.x-room.at.x,g.investor.pos.z-room.at.z)<1.2,JSON.stringify(g.investor.pos));
 const guards=g.director.npcs.filter(n=>n.guard&&n.active&&Math.hypot(n.pos.x-room.at.x,n.pos.z-room.at.z)<5);
 assert.ok(guards.length>=2,`guards at the room ${guards.map(n=>n.id)}`);
 const escort=g.director.npcs.find(n=>n.id==='escort')!;
 assert.ok(escort.scriptedGoal,'the VIP escort has a lockdown post');
 const nextJob={...escort.pos};escort.scriptedGoal=nextJob;
 g.field.alarm(at,'gunshot','loud');
 assert.equal(g.log.filter(e=>e.type==='flag.set'&&e.id==='vip_lockdown').length,1,'no second lockdown while holding');
 g.run(stage.vip.lockdown.holdSeconds+2);
 assert.ok(g.log.some(e=>e.type==='flag.set'&&e.id==='vip_lockdown_end'));
 assert.notEqual(g.investor.state,'flee');
 assert.equal(escort.scriptedGoal,nextJob,'ending the lockdown preserves a newer order');
});

test('club VIP escort check: a quietly downed investor is looked for after the set time',()=>{
 const g=club({x:2,y:0,z:20});
 g.investor.pos={x:2,y:0,z:26};
 markDead(g.investor,'test',{kind:'murder',witnesses:[],cameras:[],illegal:false,reasons:[]});
 g.run(stage.vip.escortCheck.seconds-1);
 assert.ok(!g.log.some(e=>e.type==='flag.set'&&e.id==='vip_check'));
 g.run(2);
 const check=g.log.find(e=>e.type==='flag.set'&&e.id==='vip_check');
 assert.ok(check);
 const guard=g.director.npcs.find(n=>n.id===check.reason)!;
 assert.equal(guard.id,'escort');
 assert.equal(guard.state,'investigate');
});

test('trace records the scheduled actor stopping and returning after an interruption',()=>{
 const g=club(),trace=new ClubTrace(g.director);
 trace.drain(true);
 g.schedule.sync(0);trace.schedule(0,g.schedule.states);
 g.investor.busy=true;g.schedule.sync(0);trace.schedule(1,g.schedule.states);
 g.investor.busy=false;g.schedule.sync(0);trace.schedule(2,g.schedule.states);
 trace.schedule(3,g.schedule.states);
 const records=(trace.drain() as Array<{kind:string;id:string;phase:string;navigation:string;t:number}>)
  .filter(row=>row.kind==='npc-decision'&&row.id===g.investor.id);
 assert.deepEqual(records.map(row=>row.t),[0,1,2]);
 assert.equal(records[1].phase,'paused');
 assert.equal(records[1].navigation,'busy');
 assert.notEqual(records[2].phase,'paused');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {Director,type Mission,type Rules} from '../src/ai.ts';
import {DoorSystem,type DoorDef} from '../src/doors.ts';
import {CollisionWorld,type Level} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {segmentClear,sightBoxes} from '../src/sight.ts';
import club from '../src/data/club-map.json' with {type:'json'};

import rules from '../src/data/club-rules.json' with {type:'json'};

const level:Level={spawn:{x:-2,z:0},ground:{minX:-3,maxX:3,minZ:-.7,maxZ:.7},floors:[],stairs:[],walls:[],blockers:[]};
const def:DoorDef={id:'test',label:'扉',x:0,y:0,z:0,w:.12,d:1.4,h:2.2};
const from={x:-1,y:0,z:0},to={x:1,y:0,z:0};

test('C15: opening and closing one door changes movement, cached NPC routes, sight and sound',()=>{
 const world=new CollisionWorld(level),nav=new NavGrid(world),boxes=sightBoxes(level);
 const system=new DoorSystem(world,boxes,[def]);
 const door=system.near(from)!;
 assert.ok(door);
 assert.ok(nav.find(from,to));
 assert.equal(system.use(door,'',[],[from,{x:0,y:0,z:0}]).opened,false);
 assert.equal(door.closed,false,'the leaf cannot be closed on someone');
 assert.equal(system.use(door,'',[],[from]).opened,false);
 assert.ok(door.closed);
 assert.equal(system.near(from),door,'a closed door can still be opened from either side');
 assert.equal(system.near(to),door);
 assert.ok(world.move(from,2,0).x<0);
 assert.equal(nav.find(from,to),null);
 assert.equal(segmentClear(boxes,{...from,y:1.2},{...to,y:1.2}),false);
 assert.equal(system.soundClear(from,to),false);
 assert.equal(system.use(door,'',[],[from]).opened,true);
 assert.ok(nav.find(from,to));
 assert.equal(segmentClear(boxes,{...from,y:1.2},{...to,y:1.2}),true);
 assert.equal(system.soundClear(from,to),true);
});

test('S08 row 3: a pryable lock accepts a held crowbar or its own key',()=>{
 const world=new CollisionWorld(level),system=new DoorSystem(world,[],[{...def,key:'service-key',pryable:true}]);
 const door=system.near(from)!;
 assert.equal(system.use(door,'hammer',['other-key'],[from]).opened,false);
 assert.equal(system.use(door,'crowbar',[],[from]).opened,true);
 assert.equal(door.locked,false);
 system.reset();
 assert.equal(system.use(door,'',['service-key'],[from]).opened,true);
});

test('the actual club VIP door uses its original opening and starts open',()=>{
 const world=new CollisionWorld(club as Level),boxes=sightBoxes(club as Level);
 const system=new DoorSystem(world,boxes,club.doors);
 const p={x:13.25,y:3.5,z:29},q={x:14.75,y:3.5,z:29};
 const door=system.near(p)!;
 assert.equal(door.def.id,'vip-staff-door');
 assert.ok(world.move(p,1.5,0).x>14.5);
 system.use(door,'',[],[p]);
 assert.ok(world.move(p,1.5,0).x<14);
 assert.equal(system.soundClear(p,q),false);
});

test('a guard takes the stairs and opens the Club VIP door on the way to a reported catwalk position',()=>{
 const guard=club.npcs.find(n=>n.id==='back_patrol')!;
 const mission={...club,npcs:[guard]} as unknown as Mission;
 const world=new CollisionWorld(mission),nav=new NavGrid(world),boxes=sightBoxes(mission);
 const director=new Director(mission,world,nav,boxes,rules as Rules);
 const system=new DoorSystem(world,boxes,club.doors);director.doors=system;
 const [door]=system.doors,n=director.npcs[0];
 const at={x:16.61,y:3.5,z:28.39},otherSide={x:13.25,y:3.5,z:29};
 n.pos={...club.traversals[0].start};
 system.use(door,'',[],[]);
 assert.ok(door.closed);
 assert.equal(nav.find(n.pos,at),null);
 assert.equal(system.soundClear(otherSide,at),false);
 n.radio(at,director.rules);
 const remote={x:1,y:0,z:1,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit',hidden:true};
 for(let i=0;i<2700&&door.closed;i++)director.step(1/60,remote);
 assert.equal(door.closed,false,JSON.stringify(n.pos));
 assert.ok(Math.abs(n.pos.y-door.def.y)<.35,'opening requires standing at the door');
 assert.ok(Math.hypot(n.pos.x-door.def.x,n.pos.z-door.def.z)<1.35);
 assert.equal(system.soundClear(otherSide,at),true);
 for(let i=0;i<300&&!n.arrived;i++)director.step(1/60,remote);
 assert.ok(Math.hypot(n.pos.x-at.x,n.pos.z-at.z)<.65,JSON.stringify(n.pos));
 assert.equal(n.pos.y,at.y);
});

test('only a lock explicitly available to guards can be opened by them',()=>{
 for(const guardAccess of [false,true]){
  const world=new CollisionWorld(level),nav=new NavGrid(world),system=new DoorSystem(world,[],[{...def,key:'service-key',guardAccess}]);
  const [door]=system.doors;
  assert.equal(!!system.guardRoute(nav,from,to),guardAccess);
  assert.equal(system.openForGuard(door,{...from,x:-2}),false);
  assert.equal(system.openForGuard(door,from),guardAccess);
  assert.equal(door.locked,!guardAccess);
  if(guardAccess){
   system.step(3,[{x:0,y:0,z:0}]);
   assert.equal(door.closed,false,'the door waits for the crossing to clear');
   system.step(1,[]);
   assert.equal(door.closed,true);
   assert.equal(door.locked,true,'a guard passage does not unlock an access-controlled door permanently');
  }
 }
});

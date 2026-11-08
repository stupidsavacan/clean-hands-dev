import test from 'node:test';
import assert from 'node:assert/strict';
import {DoorSystem,type DoorDef} from '../src/doors.ts';
import {CollisionWorld,type Level} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {segmentClear,sightBoxes} from '../src/sight.ts';
import club from '../src/data/club-map.json' with {type:'json'};

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

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCoverSpots,hiddenFrom} from '../src/cover-spots.ts';
import {CollisionWorld,type Level} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
const level:Level={spawn:{x:0,z:0},ground:{minX:-20,maxX:20,minZ:-15,maxZ:15},floors:[],stairs:[],walls:[],blockers:[{id:'crate-a',x:0,z:0,w:1.2,d:1.2,h:1.2,y:0}]};
const spots=(l:Level,r={})=>{const w=new CollisionWorld(l);return buildCoverSpots(l,w,new NavGrid(w),r);};
test('guard cover: a remote crate cannot protect the front of the source crate',()=>{
 const all=spots(level),front=all.find(s=>s.x>1)!;assert.ok(front);
 const distant={...level,blockers:[...level.blockers,{id:'crate-b',x:8,z:0,w:1.2,d:2,h:1.4,y:0}]};
 assert.equal(hiddenFrom(front,{x:12,y:0,z:0},false,sightBoxes(distant)),false);
 assert.equal(hiddenFrom(all.find(s=>s.x< -1)!,{x:12,y:0,z:0},false,sightBoxes(level)),true);
});
test('guard cover: exclusion prefixes apply to low solids and tall walls',()=>{
 const l={...level,walls:[{...level.blockers[0],id:'omit-wall',x:5,h:3}]};
 assert.ok(spots(l).length>0);assert.equal(spots(l,{excludeIds:['crate-','omit-']}).length,0);
});
test('guard cover: spots on stair ramps are rejected',()=>{
 const l:Level={...level,stairs:[{id:'flight',minX:-2,maxX:2,minZ:-2,maxZ:2,low:0,high:1,rise:'+x'}]};
 assert.equal(spots(l).length,0);
});

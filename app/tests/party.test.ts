import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {Director,type PlayerView} from '../src/ai.ts';
import {sightBoxes} from '../src/sight.ts';
import {PartyTraversal,traversalSeconds} from '../src/party/traversal.ts';
const read=(s:string)=>JSON.parse(readFileSync(new URL('../src/data/'+s,import.meta.url),'utf8'));
const map=read('party.json'),rules=read('party-rules.json');
function setup(){const w=new CollisionWorld(map),n=new NavGrid(w),d=new Director(map,w,n,sightBoxes(map),rules);return {w,n,d,t:new PartyTraversal(d,map.traversals,map.traversalRules)};}
const player=(p:any):PlayerView=>({...p,floor:Math.round(p.y/3.5),speed:0,running:false,crouched:false,tampering:false,disguise:'suit'});
test('party: all traversal landings are clear and holding E completes in both directions',()=>{const {w,n,t}=setup();for(const l of map.traversals)for(const reverse of [false,true]){let p=player(reverse?l.end:l.start);t.step(0,p,new Set());assert.ok(n.nearest(p)>=0);assert.equal(w.blocked(p.x,p.y,p.z),false);t.step(0,p,new Set(['KeyE']));for(let i=0;i<Math.ceil(traversalSeconds(l)*60)+2;i++){t.step(1/60,p,new Set(['KeyE']));const q=t.takeTransfer();if(q)p=player(q);}assert.ok(Math.hypot(p.x-(reverse?l.start:l.end).x,p.y-(reverse?l.start:l.end).y,p.z-(reverse?l.start:l.end).z)<1e-6,l.id);}});
test('party: releasing E midway restores the exact start',()=>{const {t}=setup();const p=player(map.traversals[0].start);t.step(0,p,new Set(['KeyE']));t.step(1,p,new Set(['KeyE']));t.takeTransfer();t.step(0,p,new Set());assert.deepEqual(t.takeTransfer(),{x:p.x,y:p.y,z:p.z});assert.equal(t.locked,false);});
test('party: sparse stage-one population and complete designed topology',()=>{assert.equal(new Set(map.zones.map((z:any)=>z.id)).size,19);assert.equal(map.hides.length,15);assert.equal(map.traversals.length,7);assert.equal(map.npcs.length,map.stage===1?1:60);});
test('party: cleaner is allowed only in the guest room among private rooms',async()=>{const {permission}=await import('../src/ai.ts');for(const id of ['Q','O','M'])assert.equal(permission(rules,'cleaner',map.zones.find((z:any)=>z.id===id)),id==='Q'?'allow':'deny');});

test('party: the gallery overlooks the ballroom through a real floor opening',async()=>{const {segmentClear}=await import('../src/sight.ts');const {w}=setup();assert.equal(segmentClear(sightBoxes(map),{x:19,y:5.05,z:32},{x:25,y:1.2,z:33}),true);assert.equal(w.surface(25,31,3.5),null);});

import test from 'node:test';
import assert from 'node:assert/strict';
import layout from '../src/data/club-layout.json' with {type:'json'};
import mission from '../src/data/club-mission.json' with {type:'json'};
import {MapModel,get,items,moveHandle,pick,probeOf,resizeItem,routeBetween,type Doc,type Ref} from '../src/map-editor/core.ts';
import {checkMap} from '../src/map-editor/checks.ts';
import {compileMapGeometry} from '../src/map-layout.ts';
import club from '../src/data/club-map.json' with {type:'json'};

const clubDoc=()=>({...structuredClone(layout),devices:structuredClone(mission.devices)} as unknown as Doc);

test('map lab: the club as it ships has no problems, and the editor compiles the same geometry as the game',()=>{
 const doc=clubDoc();
 assert.deepEqual(checkMap(doc),[]);
 const geometry=compileMapGeometry(doc);
 for(const key of ['walls','blockers','floors','zones'] as const)assert.deepEqual(geometry[key],club[key]);
});

test('map lab: a wall dropped on a patrol stop is an error on that NPC, and undo clears it',()=>{
 const m=new MapModel(clubDoc(),'club');
 const {ref:npc,value}=items(m.doc,'npcs')[0],[x,z]=value.route[0] as number[];
 const wall=m.add('walls',{x:x-1,z:z-.1,w:2,d:.2},0);
 const issues=checkMap(m.doc);
 assert.ok(issues.some(i=>i.level==='error'&&i.ref?.kind===npc.kind&&i.ref.key===npc.key),JSON.stringify(issues.map(i=>i.text)));
 assert.equal(get(m.doc,wall)!.floor,0);
 assert.ok(m.undo());
 assert.deepEqual(checkMap(m.doc),[]);
 assert.ok(m.redo());assert.ok(checkMap(m.doc).length>0);
});

test('map lab: walking around a new wall is longer and the wall blocks the sight line',()=>{
 const m=new MapModel(clubDoc(),'club'),a={x:23.5,z:19.5,floor:0},b={x:23.5,z:24.5,floor:0};
 const before=routeBetween(m.doc,probeOf(m.doc),a,b);
 assert.ok(before.path&&before.sight&&before.metres<5.5);
 m.add('walls',{x:19.5,z:21.5,w:8,d:.4},0);
 const after=routeBetween(m.doc,probeOf(m.doc),a,b);
 assert.ok(after.path&&after.metres>before.metres+2,String(after.metres));
 assert.equal(after.sight,false);
});

test('map lab: drag, resize, duplicate, rename and remove keep the data the game reads consistent',()=>{
 const m=new MapModel(clubDoc(),'club');
 // Resizing never turns a room inside out.
 const room:Ref={kind:'rooms',key:3};
 m.change(doc=>resizeItem(doc,room,['maxX'],-100,0));
 assert.ok(get(m.doc,room)!.maxX>get(m.doc,room)!.minX);
 // One drag is one undo step however many moves it makes.
 const npc=items(m.doc,'npcs')[1].ref,start=structuredClone(get(m.doc,npc)!.route);
 m.beginDrag();for(let i=1;i<=5;i++)m.dragTo(doc=>moveHandle(doc,npc,'route.0',start[0][0]+i*.1,start[0][1]));m.endDrag();
 assert.equal(get(m.doc,npc)!.route[0][0],Math.round((start[0][0]+.5)*100)/100);
 m.undo();assert.deepEqual(get(m.doc,npc)!.route,start);
 // A schedule place renamed: every plan that used it follows.
 const place=items(m.doc,'schedulePlaces')[0].ref,users=()=>Object.values(m.doc.actors as Record<string,{plan:{place:string}[]}>).flatMap(a=>a.plan).filter(e=>e.place===place.key).length;
 const used=users();assert.ok(used>0);
 const renamed=m.rename(place,'renamed_place')!;
 assert.equal(Object.values(m.doc.actors as Record<string,{plan:{place:string}[]}>).flatMap(a=>a.plan).filter(e=>e.place==='renamed_place').length,used);
 assert.deepEqual(checkMap(m.doc).filter(i=>i.level==='error'),[]);
 // Removing it leaves the plans pointing at nothing: an error that names the plan.
 m.remove(renamed);
 assert.ok(checkMap(m.doc).some(i=>i.level==='error'&&i.text.includes('renamed_place')));
 // Duplicates get their own id.
 const copy=m.duplicate({kind:'furniture',key:0})!;
 assert.notEqual(get(m.doc,copy)!.id,get(m.doc,{kind:'furniture',key:0})!.id);
});

test('map lab: clicking picks the small thing on top before the room under it, on the right floor',()=>{
 const doc=clubDoc(),{value}=items(doc,'exits')[0];
 const hits=pick(doc,0,value.x,value.z,.2);
 assert.equal(hits[0].kind,'exits');
 assert.ok(hits.some(h=>h.kind==='rooms'));
 assert.ok(pick(doc,1,value.x,value.z,.2).every(h=>h.kind!=='exits'));
});

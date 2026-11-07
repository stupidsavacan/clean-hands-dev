// 2026-11-07: every item is complete across the tables that know about it (scripts/spec-items.ts), every placed item and
// agency pickup can be reached, and docs/items.md is current. A new item or map fails here with the missing piece named.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemRows,itemProblems,placementProblems,canReach,ITEM_EXCEPTIONS,MAPS,itemsMarkdown} from '../scripts/spec-items.ts';

test('every hand-held item has its model, its hold, and a rule on each map that places it',()=>{
 assert.deepEqual(itemProblems(),[]);});

test('each deliberate exception still applies (remove the line once the gap is filled)',()=>{
 const rows=itemRows();
 for(const key of Object.keys(ITEM_EXCEPTIONS)){const [id,what]=key.split(':');const r=rows.find(r=>r.id===id);assert.ok(r,`${key}: no such item`);
  if(what==='model')assert.ok(!r!.model,`${key}: the model exists now; remove the exception`);
  if(what==='hold')assert.ok(!r!.hold,`${key}: the hold exists now; remove the exception`);}});

test('every placed item and agency pickup has a spot within reach on every map',()=>{
 assert.deepEqual(placementProblems(),[]);});

test('the reach check itself catches a spot inside a solid block',()=>{
 const level=JSON.parse(readFileSync(new URL('../src/data/club-map.json',import.meta.url),'utf8')) as {walls:{x:number;z:number;w:number;d:number;y?:number;h:number;floor?:number}[];blockers:{x:number;z:number;w:number;d:number;y?:number;h:number;floor?:number}[]};
 const solid=[...level.walls,...level.blockers].filter(b=>!b.floor&&!(b.y??0)&&b.h>=2).sort((a,b)=>Math.min(b.w,b.d)-Math.min(a.w,a.d))[0];
 assert.ok(solid,'a full-height block on the ground floor');
 if(Math.min(solid.w,solid.d)>3)assert.equal(canReach('club',solid.x,solid.z,0),false);
 assert.equal(canReach('club',MAPS.length?17.2:0,33.2,0),true,'the briefcase spot in the club is reachable');});

test('docs/items.md is generated from the tables and current',()=>{
 const doc=readFileSync(new URL('../../docs/items.md',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.equal(doc,itemsMarkdown(),'run: node --experimental-strip-types --no-warnings scripts/spec-docs.ts');});

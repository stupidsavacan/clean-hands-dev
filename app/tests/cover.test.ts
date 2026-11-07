import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {coverPlacements,coveredIds}from '../src/cover-props.ts';
const hotel=JSON.parse(readFileSync(new URL('../src/data/hotel.json',import.meta.url),'utf8')),blockers=hotel.blockers as {id:string;x:number;z:number;w:number;d:number;h:number;y:number;floor?:number}[];

test('M5.5 cover models replace every car, crate, planter and counter box, and nothing else',()=>{
 const ids=coveredIds(blockers as never),expect=blockers.filter(b=>/^(car|planter|counter)/.test(b.id)||/^crate-(dock|pier)/.test(b.id)).map(b=>b.id).sort();
 assert.deepEqual([...ids].sort(),expect);assert.equal(ids.has('crate-sommelier-screen'),false,'the tall screen stays a box');
 const count=(m:string)=>coverPlacements(blockers as never).filter(p=>p.model===m).length;
 assert.equal(count('car_sedan_blue')+count('car_sedan_white')+count('car_sedan_grey'),blockers.filter(b=>b.id.startsWith('car')).length);assert.ok(count('car_sedan_blue')&&count('car_sedan_white')&&count('car_sedan_grey'));});

test('M5.5 each model sits on its collision footprint: cars along their length, counters as 2 m modules filling the box exactly',()=>{
 for(const b of blockers){const p=coverPlacements([b] as never);if(!p.length)continue;
  if(b.id.startsWith('car')){assert.equal(p[0].rotation,b.w>b.d?Math.PI/2:0,b.id);assert.deepEqual([p[0].x,p[0].z],[b.x,b.z]);}
  if(b.id.startsWith('counter')){const long=Math.max(b.w,b.d),along=b.d>b.w?'z':'x';const ends=p.map(q=>q[along]-b[along]);
   assert.ok(Math.abs(Math.min(...ends)-(-long/2+long/p.length/2))<1e-9&&Math.abs(Math.max(...ends)-(long/2-long/p.length/2))<1e-9,b.id);
   for(const q of p){assert.ok(Math.abs(q.scale[0]*2*p.length-long)<1e-9);assert.ok(Math.abs(q.scale[1]*1.1-b.h)<1e-9);assert.equal(q.scale[2],Math.min(b.w,b.d));}}}});

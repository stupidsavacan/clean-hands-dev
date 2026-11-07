import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {CollisionWorld}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';
const hotel=JSON.parse(readFileSync(new URL('../src/data/hotel.json',import.meta.url),'utf8')),nav=new NavGrid(new CollisionWorld(hotel));

test('M5.5 fix: once a frame\'s search time is spent, new routes wait for the next frame (a cached route never waits)',()=>{
 const a={x:-40,y:0,z:-30},b={x:2,y:0,z:-6},c={x:-30,y:0,z:6};
 nav.frame(0);assert.ok(nav.findSoon(a,b),'the first search of a frame always runs');
 assert.equal(nav.findSoon(a,c),undefined,'the next one waits');assert.ok(nav.findSoon(a,b),'a cached route is free');
 nav.frame(4);assert.ok(nav.findSoon(a,c),'and runs on the next frame');});

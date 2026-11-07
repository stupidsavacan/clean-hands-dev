import {test}from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from 'node:fs';
import {Director,type Mission,type NpcDef,type PlayerView,type Rules}from '../src/ai.ts';
import {CollisionWorld}from '../src/world.ts';
import {NavGrid}from '../src/nav.ts';
import {sightBoxes}from '../src/sight.ts';
const map=JSON.parse(readFileSync(new URL('../src/data/marina.json',import.meta.url),'utf8')),rules=JSON.parse(readFileSync(new URL('../src/data/rules.json',import.meta.url),'utf8'));
const player=(x=-8,z=9.5):PlayerView=>({x,y:0,z,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'});
function build(npcs:NpcDef[]){const level=structuredClone(map)as Mission;level.npcs=npcs;const world=new CollisionWorld(level);return new Director(level,world,new NavGrid(world),sightBoxes(level),structuredClone(rules)as Rules);}
const still=(id:string,x:number,z:number):NpcDef=>({id,role:'guest',label:id,floor:0,route:[[x,z,600]],look:[x,z+1]});

test('perception is tiered by distance: 10 Hz near, 2 Hz mid, stopped far or on another floor',()=>{const d=build([still('near',-8,0),still('mid',-8,0),still('far',-8,0),still('upstairs',-8,0)]);
 const [near,mid,far,up]=d.npcs,p=player(-8,0);near.pos={x:-8,y:0,z:10};mid.pos={x:-8,y:0,z:40};far.pos={x:-8,y:0,z:70};up.pos={x:-8,y:3.5,z:5};
 const calls=new Map<string,number>();for(const n of d.npcs){const real=n.perceive.bind(n);n.perceive=(...a)=>{calls.set(n.id,(calls.get(n.id)??0)+1);real(...a);};n.move=()=>{};}
 far.visibility=1;for(let i=0;i<60;i++)d.step(1/60,p);
 assert.deepEqual([near.tier,mid.tier,far.tier,up.tier],['near','mid','far','far']);
 assert.equal(calls.get('near'),10);assert.equal(calls.get('mid'),2);assert.equal(calls.get('far'),undefined);assert.equal(calls.get('upstairs'),undefined);assert.equal(far.visibility,0);});

test('targets, witnesses and anyone already involved stay at full rate whatever the distance, keeping their state',()=>{const d=build([{...still('target',-8,0),target:true},still('witness',-8,0),still('idle',-8,0)]);
 const [target,witness,idle]=d.npcs,p=player(-8,0);for(const n of d.npcs){n.pos={x:-8,y:0,z:80};n.move=()=>{};}witness.state='report';witness.timer=99;witness.lastSeen={x:-8,y:0,z:0};
 d.step(1/60,p);assert.deepEqual([target.tier,witness.tier,idle.tier],['near','near','far']);assert.equal(witness.state,'report');});

test('120 people on the map keep the AI step inside the 8 ms frame budget',()=>{const npcs:NpcDef[]=[];for(let i=0;i<120;i++){const src=map.npcs[i%map.npcs.length] as NpcDef;npcs.push({...structuredClone(src),id:`${src.id}-${i}`});}
 const d=build(npcs),p=player();for(let i=0;i<120;i++)d.step(1/60,p);
 const frames=600,start=performance.now();for(let i=0;i<frames;i++)d.step(1/60,{...p,x:-8+Math.sin(i/90)*4});const ms=(performance.now()-start)/frames;
 console.log(`120 NPC AI step: ${ms.toFixed(2)} ms/frame`);assert.ok(ms<8,`${ms.toFixed(2)} ms`);});

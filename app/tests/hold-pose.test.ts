// 2026-11-05: carrying a tool changes the right arm only (hold-pose.ts; HITMAN WoA carry research rows 88-99).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Locomotion,WALK_SPEED,RUN_SPEED} from '../src/locomotion.ts';
import {holdPose,holdKind} from '../src/hold-pose.ts';
function swings(speed:number,kind?:'small'|'long'){const l=new Locomotion(),right:number[]=[],left:number[]=[],elbow:number[]=[],legs:number[]=[];
 for(let i=0;i<240;i++){let p=l.update(1/60,{speed,crouch:0,slope:0,turn:0,distance:speed/60});p=structuredClone(p);if(kind)holdPose(p,kind);right.push(p.arms[1].swing);left.push(p.arms[0].swing);elbow.push(p.arms[1].elbow);legs.push(p.legs[0].thigh);}
 const span=(a:number[])=>Math.max(...a.slice(120))-Math.min(...a.slice(120));return {right:span(right),left:span(left),elbow:Math.min(...elbow.slice(120)),legs:span(legs)};}
for(const speed of [WALK_SPEED,RUN_SPEED])test(`a tool in hand calms the right arm only (speed ${speed})`,()=>{
 const free=swings(speed),small=swings(speed,'small'),long=swings(speed,'long');
 assert.ok(small.right<free.right*.5&&long.right<free.right*.3,JSON.stringify({free,small,long}));
 assert.ok(small.elbow>=.75&&long.elbow>=1.05);
 assert.equal(small.left,free.left);assert.equal(small.legs,free.legs);});
test('every tool the maps place has a hold kind',()=>{assert.equal(holdKind('mop'),'long');for(const t of ['wrench','bottle','camera','tray'])assert.equal(holdKind(t),'small');});
// Item Lab 2026-11-05: crouching, a long thing held the standing way went into the floor; the arm now comes up with it.
test('crouching raises the arm that holds a thing',()=>{
 const l=new Locomotion();let stand=0,crouch=0;
 for(let i=0;i<120;i++){const p=structuredClone(l.update(1/60,{speed:0,crouch:0,slope:0,turn:0,distance:0}));stand=holdPose(p,'long').arms[1].swing;}
 const c=new Locomotion();for(let i=0;i<120;i++){const p=structuredClone(c.update(1/60,{speed:0,crouch:1,slope:0,turn:0,distance:0}));crouch=holdPose(p,'long').arms[1].swing;}
 assert.ok(crouch<stand-.3,JSON.stringify({stand,crouch}));});

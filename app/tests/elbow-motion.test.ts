import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {CLIPS} from '../src/labs/motion-clips.ts';
import {GUNS} from '../src/labs/motion-guns.ts';
import {checkSolvedArm,runSolvedClipChecks} from '../src/labs/motion-checks.ts';
import {ELBOW_CHECKS,elbowInRange,runAgentDrawCheck,runAgentHolsterCheck,runSinglePunchCheck,runElbowCheck} from '../src/labs/motion-checks.ts';

test('elbow flexion accepts 0° and 180° and rejects backward, over-bent and non-finite values',()=>{
 for(const radians of [0,Math.PI/2,Math.PI])assert.ok(elbowInRange(radians));
 for(const radians of [-.01,Math.PI+.01,2*Math.PI,NaN,Infinity])assert.ok(!elbowInRange(radians));
});

for(const check of ELBOW_CHECKS)test(`elbow flexion stays within 0–180°: ${check.label}`,()=>{
 const issue=runElbowCheck(check);
 if(issue)assert.fail(`${issue.motion} · ${issue.side}肘 ${issue.degrees}°`);
});

test('the lab reports the motion, side and angle for the first out-of-range elbow',()=>{
 const issue=runElbowCheck({label:'test',*samples(){
  yield {motion:'valid 0%',left:0,right:Math.PI};
  yield {motion:'invalid 50%',left:0,right:181*Math.PI/180};
 }});
 assert.deepEqual(issue,{motion:'invalid 50%',side:'右',degrees:181});
});

test('Agent 07 keeps the right elbow behind the wrist and maintains the grip while drawing',async()=>{
 const issue=await runAgentDrawCheck();
 if(issue)assert.fail(issue);
});

test('Agent 07 keeps the elbow outside the shoulder and holds the grip around holster frame 6',async()=>{
 const issue=await runAgentHolsterCheck();
 if(issue)assert.fail(issue);
});

test('the single punch keeps the elbow outside the shoulder around frame 24',async()=>{
 const issue=await runSinglePunchCheck();
 if(issue)assert.fail(issue);
});

test('a solved arm can bend forwards, but a reversed bend and a collapsed forearm are reported',()=>{
 const upper=new Vector3(1,0,0),hinge=new Vector3(0,0,1),rest=[1,1] as const;
 assert.equal(checkSolvedArm(upper,new Vector3(0,1,0),hinge,rest),null);
 assert.equal(checkSolvedArm(upper,new Vector3(1,0,0),hinge,rest),null);
 assert.equal(checkSolvedArm(upper,new Vector3(0,-1,0),hinge,rest)?.kind,'bend');
 assert.equal(checkSolvedArm(upper,new Vector3(),hinge,rest)?.kind,'geometry');
 assert.equal(checkSolvedArm(upper,new Vector3(0,1.2,0),hinge,rest)?.kind,'geometry');
});

test('all motion lab clips keep valid arms on both actors after IK',async()=>{
 const report=await runSolvedClipChecks();
 assert.deepEqual(report.clips,CLIPS.map(clip=>clip.id));
 assert.equal(report.frames,CLIPS.reduce((total,clip)=>
  total+(Math.ceil(clip.seconds*30)+1)*(clip.combat?GUNS.length:clip.m3?2:1),0));
 const clips=new Map(CLIPS.map(clip=>[clip.id,clip]));
 for(const issue of report.issues){
  const clip=clips.get(issue.clip)!;
  assert.equal(issue.seconds,Math.min(issue.frame/30,clip.seconds));
  assert.ok(issue.actorId==='agent'||issue.actorId==='npc:guard');
  if(clip.combat)assert.ok(GUNS.some(gun=>gun.id===issue.gunId));
  if(clip.m3)assert.ok(issue.role==='giver'||issue.role==='receiver');
 }
 const errors=report.issues.filter(issue=>issue.kind==='geometry');
 assert.deepEqual(errors,[]);
});

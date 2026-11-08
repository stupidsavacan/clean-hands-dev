import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ELBOW_CHECKS,elbowInRange,runAgentDrawCheck,runElbowCheck} from '../src/labs/motion-checks.ts';

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

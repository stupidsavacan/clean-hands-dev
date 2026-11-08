import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AGENT_PISTOL_VARIANTS,COMBAT_SECONDS,sampleCombat,type CombatKind} from '../src/combat-motion.ts';
import {sampleMotion,type MotionKind} from '../src/motion.ts';
import {sampleM4Motion} from '../src/m4-motion.ts';
import traversalPoses from '../src/data/party-motions.json' with {type:'json'};
import {brawlMotion} from '../src/brawl-motion.ts';
import {katanaGiver,katanaReceiver} from '../src/katana-motion.ts';
import {CROUCH_SPEED,Locomotion,RUN_SPEED,WALK_SPEED,type Pose} from '../src/locomotion.ts';
import {holdPose,strikePose,surrenderPose} from '../src/hold-pose.ts';
import {GESTURES,gesturePose} from '../src/gestures.ts';

// Check signed flexion before it becomes a quaternion or an unsigned angle between bones.
// Both of those representations can hide a rotation past the limits by folding it back into 0–180°.
function checkBend(radians:number,where:string){
 assert.ok(Number.isFinite(radians)&&radians>=0&&radians<=Math.PI,
  `${where}: elbow flexion ${radians*180/Math.PI}° is outside 0–180°`);
}

function checkMotionElbows(pose:{bones:Readonly<Record<string,readonly number[]>>},where:string){
 // Rig.apply mirrors the Y rotation of the two forearms. Zero is straight.
 checkBend(-pose.bones.forearml[1],`${where}, left`);
 checkBend(pose.bones.forearmr[1],`${where}, right`);
}

function checkPoseElbows(pose:Pose,where:string){
 checkBend(pose.arms[0].elbow,`${where}, left`);
 checkBend(pose.arms[1].elbow,`${where}, right`);
}

test('elbow flexion accepts 0° and 180° and rejects backward, over-bent and non-finite values',()=>{
 for(const radians of [0,Math.PI/2,Math.PI])checkBend(radians,'limit');
 for(const radians of [-.01,Math.PI+.01,2*Math.PI,NaN,Infinity]){
  assert.throws(()=>checkBend(radians,'limit'),/elbow flexion .* is outside 0–180°/);
 }
});

test('both elbows stay within range in gunplay and the Animation Lab pistol variants',()=>{
 const stances=[
  {weapon:'pistol',agent:false,variant:undefined},
  {weapon:'pistol',agent:true,variant:undefined},
  {weapon:'long',agent:false,variant:undefined},
  ...Object.keys(AGENT_PISTOL_VARIANTS).map(variant=>({weapon:'pistol',agent:true,variant} as const)),
 ] as const;
 for(const kind of Object.keys(COMBAT_SECONDS) as CombatKind[])for(const {weapon,agent,variant} of stances){
  for(let frame=0;frame<=200;frame++){
   const t=frame/200;
   const pose=sampleCombat(kind,weapon,t,agent,undefined,variant).pose;
   checkMotionElbows(pose,`${kind}/${variant??(agent?'agent pistol':weapon)} at ${t}`);
  }
 }
});

test('both elbows stay within range in paired actions, brawls, sword attacks and disguises',()=>{
 const paired=['ko','kill','fall','drag','pickup','drop','hide'] as const satisfies readonly MotionKind[];
 for(let frame=0;frame<=200;frame++){
  const t=frame/200;
  for(const role of ['giver','receiver'] as const){
   for(const kind of paired)checkMotionElbows(sampleMotion(kind,role,t),`${kind}/${role} at ${t}`);
   for(const kind of ['change','frisk'] as const)checkMotionElbows(sampleM4Motion(kind,role,t),`${kind}/${role} at ${t}`);
   for(const blows of [0,1,2,3])checkMotionElbows(brawlMotion(role,blows,t).pose,`brawl ${blows}/${role} at ${t}s`);
   checkMotionElbows(brawlMotion(role,3,t,true).pose,`single punch/${role} at ${t}s`);
  }
  for(const behind of [false,true]){
   const label=behind?'sword from behind':'sword from front';
   checkMotionElbows(katanaGiver(behind,t).pose,`${label}/giver at ${t}`);
   checkMotionElbows(katanaReceiver(behind,t).pose,`${label}/receiver at ${t}`);
  }
 }
});

test('both elbows stay within range in the climb and vault poses',()=>{
 for(const [kind,pose] of Object.entries(traversalPoses))checkMotionElbows(pose,kind);
});

test('both elbows stay within range in locomotion, carrying, strikes and surrender',()=>{
 const gaits=[['idle',0,0],['walk',WALK_SPEED,0],['run',RUN_SPEED,0],
  ['crouch walk',CROUCH_SPEED,1],['crouch idle',0,1]] as const;
 for(const [name,speed,crouch] of gaits){
  const loco=new Locomotion();
  for(let frame=0;frame<=120;frame++){
   const t=frame/120;
   const pose=loco.update(1/60,{speed,crouch,slope:0,turn:0,distance:speed/60});
   checkPoseElbows(pose,`${name} frame ${frame}`);
   for(const hold of ['small','long','hang'] as const){
    checkPoseElbows(holdPose(structuredClone(pose),hold),`${name} holding ${hold} frame ${frame}`);
   }
   for(const strike of ['blunt','blade','punch'] as const){
    checkPoseElbows(strikePose(structuredClone(pose),strike,t),`${name} with ${strike} strike at ${t}`);
   }
   checkPoseElbows(surrenderPose(structuredClone(pose),t),`${name} with surrender at ${t}s`);
  }
 }
});

test('both elbows stay within range in scheduled gestures',()=>{
 const base=new Locomotion().update(1/60,{speed:0,crouch:0,slope:0,turn:0,distance:0});
 for(const action of Object.keys(GESTURES))for(let frame=0;frame<=40*60;frame++){
  const time=frame/60,pose=structuredClone(base);
  gesturePose(pose,action,time);
  checkPoseElbows(pose,`${action} at ${time}s`);
 }
});

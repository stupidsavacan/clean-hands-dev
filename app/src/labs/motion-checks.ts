import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AGENT_PISTOL_VARIANTS,COMBAT_SECONDS,sampleCombat,weaponVisible,type CombatKind} from '../combat-motion.ts';
import {poseCombat,prepareWeapon} from '../combat-runtime.ts';
import {COMBAT_MODELS} from '../combat-data.ts';
import {PLAYER_BASE64} from '../player-data.ts';
import {Rig} from '../rig.ts';
import {sampleMotion,sampleRescueMotion,sampleCoinPickupMotion,type MotionKind} from '../motion.ts';
import {sampleM4Motion} from '../m4-motion.ts';
import traversalPoses from '../data/party-motions.json' with {type:'json'};
import {brawlMotion} from '../brawl-motion.ts';
import {katanaGiver,katanaReceiver} from '../katana-motion.ts';
import {CROUCH_SPEED,Locomotion,RUN_SPEED,WALK_SPEED,type Pose} from '../locomotion.ts';
import {holdPose,strikePose,surrenderPose} from '../hold-pose.ts';
import {GESTURES,gesturePose} from '../gestures.ts';

type ElbowSample={motion:string;left:number;right:number};

// Use signed flexion before IK or quaternion conversion can wrap an out-of-range angle.
export function elbowInRange(radians:number){
 return Number.isFinite(radians)&&radians>=0&&radians<=Math.PI;
}

function motionSample({bones}:{bones:Readonly<Record<string,readonly number[]>>},motion:string):ElbowSample{
 // The rig uses opposite Y rotation signs for the left and right forearms.
 return {motion,left:-bones.forearml[1],right:bones.forearmr[1]};
}

function poseSample(pose:Pose,motion:string):ElbowSample{
 return {motion,left:pose.arms[0].elbow,right:pose.arms[1].elbow};
}

function* gunplay(){
 const stances=[
  {weapon:'pistol',agent:false,variant:undefined},
  {weapon:'pistol',agent:true,variant:undefined},
  {weapon:'long',agent:false,variant:undefined},
  ...Object.keys(AGENT_PISTOL_VARIANTS).map(variant=>({weapon:'pistol',agent:true,variant} as const)),
 ] as const;
 for(const kind of Object.keys(COMBAT_SECONDS) as CombatKind[])for(const {weapon,agent,variant} of stances){
  for(let frame=0;frame<=200;frame++){
   const t=frame/200;
   yield motionSample(sampleCombat(kind,weapon,t,agent,undefined,variant).pose,
    `${kind}/${variant??(agent?'agent pistol':weapon)} ${frame/2}%`);
  }
 }
}

function* pairedActions(){
 const paired=['ko','kill','fall','drag','pickup','drop','hide'] as const satisfies readonly MotionKind[];
 for(let frame=0;frame<=200;frame++){
  const t=frame/200,progress=`${frame/2}%`;
  yield motionSample(sampleCoinPickupMotion(t),'coin-pickup '+progress);
  for(const role of ['giver','receiver'] as const){
   for(const kind of paired)yield motionSample(sampleMotion(kind,role,t),`${kind}/${role} ${progress}`);
   for(const kind of ['change','frisk'] as const)yield motionSample(sampleM4Motion(kind,role,t),`${kind}/${role} ${progress}`);
   yield motionSample(sampleRescueMotion(role,t),`rescue/${role} ${progress}`);
   for(const blows of [0,1,2,3])yield motionSample(brawlMotion(role,blows,t).pose,`brawl ${blows}/${role} ${t}秒`);
   yield motionSample(brawlMotion(role,3,t,true).pose,`single punch/${role} ${t}秒`);
  }
  for(const behind of [false,true]){
   const label=behind?'katana-back':'katana-front';
   yield motionSample(katanaGiver(behind,t).pose,`${label}/giver ${progress}`);
   yield motionSample(katanaReceiver(behind,t).pose,`${label}/receiver ${progress}`);
  }
 }
}

function* traversal(){
 for(const [kind,pose] of Object.entries(traversalPoses))yield motionSample(pose,kind);
}

function* locomotion(){
 const gaits=[['idle',0,0],['walk',WALK_SPEED,0],['run',RUN_SPEED,0],
  ['crouch walk',CROUCH_SPEED,1],['crouch idle',0,1]] as const;
 for(const [name,speed,crouch] of gaits){
  const loco=new Locomotion();
  for(let frame=0;frame<=120;frame++){
   const t=frame/120;
   const pose=loco.update(1/60,{speed,crouch,slope:0,turn:0,distance:speed/60});
   yield poseSample(pose,`${name} ${frame}コマ`);
   for(const hold of ['small','long','hang'] as const){
    yield poseSample(holdPose(structuredClone(pose),hold),`${name}/${hold} ${frame}コマ`);
   }
   for(const strike of ['blunt','blade','punch'] as const){
    yield poseSample(strikePose(structuredClone(pose),strike,t),`${name}/${strike} ${(t*100).toFixed(1)}%`);
   }
   yield poseSample(surrenderPose(structuredClone(pose),t),`${name}/surrender ${t.toFixed(3)}秒`);
  }
 }
}

function* gestures(){
 const base=new Locomotion().update(1/60,{speed:0,crouch:0,slope:0,turn:0,distance:0});
 for(const action of Object.keys(GESTURES))for(let frame=0;frame<=40*60;frame++){
  const time=frame/60,pose=structuredClone(base);
  gesturePose(pose,action,time);
  yield poseSample(pose,`${action} ${time.toFixed(3)}秒`);
 }
}

export const ELBOW_CHECKS=[
 {label:'銃の動き',samples:gunplay},
 {label:'格闘・刀・変装・検査',samples:pairedActions},
 {label:'登り・乗り越え',samples:traversal},
 {label:'移動・持ち物・攻撃・投降',samples:locomotion},
 {label:'日常の仕草',samples:gestures},
];

export function runElbowCheck({samples}:typeof ELBOW_CHECKS[number]){
 for(const {motion,left,right} of samples()){
  for(const [side,angle] of [['左',left],['右',right]] as const){
   if(!elbowInRange(angle))return {motion,side,degrees:angle*180/Math.PI};
  }
 }
 return null;
}

export async function runAgentDrawCheck(){
 // Use the game rig and weapon anchors without loading textures or drawing a scene.
 const loader=new GLTFLoader().register(()=>({name:'draw-check-material',loadMaterial:()=>Promise.resolve(new T.MeshBasicMaterial())}));
 const load=async(base64:string)=>(await loader.parseAsync(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer,'')).scene;
 const [model,gun]=await Promise.all([load(PLAYER_BASE64),load(COMBAT_MODELS.pistol_silenced)]);
 const actor=new T.Group();
 actor.add(model);
 const rig=new Rig(model),weapon=prepareWeapon(gun,'pistol');
 const elbow=rig.joints.get('forearmr')!.bone,wrist=rig.joints.get('handr')!.bone;
 const point=new T.Vector3();
 for(const crouch of [0,1]){
  const loco=new Locomotion(),input={speed:0,crouch,slope:0,turn:0,distance:0};
  for(let i=0;i<80;i++)loco.update(1/60,input);
  const idle=loco.update(1/60,input),seconds=COMBAT_SECONDS.draw;
  for(let frame=0;frame<=Math.ceil(seconds*30);frame++){
   const t=Math.min(1,frame/(30*seconds));
   if(!weaponVisible('draw','pistol',t,true))continue;
   rig.apply(idle);
   const gripError=poseCombat(rig,actor,model,sampleCombat('draw','pistol',t,true),weapon,crouch,1);
   const lead=actor.worldToLocal(elbow.getWorldPosition(point)).z-actor.worldToLocal(wrist.getWorldPosition(point)).z;
   const where=`${crouch?'しゃがみ':'立ち'} ${frame}コマ目`;
   if(!Number.isFinite(lead)||!Number.isFinite(gripError))return `${where} · 右腕の姿勢が無効`;
   if(lead>.02)return `${where} · 右肘が手首より ${(lead*100).toFixed(1)} cm 前`;
   if(gripError>.025)return `${where} · 右手とグリップのずれ ${(gripError*100).toFixed(1)} cm`;
  }
 }
 return null;
}

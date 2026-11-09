import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AGENT_PISTOL_VARIANTS,COMBAT_SECONDS,sampleCombat,weaponVisible,type CombatKind} from '../combat-motion.ts';
import {poseCombat,prepareWeapon} from '../combat-runtime.ts';
import {COMBAT_MODELS} from '../combat-data.ts';
import {PLAYER_BASE64} from '../player-data.ts';
import {NPC_MODELS} from '../npc-data.ts';
import {applyMotion,aimFists,plantFeetAt,reachHandsAt,bonePoint} from '../motion-runtime.ts';
import {Rig} from '../rig.ts';
import {sampleMotion,sampleRescueMotion,sampleCoinPickupMotion,type MotionKind,type MotionRole} from '../motion.ts';
import {sampleM4Motion} from '../m4-motion.ts';
import traversalPoses from '../data/party-motions.json' with {type:'json'};
import {BRAWL_GAP,brawlMotion,singlePunchPreview} from '../brawl-motion.ts';
import {katanaGiver,katanaReceiver} from '../katana-motion.ts';
import {CROUCH_SPEED,Locomotion,RUN_SPEED,WALK_SPEED,type Pose} from '../locomotion.ts';
import {holdPose,strikePose,surrenderPose} from '../hold-pose.ts';
import {GESTURES,gesturePose} from '../gestures.ts';
import {CLIPS} from './motion-clips.ts';
import {GUNS} from './motion-guns.ts';
import {poseMotionPreview,type PreviewActor} from './motion-preview.ts';

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

// Use the game rigs and weapon anchors without loading textures or drawing a scene.
function modelLoader(){
 const loader=new GLTFLoader().register(()=>({name:'motion-check-material',loadMaterial:()=>Promise.resolve(new T.MeshBasicMaterial())}));
 return async(base64:string)=>(await loader.parseAsync(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer,'')).scene;
}

const REVERSE_BEND_TOLERANCE=Math.sin(8*Math.PI/180);
const HAND_CONTACT_TOLERANCE=.025;

type ArmIssue={kind:'geometry'|'bend';detail:string};

// Segment lengths stay fixed in the stock rigs. The cross product also distinguishes the two directions
// of a bend, which an unsigned angle between the upper arm and forearm cannot do.
export function checkSolvedArm(upper:T.Vector3,forearm:T.Vector3,hinge:T.Vector3,rest:readonly [number,number]):ArmIssue|null{
 const upperLength=upper.length(),forearmLength=forearm.length();
 if(!Number.isFinite(upperLength+forearmLength+hinge.lengthSq())||upperLength<1e-6||forearmLength<1e-6)
  return {kind:'geometry',detail:'腕の骨格が無効'};
 if(Math.abs(upperLength-rest[0])>rest[0]*.01||Math.abs(forearmLength-rest[1])>rest[1]*.01)
  return {kind:'geometry',detail:'上腕または前腕の長さが変化'};
 // Near full extension, the bend direction is sensitive to small offsets in the bind pose.
 const bend=new T.Vector3().crossVectors(upper,forearm).dot(hinge)/(upperLength*forearmLength);
 if(bend<-REVERSE_BEND_TOLERANCE)return {kind:'bend',detail:'肘が逆に曲がっている可能性'};
 return null;
}

function armProbe(rig:Rig,side:'l'|'r'){
 const upper=rig.joints.get('upperarm'+side),forearm=rig.joints.get('forearm'+side),hand=rig.joints.get('hand'+side);
 if(!upper||!forearm||!hand||!forearm.bone.parent)throw new Error('Missing arm bones: '+side);
 const shoulder=new T.Vector3(),elbow=new T.Vector3(),wrist=new T.Vector3(),hinge=new T.Vector3();
 const upperVector=new T.Vector3(),forearmVector=new T.Vector3(),parentRotation=new T.Quaternion();
 // Transport the neutral hinge with the upper arm. The solved forearm may itself be twisted.
 const localHinge=new T.Vector3(0,side==='r'?1:-1,0).applyQuaternion(forearm.w0i).applyQuaternion(forearm.q0);
 const rest=[upper.bone.getWorldPosition(shoulder).distanceTo(forearm.bone.getWorldPosition(elbow)),
  elbow.distanceTo(hand.bone.getWorldPosition(wrist))] as const;
 return ()=>{
  upperVector.subVectors(forearm.bone.getWorldPosition(elbow),upper.bone.getWorldPosition(shoulder));
  forearmVector.subVectors(hand.bone.getWorldPosition(wrist),elbow);
  hinge.copy(localHinge).applyQuaternion(forearm.bone.parent!.getWorldQuaternion(parentRotation));
  return checkSolvedArm(upperVector,forearmVector,hinge,rest);
 };
}

export type ClipIssue={
 kind:ArmIssue['kind']|'contact';clip:string;where:string;detail:string;
 frame:number;seconds:number;actorId:string;gunId?:string;role?:MotionRole;
};
export const MOTION_CHECK_CAST=['agent','npc:guard'] as const;

export async function runSolvedClipChecks(afterClip?:(checked:number,total:number)=>Promise<void>){
 const load=modelLoader();
 const guns=await Promise.all(GUNS.map(async gun=>({...gun,object:await load(gun.b64)})));
 const cast=[{id:MOTION_CHECK_CAST[0],base64:PLAYER_BASE64,label:'07'},{id:MOTION_CHECK_CAST[1],base64:NPC_MODELS.guard,label:'警備'}];
 const entries=await Promise.all(cast.map(async({id,base64,label})=>{
  const model=await load(base64);
  const group=new T.Group();group.add(model);
  const rig=new Rig(model),actor:PreviewActor={def:{id},group,model,rig,loco:new Locomotion(),sim:-1,
   weapons:Object.fromEntries(guns.map(gun=>[gun.id,prepareWeapon(gun.object.clone(),gun.cls)]))};
  return {actor,label,arms:[['左',armProbe(rig,'l')],['右',armProbe(rig,'r')]] as const};
 }));
 const actors=entries.map(({actor})=>actor),issues:ClipIssue[]=[],clips:string[]=[];
 let frames=0;
 for(const clip of CLIPS){
  const found=new Set<ClipIssue['kind']>();
  const record=(kind:ClipIssue['kind'],where:string,detail:string,target:Pick<ClipIssue,'frame'|'seconds'|'actorId'|'gunId'|'role'>)=>{
   if(found.has(kind))return;
   found.add(kind);
   issues.push({kind,clip:clip.id,where:clip.label+' · '+where,detail,...target});
  };
  const roles=clip.m3?['giver','receiver'] as const:['giver'] as const;
  for(const gun of clip.combat?guns:[guns[0]])for(const role of roles){
   for(const actor of actors)actor.sim=-1;
   const context=clip.combat?(gun.label+' · '):clip.m3?(role==='giver'?'する側 · ':'される側 · '):'';
   for(let frame=0;frame<=Math.ceil(clip.seconds*30);frame++){
    const t=Math.min(clip.seconds,frame/30);
    frames++;
    const target={frame,seconds:t,gunId:clip.combat?gun.id:undefined,role:clip.m3?role:undefined};
    for(const {actor,label} of entries){
     const miss=poseMotionPreview(actor,actors,clip,t,{role,gun,variant:'F'});
     const where=context+label+' · '+frame+'コマ目';
     if(miss!==undefined){
      if(!Number.isFinite(miss))record('geometry',where,'手の目標位置が無効',{...target,actorId:actor.def.id});
      else if(miss>HAND_CONTACT_TOLERANCE)record('contact',where,'手と目標のずれ '+(miss*100).toFixed(2)+' cm',{...target,actorId:actor.def.id});
     }
    }
    // Paired poses can update the other actor. Inspect only once both actors are in their final pose.
    for(const {actor,label,arms} of entries)for(const [side,probe] of arms){
     const issue=probe();
     if(issue)record(issue.kind,context+label+' · '+frame+'コマ目 · '+side+'肘',issue.detail,{...target,actorId:actor.def.id});
    }
   }
  }
  clips.push(clip.id);
  await afterClip?.(clips.length,CLIPS.length);
 }
 return {clips,frames,issues};
}

export async function runAgentDrawCheck(){
 const load=modelLoader();
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

function armInboard(rig:Rig,actor:T.Object3D){
 const shoulder=actor.worldToLocal(bonePoint(rig,'upperarmr')!);
 const elbow=actor.worldToLocal(bonePoint(rig,'forearmr')!);
 return elbow.x-shoulder.x;
}

export async function runAgentHolsterCheck(){
 const load=modelLoader(),[model,gun]=await Promise.all([load(PLAYER_BASE64),load(COMBAT_MODELS.pistol_silenced)]);
 const actor=new T.Group();actor.add(model);
 const rig=new Rig(model),weapon=prepareWeapon(gun,'pistol'),loco=new Locomotion();
 const idle=loco.update(1/60,{speed:0,crouch:0,slope:0,turn:0,distance:0});
 for(const frame of [6,5,7]){
  rig.apply(idle);
  const t=frame/(30*COMBAT_SECONDS.holster);
  const error=poseCombat(rig,actor,model,sampleCombat('holster','pistol',t,true),weapon,0,1);
  const inboard=armInboard(rig,actor);
  if(!Number.isFinite(inboard)||inboard>.035)return frame+'コマ目 · 右肘が右肩より内側に '+(inboard*100).toFixed(1)+' cm';
  if(!Number.isFinite(error)||error>.025)return frame+'コマ目 · 右手が銃のグリップから外れた';
 }
 return null;
}

export async function runSinglePunchCheck(){
 const load=modelLoader(),[model,opponent]=await Promise.all([load(PLAYER_BASE64),load(NPC_MODELS.guard)]);
 const actor=new T.Group(),other=new T.Group();
 actor.add(model);other.add(opponent);other.position.z=BRAWL_GAP;other.rotation.y=Math.PI;
 const rig=new Rig(model),receiver=new Rig(opponent);
 for(const frame of [24,22,23,25]){
  const seconds=frame/30;
  const g=singlePunchPreview('giver',seconds),r=singlePunchPreview('receiver',seconds);
  applyMotion(receiver,opponent,r.pose);
  plantFeetAt(receiver,opponent,r.pose,r.feet,()=>0);reachHandsAt(receiver,opponent,r.pose,r.hands);
  applyMotion(rig,model,g.pose);
  plantFeetAt(rig,model,g.pose,g.feet,()=>0);reachHandsAt(rig,model,g.pose,g.hands);
  const contactError=aimFists(rig,receiver,g.aim,actor);
  const inboard=armInboard(rig,actor);
  if(!Number.isFinite(inboard)||inboard>.035)return frame+'コマ目 · 右肘が右肩より内側に '+(inboard*100).toFixed(1)+' cm';
  if(!Number.isFinite(contactError)||contactError>.035)return frame+'コマ目 · 拳が顔の接触点から外れた';
 }
 return null;
}

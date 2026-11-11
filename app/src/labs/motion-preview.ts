import {sampleTraversal} from '../party/traversal.ts';
import {clipTraversalProgress} from './motion-clips.ts';
import {applyTraversalPose} from '../traversal-pose.ts';
import * as T from 'three';
import type {Rig} from '../rig.ts';
import {RUN_SPEED,type Locomotion,type Pose} from '../locomotion.ts';
import {gesturePose,applyGesture,type Gesture} from '../gestures.ts';
import {sampleMotion,type MotionRole} from '../motion.ts';
import {applyMotion,neutral,plantedFeet,groundBody,plantFeetAt,reachHandsAt,aimFists} from '../motion-runtime.ts';
import {sampleCombat,weaponVisible,type PistolVariant,type WeaponClass} from '../combat-motion.ts';
import {poseCombat,type Weapon} from '../combat-runtime.ts';
import {holdPose,holdKind,strikePose,surrenderPose} from '../hold-pose.ts';
import {brawlAt,brawlMotion,singlePunchPreview,BRAWL_GAP} from '../brawl-motion.ts';
import {poseKatana} from '../katana-pose.ts';
import {poseCoinPickup} from '../coin-pickup-pose.ts';
import type {CoinPickup} from '../coin-pickup.ts';
import {poseRescue} from '../rescue-pose.ts';
import {RESCUE_SPOT} from '../body-rescue.ts';
import {KATANA_GAP} from '../katana-motion.ts';
import type {Clip} from './motion-clips.ts';

export type PreviewActor={
 def:{id:string};group:T.Group;model:T.Object3D;rig:Rig;
 loco:Locomotion;sim:number;pose?:Pose;weapons:Partial<Record<string,Weapon>>;
};
type PreviewVisuals<A>={
 clearPickup:(actor:A,clip:Clip)=>void;
 hold:(actor:A,item?:string)=>void;
 scenery:(actor:A,gesture?:string)=>void;
 gesture:(actor:A,gesture:Gesture|null)=>void;
 pickup:(actor:A,pickup:CoinPickup,clip:Clip,gunId:string)=>void;
};
type PreviewOptions<A>={
 role:MotionRole;gun:{id:string;cls:WeaponClass};variant:string|PistolVariant;
 tuning?:Parameters<typeof sampleCombat>[4];visuals?:PreviewVisuals<A>;
};

// Shared by the visible preview and the headless scan. Visual props do not drive the rig.
export const SPACING=1.15;
const DT=1/60;
export function poseMotionPreview<A extends PreviewActor>(
 a:A,actors:readonly A[],clip:Clip,t:number,{role,gun,tuning,variant,visuals}:PreviewOptions<A>,
){
 const {rig,model,group}=a,cls=gun.cls;
 neutral(rig);model.position.set(0,0,0);model.rotation.set(0,0,0);
 visuals?.clearPickup(a,clip);
 // Pair clips stand the first two actors face to face; the rest keep their places in the row.
 {const i=actors.indexOf(a);if(clip.pair&&i<2){if(!(i===1&&clip.pair.startsWith('katana'))){group.position.set(0,0,i?BRAWL_GAP:0);group.rotation.y=i?Math.PI:0;}}else{group.position.set((i-(actors.length-1)/2)*SPACING,0,0);group.rotation.y=0;}}
 if(clip.pair==='rescue'){
  const [guard,body]=actors;
  if(!body||a!==body)return;
  visuals?.hold(guard,undefined);visuals?.hold(body,undefined);
  guard.group.position.set(-RESCUE_SPOT.side,0,RESCUE_SPOT.forward);guard.group.rotation.y=Math.PI/2;
  body.group.position.set(0,0,0);body.group.rotation.y=0;
  poseRescue(guard,body,t/clip.seconds,()=>0);
  return;
 }
 // The sword pair: the first actor holds it, the second is struck (posed together, from the first one's turn).
 if(clip.pair==='katana-front'||clip.pair==='katana-back'){const i=actors.indexOf(a),other=actors[1],behind=clip.pair==='katana-back',gap=behind?KATANA_GAP.behind:KATANA_GAP.front,p=t/clip.seconds;
  // Each actor's turn resets its own skeleton, so both are posed again on every turn (the second turn is the one shown).
  const first=actors[0];if(i>1)return;visuals?.hold(first,'katana');if(other){visuals?.hold(other,undefined);other.group.position.set(0,0,gap);other.group.rotation.y=behind?0:Math.PI;other.group.updateMatrixWorld(true);}
  poseKatana({rig:first.rig,model:first.model},other?{rig:other.rig,model:other.model}:null,behind,p,()=>0);return;}
 if(clip.pair){const i=actors.indexOf(a),r=i===0?'giver':'receiver';
  const at2=(role:'giver'|'receiver')=>clip.pair==='brawl'?brawlAt(role,t):singlePunchPreview(role,t);
  const put=(x:PreviewActor,p:ReturnType<typeof brawlMotion>)=>{neutral(x.rig);applyMotion(x.rig,x.model,p.pose);plantFeetAt(x.rig,x.model,p.pose,p.feet,()=>0);reachHandsAt(x.rig,x.model,p.pose,p.hands);};
  // The striker aims at the other's real body, so pose the other first.
  const other=actors[1];if(i===0&&other){other.group.position.set(0,0,BRAWL_GAP);other.group.rotation.y=Math.PI;other.group.updateMatrixWorld(true);put(other,at2('receiver'));}
  const b=at2(r);put(a,b);if(i===0&&other)aimFists(rig,other.rig,b.aim,clip.pair==='punch'?group:undefined);return;}
 for(const w of Object.values(a.weapons))if(w)w.object.visible=false;
 const progress=clip.seconds>0?T.MathUtils.clamp(t/clip.seconds,0,1):0;
 // Procedural parts (walking, idle) are simulated from the start of the clip so scrubbing back gives the same pose.
 const gait=(speed:number,crouch:number):Pose=>{const step=()=>{a.pose=a.loco.update(DT,{speed,crouch,slope:0,turn:0,distance:speed*DT});a.sim+=DT;};if(t<a.sim||a.sim<0){a.loco.reset();a.loco.time=0;a.sim=0;step();}while(a.sim+DT<=t)step();return structuredClone(a.pose!);};
 visuals?.hold(a,clip.item);
 if(!clip.gesture)visuals?.gesture(a,null);
 visuals?.scenery(a,clip.coinPickup?'coin-pickup':clip.gesture);
 if(clip.coinPickup||clip.weaponPickup){
  const at=group.localToWorld(new T.Vector3(0,clip.weaponPickup?.03:.01,.55)),pickup={at,progress};
  poseCoinPickup(a,pickup,()=>0);
  visuals?.pickup(a,pickup,clip,gun.id);
  return;
 }
 if(clip.traversal){
  const {link,reverse}=clip.traversal,frame=sampleTraversal(link,reverse,clipTraversalProgress(clip,t)),p=frame.position;
  const offset=group.position.x;
  group.position.set(offset,-.025,0);
  const local=(point:{x:number;y:number;z:number})=>({x:point.x-p.x+offset,y:point.y-p.y,z:point.z-p.z});
  const hand=frame.hand,foot=frame.foot;
  if(!frame.ladder)rig.apply(gait(0,0));
  applyTraversalPose(rig,group,model,{...frame,hand:hand&&((side)=>local(hand(side))),foot:foot&&((side)=>local(foot(side)))});
  return;
 }
 if(clip.loco){const p=gait(clip.loco.speed,clip.loco.crouch);if(clip.item)holdPose(p,holdKind(clip.item));if(clip.strike)strikePose(p,clip.strike,progress);if(clip.surrender)surrenderPose(p,progress*clip.seconds);rig.apply(p);return;}
 // Gestures: the body layer on the standing pose, then the hands reach their targets (gestures.ts, as in the game).
 if(clip.gesture){const p=gait(0,0),g=gesturePose(p,clip.gesture,t);rig.apply(p);applyGesture(rig,group,g);visuals?.gesture(a,g);return;}
 if(clip.m3){applyMotion(rig,model,sampleMotion(clip.m3,role,progress));
  if(role==='giver'&&clip.m3!=='fall')plantedFeet(rig,group,()=>0);
  if(role==='receiver'){if(['drag','drop','pickup'].includes(clip.m3))groundBody(model,0);if(clip.m3==='fall')groundBody(model,0,T.MathUtils.smoothstep(progress,.65,1));}
  return;}
 if(clip.combat){const frame=sampleCombat(clip.combat,cls,progress,a.def.id==='agent',tuning,variant),wp=a.weapons[gun.id]??null;
  if(frame.upperOnly){const speed=clip.combat==='flee'?RUN_SPEED:0;rig.apply(gait(speed,0));}else a.sim=-1;
  if(wp)wp.object.visible=weaponVisible(clip.combat,cls,progress,false);
  const miss=poseCombat(rig,group,model,frame,wp,0,clip.combat==='flee'?0:1);
  if(clip.combat==='hit')plantedFeet(rig,group,()=>0);
  return miss;
 }
}

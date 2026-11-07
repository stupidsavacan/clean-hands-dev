import type {MotionPose} from './motion.ts';
import {MOTION_BONES} from './motion.ts';
// 2026-11-06 (S03 M14/M15, user: the sword cuts looked weak): the sword as a two-handed weapon, both people moving.
// Front (M14), a diagonal cut (kesa-giri): from a middle guard the sword goes up over the right shoulder, the right foot
//  steps in and the blade comes down from upper right to lower left through the target, held low at the end, then back.
// Behind (M15): the left hand closes over the target's mouth, the sword is drawn back at the hip and driven straight
//  through the back, held, and pulled out.
// The one struck: front, thrown back by the cut and folding; behind, arched by the stab, hands to the chest, knees going.
// Both end in motion.ts collapse(), where the fall takes over.
// The sword is placed by the data, not by the wrist: fist (where the right hand holds the grip), blade (the direction the
// blade points) and edge (the way the cutting edge faces), in the striker's ground frame (x left, y up, z forward).
// The left hand goes to the grip's GRIP_L (front) or to the target's head (behind) — katana-pose.ts.
type A=[number,number,number];type V=[number,number,number];
export type SwordKey={t:number;pose:MotionPose;feet:{l:[number,number];r:[number,number]};fist:V;blade:V;edge:V;leftOnTarget:number};
export type ReceiverKey={t:number;pose:MotionPose;feet:{l:[number,number];r:[number,number]}};
const bones=(root:Partial<MotionPose['root']>,b:Record<string,A>):MotionPose=>{const pose:MotionPose={root:{x:0,y:0,z:0,pitch:0,roll:0,...root},bones:{}};for(const n of MOTION_BONES)pose.bones[n]=[0,0,0];
 pose.bones.upperarml=[-.05,0,-1.45];pose.bones.upperarmr=[-.05,0,1.45];pose.bones.forearml=[0,-.24,0];pose.bones.forearmr=[0,.24,0];for(const [n,v] of Object.entries(b))pose.bones[n]=[...v];return pose;};
const ARMS:Record<string,A>={upperarml:[-.9,0,-.9],forearml:[0,-.9,0],upperarmr:[-.9,0,.9],forearmr:[0,.9,0]};
const LEGS_GUARD:Record<string,A>={thighr:[-.35,0,.05],shinr:[.35,0,0],footr:[-.05,0,0],thighl:[.12,0,-.05],shinl:[.30,0,0],footl:[-.25,0,0]};
const LEGS_STEP:Record<string,A>={thighr:[-.65,0,.05],shinr:[.55,0,0],footr:[-.05,0,0],thighl:[.30,0,-.05],shinl:[.30,0,0],footl:[-.35,0,0]};
const GUARD_FEET={l:[.12,-.16] as [number,number],r:[-.12,.20] as [number,number]},STEP_FEET={l:[.12,-.10] as [number,number],r:[-.12,.58] as [number,number]};

// --- front: the diagonal cut
export const FRONT:SwordKey[]=[
 {t:0,pose:bones({y:-.05},{...ARMS,...LEGS_GUARD,spine:[.10,0,0],chest:[.04,0,0]}),feet:GUARD_FEET,fist:[-.02,1.05,.40],blade:[0,.45,1],edge:[0,-1,.45],leftOnTarget:0},
 {t:.30,pose:bones({y:-.04,z:-.02},{...ARMS,...LEGS_GUARD,spine:[.02,0,0],chest:[-.06,-.30,0],neck:[0,.20,0],head:[0,.10,0],upperarmr:[-2.2,0,.6],upperarml:[-2.0,0,-.4]}),feet:GUARD_FEET,fist:[-.20,1.66,.05],blade:[.20,.85,-.45],edge:[.15,.35,1],leftOnTarget:0},
 {t:.48,pose:bones({y:-.12,z:.26,pitch:.06},{...ARMS,...LEGS_STEP,spine:[.22,0,0],chest:[.10,.20,0],neck:[-.10,-.12,0],head:[-.05,-.08,0]}),feet:STEP_FEET,fist:[.0,1.32,.72],blade:[.45,-.10,.90],edge:[.55,-.80,.15],leftOnTarget:0},
 {t:.60,pose:bones({y:-.18,z:.30,pitch:.10},{...ARMS,...LEGS_STEP,spine:[.34,0,0],chest:[.14,.42,0],neck:[-.18,-.30,0],head:[-.10,-.15,0],shinr:[.80,0,0],thighr:[-.80,0,.05]}),feet:STEP_FEET,fist:[.22,.86,.62],blade:[.55,-.55,.62],edge:[.35,-.90,-.25],leftOnTarget:0},
 {t:.82,pose:bones({y:-.18,z:.30,pitch:.10},{...ARMS,...LEGS_STEP,spine:[.30,0,0],chest:[.12,.40,0],neck:[-.15,-.28,0],head:[-.08,-.12,0],shinr:[.80,0,0],thighr:[-.80,0,.05]}),feet:STEP_FEET,fist:[.20,.88,.60],blade:[.55,-.52,.64],edge:[.35,-.90,-.25],leftOnTarget:0},
 {t:1,pose:bones({y:-.06,z:.26},{...ARMS,...LEGS_STEP,spine:[.12,0,0],chest:[.04,0,0],shinr:[.40,0,0],thighr:[-.45,0,.05]}),feet:STEP_FEET,fist:[-.02,1.05,.62],blade:[0,.40,1],edge:[0,-1,.40],leftOnTarget:0},
];
// --- behind: hand over the mouth, the stab, out again
export const BEHIND:SwordKey[]=[
 {t:0,pose:bones({y:-.05},{...ARMS,...LEGS_GUARD,spine:[.10,0,0]}),feet:GUARD_FEET,fist:[-.16,.98,.10],blade:[.02,.12,1],edge:[0,-1,.12],leftOnTarget:0},
 {t:.28,pose:bones({y:-.08,z:.10},{...ARMS,...LEGS_GUARD,spine:[.16,0,0],chest:[0,-.25,0],neck:[0,.20,0],upperarml:[-1.3,0,-.5]}),feet:GUARD_FEET,fist:[-.20,1.00,-.18],blade:[.04,.10,1],edge:[0,-1,.10],leftOnTarget:1},
 {t:.46,pose:bones({y:-.10,z:.16,pitch:.05},{...ARMS,...LEGS_STEP,spine:[.20,0,0],chest:[.05,.30,0],neck:[0,-.20,0],upperarml:[-1.3,0,-.5]}),feet:{l:[.12,-.10],r:[-.12,.40]},fist:[-.06,1.12,.34],blade:[.06,.06,1],edge:[0,-1,.06],leftOnTarget:1},
 {t:.78,pose:bones({y:-.10,z:.16,pitch:.05},{...ARMS,...LEGS_STEP,spine:[.20,0,0],chest:[.05,.30,0],neck:[0,-.20,0],upperarml:[-1.3,0,-.5]}),feet:{l:[.12,-.10],r:[-.12,.40]},fist:[-.05,1.10,.36],blade:[.06,.02,1],edge:[0,-1,.02],leftOnTarget:1},
 {t:1,pose:bones({y:-.05,z:.10},{...ARMS,...LEGS_GUARD,spine:[.10,0,0]}),feet:{l:[.12,-.10],r:[-.12,.40]},fist:[-.18,.98,-.05],blade:[.04,.15,1],edge:[0,-1,.15],leftOnTarget:0},
];
// --- the one struck (own frame: x left, z forward)
const STAND={l:[.1,.03] as [number,number],r:[-.1,.03] as [number,number]};
const COLLAPSE=bones({y:-.26,z:.025,pitch:.10,roll:.04},{pelvis:[-.10,0,.025],spine:[.23,0,0],chest:[.16,0,-.05],neck:[.14,0,0],head:[.12,.06,0],thighl:[-.52,0,-.07],thighr:[-.39,0,.10],shinl:[1.02,0,0],shinr:[.87,0,0],footl:[-.45,0,0],footr:[-.39,0,0],upperarml:[-.65,0,-.85],upperarmr:[-.52,0,.95],forearml:[0,-.90,0],forearmr:[0,.75,0]});
export const FRONT_HIT:ReceiverKey[]=[
 {t:0,pose:bones({},{}),feet:STAND},
 {t:.32,pose:bones({y:-.03,z:-.03},{spine:[-.06,0,0],chest:[-.08,0,0],head:[-.06,0,0],upperarml:[-.9,0,-1.0],forearml:[0,-1.8,0],upperarmr:[-.9,0,1.0],forearmr:[0,1.8,0]}),feet:STAND},
 {t:.50,pose:bones({y:-.04,z:-.04},{spine:[-.06,0,0],chest:[-.10,0,0],head:[-.10,0,0],upperarml:[-1.1,0,-.9],forearml:[0,-1.9,0],upperarmr:[-1.1,0,.9],forearmr:[0,1.9,0]}),feet:STAND},
 {t:.62,pose:bones({y:-.08,z:-.20,pitch:-.18,roll:.10},{spine:[-.20,0,.12],chest:[-.25,.20,.10],neck:[-.25,0,0],head:[-.30,.15,.10],upperarml:[-.40,0,-.55],forearml:[0,-.5,0],upperarmr:[-.6,0,1.1],forearmr:[0,1.4,0],thighl:[.30,0,0],shinl:[.30,0,0],thighr:[-.10,0,0],shinr:[.25,0,0]}),feet:{l:[.12,-.30],r:[-.10,.0]}},
 {t:.82,pose:bones({y:-.18,z:-.15,pitch:.05,roll:.06},{spine:[.25,0,.05],chest:[.20,.10,0],neck:[.10,0,0],head:[.05,.10,0],upperarml:[-.55,0,-1.2],forearml:[0,-1.6,0],upperarmr:[-.55,0,1.2],forearmr:[0,1.6,0],thighl:[-.30,0,0],shinl:[.70,0,0],thighr:[-.40,0,0],shinr:[.75,0,0]}),feet:{l:[.12,-.30],r:[-.10,.0]}},
 {t:1,pose:COLLAPSE,feet:{l:[.12,-.30],r:[-.10,.0]}},
];
export const BEHIND_HIT:ReceiverKey[]=[
 {t:0,pose:bones({},{}),feet:STAND},
 {t:.30,pose:bones({y:-.02},{neck:[-.15,0,0],head:[-.15,0,0],upperarml:[-.5,0,-1.2],forearml:[0,-1.2,0],upperarmr:[-.5,0,1.2],forearmr:[0,1.2,0]}),feet:STAND},
 {t:.50,pose:bones({y:-.03,z:.04,pitch:-.10},{spine:[-.25,0,0],chest:[-.20,0,0],neck:[-.30,0,0],head:[-.30,0,0],upperarml:[-.7,0,-1.0],forearml:[0,-1.9,0],upperarmr:[-.7,0,1.0],forearmr:[0,1.9,0]}),feet:STAND},
 {t:.78,pose:bones({y:-.14,z:.02,pitch:.05},{spine:[.15,0,0],chest:[.10,0,0],neck:[.10,0,0],head:[.15,0,0],upperarml:[-.6,0,-1.2],forearml:[0,-1.8,0],upperarmr:[-.6,0,1.2],forearmr:[0,1.8,0],thighl:[-.35,0,0],shinl:[.70,0,0],thighr:[-.35,0,0],shinr:[.70,0,0]}),feet:STAND},
 {t:1,pose:COLLAPSE,feet:STAND},
];
/** Where the striker stands from the one struck (pelvis to pelvis) before stepping in. */
export const KATANA_GAP={front:1.15,behind:.55};
const ease=(u:number)=>u*u*(3-2*u);
const lerp=(a:number,b:number,k:number)=>a+(b-a)*k,lv=(a:V,b:V,k:number):V=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];
function mixPose(a:MotionPose,b:MotionPose,k:number):MotionPose{const out:MotionPose={root:{x:0,y:0,z:0,pitch:0,roll:0},bones:{}};for(const key of Object.keys(out.root) as (keyof MotionPose['root'])[])out.root[key]=lerp(a.root[key],b.root[key],k);
 for(const n of MOTION_BONES)out.bones[n]=a.bones[n].map((v,i)=>lerp(v,b.bones[n][i],k)) as A;return out;}
function bracket<K extends {t:number}>(keys:K[],t:number):[K,K,number]{const u=Math.max(0,Math.min(1,t));for(let i=1;i<keys.length;i++)if(u<=keys[i].t)return [keys[i-1],keys[i],ease((u-keys[i-1].t)/(keys[i].t-keys[i-1].t||1))];const k=keys[keys.length-1];return [k,k,0];}
/** The striker at progress t (0..1). */
export function katanaGiver(behind:boolean,t:number){const [a,b,k]=bracket(behind?BEHIND:FRONT,t);
 return {pose:mixPose(a.pose,b.pose,k),feet:{l:[lerp(a.feet.l[0],b.feet.l[0],k),lerp(a.feet.l[1],b.feet.l[1],k)] as [number,number],r:[lerp(a.feet.r[0],b.feet.r[0],k),lerp(a.feet.r[1],b.feet.r[1],k)] as [number,number]},
  fist:lv(a.fist,b.fist,k),blade:lv(a.blade,b.blade,k),edge:lv(a.edge,b.edge,k),leftOnTarget:lerp(a.leftOnTarget,b.leftOnTarget,k)};}
/** The one struck at progress t (0..1). */
export function katanaReceiver(behind:boolean,t:number){const [a,b,k]=bracket(behind?BEHIND_HIT:FRONT_HIT,t);
 return {pose:mixPose(a.pose,b.pose,k),feet:{l:[lerp(a.feet.l[0],b.feet.l[0],k),lerp(a.feet.l[1],b.feet.l[1],k)] as [number,number],r:[lerp(a.feet.r[0],b.feet.r[0],k),lerp(a.feet.r[1],b.feet.r[1],k)] as [number,number]}};}
/** The blade lands (the target reacts from here). */
export const KATANA_IMPACT={front:.50,behind:.46};

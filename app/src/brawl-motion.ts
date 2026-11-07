import type {MotionPose,MotionRole} from './motion.ts';
import {MOTION_BONES} from './motion.ts';
// 2026-11-06 (S03 M02, user request): the unarmed fight with a guard as three real blows, both people moving.
//  1 right straight to the face, the agent stepping in with the right foot (the rear foot comes through);
//  2 left hook to the body, dropping the weight onto the bent front knee;
//  3 right hook to the face, hips and shoulders turning through, the rear heel up — the finisher.
// The guard: 1 the head snaps back and he staggers a step back; 2 he folds over the stomach, hands to it;
// 3 the head whips to his right and the knees go: he ends in collapse(), where the fall (motion.ts fall) begins.
// Axes are the character's (rig.ts rotate): +X is the character's left; x on arms/legs is flexion (negative =
// forward), y turns about the vertical (positive = toward the character's left), z rolls about the forward axis.
// Feet: where each foot stands, in the character's ground frame (x left, z forward), metres; the view plants them
// there by IK (motion-runtime plantFeetAt), so a step really moves the foot.
type A=[number,number,number];
// Hands: where each fist should be (same ground frame, y up from the floor, metres) and how fully (w 0..1); the view
// reaches them by arm IK after the angles, so a straight really lands on the face. Undefined: the angles alone.
export type Hand=[number,number,number,number];
// Aim: how fully each fist goes to the other person's real body (the view reaches it there by IK, motion-runtime
// aimFists): the right fist at the face (head), the left at the stomach (spine). Heights differ between people, so the
// blows are aimed at the bones, not at fixed numbers.
export type BrawlPose={pose:MotionPose;feet:{l:[number,number];r:[number,number]};hands:{l:Hand;r:Hand};aim:{l:number;r:number}};
const NO:Hand=[0,0,0,0];
const P=(root:Partial<MotionPose['root']>,bones:Record<string,A>,l:[number,number],r:[number,number],hl:Hand=NO,hr:Hand=NO):BrawlPose=>{
 const pose:MotionPose={root:{x:0,y:0,z:0,pitch:0,roll:0,...root},bones:{}};for(const n of MOTION_BONES)pose.bones[n]=[0,0,0];
 pose.bones.upperarml=[-.05,0,-1.45];pose.bones.upperarmr=[-.05,0,1.45];pose.bones.forearml=[0,-.24,0];pose.bones.forearmr=[0,.24,0];
 for(const [n,v] of Object.entries(bones))pose.bones[n]=[...v];return {pose,feet:{l,r},hands:{l:hl,r:hr},aim:{l:0,r:0}};};
const aimed=(b:BrawlPose,l:number,r:number):BrawlPose=>({...b,aim:{l,r}});
// A hand going from 'not set' to set keeps its target and only fades in.
const mixHand=(a:Hand,b:Hand,k:number):Hand=>{const from=a[3]?a:[b[0],b[1],b[2],0] as Hand,to=b[3]?b:[a[0],a[1],a[2],0] as Hand;return from.map((v,i)=>v+(to[i]-v)*k) as Hand;};
const mix=(a:BrawlPose,b:BrawlPose,t:number):BrawlPose=>{t=Math.max(0,Math.min(1,t));const k=t*t*(3-2*t),lerp=(x:number,y:number)=>x+(y-x)*k;
 const pose:MotionPose={root:{x:0,y:0,z:0,pitch:0,roll:0},bones:{}};for(const key of Object.keys(pose.root) as (keyof MotionPose['root'])[])pose.root[key]=lerp(a.pose.root[key],b.pose.root[key]);
 for(const n of MOTION_BONES)pose.bones[n]=a.pose.bones[n].map((v,i)=>lerp(v,b.pose.bones[n][i])) as A;
 return {pose,feet:{l:[lerp(a.feet.l[0],b.feet.l[0]),lerp(a.feet.l[1],b.feet.l[1])],r:[lerp(a.feet.r[0],b.feet.r[0]),lerp(a.feet.r[1],b.feet.r[1])]},hands:{l:mixHand(a.hands.l,b.hands.l,k),r:mixHand(a.hands.r,b.hands.r,k)},aim:{l:lerp(a.aim.l,b.aim.l),r:lerp(a.aim.r,b.aim.r)}};};
const span=(s:number,a:number,b:number)=>(s-a)/(b-a);
const FEET:[[number,number],[number,number]]=[[.1,.03],[-.1,.03]];

// --- the agent
const G_IDLE=P({},{},...FEET);
// Orthodox guard: left side forward, hands at the chin, knees soft, weight centred.
const G_STANCE=P({y:-.06},{pelvis:[0,-.30,0],spine:[.10,0,0],chest:[.06,.10,0],neck:[-.06,.15,0],head:[-.06,.05,0],
 thighl:[-.30,0,-.05],shinl:[.45,0,0],footl:[-.15,0,0],thighr:[.10,0,.06],shinr:[.40,0,0],footr:[-.25,0,0],
 upperarml:[-.75,0,-1.15],forearml:[0,-2.0,0],upperarmr:[-.55,0,1.2],forearmr:[0,2.15,0]},[.14,.16],[-.12,-.20],[.11,1.42,.30,1],[-.12,1.40,.20,1]);
// 1: right straight, the right foot stepping through to the front.
const G_STRAIGHT=P({y:-.08,z:.24,pitch:.06},{pelvis:[0,.25,0],spine:[.14,0,0],chest:[.06,.35,0],neck:[-.08,-.30,0],head:[-.05,-.25,0],
 thighr:[-.45,0,.04],shinr:[.35,0,0],footr:[-.05,0,0],thighl:[.25,0,-.05],shinl:[.30,0,0],footl:[-.30,0,0],
 upperarmr:[-1.45,0,.35],forearmr:[0,.15,0],upperarml:[-.80,0,-1.10],forearml:[0,-2.0,0]},[.14,.16],[-.10,.48],[.11,1.40,.44,1],[-.02,1.55,.84,1]);
// Guard again with the right foot now in front.
const G_GUARD2=P({y:-.08,z:.22,pitch:.04},{pelvis:[0,.15,0],spine:[.12,0,0],chest:[.05,.05,0],neck:[-.06,-.12,0],head:[-.05,-.08,0],
 thighr:[-.35,0,.04],shinr:[.45,0,0],footr:[-.15,0,0],thighl:[.18,0,-.05],shinl:[.40,0,0],footl:[-.25,0,0],
 upperarml:[-.75,0,-1.15],forearml:[0,-2.0,0],upperarmr:[-.6,0,1.15],forearmr:[0,2.1,0]},[.14,.16],[-.10,.48],[.11,1.40,.44,1],[-.11,1.40,.40,1]);
// 2: left hook to the body: dip onto the front knee, the left elbow bent square, the right hand stays home.
const G_BODY=P({y:-.10,z:.30,pitch:.10},{pelvis:[0,-.25,0],spine:[.25,0,0],chest:[.10,-.40,-.05],neck:[-.15,.35,0],head:[-.10,.30,0],
 thighr:[-.50,0,.04],shinr:[.60,0,0],footr:[-.15,0,0],thighl:[.12,0,-.06],shinl:[.50,0,0],footl:[-.40,0,0],
 upperarml:[-1.05,0,-.55],forearml:[0,-1.5,0],upperarmr:[-.6,0,1.15],forearmr:[0,2.1,0]},[.14,.16],[-.10,.48],[.04,1.08,.76,1],[-.11,1.32,.42,1]);
// 3: right hook to the face: the elbow up level with the fist, everything turning through, rear heel up.
const G_HOOK=P({y:-.08,z:.32,pitch:.05},{pelvis:[0,.40,0],spine:[.12,0,0],chest:[.04,.45,.05],neck:[-.05,-.45,0],head:[-.05,-.35,0],
 thighr:[-.45,0,.04],shinr:[.40,0,0],footr:[-.10,0,0],thighl:[.20,0,-.05],shinl:[.45,0,0],footl:[-.40,0,0],
 upperarmr:[-.90,0,.25],forearmr:[0,1.6,0],upperarml:[-.80,0,-1.10],forearml:[0,-2.0,0]},[.14,.16],[-.10,.48],[.11,1.40,.46,1],[.03,1.56,.82,1]);
const G_DONE=P({y:-.04,z:.22},{pelvis:[0,.10,0],spine:[.06,0,0],thighr:[-.25,0,.04],shinr:[.25,0,0],thighl:[.12,0,-.05],shinl:[.20,0,0],footl:[-.10,0,0],
 upperarml:[-.30,0,-1.30],forearml:[0,-.8,0],upperarmr:[-.30,0,1.30],forearmr:[0,.8,0]},[.14,.16],[-.10,.48]);

// --- the guard
const R_IDLE=P({},{},...FEET);
const R_UP=P({y:-.03},{spine:[-.04,0,0],chest:[-.06,0,0],head:[-.04,0,0],upperarml:[-.6,0,-1.1],forearml:[0,-1.6,0],upperarmr:[-.6,0,1.1],forearmr:[0,1.6,0],
 thighl:[-.10,0,0],shinl:[.18,0,0],thighr:[-.10,0,0],shinr:[.18,0,0]},...FEET,[.17,1.32,.16,1],[-.17,1.30,.16,1]);
// 1: snapped back from the straight, a stagger step back on the left foot, arms thrown out.
const R_FACE=P({y:-.02,z:-.14,pitch:-.12},{spine:[-.12,0,0],chest:[-.18,0,0],neck:[-.30,0,0],head:[-.40,.12,0],
 upperarml:[-.30,0,-.80],forearml:[0,-.8,0],upperarmr:[-.25,0,.75],forearmr:[0,.7,0],thighl:[.25,0,0],shinl:[.25,0,0],thighr:[-.15,0,0],shinr:[.20,0,0]},[.12,-.25],[-.10,.03],[.42,1.18,-.10,.8],[-.40,1.12,-.08,.8]);
const R_DAZED=P({y:-.05,z:-.08,pitch:-.03},{spine:[.04,0,0],chest:[-.04,0,0],neck:[-.08,0,0],head:[-.10,.06,.05],
 upperarml:[-.45,0,-1.15],forearml:[0,-1.3,0],upperarmr:[-.40,0,1.15],forearmr:[0,1.2,0],thighl:[.15,0,0],shinl:[.25,0,0],thighr:[-.15,0,0],shinr:[.25,0,0]},[.12,-.25],[-.10,.03],[.15,1.10,.12,1],[-.15,1.08,.12,1]);
// 2: folded over the stomach, both hands to it, knees bent.
const R_BODY=P({y:-.16,z:-.22,pitch:.18},{spine:[.45,0,0],chest:[.35,0,0],neck:[.15,0,0],head:[.05,0,0],
 thighl:[-.20,0,0],shinl:[.75,0,0],footl:[-.30,0,0],thighr:[-.45,0,0],shinr:[.85,0,0],footr:[-.35,0,0],
 upperarml:[-.55,0,-1.25],forearml:[0,-1.7,0],upperarmr:[-.55,0,1.25],forearmr:[0,1.7,0]},[.12,-.32],[-.10,-.12],[.07,.90,-.02,1],[-.07,.90,-.02,1]);
// 3: the hook lands on his left cheek: the head whips to his right, the knees give.
const R_HOOK=P({y:-.20,z:-.20,pitch:.05,roll:-.12},{spine:[.20,0,-.10],chest:[.10,-.35,-.15],neck:[-.10,-.35,.10],head:[-.15,-.55,.20],
 upperarml:[-.30,0,-.70],forearml:[0,-.5,0],upperarmr:[-.20,0,1.20],forearmr:[0,.4,0],thighl:[-.40,0,0],shinl:[.80,0,0],thighr:[-.40,0,0],shinr:[.80,0,0]},[.12,-.32],[-.10,-.12]);
// = motion.ts collapse(), where the fall takes over.
const R_COLLAPSE=P({y:-.26,z:.025,pitch:.10,roll:.04},{pelvis:[-.10,0,.025],spine:[.23,0,0],chest:[.16,0,-.05],neck:[.14,0,0],head:[.12,.06,0],thighl:[-.52,0,-.07],thighr:[-.39,0,.10],shinl:[1.02,0,0],shinr:[.87,0,0],footl:[-.45,0,0],footr:[-.39,0,0],upperarml:[-.65,0,-.85],upperarmr:[-.52,0,.95],forearml:[0,-.90,0],forearmr:[0,.75,0]},[.12,-.32],[-.10,-.12]);

/** The blow lands this long after the key press. */
export const BRAWL_IMPACT=.12;
/** After the third blow the guard is let go (unconscious, falling) this long after the press. */
export const BRAWL_FINISH=.6;
/** Where the agent stands from the guard (pelvis to pelvis) before stepping in. */
export const BRAWL_GAP=.95;
const G_BLOW=[aimed(G_STRAIGHT,0,1),aimed(G_BODY,1,0),aimed(G_HOOK,0,1)],G_AFTER=[G_GUARD2,G_GUARD2,G_DONE],G_BEFORE=[G_STANCE,G_GUARD2,G_GUARD2];
const R_HIT=[R_FACE,R_BODY,R_HOOK],R_AFTER=[R_DAZED,R_BODY,R_COLLAPSE],R_BEFORE=[R_UP,R_DAZED,R_BODY];
/** blows: how many have landed (0..3); since: seconds since the last key press (since the fight began for 0).
 * single: the one-punch knock-out (M01): the hook straight from the guard stance, no earlier blows to come from. */
export function brawlMotion(role:MotionRole,blows:number,since:number,single=false):BrawlPose{const s=Math.max(0,since);
 if(role==='giver'){if(blows<=0)return mix(G_IDLE,G_STANCE,span(s,0,.25));const k=Math.min(3,blows)-1;
  // A fast load (the previous guard), the blow at impact, held a beat, then back to guard.
  const before=single?G_STANCE:G_BEFORE[k];
  if(s<BRAWL_IMPACT)return mix(before,G_BLOW[k],span(s,0,BRAWL_IMPACT));if(s<BRAWL_IMPACT+.10)return G_BLOW[k];
  return mix(G_BLOW[k],G_AFTER[k],span(s,BRAWL_IMPACT+.10,k===2?BRAWL_FINISH:.5));}
 if(blows<=0)return mix(R_IDLE,R_UP,span(s,0,.3));const k=Math.min(3,blows)-1;
 // Nothing until the fist arrives, then the hit, then he sags into the after pose and waits.
 const before=single?R_UP:R_BEFORE[k];
 if(s<BRAWL_IMPACT-.02)return before;if(s<BRAWL_IMPACT+.08)return mix(before,R_HIT[k],span(s,BRAWL_IMPACT-.02,BRAWL_IMPACT+.08));
 return mix(R_HIT[k],R_AFTER[k],span(s,BRAWL_IMPACT+.12,k===2?BRAWL_FINISH:.65));}
/** The same fight on a fixed timeline (labs, previews): key presses at these seconds. */
export function brawlAt(role:MotionRole,t:number,presses:number[]=[.5,1.2,1.9]){let blows=0,last=0;for(const p of presses)if(t>=p){blows++;last=p;}return brawlMotion(role,blows,t-last);}

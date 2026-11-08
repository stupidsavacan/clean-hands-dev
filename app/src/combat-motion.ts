import type { MotionPose } from './motion';
import type { PistolTuning } from './pistol-tuning.ts';
/** M5.5 gunplay motions on the shared 22-bone rig (character rest axes, XYZ radians; +X is the character's left,
 * +Y up, +Z forward). Each frame carries a body pose and where the weapon is, in the actor's own space; the runtime
 * places the weapon there and brings the hands onto it with IK, so the grip holds for every body preset.
 * Upper-only frames (aim, fire, reload, flee) are layered over the walk/run from Locomotion; the rest are full-body.
 * Weapon classes: 'pistol' (pistol_guard, pistol_silenced) and 'long' (smg, rifle_npc, placed by their STOCK anchor).
 */
export type WeaponClass='pistol'|'long';
export type CombatKind='draw'|'holster'|'aim'|'fire'|'reload'|'hit'|'cover'|'coverAim'|'flee'|'duck';
type Angles=[number,number,number];
type Bones=Record<string,Angles>;
/** Weapon placement: the named anchor sits at pos; rot is the weapon's XYZ euler (x + tips the muzzle down, y + turns it to the left). */
export type Hold={anchor:'GRIP_R'|'STOCK';pos:Angles;rot:Angles};
/** Hand goals. GRIP_R/GRIP_L/MAG/SLIDE are points on the weapon; POUCH is the magazine pouch on the left hip. */
export type HandGoal='GRIP_R'|'GRIP_L'|'MAG'|'SLIDE'|'POUCH';
/** stand (0-1): how much of the pose's own hips and legs to use over the walk/stand underneath (upper-only frames;
 * the agent's one-handed pistol when standing still). */
export type CombatFrame={pose:MotionPose;upperOnly:boolean;stand?:number;weapon:Hold|null;right:{to:HandGoal;weight:number};left:{to:HandGoal;weight:number}};
export const COMBAT_SECONDS:Record<CombatKind,number>={draw:.7,holster:.7,aim:3,fire:.25,reload:1.8,hit:.6,cover:3,coverAim:.5,flee:.8,duck:1.2};
/** Kinds that are loops (sampled with t wrapping) rather than one-shots. */
export const COMBAT_LOOPS:CombatKind[]=['aim','cover','flee'];
export const POUCH:Angles=[.17,.97,.06];
/** Hips and legs a standing stance may set (CombatFrame.stand). */
export const LOWER=['pelvis','spine','thighl','thighr','shinl','shinr','footl','footr'];
export const UPPER=['chest','neck','head','claviclel','clavicler','upperarml','upperarmr','forearml','forearmr','handl','handr','thumbl','thumbr'];
const CHANNELS=['root','pelvis','spine','chest','neck','head','claviclel','clavicler','upperarml','upperarmr','forearml','forearmr','handl','handr','thighl','thighr','shinl','shinr','footl','footr','thumbl','thumbr'];
const clamp=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const smooth=(t:number)=>t*t*(3-2*t);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const mix3=(a:Angles,b:Angles,t:number):Angles=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];

type Key={t:number;stand?:number;root?:Partial<MotionPose['root']>;bones?:Bones;hold?:Hold|null;r?:[HandGoal,number];l?:[HandGoal,number]};
function neutral():MotionPose{const bones:Bones={};for(const n of CHANNELS)bones[n]=[0,0,0];bones.upperarml=[-.05,0,-1.45];bones.upperarmr=[-.05,0,1.45];bones.forearml=[0,-.24,0];bones.forearmr=[0,.24,0];return {root:{x:0,y:0,z:0,pitch:0,roll:0},bones};}
function poseOf(k:Key):MotionPose{const p=neutral();Object.assign(p.root,k.root??{});for(const [n,v] of Object.entries(k.bones??{}))p.bones[n]=[...v];return p;}
function sample(keys:Key[],t:number,upperOnly:boolean):CombatFrame{
 let a=keys[0],b=keys[0];for(let i=1;i<keys.length;i++){a=keys[i-1];b=keys[i];if(t<=b.t)break;}
 const u=t<=a.t?0:t>=b.t?1:smooth(clamp((t-a.t)/(b.t-a.t))),pa=poseOf(a),pb=poseOf(b),pose=neutral();
 for(const k of Object.keys(pose.root) as (keyof MotionPose['root'])[])pose.root[k]=mix(pa.root[k],pb.root[k],u);
 for(const n of CHANNELS)pose.bones[n]=mix3(pa.bones[n],pb.bones[n],u);
 const ha=a.hold??null,hb=b.hold??null;
 // A weapon only ever blends between two holds on the same anchor; otherwise it switches at the key.
 const weapon=ha&&hb&&ha.anchor===hb.anchor?{anchor:ha.anchor,pos:mix3(ha.pos,hb.pos,u),rot:mix3(ha.rot,hb.rot,u)}:(u<.5?ha:hb);
 const hand=(x?:[HandGoal,number],y?:[HandGoal,number])=>{const p=x??['GRIP_R',0],q=y??['GRIP_R',0];
  // Changing goal: the weight dips through zero so the hand never slides along the weapon between two points.
  if(p[0]===q[0])return {to:p[0],weight:mix(p[1],q[1],u)};return u<.5?{to:p[0],weight:p[1]*(1-2*u)}:{to:q[0],weight:q[1]*(2*u-1)};};
 const stand=(k:Key)=>k.stand??(k.bones?.pelvis?1:0),st=mix(stand(a),stand(b),u);
 return {pose,upperOnly,...(st>0?{stand:st}:{}),weapon,right:hand(a.r??['GRIP_R',0],b.r??['GRIP_R',0]),left:hand(a.l??['GRIP_L',0],b.l??['GRIP_L',0])};
}

// ---------- holds ----------
const HOLD={
 pistol:{
  holster:{anchor:'GRIP_R',pos:[-.215,.985,-.03],rot:[Math.PI/2,0,0]} as Hold,
  lift:{anchor:'GRIP_R',pos:[-.19,1.16,.16],rot:[.55,.15,0]} as Hold,
  aim:{anchor:'GRIP_R',pos:[-.035,1.38,.43],rot:[0,.04,0]} as Hold,
  recoil:{anchor:'GRIP_R',pos:[-.035,1.40,.40],rot:[-.38,.04,0]} as Hold,
  reload:{anchor:'GRIP_R',pos:[-.05,1.24,.33],rot:[-.25,.35,-.35]} as Hold,
  ready:{anchor:'GRIP_R',pos:[-.06,1.06,.34],rot:[.75,.1,0]} as Hold,
 },
 long:{
  low:{anchor:'STOCK',pos:[-.09,1.31,.05],rot:[.55,.28,0]} as Hold,
  aim:{anchor:'STOCK',pos:[-.12,1.41,.07],rot:[0,0,0]} as Hold,
  recoil:{anchor:'STOCK',pos:[-.12,1.43,.045],rot:[-.10,0,0]} as Hold,
  reload:{anchor:'STOCK',pos:[-.15,1.22,.02],rot:[-.12,.30,-.55]} as Hold,
 },
};
// ---------- upper bodies (layered over the legs) ----------
// Arms are only roughly placed (elbows down and out); IK brings the hands onto the weapon.
const PISTOL_AIM:Bones={chest:[.02,-.08,0],neck:[.06,.05,0],head:[.10,.04,0],clavicler:[0,.12,0],claviclel:[0,-.08,0],upperarmr:[-1.30,0,.55],upperarml:[-1.25,0,-.30],forearmr:[0,.25,0],forearml:[0,-.85,0]};
const AGENT_PISTOL_LEGS:Bones={pelvis:[0,.60,0],spine:[0,0,0],thighl:[-.06,0,.10],thighr:[-.10,0,-.10],shinl:[.12,0,0],shinr:[.16,0,0],footl:[-.06,0,-.10],footr:[-.06,0,.10]};
// Agent 07's one-handed aim (HD15, the user's second reference photo, shaped by the user in the pose editor, 2026-11-08): the chest opens well away from the
// target with the right shoulder toward it, the arm is straight out at shoulder height, the head turns to look along
// it, and the free arm hangs relaxed.
const AGENT_PISTOL_AIM:Bones={chest:[0,1.117,0],neck:[0,-.559,0],head:[.04,-.48,0],clavicler:[0,.05,0],upperarmr:[-1.55,0,.05],forearmr:[0,.02,0],upperarml:[.02,0,-1.361],forearml:[0,-.15,0],
 // Standing still, the hips and feet turn with the chest (the right foot comes forward); poseCombat keeps the chest's
 // turn in the world the same, so the upper body above is as the user shaped it.
 ...AGENT_PISTOL_LEGS};
const AGENT_PISTOL_HOLD:Hold={anchor:'GRIP_R',pos:[-.141,1.563,.742],rot:[0,0,0]};
const shiftHold=(h:Hold,dy:number,dz:number,rx:number):Hold=>({...h,pos:[h.pos[0],h.pos[1]+dy,h.pos[2]+dz],rot:[h.rot[0]+rx,h.rot[1],h.rot[2]]});
const LONG_AIM:Bones={chest:[.04,-.48,0],neck:[.10,.25,0],head:[.12,.22,.06],clavicler:[0,.15,-.10],claviclel:[0,-.15,0],upperarmr:[-.30,0,.55],upperarml:[-.95,0,-1.05],forearmr:[0,1.75,0],forearml:[0,-.95,0]};
const SUPPORT_GRIP:NonNullable<Key['l']>=['GRIP_L',1];
/** reloadTurn: how much of the aim's chest turn stays while reloading (default .7). */
type AimStance={bones:Bones;hold:Hold;recoil:Hold;reload:Hold;l?:Key['l'];reloadTurn?:number};
const PISTOL_STANCE:AimStance={bones:PISTOL_AIM,hold:HOLD.pistol.aim,recoil:HOLD.pistol.recoil,reload:HOLD.pistol.reload,l:SUPPORT_GRIP};
const AIM_STANCE:Record<WeaponClass|'agentPistol',AimStance>={
 pistol:PISTOL_STANCE,
 agentPistol:{...PISTOL_STANCE,bones:AGENT_PISTOL_AIM,hold:AGENT_PISTOL_HOLD,recoil:shiftHold(AGENT_PISTOL_HOLD,.02,-.03,-.38),l:undefined,reloadTurn:.25},
 long:{bones:LONG_AIM,hold:HOLD.long.aim,recoil:HOLD.long.recoil,reload:HOLD.long.reload,l:SUPPORT_GRIP},
};
/** Candidates for Agent 07's one-handed pistol (HD15, 2026-11-08), compared in the animation lab. F is the game's
 * stance; A is the earlier one (the two-handed gun position, the right shoulder pulled back). */
export type PistolVariant={label:string;note:string;bones?:Bones;hold?:Hold};
/** The game's stance as data (the pose editor in the animation lab starts from it). */
export const AGENT_PISTOL_STANCE={bones:AGENT_PISTOL_AIM,hold:AGENT_PISTOL_HOLD} as const;
export const AGENT_PISTOL_VARIANTS:Record<string,PistolVariant>={
 F:{label:'F 写真2の撃ち方（ゲーム中）',note:'体を大きく開いて右肩を相手に向け、腕を肩の高さで一直線に伸ばす'},
 E:{label:'E 写真1の撃ち方',note:'右肩を相手に向けて半身・腕を一直線に伸ばし目の高さで狙う',
  bones:{chest:[.02,.60,0],neck:[.02,-.30,0],head:[.12,-.28,0],clavicler:[0,.08,0],upperarmr:[-1.50,0,.10],forearmr:[0,.05,0],upperarml:[.10,0,-1.40],forearml:[0,-.25,0]},
  hold:{anchor:'GRIP_R',pos:[-.13,1.44,.71],rot:[0,0,0]}},
 A:{label:'A 前の構え',note:'両手持ちと同じ位置（顔の前）・右肩を引く',
  bones:{chest:[.02,-.58,0],neck:[.06,.31,0],head:[.10,.30,0],clavicler:[0,-.16,0],upperarmr:[-1.24,0,.62],forearmr:[0,.38,0]},
  hold:HOLD.pistol.aim},
 B:{label:'B 腕をまっすぐ',note:'右肩の線で腕を伸ばす・左腕は軽く曲げる',
  bones:{chest:[.02,-.22,0],neck:[.04,.12,0],head:[.06,.10,0],clavicler:[0,-.05,0],upperarmr:[-1.45,0,.20],forearmr:[0,.10,0],upperarml:[.04,0,-1.36],forearml:[0,-.38,0]},
  hold:{anchor:'GRIP_R',pos:[-.17,1.40,.46],rot:[0,.05,0]}},
 C:{label:'C 半身（右肩を引く）',note:'体を大きく開き目の高さで狙う・左腕は後ろに引く',
  bones:{chest:[0,-.80,0],neck:[.04,.40,0],head:[.06,.38,0],clavicler:[0,-.10,0],upperarmr:[-1.45,0,.25],forearmr:[0,.10,0],upperarml:[.28,0,-1.38],forearml:[0,-.30,0]},
  hold:{anchor:'GRIP_R',pos:[-.09,1.45,.37],rot:[0,0,0]}},
 D:{label:'D 肘をゆるめる',note:'少し低く肘に余裕・左手はみぞおち',
  bones:{chest:[.03,-.35,0],neck:[.05,.18,0],head:[.12,.16,0],clavicler:[0,-.08,0],upperarmr:[-1.20,0,.45],forearmr:[0,.45,0],upperarml:[-.12,0,-1.38],forearml:[0,-1.30,0]},
  hold:{anchor:'GRIP_R',pos:[-.12,1.30,.40],rot:[-.02,.06,0]}},
};
function variantStance(id?:string|PistolVariant):AimStance{
 const base=AIM_STANCE.agentPistol,v=typeof id==='string'?AGENT_PISTOL_VARIANTS[id]:id;
 if(!v?.hold)return base;
 // The pose editor's stance (an object) keeps the standing legs; the lab's older candidates (by id) have none.
 return {...base,bones:{...(typeof id==='string'?{}:AGENT_PISTOL_LEGS),...v.bones},hold:v.hold,recoil:shiftHold(v.hold,.02,-.03,-.38)};
}
function tunedPistolStance(tuning?:PistolTuning,variant?:string|PistolVariant):AimStance{
 const stance=variantStance(variant);
 if(!tuning||!Object.values(tuning).some(value=>value!==0))return stance;
 const {torso,shoulder,elbow,freeArm}=tuning,radians=Math.PI/180;
 const [cx,cy,cz]=stance.bones.chest,[nx,ny,nz]=stance.bones.neck,[hx,hy,hz]=stance.bones.head;
 const [sx,sy,sz]=stance.bones.clavicler,[ax,ay,az]=stance.bones.upperarmr,[lx,ly,lz]=stance.bones.upperarml??[-.05,0,-1.45];
 return {...stance,bones:{
  ...stance.bones,
  chest:[cx,cy-torso*radians,cz],
  neck:[nx,ny+torso*radians/2,nz],
  head:[hx,hy+torso*radians/2,hz],
  clavicler:[sx,sy-shoulder*radians,sz],
  upperarmr:[ax,ay,az-elbow*radians],
  upperarml:[lx-freeArm*radians,ly,lz],
 }};
}
const HANG:Bones={};
const REACH_HIP:Bones={chest:[.03,.06,0],upperarmr:[.20,0,1.20],forearmr:[0,1.0,0]};
const LONG_LOW:Bones={chest:[.03,-.30,0],neck:[.02,.14,0],head:[.04,.12,0],upperarmr:[-.10,0,1.0],upperarml:[-.85,0,-1.0],forearmr:[0,1.55,0],forearml:[0,-1.20,0]};

function draw(cls:WeaponClass,t:number,stance:AimStance):CombatFrame{
 if(cls==='pistol'){const h=HOLD.pistol;return sample([
  {t:0,bones:HANG,hold:h.holster,r:['GRIP_R',0]},
  {t:.30,bones:REACH_HIP,hold:h.holster,r:['GRIP_R',1]},
  {t:.55,bones:{...stance.bones,upperarmr:[-.55,0,.95],forearmr:[0,1.0,0],...(stance.l?{upperarml:[-.40,0,-1.1] as Angles}:{})},hold:h.lift,r:['GRIP_R',1]},
  {t:.82,bones:stance.bones,hold:stance.hold,r:['GRIP_R',1],l:stance.l},
  {t:1,bones:stance.bones,hold:stance.hold,r:['GRIP_R',1],l:stance.l}],t,true);}
 const h=HOLD.long;return sample([
  {t:0,bones:LONG_LOW,hold:h.low,r:['GRIP_R',1],l:['GRIP_L',1]},
  {t:.75,bones:LONG_AIM,hold:h.aim,r:['GRIP_R',1],l:['GRIP_L',1]},
  {t:1,bones:LONG_AIM,hold:h.aim,r:['GRIP_R',1],l:['GRIP_L',1]}],t,true);
}
function aimLoop(cls:WeaponClass,t:number,stance:AimStance):CombatFrame{
 // Breathing: the sights drift a few millimetres on a 3 s cycle; loops exactly at t = 0/1.
 const f=draw(cls,1,stance),w=Math.sin(t*Math.PI*2),v=Math.sin(t*Math.PI*4)*.5;
 if(f.weapon){f.weapon={...f.weapon,pos:[f.weapon.pos[0]+.004*v,f.weapon.pos[1]+.006*w,f.weapon.pos[2]],rot:[f.weapon.rot[0]-.012*w,f.weapon.rot[1]+.008*v,f.weapon.rot[2]]};}
 f.pose.bones.chest=[f.pose.bones.chest[0]+.012*w,f.pose.bones.chest[1],f.pose.bones.chest[2]];return f;
}
function fire(t:number,stance:AimStance):CombatFrame{
 const {bones:aim,hold,recoil,l}=stance,kick={...aim,chest:[aim.chest[0]-.05,aim.chest[1],0] as Angles,head:[aim.head[0]-.04,aim.head[1],aim.head[2]] as Angles};
 return sample([{t:0,bones:aim,hold,r:['GRIP_R',1],l},{t:.18,bones:kick,hold:recoil,r:['GRIP_R',1],l},{t:1,bones:aim,hold,r:['GRIP_R',1],l}],t,true);
}
function reload(t:number,stance:AimStance):CombatFrame{
 const {bones:aim,hold,reload,l,reloadTurn=.7}=stance,look={...aim,neck:[.30,aim.neck[1]*.5,0] as Angles,head:[.25,aim.head[1]*.5,0] as Angles,chest:[.10,aim.chest[1]*reloadTurn,0] as Angles};
 const pouch={...look,upperarml:[-.20,0,-1.15] as Angles,forearml:[0,-1.2,0] as Angles,chest:[.10,aim.chest[1]*reloadTurn-.10,0] as Angles};
 return sample([
  {t:0,bones:aim,hold,r:['GRIP_R',1],l},
  {t:.12,bones:look,hold:reload,r:['GRIP_R',1],l:['MAG',1]},
  {t:.22,bones:look,hold:reload,r:['GRIP_R',1],l:['MAG',1]},
  {t:.40,bones:pouch,hold:reload,r:['GRIP_R',1],l:['POUCH',1]},
  {t:.48,bones:pouch,hold:reload,r:['GRIP_R',1],l:['POUCH',1]},
  {t:.64,bones:look,hold:reload,r:['GRIP_R',1],l:['MAG',1]},
  {t:.72,bones:look,hold:reload,r:['GRIP_R',1],l:['MAG',1]},
  {t:.82,bones:look,hold:reload,r:['GRIP_R',1],l:['SLIDE',1]},
  {t:.88,bones:look,hold:{...reload,pos:[reload.pos[0],reload.pos[1],reload.pos[2]+.03]},r:['GRIP_R',1],l:['SLIDE',1]},
  {t:1,bones:aim,hold,r:['GRIP_R',1],l}],t,true);
}
// ---------- full body ----------
function hit(t:number,stance:AimStance):CombatFrame{
 const {bones:aim,hold,l}=stance;
 const jolt:Bones={...aim,spine:[-.11,.08,0],chest:[-.14,aim.chest[1]+.18,.05],neck:[-.05,0,0],head:[-.13,-.08,0],thighl:[.10,0,-.08],thighr:[-.22,0,.08],shinl:[.30,0,0],shinr:[.42,0,0],footl:[-.30,0,0],footr:[-.20,0,0]};
  // The weapon goes back with the body (root z) so the arms keep their reach.
 const shifted=(dx:number,dy:number,dz:number,rx:number,ry:number):Hold=>({...hold,pos:[hold.pos[0]+dx,hold.pos[1]+dy,hold.pos[2]+dz],rot:[hold.rot[0]+rx,hold.rot[1]+ry,hold.rot[2]]});
 return sample([
  {t:0,bones:aim,hold,r:['GRIP_R',1],l},
  {t:.22,root:{y:-.05,z:-.07,pitch:-.03},bones:jolt,hold:shifted(.05,.03,-.14,-.32,.24),r:['GRIP_R',1],l:l&&['GRIP_L',.35]},
  {t:.55,root:{y:-.06,z:-.10,pitch:-.02},bones:{...jolt,chest:[-.08,aim.chest[1]+.10,.02],head:[-.06,-.04,0]},hold:shifted(.02,-.02,-.12,-.12,.10),r:['GRIP_R',1],l:l&&['GRIP_L',.8]},
  {t:1,bones:aim,hold,r:['GRIP_R',1],l}],t,false);
}
// Kneeling behind low cover (~1 m): right knee down, left foot planted, weapon at the chest ready to come up.
const KNEEL:Bones={pelvis:[-.05,0,0],thighl:[-1.45,0,-.10],shinl:[1.55,0,0],footl:[-.10,0,0],thighr:[-.20,0,.12],shinr:[2.10,0,0],footr:[1.00,0,0],spine:[.28,0,0],neck:[-.18,0,0],head:[-.12,0,0]};
const KNEEL_ROOT={y:-.43,z:-.02};
function cover(cls:WeaponClass,t:number,stance:AimStance):CombatFrame{
 const w=Math.sin(t*Math.PI*2),root={...KNEEL_ROOT,y:KNEEL_ROOT.y+.006*w};
 if(cls==='pistol'){const hold:Hold={anchor:'GRIP_R',pos:[-.05,.80,.28],rot:[-.95,.15,0]};
  const left:Bones=stance.l?{upperarml:[-.70,0,-.90],forearml:[0,-1.5,0]}:{};
  return sample([{t:0,root,bones:{...KNEEL,chest:[.05+.01*w,-.05,0],upperarmr:[-.70,0,.90],forearmr:[0,1.6,0],...left},hold,r:['GRIP_R',1],l:stance.l}],0,false);}
 const hold:Hold={anchor:'STOCK',pos:[-.12,.82,.08],rot:[-.95,.35,0]};
 return sample([{t:0,root,bones:{...KNEEL,chest:[.05+.01*w,-.20,0],upperarmr:[-.20,0,1.0],forearmr:[0,1.6,0],upperarml:[-.80,0,-.80],forearml:[0,-1.2,0]},hold,r:['GRIP_R',1],l:['GRIP_L',1]}],0,false);
}
// Rising from the kneel to aim over the cover top: the legs half-straighten, the upper body is the normal aim.
function coverAim(cls:WeaponClass,t:number,stance:AimStance):CombatFrame{
 const start=cover(cls,0,stance),{bones:aim,hold,l}=stance,lift=-.12;
 const up:Hold={...hold,pos:[hold.pos[0],hold.pos[1]+lift,hold.pos[2]]};
 const legs:Bones={pelvis:[-.02,0,0],thighl:[-.62,0,-.10],shinl:[.60,0,0],footl:[.02,0,0],thighr:[.10,0,.10],shinr:[.55,0,0],footr:[-.30,0,0],spine:[.06,0,0]};
 return sample([{t:0,root:start.pose.root,bones:start.pose.bones as Bones,hold:start.weapon,r:['GRIP_R',1],l},{t:1,root:{y:lift,z:-.01},bones:{...legs,...aim},hold:up,r:['GRIP_R',1],l}],t,false);
}
// ---------- bystanders (no weapon) ----------
function flee(t:number):CombatFrame{
 // Over the run: hunched, upper arms raised in front so both forearms fold back over the head, a small shake out of step with the legs.
 const s=Math.sin(t*Math.PI*2);
 return sample([{t:0,bones:{chest:[.22,.04*s,0],neck:[.20,0,0],head:[.18,.05*s,0],upperarml:[-2.45,0,-1.62],upperarmr:[-2.45,0,1.62],forearml:[0,-2.05,0],forearmr:[0,2.05,0],handl:[0,0,.2],handr:[0,0,-.2]}}],0,true);
}
function duck(t:number):CombatFrame{
 // Drop to a crouch and cover the head (first third), then hold with a tremble.
 const u=Math.min(1,t*3),shake=t>.34?Math.sin(t*Math.PI*14)*.015:0;
 const down:Bones={pelvis:[-.10,0,0],thighl:[-1.70,0,-.22],thighr:[-1.70,0,.22],shinl:[2.30,0,0],shinr:[2.30,0,0],footl:[-.60,0,0],footr:[-.60,0,0],spine:[.40,0,0],chest:[.22+shake,0,0],neck:[.05,0,0],head:[.15,0,0],upperarml:[-2.25,0,-1.78],upperarmr:[-2.25,0,1.78],forearml:[0,-2.60,0],forearmr:[0,2.60,0]};
 return sample([{t:0,bones:{}},{t:1,root:{y:-.47,z:.02,pitch:0},bones:down}],u,false);
}

export function sampleCombat(kind:CombatKind,cls:WeaponClass,progress:number,agent=false,tuning?:PistolTuning,variant?:string|PistolVariant):CombatFrame{
 const loop=COMBAT_LOOPS.includes(kind),t=loop?((progress%1)+1)%1:clamp(progress);
 const stance=agent&&cls==='pistol'?tunedPistolStance(tuning,variant):AIM_STANCE[cls];
 switch(kind){
  case 'draw':return draw(cls,t,stance);
  case 'holster':return draw(cls,1-t,stance);
  case 'aim':return aimLoop(cls,t,stance);
  case 'fire':return fire(t,stance);
  case 'reload':return reload(t,stance);
  case 'hit':return hit(t,stance);
  case 'cover':return cover(cls,t,stance);
  case 'coverAim':return coverAim(cls,t,stance);
  case 'flee':return flee(t);
  case 'duck':return duck(t);
 }
}
/** The holstered pistol is concealed under the jacket; the guard's own pistol is worn openly. */
export function weaponVisible(kind:CombatKind,cls:WeaponClass,progress:number,concealed:boolean){
 if(kind==='flee'||kind==='duck')return false;
 if(!concealed||cls!=='pistol')return true;
 const t=clamp(progress);return kind==='draw'?t>.30:kind==='holster'?t<.70:true;
}

/** Character rest axes, radians. Root translation is model-foot-local meters.
 * Apply root to the visual child, not the simulation/controller; then Rig.rotate
 * every bone. Reset rest bone translations first. Hand contact belongs to IK.
 */
export type MotionKind='ko'|'kill'|'fall'|'drag'|'hide'|'pickup'|'drop';
export type MotionRole='giver'|'receiver';
export type MotionPose={root:{x:number;y:number;z:number;pitch:number;roll:number};bones:Record<string,[number,number,number]>};
type Angles=[number,number,number];
type Key={t:number;pose:MotionPose};
export const MOTION_BONES=['root','pelvis','spine','chest','neck','head','claviclel','clavicler','upperarml','upperarmr','forearml','forearmr','handl','handr','thighl','thighr','shinl','shinr','footl','footr','thumbl','thumbr'] as const;
const clamp=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const ease=(t:number)=>t*t*(3-2*t);
function pose(root:Partial<MotionPose['root']>={},bones:Record<string,Angles>={}):MotionPose{
 const out:MotionPose={root:{x:0,y:0,z:0,pitch:0,roll:0,...root},bones:{}};
 for(const name of MOTION_BONES)out.bones[name]=[0,0,0];
 out.bones.upperarml=[-.05,0,-1.45];out.bones.upperarmr=[-.05,0,1.45];
 out.bones.forearml=[0,-.24,0];out.bones.forearmr=[0,.24,0];
 for(const [name,v] of Object.entries(bones))out.bones[name]=[...v];
 return out;
}
function blend(a:MotionPose,b:MotionPose,t:number):MotionPose{
 if(t<=0)return {root:{...a.root},bones:Object.fromEntries(Object.entries(a.bones).map(([n,v])=>[n,[...v] as Angles]))};
 if(t>=1)return {root:{...b.root},bones:Object.fromEntries(Object.entries(b.bones).map(([n,v])=>[n,[...v] as Angles]))};
 const out=pose();for(const name of Object.keys(out.root) as (keyof MotionPose['root'])[])out.root[name]=a.root[name]+(b.root[name]-a.root[name])*t;
 for(const name of MOTION_BONES)out.bones[name]=a.bones[name].map((v,i)=>v+(b.bones[name][i]-v)*t) as Angles;
 return out;
}
function track(keys:Key[],t:number):MotionPose{
 if(t<=keys[0].t)return blend(keys[0].pose,keys[0].pose,0);
 for(let i=1;i<keys.length;i++)if(t<=keys[i].t)return blend(keys[i-1].pose,keys[i].pose,ease((t-keys[i-1].t)/(keys[i].t-keys[i-1].t)));
 return blend(keys[keys.length-1].pose,keys[keys.length-1].pose,0);
}
// Flexion precedes the trunk rotation. This pose is shared by action release and fall entry.
function collapse():MotionPose{return pose({y:-.26,z:.025,pitch:.10,roll:.04},{pelvis:[-.10,0,.025],spine:[.23,0,0],chest:[.16,0,-.05],neck:[.14,0,0],head:[.12,.06,0],thighl:[-.52,0,-.07],thighr:[-.39,0,.10],shinl:[1.02,0,0],shinr:[.87,0,0],footl:[-.45,0,0],footr:[-.39,0,0],upperarml:[-.65,0,-.85],upperarmr:[-.52,0,.95],forearml:[0,-.90,0],forearmr:[0,.75,0]});}
/** Stable ground pose, also fall(receiver,1), drop(receiver,1). No breathing loop for bodies. */
export function restingMotion():MotionPose{return pose({y:.20,z:-.80,pitch:Math.PI/2,roll:.035},{pelvis:[-.025,.035,0],spine:[.035,0,0],chest:[-.055,.025,0],neck:[-.06,-.12,0],head:[.025,-.20,.05],thighl:[-.035,0,-.09],thighr:[-.08,0,.06],shinl:[.06,0,0],shinr:[.08,0,0],footl:[-.04,0,-.07],footr:[-.03,0,.09],upperarml:[-.015,0,-1.35],upperarmr:[.015,0,1.35],forearml:[0,-.04,0],forearmr:[0,.06,0],handl:[0,0,-.03],handr:[0,0,.04]});}

export function sampleRescueMotion(role:MotionRole,t:number):MotionPose{
 if(role==='giver'){
  const crouch=pose({y:-.33,pitch:.25},{spine:[.28,0,0],neck:[.20,0,0],upperarmr:[-.74,0,1.02],forearmr:[0,.50,0],
   thighl:[-.82,0,0],shinl:[1.24,0,0],footl:[-.42,0,0],thighr:[-.75,0,0],shinr:[1.16,0,0],footr:[-.41,0,0]});
  return track([{t:0,pose:pose()},{t:.28,pose:crouch},{t:.55,pose:crouch},{t:.90,pose:pose()}],t);
 }
 const sit=pose({y:-.48,z:-.39,pitch:.22},{spine:[.12,0,0],head:[.15,0,0],upperarml:[.35,0,-1.25],forearml:[0,-.45,0],
  thighl:[-1.28,0,0],shinl:[.65,0,0],thighr:[-1.33,0,0],shinr:[.72,0,0]});
 const crouch=pose({y:-.30,z:-.13,pitch:.16},{spine:[.22,0,0],upperarmr:[-.40,0,1.2],
  thighl:[-.85,0,0],shinl:[1.2,0,0],footl:[-.35,0,0],thighr:[-.79,0,0],shinr:[1.15,0,0],footr:[-.36,0,0]});
 return track([{t:0,pose:restingMotion()},{t:.30,pose:restingMotion()},{t:.56,pose:sit},{t:.76,pose:crouch},{t:1,pose:pose()}],t);
}
function fall(t:number):MotionPose{return track([{t:0,pose:collapse()},{t:.32,pose:pose({y:-.43,z:-.08,pitch:.34,roll:.085},{pelvis:[-.15,0,.04],spine:[.36,0,0],chest:[.28,0,-.08],neck:[.18,0,0],head:[.12,.08,0],thighl:[-.77,0,-.10],thighr:[-.59,0,.14],shinl:[1.55,0,0],shinr:[1.30,0,0],footl:[-.70,0,0],footr:[-.60,0,0],upperarml:[-.95,0,-.75],upperarmr:[-.82,0,.85],forearml:[0,-.65,0],forearmr:[0,.55,0]})},{t:.70,pose:pose({y:.13,z:-.65,pitch:1.33,roll:.06},{pelvis:[-.10,0,0],spine:[.20,0,0],chest:[-.10,0,0],neck:[-.13,-.08,0],head:[-.06,-.12,0],thighl:[-.24,0,-.10],thighr:[-.34,0,.09],shinl:[.65,0,0],shinr:[.85,0,0],footl:[-.25,0,0],footr:[-.30,0,0],upperarml:[-.45,0,-1.10],upperarmr:[-.60,0,1.0],forearml:[0,-.50,0],forearmr:[0,.65,0]})},{t:1,pose:restingMotion()}],t);}
function hold(wire:boolean):MotionPose{return pose({y:-.06,z:.06,pitch:.03},{pelvis:[0,.05,-.02],spine:[.20,0,0],chest:[.10,-.07,0],neck:[-.16,0,0],head:[-.10,0,0],thighl:[-.32,0,-.08],thighr:[-.23,0,.08],shinl:[.58,0,0],shinr:[.47,0,0],footl:[-.25,0,0],footr:[-.22,0,0],upperarml:[-1.28,0,wire?-.38:-.22],upperarmr:[-1.20,0,wire?.38:.58],forearml:[0,wire?-1.0:-1.35,0],forearmr:[0,wire?1.0:1.55,0],handl:[-.12,0,0],handr:[-.12,0,0]});}
function attack(kind:'ko'|'kill',role:MotionRole,t:number):MotionPose{
 if(role==='receiver')return track([{t:0,pose:pose()},{t:.18,pose:pose({}, {chest:[-.10,0,0],neck:[-.10,0,0],head:[-.06,0,0],upperarml:[-.48,0,-.90],upperarmr:[-.40,0,.95],forearml:[0,-.90,0],forearmr:[0,1.05,0]})},{t:.44,pose:pose({y:-.045,z:-.015,pitch:-.035},{spine:[-.08,0,0],chest:[-.10,0,0],neck:[.08,0,0],head:[.10,.03,0],thighl:[-.10,0,-.05],thighr:[-.08,0,.05],shinl:[.21,0,0],shinr:[.18,0,0],upperarml:[-1.28,0,-.32],upperarmr:[-1.22,0,.34],forearml:[0,-1.30,0],forearmr:[0,1.28,0]})},{t:.72,pose:blend(hold(kind==='kill'),collapse(),.40)},{t:1,pose:collapse()}],t);
 const h=hold(kind==='kill'),reach=blend(pose(),h,.70),brace=blend(h,pose({y:-.145,z:-.035,pitch:.04},{spine:[.32,0,0],chest:[.18,0,0],neck:[-.25,0,0],head:[-.16,0,0],thighl:[-.60,0,-.09],thighr:[-.44,0,.10],shinl:[1.08,0,0],shinr:[.91,0,0],footl:[-.48,0,0],footr:[-.43,0,0],upperarml:[-1.15,0,-.40],upperarmr:[-1.10,0,.42],forearml:[0,-1.20,0],forearmr:[0,1.22,0]}),.8);
 return track([{t:0,pose:pose()},{t:.18,pose:reach},{t:.34,pose:h},{t:.68,pose:brace},{t:.88,pose:brace},{t:1,pose:blend(brace,pose(),.28)}],t);
}
function drag(role:MotionRole,t:number):MotionPose{
 const wave=Math.sin(2*Math.PI*t),lift=1-Math.cos(4*Math.PI*t);
 if(role==='receiver'){const out=restingMotion();out.root.y+=.025;out.root.roll+=.012*wave;out.bones.upperarml=[-1.60,0,-.18];out.bones.upperarmr=[-1.60,0,.18];out.bones.forearml=[0,-.13,0];out.bones.forearmr=[0,.13,0];out.bones.shinl[0]+=.035*wave;out.bones.shinr[0]-=.035*wave;out.bones.head[1]+=.025*wave;return out;}
 return pose({x:.014*wave,y:-.16-.01*lift,z:0,pitch:0,roll:.018*wave},{pelvis:[0,.035*wave,0],spine:[.70,0,0],chest:[.28,-.035*wave,0],neck:[-.55,0,0],head:[-.34,0,0],thighl:[-.60+.12*wave,0,-.07],thighr:[-.60-.12*wave,0,.07],shinl:[1.16-.12*wave,0,0],shinr:[1.16+.12*wave,0,0],footl:[-.56,0,0],footr:[-.56,0,0],upperarml:[-.80,0,-1.35],upperarmr:[-.80,0,1.35],forearml:[0,-.42,0],forearmr:[0,.42,0]});
}
function stoop():MotionPose{return pose({y:-.19,z:.07},{pelvis:[-.12,0,0],spine:[.65,0,0],chest:[.30,0,0],neck:[-.42,0,0],head:[-.22,0,0],thighl:[-.75,0,-.09],thighr:[-.60,0,.10],shinl:[1.32,0,0],shinr:[1.18,0,0],footl:[-.57,0,0],footr:[-.58,0,0],upperarml:[-.65,0,-1.05],upperarmr:[-.65,0,1.05],forearml:[0,-.32,0],forearmr:[0,.32,0]});}
function oldPickup(role:MotionRole,t:number):MotionPose{return role==='receiver'?track([{t:0,pose:restingMotion()},{t:.48,pose:restingMotion()},{t:1,pose:drag('receiver',0)}],t):track([{t:0,pose:pose()},{t:.40,pose:stoop()},{t:.62,pose:stoop()},{t:1,pose:drag('giver',0)}],t);}
// Pickup is deliberately independent from drop: the latter retains the original release.
function pickup(role:MotionRole,t:number):MotionPose{
 if(role==='receiver'){
  const rest=restingMotion(),grasp=restingMotion();
  grasp.bones.handl=[0,0,-.02];grasp.bones.handr=[0,0,.02];
  grasp.bones.forearml=[0,-.02,0];grasp.bones.forearmr=[0,.03,0];
  const lifted=blend(grasp,drag('receiver',0),.70);
  // The receiver never actively curls up: only the arms/shoulders follow the grip.
  // Keep its root fixed until the final 25 mm settle into the existing drag endpoint.
  lifted.root={...rest.root};
  return track([{t:0,pose:rest},{t:.40,pose:rest},{t:.55,pose:grasp},{t:.85,pose:lifted},{t:1,pose:drag('receiver',0)}],t);
 }
 const lower=pose({y:-.29,z:.035},{pelvis:[-.08,0,0],spine:[.52,0,0],chest:[.16,0,0],neck:[-.34,0,0],head:[-.20,0,0],thighl:[-.83,0,-.09],thighr:[-.75,0,.10],shinl:[1.54,0,0],shinr:[1.48,0,0],footl:[-.71,0,0],footr:[-.73,0,0],upperarml:[-.20,0,-1.40],upperarmr:[-.20,0,1.40],forearml:[0,-.16,0],forearmr:[0,.16,0]});
 const grip=pose({y:-.57,z:.055},{pelvis:[-.10,0,0],spine:[.90,0,0],chest:[.28,0,0],neck:[-.60,0,0],head:[-.30,0,0],thighl:[-1.28,0,-.10],thighr:[-1.24,0,.11],shinl:[2.52,0,0],shinr:[2.48,0,0],footl:[-1.24,0,0],footr:[-1.24,0,0],upperarml:[-1.0,0,-1.42],upperarmr:[-1.0,0,1.42],forearml:[0,-.12,0],forearmr:[0,.12,0],handl:[-.06,0,0],handr:[-.06,0,0]});
 const loaded=blend(grip,drag('giver',0),.55);
 // Knees begin to extend while the chest stays folded; arms remain low under load.
 loaded.bones.spine=[.88,0,0];loaded.bones.chest=[.25,0,0];
 loaded.bones.upperarml=[-.95,0,-1.40];loaded.bones.upperarmr=[-.95,0,1.40];
 loaded.bones.forearml=[0,-.25,0];loaded.bones.forearmr=[0,.25,0];
 return track([{t:0,pose:pose()},{t:.28,pose:lower},{t:.40,pose:grip},{t:.55,pose:grip},{t:.74,pose:loaded},{t:1,pose:drag('giver',0)}],t);
}

function hide(role:MotionRole,t:number):MotionPose{
 if(role==='receiver'){const folded=pose({y:-.13,z:-.20,pitch:.48,roll:.08},{pelvis:[-.28,0,0],spine:[.45,0,0],chest:[.26,0,0],neck:[.24,0,0],head:[.15,-.12,0],thighl:[-1.05,0,-.08],thighr:[-.92,0,.08],shinl:[1.80,0,0],shinr:[1.64,0,0],footl:[-.55,0,0],footr:[-.48,0,0],upperarml:[-.35,0,-1.20],upperarmr:[-.40,0,1.18],forearml:[0,-1.0,0],forearmr:[0,.90,0]});return track([{t:0,pose:drag('receiver',0)},{t:.22,pose:drag('receiver',0)},{t:.64,pose:folded},{t:1,pose:folded}],t);}
 const push=pose({y:-.09,z:.12,pitch:.04},{spine:[.42,0,0],chest:[.20,0,0],neck:[-.32,0,0],head:[-.19,0,0],thighl:[-.47,0,-.08],thighr:[-.35,0,.08],shinl:[.86,0,0],shinr:[.70,0,0],footl:[-.39,0,0],footr:[-.35,0,0],upperarml:[-1.35,0,-.30],upperarmr:[-1.35,0,.30],forearml:[0,-.45,0],forearmr:[0,.45,0]});
 return track([{t:0,pose:drag('giver',0)},{t:.20,pose:stoop()},{t:.46,pose:blend(stoop(),push,.6)},{t:.72,pose:push},{t:.84,pose:push},{t:1,pose:pose()}],t);
}
/** Non-cyclic motions clamp t to 0..1. Drag accepts a normalized cycle;
 * its endpoints and first derivatives agree, so caller may wrap t freely.
 * fall(giver) is the actor's release/recovery while receiver settles to ground.
 */
export function sampleMotion(kind:MotionKind,role:MotionRole,time:number):MotionPose{
 const t=clamp(time);
 switch(kind){
  case 'ko':case 'kill':return attack(kind,role,t);
  case 'fall':return role==='receiver'?fall(t):blend(attack('ko','giver',1),pose(),ease(t));
  case 'drag':return drag(role,t);
  case 'pickup':return pickup(role,t);
  case 'drop':return oldPickup(role,1-t);
  case 'hide':return hide(role,t);
 }
}










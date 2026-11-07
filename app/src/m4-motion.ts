import type { MotionPose } from './motion';

type Angles=[number,number,number];
type Bones=Record<string,Angles>;
const CHANNELS=['root','pelvis','spine','chest','neck','head','claviclel','clavicler','upperarml','upperarmr','forearml','forearmr','handl','handr','thighl','thighr','shinl','shinr','footl','footr','thumbl','thumbr'] as const;
const clamp=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const smooth=(t:number)=>t*t*(3-2*t);
function neutral():MotionPose{
 const bones:Bones={};for(const name of CHANNELS)bones[name]=[0,0,0];
 bones.upperarml=[-.05,0,-1.45];bones.upperarmr=[-.05,0,1.45];
 bones.forearml=[0,-.24,0];bones.forearmr=[0,.24,0];
 return {root:{x:0,y:0,z:0,pitch:0,roll:0},bones};
}
function sample(keys:{t:number;bones:Bones}[],t:number):MotionPose{
 const out=neutral();
 let left=keys[0],right=keys[0];
 for(let i=1;i<keys.length;i++){left=keys[i-1];right=keys[i];if(t<=right.t)break;}
 const u=smooth(clamp((t-left.t)/(right.t-left.t)));
 for(const name of CHANNELS){const a=left.bones[name]??out.bones[name],b=right.bones[name]??out.bones[name];out.bones[name]=a.map((v,i)=>v+(b[i]-v)*u) as Angles;}
 return out;
}
/** Short M4 visual layers: character rest-axis XYZ radians, all 22 channels.
 * root is always zero; pelvis/legs remain neutral, so standing feet do not sink.
 * Apply upper-body channels over idle/gait when layering; do not reset navigation.
 * Timings are normalized: change ~1.5s, frisk ~2.5s (caller owns clocks/fade).
 * change/receiver is a neutral placeholder: keep an inactive owner's existing
 * resting pose instead of applying this placeholder onto the body.
 * Frisk assumes a facing pair; runtime owns spacing and optional hand contact IK.
 */
export function sampleM4Motion(kind:'change'|'frisk',role:'giver'|'receiver',progress:number):MotionPose{
 const t=clamp(progress);
 if(kind==='change'){
  if(role==='receiver')return neutral();
  // Reach collar, dip/settle the garment under the swap fade, smooth lapels/hem.
  const collar:Bones={spine:[.08,0,0],chest:[.04,0,0],neck:[.10,0,0],head:[.08,0,0],upperarml:[-1.20,0,-.60],upperarmr:[-1.30,0,.54],forearml:[0,-1.46,0],forearmr:[0,1.48,0],handl:[-.12,0,0],handr:[-.12,0,0]};
  const dip:Bones={...collar,spine:[.23,0,0],chest:[.09,0,0],neck:[-.10,0,0],head:[.05,0,0],upperarml:[-.82,0,-1.04],upperarmr:[-.76,0,1.10],forearml:[0,-.95,0],forearmr:[0,.90,0]};
  const finish:Bones={spine:[.06,0,0],chest:[-.035,0,0],neck:[-.04,0,0],head:[0,.06,0],upperarml:[-.42,0,-1.22],upperarmr:[-.38,0,1.20],forearml:[0,-.62,0],forearmr:[0,.58,0],handl:[.08,0,0],handr:[.08,0,0]};
  return sample([{t:0,bones:{}},{t:.18,bones:collar},{t:.33,bones:collar},{t:.51,bones:dip},{t:.64,bones:dip},{t:.81,bones:finish},{t:1,bones:{}}],t);
 }
 if(role==='receiver'){
  // Cooperative inspection: modest opening, quiet hold, then relaxed arms-down.
  const open:Bones={chest:[-.025,0,0],upperarml:[-.10,0,-.98],upperarmr:[-.10,0,.98],forearml:[0,-.12,0],forearmr:[0,.12,0],handl:[0,0,-.04],handr:[0,0,.04]};
  return sample([{t:0,bones:{}},{t:.20,bones:open},{t:.82,bones:open},{t:1,bones:{}}],t);
 }
 const chest:Bones={spine:[.08,0,0],chest:[.04,0,0],neck:[-.04,0,0],head:[.08,0,0],upperarml:[-1.24,0,-.70],upperarmr:[-1.20,0,.70],forearml:[0,-.70,0],forearmr:[0,.72,0],handl:[-.10,0,0],handr:[-.10,0,0]};
 const sideLeft:Bones={spine:[.16,0,0],chest:[.08,.09,0],neck:[-.09,-.05,0],head:[.12,-.06,0],upperarml:[-.80,0,-1.13],upperarmr:[-1.0,0,.86],forearml:[0,-.35,0],forearmr:[0,.56,0],handl:[.04,0,-.05]};
 const sideRight:Bones={spine:[.16,0,0],chest:[.08,-.09,0],neck:[-.09,.05,0],head:[.12,.06,0],upperarml:[-1.0,0,-.86],upperarmr:[-.80,0,1.13],forearml:[0,-.56,0],forearmr:[0,.35,0],handr:[.04,0,.05]};
 return sample([{t:0,bones:{}},{t:.20,bones:chest},{t:.34,bones:chest},{t:.49,bones:sideLeft},{t:.61,bones:sideRight},{t:.76,bones:sideRight},{t:1,bones:{}}],t);
}


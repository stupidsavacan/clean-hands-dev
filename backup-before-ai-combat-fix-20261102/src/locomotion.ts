// Procedural locomotion for the 22-bone agent rig. Angles are radians in the character's rest frame:
// +pitch swings a leg/arm backwards (or tips the torso forward), knee + is flexion, foot + points the toe down,
// +roll lifts the character's left (+X) side.
export const THIGH=.39,SHIN=.41,HIP_HEIGHT=.80,HIP_HALF=.095;
// Travel speeds (m/s). Walking at 2.6 forced ~3.8 steps/s; 1.65 is an unhurried, purposeful walk at ~2.5 steps/s.
export const WALK_SPEED=1.65,RUN_SPEED=4.8,CROUCH_SPEED=1.2;
export type Gait={stride:number;duty:number;frontShare:number;lift:number;heel:number;toe:number;lean:number;chestUp:number;arm:number;armBack:number;elbow:number;elbowSwing:number;yaw:number;obliquity:number;shift:number;height:number;flight:number;flex:number;track:number;toeOut:number};
// Walk reference ranges: pelvis rotation ~±4°, obliquity ~±4°, lateral sway ~±2 cm, shoulder swing further back (~25°)
// than forward (~10°), elbow ~15° rising to ~35° on the forward swing, upright trunk.
export const WALK:Gait={stride:1.32,duty:.6,frontShare:.34,lift:.13,heel:.07,toe:.45,lean:.035,chestUp:.06,arm:.3,armBack:.12,elbow:.22,elbowSwing:.38,yaw:.075,obliquity:.06,shift:.022,height:.797,flight:0,flex:0,track:.03,toeOut:.1};
// Run: land close under the hips (no overstride), kick the heel up and drive the knee, ~11° lean, elbows ~80° pumping
// from chest height to behind the hip.
export const RUN:Gait={stride:2.7,duty:.33,frontShare:.2,lift:.38,heel:.12,toe:.75,lean:.26,chestUp:.04,arm:.62,armBack:.16,elbow:1.25,elbowSwing:.4,yaw:.1,obliquity:.035,shift:.01,height:.775,flight:.06,flex:.03,track:.04,toeOut:.05};
// Sneak: a deep crouch — hips about 45 cm off the ground (knees folded past 100°), trunk pitched ~50° forward with the head kept up, elbows bent in front, knees and toes turned out.
export const CROUCH:Gait={stride:.7,duty:.68,frontShare:.5,lift:.08,heel:.02,toe:.2,lean:.8,chestUp:0,arm:.1,armBack:.5,elbow:.7,elbowSwing:.12,yaw:.05,obliquity:.02,shift:.02,height:.4,flight:0,flex:0,track:-.07,toeOut:.3};
export type LegPose={thigh:number;knee:number;foot:number;roll:number;footRoll:number;toeOut:number;ankle:{z:number;y:number};stance:boolean};
export type ArmPose={swing:number;elbow:number;shoulder:number};
export type Pose={hip:number;pelvisShift:number;pelvisYaw:number;pelvisRoll:number;spine:number;chest:number;chestYaw:number;chestRoll:number;neck:number;head:number;headYaw:number;legs:[LegPose,LegPose];arms:[ArmPose,ArmPose];phase:number;gait:number};
// ground(z): visual ground height at z metres ahead of the body, relative to the body's own height (stair treads).
// speed may be smoothed for blending; actual (unsmoothed travel speed) tells the moment the body stops.
export type GaitInput={speed:number;crouch:number;slope:number;turn:number;distance:number;ground?:(z:number)=>number;actual?:number;reverse?:boolean};
const clamp=(v:number,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
type Ground=(z:number)=>number;
// Personal gait: multipliers on the base gaits (stride, arm swing, hip sway, step lift), a forward lean in radians that
// also shows at idle (slouch / upright), and extra toe-out. NEUTRAL leaves the base gaits untouched.
export type GaitStyle={stride:number;arm:number;lean:number;sway:number;bounce:number;toe:number};
export const NEUTRAL:GaitStyle={stride:1,arm:1,lean:0,sway:1,bounce:1,toe:0};
export function blendGait(speed:number,crouch:number,style:GaitStyle=NEUTRAL):Gait{const run=smooth(2.4,4.4,speed),out={} as Gait;for(const k of Object.keys(WALK) as (keyof Gait)[])out[k]=mix(mix(WALK[k],RUN[k],run),CROUCH[k],crouch);
 // Shorter strides at low speed keep the cadence believable while easing in and out of a walk.
 const top=mix(mix(WALK_SPEED,RUN_SPEED,run),CROUCH_SPEED,crouch);out.stride*=mix(.55,1,clamp(speed/top));
 out.stride*=style.stride;out.arm*=style.arm;out.armBack*=style.arm;out.elbowSwing*=mix(1,style.arm,.5);out.yaw*=style.sway;out.obliquity*=style.sway;out.shift*=style.sway;
 out.lift*=style.bounce;out.heel*=mix(1,style.bounce,.6);out.flex+=(style.bounce-1)*.012*(1-crouch);out.lean+=style.lean;out.toeOut+=style.toe*.1;return out;}
// Two-bone IK in the sagittal plane; returns thigh pitch and knee flexion reaching the ankle target.
export function solveLeg(z:number,drop:number){const d=Math.min(Math.hypot(z,drop),THIGH+SHIN-1e-4),line=Math.atan2(-z,drop);
 const knee=Math.PI-Math.acos(clamp((THIGH*THIGH+SHIN*SHIN-d*d)/(2*THIGH*SHIN),-1,1));const gamma=Math.acos(clamp((THIGH*THIGH+d*d-SHIN*SHIN)/(2*THIGH*d),-1,1));return {thigh:line-gamma,knee};}
// Foot target for one leg at phase p (0 = heel strike in front of the hip). A swinging foot travels between the ground
// heights at lift-off and landing, so it steps up onto a tread instead of snapping through the riser.
export function footTarget(p:number,g:Gait,amount:number,ground:Ground=()=>0){const span=g.stride*g.duty*amount,front=span*g.frontShare;
 if(p<g.duty){const u=p/g.duty,peel=smooth(.55,1,u),z=front-u*span;return {z,y:ground(z)+g.heel*peel*amount,foot:g.toe*peel*amount-.18*amount*(1-smooth(0,.16,u)),stance:true};}
 const u=(p-g.duty)/(1-g.duty),e=smooth(.08,1,u),z=front-span+e*span,from=ground(front-span),to=ground(front);
 return {z,y:mix(from,to,smooth(.1,.7,u))+mix(g.heel*amount,0,smooth(0,.6,u))+(g.lift*amount+Math.abs(to-from)*.6)*Math.sin(Math.PI*Math.pow(u,.7)),foot:mix(g.toe*amount,-.18*amount,smooth(0,.75,u)),stance:false};}
// +1 when the leg is furthest forward, -1 furthest back; drives arm swing and hip rotation.
export function legForward(p:number,duty:number){return Math.cos(p<duty?Math.PI*p/duty:Math.PI+Math.PI*(p-duty)/(1-duty));}
// Highest hip the planted feet allow at phase p (flight phases rise by g.flight). A foot past PEEL of its stance is rolling
// onto the toe, so it no longer holds the hips down; if it cannot reach, IK straightens the leg and the heel rises.
const PEEL=.74;
function hipLimit(p:number,g:Gait,amount:number,ground:Ground,reach:number,cap:number){let h=Infinity;for(const q of [p,(p+.5)%1]){if(q>=g.duty*PEEL)continue;const f=footTarget(q,g,amount,ground);if(f.stance)h=Math.min(h,f.y+Math.sqrt(Math.max(0,reach*reach-f.z*f.z)));}return h===Infinity?cap+g.flight*amount:h;}
// Hip height over one cycle: erode the limit with a parabola (so a foot landing is anticipated, not dropped into), blur it
// with a circular Gaussian, then shift the whole curve down by its worst overshoot so planted feet always stay reachable.
const SAMPLES=64,ENVELOPE=1.6,BLUR=.05;
const kernel=(()=>{const k:number[]=[];for(let i=-16;i<=16;i++)k.push(Math.exp(-.5*(i/SAMPLES/BLUR)**2));const sum=k.reduce((a,b)=>a+b);return k.map(v=>v/sum);})();
export type HipProfileCache={limit?:Float64Array;out?:Float64Array;flex?:number};
export function hipProfile(g:Gait,amount:number,ground:Ground,reach:number,cap:number,cache?:HipProfileCache){const limit=new Float64Array(SAMPLES);
 const top=cap+g.flight*amount;for(let i=0;i<SAMPLES;i++)limit[i]=Math.min(hipLimit(i/SAMPLES,g,amount,ground,reach,cap),top);
 // The entire sampled support limit (including the current ground) must match;
 // moving onto a tread or changing gait invalidates reuse without a time or distance heuristic.
 const flex=g.flex*amount;if(cache?.out&&cache.flex===flex&&cache.limit?.every((v,i)=>v===limit[i]))return cache.out;
 const eroded=new Float64Array(SAMPLES),out=new Float64Array(SAMPLES);
 for(let i=0;i<SAMPLES;i++){let h=Infinity;for(let j=0;j<SAMPLES;j++){const d=Math.abs(i-j)/SAMPLES,w=Math.min(d,1-d);h=Math.min(h,limit[j]+ENVELOPE*w*w);}eroded[i]=h;}
 let over=0;for(let i=0;i<SAMPLES;i++){let v=0;for(let k=0;k<kernel.length;k++)v+=kernel[k]*eroded[(i+k-16+SAMPLES)%SAMPLES];out[i]=v;over=Math.max(over,v-limit[i]);}
 for(let i=0;i<SAMPLES;i++)out[i]-=over+flex;if(cache){cache.limit=limit;cache.out=out;cache.flex=flex;}return out;}
export function sampleProfile(profile:Float64Array,p:number){const x=p*SAMPLES,i=Math.floor(x)%SAMPLES,f=x-Math.floor(x);return profile[i]*(1-f)+profile[(i+1)%SAMPLES]*f;}
export class Locomotion{
 phase=0;time=0;hip=HIP_HEIGHT;gait=0;style:GaitStyle=NEUTRAL;private hipCache:HipProfileCache={};
 // Stopping: feet are frozen where they were and brought in one at a time (furthest first) instead of sliding together.
 private settle:{from:{z:number;y:number}[];order:number[];t:number}|null=null;private lastFeet:{z:number;y:number}[]=[];private lastSpeed=0;
 reset(){this.hipCache={};this.phase=0;this.hip=HIP_HEIGHT;this.gait=0;this.settle=null;this.lastFeet=[];this.lastSpeed=0;}
 update(dt:number,input:GaitInput):Pose{this.time+=dt;
  const g=blendGait(input.speed,input.crouch,this.style),turnStep=Math.min(Math.abs(input.turn),8)*.16*dt,t=this.time;
  this.gait+=(clamp(Math.max(smooth(.04,.8,input.speed),Math.min(1,Math.abs(input.turn)/5)*.45))-this.gait)*(1-Math.exp(-10*dt));
  this.phase=(this.phase+(input.distance+turnStep)/g.stride)%1;
  const amount=this.gait,idle=1-amount,stand=1-input.crouch,rawGround:Ground=input.ground||(z=>input.slope*z),ground:Ground=z=>rawGround(input.reverse?-z:z),onStairs=!!input.ground&&Math.abs(ground(.3)-ground(-.3))>.02;
  const reach=(THIGH+SHIN)*.997,cap=mix(g.height,HIP_HEIGHT*.99,idle)*stand+g.height*input.crouch;
  // Idle: weight rests on one leg and moves to the other every few seconds (contrapposto); the free foot sits a little
  // forward with its knee eased, the stance is wider than the walking track. weight > 0 means on the left leg.
  const weight=clamp(Math.sin(t*Math.PI*2/15)*2.5,-1,1)*idle*mix(1,.4,input.crouch);
  const phases=[this.phase,(this.phase+.5)%1],feet=phases.map((p,i)=>{const sign=i?-1:1,free=clamp(-sign*weight),f=footTarget(p,g,amount,ground);f.z+=idle*(free*.06-(1-free)*.02);f.y+=free*.012;
   // Crouched and still: a low lunge. The left foot plants ahead, the right trails on its toes.
   const lunge=input.crouch*idle;f.z+=(i?-.17:.15)*lunge;if(i){f.foot+=.55*lunge;f.y+=.04*lunge;}if(input.reverse){f.z=-f.z;f.foot=-f.foot;}return f;});
  const actual=input.actual??input.speed,stopped=actual<.08&&Math.abs(input.turn)<.5;
  if(stopped&&this.lastSpeed>=.08&&this.lastFeet.length===2&&amount>.15){const d=this.lastFeet.map((f,i)=>Math.abs(f.z-feet[i].z));this.settle={from:this.lastFeet.map(f=>({...f})),order:d[0]>=d[1]?[0,1]:[1,0],t:0};}
  if(!stopped)this.settle=null;
  let settleHip=Infinity;
  if(this.settle){const st=this.settle;st.t+=dt;const STEP=.24,GAP=.18;
   st.order.forEach((leg,k)=>{const u=clamp((st.t-k*GAP)/STEP),f=feet[leg],from=st.from[leg];f.z=mix(from.z,f.z,smooth(0,1,u));f.y=mix(from.y,f.y,smooth(0,1,u))+(.07-.03*input.crouch)*Math.sin(Math.PI*u)*Number(Math.abs(from.z-feet[leg].z)>.04);f.stance=u<=0||u>=1;f.foot*=u;
    if(f.stance)settleHip=Math.min(settleHip,f.y+Math.sqrt(Math.max(0,reach*reach-f.z*f.z)));});
   if(st.t>GAP+STEP)this.settle=null;}
  this.lastSpeed=actual;
  this.hip=Math.min(sampleProfile(hipProfile(g,amount,ground,reach,cap,this.hipCache),this.phase),settleHip)-(onStairs?.02:0);
  // Frontal plane: the pelvis drops on the swing side just after the opposite heel strike and the weight shifts over the
  // planted foot. Left stance is phase 0..duty, so both peak toward the left early in that window.
  const side=Math.cos(Math.PI*2*(this.phase-.2));
  const pelvisRoll=g.obliquity*amount*Math.cos(Math.PI*2*(this.phase-.1))+.05*weight,pelvisShift=g.shift*amount*side+.03*weight;
  const track=mix(g.track,-.035,idle*stand);
  const legs=feet.map((f,i)=>{const sign=i?-1:1,socket=this.hip+sign*HIP_HALF*Math.sin(pelvisRoll),s=solveLeg(f.z,socket-f.y),drop=Math.max(.3,socket-f.y);
   // Lateral offset of the ankle from its socket: inward to the track, minus the pelvis shift, reached by rolling the leg.
   const lateral=-sign*track-pelvisShift,roll=Math.asin(clamp(lateral/drop,-.5,.5));
   return {thigh:s.thigh,knee:s.knee,foot:f.foot-s.thigh-s.knee-(input.ground?0:Math.atan(input.slope)),roll:roll-pelvisRoll,footRoll:-roll,toeOut:sign*g.toeOut,ankle:{z:f.z,y:f.y},stance:f.stance};}) as [LegPose,LegPose];
  this.lastFeet=feet.map(f=>({z:f.z,y:f.y}));
  // Arms trail the legs slightly (follow-through) and swing further back than forward.
  const fwd=phases.map(p=>legForward(p,g.duty)*amount),armFwd=phases.map(p=>legForward((p-.035+1)%1,g.duty)*amount),breathe=Math.sin(t*Math.PI*2/3.6)*(1-amount*.7);
  const lean=g.lean*(input.crouch+stand*amount)+this.style.lean*idle*stand+(onStairs?.08:0),chestUp=g.chestUp*stand,spine=lean*.6+chestUp*.5,chest=lean*.4-chestUp+.018*breathe;
  // An idle agent glances around now and then.
  const glance=(Math.sin(t*.53)+.6*Math.sin(t*1.37+1.3))*.16*idle;
  return {hip:this.hip,pelvisShift,pelvisYaw:-g.yaw*fwd[0]+.04*weight,pelvisRoll,spine,chest,chestYaw:g.yaw*1.45*fwd[0]-.03*weight,chestRoll:-pelvisRoll*.85,
   // Keep the head level and looking ahead whatever the trunk does.
   neck:-(spine+chest)*.55-.012*breathe,head:-(spine+chest)*.4,headYaw:-g.yaw*.4*fwd[0]+glance,legs,
   arms:[0,1].map(i=>{const forward=Math.max(0,-armFwd[i]),moving=Math.max(amount,input.crouch);const rest=input.crouch*idle;// Crouched and still, the left hand rests on the forward knee.
   return {swing:g.arm*armFwd[i]+g.armBack*moving-.05*idle*stand+.025*breathe-(i?0:1.05*rest),elbow:g.elbow*moving+.24*idle*stand+g.elbowSwing*forward+(i?0:.25*rest),shoulder:.07*stand};}) as [ArmPose,ArmPose],phase:this.phase,gait:amount};
 }
}

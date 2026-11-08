import * as T from 'three';
import type {Pose} from './locomotion.ts';
import type {Rig} from './rig.ts';
import {itemModel} from './item-models.ts';

// The scheduled gestures (2026-11-05, rebuilt from scratch): what people do while they stand at a scheduled place.
// Each gesture works in two layers on top of the standing pose:
//  1. the body: breathing, a slow weight shift, the back, the head and the arms' rough shape (Pose fields);
//  2. the hands: where each hand goes, in the person's own space (metres; +Y up, +Z forward, the right hand on -X),
//     reached with the two-bone IK the M3 motions use (motion-runtime.ts reach), plus what it holds (assets/props,
//     assets/items).
// Gestures run in phases (take a sip, talk then listen, chop then stir) with slow blends between them, and each
// person's actionTime is offset, so a room never moves in step. Shared by the NPCs (npc-view.ts), the player blending
// in (engine/game.ts) and the Animation Lab.
// Measured on the agent standing (Animation Lab joints()): shoulder joint y 1.37 at x ±0.19, elbow 1.09, wrist 0.85,
// pelvis 0.87, chest 1.21, base of the skull 1.51 (face about 1.6, mouth about 1.56 and 0.09 forward). Upper arm 0.28 m,
// forearm 0.24 m. NPC models share the rig and are within a few centimetres.
export type V3=[number,number,number];
// at: the wrist's target; w: how far the hand goes there (0 = the arm hangs as posed); swing/elbow: the arm's rough
// shape before the IK, which decides where the elbow ends up (forward raise is negative swing).
// pole: a point (same space) the elbow bends toward; by default out to the side, down and a little back.
export type HandGoal={at:V3;w:number;swing?:number;elbow?:number;pole?:V3};
export type Gesture={r?:HandGoal;l?:HandGoal;props?:{r?:string|PropUse;l?:string|PropUse}};

const clamp01=(x:number)=>Math.min(1,Math.max(0,x));
const smooth=(x:number)=>{x=clamp01(x);return x*x*(3-2*x);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const mix3=(a:V3,b:V3,t:number):V3=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
// 0 → 1 → 0: rises from `a` over `rise`, holds, falls over `fall`.
const env=(t:number,a:number,rise:number,hold:number,fall:number)=>t<a?0:t<a+rise?smooth((t-a)/rise):t<a+rise+hold?1:smooth(1-(t-a-rise-hold)/fall);
// A fixed random number for cycle k (the same every time the clip is replayed).
const rnd=(k:number)=>{const x=Math.sin(k*127.1+311.7)*43758.5453;return x-Math.floor(x);};
// Where in its cycle a repeating event is: the cycle number and the time into it.
const cycle=(t:number,period:number)=>{const k=Math.floor(t/period);return {k,u:t-k*period};};

// Standing still is never still: breathing in the chest and a slow shift of weight from foot to foot.
function alive(p:Pose,t:number,amount=1){
 p.chest+=.012*Math.sin(t*1.5);p.neck+=.006*Math.sin(t*1.5+.6);
 const w=Math.sin(t*.31)*amount;p.pelvisShift+=.014*w;p.pelvisRoll+=.025*w;p.chestRoll-=.015*w;p.headYaw+=.03*Math.sin(t*.23);
}
const shape=(p:Pose,side:0|1,swing:number,elbow:number)=>{p.arms[side].swing=swing;p.arms[side].elbow=elbow;};

// ---------------------------------------------------------------- the gestures
// Phone: the phone at the right ear, the head leaning into it; the free hand rests on the hip or hangs, and now and
// then talks along. Small nods while listening.
function phone(p:Pose,t:number):Gesture{
 alive(p,t);const {k,u}=cycle(t,9),hip=(rnd(k)>.45?1:0)*env(u,0,.7,7.6,.7),talk=env(u,2.5,.6,1.6,.7)*(rnd(k+7)>.3?1:0);
 p.head+=.06+.03*Math.sin(t*1.9)*(1-talk);p.headYaw-=.12;p.chestYaw-=.05;
 shape(p,1,-1.4,2.35);shape(p,0,0,.25);
 // The free hand: on the hip, hanging, or talking along, always blended.
 const talkAt:V3=[.17,1.18+.04*Math.sin(t*3),.28],hipAt:V3=[.2,.98,-.03],lw=Math.max(hip,talk);
 const l:HandGoal|undefined=lw>0?{at:hip>talk?mix3(talkAt,hipAt,hip/(hip+talk+1e-6)):mix3(hipAt,talkAt,talk/(hip+talk+1e-6)),w:lw,pole:hip>talk?[.6,1.1,-.25]:undefined}:undefined;
 // The wrist just below and outside the ear, the elbow out and down, the forearm along the cheek.
 return {r:{at:[-.13,1.47,.04],w:1,pole:[-.7,1.1,.05]},l,props:{r:'phone'}};
}
// Radio (a guard): the handset held low; every few seconds it comes up to the mouth, the head turns to it, a short
// report, and down again.
function radio(p:Pose,t:number):Gesture{
 alive(p,t,.6);const {u}=cycle(t,8),up=env(u,1.5,.5,2.2,.6);
 p.head+=.08*up;p.headYaw+=.15*up;shape(p,0,-.3-up*.9,1.0+up*1.2);
 return {l:{at:mix3([.17,1.02,.12],[.07,1.4,.17],up),w:1,pole:[.5,.8,-.05]},props:{l:'radio'}};
}
// Drinking: the glass held at the chest, the elbow loose; every 6-10 s a sip (to the lips, the head tips back, down).
function drink(p:Pose,t:number):Gesture{
 alive(p,t);const {k,u}=cycle(t,8),sip=env(u,1+rnd(k)*3.5,.8,1.0,.8);
 p.head-=.14*sip;p.neck-=.05*sip;shape(p,1,-.45-sip*.6,1.5+sip*.6);
 return {r:{at:mix3([-.16,1.08,.22],[-.06,1.4,.18],sip),w:1},props:{r:{id:'wine_glass',rot:[UP-1.0*sip,0,0]}}};
}
// Tasting: look at the wine against the light, swirl it, smell it, then a small sip; the other hand under the glass.
function tasting(p:Pose,t:number):Gesture{
 alive(p,t,.6);const u=t%10,look=env(u,0,.8,3.2,.6),swirl=u>1&&u<4,smell=env(u,4.6,.5,1.2,.5),sip=env(u,6.8,.5,.8,.6);
 const sw=swirl?.025:0;
 const at=mix3(mix3(mix3([-.12,1.15,.24],[-.06,1.42,.32],look),[-.04,1.5,.12],smell),[-.035,1.47,.12],sip);
 p.head+=-.12*look+.05*smell-.15*sip;shape(p,1,-.7-.4*look,1.6);
 return {r:{at:[at[0]+sw*Math.cos(t*7),at[1],at[2]+sw*Math.sin(t*7)],w:1},l:{at:[-.06,1.02,.24],w:smooth((1-look)*(1-smell)),swing:-.5,elbow:1.6},props:{r:{id:'wine_glass',rot:[UP-.9*sip+.15*look,0,0]}}};
}
// Conversation: turns of talking (both hands shape what is said at waist height, nods, a lean in) and listening (hands
// loosely together in front, an occasional nod).
function chat(p:Pose,t:number):Gesture{
 alive(p,t);const {k,u}=cycle(t,11),talkFirst=rnd(k)>.5,talk=talkFirst?env(u,0,.8,4.5,.9):env(u,5,.8,4.2,.9);
 const g1=Math.sin(t*2.3+rnd(k)*6),g2=Math.sin(t*1.7+1.3),nod=Math.max(0,Math.sin(t*2.6))**4;
 p.head+=.05*nod*(1-talk)+.03*g2*talk;p.headYaw+=.07*g1*talk;p.spine+=.03*talk;
 const listenR:V3=[-.035,.98,.17],listenL:V3=[.04,1.0,.15];
 const talkR:V3=[-.17+.04*g1,1.1+.06*Math.max(0,g2),.3],talkL:V3=[.16-.03*g2,1.06+.05*Math.max(0,-g1),.26];
 shape(p,1,-.5,1.5);shape(p,0,-.45,1.5);
 return {r:{at:mix3(listenR,talkR,talk),w:1},l:{at:mix3(listenL,talkL,talk),w:mix(1,.85,talk)}};
}
// A speech: open hands at chest height, wider than talk; the head and chest sweep the room.
function speech(p:Pose,t:number):Gesture{
 alive(p,t,.5);const g=Math.sin(t*1.6),h=Math.sin(t*.9),beat=Math.max(0,Math.sin(t*3.2))**3;
 p.headYaw+=.35*h;p.chestYaw+=.12*h;p.chest-=.03;p.head-=.03*beat;
 shape(p,1,-.8,1.2);shape(p,0,-.8,1.2);
 return {r:{at:[-.24-.06*g,1.24+.05*beat,.3],w:1},l:{at:[.22+.06*Math.sin(t*1.3),1.2+.04*beat,.28],w:.6+.4*Math.max(0,Math.sin(t*.7))}};
}
// A photographer: the camera at the eye in both hands; between shots it comes down and they look around.
function camera(p:Pose,t:number):Gesture{
 alive(p,t,.5);const {u}=cycle(t,7),up=1-env(u,4.2,.6,1.2,.6),aside=1-up;
 p.head+=.04*up-.05*aside;p.headYaw+=.35*aside*Math.sin(t*.8);shape(p,1,-1.3,2.1);shape(p,0,-1.2,1.9);
 return {r:{at:mix3([-.12,1.15,.22],[-.05,1.56,.16],up),w:1},l:{at:mix3([.02,1.12,.24],[.06,1.53,.19],up),w:1},props:{r:'camera'}};
}
// Being photographed: turned a little, a hand on the hip, the head tilted; the pose changes every few seconds.
function photo(p:Pose,t:number):Gesture{
 alive(p,t,.4);const {k,u}=cycle(t,5),side=(n:number)=>rnd(n)>.5?1:-1,turn=mix(side(k-1),side(k),smooth(u/.9));
 const glass=(rnd(k)>.5?1:0)*env(u,0,.6,3.8,.6);
 p.chestYaw+=.2*turn;p.pelvisYaw+=.09*turn;p.headYaw-=.14*turn;p.head-=.04;
 shape(p,0,.2,1.5);
 return {l:{at:[.2,.98,-.03],w:1,pole:[.6,1.1,-.25]},r:{at:[-.12,1.12,.2],w:.8*glass,swing:-.4,elbow:1.4},props:glass>.4?{r:'wine_glass'}:undefined};
}
// A tour or an inspection: hands clasped behind the back, a slow look round; now and then a lean to look closer and
// a point at something.
function tour(p:Pose,t:number,point=false):Gesture{
 alive(p,t,.5);const {k,u}=cycle(t,8),look=point&&rnd(k)>.4?env(u,3,.7,1.8,.7):0;
 p.headYaw+=.45*Math.sin(t*.45)*(1-look);p.head+=.08*Math.sin(t*.3)+.15*look;p.spine+=.12*look;
 shape(p,1,.25,1.3);shape(p,0,.25,1.3);
 return {r:look>0?{at:mix3([-.05,.98,-.16],[-.16,1.25,.48],look),w:1,swing:mix(.25,-1,look),elbow:mix(1.3,.4,look)}:{at:[-.05,.98,-.16],w:1},l:{at:[.05,1.0,-.15],w:1}};
}
// Cooking at a counter (about 0.95 m): the left hand holds, the right chops in bursts; between bursts a reach to the
// pan to stir. Bent a little over the work, looking at it.
function cook(p:Pose,t:number):Gesture{
 alive(p,t,.3);const {u}=cycle(t,9),stir=env(u,5.5,.6,2.0,.6),chop=(1-stir)*(Math.sin(t*.9)>-.3?1:0);
 p.spine+=.16;p.head+=.25;p.headYaw-=.25*stir;
 const chopR:V3=[-.1,.99+.05*Math.abs(Math.sin(t*9))*chop,.4],stirR:V3=[-.33+.05*Math.cos(t*4),1.0,.36+.05*Math.sin(t*4)];
 shape(p,1,-.7,1.5);shape(p,0,-.7,1.6);
 return {r:{at:mix3(chopR,stirR,stir),w:1},l:{at:[.09,.98,.4],w:1-.5*stir},props:{r:'kitchen_knife'}};
}
// Wiping a counter: the right hand in slow circles, the left resting on the edge; every so often a new patch.
function clean(p:Pose,t:number):Gesture{
 alive(p,t,.3);const {k,u}=cycle(t,6),spot=(n:number)=>-.12+(rnd(n)-.5)*.16,cx=mix(spot(k-1),spot(k),smooth(u/1.2));
 p.spine+=.2;p.head+=.22;
 shape(p,1,-.7,1.3);shape(p,0,-.6,1.5);
 return {r:{at:[cx+.11*Math.cos(t*2.6),.96,.43+.08*Math.sin(t*2.6)],w:1},l:{at:[.2,.96,.32],w:1}};
}
// Push the mop across the floor, with its head below the hands.
function mopFloor(p:Pose,t:number):Gesture{
 alive(p,t,.4);const sway=Math.sin(t*2.8),wrist=.94;
 p.spine+=.21;p.head+=.23;
 shape(p,1,-.58,.88);shape(p,0,-.60,.97);
 return {r:{at:[-.16+.13*sway,wrist,.22],w:1},l:{at:[-.08+.11*sway,1.12,.13],w:1},
  props:{r:{id:'mop',rot:[Math.asin((wrist-.03)/1.13),sway*.23,0],off:[0,0,0]}}};
}
// Massage (the masseur): both hands on the table (about 0.8 m), kneading in turn, leaning their weight in.
function massageWork(p:Pose,t:number):Gesture{
 alive(p,t,.2);const a=Math.sin(t*2.2),b=Math.sin(t*2.2+Math.PI);
 p.spine+=.35;p.head+=.25;p.hip-=.02;
 shape(p,1,-.9,.8);shape(p,0,-.9,.8);
 return {r:{at:[-.13,.84-.03*Math.max(0,a),.45],w:1},l:{at:[.13,.84-.03*Math.max(0,b),.45],w:1}};
}
// Desk work at a standing desk (keyboard about 0.97 m): typing in runs, the right hand off to the mouse, a look down
// at papers, now and then a stretch of the neck. Matches assets/props desk_pc.
function work(p:Pose,t:number):Gesture{
 alive(p,t,.3);const {k,u}=cycle(t,10),mouse=env(u,4,.4,2.2+rnd(k),.4),papers=env(u,7.5,.5,1.2,.5);
 const tapR=.012*Math.max(0,Math.sin(t*14)),tapL=.012*Math.max(0,Math.sin(t*13+1.7));
 p.spine+=.1;p.head+=.12+.18*papers;p.headYaw+=.25*papers;
 shape(p,1,-.8,1.6);shape(p,0,-.8,1.6);
 // The desk's front edge 0.2 m ahead: the keyboard 0.14 m into it, the mouse to the right (desk_pc anchors).
 const keysR:V3=[-.1,1.0+tapR*(1-mouse),.34],mouseR:V3=[-.3,1.0,.33];
 return {r:{at:mix3(keysR,mouseR,mouse),w:1},l:{at:[.1,1.0+tapL*(1-papers),.34],w:1}};
}
// Serving: a tray carried flat on the left palm at the shoulder; the right hand steadies a glass on it or hands one over.
function serve(p:Pose,t:number):Gesture{
 alive(p,t,.4);const {u}=cycle(t,8),hand=env(u,4,.6,1.0,.6);
 shape(p,0,-.5,1.9);shape(p,1,-.5-.4*hand,1.2);p.headYaw-=.15*hand;
 return {l:{at:[.2,1.2,.2],w:1,pole:[.45,.9,-.2]},r:{at:mix3([-.1,1.05,.18],[-.12,1.2,.45],hand),w:.4+.6*hand},props:{l:'tray'}};
}
// Pressing the club's button: reach, press and hold, look at it.
function clubPress(p:Pose,t:number):Gesture{
 alive(p,t,.2);const press=.02*smooth((t%2)/.3)*(t%2<1.2?1:0);
 p.spine+=.1;p.head+=.15;shape(p,1,-1.1,.5);
 return {r:{at:[-.09,1.2,.5+press],w:1}};
}
// Dancing: a bounce on the beat (125 BPM, the club's music), hips and chest moving against each other, arms pumping
// in turns; every bar or two the arms go up.
function dance(p:Pose,t:number):Gesture{
 const beat=t/.48,b=Math.sin(beat*Math.PI*2),half=Math.sin(beat*Math.PI);
 p.hip-=.03*Math.abs(b);p.pelvisRoll+=.06*half;p.chestRoll-=.08*half;p.pelvisYaw+=.08*Math.sin(beat*Math.PI*.5);p.chestYaw-=.1*Math.sin(beat*Math.PI*.5);
 p.head+=.06*Math.abs(b);p.neck+=.03*b;
 const {k,u}=cycle(t,.48*8),up=(rnd(k)>.6?1:0)*env(u,0,.6,.48*8-1.2,.6);
 shape(p,1,-.9,1.6);shape(p,0,-.9,1.6);
 const r=mix3([-.2,1.15+.12*Math.max(0,b),.25],[-.28,1.82+.05*b,.14],up),l=mix3([.2,1.15+.12*Math.max(0,-b),.25],[.28,1.82-.05*b,.14],up);
 const pr=mix3([-.5,.8,-.1],[-.7,1.6,.1],up),pl=mix3([.5,.8,-.1],[.7,1.6,.1],up);
 return {r:{at:r,w:1,pole:pr},l:{at:l,w:1,pole:pl}};
}
// Receiving a massage (lying face up, see npc-view.ts): arms at rest along the body, slow breathing.
function massage(p:Pose,t:number):Gesture{
 p.chest+=.02*Math.sin(t*.9);p.head+=.1;shape(p,1,.05,.3);shape(p,0,.05,.3);return {};
}

export const GESTURES:Record<string,(p:Pose,t:number)=>Gesture>={
 phone,radio,drink,tasting,chat,talk:chat,speech,camera,photo,tour:(p,t)=>tour(p,t),inspect:(p,t)=>tour(p,t,true),
 cook,clean,mop_floor:mopFloor,massage_work:massageWork,work,serve,club_press:clubPress,dance,massage,
};

// Layer 1 on the pose (the arms' rough shape included); returns the hands for layer 2 (null: no gesture for this action).
export function gesturePose(p:Pose,action:string,time:number):Gesture|null{const f=GESTURES[action];if(!f)return null;const g=f(p,time);
 // As much as the hand is used: an unused hand's hint must not leave its arm raised in the air.
 for(const [side,i] of [['l',0],['r',1]] as const){const h=g[side];if(!h)continue;const w=clamp01(h.w);if(h.swing!==undefined)p.arms[i].swing=mix(p.arms[i].swing,h.swing,w);if(h.elbow!==undefined)p.arms[i].elbow=mix(p.arms[i].elbow,h.elbow,w);}
 return g;}

// Layer 2 after rig.apply(pose): the hands to their targets, and the props into them. `actor` is the object whose
// space the targets are in (the person's own group, feet at its origin, facing +Z).
const v=new T.Vector3(),pv=new T.Vector3();
// Two-bone IK with an elbow direction (the M3 reach() is a free CCD; gestures need the elbow where a person keeps it).
// The shoulder stays; the elbow goes where the upper arm and forearm lengths allow, on the side of `pole`.
const S=new T.Vector3(),E=new T.Vector3(),H=new T.Vector3(),W=new T.Vector3(),D=new T.Vector3(),P=new T.Vector3(),Ed=new T.Vector3(),q=new T.Quaternion(),wq=new T.Quaternion(),pq=new T.Quaternion(),a1=new T.Vector3(),a2=new T.Vector3();
function aim(bone:T.Object3D,from:T.Vector3,to:T.Vector3){if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;q.setFromUnitVectors(a1.copy(from).normalize(),a2.copy(to).normalize());bone.getWorldQuaternion(wq).premultiply(q);bone.parent!.getWorldQuaternion(pq).invert();bone.quaternion.copy(pq.multiply(wq));bone.updateWorldMatrix(true,true);}
export function twoBone(rig:Rig,side:'l'|'r',target:T.Vector3,pole:T.Vector3,weight=1,leg=false){
 const upper=rig.joints.get((leg?'thigh':'upperarm')+side)?.bone,fore=rig.joints.get((leg?'shin':'forearm')+side)?.bone,hand=rig.joints.get((leg?'foot':'hand')+side)?.bone;if(!upper||!fore||!hand)return;
 upper.getWorldPosition(S);fore.getWorldPosition(E);hand.getWorldPosition(H);
 const a=E.distanceTo(S),b=H.distanceTo(E);W.copy(H).lerp(target,clamp01(weight));
 D.copy(W).sub(S);const d=Math.min(Math.max(D.length(),Math.abs(a-b)+1e-4),a+b-1e-4);D.normalize();
 const x=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-x*x));
 P.copy(pole).sub(S);P.addScaledVector(D,-P.dot(D));if(P.lengthSq()<1e-8)P.set(0,-1,0).addScaledVector(D,-D.y);P.normalize();
 Ed.copy(S).addScaledVector(D,x).addScaledVector(P,h);
 aim(upper,E.clone().sub(S),Ed.clone().sub(S));
 fore.getWorldPosition(E);hand.getWorldPosition(H);aim(fore,H.clone().sub(E),W.clone().sub(E));
}
export function applyGesture(rig:Rig,actor:T.Object3D,g:Gesture|null){
 if(!g)return;actor.updateMatrixWorld(true);
 for(const side of ['r','l'] as const){const h=g[side];if(!h||h.w<=0)continue;const out=side==='r'?-1:1;
  const pole=h.pole??[out*.55,.75,-.15];
  twoBone(rig,side,actor.localToWorld(v.set(...h.at)),actor.localToWorld(pv.set(pole[0],pole[1],pole[2])),h.w);}
}

// Props in the hand, kept between frames: one per hand, swapped when the gesture asks for another. A prop follows its
// wrist but is turned in the person's own space (not the hand bone's), so a glass stays upright, a tray flat and a
// phone screen-in whatever the IK did to the wrist. Props are made with the grip at the origin and the long axis on
// +Z (assets/props, assets/items). rot: Euler angles (order YXZ) in the person's space; off: metres from the wrist.
export type PropUse={id:string;rot?:V3;off?:V3};
const UP=-Math.PI/2;
const PROP_POSE:Record<string,{rot:V3;off:V3}>={
 phone:{rot:[UP,-Math.PI/2,0],off:[-.005,.03,.03]},      // standing up along the cheek, the screen toward the face (right hand)
 radio:{rot:[UP,0,0],off:[0,.02,.02]},               // antenna up, the speaker toward the face
 wine_glass:{rot:[UP,0,0],off:[0,.03,.02]},          // upright by the stem
 camera:{rot:[0,0,0],off:[.08,.05,.03]},             // lens forward, between the hands
 tray:{rot:[0,0,0],off:[0,.07,-.12]},                // flat on the palm, reaching forward of it
 kitchen_knife:{rot:[.6,0,0],off:[0,.0,.03]},        // blade forward and down
};
const hp=new T.Vector3(),eu=new T.Euler();
export class GestureProps{
 private held:Partial<Record<'r'|'l',{id:string;object:T.Object3D}>>={};
 update(rig:Rig,actor:T.Object3D,g:Gesture|null){
  for(const side of ['r','l'] as const){const raw=g?.props?.[side],use:PropUse|undefined=typeof raw==='string'?{id:raw}:raw,want=use?.id??'';let have=this.held[side];
   if(have&&have.id!==want){have.object.removeFromParent();delete this.held[side];have=undefined;}
   if(!want)continue;
   if(!have){const o=itemModel(want);if(!o)continue;actor.add(o);have=this.held[side]={id:want,object:o};}
   const hand=rig.joints.get('hand'+side)?.bone;if(!hand){have.object.visible=false;continue;}
   const base=PROP_POSE[want]??{rot:[0,0,0] as V3,off:[0,.03,0] as V3},rot=use!.rot??base.rot,off=use!.off??base.off,m=side==='l'?-1:1;
   actor.updateMatrixWorld(true);actor.worldToLocal(hand.getWorldPosition(hp));
   // A child of the person, so their height scale applies to it as to the hand.
   have.object.visible=true;
   have.object.position.set(hp.x+off[0]*m,hp.y+off[1],hp.z+off[2]);have.object.quaternion.setFromEuler(eu.set(rot[0],rot[1]*m,rot[2]*m,'YXZ'));}
 }
 clear(){for(const h of Object.values(this.held))h?.object.removeFromParent();this.held={};}
}

// Starting, stopping and changing a gesture blend over half a second: someone who stops walking lifts the phone to the
// ear, and puts the glass down before walking off, instead of snapping between poses. One per person (the Animation Lab
// shows gestures at full strength, so it uses gesturePose directly).
type Num=Record<string,unknown>;
function lerpInto(a:Num,b:Num,t:number){for(const k of Object.keys(b)){const x=b[k];if(typeof x==='number')a[k]=(a[k] as number)+(x-(a[k] as number))*t;else if(x&&typeof x==='object')lerpInto(a[k] as Num,x as Num,t);}}
export const GESTURE_BLEND_SECONDS=.5;
export class GesturePlayer{
 private action='';private blend=0;private g:Gesture|null=null;private readonly props=new GestureProps();
 // `p` is the standing/walking pose; it is changed in place by the gesture's share. action: what the person does now
 // (null or unknown: nothing).
 pose(p:Pose,action:string|null|undefined,time:number,dt:number):Gesture|null{
  const want=action&&GESTURES[action]?action:'';
  // A new gesture waits until the old one has faded out.
  if(want!==this.action&&this.blend<=.001)this.action=want;
  const target=this.action&&this.action===want?1:0;
  this.blend+=Math.sign(target-this.blend)*Math.min(Math.abs(target-this.blend),Math.max(0,dt)/GESTURE_BLEND_SECONDS);
  if(!this.action||this.blend<=0){this.g=null;return null;}
  const q=structuredClone(p),g=gesturePose(q,this.action,time)!,b=smooth(this.blend);
  lerpInto(p as unknown as Num,q as unknown as Num,b);
  for(const side of ['r','l'] as const){const h=g[side];if(h)h.w*=b;}
  this.g=g;return g;}
 // After rig.apply(pose): hands to their targets, props in or out of the hands (shown once the gesture is mostly in).
 apply(rig:Rig,actor:T.Object3D){applyGesture(rig,actor,this.g);this.props.update(rig,actor,this.blend>.6?this.g:null);}
 reset(rig:Rig,actor:T.Object3D){this.action='';this.blend=0;this.g=null;this.props.update(rig,actor,null);}
 get current(){return this.blend>0?this.action:'';}
}

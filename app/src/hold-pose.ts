import {HIP_HEIGHT,type Pose} from './locomotion.ts';
// 2026-11-05 (HITMAN WoA carry research, rows 88-99): carrying a thing changes the upper body only. The legs keep
// the walk, run or crouch; the right arm (arms[1], the hand the item rides on) stops swinging freely and holds it.
// Shared by the game (engine/game.ts) and the Animation Lab, so what is checked there is what the game shows.
//  small: one-handed things (spanner, bottle, camera, tray): forearm up, a short swing.
//  long:  long things held low (mop): arm forward and bent, almost no swing, the body leans a touch toward it.
//  hang: carried by a handle, the arm straight down and swinging a little less (a briefcase, 2026-11-06).
export type HoldKind='small'|'long'|'hang';
export const HOLD_KIND:Record<string,HoldKind>={wrench:'small',bottle:'small',camera:'small',tray:'small',coin:'small',hammer:'small',kitchen_knife:'small',frying_pan:'small',brick:'small',mop:'long',crowbar:'long',katana:'hang',briefcase:'hang',toolbox:'hang'};
export const holdKind=(item:string):HoldKind=>HOLD_KIND[item]??'small';
export function holdPose(p:Pose,kind:HoldKind){
 const a=p.arms[1];
 // Crouching brings the hand near the floor: the arm comes up and forward with it (Item Lab 2026-11-05: a mop held the
 // standing way went 61 cm into the floor in a crouch walk).
 const low=Math.min(1,Math.max(0,(HIP_HEIGHT-p.hip)/.4));
 if(kind==='hang'){a.swing*=.6;a.elbow=Math.min(a.elbow,.18);a.shoulder=Math.max(a.shoulder,.1);}
 else if(kind==='small'){a.swing=a.swing*.4-.18-.35*low;a.elbow=Math.max(a.elbow,.75+.55*low);}
 else{a.swing=a.swing*.15-.42-.75*low;a.elbow=Math.max(a.elbow,1.05+.5*low);a.shoulder=Math.max(a.shoulder,.04);p.chestYaw-=.05;}
 return p;
}

// 2026-11-06 (melee.ts): one strike with the thing in hand over the take-down's progress t (0..1), right arm only.
//  blunt: raised high behind the head, brought down hard in front, then back to the carry.
//  blade: drawn back to the hip, then an underhand thrust forward at belly height (the fist grip points the blade
//         forward only while the forearm points down-forward; thrust level, it stood straight up), then back.
//  punch: the fist comes up to the chest, then a straight jab at shoulder height (bare hands, M01/M02).
export function strikePose(p:Pose,kind:'blunt'|'blade'|'punch',t:number){
 const a=p.arms[1],s=(x:number,lo:number,hi:number)=>{const u=Math.min(1,Math.max(0,(x-lo)/(hi-lo)));return u*u*(3-2*u);};
 const wind=s(t,0,.4),hit=s(t,.4,.58),back=s(t,.72,1),k=1-back;
 if(kind==='blunt'){a.swing+=(-2.7*wind+2.2*hit)*k;a.elbow+=(1.3*wind-1.15*hit)*k;a.shoulder+=.25*wind*k;p.chestYaw+=(.28*wind-.45*hit)*k;p.spine+=.18*hit*k;}
 else if(kind==='punch'){a.swing+=(-.35*wind-1.2*hit)*k;a.elbow+=(1.8*wind-1.9*hit)*k;p.chestYaw+=(.25*wind-.5*hit)*k;p.spine+=.1*hit*k;}
 else{a.swing+=(.45*wind-.8*hit)*k;a.elbow+=(.6*wind-1.25*hit)*k;p.chestYaw+=(.2*wind-.4*hit)*k;p.spine+=.12*hit*k;}
 a.elbow=Math.max(0,a.elbow);return p;}

// How the hand closes on it (Item Lab 2026-11-05: with the handle laid along the fingers, a spanner or a hammer pointed
// along the forearm instead of out of the fist).
//  fist:  the handle runs across the fist and the working end comes out on the thumb side (forward with the arm down).
//  along: the thing hangs on from the fingers (a bottle by the neck, a tray by its edge).
export type Grip='fist'|'along';
// A mop is carried upright in the fist (head up); laid along the fingers it crossed the body (Item Lab).
// A sword hangs point-down along the arm (2026-11-06).
export const GRIP:Record<string,Grip>={bottle:'along',tray:'along',katana:'along'};
export const gripOf=(item:string):Grip=>GRIP[item]??'fist';

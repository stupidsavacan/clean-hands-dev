// 2026-11-09: the ladder as one motion for every map, like aiming or running. It knows only the ladder itself
// (rungs RUNG apart, the floor below at 0 and the landing at `height`), never which map or which ladder it is on.
// Everything here is in the ladder's own frame: x to the climber's left, y up from the floor below, z toward the
// rungs from where the climber hangs (the rungs are LADDER.standoff in front). The traversal places it in the world.
export const LADDER={
 rung:.3,standoff:.35,halfWidth:.3,
 // The rails stand this far above the landing so there is something to hold while stepping off.
 above:1.3,
 climbSpeed:1.1,
 // Stepping on at the bottom / off at the bottom, and off at the top / on at the top (seconds).
 bottom:1.1,top:1.5,
 // How far from the ladder the climber steps while still holding it, at the bottom and at the top (metres).
 bottomStep:.3,topStep:.7,
 lean:.06,
};
export type LadderMove='mount'|'climb'|'descend'|'exit-top'|'mount-top'|'exit-bottom';
export const LADDER_MOVES:LadderMove[]=['mount','climb','descend','exit-top','mount-top','exit-bottom'];
type Side=1|-1;
export type LadderPoint={x:number;y:number;z:number};
export type LadderPose={
 // Feet level above the floor below, and how far the body has stepped off along the floor (metres).
 y:number;away:number;
 // 0 facing the rungs, 1 facing the way the climber walks on (or came from, before getting on).
 turn:number;
 // The climbing layer as a whole (body pose, lean), the hands and the feet.
 weight:number;hands:number;feet:number;
 hand:(side:Side)=>LadderPoint;foot:(side:Side)=>LadderPoint;
};

const clamp=(t:number)=>Math.min(1,Math.max(0,t));
const ease=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const frac=(t:number)=>t-Math.floor(t);

// One limb climbs two rungs in its half of a cycle and holds for the other half; a cycle lifts the body two rungs.
// Left hand with right foot, then right hand with left foot (the usual diagonal ladder gait).
function limb(cycle:number,shift:number){
 const own=cycle-shift,move=clamp(frac(own)*2);
 return {rungs:2*(Math.floor(own)+ease(move)),lift:frac(own)<.5?Math.sin(Math.PI*move):0};
}
const HANDS={l:{shift:0,base:5},r:{shift:.5,base:6}},FEET={l:{shift:.5,base:1},r:{shift:0,base:0}};

/** Hands and feet on the rungs with the feet `y` above the floor below, on a ladder rising `height` to the landing. */
export function ladderClimb(y:number,height:number):LadderPose{
 const {rung,standoff,halfWidth,above}=LADDER,cycle=y/(2*rung),top=Math.floor((height+above)/rung+1e-6);
 const at=(table:typeof HANDS,side:Side)=>{const {shift,base}=table[side===1?'l':'r'],l=limb(cycle,shift);return {index:Math.min(top,Math.max(0,base+l.rungs)),lift:l.lift};};
 return {y,away:0,turn:0,weight:1,hands:1,feet:1,
  hand:side=>{const {index,lift}=at(HANDS,side);return {x:side*(halfWidth-.08),y:index*rung,z:standoff-.12*lift};},
  // The ball of the foot on the rung: the ankle a little above it and behind it.
  foot:side=>{const {index,lift}=at(FEET,side);return {x:side*.12,y:index*rung+.07,z:standoff-.1-.08*lift};},
 };
}

/** Stepping off at the top: the climber holds the rail tops, steps back onto the landing, lets go and turns away. */
export function ladderExitTop(u:number,height:number,step=LADDER.topStep):LadderPose{
 const from=ladderClimb(height,height),{standoff,halfWidth}=LADDER,rail=(side:Side)=>({x:side*halfWidth,y:height+1.05,z:standoff});
 const grab=ease(u/.25);
 return {y:height,away:step*ease((u-.2)/.55),turn:ease((u-.55)/.45),
  weight:1-ease((u-.3)/.55),hands:1-ease((u-.25)/.2),feet:1-ease(u/.35),
  hand:side=>{const a=from.hand(side),b=rail(side);return {x:mix(a.x,b.x,grab),y:mix(a.y,b.y,grab),z:mix(a.z,b.z,grab)};},
  foot:from.foot,
 };
}

/** Stepping off at the bottom: the upper foot comes down, the hands let go and the climber turns away. */
export function ladderExitBottom(u:number,step=LADDER.bottomStep):LadderPose{
 const from=ladderClimb(0,Infinity);
 return {y:0,away:step*ease((u-.3)/.5),turn:ease((u-.42)/.58),
  weight:1-ease((u-.2)/.6),hands:1-ease((u-.2)/.4),feet:1-ease(u/.4),hand:from.hand,foot:from.foot};
}

/** One generic move at time u (0..1) of its own length; `climb` and `descend` cover two rungs of an endless ladder. */
export function sampleLadderMove(move:LadderMove,u:number,height=6):LadderPose{
 u=clamp(u);
 switch(move){
  case 'climb':return ladderClimb(1.2+2*LADDER.rung*u,height);
  case 'descend':return ladderClimb(1.2+2*LADDER.rung*(1-u),height);
  case 'exit-top':return ladderExitTop(u,height);
  case 'mount-top':return ladderExitTop(1-u,height);
  case 'exit-bottom':return ladderExitBottom(u);
  case 'mount':return ladderExitBottom(1-u);
 }
}

/** Seconds of each move as the game plays it (the loops: two rungs). */
export function ladderMoveSeconds(move:LadderMove){
 return move==='climb'||move==='descend'?2*LADDER.rung/LADDER.climbSpeed:move.endsWith('top')?LADDER.top:LADDER.bottom;
}

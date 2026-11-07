import type {Pose} from './locomotion.ts';
import {gesturePose} from './gestures.ts';
// 2026-11-05: the scheduled gestures were rebuilt in gestures.ts (body plus hands reaching their targets, with props).
// This keeps the old call for code that only poses the body (the old hotel and party copies' player, the motion
// gallery): it gets the body layer and the arms' rough shape, without the hand IK.
export function schedulePose(p:Pose,action:string,time:number){gesturePose(p,action,time);return p;}

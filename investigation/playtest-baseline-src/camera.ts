// View modes and the camera-relative movement basis. Yaw follows the heading convention atan2(x, z); pitch + looks down.
export type ViewMode='third'|'first'|'overhead';
export const VIEW_ORDER:ViewMode[]=['third','first','overhead'];
export const VIEW_LABEL:Record<ViewMode,string>={third:'三人称',first:'一人称（実験）',overhead:'俯瞰（旧）'};
export const THIRD_DISTANCE=[4.8,3.4,2.3],SHOULDER=.42;
export const PITCH_LIMIT:Record<ViewMode,[number,number]>={third:[-.85,1.1],first:[-1.35,1.35],overhead:[0,0]};
export function lookDirection(yaw:number,pitch:number){return {x:Math.sin(yaw)*Math.cos(pitch),y:-Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};}
export function cameraRight(yaw:number){return {x:-Math.cos(yaw),z:Math.sin(yaw)};}
// W/S move along the camera's ground-projected forward, A/D along its right; diagonals keep unit length.
export function cameraMovement(x:number,up:number,yaw:number){const len=Math.hypot(x,up);if(!len)return {x:0,z:0};const r=cameraRight(yaw);return {x:(Math.sin(yaw)*up+r.x*x)/len,z:(Math.cos(yaw)*up+r.z*x)/len};}

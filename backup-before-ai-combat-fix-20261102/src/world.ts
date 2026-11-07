export type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
export type Block={id:string;x:number;z:number;w:number;d:number;y:number;h:number;floor?:number};
export type Position={x:number;y:number;z:number};
// sections: the map's areas (about 22 in the full hotel). Rendering and long path searches work per section.
export type Section=Rect&{id:string;label:string;outdoor?:boolean};
// A floor plate above or below the ground (2F, RF, B1): where it can be walked at height y.
export type Plate={floor:number;y:number;areas:Rect[]};
// A flight of stairs is a ramp from `low` to `high`; `rise` is the direction walked to go up.
export type Stair=Rect&{id:string;low:number;high:number;rise:'+x'|'-x'|'+z'|'-z';floor?:number};
export type Level={spawn:{x:number;z:number};ground:Rect;floors:Plate[];stairs:Stair[];walls:Block[];blockers:Block[];sections?:Section[]};
export const RADIUS=.27,HEIGHT=1.8;
export function inside(r:Rect,x:number,z:number,margin=0){return x>=r.minX+margin&&x<=r.maxX-margin&&z>=r.minZ+margin&&z<=r.maxZ-margin;}
export function bounds(b:Block):Rect{return {minX:b.x-b.w/2,maxX:b.x+b.w/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2};}
export class CollisionWorld{
 readonly level:Level;readonly grid=new Map<string,Block[]>();readonly cells=2;
 constructor(level:Level){this.level=level;for(const b of [...level.walls,...level.blockers]){const r=bounds(b);for(let x=Math.floor(r.minX/2);x<=Math.floor(r.maxX/2);x++)for(let z=Math.floor(r.minZ/2);z<=Math.floor(r.maxZ/2);z++){const k=`${x},${z}`;const a=this.grid.get(k)||[];a.push(b);this.grid.set(k,a);}}}
 nearby(x:number,z:number){const out=new Set<Block>();for(let a=Math.floor((x-RADIUS)/2);a<=Math.floor((x+RADIUS)/2);a++)for(let b=Math.floor((z-RADIUS)/2);b<=Math.floor((z+RADIUS)/2);b++)for(const block of this.grid.get(`${a},${b}`)||[])out.add(block);return out;}
 surface(x:number,z:number,oldY:number):number|null{
  if(!inside(this.level.ground,x,z,RADIUS))return null;
  const y=surfaces(this.level,x,z).reduce((m,v)=>Math.abs(v-oldY)<Math.abs(m-oldY)?v:m);
  if(Math.abs(y-oldY)>.3)return null;
  return y;
 }
 blocked(x:number,y:number,z:number,height=HEIGHT){for(const b of this.nearby(x,z)){const r=bounds(b),dx=x-Math.max(r.minX,Math.min(r.maxX,x)),dz=z-Math.max(r.minZ,Math.min(r.maxZ,z));const bottom=y+RADIUS,top=y+height-RADIUS,dy=top<b.y?b.y-top:bottom>b.y+b.h?bottom-b.y-b.h:0;if(dx*dx+dy*dy+dz*dz<RADIUS*RADIUS-1e-9)return true;}return false;}
 move(p:Position,dx:number,dz:number,height=HEIGHT):Position{
  const q={...p},steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.09));
  const attempt=(x:number,z:number)=>{const y=this.surface(x,z,q.y);if(y===null||this.blocked(x,y,z,height))return false;q.x=x;q.y=y;q.z=z;return true;};
  for(let i=0;i<steps;i++){const x=dx/steps,z=dz/steps;if(!attempt(q.x+x,q.z+z)){attempt(q.x+x,q.z);attempt(q.x,q.z+z);}}
  return q;
 }
}
// Floors by index: -1 B1, 0 1F (outdoors counts as 1F), 1 2F, 2 RF, each FLOOR_HEIGHT apart.
export const FLOOR_HEIGHT=3.5,LOWEST_FLOOR=-1,HIGHEST_FLOOR=2;
export function floorLabel(floor:number){return floor<0?`B${-floor}`:floor===HIGHEST_FLOOR?'RF':`${floor+1}F`;}
// Hysteresis: climb at 1.8 m above a floor, drop 1.95 m below the floor itself, so the stairs do not flicker.
export function floorAt(y:number,previous:number){let f=previous;while(f<HIGHEST_FLOOR&&y>=f*FLOOR_HEIGHT+1.8)f++;while(f>LOWEST_FLOOR&&y<f*FLOOR_HEIGHT-1.95)f--;return f;}
// Floor of someone standing at height y, without history (NPCs, bodies).
export function floorOf(y:number){return Math.max(LOWEST_FLOOR,Math.min(HIGHEST_FLOOR,Math.floor((y+1.75)/FLOOR_HEIGHT)));}
export function stairProgress(s:Stair,x:number,z:number){const t=s.rise==='-z'?(s.maxZ-z)/(s.maxZ-s.minZ):s.rise==='+z'?(z-s.minZ)/(s.maxZ-s.minZ):s.rise==='-x'?(s.maxX-x)/(s.maxX-s.minX):(x-s.minX)/(s.maxX-s.minX);return Math.max(0,Math.min(1,t));}
export function stairY(s:Stair,x:number,z:number){return s.low+(s.high-s.low)*stairProgress(s,x,z);}
// Walkable heights at a point: stair ramps, the ground and every floor plate over it. A flight replaces the floors it joins
// (that is its stairwell), but a floor above or below it stays walkable, so stairs can be stacked over a lobby.
export function surfaces(level:Level,x:number,z:number){const out:number[]=[],flights=level.stairs.filter(s=>inside(s,x,z));for(const s of flights)out.push(stairY(s,x,z));
 const open=(y:number)=>!flights.some(s=>y>=s.low-1e-6&&y<=s.high+1e-6);if(open(0))out.push(0);for(const f of level.floors)if(open(f.y)&&f.areas.some(a=>inside(a,x,z)))out.push(f.y);return out;}
export function plateY(level:Level,floor:number){return floor?level.floors.find(f=>f.floor===floor)?.y??floor*FLOOR_HEIGHT:0;}
export function sectionAt(sections:Section[]|undefined,x:number,z:number){return sections?.findIndex(s=>inside(s,x,z))??-1;}
export function screenMovement(x:number,up:number){const len=Math.hypot(x,up);if(!len)return {x:0,z:0};return {x:(x-up)/len*Math.SQRT1_2,z:(-x-up)/len*Math.SQRT1_2};}

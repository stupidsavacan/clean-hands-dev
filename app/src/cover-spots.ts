import {segmentClear,type Aabb} from './sight.ts';
import type {NavGrid} from './nav.ts';
import {floorOf,type Block,type CollisionWorld,type Level,type Position} from './world.ts';
/** Guard AI stage 1 (2026-11-13, investigation/guard-ai-policy-20261113.md): where a guard in a gunfight can hide.
 * Made once from the map, as in HITMAN, where guards hide behind what the level already has:
 *  - 'low': beside a waist- to chest-high solid (a crate, a counter, a car). The guard kneels there and rises to shoot over it.
 *  - 'edge': beside the end of a wall or a tall solid. The guard stands there and steps out past the end to shoot.
 * Whether a spot hides the guard from the agent, and whether the agent can be shot from it, depends on where the agent
 * is, so that is checked during the fight (hiddenFrom, shootsFrom), with the same sight boxes as everything else. */
export type CoverSpot={id:number;kind:'low'|'edge';x:number;y:number;z:number;floor:number;block:string;
 // Unit vector from the spot toward the solid that covers it.
 nx:number;nz:number;
 // Where the guard shoots from: the spot itself for 'low', a step out past the end for 'edge'.
 peek:Position};
export type CoverRules={
 // Heights (m) of a solid that gives low cover, and from which a solid is tall enough to stand behind.
 lowMin:number;lowMax:number;tallMin:number;
 // Low cover wider or deeper than this (a stage, a pool) is not furniture to crouch behind.
 maxSize:number;
 // Distance of a spot from the face, spacing of the spots along a face, and how far past a wall end the guard steps.
 gap:number;spacing:number;stepOut:number;
};
export const COVER_DEFAULTS:CoverRules={lowMin:.7,lowMax:1.6,tallMin:1.8,maxSize:12,gap:.55,spacing:1.2,stepOut:.55};
// Body points (m above the floor) tested for each way of standing: kneeling behind low cover, standing.
// Kneeling uses the agent's own crouched points (ai.ts perceive), standing the agent's standing ones.
export const BODY:Record<'kneel'|'stand',number[]>={kneel:[1.05,.78,.5],stand:[1.55,1.15,.82]};

const lowCover=(b:Block,r:CoverRules)=>b.h>=r.lowMin&&b.h<=r.lowMax&&b.w<r.maxSize&&b.d<r.maxSize&&!b.id.startsWith('water')&&b.id!=='pool';
const tall=(b:Block,r:CoverRules)=>b.h>=r.tallMin;

export function buildCoverSpots(level:Level,world:CollisionWorld,nav:NavGrid,rules:Partial<CoverRules>={}):CoverSpot[]{
 const r={...COVER_DEFAULTS,...rules},out:CoverSpot[]=[];
 const add=(kind:CoverSpot['kind'],b:Block,x:number,z:number,nx:number,nz:number,peek?:{x:number;z:number})=>{
  const floor=b.floor??0,base={x,y:b.y,z},i=nav.nearest(base);if(i<0)return;const node=nav.nodes[i];
  if(Math.hypot(node.x-x,node.z-z)>.35||floorOf(node.y)!==floor)return;
  const at={x,y:node.y,z},to=peek?{x:peek.x,y:node.y,z:peek.z}:at;
  if(world.blocked(at.x,at.y,at.z)||peek&&(world.blocked(to.x,to.y,to.z)||!nav.clear(at,to)))return;
  if(out.some(s=>s.floor===floor&&Math.hypot(s.x-x,s.z-z)<.5))return;
  out.push({id:out.length,kind,x,y:node.y,z,floor,block:b.id,nx,nz,peek:to});};
 // Each face of an axis-aligned box: its outward normal, half extents along the normal and along the face.
 const faces=(b:Block)=>[[1,0,b.w/2,b.d/2],[-1,0,b.w/2,b.d/2],[0,1,b.d/2,b.w/2],[0,-1,b.d/2,b.w/2]] as const;
 for(const b of level.blockers)if(lowCover(b,r))for(const [nx,nz,hn,ht] of faces(b)){
  const tx=-nz,tz=nx,count=Math.max(1,Math.round(2*ht/r.spacing));
  for(let k=0;k<count;k++){const s=-ht+(k+.5)*2*ht/count;add('low',b,b.x+nx*(hn+r.gap)+tx*s,b.z+nz*(hn+r.gap)+tz*s,-nx,-nz);}}
 for(const b of [...level.walls,...level.blockers.filter(b=>tall(b,r))])for(const [nx,nz,hn,ht] of faces(b)){
  // Only along faces long enough to stand beside (not the 20 cm end of a wall), at both ends.
  if(2*ht<.6)continue;const tx=-nz,tz=nx;
  for(const end of [1,-1]){const cx=b.x+nx*(hn+r.gap)+tx*ht*end,cz=b.z+nz*(hn+r.gap)+tz*ht*end;
   add('edge',b,cx-tx*end*.35,cz-tz*end*.35,-nx,-nz,{x:cx+tx*end*r.stepOut,z:cz+tz*end*r.stepOut});}}
 return out;
}
/** A line from the agent's eyes to the guard's body at the spot is blocked at every tested point. */
export function hiddenFrom(spot:CoverSpot,threat:Position,crouched:boolean,boxes:Aabb[]){
 const eye={x:threat.x,y:threat.y+(crouched?1.05:1.55),z:threat.z};
 return BODY[spot.kind==='low'?'kneel':'stand'].every(h=>!segmentClear(boxes,eye,{x:spot.x,y:spot.y+h,z:spot.z}));
}
/** From where the guard shoots (standing up behind low cover, or stepped out past the end), some of the agent is in view. */
export function shootsFrom(spot:CoverSpot,threat:Position,crouched:boolean,boxes:Aabb[],eye:number){
 const from={x:spot.peek.x,y:spot.peek.y+eye,z:spot.peek.z};
 return BODY[crouched?'kneel':'stand'].some(h=>segmentClear(boxes,from,{x:threat.x,y:threat.y+h,z:threat.z}));
}

import type { Level } from './world.ts';
export type Aabb={minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number};
export type Vec={x:number;y:number;z:number};
const HEDGE=.65,STAIR_SLICES=16,CELL=4;
// Pool and sea colliders are only fences for walking, so they do not block a view.
export const seeThrough=(id:string)=>id.startsWith('pool')||id.startsWith('water');
// The club renders only the top bar of a railing. Walking still uses the full height.
export function visibleWall<T extends {id:string;y:number;h:number}>(wall:T):T{
 if(!wall.id.startsWith('rail-'))return wall;
 const h=wall.h*.05;
 return {...wall,y:wall.y+wall.h-h/2,h};
}
// Solid volumes that block a line of sight.
export function sightBoxes(level:Level):Aabb[]{
 const out:Aabb[]=[],add=(b:{x:number;z:number;w:number;d:number;y:number;h:number})=>out.push({minX:b.x-b.w/2,maxX:b.x+b.w/2,minY:b.y,maxY:b.y+b.h,minZ:b.z-b.d/2,maxZ:b.z+b.d/2});
 for(const w of level.walls)add(visibleWall(w));
 for(const b of level.blockers)if(!seeThrough(b.id))add(b.id.startsWith('planter')?{...b,h:b.h+HEDGE}:b);
 // Floor plates: an upper floor is a slab under its own level; a basement is roofed by the ground slab.
 for(const f of level.floors){const top=f.y>0?f.y:0;for(const r of f.areas)out.push({minX:r.minX,maxX:r.maxX,minY:top-.5,maxY:top,minZ:r.minZ,maxZ:r.maxZ});}
 // A flight is solid underneath; slices sit half a step below the treads so a view along the steps is not clipped.
 for(const s of level.stairs){const along=s.rise==='-z'||s.rise==='+z',len=(along?s.maxZ-s.minZ:s.maxX-s.minX)/STAIR_SLICES;
  for(let i=0;i<STAIR_SLICES;i++){const maxY=s.low+(i+.5)*(s.high-s.low)/STAIR_SLICES;
   const box={minX:s.minX,maxX:s.maxX,minY:s.low,maxY,minZ:s.minZ,maxZ:s.maxZ};
   if(s.rise==='-z'){box.maxZ=s.maxZ-i*len;box.minZ=box.maxZ-len;}else if(s.rise==='+z'){box.minZ=s.minZ+i*len;box.maxZ=box.minZ+len;}
   else if(s.rise==='-x'){box.maxX=s.maxX-i*len;box.minX=box.maxX-len;}else{box.minX=s.minX+i*len;box.maxX=box.minX+len;}
   out.push(box);}}
 return out;
}
// A coarse grid over the boxes so a ray only tests what lies under it. Rebuilt when boxes are added (tests push extra walls).
type Indexed=Aabb[]&{index?:{count:number;cells:Map<number,number[]>}};
export function invalidateSight(boxes:Indexed){delete boxes.index;}
const key=(x:number,z:number)=>(x+4096)*8192+(z+4096);
function index(boxes:Indexed){if(boxes.index?.count===boxes.length)return boxes.index.cells;const cells=new Map<number,number[]>();
 boxes.forEach((b,i)=>{for(let x=Math.floor(b.minX/CELL);x<=Math.floor(b.maxX/CELL);x++)for(let z=Math.floor(b.minZ/CELL);z<=Math.floor(b.maxZ/CELL);z++){const k=key(x,z),l=cells.get(k);if(l)l.push(i);else cells.set(k,[i]);}});
 Object.defineProperty(boxes,'index',{value:{count:boxes.length,cells},configurable:true,enumerable:false});return cells;}
let stamp=0;const seen=new Uint32Array(1<<16);
// Slab test of the open segment a→b against the boxes it passes over.
export function segmentClear(boxes:Aabb[],a:Vec,b:Vec){
 const cells=index(boxes as Indexed),dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;stamp=(stamp+1)>>>0||1;
 const x0=Math.floor(Math.min(a.x,b.x)/CELL),x1=Math.floor(Math.max(a.x,b.x)/CELL),z0=Math.floor(Math.min(a.z,b.z)/CELL),z1=Math.floor(Math.max(a.z,b.z)/CELL);
 for(let cx=x0;cx<=x1;cx++)for(let cz=z0;cz<=z1;cz++)for(const i of cells.get(key(cx,cz))??[]){const slot=i&0xffff;if(seen[slot]===stamp)continue;seen[slot]=stamp;const box=boxes[i];let t0=1e-4,t1=1-1e-4,hit=true;
  for(const [o,d,lo,hi] of [[a.x,dx,box.minX,box.maxX],[a.y,dy,box.minY,box.maxY],[a.z,dz,box.minZ,box.maxZ]]){
   if(Math.abs(d)<1e-12){if(o<lo||o>hi){hit=false;break;}continue;}
   let u=(lo-o)/d,v=(hi-o)/d;if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1){hit=false;break;}}
  if(hit)return false;}
 return true;
}

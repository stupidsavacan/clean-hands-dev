import {bounds,type Block,type Rect,type Stair,type Plate,type Position} from './world.ts';
import type {Traversal} from './party/traversal.ts';

type Room=Rect&{id:string;label:string;floor:number};
type Shaft=Rect&{floor:number};
export type MapLayout={
 name:string;ground:Rect;spawn:{x:number;z:number};
 rooms:Room[];walls:Block[];furniture:Block[];stairs:Stair[];platforms?:Array<Rect&{y:number}>;
 traversals:Traversal[];
 geometry:{floors:Array<Pick<Plate,'floor'|'y'>>;shafts:Shaft[];collisionOnlyPrefixes?:string[]};
};

const rect=(minX:number,maxX:number,minZ:number,maxZ:number):Rect=>({minX,maxX,minZ,maxZ});
function cut(rectangle:Rect,holes:Rect[]){
 let parts=[rectangle];
 for(const h of holes)parts=parts.flatMap(p=>{
  if(h.minX>=p.maxX||h.maxX<=p.minX||h.minZ>=p.maxZ||h.maxZ<=p.minZ)return [p];
  const z0=Math.max(p.minZ,h.minZ),z1=Math.min(p.maxZ,h.maxZ);
  const out:Rect[]=[];
  if(h.minZ>p.minZ)out.push({...p,maxZ:h.minZ});
  if(h.maxZ<p.maxZ)out.push({...p,minZ:h.maxZ});
  if(h.minX>p.minX)out.push(rect(p.minX,h.minX,z0,z1));
  if(h.maxX<p.maxX)out.push(rect(h.maxX,p.maxX,z0,z1));
  return out;
 });
 return parts;
}

type Hole=Rect&{minY:number;maxY:number};
function subtract(b:Block,h:Hole){
 const {minX,maxX,minZ,maxZ}=bounds(b),top=b.y+b.h;
 const x0=Math.max(minX,h.minX),x1=Math.min(maxX,h.maxX),z0=Math.max(minZ,h.minZ),z1=Math.min(maxZ,h.maxZ);
 const y0=Math.max(b.y,h.minY),y1=Math.min(top,h.maxY);
 if(x0>=x1||z0>=z1||y0>=y1)return [b];
 const out:Block[]=[];
 const add=(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number)=>{
  if(Math.min(x1-x0,y1-y0,z1-z0)>.001)out.push({...b,id:b.id+'-'+out.length,x:(x0+x1)/2,z:(z0+z1)/2,y:y0,w:x1-x0,d:z1-z0,h:y1-y0});
 };
 add(minX,x0,b.y,top,minZ,maxZ);add(x1,maxX,b.y,top,minZ,maxZ);
 add(x0,x1,b.y,y0,minZ,maxZ);add(x0,x1,y1,top,minZ,maxZ);
 add(x0,x1,y0,y1,minZ,z0);add(x0,x1,y0,y1,z1,maxZ);
 return out;
}

export function compileMapGeometry({rooms,stairs,geometry,walls:sourceWalls,furniture,platforms=[]}:MapLayout){
 const stairHoles=stairs.map(s=>({...rect(s.minX-.05,s.maxX+.05,s.minZ-.05,s.maxZ+.05),minY:s.low,maxY:s.high+2}));
 let walls=sourceWalls;
 for(const hole of stairHoles)walls=walls.flatMap(w=>subtract(w,hole));
 const blockers=[...furniture];
 for(const s of stairs){
  const alongX=s.rise.endsWith('x'),len=(alongX?s.maxX-s.minX:s.maxZ-s.minZ)/16;
  for(let i=0;i<16;i++)for(const side of [-1,1]){
   const low=s.rise.startsWith('+')?(i+1)/16:1-i/16;
   const cross=alongX?(side<0?s.minZ-.12:s.maxZ+.12):(side<0?s.minX-.12:s.maxX+.12);
   const along=(alongX?s.minX:s.minZ)+(i+.5)*len;
   blockers.push({id:'stair-cheek-'+s.id+'-'+i+'-'+side,x:alongX?along:cross,z:alongX?cross:along,y:s.low,
    w:alongX?len:.14,d:alongX?.14:len,h:(s.high-s.low)*low+1,floor:s.floor??0});
  }
 }
 const isStair=(r:Room)=>stairs.some(s=>s.id===r.id);
 const cuts=(y:number)=>stairs.filter(s=>s.low<y&&y<=s.high);
 const floors:Plate[]=[
  ...geometry.floors.map(({floor,y})=>({floor,y,areas:rooms.filter(r=>r.floor===floor&&!isStair(r))
   .flatMap(r=>cut(r,[...cuts(y),...geometry.shafts.filter(s=>s.floor===floor)]))})),
  ...platforms.map(p=>({floor:0,y:p.y,ground:true,areas:[rect(p.minX,p.maxX,p.minZ,p.maxZ)]})),
 ];
 const zones=rooms.flatMap(r=>isStair(r)?[r]:cut(r,r.floor===0?stairs:cuts(geometry.floors.find(f=>f.floor===r.floor)?.y??0)).map(p=>({...r,...p})));
 const collisionOnlyIds=walls.filter(w=>geometry.collisionOnlyPrefixes?.some(prefix=>w.id.startsWith(prefix))).map(w=>w.id);
 return {walls,blockers,floors,zones,traversalShafts:geometry.shafts,collisionOnlyIds};
}

export function assertMapLayout(value:unknown):asserts value is MapLayout{
 if(!value||typeof value!=='object')throw new Error('マップをJSONオブジェクトで指定してください');
 const m=value as Partial<MapLayout>;
 const finite=(...nums:unknown[])=>nums.every(n=>typeof n==='number'&&Number.isFinite(n));
 const validRect=(r:Rect)=>r&&finite(r.minX,r.maxX,r.minZ,r.maxZ)&&r.minX<r.maxX&&r.minZ<r.maxZ;
 const validPoint=(p:Position)=>p&&finite(p.x,p.y,p.z);
 if(typeof m.name!=='string'||!m.ground||!validRect(m.ground)||!m.spawn||!finite(m.spawn.x,m.spawn.z))throw new Error('name・ground・spawn を確認してください');
 if(!m.geometry||!Array.isArray(m.geometry.floors)||!Array.isArray(m.geometry.shafts)||
  !m.geometry.floors.every(f=>f&&finite(f.floor,f.y))||!m.geometry.shafts.every(s=>validRect(s)&&finite(s.floor))||
  (m.geometry.collisionOnlyPrefixes!==undefined&&(!Array.isArray(m.geometry.collisionOnlyPrefixes)||!m.geometry.collisionOnlyPrefixes.every(p=>typeof p==='string'))))
  throw new Error('geometry の階層・吹き抜けを確認してください');
 for(const key of ['rooms','walls','furniture','stairs','traversals'] as const)if(!Array.isArray(m[key]))throw new Error(key+' は配列で指定してください');
 if(!m.rooms!.every(r=>validRect(r)&&typeof r.id==='string'&&finite(r.floor))||
  ![...m.walls!,...m.furniture!].every(b=>b&&typeof b.id==='string'&&finite(b.x,b.y,b.z,b.w,b.d,b.h)&&Math.min(b.w,b.d,b.h)>0)||
  !m.stairs!.every(s=>validRect(s)&&finite(s.low,s.high)&&s.low<s.high&&['+x','-x','+z','-z'].includes(s.rise))||
  !m.traversals!.every(t=>t&&typeof t.id==='string'&&validPoint(t.start)&&validPoint(t.end)&&(t.kind==='ladder'||t.kind==='drainpipe'?t.seconds===undefined||finite(t.seconds):finite(t.seconds)&&t.seconds!>0)&&(t.facing===undefined||finite(t.facing))&&
   (t.via===undefined||Array.isArray(t.via)&&t.via.every(validPoint)))||
  (m.platforms!==undefined&&(!Array.isArray(m.platforms)||!m.platforms.every(p=>validRect(p)&&finite(p.y)))))
  throw new Error('区画・壁・家具・階段・経路に不正な座標や寸法があります');
}

// Party-only geometry compiler. Runtime collision, sight and rendering share these cut solids.
import {readFileSync,writeFileSync} from 'node:fs';
type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
const read=(n:string)=>JSON.parse(readFileSync(new URL('../src/data/'+n,import.meta.url),'utf8'));
const write=(n:string,v:unknown)=>writeFileSync(new URL('../src/data/'+n,import.meta.url),JSON.stringify(v,null,1)+'\n');
const spec=read('club-layout.json'),hotel=read('hotel.json');
const cut=(r:Rect,holes:Rect[])=>{let parts=[r];for(const h of holes)parts=parts.flatMap(p=>{if(h.minX>=p.maxX||h.maxX<=p.minX||h.minZ>=p.maxZ||h.maxZ<=p.minZ)return [p];const z0=Math.max(p.minZ,h.minZ),z1=Math.min(p.maxZ,h.maxZ);return [h.minZ>p.minZ?{...p,maxZ:h.minZ}:null,h.maxZ<p.maxZ?{...p,minZ:h.maxZ}:null,h.minX>p.minX?{minX:p.minX,maxX:h.minX,minZ:z0,maxZ:z1}:null,h.maxX<p.maxX?{minX:h.maxX,maxX:p.maxX,minZ:z0,maxZ:z1}:null].filter(Boolean) as Rect[];});return parts;};
// Subtract a 3D opening from a wall, preserving the sill and lintel as real colliders.
function subtract(b:any,h:any){const lo={x:b.x-b.w/2,y:b.y,z:b.z-b.d/2},hi={x:b.x+b.w/2,y:b.y+b.h,z:b.z+b.d/2};const a={x:Math.max(lo.x,h.minX),y:Math.max(lo.y,h.minY),z:Math.max(lo.z,h.minZ)},c={x:Math.min(hi.x,h.maxX),y:Math.min(hi.y,h.maxY),z:Math.min(hi.z,h.maxZ)};if(a.x>=c.x||a.y>=c.y||a.z>=c.z)return [b];const parts:any[]=[];const add=(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number)=>{if(Math.min(x1-x0,y1-y0,z1-z0)>.001)parts.push({...b,id:b.id+'-'+parts.length,x:(x0+x1)/2,z:(z0+z1)/2,y:y0,w:x1-x0,h:y1-y0,d:z1-z0});};add(lo.x,a.x,lo.y,hi.y,lo.z,hi.z);add(c.x,hi.x,lo.y,hi.y,lo.z,hi.z);add(a.x,c.x,lo.y,a.y,lo.z,hi.z);add(a.x,c.x,c.y,hi.y,lo.z,hi.z);add(a.x,c.x,a.y,c.y,lo.z,a.z);add(a.x,c.x,a.y,c.y,c.z,hi.z);return parts;}
const holes:any[]=spec.stairs.map((s:any)=>({...s,minX:s.minX-.05,maxX:s.maxX+.05,minZ:s.minZ-.05,maxZ:s.maxZ+.05,minY:s.low,maxY:s.high+2}));
let walls=spec.walls;for(const h of holes)walls=walls.flatMap((b:any)=>subtract(b,h));
const blockers=[...spec.furniture];
for(const s of spec.stairs){const count=16,len=(s.maxZ-s.minZ)/count;for(let i=0;i<count;i++)for(const side of [-1,1])blockers.push({id:`stair-cheek-${s.id}-${i}-${side}`,x:side<0?s.minX-.12:s.maxX+.12,z:s.minZ+(i+.5)*len,y:s.low,w:.14,d:len,h:(s.high-s.low)*(s.rise==='+z'?(i+1)/count:1-i/count)+1,floor:0});}
const shaft={minX:35.4,maxX:36.6,minZ:31.4,maxZ:32.6};
// Only the storey-high flights open holes upstairs; the stage's two steps sit under the catwalk.
const flights=spec.stairs.filter((s:any)=>s.high>=3);
const floors=[{floor:1,y:3.5,areas:spec.rooms.filter((r:any)=>r.floor===1&&!r.id.startsWith('S')).flatMap((r:any)=>cut(r,[...flights,shaft]))},
 ...(spec.platforms??[]).map((p:any)=>({floor:0,y:p.y,ground:true,areas:[{minX:p.minX,maxX:p.maxX,minZ:p.minZ,maxZ:p.maxZ}]}))];
const zones=spec.rooms.flatMap((r:any)=>r.id.startsWith('S')?[r]:cut(r,r.floor===0?spec.stairs:flights).map(p=>({...r,...p})));
const map={...hotel,...spec,walls,blockers,floors,zones,sections:[{id:'club',label:'クラブ',surface:'asphalt',...spec.ground,outdoor:true}],pool:{minX:100,maxX:101,minZ:100,maxZ:101},water:[],palms:[],labels:[],guide:[[22,2],[20,15]],exits:spec.exits??[],reinforcements:[],cameras:[],traversalShafts:[{...shaft,floor:1}],collisionOnlyIds:walls.filter((w:any)=>w.id.startsWith('glass')).map((w:any)=>w.id)};
delete map.m53;delete map.m57;
write('club-map.json',map);
console.log(JSON.stringify({zones:zones.length,walls:walls.length,npcs:spec.npcs.length}));

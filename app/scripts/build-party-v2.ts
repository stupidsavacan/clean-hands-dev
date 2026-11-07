// Party-only geometry compiler. Runtime collision, sight and rendering share these cut solids.
import {readFileSync,writeFileSync} from 'node:fs';
type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
const read=(n:string)=>JSON.parse(readFileSync(new URL('../src/data/'+n,import.meta.url),'utf8'));
const write=(n:string,v:unknown)=>writeFileSync(new URL('../src/data/'+n,import.meta.url),JSON.stringify(v,null,1)+'\n');
const spec=read('party-layout.json'),hotel=read('hotel.json');
const cut=(r:Rect,holes:Rect[])=>{let parts=[r];for(const h of holes)parts=parts.flatMap(p=>{if(h.minX>=p.maxX||h.maxX<=p.minX||h.minZ>=p.maxZ||h.maxZ<=p.minZ)return [p];const z0=Math.max(p.minZ,h.minZ),z1=Math.min(p.maxZ,h.maxZ);return [h.minZ>p.minZ?{...p,maxZ:h.minZ}:null,h.maxZ<p.maxZ?{...p,minZ:h.maxZ}:null,h.minX>p.minX?{minX:p.minX,maxX:h.minX,minZ:z0,maxZ:z1}:null,h.maxX<p.maxX?{minX:h.maxX,maxX:p.maxX,minZ:z0,maxZ:z1}:null].filter(Boolean) as Rect[];});return parts;};
// Subtract a 3D opening from a wall, preserving the sill and lintel as real colliders.
function subtract(b:any,h:any){const lo={x:b.x-b.w/2,y:b.y,z:b.z-b.d/2},hi={x:b.x+b.w/2,y:b.y+b.h,z:b.z+b.d/2};const a={x:Math.max(lo.x,h.minX),y:Math.max(lo.y,h.minY),z:Math.max(lo.z,h.minZ)},c={x:Math.min(hi.x,h.maxX),y:Math.min(hi.y,h.maxY),z:Math.min(hi.z,h.maxZ)};if(a.x>=c.x||a.y>=c.y||a.z>=c.z)return [b];const parts:any[]=[];const add=(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number)=>{if(Math.min(x1-x0,y1-y0,z1-z0)>.001)parts.push({...b,id:b.id+'-'+parts.length,x:(x0+x1)/2,z:(z0+z1)/2,y:y0,w:x1-x0,h:y1-y0,d:z1-z0});};add(lo.x,a.x,lo.y,hi.y,lo.z,hi.z);add(c.x,hi.x,lo.y,hi.y,lo.z,hi.z);add(a.x,c.x,lo.y,a.y,lo.z,hi.z);add(a.x,c.x,c.y,hi.y,lo.z,hi.z);add(a.x,c.x,a.y,c.y,lo.z,a.z);add(a.x,c.x,a.y,c.y,c.z,hi.z);return parts;}
const holes:any[]=spec.stairs.map((s:any)=>({...s,minX:s.minX-.05,maxX:s.maxX+.05,minZ:s.minZ-.05,maxZ:s.maxZ+.05,minY:s.low,maxY:s.high+2}));
holes.push({minX:19.8,maxX:20.2,minZ:30,maxZ:35,minY:4,maxY:6});
// A real basement duct opening and an open parapet at the rainpipe landing.
holes.push({minX:9.8,maxX:10.2,minZ:30.15,maxZ:31.45,minY:-3.5,maxY:-1.3});
holes.push({minX:47.3,maxX:48.7,minZ:27.8,maxZ:28.2,minY:3.5,maxY:5.7});
let walls=spec.walls;for(const h of holes)walls=walls.flatMap((b:any)=>subtract(b,h));
const blockers=[...spec.furniture,{id:'shelf-F21-return',x:34,y:3.5,z:21,w:5,d:.5,h:2.2,floor:1},...spec.hides.map((h:any)=>({id:'locker-'+h.id,x:h.x,y:h.y,z:h.z,w:h.size.w,d:h.size.d,h:h.size.h,floor:Math.round(h.y/3.5)}))];
// Solid stair cheeks keep nav paths from stepping sideways between a ramp and a different floor.
for(const s of spec.stairs){const along=s.rise.includes('z'),positive=s.rise.startsWith('+'),count=16,len=(along?s.maxZ-s.minZ:s.maxX-s.minX)/count;
 for(let i=0;i<count;i++)for(const side of [-1,1]){const at=(along?s.minZ:s.minX)+(i+.5)*len,t=positive?(i+1)/count:1-i/count;
 blockers.push({id:`stair-cheek-${s.id}-${i}-${side}`,x:along?(side<0?s.minX-.12:s.maxX+.12):at,z:along?at:(side<0?s.minZ-.12:s.maxZ+.12),y:s.low,w:along?.14:len,d:along?len:.14,h:(s.high-s.low)*t+1,floor:s.floor});}}
const shaft={minX:18,maxX:19,minZ:36.5,maxZ:37.5};
const floors=[-1,1].map(f=>({floor:f,y:f*3.5,areas:spec.rooms.filter((r:any)=>r.floor===f).flatMap((r:any)=>cut(r,[...spec.stairs.filter((s:any)=>f*3.5>=s.low&&f*3.5<=s.high),...(f===1?[shaft]:[])]))}));
const map={...hotel,...spec,walls,blockers,floors,zones:spec.rooms,hides:spec.hides,sections:[{id:'party',label:'夜会の私邸',surface:'paving',...spec.ground,outdoor:true}],pool:{minX:100,maxX:101,minZ:100,maxZ:101},water:[],palms:[],labels:spec.rooms.map((r:any)=>({text:r.label,x:(r.minX+r.maxX)/2,y:r.floor*3.5+2.5,z:(r.minZ+r.maxZ)/2,floor:r.floor})),guide:[[25,2],[25,4]],checkpoints:spec.stage===1?[]:spec.checkpoints,exits:[{id:'E1',label:'正門前から脱出',x:25,z:2,floor:0,radius:1.3},{id:'E2',label:'搬入路の外へ脱出',x:2,z:2,floor:0,radius:1.3}],reinforcements:[{id:'party-backup',x:25,z:2}],traversalShafts:[{...shaft,floor:1}]};
delete map.m53;delete map.m57;
write('party.json',map);write('party-schedule.json',{actors:spec.actors});
if(spec.stage<3)write('party-dialogue.json',{});
console.log(JSON.stringify({stage:spec.stage,zones:new Set(spec.rooms.map((r:any)=>r.id)).size,walls:walls.length,npcs:map.npcs.length,connections:spec.openings.length+spec.stairs.length+spec.traversals.length}));

// Check complete 3D travel corridors and 1.5m landings against runtime solids and planned occupants.
// Trigger: S5 crossed W027 at (17,0.875,30); endpoint-only design checks missed the wall.
// Run from app: node --experimental-strip-types --no-warnings ../investigation/party-v2-overlap.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {CollisionWorld,stairY,HEIGHT,RADIUS,type Position} from '../app/src/world.ts';
const map=JSON.parse(readFileSync(new URL('../app/src/data/party.json',import.meta.url),'utf8')),world=new CollisionWorld(map);
const conflicts=new Map<string,any>(),samples:any[]=[];
const obstacles=[...map.walls,...map.blockers];
const actors=[...map.plannedPositions.map((n:any)=>({...n,kind:'person',r:.3,h:1.8})),...map.markers.map((m:any)=>({...m.at,id:m.id,kind:'marker',r:.2,h:1}))];
function check(id:string,p:Position){samples.push({id,...p});for(const b of obstacles){const single=new CollisionWorld({...map,walls:[b],blockers:[]});if(single.blocked(p.x,p.y,p.z))conflicts.set(id+'|'+b.id,{route:id,object:b.id,kind:'solid',at:p});}
 for(const n of actors){if(Math.abs(p.y-n.y)>=Math.max(HEIGHT,n.h))continue;if(Math.hypot(p.x-n.x,p.z-n.z)<RADIUS+n.r)conflicts.set(id+'|'+n.id,{route:id,object:n.id,kind:n.kind,at:p});}}
for(const s of map.stairs){const along=s.rise.includes('z'),positive=s.rise.startsWith('+'),lo=along?s.minZ:s.minX,hi=along?s.maxZ:s.maxX,mid=along?(s.minX+s.maxX)/2:(s.minZ+s.maxZ)/2,width=along?s.maxX-s.minX:s.maxZ-s.minZ;
 for(let t=lo-1.5;t<=hi+1.5+.001;t+=.1)for(let u=-width/2+RADIUS;u<=width/2-RADIUS+.001;u+=.2){const x=along?mid+u:t,z=along?t:mid+u,y=t<lo?(positive?s.low:s.high):t>hi?(positive?s.high:s.low):stairY(s,x,z);check(s.id,{x,y,z});}}
for(const t of map.traversals){const pts=[t.start,...(t.via??[]),t.end];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],count=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)/.05);for(let j=0;j<=count;j++){const k=j/count;check(t.id,{x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,z:a.z+(b.z-a.z)*k});}}
 for(const p of [t.start,t.end])for(let x=-.5;x<=.5;x+=.25)for(let z=-.5;z<=.5;z+=.25)check(t.id,{x:p.x+x,y:p.y,z:p.z+z});}
const result={samples:samples.length,conflicts:[...conflicts.values()],count:conflicts.size,scope:'3D capsule travel + landings; walls/furniture/hides/planned NPC feet/items across floors'};
writeFileSync(new URL('party-v2-overlap-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(result.count)process.exitCode=1;

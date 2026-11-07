// Check physical routes on the generated party map; no NPC deletion or debug dress/teleport.
// Trigger: party continuation, scaled layout and implemented connections must agree.
// Run from app: node --experimental-strip-types ../investigation/party-audit.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {CollisionWorld} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
const map=JSON.parse(readFileSync(new URL('../app/src/data/party.json',import.meta.url),'utf8')),world=new CollisionWorld(map),nav=new NavGrid(world);
const rows:any[]=[];
for(const e of map.openings){const r=map.rooms.find((r:any)=>r.id===e.a),y=r.floor*3.5;const p=e.axis==='x'?{x:e.at,y,z:e.fixed-.65}:{x:e.fixed-.65,y,z:e.at},q=e.axis==='x'?{x:e.at,y,z:e.fixed+.65}:{x:e.fixed+.65,y,z:e.at};rows.push({id:e.id,kind:'opening',a:e.a,b:e.b,clear:nav.clear(p,q)});}
for(const s of map.stairs){const x=(s.minX+s.maxX)/2,z=(s.minZ+s.maxZ)/2,p=s.rise.includes('z')?{x,z:s.rise==='+z'?s.minZ-.5:s.maxZ+.5,y:s.low}:{x:s.minX-.5,z,y:s.low},q=s.rise.includes('z')?{x,z:s.rise==='+z'?s.maxZ+.5:s.minZ-.5,y:s.high}:{x:s.maxX+.5,z,y:s.high};const path=nav.find(p,q);rows.push({id:s.id,kind:'stairs',a:s.a,b:s.b,clear:!!path?.length,from:p,to:q});}
for(const t of map.traversals)rows.push({id:t.id,kind:t.kind,a:t.a,b:t.b,clear:!world.blocked(t.start.x,t.start.y,t.start.z)&&!world.blocked(t.end.x,t.end.y,t.end.z)&&nav.nearest(t.start)>=0&&nav.nearest(t.end)>=0});
console.log(JSON.stringify({connections:rows.length,failed:rows.filter(r=>!r.clear)}));
writeFileSync(new URL('./party-connection-audit.json',import.meta.url),JSON.stringify(rows,null,2));


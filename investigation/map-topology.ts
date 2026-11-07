// How the hotel's areas connect, measured the way HITMAN levels are talked about ("Swiss cheese": many ways into each
// place; "snail house": layers that wrap and lead inward; loops instead of dead ends). Asked on 2026-11-01 when
// comparing the map with HITMAN's. Areas are hotel.json zones (unzoned walkable ground is "outside"); two areas touch
// where nav cells (0.5 m) of each are neighbours at the same height; touching cells within 1.5 m form one opening.
// Run from app/: node --experimental-strip-types --no-warnings ../investigation/map-topology.ts
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CollisionWorld, floorOf} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {zoneAt} from '../app/src/ai.ts';
// An optional map path is resolved from the current working directory.
const mapPath = process.argv[2] ? resolve(process.argv[2]) : new URL('../app/src/data/hotel.json', import.meta.url);
const hotel = JSON.parse(readFileSync(mapPath, 'utf8'));
const nav = new NavGrid(new CollisionWorld(hotel));
const zones = hotel.zones as {id: string; label: string; type: string; floor: number}[];
const areaOf = (n: {x: number; y: number; z: number}) => { const st=hotel.stairs.find((s:any)=>s.a&&s.b&&n.x>=s.minX&&n.x<=s.maxX&&n.z>=s.minZ&&n.z<=s.maxZ&&n.y>=s.low&&n.y<=s.high);if(st)return n.y<(st.low+st.high)/2?st.a:st.b;const f = floorOf(n.y), z = zoneAt(zones as any, n.x, n.z, f); return z ? z.id : `outside_${f}`; };
const key = (ix: number, iz: number) => ix * 100000 + iz;
const at = new Map<number, number[]>(); nav.nodes.forEach((n, i) => { const k = key(n.ix, n.iz); (at.get(k) ?? at.set(k, []).get(k)!).push(i); });
const area = nav.nodes.map(areaOf);
// Boundary cells between each pair of areas.
const touch = new Map<string, {x: number; z: number; y: number}[]>();
for (let i = 0; i < nav.nodes.length; i++) { const n = nav.nodes[i];
 for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) for (const j of at.get(key(n.ix + dx, n.iz + dz)) ?? []) {
  const m = nav.nodes[j]; if (Math.abs(m.y - n.y) > .3 || area[i] === area[j]) continue;
  const pair = [area[i], area[j]].sort().join('|'); (touch.get(pair) ?? touch.set(pair, []).get(pair)!).push({x: (n.x + m.x) / 2, y: n.y, z: (n.z + m.z) / 2});
 }}
// Cluster boundary points into openings.
const openings: {a: string; b: string; at: {x: number; z: number; y: number}; width: number}[] = [];
for (const [pair, pts] of touch) { const [a, b] = pair.split('|'), seen = new Set<number>();
 for (let i = 0; i < pts.length; i++) { if (seen.has(i)) continue; const group = [i]; seen.add(i);
  for (let g = 0; g < group.length; g++) for (let j = 0; j < pts.length; j++) if (!seen.has(j) && Math.hypot(pts[j].x - pts[group[g]].x, pts[j].z - pts[group[g]].z) < 1.5 && Math.abs(pts[j].y - pts[group[g]].y) < .5) { seen.add(j); group.push(j); }
  const xs = group.map(k => pts[k].x), zs = group.map(k => pts[k].z);
  openings.push({a, b, at: {x: +(xs.reduce((s, v) => s + v) / xs.length).toFixed(1), y: pts[group[0]].y, z: +(zs.reduce((s, v) => s + v) / zs.length).toFixed(1)}, width: +Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)).toFixed(1)});
 }}
// A stair's mid-flight zone boundary is not an additional door. Its validated flight is counted once below.
for(let i=openings.length-1;i>=0;i--)if(hotel.stairs.some((st:any)=>openings[i].at.x>=st.minX-.3&&openings[i].at.x<=st.maxX+.3&&openings[i].at.z>=st.minZ-.3&&openings[i].at.z<=st.maxZ+.3))openings.splice(i,1);
if(hotel.openings)console.log(JSON.stringify({boundaryOpenings:openings.map(o=>({...o,declared:hotel.openings.some((e:any)=>[e.a,e.b].sort().join('|')===[o.a,o.b].sort().join('|'))}))}));
// Explicit vertical links are checked against physical nav paths; shortcuts never enter NPC nav.
const verticalChecks:any[]=[];
for(const st of hotel.stairs){const x=(st.minX+st.maxX)/2,z=(st.minZ+st.maxZ)/2,along=st.rise.includes('z'),positive=st.rise.startsWith('+');
 const p=along?{x,y:st.low,z:positive?st.minZ-.5:st.maxZ+.5}:{x:positive?st.minX-.5:st.maxX+.5,y:st.low,z};
 const q=along?{x,y:st.high,z:positive?st.maxZ+.5:st.minZ-.5}:{x:positive?st.maxX+.5:st.minX-.5,y:st.high,z};
 const path=nav.find(p,q),a=st.a??areaOf(p),b=st.b??areaOf(q),valid=!!path?.length;
 verticalChecks.push({id:st.id,kind:'stairs',a,b,valid});if(valid&&a!==b)openings.push({a,b,at:p,width:along?st.maxX-st.minX:st.maxZ-st.minZ});}
for(const t of hotel.traversals??[]){const valid=[t.start,t.end].every((p:any)=>nav.nearest(p)>=0&&!nav.world.blocked(p.x,p.y,p.z));verticalChecks.push({id:t.id,kind:t.kind,a:t.a,b:t.b,valid});if(valid)openings.push({a:t.a,b:t.b,at:t.start,width:0});}
if(verticalChecks.length)console.log(JSON.stringify({verticalChecks}));

const names = [...new Set([...area,...openings.flatMap(o=>[o.a,o.b])])];
const label = (id: string) => zones.find(z => z.id === id)?.label ?? id;
const type = (id: string) => zones.find(z => z.id === id)?.type ?? 'outside';
const rows = names.map(id => { const mine = openings.filter(o => o.a === id || o.b === id), nb = new Set(mine.map(o => o.a === id ? o.b : o.a));
 return {area: id, label: label(id), type: type(id), floor: area.indexOf(id)>=0?floorOf(nav.nodes[area.indexOf(id)].y):(zones.find(z=>z.id===id)?.floor??0), cells: area.filter(a => a === id).length, ways: mine.length, neighbours: [...nb].map(label)}; })
 .sort((p, q) => p.floor - q.floor || p.ways - q.ways);
for (const r of rows) console.log(JSON.stringify(r));
// Loops: independent cycles in the area graph (edges = openings). 0 means a tree: every route is the only route.
const parent = new Map(names.map(n => [n, n])); const find = (n: string): string => parent.get(n) === n ? n : find(parent.get(n)!);
let merged = 0; for (const o of openings) { const a = find(o.a), b = find(o.b); if (a !== b) { parent.set(a, b); merged++; } }
const parts = names.length - merged;
console.log(JSON.stringify({areas: names.length, openings: openings.length, connectedParts: parts, independentLoops: openings.length - names.length + parts,
 deadEnds: rows.filter(r => r.ways === 1).map(r => r.label), restrictedWithOneWay: rows.filter(r => r.type !== 'public' && r.type !== 'outside' && r.ways <= 1).map(r => r.label)}));

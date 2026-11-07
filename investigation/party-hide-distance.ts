// Multi-source distances on the actual NPC navigation graph. Uses the nav's own neighbour predicate.
// Trigger: every zone must have a body hide within 15m walking distance.
// Run: node --experimental-strip-types ../investigation/party-hide-distance.ts
import {readFileSync,writeFileSync} from 'node:fs';import {CollisionWorld,floorOf} from '../app/src/world.ts';import {NavGrid} from '../app/src/nav.ts';import {zoneAt} from '../app/src/ai.ts';
const map=JSON.parse(readFileSync(new URL('../app/src/data/party.json',import.meta.url),'utf8')),nav=new NavGrid(new CollisionWorld(map)),dist=new Float64Array(nav.nodes.length).fill(Infinity),heap:[number,number][]=[];
function push(v:number,i:number){heap.push([v,i]);let k=heap.length-1;while(k){const p=(k-1)>>1;if(heap[p][0]<=v)break;heap[k]=heap[p];k=p;}heap[k]=[v,i];}
function pop(){const first=heap[0],last=heap.pop()!;if(heap.length){let k=0;while(k*2+1<heap.length){let j=k*2+1;if(j+1<heap.length&&heap[j+1][0]<heap[j][0])j++;if(heap[j][0]>=last[0])break;heap[k]=heap[j];k=j;}heap[k]=last;}return first;}
for(const h of map.hides){const p={x:h.x+h.approach.x,y:h.y,z:h.z+h.approach.z},i=nav.nearest(p);if(i>=0){const n=nav.nodes[i],d=Math.hypot(n.x-p.x,n.y-p.y,n.z-p.z);if(d<1){dist[i]=d;push(d,i);}}}
while(heap.length){const [v,i]=pop();if(v>dist[i])continue;const a=nav.nodes[i];for(const j of (nav as any).neighbours(i)){const b=nav.nodes[j],d=v+Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(d<dist[j]){dist[j]=d;push(d,j);}}}
const out=map.zones.map((z:any)=>{const cells=nav.nodes.map((n,i)=>({n,i})).filter(({n})=>zoneAt(map.zones,n.x,n.z,floorOf(n.y))?.id===z.id);const worst=cells.reduce((a,b)=>dist[a.i]>dist[b.i]?a:b,cells[0]);return {id:z.id,maxMetres:worst?dist[worst.i]:null,at:worst?.n,pass:!!worst&&dist[worst.i]<=15};});writeFileSync(new URL('./party-hide-distance.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out));

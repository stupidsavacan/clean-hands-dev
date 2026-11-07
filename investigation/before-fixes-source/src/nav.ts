import { RADIUS, inside, sectionAt, surfaces, type CollisionWorld, type Position } from './world.ts';
type Node={ix:number;iz:number;x:number;y:number;z:number;sec:number};
const now=()=>performance.now(),HEURISTIC=1.5,STEP=.3,DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
// Walkable cells of the collision world on both floors; the stair ramp links them. A* over the cells, then string-pulled.
// Cells belong to the map's sections; a path between sections is first planned over the section graph, and the cell search keeps to those sections.
export class NavGrid{
 readonly cell=.5;readonly nodes:Node[]=[];private readonly cells=new Map<number,number[]>();private readonly nx:number;private readonly ox:number;private readonly oz:number;readonly world:CollisionWorld;
 // Neighbouring sections and the metres between their centres.
 readonly links=new Map<number,Map<number,number>>();private readonly centres:{x:number;z:number}[]=[];
 constructor(world:CollisionWorld){this.world=world;const g=world.level.ground;this.ox=g.minX;this.oz=g.minZ;this.nx=Math.ceil((g.maxX-g.minX)/this.cell);const nz=Math.ceil((g.maxZ-g.minZ)/this.cell);
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<this.nx;ix++){const x=this.ox+(ix+.5)*this.cell,z=this.oz+(iz+.5)*this.cell;if(!inside(g,x,z,RADIUS))continue;
   for(const y of this.heights(x,z))if(!world.blocked(x,y,z)){const list=this.cells.get(iz*this.nx+ix)||[];list.push(this.nodes.length);this.cells.set(iz*this.nx+ix,list);this.nodes.push({ix,iz,x,y,z,sec:sectionAt(world.level.sections,x,z)});}}
  for(const s of world.level.sections??[])this.centres.push({x:(s.minX+s.maxX)/2,z:(s.minZ+s.maxZ)/2});
  for(const n of this.nodes)if(n.sec>=0)for(const [dx,dz] of DIRS)for(const j of this.cells.get((n.iz+dz)*this.nx+n.ix+dx)||[]){const m=this.nodes[j];if(m.sec<0||m.sec===n.sec||Math.abs(m.y-n.y)>STEP)continue;
   const a=this.centres[n.sec],b=this.centres[m.sec],cost=Math.hypot(a.x-b.x,a.z-b.z);if(!this.links.has(n.sec))this.links.set(n.sec,new Map());this.links.get(n.sec)!.set(m.sec,cost);}}
 // Dijkstra over the section graph; null when the sections are not connected or the map has none.
 sectionRoute(from:number,to:number):number[]|null{if(from<0||to<0)return null;if(from===to)return [from];const cost=new Map([[from,0]]),prev=new Map<number,number>(),open=new Set([from]);
  while(open.size){let i=-1,best=Infinity;for(const k of open)if(cost.get(k)!<best){best=cost.get(k)!;i=k;}open.delete(i);if(i===to)break;
   for(const [j,c] of this.links.get(i)??[]){const v=best+c;if(v<(cost.get(j)??Infinity)){cost.set(j,v);prev.set(j,i);open.add(j);}}}
  if(!prev.has(to))return null;const out=[to];while(out[0]!==from)out.unshift(prev.get(out[0])!);return out;}
 // Walking surfaces at a point: a stair ramp, or the ground and any floor plates over it.
 heights(x:number,z:number){return surfaces(this.world.level,x,z);}
 private node(ix:number,iz:number,y:number,tol=.45){let best=-1,gap=tol;for(const i of this.cells.get(iz*this.nx+ix)||[]){const d=Math.abs(this.nodes[i].y-y);if(d<=gap){gap=d;best=i;}}return best;}
 nearest(p:Position){const cx=Math.floor((p.x-this.ox)/this.cell),cz=Math.floor((p.z-this.oz)/this.cell);let best=-1,dist=Infinity;
  for(let r=0;r<=5&&best<0;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;for(const i of this.cells.get((cz+dz)*this.nx+cx+dx)||[]){const n=this.nodes[i];if(Math.abs(n.y-p.y)>.6||cx+dx<0||cx+dx>=this.nx)continue;const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<dist){dist=d;best=i;}}}
  return best;}
 // A straight walk between two points stays on a surface and clear of colliders.
 clear(a:Position,b:Position){const len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(len/.09));let previousY=a.y;
  for(let k=1;k<=n;k++){const t=k/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,expected=a.y+(b.y-a.y)*t;
   const y=this.world.surface(x,z,previousY);if(y===null||Math.abs(y-expected)>STEP||this.world.blocked(x,y,z))return false;previousY=y;}
  return Math.abs(previousY-b.y)<STEP;}
 // Patrols ask for the same legs over and over; a found path is reused while its first leg is still clear from where the walker stands.
 private readonly cache=new Map<number,Position[]>();
 find(from:Position,to:Position):Position[]|null{const s=this.nearest(from),g=this.nearest(to);if(s<0||g<0)return null;
  const key=s*this.nodes.length+g,hit=this.cache.get(key);if(hit&&hit.length&&this.clear(from,hit[0])&&Math.hypot(hit.at(-1)!.x-to.x,hit.at(-1)!.z-to.z)<.3){this.cache.delete(key);this.cache.set(key,hit);return hit.map(p=>({...p}));}
  const t0=now(),found=this.plan(s,g,from,to);this.spent+=now()-t0;if(found){this.cache.set(key,found.map(p=>({...p})));if(this.cache.size>4000)this.cache.delete(this.cache.keys().next().value!);}return found;}
 // When a shot sends ninety people running at once, their new routes are spread over the next frames instead of
 // all being searched in one: walkers ask with findSoon, which answers undefined (ask again next frame) once this
 // frame's milliseconds are used up. A cached route is always free; the first search of a frame always runs.
 private spent=0;private budget=Infinity;
 frame(ms:number){this.spent=0;this.budget=ms;}
 findSoon(from:Position,to:Position):Position[]|null|undefined{if(this.spent>0&&this.spent>=this.budget&&!this.cached(from,to))return undefined;return this.find(from,to);}
 private cached(from:Position,to:Position){const s=this.nearest(from),g=this.nearest(to);return s>=0&&g>=0&&this.cache.has(s*this.nodes.length+g);}
 private plan(s:number,g:number,from:Position,to:Position):Position[]|null{
  const route=this.sectionRoute(this.nodes[s].sec,this.nodes[g].sec);
  // Keep to the planned sections; if that corridor has no cell path, search the whole grid.
  return (route&&this.search(s,g,from,to,new Set(route)))??this.search(s,g,from,to,null);}
 // The cells one step from a cell, worked out the first time a search reaches it and kept.
 private readonly adj:Int32Array[]=[];
 private neighbours(i:number){const n=this.nodes[i],out:number[]=[];
  for(const [dx,dz] of DIRS){if(n.ix+dx<0||n.ix+dx>=this.nx)continue;for(const j of this.cells.get((n.iz+dz)*this.nx+n.ix+dx)||[]){const m=this.nodes[j];if(Math.abs(m.y-n.y)>STEP)continue;
   // No corner cutting: a diagonal needs both orthogonal cells open at this height.
   if(dx&&dz&&(this.node(n.ix+dx,n.iz,n.y)<0||this.node(n.ix,n.iz+dz,n.y)<0))continue;
   if(this.world.blocked((m.x+n.x)/2,(m.y+n.y)/2,(m.z+n.z)/2))continue;out.push(j);}}
  return Int32Array.from(out);}
 private search(s:number,g:number,from:Position,to:Position,allowed:Set<number>|null):Position[]|null{
  const cost=new Float64Array(this.nodes.length).fill(Infinity),prev=new Int32Array(this.nodes.length).fill(-1),closed=new Uint8Array(this.nodes.length),heap=new Heap();
  // Weighted A* (the heuristic counts a little more than the distance walked): far fewer cells are opened, and the
  // string-pulling below straightens what little detour that costs.
  const h=(i:number)=>{const a=this.nodes[i],b=this.nodes[g];return (Math.hypot(a.x-b.x,a.z-b.z)+Math.abs(a.y-b.y))*HEURISTIC;};cost[s]=0;heap.push(h(s),s);
  while(heap.size){const i=heap.pop();if(i===g)break;if(closed[i])continue;closed[i]=1;const n=this.nodes[i],adj=this.adj[i]??=this.neighbours(i);
   for(let k=0;k<adj.length;k++){const j=adj[k],m=this.nodes[j];if(closed[j]||allowed&&!allowed.has(m.sec))continue;
    const c=cost[i]+Math.hypot(m.x-n.x,m.z-n.z,m.y-n.y);if(c<cost[j]){cost[j]=c;prev[j]=i;heap.push(c+h(j),j);}}}
  if(prev[g]<0&&g!==s)return null;const chain:Position[]=[];for(let i=g;i>=0;i=prev[i]){const n=this.nodes[i];chain.unshift({x:n.x,y:n.y,z:n.z});}
  const end={...to,y:this.nodes[g].y};if(this.clear(chain.at(-1)!,end))chain.push(end);
  const out:Position[]=[];let at=from;for(let i=0;i<chain.length;){let j=chain.length-1;while(j>i&&!this.clear(at,chain[j]))j--;out.push(chain[j]);at=chain[j];i=j+1;}
  return out;}
}
class Heap{private f:number[]=[];private v:number[]=[];get size(){return this.v.length;}
 push(f:number,v:number){this.f.push(f);this.v.push(v);let i=this.v.length-1;while(i){const p=(i-1)>>1;if(this.f[p]<=this.f[i])break;this.swap(i,p);i=p;}}
 pop(){const top=this.v[0],f=this.f.pop()!,v=this.v.pop()!;if(this.v.length){this.f[0]=f;this.v[0]=v;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<this.v.length&&this.f[l]<this.f[m])m=l;if(r<this.v.length&&this.f[r]<this.f[m])m=r;if(m===i)break;this.swap(i,m);i=m;}}return top;}
 private swap(a:number,b:number){[this.f[a],this.f[b]]=[this.f[b],this.f[a]];[this.v[a],this.v[b]]=[this.v[b],this.v[a]];}
}

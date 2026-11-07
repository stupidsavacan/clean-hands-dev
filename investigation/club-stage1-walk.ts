// Verify club loops using the production CollisionWorld in 5 cm steps, plus both ladder directions.
// Trigger: stage-one acceptance; no NPCs exist and no ghost run is appropriate.
// Run: node --experimental-strip-types --no-warnings ../investigation/club-stage1-walk.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {CollisionWorld,type Position} from '../app/src/world.ts';
import {PartyTraversal} from '../app/src/party/traversal.ts';
const map=JSON.parse(readFileSync(new URL('../app/src/data/club-map.json',import.meta.url),'utf8'));const world=new CollisionWorld(map);let p:Position={...map.spawn,y:0},metres=0;const results:any[]=[];
function walk(x:number,z:number,y=0){let stalled=0;for(let i=0;i<3000;i++){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.04){if(Math.abs(p.y-y)>.1)throw Error(`height ${JSON.stringify({p,target:[x,y,z]})}`);return;}const n=world.move(p,dx/d*Math.min(.05,d),dz/d*Math.min(.05,d));const moved=Math.hypot(n.x-p.x,n.z-p.z);metres+=moved;stalled=moved<.0001?stalled+1:0;p=n;if(stalled>3)throw Error(`blocked ${JSON.stringify({p,target:[x,y,z]})}`);}throw Error('timeout');}
function path(name:string,points:number[][]){for(const q of points)walk(q[0],q[1],q[2]??0);results.push({route:name,passed:true,position:p,walkedMetres:metres});console.log(JSON.stringify(results.at(-1)));}
// 2026-11-03 re-plan: routes follow the new building (lobby side rooms, west VIP and lounge, east bar, back corridor).
path('lobby, toilets behind the screen',[[22,9],[29,12.6],[31.2,12.6],[31.2,9.6],[36,9],[41,9],[36,9],[31.2,9.6],[31.2,12.6],[29,12.6],[22,9]]);
// 2026-11-03 (Claude): the cloak's back room behind the counter, its locker and the bartender uniform.
path('cloak back room',[[16,8.3],[14,8.3],[12.5,8.3],[11.45,8.1],[11.1,6.9],[12.5,8.3],[14,8.3],[16,8.3],[22,9]]);
// 2026-11-03: the open stage, up the west steps, across the boards and down the east steps.
path('stage by its corner steps',[[20,12],[19,27.5],[18.9,28.6],[18.9,30.5,.28],[27,30.6,.28],[29.1,30.5,.28],[29.1,28.6],[29.1,27.5],[20,16],[20,12],[22,9]]);
path('smoking yard, alley, kitchen and dock loop',[[12,10],[8,10],[5,10],[2,12],[2,15],[2,33],[5,33],[6,34.2],[6,37],[16,37],[16,35],[14.6,35],[12,34.2],[6,34.2],[5,33],[2,33],[2,15],[2,12],[8,10],[12,10],[22,9]]);
path('hall, bar, store, corridor, equipment, stage and office',[[20,12],[20,16],[24,20],[36,20],[36,28.6],[39,28.6],[41,29],[41,32],[41,35],[34,35],[34,33],[32.6,32],[29,32.5,.28],[24,32.6,.28],[24,35],[16,35],[16,32.5],[16,35],[24,35],[24,32.6,.28],[29,32.5,.28],[32.6,32],[34,33],[35,33.4]]);
path('back to the hall',[[34,35],[24,35],[16,35],[14.6,35],[12,34.2],[6,34.2],[5,33],[2,33],[2,15],[2,12],[8,10],[20,12],[20,16],[24,20]]);
path('lounge and front stairs to VIP, service stairs down',[[16,26],[10,26],[9,21],[9,15.2],[13,15],[13,23.6,3.5],[10,24,3.5],[9,20,3.5],[7.5,22.5,3.5],[5,22.5,3.5],[5,30.6],[6,31.5],[6,34.2],[12,34.2],[14.6,35],[16,35],[24,35],[34,35],[34,33],[35,33.4]]);
path('to the ladder',[[36,32]]);
const dummy={npcs:[]} as any;const t=new PartyTraversal(dummy,map.traversals,map.traversalRules);
function climb(reverse=false){const pv=()=>({...p} as any);t.step(1/60,pv(),new Set());t.step(1/60,pv(),new Set(['KeyE']));for(let i=0;i<241;i++){t.step(1/60,pv(),new Set(['KeyE']));const q=t.takeTransfer();if(q){if(world.blocked(q.x,q.y,q.z))throw Error('ladder collision '+JSON.stringify(q));p=q;}}if(t.locked)throw Error('ladder still locked');results.push({route:reverse?'ladder down':'ladder up',passed:true,position:p});console.log(JSON.stringify(results.at(-1)));}
climb();path('catwalk to the VIP staff door, down the front stairs',[[36,29,3.5],[24,29,3.5],[15,29,3.5],[13,29,3.5],[12,26,3.5],[13,23.6,3.5],[13,15],[16,15],[24,20]]);
path('second ascent',[[36,28.6],[39,28.6],[41,29],[41,32],[41,35],[34,35],[34,33],[35,33.4],[36,32]]);climb();climb(true);
for(const reverse of [false,true]){if(reverse)climb();for(const fraction of [.25,.5,.75]){const from={...p};t.step(1/60,p as any,new Set());t.step(1/60,p as any,new Set(['KeyE']));for(let i=0;i<240*fraction;i++){t.step(1/60,p as any,new Set(['KeyE']));p=t.takeTransfer()??p;}t.step(1/60,p as any,new Set());p=t.takeTransfer()??p;if(Math.hypot(p.x-from.x,p.y-from.y,p.z-from.z)>.001)throw Error('cancel drift');results.push({cancel:fraction,reverse,passed:true});}}
writeFileSync(new URL('club-stage1-walk-results.json',import.meta.url),JSON.stringify({metres,results},null,2));



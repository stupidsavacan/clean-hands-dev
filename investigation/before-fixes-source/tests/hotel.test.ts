import {test}from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from 'node:fs';
import {Director,type Mission,type PlayerView,type Rules}from '../src/ai.ts';
import {CollisionWorld,floorAt,inside,plateY,type Level,type Position}from '../src/world.ts';
import {NavGrid}from '../src/nav.ts';
import {sightBoxes,segmentClear}from '../src/sight.ts';
const hotel=JSON.parse(readFileSync(new URL('../src/data/hotel.json',import.meta.url),'utf8')),rules=JSON.parse(readFileSync(new URL('../src/data/rules.json',import.meta.url),'utf8'));
const world=new CollisionWorld(hotel as Level),nav=new NavGrid(world),spawn={...hotel.spawn,y:0};
const reach=(to:Position)=>{const path=nav.find(spawn,to);if(!path?.length)return false;const end=path.at(-1)!;return Math.hypot(end.x-to.x,end.z-to.z)<.8&&Math.abs(end.y-to.y)<.5;};

test('the plan is all there: 20 sections, B1 to RF, 5 exits, 2 checkpoints, 8 cameras, about 14 hiding places, 12 face-knowers',()=>{
 assert.equal(hotel.sections.length,20);assert.deepEqual(hotel.floors.map((f:{floor:number})=>f.floor).sort(),[-1,1,2]);assert.equal(hotel.stairs.length,4);
 assert.equal(hotel.exits.length,5);assert.equal(hotel.checkpoints.length,2);assert.equal(hotel.cameras.length,8);
 assert.equal(hotel.cameras.filter((c:{floor:number})=>c.floor===0).length,5);assert.ok(hotel.hides.length>=14);
 assert.equal(hotel.npcs.length,120);assert.equal(hotel.npcs.filter((n:{knowsFaces?:string[]})=>n.knowsFaces?.length).length,12);assert.equal(hotel.npcs.filter((n:{target?:boolean})=>n.target).length,3);
 for(const type of ['public','staff','secure','outer'])assert.ok(hotel.zones.some((z:{type:string})=>z.type===type));
 for(const id of ['ZONE_outer_parking','ZONE_outer_marina','ZONE_staff_harbor','ZONE_staff_beachbar_back','ZONE_public_beach','ZONE_public_promenade'])assert.ok(hotel.zones.some((z:{id:string})=>z.id===id),id);});

test('every section and floor can be walked to from the front drive',()=>{
 for(const s of hotel.sections){const n=nav.nodes.filter(n=>inside(s,n.x,n.z)&&Math.abs(n.y)<.01);assert.ok(n.length>20,s.id);const mid=n[Math.floor(n.length/2)];assert.ok(reach(mid),`section ${s.id}`);}
 for(const f of hotel.floors){const n=nav.nodes.find(n=>Math.abs(n.y-f.y)<.01&&f.areas.some((a:{minX:number;maxX:number;minZ:number;maxZ:number})=>inside(a,n.x,n.z,1)));assert.ok(n&&reach(n),`floor ${f.floor}`);}});

test('every exit, hiding place, checkpoint, the panel and every person can be reached',()=>{
 for(const e of hotel.exits)assert.ok(reach({x:e.x,y:plateY(hotel,e.floor),z:e.z}),e.id);
 for(const h of hotel.hides)assert.ok(reach({x:h.x+h.approach.x,y:h.y,z:h.z+h.approach.z}),h.id);
 for(const c of hotel.checkpoints)for(const s of [1,-1])assert.ok(reach({x:c.x+c.normal.x*s,y:c.y,z:c.z+c.normal.z*s}),c.id);
 assert.ok(reach({x:hotel.objectives.panel.x+.3,y:0,z:hotel.objectives.panel.z}));
 for(const n of hotel.npcs)for(const r of n.route)assert.ok(reach({x:r[0],y:plateY(hotel,n.floor),z:r[1]}),`${n.id} ${r}`);});

test('the agent capsule walks the guide route up the grand stairs to 2F and back out to the pool',()=>{let p:Position={...spawn},floor=0,up=false;
 for(const [x,z] of hotel.guide){let n=0;while(Math.hypot(x-p.x,z-p.z)>.1&&n++<4000){const len=Math.hypot(x-p.x,z-p.z),s=Math.min(.05,len);p=world.move(p,(x-p.x)/len*s,(z-p.z)/len*s);floor=floorAt(p.y,floor);if(floor===1)up=true;}assert.ok(Math.hypot(x-p.x,z-p.z)<=.1,`stuck before ${x},${z} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);}
 assert.ok(up);assert.equal(floor,0);});

test('stacked floors stay separate: the lobby under the roof stairs, the cellar under the bar, sight blocked by slabs',()=>{
 const lobby=world.move({x:1.5,y:0,z:-3},0,-1);assert.equal(lobby.y,0);assert.ok(lobby.z<-3.9);
 const boxes=sightBoxes(hotel);assert.equal(segmentClear(boxes,{x:20,y:1.6,z:-8},{x:20,y:-2,z:-8}),false);assert.equal(segmentClear(boxes,{x:-8,y:1.6,z:-10},{x:-8,y:5,z:-10}),false);
 let p:Position={x:28.5,y:0,z:-3.6};for(let i=0;i<200;i++)p=world.move(p,0,-.05);assert.ok(Math.abs(p.y+3.5)<.05,`cellar ${p.y}`);});

test('120 people on the full hotel keep the AI step inside the 8 ms budget',()=>{const d=new Director(hotel as Mission,world,nav,sightBoxes(hotel),structuredClone(rules)as Rules),p:PlayerView={...spawn,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
 for(let i=0;i<120;i++)d.step(1/60,p);const frames=600,start=performance.now();for(let i=0;i<frames;i++)d.step(1/60,{...p,x:2+Math.sin(i/120)*6,z:-10});const ms=(performance.now()-start)/frames;
 const tiers={near:0,mid:0,far:0};for(const n of d.npcs)tiers[n.tier]++;console.log(`hotel 120 NPC AI step: ${ms.toFixed(2)} ms/frame`,tiers);assert.ok(ms<8,`${ms.toFixed(2)} ms`);assert.ok(tiers.far>0&&tiers.mid>0);});

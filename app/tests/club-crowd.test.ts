import assert from 'node:assert/strict';
import { test } from 'node:test';
import data from '../src/data/club-crowd.json' with {type:'json'};
import map from '../src/data/club-map.json' with {type:'json'};
import rules from '../src/data/club-rules.json' with {type:'json'};
import lanes from '../../investigation/club-crowd-lanes.json' with {type:'json'};
import { Director, type Mission, type PlayerView, type Rules, zoneAt } from '../src/ai.ts';
import { ClubCrowd } from '../src/club/crowd.ts';
import { CollisionWorld } from '../src/world.ts';
import { NavGrid } from '../src/nav.ts';
import { sightBoxes } from '../src/sight.ts';

function fixture(multiplier=1, ghostWitness=true){
 const mission=map as unknown as Mission,world=new CollisionWorld(mission);
 const director=new Director(mission,world,new NavGrid(world),sightBoxes(mission),rules as Rules);
 const crowd=new ClubCrowd(director,{...data,ghostWitness},multiplier);
 return {crowd,director,world};
}
const player=(x:number,z:number):PlayerView=>({x,z,y:0,floor:0,disguise:'suit',speed:0,crouched:false,running:false,tampering:false});

test('crowd extras stay outside the director and off sampled main lanes and solids',()=>{
 const {crowd,director,world}=fixture(2);
 const tracks=lanes.map(s=>s.split(',').map(n=>Number(n)/4));
 assert.equal(crowd.people.length,120);
 assert.equal(director.npcs.length,36);
 assert.equal(crowd.people.filter(n=>'scheduleTarget' in n).length,0);
 for(const n of crowd.people){
  assert.equal(zoneAt(director.mission.zones,n.x,n.z,n.place.floor)?.id,n.place.zone);
  assert.equal(world.blocked(n.x,n.y,n.z,1.7),false);
  assert.ok(tracks.every(([x,z])=>Math.hypot(n.x-x,n.z-z)>=.83));
 }
});

test('gunshot frightens a crowd, reports the scream location without identity and settles',()=>{
 const {crowd,director}=fixture();
 const p=player(29,24);
 const events:string[]=[];
 crowd.reaction=(id,action)=>events.push(id+':'+action);
 const before=crowd.people.map(n=>[n.x,n.z]);
 crowd.gunshot(p,0,'loud');
 assert.ok(events.some(e=>e.endsWith(':scream')));
 assert.ok(events.some(e=>e.endsWith(':flee')));
 const responder=director.npcs.find(n=>n.guard&&n.knowledge.some(k=>k.eventType==='report'));
 assert.ok(responder);
 assert.equal(responder.knownDisguises.size,0);
 assert.equal(director.compromised.size,0);
 assert.ok(crowd.clusters.some(c=>c.place.x===responder.goal?.x&&c.place.z===responder.goal?.z));
 for(let i=0;i<10;i++)crowd.step(i*.11,p);
 assert.notDeepEqual(crowd.people.map(n=>[n.x,n.z]),before);
 for(let i=10;i<105;i++)crowd.step(i*.11,p);
 assert.ok(crowd.clusters.every(c=>c.origin===null));
 assert.deepEqual(crowd.people.map(n=>[n.x,n.z]),before);
});

test('only the enabled crowd witness setting reports a visible kill as spotted',()=>{
 for(const enabled of [true,false]){
  const {crowd}=fixture(1,enabled);
  const extra=crowd.people[0],p=player(extra.x,extra.z);
  const witnesses:string[]=[];
  crowd.witnessed=id=>witnesses.push(id);
  assert.ok(crowd.sight(p).visible>0);
  crowd.violence(p,1,'kill');
  assert.equal(witnesses.length>0,enabled);
  assert.ok(crowd.clusters.some(c=>c.origin!==null));
 }
});

test('sight inspection agrees with live perception for front, rear, solid, distance and crowd',()=>{
 const {crowd,director}=fixture();
 const n=director.npcs.find(n=>n.id==='patrol')!;
 n.pos={x:21,y:0,z:25};n.heading=Math.PI/2;n.outdoor=false;
 const inspect=(p:PlayerView,reason:string,boxes:typeof director.boxes=[])=>{
  const row={reason:'unset',visibility:0,distance:0,blockedBy:[] as string[]};
  n.perceive(p,boxes,director.rules,row);
  assert.equal(row.reason,reason);
  n.perceive(p,boxes,director.rules);
  assert.equal(row.visibility,n.visibility);
  return row;
 };
 inspect(player(27,25),'sight');
 inspect(player(16,25),'outside_cone');
 inspect(player(27,25),'solid',[{minX:24,maxX:24.2,minY:0,maxY:3,minZ:24,maxZ:26}]);
 inspect(player(100,25),'distance');
 n.crowdOcclusion=crowd.occludes;
 // 2026-11-03: the dancers moved toward the stage, so the test line runs at z=25.
 assert.ok(inspect(player(27,25),'crowd').blockedBy.includes('C2'));
});

test('club workers and guards wear the same model as the uniform they drop',()=>{
 const workers=map.npcs.filter(n=>n.role==='guard'||n.role==='waiter');
 assert.equal(workers.length,15);
 for(const n of workers){
  assert.equal((rules.m4.uniformModels as Record<string,string>)[n.outfit],n.model,n.id);
  assert.doesNotMatch((rules.disguises as Record<string,{label:string}>)[n.outfit].label,/ホテル|ビーチ/);
 }
});

// 2026-11-03 (Claude): the open stage and dancers who make way.
test('club stage: up and down the corner steps, not over the front lip',()=>{
 const {world}=fixture();
 const walk=(from:{x:number;y:number;z:number},x:number,z:number)=>{let p={...from};for(let i=0;i<400;i++){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.05)break;p=world.move(p,dx/d*Math.min(.05,d),dz/d*Math.min(.05,d));}return p;};
 const up=walk({x:18.9,y:0,z:27.5},18.9,30.6);
 assert.ok(Math.abs(up.y-.28)<1e-6&&up.z>30.5);
 const front=walk({x:24,y:0,z:28.5},24,31);
 assert.equal(front.y,0);assert.ok(front.z<30);
});

test('club dancers step aside for a walker and drift back home',()=>{
 const {crowd,director}=fixture();
 const n=crowd.people.find(p=>p.place.id==='C2')!,w=director.npcs.find(n=>n.id==='investor')!;
 w.pos={x:n.home.x+.3,y:0,z:n.home.z};w.speed=1.4;
 for(let t=0;t<2;t+=.1)crowd.step(t,player(0,0));
 assert.ok(Math.hypot(n.x-w.pos.x,n.z-w.pos.z)>1,'moved away');
 w.speed=0;w.pos={x:0,y:0,z:0};
 for(let t=2;t<40;t+=.1)crowd.step(t,player(0,0));
 assert.ok(Math.hypot(n.x-n.home.x,n.z-n.home.z)<.02,'back home');
});

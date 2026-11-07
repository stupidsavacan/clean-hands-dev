// Walk nine approaches using production movement, clothing, NPCs, schedule and score.
// Trigger: party prototype acceptance, no direct dress/teleport or NPC removal.
// Run: node --experimental-strip-types ../investigation/party-routes.ts (from app).
import {readFileSync,writeFileSync} from 'node:fs';
import {CollisionWorld,floorOf,type Position} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {Director,permission,zoneAt,type PlayerView} from '../app/src/ai.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {M3System} from '../app/src/m3.ts';
import {M4System} from '../app/src/m4.ts';
import {MissionEvents} from '../app/src/events.ts';
import {MissionClock,ScheduleSystem} from '../app/src/schedule.ts';
import {MissionFlow} from '../app/src/mission.ts';
import {ScoreLedger,computeResult} from '../app/src/score.ts';
import {PartyChances} from '../app/src/party/chances.ts';
import {PartyTraversal} from '../app/src/party/traversal.ts';
import {DetectionSystem} from '../app/src/detection.ts';
const read=(s:string)=>JSON.parse(readFileSync(new URL('../app/src/data/'+s,import.meta.url),'utf8'));
const map=read('party.json'),rules=read('party-rules.json'),results:any[]=[];
for(const scene of (process.argv[2]?[process.argv[2]]:['chandelier','papers','drink']))for(let route=0;route<(process.argv[2]?1:3);route++){
 const world=new CollisionWorld(map),nav=new NavGrid(world),d=new Director(map,world,nav,sightBoxes(map),rules),events=new MissionEvents(),clock=new MissionClock(rules.schedule,events),schedule=new ScheduleSystem(read('party-schedule.json'),map.schedulePlaces,d,clock,events),m3=new M3System(d,map.hides,rules.m3),m4=new M4System(d,map.checkpoints,rules.m4,map.hides),field=new PartyChances(d,m3,m4,clock,events,read('party-chances.json')),traversal=new PartyTraversal(d,map.traversals,map.traversalRules),det=new DetectionSystem(d,events,m3.hotel,map.cameras,read('party-detection.json'),map),ledger=new ScoreLedger(events,id=>{const n=d.npcs.find(n=>n.id===id);return n&&{role:n.role,target:n.target};});
 field.bindDetection(det);d.onSpotted=n=>events.emit({type:'player.spotted',time:clock.elapsed,id:n.id});m3.onFound=n=>events.emit({type:'body.found',time:clock.elapsed,id:n.id,life:n.life==='dead'?'dead':'unconscious',judgement:n.deathKind});
 const flow=new MissionFlow(['host'],d,events);
 let p:Position={...map.spawn,y:0},distance=0,caught=false,legs:any[]=[],spotted:any[]= [];
 const view=():PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:field.tampering||traversal.tampering,disguise:m4.disguise});
 events.on(e=>{if(e.type==='player.spotted'&&spotted.length<5)spotted.push({...e,position:{...p},disguise:m4.disguise});});
 function tick(keys=new Set<string>()) {const v=view(),dt=1/60;clock.step(dt);schedule.sync(dt);field.step(dt,v,0,keys,m3.locked||m4.locked);traversal.step(dt,v,keys,field.locked||m4.locked);const q=traversal.takeTransfer();if(q)p=q;m3.step(dt,view(),0,new Set(),field.locked||traversal.locked);m4.step(dt,view(),0,keys,field.locked||traversal.locked);const es=d.step(dt,view());if(es.some(e=>e.type==='caught')){caught=true;flow.fail('caught',clock.elapsed);}flow.update(clock.elapsed);schedule.sync(0);field.afterAi(view());det.step(dt,view(),{illegal:field.tampering,trespass:permission(rules,m4.disguise,zoneAt(map.zones,p.x,p.z,floorOf(p.y)))==='deny',carrying:false},clock.elapsed,false,keys.has('KeyE'));}
 function hold(key:string,seconds:number){tick();for(let k=0;k<Math.ceil(seconds*60);k++)tick(new Set([key]));tick();}
 function walk(q:Position){const path=nav.find(p,q);if(!path)throw new Error('歩行経路なし '+JSON.stringify(q));for(const at of path){let stall=0;for(let step=0;Math.hypot(p.x-at.x,p.z-at.z)>.06&&step<10000;step++){const dx=at.x-p.x,dz=at.z-p.z,dist=Math.hypot(dx,dz),len=Math.min(.045,dist),old=p;p=m4.constrain(p,world.move(p,dx/dist*len,dz/dist*len));distance+=Math.hypot(p.x-old.x,p.z-old.z);if(Math.hypot(p.x-old.x,p.z-old.z)<.001)stall++;else stall=0;tick();if(stall>120)throw new Error('通過できない '+JSON.stringify(p));}}if(Math.hypot(p.x-q.x,p.z-q.z,p.y-q.y)>.7)throw new Error('着地点に未到達');legs.push({at:q});}
 function link(id:string,reverse=false){const l=map.traversals.find((l:any)=>l.id===id);walk(reverse?l.end:l.start);hold('KeyE',l.seconds+.2);const q=reverse?l.start:l.end;if(Math.hypot(p.x-q.x,p.z-q.z,p.y-q.y)>.7)throw new Error('抜け道未完了 '+id);legs.push({traversal:id,reverse});}
 let frontPassed=false;if(scene==='front')field.poison=0;let error='';try{
 if(scene==='front'){walk({x:-12,y:0,z:-17.1});hold('KeyB',rules.m4.friskSeconds+4);walk({x:-12,y:0,z:-14});frontPassed=m4.stats.frisks>0&&p.z>-16;}else{
 walk({x:22,y:0,z:-19});hold('KeyT',rules.m4.changeSeconds+.2);if(m4.disguise!=='waiter')throw new Error('給仕服の正規取得失敗');walk({x:22,y:0,z:-14});walk({x:8,y:0,z:8});hold('KeyT',rules.m4.changeSeconds+.2);if(m4.disguise!=='bodyguard')throw new Error('護衛服の正規取得失敗');
 if(scene==='chandelier'){
  if(route===0){walk({x:-12,y:0,z:-8});walk({x:-12,y:0,z:2});}
  if(route===1){walk({x:0,y:0,z:-10});walk({x:0,y:0,z:2});}
  if(route===2){walk({x:22,y:0,z:16});walk({x:-8,y:0,z:16});walk({x:-8,y:0,z:10});}
  walk({x:-20,y:3.5,z:8});hold('KeyE',2.2);clock.jump(500);for(let k=0;k<3600;k++)tick();hold('KeyE',2.2);
 }else{
  if(route===0){walk({x:-20,y:3.5,z:4});walk({x:-12,y:3.5,z:4});if(scene==='drink')walk({x:0,y:3.5,z:4});}
  if(route===1)walk({x:0,y:3.5,z:-1});
  if(route===2){walk({x:-16,y:0,z:15});link('22');link(scene==='papers'?'36':'38',true);}
  walk(scene==='papers'?{x:0,y:3.5,z:6}:{x:12,y:3.5,z:6});hold('KeyE',2.2);if(scene==='papers'){walk({x:0,y:3.5,z:9});link('36');walk({x:4,y:3.5,z:11});}clock.jump(scene==='papers'?740:1040);for(let k=0;k<5400;k++)tick();
  if(scene==='papers'){walk({x:0,y:3.5,z:11});hold('KeyE',2.2);}
 }
 }}catch(e){error=String(e);}
 const host=d.npcs.find(n=>n.id==='host')!;if(host.life==='dead'&&!caught&&!error){try{if(p.y>3&&p.z>10)link('36',true);walk({x:22,y:0,z:-19});walk({x:-12,y:0,z:-20});if(Math.hypot(p.x+12,p.z+20)<2)flow.exit('E1',clock.elapsed);}catch(e){error=String(e);}}const result=computeResult(read('scoring.json'),ledger.counts,clock.elapsed,!!flow.outcome?.success&&!caught&&!error);
 const r={scene,frontPassed,route:route+1,disguise:m4.disguise,clothingChanges:m4.stats.changes,distance:+distance.toFixed(2),caught,error,killed:host.life==='dead',escaped:!!flow.outcome?.success,ghost:result.ghost,ghostBrokenBy:result.ghostBrokenBy,spotted,host:{position:host.pos,state:host.state},flags:[...field.flags],legs};results.push(r);console.log(JSON.stringify(r));
}
writeFileSync(new URL(sceneFile(),import.meta.url),JSON.stringify(results,null,2));

function sceneFile(){return process.argv[2]==='front'?'./party-front-results.json':'./party-route-results.json';}

// Stage 2 access routes: actual walking, traversal and clothing actions, with all NPCs present.
// Trigger: v2 acceptance requires clothing and suit approaches from the initial state.
// Run: node --experimental-strip-types --no-warnings ../investigation/party-v2-access.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {CollisionWorld,floorOf,type Position} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {Director,permission,zoneAt,type PlayerView} from '../app/src/ai.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {MissionClock,ScheduleSystem} from '../app/src/schedule.ts';
import {MissionEvents} from '../app/src/events.ts';
import {M3System} from '../app/src/m3.ts';import {M4System} from '../app/src/m4.ts';
import {DetectionSystem} from '../app/src/detection.ts';
import {PartyChances} from '../app/src/party/chances.ts';
import {MissionFlow} from '../app/src/mission.ts';
import {ScoreLedger,computeResult} from '../app/src/score.ts';
import {PartyTraversal} from '../app/src/party/traversal.ts';
const read=(n:string)=>JSON.parse(readFileSync(new URL('../app/src/data/'+n,import.meta.url),'utf8'));
const map=read('party.json'),rules=read('party-rules.json'),actions=read('party-actions.json');
const results=[];
for(const route of process.argv[2]?[process.argv[2]]:['chandelier-waiter','chandelier-guard','chandelier-suit','papers-bodyguard','papers-cleaner','papers-suit','drink-bodyguard','drink-waiter','drink-suit']){
 const world=new CollisionWorld(map),nav=new NavGrid(world),d=new Director(map,world,nav,sightBoxes(map),rules),events=new MissionEvents(),clock=new MissionClock(rules.schedule,events),schedule=new ScheduleSystem(read('party-schedule.json'),map.schedulePlaces,d,clock,events),m3=new M3System(d,map.hides,rules.m3),m4=new M4System(d,map.checkpoints,rules.m4,map.hides),tr=new PartyTraversal(d,map.traversals,map.traversalRules);
 const det=new DetectionSystem(d,events,m3.hotel,map.cameras,read('party-detection.json'),map);
 const field=new PartyChances(d,m3,m4,clock,events,read('party-chances.json'));field.bindDetection(det);field.poison=route==='drink-suit'?1:0;const flow=new MissionFlow(['host'],d,events),ledger=new ScoreLedger(events,id=>{const n=d.npcs.find(n=>n.id===id);return n&&{role:n.role,target:n.target};});m3.onFound=n=>events.emit({type:'body.found',time:clock.elapsed,id:n.id,life:n.life==='dead'?'dead':'unconscious',judgement:n.deathKind});let p:Position={...map.spawn,y:0},heading=0,caught=false;const spotted:any[]=[],legs:any[]=[],waits:any[]=[];d.onSpotted=n=>{events.emit({type:'player.spotted',id:n.id,time:clock.elapsed});if(!spotted.some(s=>s.id===n.id))spotted.push({id:n.id,time:clock.elapsed,p:{...p},npc:{...n.pos}});};
 const view=():PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:tr.tampering||field.tampering,disguise:m4.disguise,suspiciousItem:det.suspiciousHeld(m4.disguise)});
 function tick(keys=new Set<string>()){const dt=1/60;clock.step(dt);schedule.sync(dt);field.step(dt,view(),heading,keys,m3.locked||m4.locked||tr.locked);tr.step(dt,view(),keys,m3.locked||m4.locked||field.locked);const q=tr.takeTransfer();if(q)p=q;m3.step(dt,view(),heading,keys,tr.locked||m4.locked||field.locked);m4.step(dt,view(),heading,keys,tr.locked||m3.locked||field.locked);d.step(dt,view());schedule.sync(0);field.afterAi(view());flow.update(clock.elapsed);det.step(dt,view(),{illegal:!!m3.action||tr.tampering||field.tampering,carrying:!!m3.dragged,trespass:permission(rules,m4.disguise,zoneAt(map.zones,p.x,p.z,floorOf(p.y)))==='deny'},clock.elapsed,false,keys.has('KeyE'));if(d.caught){caught=true;flow.fail('caught',clock.elapsed);}if(spotted.length)throw Error('目撃を検出');}
 function hold(key:string,seconds:number){tick();for(let i=0;i<Math.ceil(seconds*60);i++)tick(new Set([key]));tick();}
 function wait(until:number,kind: "preparation"|"target"="preparation"){const from=clock.elapsed,at={...p};while(clock.elapsed<until)tick();if(clock.elapsed-from>1)waits.push({kind,from,to:clock.elapsed,seconds:clock.elapsed-from,at});}
 function walk(x:number,z:number,y=p.y){const goal={x,y,z},path=nav.find(p,goal);if(!path)throw Error('経路なし '+JSON.stringify(goal));for(const q of path){let stall=0;for(let i=0;Math.hypot(p.x-q.x,p.z-q.z)>.04&&i<10000;i++){const dx=q.x-p.x,dz=q.z-p.z,dist=Math.hypot(dx,dz),len=Math.min(m3.dragged?rules.m3.dragSpeed/60:.04,dist);heading=Math.atan2(dx,dz);let n=m4.constrain(p,m3.constrainMove(p,world.move(p,dx/dist*len,dz/dist*len),heading));for(const g of map.uniformGates)if(Math.abs(p.y-g.y)<.3&&p.z<=g.z&&n.z>g.z&&Math.abs(n.x-g.x)<g.width/2&&permission(rules,m4.disguise,map.zones.find((z:any)=>z.id===g.zone))!=='allow')n=p;stall=Math.hypot(n.x-p.x,n.z-p.z)<.001?stall+1:0;p=n;tick();if(stall>120)throw Error('通過不可 '+JSON.stringify({p,goal}));}}if(Math.hypot(p.x-x,p.y-y,p.z-z)>.5)throw Error('未到達');legs.push({goal,time:clock.elapsed});}
 function link(id:string,reverse=false){const l=map.traversals.find((l:any)=>l.id===id),a=reverse?l.end:l.start,b=reverse?l.start:l.end;walk(a.x,a.z,a.y);hold('KeyE',l.seconds+.15);if(Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z)>.1)throw Error('抜け道失敗 '+id);legs.push({id,time:clock.elapsed});}
 function take(){const got=det.pickup(p);if(!got)throw Error('道具なし '+JSON.stringify(p));tick();legs.push({pickup:got,time:clock.elapsed});}
 function disguise(id:string){hold('KeyT',rules.m4.changeSeconds+.2);if(m4.disguise!==id)throw Error('着替え失敗 '+id);}
 function front(){walk(25,5);heading=0;hold('KeyB',rules.m4.friskSeconds+5);walk(25,8);}
 function back(){walk(1,4);wait(90);link('X1');}
 function bodyguard(){front();walk(34,8.5,3.5);wait(90);const n=d.npcs.find(n=>n.id==='G10')!;walk(n.pos.x+1,n.pos.z,n.pos.y);hold('KeyF',rules.m3.koSeconds+.2);wait(clock.elapsed+2);disguise('bodyguard');hold('KeyE',.1);walk(34,6.4,3.5);walk(32,6.4,3.5);hold('KeyE',rules.m3.hideSeconds+.2);if(m3.stats.hidden!==1)throw Error('G10収納失敗');}
 function use(id:string){walk(actions.acts.find((a:any)=>a.id===id).at.x,actions.acts.find((a:any)=>a.id===id).at.z,actions.acts.find((a:any)=>a.id===id).at.y);hold('KeyE',actions.durations[id]+.2);if(!field.flags.has(id))throw Error('仕掛け未完了 '+id);}
 let error='';try{
 if(route==='fast-wire'){front();walk(45,12);walk(55,21);walk(53,35);wait(Number(process.argv[3]??390));link('X3');link('X6');walk(36,25,3.5);walk(39,25,3.5);walk(39,23,3.5);hold('KeyX',rules.m3.killSeconds+.2);const host=d.npcs.find(n=>n.id==='host')!;if(host.life!=='dead')throw Error('直接排除失敗');walk(39,25,3.5);walk(36,25,3.5);link('X6',true);link('X3',true);walk(53,35,0);walk(55,21);walk(45,12);walk(25,8);walk(25,2);}
 else if(route.startsWith('chandelier')){
  if(route.endsWith('guard')){front();walk(19,11.5);wait(270);const n=d.npcs.find(n=>n.id==='G09')!;walk(n.pos.x+1,n.pos.z);hold('KeyF',rules.m3.koSeconds+.2);wait(clock.elapsed+2);disguise('guard');hold('KeyE',.1);walk(18,12.9);hold('KeyE',rules.m3.hideSeconds+.2);if(!m3.stats.hidden)throw Error('G09収納失敗');walk(4,26);}
  else{back();if(route.endsWith('waiter')){walk(3,10.9);disguise('waiter');walk(4,26);}else{walk(8,23);walk(8,32);}}
  wait(150);walk(4,39);take();
  if(route.endsWith('suit')){walk(8,32);wait(160);link('X2');walk(12,38.4,0);walk(12,42,0);walk(18.5,42,0);link('X4');}
  else{if(route.endsWith('waiter'))wait(240);walk(18,35,0);walk(16,39,3.5);}
  wait(route.endsWith('suit')?370:330);use('chandelier');det.putDown(p);
  // 2026-11-03: G06 walks back to U2 at 7:00-7:20 with A2 in view (it passed before only because a crowd one floor
  // below was counted as cover). The suit route steps down X4 until he is at his post, then comes back up.
  if(route.endsWith('suit')){link('X4',true);wait(445);link('X4');}
  walk(19,33,3.5);wait(570,'target');use('release');
  if(route.endsWith('suit')){link('X4',true);walk(18.5,42,0);walk(30,42);walk(53,35);walk(55,21);walk(45,12);walk(25,8);walk(25,2);}else{walk(16,39,3.5);walk(16,31,0);walk(4,26);link('X1',true);walk(2,2,0);}
 }else if(route.startsWith('papers')){
  if(route.endsWith('bodyguard')){bodyguard();wait(480);walk(36,14,3.5);walk(34,22,3.5);}
  else if(route.endsWith('cleaner')){back();walk(3,10.9);disguise('waiter');walk(4,26);walk(8,38);walk(18,35);walk(16,39,3.5);wait(330);walk(24,22,3.5);disguise('cleaner');link('X5',true);walk(29,27,3.5);wait(480);link('X6');walk(34,22,3.5);}
  else{front();walk(45,12);walk(55,21);walk(53,35);wait(480);link('X3');link('X6');}
  use('papers');link('X6',true);walk(29,27,3.5);wait(695,'target');use('push');link('X3',true);walk(53,35,0);walk(55,21);walk(45,12);walk(25,8);walk(25,2);
 }else{
  if(route.endsWith('bodyguard')){bodyguard();walk(25,10,3.5);walk(16,10,0);walk(12,27,-3.5);take();walk(12,39,0);walk(16,39,3.5);wait(660);walk(18,14,3.5);walk(26,12.5,3.5);walk(29,12.5,3.5);walk(30,15.5,3.5);walk(36,15.5,3.5);walk(44,14,3.5);walk(46,22,3.5);}
  else if(route.endsWith('waiter')){back();walk(3,10.9);disguise('waiter');walk(4,26);walk(12,27,-3.5);take();walk(12,39,0);walk(16,39,3.5);wait(660);walk(18,14,3.5);walk(26,12.5,3.5);walk(29,12.5,3.5);walk(30,15.5,3.5);walk(36,15.5,3.5);walk(44,14,3.5);walk(46,22,3.5);}
  else{back();walk(3,10.9);walk(4,26);walk(8,43);walk(30,40);walk(48,39);wait(660);link('X3');link('X7');}
  use('drink');link('X7',true);link('X3',true);walk(53,35,0);walk(55,21);walk(45,12);walk(25,8);walk(25,2);const from=clock.elapsed,at={...p};while(d.npcs.find(n=>n.id==='host')!.life!=='dead'&&clock.elapsed<900)tick();waits.push({kind:'target',from,to:clock.elapsed,seconds:clock.elapsed-from,at});
 }
 if(!flow.remaining().length&&!caught){const exit=map.exits.find((e:any)=>Math.hypot(p.x-e.x,p.z-e.z)<e.radius&&floorOf(p.y)===e.floor);if(!exit)throw Error('出口未到達');flow.exit(exit.id,clock.elapsed);}
 else throw Error('標的生存または捕縛');
 }catch(e){error=String(e);}
 const score=computeResult(read('scoring.json'),ledger.counts,clock.elapsed,!!flow.outcome?.success&&!error);const result={route,error,waitingPassed:waits.every(w=>w.seconds<=(w.kind==='target'?240:90)+.02),ghost:score.ghost,ghostBrokenBy:score.ghostBrokenBy,counts:Object.fromEntries(ledger.counts),kills:field.kills,caught,spotted,disguise:m4.disguise,changes:m4.stats.changes,recorded:det.recorded,hidden:m3.stats.hidden,position:p,seconds:clock.elapsed,waits,legs};results.push(result);console.log(JSON.stringify(result));
}
writeFileSync(new URL('party-v2-route-results'+(process.argv[2]?'-'+process.argv[2]+(process.argv[3]?'-'+process.argv[3]:''):'')+'.json',import.meta.url),JSON.stringify(results,null,2));








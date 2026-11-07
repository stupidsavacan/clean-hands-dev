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
import {PartyTraversal} from '../app/src/party/traversal.ts';
const read=(n:string)=>JSON.parse(readFileSync(new URL('../app/src/data/'+n,import.meta.url),'utf8'));
const map=read('party.json'),rules=read('party-rules.json'),actions=read('party-actions.json');
const results=[];
for(const route of process.argv[2]?[process.argv[2]]:['waiter','bodyguard','cleaner','suit-chandelier','suit-papers','suit-drink']){
 const world=new CollisionWorld(map),nav=new NavGrid(world),d=new Director(map,world,nav,sightBoxes(map),rules),events=new MissionEvents(),clock=new MissionClock(rules.schedule,events),schedule=new ScheduleSystem(read('party-schedule.json'),map.schedulePlaces,d,clock,events),m3=new M3System(d,map.hides,rules.m3),m4=new M4System(d,map.checkpoints,rules.m4,map.hides),tr=new PartyTraversal(d,map.traversals,map.traversalRules);
 const det=new DetectionSystem(d,events,m3.hotel,map.cameras,read('party-detection.json'),map);
 m4.clothes.push(...structuredClone(actions.clothes));let p:Position={...map.spawn,y:0},heading=0,caught=false;const spotted:any[]=[],legs:any[]=[];d.onSpotted=n=>{if(!spotted.some(s=>s.id===n.id))spotted.push({id:n.id,time:clock.elapsed,p:{...p},npc:{...n.pos}});};
 const view=():PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:tr.tampering,disguise:m4.disguise});
 function tick(keys=new Set<string>()){const dt=1/60;clock.step(dt);schedule.sync(dt);tr.step(dt,view(),keys,m3.locked||m4.locked);const q=tr.takeTransfer();if(q)p=q;m3.step(dt,view(),heading,keys,tr.locked||m4.locked);m4.step(dt,view(),heading,keys,tr.locked||m3.locked);d.step(dt,view());schedule.sync(0);det.step(dt,view(),{illegal:!!m3.action||tr.tampering,carrying:!!m3.dragged,trespass:permission(rules,m4.disguise,zoneAt(map.zones,p.x,p.z,floorOf(p.y)))==='deny'},clock.elapsed,false,keys.has('KeyE'));if(d.caught)caught=true;}
 function hold(key:string,seconds:number){tick();for(let i=0;i<Math.ceil(seconds*60);i++)tick(new Set([key]));tick();}
 function wait(until:number){while(clock.elapsed<until)tick();}
 function walk(x:number,z:number,y=p.y){const goal={x,y,z},path=nav.find(p,goal);if(!path)throw Error('経路なし '+JSON.stringify(goal));for(const q of path){let stall=0;for(let i=0;Math.hypot(p.x-q.x,p.z-q.z)>.04&&i<10000;i++){const dx=q.x-p.x,dz=q.z-p.z,dist=Math.hypot(dx,dz),len=Math.min(.04,dist);heading=Math.atan2(dx,dz);let n=m4.constrain(p,m3.constrainMove(p,world.move(p,dx/dist*len,dz/dist*len),heading));for(const g of map.uniformGates)if(Math.abs(p.y-g.y)<.3&&p.z<=g.z&&n.z>g.z&&Math.abs(n.x-g.x)<g.width/2&&permission(rules,m4.disguise,map.zones.find((z:any)=>z.id===g.zone))!=='allow')n=p;stall=Math.hypot(n.x-p.x,n.z-p.z)<.001?stall+1:0;p=n;tick();if(stall>120)throw Error('通過不可 '+JSON.stringify({p,goal}));}}if(Math.hypot(p.x-x,p.y-y,p.z-z)>.5)throw Error('未到達');legs.push({goal,time:clock.elapsed});}
 function link(id:string,reverse=false){const l=map.traversals.find((l:any)=>l.id===id),a=reverse?l.end:l.start,b=reverse?l.start:l.end;walk(a.x,a.z,a.y);hold('KeyE',l.seconds+.15);if(Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z)>.1)throw Error('抜け道失敗 '+id);legs.push({id,time:clock.elapsed});}
 let error='';try{
 if(route==='bodyguard'||route==='suit-papers'){
  walk(25,5);heading=0;hold('KeyB',rules.m4.friskSeconds+5);walk(25,8);
  if(route==='bodyguard'){walk(34,8.5,3.5);wait(270);const n=d.npcs.find(n=>n.id==='G10')!;walk(n.pos.x+1,n.pos.z,n.pos.y);hold('KeyF',rules.m3.koSeconds+.2);wait(clock.elapsed+2);hold('KeyT',rules.m4.changeSeconds+.2);if(m4.disguise!=='bodyguard')throw Error('護衛服未取得 '+JSON.stringify({life:n.life,heading:n.heading,can:m3.canAttack(p,n),m3:m3.stats,notices:m3.notices,pos:n.pos}));}
  else{walk(45,12);walk(55,21);walk(53,35);wait(780);link('X3');link('X6');walk(34,22,3.5);}
 }else{
  walk(1,4);wait(90);link('X1');if(route!=='suit-chandelier')walk(3,10.9);
  if(route==='waiter'||route==='cleaner'){hold('KeyT',rules.m4.changeSeconds+.2);if(m4.disguise!=='waiter')throw Error('給仕服未取得');walk(4,26);walk(8,38);walk(18,35);walk(16,39,3.5);if(route==='cleaner'){wait(330);walk(24,22,3.5);hold('KeyT',rules.m4.changeSeconds+.2);if(m4.disguise!=='cleaner')throw Error('清掃服未取得');}else walk(19,30,3.5);}
  else if(route==='suit-chandelier'){walk(8,23);walk(8,32);wait(270);link('X2');walk(12,39,0);link('X4');walk(19,30,3.5);}
  else{walk(4,26);walk(8,43);walk(30,40);walk(48,39);wait(1080);link('X3');link('X7');walk(46,22,3.5);}
 }
 }catch(e){error=String(e);}
 const result={route,error,caught,spotted,disguise:m4.disguise,changes:m4.stats.changes,recorded:det.recorded,hidden:m3.stats.hidden,position:p,seconds:clock.elapsed,legs};results.push(result);console.log(JSON.stringify(result));
}
writeFileSync(new URL('party-v2-access-results'+(process.argv[2]?'-'+process.argv[2]:'')+'.json',import.meta.url),JSON.stringify(results,null,2));





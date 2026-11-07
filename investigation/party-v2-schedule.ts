// Verify the full 30-minute party schedule with production AI, crowd separation and collision.
// Trigger: v2 stage 2 acceptance; planned coordinates alone do not prove arrival.
// Run from app: node --experimental-strip-types --no-warnings ../investigation/party-v2-schedule.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {CollisionWorld,floorOf} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {Director,permission,zoneAt} from '../app/src/ai.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {MissionEvents} from '../app/src/events.ts';
import {MissionClock,ScheduleSystem,validateSchedule} from '../app/src/schedule.ts';
const read=(n:string)=>JSON.parse(readFileSync(new URL('../app/src/data/'+n,import.meta.url),'utf8'));
const map=read('party.json'),rules=read('party-rules.json'),data=read('party-schedule.json'),world=new CollisionWorld(map),nav=new NavGrid(world),d=new Director(map,world,nav,sightBoxes(map),rules),events=new MissionEvents(),clock=new MissionClock(rules.schedule,events),schedule=new ScheduleSystem(data,map.schedulePlaces,d,clock,events);
const timeouts=new Map(),blocked=new Map(),denied=new Map(),arrivals=new Map();
const player={...map.spawn,y:0,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
for(let i=0;i<1800*30;i++){
 clock.step(1/30);schedule.sync(1/30);d.step(1/30,player);schedule.sync(0);
 for(const s of schedule.states.values()){const key=s.id+':'+s.slot,n=d.npcs.find(n=>n.id===s.id)!;
  if(s.timedOut&&!timeouts.has(key))timeouts.set(key,{...s,at:{...n.pos},goal:map.schedulePlaces[s.place]});
  if(s.phase==='acting'&&!arrivals.has(key))arrivals.set(key,{id:s.id,slot:s.slot,travel:s.travel});
  if(i%30===0){if(world.blocked(n.pos.x,n.pos.y,n.pos.z,1.7)&&!blocked.has(key))blocked.set(key,{id:s.id,time:clock.elapsed,at:{...n.pos}});
   const z=zoneAt(map.zones,n.pos.x,n.pos.z,floorOf(n.pos.y));if(n.id!=='host'&&permission(rules,n.outfit!,z)==='deny'&&!denied.has(key))denied.set(key,{id:s.id,time:clock.elapsed,zone:z?.id,outfit:n.outfit,at:{...n.pos}});}
 }
 if(i%(300*30)===0)console.log(JSON.stringify({time:clock.elapsed,timeouts:timeouts.size,blocked:blocked.size,denied:denied.size}));
}
const result={npcs:d.npcs.length,validation:validateSchedule(data,map.schedulePlaces,d,rules.schedule),timeouts:[...timeouts.values()],blocked:[...blocked.values()],denied:[...denied.values()],arrivals:[...arrivals.values()]};
writeFileSync(new URL('party-v2-schedule-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({npcs:result.npcs,validation:result.validation,timeouts:timeouts.size,blocked:blocked.size,denied:denied.size,arrivals:arrivals.size}));


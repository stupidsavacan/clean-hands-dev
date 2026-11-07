// Verify the full 30-minute club schedule with production AI, crowd separation and collision.
// Trigger: club stage 2 acceptance; planned coordinates alone do not prove arrival.
// Run from app: node --experimental-strip-types --no-warnings ../investigation/club-stage2-schedule.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {CollisionWorld,floorOf} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {Director,permission,zoneAt} from '../app/src/ai.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {MissionEvents} from '../app/src/events.ts';
import {MissionClock,validateSchedule} from '../app/src/schedule.ts';
import {ClubSchedule} from '../app/src/club/schedule.ts';
const read=(n:string)=>JSON.parse(readFileSync(new URL('../app/src/data/'+n,import.meta.url),'utf8'));
const map=read('club-map.json'),rules=read('club-rules.json'),data=read('club-schedule.json'),world=new CollisionWorld(map),nav=new NavGrid(world),d=new Director(map,world,nav,sightBoxes(map),rules),events=new MissionEvents(),clock=new MissionClock(rules.schedule,events),schedule=new ClubSchedule(data,map.schedulePlaces,d,clock,events,map.traversals[0]);
const timeouts=new Map(),blocked=new Map(),denied=new Map(),arrivals=new Map();
const stairSamples={front:0,service:0};
let ladderSamples=0;
const departuresByRoute=new Map<string,number>();
let simultaneousRoute=0;
const lanes=new Map<string,number>();
const player={...map.spawn,y:0,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
for(let i=0;i<1800*30-1;i++){
 clock.step(1/30);schedule.sync(1/30);schedule.step(1/30);d.step(1/30,player);schedule.sync(0);
 const movingByRoute=new Map<string,number>();
 for(const s of schedule.states.values()){const key=s.id+':'+s.slot,n=d.npcs.find(n=>n.id===s.id)!;
  if(s.timedOut&&!timeouts.has(key))timeouts.set(key,{...s,at:{...n.pos},goal:map.schedulePlaces[s.place]});
  if(s.phase==='acting'&&!arrivals.has(key))arrivals.set(key,{id:s.id,slot:s.slot,travel:s.travel});
  if(i%3===0&&n.pos.y<.15&&n.speed>.45){const cell=Math.round(n.pos.x*4)+','+Math.round(n.pos.z*4);lanes.set(cell,(lanes.get(cell)??0)+1);}
  if(n.id==='bottle_server'&&n.pos.y>.05&&n.pos.y<3.45){
   if(n.pos.x>=12&&n.pos.x<=14)stairSamples.front++;
   if(n.pos.x>=4&&n.pos.x<=6)stairSamples.service++;
  }
  if(n.id==='technician'&&n.busy)ladderSamples++;
  if(world.blocked(n.pos.x,n.pos.y,n.pos.z,1.7)&&!blocked.has(key))blocked.set(key,{id:s.id,time:clock.elapsed,at:{...n.pos}});
  if(i%30===0){
   const actor=schedule.data.actors[n.id];
   const plan=actor.follow?schedule.data.actors[actor.follow].plan:actor.plan;
   if(s.phase==='moving'&&s.slot>0){
    const route=[map.schedulePlaces[plan[s.slot-1].place].label,map.schedulePlaces[s.place].label].join(':');
    const count=(movingByRoute.get(route)??0)+1;movingByRoute.set(route,count);
    simultaneousRoute=Math.max(simultaneousRoute,count);
   }
   const z=zoneAt(map.zones,n.pos.x,n.pos.z,floorOf(n.pos.y));if(!n.busy&&permission(rules,n.outfit!,z)==='deny'&&!denied.has(key))denied.set(key,{id:s.id,time:clock.elapsed,zone:z?.id,outfit:n.outfit,at:{...n.pos}});}
 }
 if(i%(300*30)===0)console.log(JSON.stringify({time:clock.elapsed,timeouts:timeouts.size,blocked:blocked.size,denied:denied.size}));
}
const departures=new Map<number,string[]>();
let planned=0;
const missed=[];
for(const [id,actor] of Object.entries(schedule.data.actors)){
 const plan=actor.follow?schedule.data.actors[actor.follow].plan:actor.plan;
 for(const [index,entry] of plan.entries()){
  if(!actor.follow){
   planned++;
   if(!arrivals.has(id+':'+index))missed.push({id,index,entry,goal:map.schedulePlaces[entry.place]});
  }
  if(index===0)continue;
  const route=[entry.from,map.schedulePlaces[plan[index-1].place].label,map.schedulePlaces[entry.place].label].join(':');
  departuresByRoute.set(route,(departuresByRoute.get(route)??0)+1);
  if(!id.startsWith('guest_'))continue;
  const ids=departures.get(entry.from)??[];ids.push(id);departures.set(entry.from,ids);
 }
}
const burst=Math.max(...[...departures.values()].map(ids=>ids.length));
const sameRoute=Math.max(...departuresByRoute.values());
const result={planned,missed,burst,sameRoute,simultaneousRoute,stairSamples,ladderSamples,npcs:d.npcs.length,validation:validateSchedule(data,map.schedulePlaces,d,rules.schedule),timeouts:[...timeouts.values()],blocked:[...blocked.values()],denied:[...denied.values()],arrivals:[...arrivals.values()]};
writeFileSync(new URL('club-stage2-schedule-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({npcs:result.npcs,validation:result.validation,timeouts:timeouts.size,blocked:blocked.size,denied:denied.size,arrivals:arrivals.size,planned,missed:missed.length,burst,sameRoute,simultaneousRoute,stairSamples,ladderSamples}));
if(process.argv.includes('--lanes'))writeFileSync(new URL('club-crowd-lanes.json',import.meta.url),JSON.stringify([...lanes].filter(([,count])=>count>=15).map(([cell])=>cell).sort())+'\n');
if(result.validation.length||timeouts.size||blocked.size||denied.size||missed.length||sameRoute>2||burst>2||stairSamples.front||!stairSamples.service||!ladderSamples)process.exitCode=1;


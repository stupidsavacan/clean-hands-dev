// The observatory without a browser (2026-11-13): the real map, people, schedule, doors and mission script, stepped
// the way engine/game.ts steps them. Tests and scripts/observatory-run.ts use it.
import {Director,type Mission,type PlayerView,type Rules} from '../src/ai.ts';
import {DoorSystem,type DoorDef} from '../src/doors.ts';
import {TraversalSchedule,type NpcTraversal} from '../src/engine/schedule.ts';
import {applyDarkZones} from '../src/engine/lighting.ts';
import {MissionEvents} from '../src/events.ts';
import {M3System} from '../src/m3.ts';
import {M4System} from '../src/m4.ts';
import {NavGrid} from '../src/nav.ts';
import {MissionClock,type ScheduleData} from '../src/schedule.ts';
import {sightBoxes} from '../src/sight.ts';
import {CollisionWorld} from '../src/world.ts';
import {buildGameMap,type MapLayout} from '../src/map-layout.ts';
import {ObservatoryWorld,type SystemsDef} from '../src/observatory/world.ts';
import {ObservatoryScript,type ObservatoryConfig} from '../src/observatory/script.ts';
import layout from '../src/data/observatory-layout.json' with {type:'json'};
import plans from '../src/data/observatory-schedule.json' with {type:'json'};
import systems from '../src/data/observatory-systems.json' with {type:'json'};
import config from '../src/data/observatory-mission.json' with {type:'json'};
import rules from '../src/data/club-rules.json' with {type:'json'};

export const STEP=1/30;
export function observatory(){
 const map=buildGameMap(layout as unknown as MapLayout&Record<string,unknown>,{section:{id:'observatory',label:'天文台',surface:'asphalt'}});
 const mission=map as unknown as Mission,world=new CollisionWorld(mission),boxes=sightBoxes(mission);
 const director=new Director(mission,world,new NavGrid(world),boxes,rules as Rules);
 const doors=new DoorSystem(world,boxes,layout.doors as DoorDef[]);
 director.doors=doors;director.soundClear=(at,listener)=>doors.soundClear(at,listener);
 const events=new MissionEvents(),clock=new MissionClock(rules.schedule,events);
 const schedule=new TraversalSchedule(plans as unknown as ScheduleData,layout.schedulePlaces,director,clock,events,layout.traversals as unknown as NpcTraversal[]);
 const m3=new M3System(director,[],rules.m3 as never),m4=new M4System(director,[],rules.m4 as never,[]);
 const sim=new ObservatoryWorld(systems as unknown as SystemsDef);
 let hurt=0;
 const script=new ObservatoryScript({director,m3,m4,clock,events,schedule,doors,hurt:n=>{hurt+=n;}},sim,config as unknown as ObservatoryConfig);
 // The player stands in the car park unless a test moves them.
 const player:PlayerView={x:14,y:0,z:1.5,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
 const crowd={zoneSight:{}};
 const notices:string[]=[];
 const run=(seconds:number,each?:()=>void)=>{
  for(let t=0;t<seconds-1e-9;t+=STEP){
   clock.step(STEP);script.beforeAi();applyDarkZones(director,crowd,script.darkZones());
   schedule.sync(STEP);schedule.step(STEP);director.step(STEP,player);schedule.sync(0);
   script.afterAi(player);
   for(const n of script.notices)notices.push(Math.round(clock.elapsed)+' '+n);
   if(script.reactionUntil>clock.elapsed&&notices.at(-1)!==script.reactionText&&!notices.includes(script.reactionText))notices.push(script.reactionText);
   script.notices=[];each?.();
  }
 };
 const npc=(id:string)=>{const n=director.npcs.find(n=>n.id===id);if(!n)throw new Error('no npc '+id);return n;};
 return {director,doors,events,clock,schedule,script,sim,player,notices,run,npc,get hurt(){return hurt;}};
}

// 2026-11-10 (Issue #1): engine features that used to know club ids, checked with ids the club does not have.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Director,type Mission,type Rules} from '../src/ai.ts';
import {TraversalSchedule,type NpcTraversal} from '../src/engine/schedule.ts';
import {MissionEvents} from '../src/events.ts';
import {NavGrid} from '../src/nav.ts';
import {MissionClock,type ScheduleData} from '../src/schedule.ts';
import {sightBoxes} from '../src/sight.ts';
import {CollisionWorld,floorOf} from '../src/world.ts';
import map from '../src/data/club-map.json' with {type:'json'};
import rules from '../src/data/club-rules.json' with {type:'json'};

function stage(npcs:{id:string;at:[number,number]}[],links:NpcTraversal[],places:Record<string,{x:number;y:number;z:number}>,plans:Record<string,string>){
 const base=map.npcs[0];
 const mission={...map,npcs:npcs.map(n=>({...base,id:n.id,label:n.id,route:[[n.at[0],n.at[1],0]],floor:0}))} as unknown as Mission;
 const world=new CollisionWorld(mission),director=new Director(mission,world,new NavGrid(world),sightBoxes(mission),rules as Rules);
 const loop=rules.schedule.loop,events=new MissionEvents(),clock=new MissionClock(rules.schedule,events);
 const allPlaces=Object.fromEntries(Object.entries(places).map(([k,p])=>[k,{...p,heading:0,label:k,outdoor:false}]));
 const data:ScheduleData={actors:Object.fromEntries(Object.entries(plans).map(([id,place])=>[id,{plan:[{from:0,to:loop,place,do:'work'}]}]))};
 const schedule=new TraversalSchedule(data,allPlaces,director,clock,events,links);
 const far={x:0,y:0,z:0,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
 const run=(seconds:number)=>{for(let t=0;t<seconds;t+=1/30){clock.step(1/30);schedule.sync(1/30);schedule.step(1/30);director.step(1/30,far);schedule.sync(0);}};
 return {director,schedule,run,npc:(id:string)=>director.npcs.find(n=>n.id===id)!};
}

test('any scheduled NPC climbs whichever listed ladder is nearest, and two climb at once',()=>{
 const [club]=map.traversals as NpcTraversal[];
 // A second shaft ladder that is not the club's, used by two NPCs the club does not have.
 const west:NpcTraversal={id:'W9',a:'',b:'',kind:'ladder',users:['rigger_a','rigger_b'],start:{x:24,y:0,z:27.3},via:[{x:24,y:3.5,z:27.3}],end:{x:24,y:3.5,z:28.8}};
 const g=stage([{id:'rigger_a',at:[25,24]},{id:'rigger_b',at:[34.7,31.5]}],[{...club,users:['rigger_b']},west],
  {catwalk_a:{x:26,y:3.5,z:29},catwalk_b:{x:30,y:3.5,z:29.2}},{rigger_a:'catwalk_a',rigger_b:'catwalk_b'});
 let both=false;
 for(let i=0;i<40&&!(floorOf(g.npc('rigger_a').pos.y)===1&&floorOf(g.npc('rigger_b').pos.y)===1);i++){
  g.run(.5);
  if(g.schedule.climbing('rigger_a')&&g.schedule.climbing('rigger_b'))both=true;
  const a=g.schedule.climbing('rigger_a'),b=g.schedule.climbing('rigger_b');
  if(a)assert.equal(a.link.id,'W9');
  if(b)assert.equal(b.link.id,club.id);
 }
 assert.equal(floorOf(g.npc('rigger_a').pos.y),1);
 assert.equal(floorOf(g.npc('rigger_b').pos.y),1);
 assert.ok(both,'the two climbs overlapped');
 // Off the ladder they walk on to their places.
 g.run(12);
 assert.ok(Math.hypot(g.npc('rigger_a').pos.x-26,g.npc('rigger_a').pos.z-29)<1.2);
});

test('an NPC not listed on a ladder never uses it, and one knocked out on it stays put',()=>{
 const [club]=map.traversals as NpcTraversal[];
 const g=stage([{id:'walker',at:[34.7,31.5]},{id:'rigger',at:[34.7,32.5]}],[{...club,users:['rigger']}],
  {up:{x:30,y:3.5,z:29.2}},{walker:'up',rigger:'up'});
 g.run(2);
 assert.equal(g.schedule.climbing('walker'),undefined);
 for(let i=0;i<40&&!g.schedule.climbing('rigger');i++)g.run(.25);
 g.run(1);
 const rigger=g.npc('rigger'),y=rigger.pos.y;
 assert.ok(rigger.traversal&&y>.3,'mid-climb');
 rigger.life='unconscious';g.run(1);
 assert.equal(g.schedule.climbing('rigger'),undefined);
 assert.equal(rigger.traversal,null);
 assert.equal(rigger.busy,false);
});

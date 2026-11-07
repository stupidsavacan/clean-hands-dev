// Check the three existing routes from club design §5.3 on the production map.
// Run from app: node --experimental-strip-types --no-warnings ../investigation/club-stage3-routes.ts
import assert from 'node:assert/strict';
import {Director,permission,type Mission,type PlayerView,type Rules} from '../app/src/ai.ts';
import {ClubSchedule} from '../app/src/club/schedule.ts';
import {MissionClock} from '../app/src/schedule.ts';
import {MissionEvents} from '../app/src/events.ts';
import {NavGrid} from '../app/src/nav.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {CollisionWorld,floorOf,type Position} from '../app/src/world.ts';
import map from '../app/src/data/club-map.json' with {type:'json'};
import rules from '../app/src/data/club-rules.json' with {type:'json'};
import plans from '../app/src/data/club-schedule.json' with {type:'json'};
import actions from '../app/src/data/club-actions.json' with {type:'json'};

const mission=map as unknown as Mission,world=new CollisionWorld(mission),nav=new NavGrid(world);
const director=new Director(mission,world,nav,sightBoxes({...mission,walls:mission.walls.filter(w=>!map.collisionOnlyIds.includes(w.id))}),rules as Rules);
const events=new MissionEvents(),clock=new MissionClock(rules.schedule,events);
const schedule=new ClubSchedule(plans,map.schedulePlaces,director,clock,events,map.traversals[0]);
const player:PlayerView={...map.spawn,y:0,floor:0,disguise:'suit',speed:0,running:false,crouched:false,tampering:false};
const investor=director.npcs.find(n=>n.id==='investor')!,escort=director.npcs.find(n=>n.id==='escort')!;
const zone=(p:Position)=>director.zone({...player,...p,floor:floorOf(p.y)});
const dt=1/30;
function run(seconds:number,onStep=()=>{}){
 for(let i=0;i<seconds/dt;i++){
  clock.step(dt);schedule.sync(dt);schedule.step(dt);director.step(dt,player);schedule.sync(0);onStep();
 }
}

clock.jump(75);
const bottle=director.npcs.find(n=>n.id==='bottle_server')!;
let rearSteps=0;
const denied=new Set<string>();
run(26,()=>{
 if(bottle.pos.x>=4&&bottle.pos.x<=6&&bottle.pos.y>.1&&bottle.pos.y<3.4)rearSteps++;
 const at=zone(bottle.pos);
 if(permission(rules as Rules,'bottle_server',at)==='deny')denied.add(at?.id??'');
});
assert.ok(rearSteps>0&&bottle.pos.y===3.5);
console.log(JSON.stringify({route:'vip_bottle',rearStair:rearSteps>0,position:bottle.pos,denied:[...denied],acts:actions.acts.map(a=>a.id)}));

clock.jump(865);run(45);
assert.equal(zone(investor.pos)?.id,'E');
console.log(JSON.stringify({route:'toilet',time:clock.time,investor:investor.pos,escort:escort.pos,escortZone:zone(escort.pos)?.id,
 distance:Math.hypot(investor.pos.x-escort.pos.x,investor.pos.z-escort.pos.z)}));

clock.jump(0);run(25);
const door={x:14.6,y:3.5,z:29},vip={x:13,y:3.5,z:29};
assert.ok(nav.clear(door,vip));
// Use the same collision clearance as the live coin along each sample of the throw.
const angle=Math.PI/2,aimDistance=3;
let landing=door;
for(let d=.3;d<=aimDistance;d+=.25){
 const next={x:door.x+Math.sin(angle)*d,y:door.y,z:door.z+Math.cos(angle)*d};
 if(!nav.clear(landing,next))break;
 landing=next;
}
assert.ok(landing.x>door.x+2);
assert.equal(director.noise(landing)?.id,'escort');
const before={...escort.pos};
run(5);
assert.ok(Math.hypot(escort.pos.x-before.x,escort.pos.z-before.z)>.5);
console.log(JSON.stringify({route:'catwalk',door,vip,angle,aimDistance,landing,guard:escort.id,from:before,to:escort.pos,
 state:escort.state,technicianInVip:permission(rules as Rules,'technician',zone(vip))}));

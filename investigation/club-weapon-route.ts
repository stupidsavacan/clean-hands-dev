// Check for a walkable route around the club's front frisk with the same gun as run 143131.
// Run in app: node --experimental-strip-types --no-warnings ../investigation/club-weapon-route.ts
import assert from 'node:assert/strict';
import {Director,type Mission,type Rules} from '../app/src/ai.ts';
import {M4System,type Checkpoint} from '../app/src/m4.ts';
import {NavGrid} from '../app/src/nav.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {CollisionWorld} from '../app/src/world.ts';
import map from '../app/src/data/club-map.json' with {type:'json'};
import rules from '../app/src/data/club-rules.json' with {type:'json'};
import weapons from '../app/src/data/weapons.json' with {type:'json'};
import {itemMaster} from '../app/src/items.ts';

const mission=map as unknown as Mission,world=new CollisionWorld(mission),nav=new NavGrid(world);
const director=new Director(mission,world,nav,sightBoxes(mission),rules as Rules);
const m4=new M4System(director,map.checkpoints as Checkpoint[],rules.m4);
m4.items=itemMaster(weapons,rules.m4.items);
m4.extraInventory=()=>['pistol_silenced'];
assert.equal(m4.passed(m4.checkpoints[0]),false);
const openings:number[]=[],bypass:number[]=[];
for(let cm=0;cm<=4800;cm+=5){
 const x=cm/100,start={x,y:0,z:5.5};
 if(world.blocked(start.x,start.y,start.z))continue;
 let walk=start,armed=start;
 for(let i=0;i<20;i++){
  walk=world.move(walk,0,.05);
  armed=m4.constrain(armed,world.move(armed,0,.05));
 }
 if(walk.z>6.4)openings.push(x);
 if(armed.z>6.4)bypass.push(x);
}
assert.ok(openings.length);
assert.deepEqual(bypass,[]);
console.log(JSON.stringify({streetBoundaryZ:6,walkableOpeningX:[openings[0],openings.at(-1)],samples:openings.length,armedBypass:bypass}));

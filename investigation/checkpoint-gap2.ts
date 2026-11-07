// Scan for a way past either end of the lobby line: walk from the public lobby, slide toward the stairs
// at each depth, then try to climb. Each step uses world.move followed by m4.constrain.
// Trigger: 20261031-232600 memo at 0:18, (6.0, -3.7).
// Run from app/: node --experimental-strip-types --no-warnings ../investigation/checkpoint-gap2.ts
import {readFileSync} from 'node:fs';
import {Director} from '../app/src/ai.ts';
import {CollisionWorld, type Position} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {M4System} from '../app/src/m4.ts';
const json=(name:string)=>JSON.parse(readFileSync(new URL(`../app/src/data/${name}.json`,import.meta.url),'utf8'));
const hotel=json('hotel'),rules=json('rules'),world=new CollisionWorld(hotel),d=new Director(hotel,world,new NavGrid(world),sightBoxes(hotel),rules),m=new M4System(d,hotel.checkpoints,rules.m4);
const go=(p:Position,x:number,z:number)=>{for(let i=0;i<400;i++){const dx=x-p.x,dz=z-p.z,l=Math.hypot(dx,dz);if(l<.05)break;const s=Math.min(.05,l),q=m.constrain(p,world.move(p,dx/l*s,dz/l*s));if(Math.hypot(q.x-p.x,q.z-p.z)<1e-4&&q.y===p.y)break;p=q;}return p;};
for(const side of [-1,1])for(const z of [-3.45,-3.55,-3.65,-3.75,-3.85,-3.95]){
 const x=8+side*2.6;let p=go({x,y:0,z:-2},x,z);p=go(p,8,z);const q=go({...p},8,-11);
 console.log(JSON.stringify({side:side<0?'west':'east',z,slid:[+p.x.toFixed(2),+p.z.toFixed(2)],climb:[+q.x.toFixed(2),+q.y.toFixed(2),+q.z.toFixed(2)],upstairs:q.y>3}));
}

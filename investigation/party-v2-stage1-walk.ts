// Walk both directions of every flight, and reach all hide fronts using the real party collision/nav.
// Trigger: v1 staircase and invisible-floor memos; stage-one acceptance.
// Run from app: node --experimental-strip-types --no-warnings ../investigation/party-v2-stage1-walk.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {CollisionWorld,type Position} from '../app/src/world.ts';import {NavGrid} from '../app/src/nav.ts';
const map=JSON.parse(readFileSync(new URL('../app/src/data/party.json',import.meta.url),'utf8')),world=new CollisionWorld(map),nav=new NavGrid(world);
function walk(a:Position,b:Position){const path=nav.find(a,b);if(!path)return {ok:false,reason:'no path',a,b};let p={...a},distance=0;for(const q of path){let stall=0;while(Math.hypot(q.x-p.x,q.z-p.z)>.025){const len=Math.hypot(q.x-p.x,q.z-p.z),step=Math.min(.05,len),n=world.move(p,(q.x-p.x)/len*step,(q.z-p.z)/len*step);const moved=Math.hypot(n.x-p.x,n.z-p.z);distance+=moved;if(moved<.001)stall++;else stall=0;p=n;if(stall>3)return {ok:false,reason:'blocked',at:p,target:q};}}return {ok:Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z)<.1,distance:+distance.toFixed(2),end:p};}
const stairs=[];for(const s of map.stairs){const along=s.rise.includes('z'),positive=s.rise.startsWith('+'),x=(s.minX+s.maxX)/2,z=(s.minZ+s.maxZ)/2;
 const a=along?{x,y:s.low,z:positive?s.minZ-.6:s.maxZ+.6}:{x:positive?s.minX-.6:s.maxX+.6,y:s.low,z},b=along?{x,y:s.high,z:positive?s.maxZ+.6:s.minZ-.6}:{x:positive?s.maxX+.6:s.minX-.6,y:s.high,z};for(const reverse of [false,true])stairs.push({id:s.id,reverse,...walk(reverse?b:a,reverse?a:b)});}
const hides=map.hides.map((h:any)=>{const goal={x:h.x+h.approach.x,y:h.y,z:h.z+h.approach.z};return {id:h.id,...walk({...map.spawn,y:0},goal)};});
const noInvisibleFloor=world.surface(25,31,3.5)===null,hasCourtyardFloor=world.surface(35,30,0)===0;
const result={stairs,hides,noInvisibleFloor,hasCourtyardFloor,passed:stairs.every(r=>r.ok)&&hides.every((r:any)=>r.ok)&&noInvisibleFloor&&hasCourtyardFloor};writeFileSync(new URL('./party-v2-stage1-walk-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;

import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Director,type Mission,type PlayerView,type Rules} from '../src/ai.ts';
import {CombatSystem,type CombatRules,type WeaponDef} from '../src/combat.ts';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {hiddenFrom,shootsFrom,buildCoverSpots} from '../src/cover-spots.ts';
import {MissionEvents} from '../src/events.ts';
const json=(name:string)=>JSON.parse(readFileSync(new URL('../src/data/'+name+'.json',import.meta.url),'utf8'));
const map=json('hotel') as Mission&{reinforcements:{id:string;x:number;z:number}[]},rules=json('rules') as Rules,cr=json('combat') as CombatRules,weapons=json('weapons') as Record<string,WeaponDef>,world=new CollisionWorld(map),nav=new NavGrid(world),boxes=sightBoxes(map),spots=buildCoverSpots(map,world,nav,cr.tactics),results=[];
for(const point of map.reinforcements){let success=null,attempts=0;
 for(const s of spots.filter(s=>s.floor===0&&Math.hypot(s.x-point.x,s.z-point.z)<15)){
  const p:PlayerView={x:s.x+s.nx*16,y:0,z:s.z+s.nz*16,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit',weaponDrawn:true};
  if(world.blocked(p.x,p.y,p.z)||nav.nearest(p)<0||!hiddenFrom(s,p,false,boxes)||!shootsFrom(s,p,false,boxes,rules.vision.eye))continue;
  attempts++;const at=nav.nodes[nav.nearest({x:point.x,y:0,z:point.z})],d=new Director({...map,npcs:[{id:'response-audit',role:'guard',label:'増援',floor:0,model:'response',combatProfile:'response',loadout:'rifle_npc',route:[[at.x,at.z]]}]},world,nav,boxes,structuredClone(rules)),c=new CombatSystem(d,new MissionEvents(),{level:0,quiet:0} as never,cr,weapons,[],()=>0),n=d.npcs[0];n.heading=Math.atan2(p.x-n.pos.x,p.z-n.pos.z);c.equip('pistol_silenced');c.hand='pistol_silenced';c.engage(n,p,0);const phases=new Set<string>();let shots=0,last=-Infinity,band=false;
  for(let i=0;i<960;i++){d.step(1/60,p);c.step(1/60,p,i/60);if(n.tactic){phases.add(n.tactic.phase);const range=Math.hypot(n.tactic.spot.x-p.x,n.tactic.spot.z-p.z);if(n.tactic.phase!=='move'&&range>=8&&range<=24)band=true;}if(n.shotAt>last){last=n.shotAt;shots++;}}
  if(phases.has('hide')&&phases.has('peek')&&band&&shots>0){success={entry:point.id,attempts,start:{x:at.x,z:at.z},player:{x:p.x,z:p.z},end:n.pos,weapon:n.weapon,cover:n.tactic?.spot.block,range:Math.hypot(n.pos.x-p.x,n.pos.z-p.z),phases:[...phases],shots};break;}
  if(attempts>=40)break;
 }
 assert.ok(success,point.id+' did not reach cover and fire in rifle range');results.push(success);
}
writeFileSync(new URL('../../investigation/guard-ai/stageA-outdoor-motion.json',import.meta.url),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));

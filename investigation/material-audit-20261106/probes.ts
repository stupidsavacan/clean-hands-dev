// Read-only audit probes, 2026-11-06. Runs the real hotel modules; it does not modify game files.
// Run from app: node --experimental-strip-types --no-warnings ../investigation/material-audit-20261106/probes.ts
import {readFileSync,writeFileSync} from 'node:fs';
import {Director,type PlayerView} from '../../app/src/ai.ts';
import {CollisionWorld,floorOf} from '../../app/src/world.ts';
import {NavGrid} from '../../app/src/nav.ts';
import {sightBoxes} from '../../app/src/sight.ts';

const json=(name:string)=>JSON.parse(readFileSync(new URL(`../../app/src/data/${name}.json`,import.meta.url),'utf8'));
const hotel=json('hotel'),rules=json('rules');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel);
const d=new Director(hotel,world,nav,boxes,structuredClone(rules));
const witness=d.npcs.find(n=>n.id==='bodyguard_captain')!;
const distant=d.npcs.find(n=>n.id==='guard_parking')!;
const p:PlayerView={...witness.pos,floor:floorOf(witness.pos.y),speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
const identityBefore=distant.hasConfirmedIdentity(p);
witness.state='combat';
witness.radio(witness.pos,d.rules);
const radioState=witness.state;
d.accuse(witness,p);
const results={
  scope:'Direct function probes with the real hotel modules; no browser, full incident or original recording replay.',
  combatNotification:{npcId:witness.id,before:'combat',afterRadio:radioState,afterAccuse:witness.state},
  distantKnowledge:{sourceNpcId:witness.id,npcId:distant.id,distance:Math.hypot(distant.pos.x-witness.pos.x,distant.pos.z-witness.pos.z),radioRadius:rules.radio,identityBefore,identityAfter:distant.hasConfirmedIdentity(p),localKnownDisguises:[...distant.knownDisguises],localKnowledgeCount:distant.knowledge.length,sharedCompromised:[...d.compromised]},
};
writeFileSync(new URL('./probe-results.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results));

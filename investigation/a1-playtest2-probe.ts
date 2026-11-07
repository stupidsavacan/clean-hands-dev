// Check A1 acquisition from a populated pier before the sommelier's arrival.
// Trigger: 20261031-215228_a1; playtest 2 fix 3.
// Run from app: node --experimental-strip-types --no-warnings ../investigation/a1-playtest2-probe.ts
import {game,hotel,rules} from './ghost-sim.ts';
import {walk,wait,safeJump,takeOutfit,behind} from './ghost-walk.ts';import {readFileSync} from 'node:fs';
const r=JSON.parse(readFileSync(new URL('./playtest2-field.routes.json',import.meta.url),'utf8'));
const prior=JSON.parse(readFileSync(new URL('./ghost-walk.routes.json',import.meta.url),'utf8'));
for(const delay of r.acquisitionDelaySeconds){const S=game();S.p={...S.p,...r.a1Start};try{walk(S,r.a1Wait);wait(S,delay);safeJump(S,prior.timing.safeJump_300);S.until(()=>S.npc('sommelier').scheduleAction==='wait'&&!S.npc('sommelier').scheduleTarget,prior.simulation.scheduleTimeout);behind(S,'sommelier');S.hold('KeyF',rules.m3.koSeconds+prior.simulation.holdSlackSeconds);S.hold('KeyE',prior.simulation.step);walk(S,r.a1HideApproach);S.hold('KeyE',rules.m3.hideSeconds+prior.simulation.holdSlackSeconds);S.hold('KeyT',rules.m4.changeSeconds+prior.simulation.holdSlackSeconds);console.log(JSON.stringify({delay,body:S.npc('sommelier').bodyMode,disguise:S.m4.disguise,spotted:S.spottedBy,found:S.found,compromised:[...S.d.compromised]}));}catch(e){console.log(JSON.stringify({delay,error:String(e),pos:S.p,spotted:S.spottedBy}));}}

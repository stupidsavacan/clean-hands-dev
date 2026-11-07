// Re-run the reported scenes through walking routes, native clothing and the full crowd.
// Run from app: node --experimental-strip-types ../investigation/playtest-repro.ts
import {scenarios,simulate} from './ghost-sim.ts';
const out:any={};
for(const at of [360,428.3,600])out['B1@'+at]=simulate(scenarios.find(s=>s.name.startsWith('B1'))!,{releaseAt:at});
for(const id of ['C3','C2'])out[id]=simulate(scenarios.find(s=>s.name.startsWith(id))!);
console.log(JSON.stringify(out,null,2));

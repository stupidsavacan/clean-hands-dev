import {test} from 'node:test';import assert from 'node:assert/strict';
import {scenarios,simulate} from '../../investigation/ghost-sim.unit.ts';
// Isolated action regression coverage (walking routes: playtest-walk.test.ts).
// The real crowd, schedules, witnesses and cameras stay in place. Each route includes two minutes of reactions.
for(const scenario of scenarios.slice(0,15))test(`Ghost: ${scenario.name}`,()=>{
 const result=simulate(scenario);assert.ok(result.target.startsWith('dead:'),result.target);
 for(const [step,done] of Object.entries(result.steps))assert.equal(done,true,step);
 assert.deepEqual(result.others,[],'no collateral deaths');assert.equal(result.score.ghost,true,JSON.stringify(result));
});

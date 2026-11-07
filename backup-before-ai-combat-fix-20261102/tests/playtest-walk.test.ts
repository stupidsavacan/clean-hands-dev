import {test} from 'node:test';import assert from 'node:assert/strict';
import {scenarios,simulate} from '../../investigation/ghost-sim.ts';
// Full crowd, walking speed, native outfit acquisition and dragging; no injected disguise or missing bystanders.
for(const id of ['A2','A4','B1','B3','B4','C2','C3','C5'])test(`Walking ghost: ${id}`,()=>{
 const scenario=scenarios.find(s=>s.name.startsWith(id))!,result=simulate(scenario);
 assert.equal(result.error,'',JSON.stringify(result));assert.ok(result.target.startsWith('dead:'));assert.equal(result.ghost,true,JSON.stringify(result));
 assert.equal(result.score.ghost,true);assert.equal(result.score.lines.find((line:any)=>line.key==='chance_complete')?.count,1,'chance is completed before the death notification closes it');assert.deepEqual(result.others,[]);assert.deepEqual(result.compromised,[]);assert.deepEqual(result.unconsciousFound,[]);assert.equal(result.changeWitnesses,0);
 assert.ok(!result.found.some((s:string)=>s.endsWith(':murder')),'no unconscious or murdered bodies found');
 if(['A4','B1','C2','C3','C5'].includes(id))assert.equal(result.target,'dead:accident');
 if(id==='C2'){assert.deepEqual(result.escaped,[],'all other targets retain their normal schedules');assert.equal(result.alert,0);assert.deepEqual(result.otherTargets,{wine_merchant:'active',lawyer:'active'});}
 if(id==='B3')assert.equal(result.guardsHeld,true,'all three other bodyguards hold their original positions');
});
for(const releaseAt of [360,428.3,600])test(`B1: walking ghost at ${releaseAt} seconds with the moving crowd`,()=>{
 const result=simulate(scenarios.find(s=>s.name.startsWith('B1'))!,{releaseAt});assert.equal(result.ghost,true,JSON.stringify(result));assert.deepEqual(result.others,[]);
});

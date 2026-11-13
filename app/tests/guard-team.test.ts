import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS,begin,tick,type Scenario} from '../src/labs/ai-scenarios.ts';
import {markDead} from '../src/kills.ts';
function scenario():Scenario{return {...SCENARIOS.find(s=>s.id==='team-limit')!,step:undefined};}
test('guard team: four fighters use at most two flankers and retain a suppressor',()=>{
 const s=scenario();s.npcs=[...s.npcs,{...s.npcs[2],id:'g4',route:[[-14,-9]]}];const r=begin(s);let peak=0;
 for(let i=0;i<1500;i++){tick(s,r);const roles=r.director.npcs.map(n=>r.combat!.teams.role(n));peak=Math.max(peak,roles.filter(x=>x==='flank').length);assert.ok(roles.filter(x=>x==='flank').length<=2);if(roles.includes('flank'))assert.ok(roles.includes('suppress'));}assert.ok(peak>0);
});
test('guard team: moving the known agent resets the hold timer and ending combat clears roles',()=>{
 const s=scenario(),original=s.player;s.player=(t,r)=>({...original(t,r),x:t<12?-1:1});const r=begin(s);let assigned=false;
 for(let i=0;i<840;i++){tick(s,r);if(r.time<12&&r.combat!.teams.flanks.size)assigned=true;if(r.time>12.1)assert.equal(r.combat!.teams.flanks.size,0);}assert.ok(assigned);
 for(const n of r.director.npcs)markDead(n,'test',{kind:'combat',witnesses:[],cameras:[],illegal:false,reasons:[]});r.combat!.step(1/60,r.player,r.time);for(const n of r.director.npcs)assert.equal(r.combat!.teams.role(n),null);
});
test('guard team: an idle patrol never joins a team assignment',()=>{
 const s=scenario(),r=begin(s),idle=r.director.addNpc({...s.npcs[0],id:'idle',route:[[18,13]]});
 for(let i=0;i<900;i++)tick(s,r);assert.equal(r.combat!.teams.role(idle),null);assert.equal(idle.state,'patrol');
});

import assert from 'node:assert/strict';
import {SCENARIOS,begin,rules} from '../src/labs/ai-scenarios.ts';
import {ClubWeapons} from '../src/engine/weapons.ts';
import {M4System} from '../src/m4.ts';
const setup=()=>{const r=begin(SCENARIOS.find(s=>s.id==='cover-peek')!),c=r.combat!,n=r.director.npcs[0],m4=new M4System(r.director,[],rules.m4!),recovery=new ClubWeapons(c,m4,.2);n.weapon='pistol_guard';
 const drop={key:900,gun:{id:'smg',mag:30,reserve:0},pos:{...n.pos}};c.dropped.push(drop);return {r,c,n,recovery,drop};};
{
 const {c,n,recovery,drop}=setup();n.state='combat';for(let t=0;t<20;t+=.2)recovery.step(t);
 assert.ok(c.dropped.includes(drop));assert.equal(n.weapon,'pistol_guard');assert.equal(n.coinPickup,null);console.log('combat: SMG remains on floor; pistol unchanged');
}
{
 const {r,c,n,recovery,drop}=setup();recovery.step(0);assert.equal(n.state,'distracted');recovery.step(.21);assert.ok(n.coinPickup);
 c.engage(n,r.player,.22);recovery.step(.23);assert.equal(n.coinPickup,null);assert.ok(c.dropped.includes(drop));assert.equal(n.weapon,'pistol_guard');console.log('combat interrupts an existing recovery without equipping the SMG');
}
{
 const {c,n,recovery,drop}=setup();recovery.step(0);recovery.step(.21);assert.ok(n.coinPickup);recovery.step(2);
 assert.ok(!c.dropped.includes(drop));assert.equal(n.weapon,'pistol_guard');console.log('patrol: SMG is collected as evidence; pistol unchanged');
}

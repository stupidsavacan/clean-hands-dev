// AI report P2 (2026-11-05): a shot reaches combat.range (60 m in the club) at most, even when the aim point is farther.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {Director,type Mission} from '../src/ai.ts';
import {MissionEvents} from '../src/events.ts';
import {M3System} from '../src/m3.ts';
import {CombatSystem,type CombatRules,type WeaponDef} from '../src/combat.ts';
import {guard,player,rules} from '../src/labs/ai-scenarios.ts';
import combatData from '../src/data/club-combat.json' with {type:'json'};
import weapons from '../src/data/weapons.json' with {type:'json'};
const range=(combatData as {range:number}).range;
const LONG:Mission={spawn:{x:0,z:0},ground:{minX:-5,maxX:5,minZ:-5,maxZ:120},floors:[],stairs:[],walls:[],blockers:[],
 zones:[{id:'Z',label:'-',floor:0,type:'public',minX:-5,maxX:5,minZ:-5,maxZ:120}],npcs:[],objectives:{panel:{x:0,z:0,radius:.1,seconds:1,label:'-'},exit:{x:0,z:0,radius:.1,label:'-'}}};
function shotAt(z:number){
 const w=new CollisionWorld(LONG),d=new Director({...LONG,npcs:[guard('t',0,z,Math.PI)]},w,new NavGrid(w),sightBoxes(LONG),structuredClone(rules));
 const c=new CombatSystem(d,new MissionEvents(),new M3System(d,[],(rules as never as {m3:never}).m3).hotel,combatData as unknown as CombatRules,weapons as unknown as Record<string,WeaponDef>,[],()=>0);
 c.equip('pistol_guard');c.hand='pistol_guard';const t=d.npcs[0];t.hp=1e6;
 return c.fire(player(0,0,{weaponDrawn:true}),{x:0,y:1.3,z:z+20},0).hit?.id??null;
}
test('COMBAT-RANGE-01: a target inside the range is hit, one beyond it is not',()=>{
 assert.equal(shotAt(range-2),'t');
 assert.equal(shotAt(range+3),null);
});

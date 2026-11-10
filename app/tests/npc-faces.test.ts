// 2026-11-10 (playtest): the search made every club guard see through every outfit, and after "最初からやり直す" they still
// did from the first second. Npc took the map's own knowsFaces list, so the search wrote into the map data and the next
// run's guards started with it. A person's list is their own copy.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import club from '../src/data/club-map.json' with {type:'json'};
import {Npc,type NpcDef} from '../src/ai.ts';

test('a person gets their own copy of the outfits they know, so changing it leaves the map data alone',()=>{
 const def=(club.npcs as unknown as NpcDef[]).find(n=>n.id==='gate_watch')!,before=[...def.knowsFaces!];
 const first=new Npc(def,club as never);
 first.knowsFaces.push('suit','waiter');
 assert.deepEqual(def.knowsFaces,before,'the map data is unchanged');
 const next=new Npc(def,club as never);
 assert.deepEqual(next.knowsFaces,before,'the next run starts from the map data');
 assert.ok(!next.knowsFace('suit'));
});

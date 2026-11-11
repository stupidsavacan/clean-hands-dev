import assert from 'node:assert/strict';
import test from 'node:test';
import inventory from '../src/labs/outfit-inventory.json' with {type:'json'};
import {CHARACTERS} from '../src/wardrobe.ts';
import {NPC_MODELS} from '../src/npc-data.ts';
import hotel from '../src/data/hotel.json' with {type:'json'};
import marina from '../src/data/marina.json' with {type:'json'};
import club from '../src/data/club-map.json' with {type:'json'};
import party from '../src/data/party.json' with {type:'json'};
import testStage from '../src/data/test-stage-layout.json' with {type:'json'};

test('the wardrobe inventory covers every embedded character and map placement',()=>{
 const catalog=new Map(inventory.map(entry=>[entry.id,entry]));
 assert.equal(catalog.size,inventory.length);
 const maps=[['ホテル',hotel],['マリーナ',marina],['クラブ',club],['夜会',party],['検証ステージ',testStage]] as const;
 const required=new Set([...Object.keys(NPC_MODELS),...CHARACTERS.map(c=>c.id)]);
 const expected:string[]=[];
 for(const [map,level] of maps)for(const npc of level.npcs){
  required.add(npc.model);
  expected.push([map,npc.id,npc.model,npc.label].join(':'));
 }
 assert.deepEqual(new Set(catalog.keys()),required);
 const actual=inventory.flatMap(entry=>(entry.cast??[]).map(npc=>[npc.map,npc.id,entry.id,npc.label].join(':')));
 assert.deepEqual(actual.sort(),expected.sort());
 for(const {top,jacket,bottom,shoes,extras} of inventory)assert.ok([top,jacket,bottom,shoes,extras].every(Boolean));
});

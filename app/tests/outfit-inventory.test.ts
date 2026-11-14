import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import baselines from '../../investigation/outfit-overhaul/stage2-baseline-models.json' with {type:'json'};
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
 const required=new Set([...Object.keys(NPC_MODELS),...CHARACTERS.map(c=>c.id),...baselines.models.map(m=>m.id),...baselines.aliases.map(a=>a.id)]);
 // The lab also contains authored costumes awaiting a stage placement.
 for(const name of readdirSync(new URL('../../assets/characters/recipes/',import.meta.url)))
  if(name.endsWith('.json'))required.add(name.slice(0,-5));
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

test('every inventory entry refers to its versioned generated, fixed or alias recipe',()=>{
 for(const entry of inventory){
  assert.equal(entry.recipe,`assets/characters/recipes/${entry.id}.json`);
  const recipe=JSON.parse(readFileSync(new URL('../../'+entry.recipe,import.meta.url),'utf8'));
  assert.equal(recipe.id,entry.id);
  assert.equal(recipe.schemaVersion,1);
  if(entry.id==='guest_male'){assert.equal(recipe.assetMode,'alias');assert.equal(recipe.aliasOf,'wardrobe');}
  else if(CHARACTERS.some(c=>c.id===entry.id)){assert.equal(recipe.assetMode,'fixed');assert.match(recipe.sha256,/^[0-9a-f]{64}$/);}
  else {assert.equal(recipe.assetMode,'generated');assert.ok(recipe.parts.length);}
 }
});

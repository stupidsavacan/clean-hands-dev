import assert from 'node:assert/strict';
import test from 'node:test';
import catalogData from '../../assets/characters/catalog/catalog.json' with {type:'json'};
import waiterData from '../../assets/characters/recipes/waiter.json' with {type:'json'};
import femaleData from '../../assets/characters/recipes/guest_dress.json' with {type:'json'};
import {available,selectPiece,migrateLegacy,postBuild,type CharacterRecipe,type OutfitCatalog} from '../src/labs/outfit-recipes.ts';
import {defaults} from '../src/labs/outfit-design.ts';
const catalog=catalogData as OutfitCatalog,waiter=waiterData as CharacterRecipe,female=femaleData as CharacterRecipe;

test('body compatibility excludes male outer layers and head parts from female bodies',()=>{
 assert.equal(available(catalog,'cast.female.v1','outer').length,0);
 assert.ok(!available(catalog,'cast.female.v1','head').some(p=>p.id.includes('.male.')));
 assert.throws(()=>selectPiece(female,catalog,'outer','outer.layer.v1',{model:'Jacket'}),/体型/);
 assert.deepEqual(available(catalog,'pool.variant.strong.v1','hair').find(p=>p.id==='pool.hair.v1')?.parameters.kind,['swimsuit']);
 assert.deepEqual(available(catalog,'pool.variant.lean.v1','top').find(p=>p.id==='pool.torso.v1')?.parameters.kind,['shorts']);
 assert.throws(()=>selectPiece({...waiter,specialOperations:[{operation:'dj.customize.v1'}]},catalog,'top','legacy.top.v1'),/DJ専用/);
 assert.deepEqual(available(catalog,'cast.female.v1','patterns').find(p=>p.id==='cast.chest-details.v1')?.parameters.kind,['dress']);
});
test('part selection clones the source and keeps ordered structural operations',()=>{
 const before=JSON.stringify(waiter);
 const next=selectPiece(waiter,catalog,'top','legacy.top.v1',{model:'Shirt'});
 assert.equal(JSON.stringify(waiter),before);
 assert.equal(next.parts!.find(p=>p.part==='legacy.top.v1')?.parameters.model,'Shirt');
 assert.deepEqual(next.specialOperations,waiter.specialOperations);
 assert.ok(next.parts!.findIndex(p=>p.part==='legacy.top.v1')<next.parts!.findIndex(p=>p.part==='cast.legs.v1'));
 assert.throws(()=>selectPiece(waiter,catalog,'outer','outer.layer.v1',{model:'../../file'}),/未登録/);
});
test('fixed assets cannot become editable recipes through selection',()=>{
 assert.throws(()=>selectPiece({schemaVersion:1,assetMode:'fixed',id:'agent47'},catalog,'hair','cast.hair.v1'),/固定/);
});
test('legacy outfit JSON retains the garment variants, colors and surface mark',()=>{
 const next=migrateLegacy({version:1,pieces:{...defaults,Jacket:{model:'Bomber',color:'#123456',collar:true,long:true}},mark:{text:'BAR',color:'#ffffff'}},catalog,waiter);
 assert.equal(next.parts!.find(p=>p.part==='outer.layer.v1')?.parameters.model,'BomberLongCollar');
 assert.equal(next.appearanceColors?.outer,'#123456');
 assert.equal((next.mark as {text:string}).text,'BAR');
 assert.equal(waiter.id,'waiter');
});
test('build request uses the dedicated header, a JSON body and propagates rejection',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=(async(url,options)=>{
   assert.equal(url,'http://127.0.0.1:8891/api/outfit/jobs');
   assert.equal((options?.headers as Record<string,string>)['X-Outfit-Lab'],'1');
   assert.equal(JSON.parse(options!.body as string).name,'テスト');
   return new Response(JSON.stringify({error:'拒否しました'}),{status:403});
  }) as typeof fetch;
  await assert.rejects(postBuild('http://127.0.0.1:8891',waiter,'テスト'),/拒否/);
 }finally{globalThis.fetch=original;}
});

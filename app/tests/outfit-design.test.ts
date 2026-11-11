import assert from 'node:assert/strict';
import test from 'node:test';
import {defaults,defaultMark,fittedModel,parseRecipe} from '../src/labs/outfit-design.ts';

test('the same recipe selects a long collared flight jacket and a chest mark',()=>{
 const recipe=parseRecipe({version:1,pieces:{...defaults,Jacket:{model:'Bomber',color:'#AABBCC',long:true,collar:true}},
  mark:{text:'07',color:'#EEDDCC'}});
 assert.equal(fittedModel(recipe.pieces.Jacket),'BomberLongCollar');
 assert.equal(recipe.pieces.Jacket.color,'#aabbcc');
 assert.deepEqual(recipe.mark,{text:'07',color:'#eeddcc'});
 assert.deepEqual(parseRecipe(JSON.parse(JSON.stringify(recipe))),recipe);
});

test('recipe import rejects unknown parts, invalid options and non-PNG images',()=>{
 const recipe={version:1,pieces:defaults,mark:defaultMark};
 assert.throws(()=>parseRecipe({...recipe,pieces:{...defaults,Jacket:{model:'unknown',color:'#223344'}}}));
 assert.throws(()=>parseRecipe({...recipe,pieces:{...defaults,Jacket:{...defaults.Jacket,long:'true'}}}));
 assert.throws(()=>parseRecipe({...recipe,mark:{...defaultMark,png:'https://example.com/a.png'}}));
});

test('recipe preserves a mark placed on the back of the shirt',()=>{
 const placement={slot:'TShirt',point:[0,1.34,-.10],normal:[0,0,-1],size:.18,angle:25};
 const data={version:1,pieces:defaults,mark:{...defaultMark,text:'BACK',placement}};
 assert.deepEqual(parseRecipe(data).mark.placement,placement);
 assert.throws(()=>parseRecipe({...data,mark:{...data.mark,placement:{...placement,normal:[0,0,0]}}}));
});

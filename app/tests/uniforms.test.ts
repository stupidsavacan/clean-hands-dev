import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
// Every disguise has a look, staff wear it, and every body that can be looted has underwear to lie in — all embedded.
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules');
const embedded=new Set([...readFileSync(new URL('../src/npc-data.ts',import.meta.url),'utf8').matchAll(/^ "([a-z_]+)":'/gm)].map(m=>m[1]));

test('each disguise but the agent\'s own suit has an embedded uniform, and the hat roles hide the agent\'s hair',()=>{
 for(const d of Object.keys(rules.disguises)){if(d==='suit')continue;const model=rules.m4.uniformModels[d];assert.ok(model,d+' has no uniform');assert.ok(embedded.has(model),model+' is not embedded');}
 for(const d of ['guard','chef','delivery','fisher','driver'])assert.deepEqual(rules.m4.uniformHides[d],['Hair']);
 assert.equal(rules.m4.uniformHides.pilot,undefined,'the pilot wears a headset over the hair');
 assert.deepEqual(rules.m4.uniformHides.bodyguard,['Glasses']);});

test('staff NPCs wear the uniform of the clothes they give, and every model they use is embedded',()=>{
 for(const n of hotel.npcs){assert.ok(embedded.has(n.model),n.id+' uses '+n.model);if(n.outfit)assert.equal(n.model,rules.m4.uniformModels[n.outfit],n.id);}
 const chefs=hotel.npcs.filter((n:{outfit?:string})=>n.outfit==='chef');assert.ok(chefs.length>=5);});

test('a looted body has underwear of its skin and build, except pool guests already in swimwear',()=>{
 const u=rules.m4.undressed;assert.ok(embedded.has(u.default));
 for(const model of new Set<string>(hotel.npcs.map((n:{model:string})=>n.model))){const want=model in u.byModel?u.byModel[model]:u.default;
  if(model.startsWith('pool_guest'))assert.equal(want,null,model);else assert.ok(embedded.has(want),model+' -> '+want);}
 assert.equal(u.byModel.guest_dress,'underwear_female');assert.equal(u.byModel.guard,'underwear_dark');assert.equal(u.byModel.investor,'underwear_female');});

test('the three targets wear their own cast-sheet models, and the response team its own',()=>{
 const combat=json('combat');
 for(const id of ['wine_merchant','lawyer','investor']){const n=hotel.npcs.find((n:{id:string})=>n.id===id);assert.ok(n.target);assert.equal(n.model,id);assert.ok(embedded.has(id));}
 assert.equal(combat.reinforcements.model,'response');assert.ok(embedded.has('response'));});

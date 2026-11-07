// 2026-11-05: the hand-held item GLBs (assets/items, embedded in src/item-data.ts). The Item Lab shows the same checks
// in 3D (grip, size, in the hand, on the floor); these are the ones that need no renderer.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ITEM_INFO,ITEM_MODELS} from '../src/item-data.ts';
import {holdKind,gripOf} from '../src/hold-pose.ts';
import club from '../src/data/club-detection.json' with {type:'json'};
const ABSTRACT=new Set(['pistol_silenced','pistol_guard','smg','poison_lethal','lockpick','wire','keycard','cellar_key']);
test('every item model has its grip at the origin and a small triangle count',()=>{
 // 2026-11-07: the cases are built on their own with an opening lid (assets/briefcase, assets/toolbox; HD12), up to 1200;
 // their real counts showed once embed-items.mjs took their own build-info (it had kept the old simple briefcase's 132).
 for(const i of ITEM_INFO){const limit=['briefcase','toolbox'].includes(i.id)?1200:300;assert.ok(ITEM_MODELS[i.id],i.id);assert.deepEqual(i.anchors.GRIP_R.map(Math.abs),[0,0,0],i.id);assert.ok(i.triangles<=limit,`${i.id}: ${i.triangles} triangles (limit ${limit})`);}});
test('every carried thing in the club rules that has a body has a model, a hold and a grip',()=>{
 for(const id of Object.keys(club.items).filter(id=>!ABSTRACT.has(id))){assert.ok(ITEM_MODELS[id],`${id} has no GLB`);holdKind(id);gripOf(id);}});

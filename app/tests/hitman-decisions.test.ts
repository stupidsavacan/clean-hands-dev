// 2026-11-07: the HITMAN decisions ledger (src/data/hitman-decisions.json, docs/HITMAN-ALIGNMENT.md). A decision is only
// real when a test holds it: each decided row names test files that carry its id.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {decisions,decisionsMarkdown} from '../scripts/spec-docs.ts';

const app=new URL('../',import.meta.url);
const list=decisions();

test('every row is complete and ids are unique',()=>{
 assert.equal(new Set(list.map(d=>d.id)).size,list.length);
 for(const d of list){for(const k of ['id','topic','hitman','ours'] as const)assert.ok(d[k],`${d.id}: ${k}`);assert.ok(/^HD\d{2}$/.test(d.id),d.id);
  assert.ok(['align','differ','pending'].includes(d.decision),`${d.id}: decision`);assert.ok(['done','todo'].includes(d.status),`${d.id}: status`);
  if(d.decision==='pending'){assert.ok(d.question&&(d.options?.length??0)>=2,`${d.id}: a pending row asks a question with choices`);}
  else{assert.ok(d.by&&d.date&&d.reason,`${d.id}: who decided, when and why`);}}});

test('each decided row is held by its tests (the id is written in them)',()=>{
 for(const d of list){if(d.decision==='pending'||d.kind==='policy')continue;assert.ok(d.tests.length,`${d.id}: name the test that holds it`);
  for(const t of d.tests){assert.ok(existsSync(new URL(t,app)),`${d.id}: ${t} is missing`);assert.ok(readFileSync(new URL(t,app),'utf8').includes(d.id),`${d.id}: ${t} does not mention ${d.id}`);}}});

test('rows not built yet stay listed as todo in a test',()=>{
 for(const d of list.filter(d=>d.decision==='align'&&d.status==='todo')){const files=d.tests.map(t=>readFileSync(new URL(t,app),'utf8'));
  assert.ok(files.some(f=>f.includes(d.id)),`${d.id}: a test mentions it`);}});

test('every ROADMAP row in state D is covered by a decision',()=>{
 const road=readFileSync(new URL('../ROADMAP.md',app),'utf8'),refs=list.flatMap(d=>d.refs).join(' ');
 const dRows=[...road.matchAll(/^\| ([^|]+?) \| D \|/gm)].map(m=>m[1].trim().split(' ')[0]);
 assert.ok(dRows.length>0);
 for(const r of dRows)assert.ok(refs.includes(r),`ROADMAP ${r} (state D) has no row in hitman-decisions.json`);});

test('docs/hitman-decisions.md is current',()=>{
 assert.equal(readFileSync(new URL('../docs/hitman-decisions.md',app),'utf8').replace(/\r\n/g,'\n'),decisionsMarkdown(),'run: npm run docs');});

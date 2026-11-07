// HD03 (hitman-decisions.json): CLEAN HANDS's own key layout, one key per action.
// 2026-11-07: the controls table (src/controls.ts) is the spec for every key and touch button. Replaces keys.test.ts
// (2026-11-06: the frisk B and the briefcase, the wire H and the sword once shared keys).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONTROLS,OWNER_FILES,touchControls} from '../src/controls.ts';
import {touchLayout} from '../src/touch.ts';

const src=(f:string)=>readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
const CODE=/'(Key[A-Z]|Digit\d|Space|Tab|Escape|Enter|Shift(?:Left|Right)|Arrow(?:Up|Down|Left|Right))'/g;
const literals=(text:string)=>new Set([...text.matchAll(CODE)].map(m=>m[1]));
// Where a file actually reads a key for its own action (not just lists it to pass along).
const reads=(text:string)=>new Set([...text.matchAll(/(?:e\.code===|fresh\(|keys\.has\()'(Key[A-Z])'/g)].map(m=>m[1]));
const byCode=new Map<string,typeof CONTROLS>();for(const c of CONTROLS)byCode.set(c.code,[...(byCode.get(c.code)??[]),c]);

test('one key, one action (only E and movement are shared, on purpose)',()=>{
 for(const [code,rows] of byCode)if(rows.length>1)assert.ok(rows.every(r=>r.shared),`${code} is used by ${rows.map(r=>r.id).join(' and ')}`);
 assert.equal(new Set(CONTROLS.map(c=>c.id)).size,CONTROLS.length,'ids are unique');});

test('every key the game files mention has a row in the controls table',()=>{
 for(const file of Object.values(OWNER_FILES)){for(const k of literals(src(file)))assert.ok(byCode.has(k),`${file} uses ${k}, which has no row in src/controls.ts`);}});

test('each action key is read by its owner, and by no other system',()=>{
 for(const [owner,file] of Object.entries(OWNER_FILES)){const r=reads(src(file));
  for(const k of r){const rows=byCode.get(k)!;if(rows.some(x=>x.shared||x.owner==='move'))continue;assert.ok(rows.some(x=>x.owner===owner),`${k} (${rows[0].id}) belongs to ${rows[0].owner} but ${file} reads it`);}
  for(const c of CONTROLS.filter(c=>c.owner===owner&&/^Key/.test(c.code)&&!c.shared))assert.ok(literals(src(file)).has(c.code),`${file} no longer uses ${c.code} (${c.id}); remove or move the row`);}});

test('touch buttons come from the table and send known codes',()=>{
 const layout=touchLayout(1080,810,undefined,false),armed=touchLayout(1080,810,undefined,true);
 const known=new Set([...CONTROLS.map(c=>c.code),...CONTROLS.map(c=>c.touch?.code).filter(Boolean) as string[]]);
 for(const b of [...layout.buttons,...layout.tools,...armed.buttons])assert.ok(known.has(b.code),`touch button ${b.id} sends ${b.code}, which has no row`);
 assert.deepEqual(layout.tools.map(t=>t.code),touchControls('tool').map(t=>t[0]),'the tool chips are the table rows, in order');
 for(const k of ['KeyK','KeyI','KeyB','KeyH'])assert.ok(layout.tools.some(t=>t.code===k),`${k} has a touch chip`);});

test('docs/controls.md is generated from the table and current',async()=>{
 const {controlsMarkdown}=await import('../scripts/spec-docs.ts');
 const doc=readFileSync(new URL('../../docs/controls.md',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.equal(doc,controlsMarkdown(),'run: node --experimental-strip-types scripts/spec-docs.ts');});

// 2026-11-07: the project's own files hang together. Written after src/mobile.ts went missing while mobile.html and
// its build still pointed at it (the iPad page could not be rebuilt). Pages, build configs, build targets and the files
// the ledger (ROADMAP.md) names must all exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {TARGETS} from '../scripts/build-all.mjs';

const app=new URL('../',import.meta.url),root=new URL('../../',import.meta.url);
const read=(u:URL)=>readFileSync(u,'utf8');

test('every page in app/ loads a script that exists',()=>{
 for(const f of readdirSync(app).filter(f=>f.endsWith('.html'))){const m=read(new URL(f,app)).match(/src="\/(src\/[^"]+)"/);
  assert.ok(m,`${f} has no module script`);assert.ok(existsSync(new URL(m![1],app)),`${f} loads ${m![1]}, which is missing`);}});

test('every build config names a page that exists',()=>{
 for(const f of readdirSync(app).filter(f=>/^vite\..*config\.ts$/.test(f))){const m=read(new URL(f,app)).match(/input:\s*'([^']+\.html)'/);if(!m)continue;
  assert.ok(existsSync(new URL(m[1],app)),`${f} builds ${m[1]}, which is missing`);}});

test('every build target (npm run build:all) has its config, page and standalone script',()=>{
 for(const t of TARGETS){assert.ok(existsSync(new URL(t.config,app)),`${t.name}: ${t.config}`);assert.ok(existsSync(new URL(t.standalone,app)),`${t.name}: ${t.standalone}`);
  const lab=(t as {args?:string[]}).args?.[0];if(lab)assert.ok(existsSync(new URL(lab+'.html',app)),`${t.name}: ${lab}.html`);}});

test('the files the ledger (ROADMAP.md) and the docs name exist',()=>{
 const missing:string[]=[];
 for(const doc of ['ROADMAP.md','docs/DEVELOPMENT.md']){if(!existsSync(new URL(doc,root)))continue;const text=read(new URL(doc,root));
  for(const m of text.matchAll(/(?<![\w/.-])(?:app\/)?((?:src|tests|scripts)\/[A-Za-z0-9_/.-]+\.(?:ts|json|css|mjs))/g))if(!existsSync(new URL(m[1],app)))missing.push(`${doc}: ${m[1]}`);}
 assert.deepEqual(missing,[]);});

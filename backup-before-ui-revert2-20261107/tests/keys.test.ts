// 2026-11-06: one key, one meaning. The frisk (B) and the briefcase, the wire (H) and the sword once shared keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(f:string)=>readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
// Keys each system reads for its own actions (E is shared on purpose: the prompt says which use applies there).
const OWN:Record<string,string[]>={'m3.ts':['KeyF','KeyX'],'m4.ts':['KeyB','KeyH','KeyT'],'m53.ts':['KeyJ','KeyP'],
 'engine/game.ts':['KeyG','KeyQ','KeyR','KeyU','KeyK','KeyI','KeyO','KeyV','KeyZ','KeyC','KeyN']};
const used=(text:string)=>new Set([...text.matchAll(/(?:e\.code===|fresh\(|keys\.has\()'(Key[A-Z])'/g)].map(m=>m[1]).filter(k=>!['KeyW','KeyA','KeyS','KeyD','KeyE'].includes(k)));
test('every action key belongs to one system only',()=>{const owner=new Map<string,string>();
 for(const [file,keys] of Object.entries(OWN)){const found=used(src(file));for(const k of found){assert.ok(!owner.has(k),`${k} is read by both ${owner.get(k)} and ${file}`);owner.set(k,file);}
  for(const k of keys)assert.ok(found.has(k),`${file} still reads ${k}`);}});
test('the touch tools offer the briefcase and the sword on their own keys',()=>{const t=src('touch.ts');for(const k of ['KeyK','KeyI','KeyB','KeyH'])assert.ok(t.includes(`'${k}'`),k);});

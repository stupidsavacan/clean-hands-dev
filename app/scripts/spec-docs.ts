// Writes the spec pages in docs/ from the tables in the code (2026-11-07), so the docs never drift from the game:
//   node --experimental-strip-types --no-warnings scripts/spec-docs.ts
// tests/controls.test.ts and tests/items.test.ts fail when a page is out of date.
import {writeFileSync,mkdirSync} from 'node:fs';
import {CONTROLS} from '../src/controls.ts';
import {itemsMarkdown} from './spec-items.ts';

const OWNER_LABEL:Record<string,string>={game:'engine/game.ts',m3:'m3.ts（背後・格闘）',m4:'m4.ts（変装・検査・ワイヤー）',m53:'m53.ts（会話・突き落とし）',m57:'m57.ts',move:'移動（全体）'};
const keyName=(code:string)=>code.replace(/^Key/,'').replace(/^Digit/,'').replace('ShiftLeft','Shift').replace('ShiftRight','Shift(右)').replace(/^Arrow/,'↑↓←→ ').replace('Escape','Esc');
const cell=(s:string)=>s.replace(/\|/g,'\\|');

export function controlsMarkdown(){
 const rows=CONTROLS.map(c=>`| ${/^(Key|Digit|Space|Tab|Escape|Enter|Shift|Arrow)/.test(c.code)?'`'+keyName(c.code)+'`':'（タッチだけ）'} | ${cell(c.label)} | ${OWNER_LABEL[c.owner]} | ${c.touch?`${c.touch.label}（${c.touch.group}・${c.touch.kind==='hold'?'長押し':'タップ'}）`:'—'} | ${c.shared?'共有':''} | ${cell(c.note??'')} |`);
 return ['# 操作（キーとタッチ）','','このページは `app/src/controls.ts` から作っています。直接書き換えず、表を直してから `node --experimental-strip-types --no-warnings scripts/spec-docs.ts` を実行します。','',
  '新しい操作を足す時：','','1. `src/controls.ts` に1行足す（空いているキーを使う。E と移動キー以外は共有しない）。','2. 持ち主のファイルでそのキーを読む。','3. タッチでも使うなら `touch` を書く（iPad のボタンはこの表から作られる）。','4. 上のコマンドでこのページを作り直し、`npm test` を通す。','',
  '| キー | すること | 読むファイル | タッチのボタン | 共有 | メモ |','|---|---|---|---|---|---|',...rows,''].join('\n');}

const here=new URL('../../docs/',import.meta.url);
if(import.meta.url===`file:///${process.argv[1]?.replace(/\\/g,'/').replace(/^\//,'')}`||process.argv[1]?.endsWith('spec-docs.ts')){
 mkdirSync(here,{recursive:true});
 writeFileSync(new URL('controls.md',here),controlsMarkdown());
 writeFileSync(new URL('items.md',here),itemsMarkdown());
 console.log('docs/controls.md, docs/items.md written');}

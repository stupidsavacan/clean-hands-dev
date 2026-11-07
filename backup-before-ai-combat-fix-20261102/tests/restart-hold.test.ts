import {test} from 'node:test';import assert from 'node:assert/strict';
import {RestartHold} from '../src/restart-hold.ts';import {readFileSync} from 'node:fs';
const rules=JSON.parse(readFileSync(new URL('../src/data/rules.json',import.meta.url),'utf8'));
test('restart: a short R press cancels without resetting',()=>{const hold=new RestartHold(rules.controls.restartHoldSeconds);assert.equal(hold.step(hold.seconds/2,true,false),false);assert.ok(hold.progress>0);assert.equal(hold.step(0,false,false),false);assert.equal(hold.progress,0);});
test('restart: uninterrupted R reaches the configured threshold',()=>{const hold=new RestartHold(rules.controls.restartHoldSeconds);assert.equal(hold.step(hold.seconds-.1,true,false),false);assert.equal(hold.step(.1,true,false),true);assert.equal(hold.progress,1);});
test('restart: drawing a gun cancels progress and holding R cannot reset',()=>{const hold=new RestartHold(rules.controls.restartHoldSeconds);hold.step(hold.seconds/2,true,false);assert.equal(hold.step(hold.seconds*2,true,true),false);assert.equal(hold.progress,0);assert.equal(hold.step(hold.seconds/2,true,false),false);});

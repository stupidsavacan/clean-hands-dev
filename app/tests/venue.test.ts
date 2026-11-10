import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {FAIL_TEXT,VENUE,venueText} from '../src/mission.ts';
// 2026-11-10: the place word in shared sentences comes from each map's GameDef.text.venue (the hotel keeps ホテル).
test('shared sentences take the place word of each map',()=>{
 assert.equal(VENUE,'ホテル');
 assert.equal(venueText(FAIL_TEXT.target_escaped.text),'騒ぎが大きくなり、ターゲットが避難してホテルを離れた。');
 assert.equal(venueText(FAIL_TEXT.target_escaped.text,'クラブ'),'騒ぎが大きくなり、ターゲットが避難してクラブを離れた。');
 for(const [file,word] of [['club/main.ts','クラブ'],['test-stage/main.ts','会場']])
  assert.ok(readFileSync(new URL('../src/'+file,import.meta.url),'utf8').includes(`venue:'${word}'`),file);
});

// AI Test Lab (2026-11-04): every scenario of the lab page, judged headless. See src/labs/ai-scenarios.ts.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS,run} from '../src/labs/ai-scenarios.ts';
// A scenario marked `known` is a finding not fixed yet: it is reported as todo and does not fail the suite.
for(const s of SCENARIOS)test(`AI lab · ${s.group} · ${s.title}`,s.known?{todo:s.known}:{},()=>{const r=run(s);assert.ok(r.pass,`${s.expect}\n→ ${r.detail}`);});

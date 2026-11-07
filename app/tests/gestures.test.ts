// 2026-11-05: the rebuilt scheduled gestures (src/gestures.ts). The Animation Lab shows them; these check what can be
// checked without a renderer: every scheduled action has one, and no hand ever jumps between two frames.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Locomotion} from '../src/locomotion.ts';
import {GESTURES,gesturePose,type HandGoal} from '../src/gestures.ts';
const OLD=['phone','radio','drink','tasting','speech','chat','camera','photo','tour','inspect','cook','clean','massage_work','work','serve','club_press','dance','massage'];
test('every gesture the old schedule-motion had is rebuilt',()=>{for(const a of OLD)assert.ok(GESTURES[a],a);});
// A hand that is not used counts as weight 0. Between two frames (1/60 s) a used hand moves under 5 cm (3 m/s, a fast
// dance move) and its weight
// changes under 0.08, so every change of phase is a blend.
for(const action of Object.keys(GESTURES))test(`gesture "${action}" never jumps`,()=>{
 const base=new Locomotion().update(1/60,{speed:0,crouch:0,slope:0,turn:0,distance:0});
 let last:Record<string,HandGoal|undefined>={};let lastBody={spine:0,head:0,headYaw:0};
 for(let i=0;i<60*40;i++){const t=i/60,p=structuredClone(base),g=gesturePose(p,action,t)!;
  if(i===0){last={r:g.r,l:g.l};lastBody={spine:p.spine,head:p.head,headYaw:p.headYaw};continue;}
  for(const side of ["r","l"] as const){const h=g[side],o=last[side],w=h?.w??0,ow=o?.w??0;
   assert.ok(Math.abs(w-ow)<.08,`${action} ${side} weight ${ow.toFixed(2)}→${w.toFixed(2)} at ${t.toFixed(2)}s`);
   if(h&&o&&w>.05&&ow>.05){const d=Math.hypot(h.at[0]-o.at[0],h.at[1]-o.at[1],h.at[2]-o.at[2]);assert.ok(d<.05,`${action} ${side} moved ${d.toFixed(3)} m at ${t.toFixed(2)}s`);}
   last[side]=h;}
  for(const k of ['spine','head','headYaw'] as const){assert.ok(Math.abs(p[k]-lastBody[k])<.06||i===0,`${action} ${k} ${lastBody[k].toFixed(2)}→${p[k].toFixed(2)} at ${t.toFixed(2)}s`);lastBody[k]=p[k];}
 }});
// Starting and stopping blend in and out (GesturePlayer): the arms never jump when someone stops to phone or walks off.
import {GesturePlayer,GESTURE_BLEND_SECONDS} from '../src/gestures.ts';
test('a gesture blends in when it starts and out when it stops, and a change waits for the old one to fade',()=>{
 const base=new Locomotion().update(1/60,{speed:0,crouch:0,slope:0,turn:0,distance:0}),g=new GesturePlayer();
 let lastSwing=base.arms[1].swing,lastW=0;const steps=(action:string|null,n:number,check=true)=>{for(let i=0;i<n;i++){const p=structuredClone(base),out=g.pose(p,action,i/60,1/60),w=out?.r?.w??0;
   if(check){assert.ok(Math.abs(p.arms[1].swing-lastSwing)<.08,`swing jumped ${lastSwing}→${p.arms[1].swing}`);assert.ok(Math.abs(w-lastW)<.08,`weight jumped ${lastW}→${w}`);}lastSwing=p.arms[1].swing;lastW=w;}};
 steps('phone',60*GESTURE_BLEND_SECONDS+5);assert.equal(g.current,'phone');assert.ok(lastW>.99);
 steps('drink',10);assert.equal(g.current,'phone','still fading the phone out');
 steps('drink',60*2);assert.equal(g.current,'drink');
 steps(null,60*GESTURE_BLEND_SECONDS+5);assert.equal(g.current,'');assert.equal(lastW,0);
});

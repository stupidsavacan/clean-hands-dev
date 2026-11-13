// Play a scripted night at the observatory without a browser and print what happened (2026-11-13):
//   node --experimental-strip-types --no-warnings scripts/observatory-run.ts asphyxia|lightning|idle [seconds]
// The real map, people and mission script run (tests/observatory-harness.ts); the "player" only flips switches.
import {observatory} from '../tests/observatory-harness.ts';
import {markUnconscious} from '../src/kills.ts';

const [scenario='idle',limit='900']=process.argv.slice(2);
const g=observatory();
const plans:Record<string,[number,()=>void][]>={
 idle:[],
 asphyxia:[[300,()=>{markUnconscious(g.npc('tech'));for(const id of ['brk_vent','o2_sensor','ln2_valve','brk_compressor'])g.script.operate(id);}]],
 alarm:[[20,()=>{g.script.operate('brk_vent');g.script.operate('ln2_valve');}]],
 lightning:[[540,()=>{markUnconscious(g.npc('tech'));g.script.operate('ground_cable');g.script.operate('brk_dome');}]],
};
const plan=plans[scenario];
if(!plan)throw new Error('scenarios: '+Object.keys(plans).join(' '));
const watch=['director','aide','tech','researcher_b'];
let said=0;
for(let t=0;t<+limit;t+=5){
 for(const [at,act] of plan)if(at>=t&&at<t+5){g.run(at-t);act();g.run(t+5-at);}
 if(!plan.some(([at])=>at>=t&&at<t+5))g.run(5);
 for(;said<g.notices.length;said++)console.log('   ',g.notices[said]);
 if((t+5)%30===0){
  const s=g.sim.snapshot();
  console.log(String(t+5).padStart(4),s.power.source.padEnd(9),'slit',s.slit,'cryo O2',s.air.cryo.o2,'det',s.detectorTemp,
   watch.map(id=>{const n=g.npc(id);return `${id}:${g.script.zone(n.pos)||'-'}${n.life==='active'?'':'('+n.life+')'}`;}).join(' '));
 }
}
console.log('kills',JSON.stringify(g.script.kills.map(k=>({victim:k.victim,method:k.method,time:Math.round(k.time),kind:k.judgement.kind}))));

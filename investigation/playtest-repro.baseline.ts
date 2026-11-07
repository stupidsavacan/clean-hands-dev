// Re-plays the situations from the 2026-10-31 playtest runs (playtest/runs) on the real systems, at the times the player did them.
// Run from outputs/m5-prototype/app:  node --experimental-strip-types ../investigation/playtest-repro.ts
import {game,act} from './ghost-sim.ts';
const out:any={};
const dead=(S:any)=>S.d.npcs.filter((n:any)=>n.life==='dead').map((n:any)=>`${n.id}:${n.deathKind}`);
// B1: chandelier dropped at 6:00 and 7:08 (C2 runs 190228/190635) — the bodyguard died with the lawyer.
for(const at of [330,360,428,600]){const S=game();S.hear('lobby_chandelier');S.c.jump(at-30);S.give('wrench');S.dress('guard');S.until(()=>S.c.time>=at,60,S.away);
 const L=S.npc('lawyer'),B=S.npc('bodyguard_1');const before={lawyer:[+L.pos.x.toFixed(1),+L.pos.z.toFixed(1),L.scheduleAction],bg1:[+B.pos.x.toFixed(1),+B.pos.z.toFixed(1)]};
 S.at(act('chandelier_clamp'));S.tick();S.hold('KeyE',4.3);S.hold('KeyE',1.3);out['B1@'+at]={before,dead:dead(S)};}
// C3: pushed as the pilot at 21:40 (run 191005) — judged murder, witness guard_heliport.
for(const at of [1215,1300,1500]){const S=game();S.hear('investor_helicopter');S.c.jump(at-60);S.dress('pilot');S.until(()=>S.c.time>=at,120,S.away);const I=S.npc('investor');const doing=I.scheduleAction;
 S.beside('investor');S.hold('KeyE',2.3);const posed=S.until(()=>S.g.flags.has('investor_posed'),5);S.until(()=>!I.scriptedGoal||Math.hypot(I.pos.x-I.scriptedGoal.x,I.pos.z-I.scriptedGoal.z)<.3,60);for(let i=0;i<30;i++)S.tick();
 const G=S.npc('guard_heliport');const g=[+G.pos.x.toFixed(1),+G.pos.z.toFixed(1),G.scheduleAction,G.scriptedAction??''];
 S.p={...S.p,x:I.pos.x-.9,y:I.pos.y,z:I.pos.z};S.heading=Math.PI/2;S.hold('KeyP',2);out['C3@'+at]={investorDoing:doing,posed,guard:g,dead:dead(S),kills:S.f.kills.map((k:any)=>k.victim+'='+k.judgement.kind+'<'+k.judgement.reasons.join('/')+'>')};}
// C2: the alarm with all three targets alive (run 190055) — the others evacuate by car.
{const S=game();S.hear('marina_escape');S.c.jump(60);S.dress('fisher');S.at(act('boat_fuel'));S.hold('KeyE',4.3);S.dress('guard');S.at(act('alarm_bell'));S.hold('KeyE',1.3);
 S.until(()=>S.flow.outcome||S.npc('investor').life==='dead',400,S.away);out.C2={escaped:[...S.g.escaped],investor:S.npc('investor').life,outcome:S.flow.outcome};}
console.log(JSON.stringify(out,null,1));

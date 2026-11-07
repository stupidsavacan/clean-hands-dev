import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {Director,type Npc} from '../src/ai.ts';
const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));const map=json('marina.json'),rules=json('rules.json');
const w=new CollisionWorld(map),nav=new NavGrid(w);
type Step={until?:(n:Record<string,Npc>)=>boolean;to?:{x:number;z:number};tamper?:number;label:string};
// Scripted playthroughs of the pool mission: each plan waits on what the guards are doing, then walks the nav path at walking speed.
function play(start:{x:number;z:number},plan:Step[],log=false){const d=new Director(map,w,nav,sightBoxes(map),rules);const by=Object.fromEntries(d.npcs.map(n=>[n.id,n]));
 let pos={...start,y:0},i=0,path:any[]|null=null,tamper=0,peak=0;const dt=1/60;
 for(let t=0;t<180;t+=dt){const s=plan[i];if(!s)return {ok:true,t,alerts:d.alerts,reports:d.reports,peak};let moving=false,tampering=false;
  if(s.until){if(s.until(by)){i++;if(log)console.log(t.toFixed(1),'→',plan[i]?.label);}}
  else if(s.to){path??=nav.find(pos,{...s.to,y:0});const q=path![0];if(!q){i++;path=null;if(log)console.log(t.toFixed(1),'→',plan[i]?.label);}else{const dx=q.x-pos.x,dz=q.z-pos.z,l=Math.hypot(dx,dz),st=1.65*dt;if(l<st){pos={x:q.x,y:q.y,z:q.z};path!.shift();}else pos=w.move(pos,dx/l*st,dz/l*st);moving=true;}}
  else if(s.tamper){tamper+=dt;tampering=true;if(tamper>=s.tamper){i++;tamper=0;if(log)console.log(t.toFixed(1),'→',plan[i]?.label);}}
  for(const e of d.step(dt,{...pos,floor:0,speed:moving?1.65:0,running:false,crouched:false,tampering,disguise:'suit'}))if(log)console.log(t.toFixed(1),s.label,e.type,e.npc.id,Math.round(e.npc.suspicion));
  peak=Math.max(peak,d.hottest()!.suspicion);if(d.caught)return {ok:false,t,alerts:d.alerts,reports:d.reports,peak,at:s.label};}
 return {ok:false,t:180,alerts:d.alerts,reports:d.reports,peak,at:plan[i]?.label};}
const back=[{label:'wait for him to head north',until:(n:any)=>n['guard-service'].routeIndex===2&&n['guard-service'].wait<=0&&n['guard-service'].pos.z<-3},
 {label:'follow to the panel',to:{x:-13.15,z:-8.6}},{label:'tamper',tamper:3},
 {label:'wait for him to leave',until:(n:any)=>n['guard-service'].routeIndex!==2&&n['guard-service'].pos.z>-4.5},
 {label:'out by the lobby gap',to:{x:-9.6,z:-5.5}},{label:'to the gate',to:{x:-8,z:11.3}}];
const front=[{label:'wait for both to look away',until:(n:any)=>n['guard-service'].routeIndex===0&&n['guard-service'].wait>3&&n['guard-lobby'].routeIndex===0&&n['guard-lobby'].wait>1.5},
 {label:'through the gap to the panel',to:{x:-13.15,z:-8.6}},{label:'tamper',tamper:3},{label:'back out',to:{x:-9.6,z:-5.5}},{label:'to the gate',to:{x:-8,z:11.3}}];
const naive=[{label:'straight to the panel',to:{x:-13.15,z:-8.6}},{label:'tamper',tamper:3},{label:'to the gate',to:{x:-8,z:11.3}}];
test('slipping in behind the service guard through the back door finishes the mission unseen',()=>{const r=play({x:-10.5,z:4.5},back);assert.ok(r.ok,JSON.stringify(r));assert.equal(r.alerts,0);assert.ok(r.peak<30,`peak ${r.peak}`);});
test('going in by the lobby while both guards look away also works, as a close call',()=>{const r=play({x:-7.2,z:-3.5},front);assert.ok(r.ok,JSON.stringify(r));assert.equal(r.alerts,0);});
test('walking straight in without watching the guards gets the agent caught',()=>{const r=play({x:-8,z:9.5},naive);assert.equal(r.ok,false);assert.ok(r.alerts>=1,JSON.stringify(r));});

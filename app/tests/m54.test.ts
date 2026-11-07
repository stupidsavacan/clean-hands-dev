import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {MissionClock,ScheduleSystem}from '../src/schedule.ts';import {M3System}from '../src/m3.ts';import {M4System}from '../src/m4.ts';import {M53System}from '../src/m53.ts';
import {ScoreLedger,computeResult,type Scoring}from '../src/score.ts';import {MissionFlow}from '../src/mission.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),chances=json('chances'),plans=json('schedule'),scoring:Scoring=json('scoring'),missionData=json('mission');
const world=new CollisionWorld(hotel),nav=new NavGrid(world);
const who=(role:string,target=false)=>({role,target});

test('M5.4 the result is scoring.json worked out once: base, every line, time bonus, rank thresholds',()=>{
 const counts=new Map([['spotted',2],['ko_found',1],['body_found',1],['guard_kill',1],['civilian_kill',0],['accident_kill',1],['chance_complete',2]]);
 const r=computeResult(scoring,counts,1500,true),expect=10000-2000-500-2000-1000+1000+1000+1000;
 assert.equal(r.total,expect);assert.equal(r.timeBonus,1000);assert.equal(r.rank,'B');assert.equal(r.ghost,false);assert.deepEqual(r.ghostBrokenBy,['spotted','body_found','guard_kill']);
 assert.equal(computeResult(scoring,new Map(),2100,true).timeBonus,0,'the bonus is for under 35 minutes');
 const clean=computeResult(scoring,new Map([['accident_kill',1],['chance_complete',1]]),900,true);assert.equal(clean.total,12500);assert.equal(clean.rank,'A');assert.equal(clean.ghost,true);
 for(const [total,rank] of [[8000,'A'],[7999,'B'],[5000,'B'],[4999,'C'],[-3000,'C']] as const)assert.equal(computeResult(scoring,new Map([['civilian_kill',(10000-total)/5000]]),9999,true).rank,rank,`${total}`);
 assert.equal(computeResult(scoring,new Map([['loud_shot_once',4]]),9999,true).total,9000,'loud shots cost the points once');
 const failed=computeResult(scoring,new Map(),300,false);assert.equal(failed.rank,'—');assert.equal(failed.timeBonus,0);assert.equal(failed.ghost,false);});

test('M5.4 the ledger counts each spotter, body and death once; accidents are neither found bodies nor non-target kills',()=>{
 const e=new MissionEvents(),roles:Record<string,ReturnType<typeof who>>={g:who('guard'),w:who('waiter'),a:who('guest',true)},l=new ScoreLedger(e,id=>roles[id]);
 for(const id of ['g','g','w'])e.emit({type:'player.spotted',time:0,id});
 e.emit({type:'body.found',time:0,id:'w',life:'unconscious'});e.emit({type:'body.found',time:0,id:'w',life:'unconscious'});
 e.emit({type:'body.found',time:0,id:'g',life:'dead',judgement:'murder'});e.emit({type:'body.found',time:0,id:'a',life:'dead',judgement:'accident'});
 e.emit({type:'npc.killed',time:0,id:'g',judgement:'murder'});e.emit({type:'npc.killed',time:0,id:'g',judgement:'murder'});e.emit({type:'npc.killed',time:0,id:'w',judgement:'accident'});e.emit({type:'npc.killed',time:0,id:'a',judgement:'accident'});
 e.emit({type:'chance.updated',time:0,id:'a1',reason:'active'});e.emit({type:'chance.updated',time:0,id:'a1',reason:'complete'});e.emit({type:'chance.updated',time:0,id:'a1',reason:'complete'});
 assert.deepEqual(Object.fromEntries(l.counts),{spotted:2,ko_found:1,body_found:1,guard_kill:1,civilian_kill:1,accident_kill:1,chance_complete:1});assert.equal(l.ghost(scoring),false);});

test('M5.4 the mission switches to escaping when the last target dies; exits only count after that; one ending only',()=>{
 const d=new Director(hotel,world,nav,sightBoxes(hotel),structuredClone(rules)),e=new MissionEvents(),seen:string[]=[];e.on(x=>seen.push(x.type));
 assert.throws(()=>new MissionFlow(['bartender'],d,e));const f=new MissionFlow(missionData.targets,d,e);
 assert.equal(f.exit('E1',1),false);assert.equal(f.update(1),false);d.npcs.find(n=>n.id==='wine_merchant')!.life='dead';assert.equal(f.update(1.5),false,'all three targets (M5.7)');for(const id of ['lawyer','investor'])d.npcs.find(n=>n.id===id)!.life='dead';
 assert.equal(f.update(2),true);assert.equal(f.phase,'escape');assert.equal(f.update(3),false);assert.equal(f.exit('E3',4),true);assert.deepEqual(f.outcome,{success:true,exit:'E3',time:4});
 assert.equal(f.fail('caught',5),false);assert.deepEqual(seen,['mission.escape','mission.exit']);
 const g=new MissionFlow(missionData.targets,new Director(hotel,world,nav,sightBoxes(hotel),structuredClone(rules)),e);assert.equal(g.fail('caught',1),true);assert.equal(g.outcome!.success,false);assert.equal(g.exit('E1',2),false);});

test('M5.4 the briefing data: three targets shown and (from M5.7) all three to eliminate, S1 only open, the pistol is found in a frisk',()=>{
 assert.deepEqual(missionData.briefing.map((b:{id:string})=>b.id),['wine_merchant','lawyer','investor']);assert.deepEqual(missionData.targets,['wine_merchant','lawyer','investor']);
 assert.deepEqual(missionData.starts.filter((s:{open:boolean})=>s.open).map((s:{id:string})=>s.id),['S1']);
 const d=new Director(hotel,world,nav,sightBoxes(hotel),structuredClone(rules)),m4=new M4System(d,hotel.checkpoints,rules.m4);m4.extraInventory=()=>['pistol_silenced'];assert.deepEqual(m4.friskFinds(),['pistol_silenced']);});

test('M5.4 one whole provisional mission on the real systems: barrel accident, escape through an exit, A rank and ghost',()=>{
 const d=new Director(hotel,world,nav,sightBoxes(hotel),structuredClone(rules)),e=new MissionEvents(),c=new MissionClock(rules.schedule,e),schedule=new ScheduleSystem(plans,hotel.schedulePlaces,d,c,e),m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),f=new M53System(d,m3,m4,c,e,rules.m53,hotel.m53,hotel.cameras,chances);
 // The 5.4 provisional mission: the wine merchant alone.
 const flow=new MissionFlow(['wine_merchant'],d,e),ledger=new ScoreLedger(e,id=>{const n=d.npcs.find(n=>n.id===id);return n&&{role:n.role,target:n.target};});
 d.onSpotted=n=>e.emit({type:'player.spotted',time:c.elapsed,id:n.id});m3.onFound=b=>e.emit({type:'body.found',time:c.elapsed,id:b.id,life:b.life==='dead'?'dead':'unconscious',judgement:b.deathKind});
 const view=(p:{x:number;y:number;z:number},disguise:string):PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise});
 e.emit({type:'dialogue.heard',time:0,id:'loading_limited_wine'});m4.disguise='waiter';const at=view(hotel.m53.barrel.approach,'waiter');
 for(let i=0;i<Math.ceil(rules.m53.poisonSeconds*60)+2;i++){c.step(1/60);schedule.sync(1/60);d.step(1/60,at);f.step(1/60,at,0,new Set(['KeyE']));}f.step(0,at,0,new Set());assert.equal(f.barrel,'armed');
 c.jump(1100);const hidden=view({x:-60,y:0,z:-35},'suit');for(let i=0;i<4000&&flow.phase==='targets';i++){c.step(.1);schedule.sync(.1);d.step(.1,hidden);f.step(.1,hidden,0,new Set());f.afterAi(hidden);m3.discover();flow.update(c.elapsed);}
 assert.equal(flow.phase,'escape');const exit=hotel.exits.find((x:{id:string})=>x.id==='E1');assert.ok(flow.exit(exit.id,c.elapsed));
 const r=computeResult(scoring,ledger.counts,c.elapsed,true);assert.equal(r.lines.find(l=>l.key==='accident_kill')!.count,1);assert.equal(r.lines.find(l=>l.key==='chance_complete')!.count,1);
 assert.equal(r.total,10000+1000+500+1000-1000*ledger.count('spotted')-500*ledger.count('ko_found'));assert.equal(r.ghost,ledger.count('spotted')===0);});

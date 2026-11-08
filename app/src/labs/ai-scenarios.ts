// AI Test Lab scenarios (2026-11-04). Each one sets guards in a small arena, runs the real AI (ai.ts Director, the
// same nav, sight, combat and rules every map uses) and judges the outcome automatically. The lab page
// (labs/ai-lab.ts) shows them in 3D; tests/ai-lab.test.ts runs them headless, so a change that breaks a sense fails
// the test suite too. Rules are the club's (data/club-rules.json), the newest the engine runs.
import {Group,type Mesh} from 'three';
import {LandedCoinPickups} from '../coin-pickup.ts';
import {coinMesh} from '../coin-pickup-pose.ts';
import {DeviceSystem,type DeviceDef} from '../devices.ts';
import {ChoreSystem} from '../chores.ts';
import {DoorSystem} from '../doors.ts';
import {CollisionWorld,type Position} from '../world.ts';
import {NavGrid} from '../nav.ts';
import {segmentClear,sightBoxes} from '../sight.ts';
import {Director,type AiEvent,type Mission,type NpcDef,type PlayerView,type Rules} from '../ai.ts';
import {MissionEvents} from '../events.ts';
import {M3System,type HideDef} from '../m3.ts';
import {M4System} from '../m4.ts';
import {MissionClock,ScheduleSystem} from '../schedule.ts';
import {CombatSystem,type CombatRules,type WeaponDef} from '../combat.ts';
import rulesData from '../data/club-rules.json' with {type:'json'};
import combatData from '../data/club-combat.json' with {type:'json'};
import weaponsData from '../data/weapons.json' with {type:'json'};

// The arena, 40 x 30 m, one floor:
//  west  (x<6)  public hall with a free-standing wall (sight test) at x=-6
//  south-east (x>6, z<0)  staff room, door at z=-7 on its west wall
//  north-east (x>6, z>0)  a small maze (path finding)
const wall=(id:string,x:number,z:number,w:number,d:number)=>({id,x,z,w,d,y:0,h:3,floor:0});
export const ARENA:Mission={
 spawn:{x:-14,z:0},ground:{minX:-20,maxX:20,minZ:-15,maxZ:15},floors:[],stairs:[],blockers:[],
 sections:[{id:'lab',label:'試験場',minX:-20,maxX:20,minZ:-15,maxZ:15}],
 walls:[
  wall('outer-n',0,15.1,40.4,.2),wall('outer-s',0,-15.1,40.4,.2),wall('outer-w',-20.1,0,.2,30),wall('outer-e',20.1,0,.2,30),
  // The free-standing wall in the hall.
  wall('screen',-6,0,.3,8),
  // Staff room: west wall with a 1.6 m door at z=-7, north wall along z=0.
  wall('staff-w-a',6,-12,.2,6),wall('staff-w-b',6,-2.6,.2,5.2),wall('staff-n',13,0,14,.2),
  // Maze: open at the hall side (x=6), two baffles to wind round.
  wall('maze-a',10,4.5,.2,9),wall('maze-b',14,10.5,.2,9),wall('maze-c',17.5,4.5,.2,9),
 ],
 zones:[
  {id:'ZONE_lab_staff',label:'職員室',floor:0,type:'staff',minX:6,maxX:20,minZ:-15,maxZ:0},
  {id:'ZONE_lab_hall',label:'ホール',floor:0,type:'public',minX:-20,maxX:20,minZ:-15,maxZ:15},
 ],
 rooms:[{id:'ZONE_lab_hall',label:'ホール',floor:0,type:'public',minX:-20,maxX:20,minZ:-15,maxZ:15,indoor:true}],
 npcs:[],
 objectives:{panel:{x:0,z:0,radius:.1,seconds:1,label:'-'},exit:{x:-19,z:14,radius:.1,label:'-'}},
};
export const rules=rulesData as unknown as Rules;
const combatRules=combatData as unknown as CombatRules,weapons=weaponsData as unknown as Record<string,WeaponDef>;
let shared:{world:CollisionWorld;nav:NavGrid;boxes:ReturnType<typeof sightBoxes>}|undefined;
function newArena(){const world=new CollisionWorld(ARENA);return {world,nav:new NavGrid(world),boxes:sightBoxes(ARENA)};}
export function arena(){return shared??=newArena();}

// A guard standing at x,z facing `heading` (radians, 0 = +z), or walking `route`.
export function guard(id:string,x:number,z:number,heading:number,o:Partial<NpcDef>={}):NpcDef{
 return {id,role:'guard',label:o.label??id,floor:0,model:'guard',route:[[x,z,600,heading*180/Math.PI]],look:[x+Math.sin(heading),z+Math.cos(heading)],knowsFaces:['guard'],post:'ZONE_lab_hall',...o};
}
export const player=(x:number,z:number,o:Partial<PlayerView>={}):PlayerView=>({x,y:0,z,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit',...o});

export type Run={director:Director;combat?:CombatSystem;m3?:M3System;outfit?:{m4:M4System;schedule:ScheduleSystem};coin?:{mesh:Mesh;pickups:LandedCoinPickups};devices?:DeviceSystem;cleaning?:{chores:ChoreSystem;schedule:ScheduleSystem};doors?:DoorSystem;events:AiEvent[];log:string[];time:number;player:PlayerView;marks:Position[]};
export type Scenario={
 id:string;group:'視認'|'聴覚'|'無線'|'戦闘'|'捜索'|'経路探索'|'立入禁止'|'検問'|'救助'|'設備';title:string;expect:string;
 npcs:NpcDef[];seconds:number;combat?:boolean;isolated?:boolean;
 // A finding the lab turned up that the AI does not meet yet (the test suite lists it as todo, not as a failure).
 known?:string;
 // Called once before the first step (throw a coin, start a radio call…).
 start?(r:Run):void;
 // Where the player is at time t (seconds).
 player(t:number,r:Run):PlayerView;
 // Optional per-step hook (after the AI).
 step?(r:Run):void;
 // Stop early once the outcome is known.
 done?(r:Run):boolean;
 judge(r:Run):{pass:boolean;detail:string};
};
const has=(r:Run,type:string,id?:string)=>r.events.some(e=>e.type===type&&(!id||e.npc.id===id));
const npc=(r:Run,id:string)=>r.director.npcs.find(n=>n.id===id)!;
const flat=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);

export const SCENARIOS:Scenario[]=[
 {id:'sight-front',group:'視認',title:'正面の立入禁止は見つかる',expect:'職員室にいるスーツ姿を6m先の警備が見て、振り向き→確かめに来る',
  npcs:[guard('g1',13,-10,0)],seconds:10,player:()=>player(13,-4,{speed:1.2}),done:r=>has(r,'investigate'),
  judge:r=>({pass:has(r,'curious')&&has(r,'investigate'),detail:`反応：${r.log.join(' → ')||'なし'}`})},
 {id:'sight-behind',group:'視認',title:'背後は見えない',expect:'同じ距離でも、背を向けた警備は気づかない（疑い0のまま）',
  npcs:[guard('g1',13,-10,Math.PI)],seconds:6,player:()=>player(13,-4,{speed:1.2}),
  judge:r=>{const s=npc(r,'g1').suspicion;return {pass:s<1&&!has(r,'curious'),detail:`疑い ${s.toFixed(1)}`};}},
 {id:'sight-wall',group:'視認',title:'壁の向こうは見えない',expect:'ホールの衝立の裏で武器を構えても、反対側の警備は反応しない',
  npcs:[guard('g1',-10,0,Math.PI/2)],seconds:6,player:()=>player(-3,0,{weaponDrawn:true}),
  judge:r=>{const clear=segmentClear(arena().boxes,{x:-10,y:1.6,z:0},{x:-3,y:1.4,z:0}),s=npc(r,'g1').suspicion;return {pass:!clear&&s<1&&!has(r,'alert'),detail:`視線 ${clear?'通る':'遮られる'} · 疑い ${s.toFixed(1)}`};}},
 {id:'sight-crouch-run',group:'視認',title:'走ると目立つ',expect:'ホールで走ると、正面の警備が振り向く（公共の場でも）',
  npcs:[guard('g1',-14,-8,0)],seconds:4,player:t=>player(-17+t*4.8,-2,{speed:4.8,running:true}),
  judge:r=>({pass:has(r,'curious')&&!has(r,'alert'),detail:`反応：${r.log.join(' → ')||'なし'}`})},
 {id:'hear-coin',group:'聴覚',title:'コインを拾い、持ち場へ戻る',expect:'投げたコインにいちばん近い警備が歩いて行き、拾ってから持ち場へ戻る',
  npcs:[guard('g1',-14,-8,0),guard('g2',-14,8,Math.PI)],seconds:18,
  start:r=>{const spot={x:-10,y:.01,z:-6};r.marks.push(spot);
   const mesh=coinMesh(),pickups=new LandedCoinPickups();mesh.position.copy(spot);new Group().add(mesh);
   const n=r.director.noise(spot);pickups.watch(mesh,n);r.coin={mesh,pickups};r.log.push(`コイン → ${n?.id??'誰も聞かない'}`);},
  player:()=>player(10,12),
  judge:r=>{const g=npc(r,'g1'),g2=npc(r,'g2'),reached=r.log.some(l=>l==='g1 がコインに着いた');return {pass:reached&&r.log.includes('g1 がコインを拾った')&&!r.coin!.mesh.parent&&g.state==='patrol'&&g2.state==='patrol'&&flat(g2.pos,{x:-14,y:0,z:8})<.5,detail:`${r.log.join(' · ')} · 今 ${g.state}`};},
  step:r=>{const g=npc(r,'g1'),{pickups}=r.coin!;
   if(!r.log.includes('g1 がコインに着いた')&&flat(g.pos,r.marks[0])<1.2)r.log.push('g1 がコインに着いた');
   pickups.step(DT,r.director.boxes);
   if(pickups.held.some(p=>p.npc===g)&&!r.log.includes('g1 がコインを拾った'))r.log.push('g1 がコインを拾った');
  }},
 {id:'door-senses',group:'設備',title:'扉の開閉で視線と音が変わる',expect:'閉めた扉の向こうの人と物音に気づかず、開けると物音に反応できる。',
  npcs:[guard('g1',4,-7.1,Math.PI/2)],seconds:2,isolated:true,player:()=>player(8,-7.1),
  start:r=>{
   const {world,boxes}=r.director;
   const doors=r.doors=new DoorSystem(world,boxes,[{id:'staff-door',label:'職員室の扉',x:6,y:0,z:-7.1,w:.2,d:3.8,h:2.4,startsClosed:true}]);
   r.director.soundClear=(at,listener)=>doors.soundClear(at,listener);
  },
  step:r=>{
   if(r.time<1||r.log.includes('扉を開けた'))return;
   const d=r.director,g=npc(r,'g1');
   if(!g.visibility&&!d.noise(r.player))r.log.push('閉めた状態では見えず、聞こえない');
   r.doors!.use(r.doors!.doors[0],'',[],[]);
   r.log.push('扉を開けた');
   if(d.noise(r.player)?.id===g.id)r.log.push('開けると聞こえた');
  },
  judge:r=>({pass:r.log.includes('閉めた状態では見えず、聞こえない')&&r.log.includes('開けると聞こえた')&&npc(r,'g1').visibility>0,detail:r.log.join(' → ')}),
 },
 {id:'device-handoff',group:'設備',title:'設備を別々に担当し、途中で引き継ぐ',expect:'2人が別々のラジカセに向かう。片方が行動不能になれば別の警備が引き継ぎ、両方が消える。',
  npcs:[guard('g1',-16,-7,Math.PI/2),guard('g2',-16,-1,Math.PI/2),guard('g3',-19,-5,Math.PI/2)],
  seconds:18,player:()=>player(10,12),
  start:r=>{
   const defs:DeviceDef[]=[-7,-1].map((z,i)=>({id:'r'+(i+1),kind:'radio',label:'ラジカセ'+(i+1),x:-13,z,y:.8,floor:0,heading:-Math.PI/2,approach:{x:-14,z}}));
   const devices=r.devices=new DeviceSystem(r.director,defs,()=>0);
   for(const def of defs){const at=devices.spot(def);r.marks.push(at);devices.toggle(at);}
  },
  step:r=>{
   const devices=r.devices!;devices.step(DT);const owners=devices.responders;
   if(r.time>=.8&&npc(r,'g1').active&&owners.get('r1')?.id==='g1'&&owners.get('r2')?.id==='g2'){
    const first=npc(r,'g1');first.life='unconscious';first.fall=1;
    r.log.push('別々に担当 → g1 が行動不能');
   }
   if(owners.get('r1')?.id==='g3'&&!r.log.includes('g3 が引き継いだ'))r.log.push('g3 が引き継いだ');
   r.log.push(...devices.notices);
  },
  done:r=>!r.devices!.on.size&&['g2','g3'].every(id=>npc(r,id).state==='patrol'),
  judge:r=>({pass:!npc(r,'g1').active&&r.log.includes('g3 が引き継いだ')&&!r.devices!.on.size&&['g2','g3'].every(id=>npc(r,id).state==='patrol'),detail:r.log.join(' → ')}),
 },
 {id:'sink-overflow',group:'設備',title:'蛇口を閉め、水たまりを片付ける',expect:'蛇口から水があふれ、清掃員が止めたあとも床に水が残る。モップで拭くと消える。',
  npcs:[guard('cleaner',-16,-7,Math.PI/2,{role:'waiter',label:'清掃員'}),guard('guest',-14,-6,0,{role:'guest'})],
  seconds:23,player:()=>player(10,12),
  start:r=>{
   const def:DeviceDef={id:'sink',kind:'sink',label:'蛇口',x:-13,z:-7,y:0,floor:0,heading:-Math.PI/2,approach:{x:-14,z:-7}};
   const devices=r.devices=new DeviceSystem(r.director,[def],()=>0,['cleaner']),events=new MissionEvents();
   r.cleaning={chores:new ChoreSystem(r.director,devices,['cleaner']),
    schedule:new ScheduleSystem({actors:{}},{},r.director,new MissionClock(rulesData.schedule,events),events)};
   const at=devices.spot(def);r.marks.push(at);devices.toggle(at);
  },
  step:r=>{
   const devices=r.devices!,{chores}=r.cleaning!;devices.step(DT);chores.step(DT);
   if(devices.overflowing.size&&!r.log.includes('水があふれた'))r.log.push('水があふれた');
   if(!devices.on.size&&chores.messes.some(m=>m.kind==='water')&&!r.log.includes('止めた後も水が残った'))r.log.push('止めた後も水が残った');
   r.log.push(...devices.notices,...chores.notices);
  },
  done:r=>r.log.includes('止めた後も水が残った')&&!r.cleaning!.chores.messes.length,
  judge:r=>({pass:r.log.includes('水があふれた')&&r.log.includes('止めた後も水が残った')&&!r.cleaning!.chores.messes.length&&!r.devices!.on.size,detail:r.log.join(' → ')}),
 },
 {id:'hear-gunshot',group:'聴覚',title:'銃声で見に来る',expect:'衝立の裏で通常の拳銃を撃つと、見えていない近くの警備が音のした方へ確かめに来る（HITMAN の Gunshot Heard。2026-11-04 修正）',combat:true,
  npcs:[guard('g1',-12,0,Math.PI)],seconds:6,
  start:r=>{const c=r.combat!;c.equip('pistol_guard');c.hand='pistol_guard';const p=player(-3,0,{weaponDrawn:true});c.fire(p,{x:-3,y:1,z:-5},0);r.log.push('発砲（通常の拳銃）');},
  player:()=>player(-3,0),
  judge:r=>{const g=npc(r,'g1');return {pass:g.state!=='patrol'&&flat(g.pos,{x:-12,y:0,z:0})>.5,detail:`警備 ${g.state} · 移動 ${flat(g.pos,{x:-12,y:0,z:0}).toFixed(1)}m`};}},
 {id:'radio-near',group:'無線',title:'無線が届く',expect:'職員室で警戒した警備が、見えていない近くの仲間（15m以内）に無線で知らせる',
  npcs:[guard('g1',13,-10,0),guard('g2',0,-10,Math.PI)],seconds:14,player:()=>player(13,-5,{speed:1.2}),
  done:r=>npc(r,'g2').state!=='patrol',
  judge:r=>{const g2=npc(r,'g2');return {pass:g2.state!=='patrol',detail:`g1 ${npc(r,'g1').state} · g2（${flat(npc(r,'g1').pos,g2.pos).toFixed(1)}m）${g2.state}`};}},
 {id:'radio-far',group:'無線',title:'無線の範囲外には届かない',expect:'30m 離れた仲間は持ち場のまま',
  npcs:[guard('g1',13,-10,0),guard('g2',-17,12,Math.PI)],seconds:14,player:()=>player(13,-5,{speed:1.2}),
  judge:r=>{const g2=npc(r,'g2');return {pass:npc(r,'g1').state!=='patrol'&&g2.state==='patrol',detail:`g1 ${npc(r,'g1').state} · g2（${flat(npc(r,'g1').pos,g2.pos).toFixed(1)}m）${g2.state}`};}},
 {id:'combat-draw',group:'戦闘',title:'銃を見せると撃ってくる',expect:'正面で銃を構えると、警備が戦闘に入り、体力が減る',combat:true,
  npcs:[guard('g1',-14,-8,0)],seconds:8,player:()=>player(-14,-1,{weaponDrawn:true,illegalVisibleCarry:true}),
  start:r=>{const c=r.combat!;c.equip('pistol_silenced');c.hand='pistol_silenced';},
  done:r=>(r.combat?.hp??100)<(combatRules.player as {health:number}).health,
  judge:r=>{const hp=Math.round(r.combat!.hp);return {pass:has(r,'alert')||npc(r,'g1').state==='combat'?hp<(combatRules.player as {health:number}).health:false,detail:`警備 ${npc(r,'g1').state} · 体力 ${hp}`};}},
 {id:'combat-occluded-carry',group:'戦闘',title:'体で隠れた拳銃は見つからない',expect:'警備は人物が見えても、体の反対側に隠れた拳銃には反応しない。銃が見えると戦闘に入る。',
  npcs:[guard('g1',-12,-8,Math.atan2(-2,5))],seconds:4,combat:true,
  player:t=>player(-14,-3,{weaponDrawn:true,carrySight:{drawn:{x:-14.25,y:1.24,z:t<1.5?-2.63:-3.37},illegalTools:[]}}),
  start:r=>{r.combat!.equip('pistol_silenced');r.combat!.hand='pistol_silenced';},
  step:r=>{if(r.time<1.5&&npc(r,'g1').state==='combat')r.log.push('見えない拳銃に反応');},
  done:r=>npc(r,'g1').state==='combat',
  judge:r=>({pass:!r.log.includes('見えない拳銃に反応')&&r.time>=1.5&&npc(r,'g1').state==='combat',detail:npc(r,'g1').state==='combat'?'銃が見えて戦闘へ':'戦闘に入らなかった'}),
 },
 {id:'search-lose',group:'捜索',title:'見失うと捜索し、やがて戻る',expect:'警戒させてから視界の外へ消えると、捜索 → 落ち着いて持ち場へ',
  npcs:[guard('g1',13,-10,0)],seconds:40,player:(_t,r)=>npc(r,'g1').state==='alert'&&!r.log.includes('逃げた')?(r.log.push('逃げた'),player(-17,12)):r.log.includes('逃げた')?player(-17,12):player(13,-5,{speed:1}),
  done:r=>has(r,'calm')&&r.log.includes('逃げた'),
  judge:r=>({pass:has(r,'search')&&has(r,'calm')&&!r.director.caught,detail:`反応：${r.events.map(e=>e.type).filter((t,i,a)=>t!==a[i-1]).join(' → ')}`})},
 {id:'path-maze',group:'経路探索',title:'迷路の奥への道を見つける',expect:'ホールから迷路の奥（壁を2回回り込む）まで、壁を通らない道がある',
  npcs:[],seconds:0,player:()=>player(0,0),
  start:r=>{const {nav}=arena(),from={x:2,y:0,z:5},to={x:16,y:0,z:4};const path=nav.find(from,to)??[];let at:Position=from,ok=path.length>0;for(const q of path){if(!nav.clear(at,q))ok=false;at=q;r.marks.push(q);}
   const len=path.reduce((s,q,i)=>s+flat(i?path[i-1]:from,q),0);r.log.push(ok?`道あり ${len.toFixed(1)}m（直線 ${flat(from,to).toFixed(1)}m）`:'道なし');(r as Run&{ok?:boolean}).ok=ok&&len>flat(from,to)*1.2&&flat(at,to)<.5;},
  judge:r=>({pass:!!(r as Run&{ok?:boolean}).ok,detail:r.log.join(' · ')})},
 {id:'path-walk',group:'経路探索',title:'警備が迷路の奥まで歩いて着く',expect:'無線で迷路の奥へ呼ばれた警備が、壁に引っかからずに着く（途中で諦めない。2026-11-04 修正）',
  npcs:[guard('g1',-2,5,Math.PI/2)],seconds:40,player:()=>player(-17,-12),
  start:r=>{const at={x:16,y:0,z:4};r.marks.push(at);npc(r,'g1').radio(at,rules);},
  done:r=>flat(npc(r,'g1').pos,{x:16,y:0,z:4})<1.2,
  judge:r=>{const d=flat(npc(r,'g1').pos,{x:16,y:0,z:4});return {pass:d<1.2,detail:`残り ${d.toFixed(1)}m · ${r.time.toFixed(1)}秒`};}},
 {id:'trespass-arrest',group:'立入禁止',title:'居座ると警告→取り押さえ→確保',expect:'職員室に居続けると、振り向き→確認→警告→取り押さえ→確保の順',
  npcs:[guard('g1',13,-11,0)],seconds:25,player:()=>player(13,-5.5,{speed:1.6}),done:r=>r.director.caught,
  judge:r=>{const seq:string[]=r.events.map(e=>e.type).filter(t=>t!=='calm').filter((t,i,a)=>t!==a[i-1]);const want=['curious','investigate','warn','arrest','caught'];return {pass:want.every((w,i)=>seq.indexOf(w)>=0&&(i===0||seq.indexOf(w)>seq.indexOf(want[i-1]))),detail:seq.join(' → ')};}},
 // ---- 2026-11-04: the AI report fixes (CLEAN_HANDS_AI不具合_総括調査報告書, HITMAN_警備員AI挙動_調査報告書, checkpoint spec)
 {id:'radio-keeps-combat',group:'無線',title:'撃ち合い中は無線で調査に戻らない',expect:'戦闘中の警備に死体の無線が100回届いても、戦闘を続ける（報告書 P0-A）',combat:true,
  npcs:[guard('g1',-14,-8,0)],seconds:3,player:()=>player(-14,-1,{weaponDrawn:true,illegalVisibleCarry:true}),
  start:r=>{const c=r.combat!;c.equip('pistol_silenced');c.hand='pistol_silenced';},
  step:r=>{const g=npc(r,'g1');if(g.state==='combat'&&!r.log.includes('無線100回')){for(let i=0;i<100;i++)g.radio({x:10,y:0,z:10},rules);r.log.push('無線100回');}},
  judge:r=>{const g=npc(r,'g1');return {pass:r.log.includes('無線100回')&&g.state==='combat',detail:`${r.log.includes('無線100回')?'無線100回 → ':''}${g.state}`};}},
 {id:'radio-repeat',group:'無線',title:'同じ現場の呼び出しで足止めされない',expect:'同じ死体の報告が1秒ごとに届き直しても、警備は止まらずに現場へ着く（報告書 P1-A）',
  npcs:[guard('g1',-16,-12,0)],seconds:30,player:()=>player(-17,12),
  start:r=>{const at={x:2,y:0,z:-12};r.marks.push(at);npc(r,'g1').radio(at,rules);},
  step:r=>{if(Math.floor(r.time)!==Math.floor(r.time-DT))npc(r,'g1').radio({x:2,y:0,z:-12},rules);},
  done:r=>flat(npc(r,'g1').pos,{x:2,y:0,z:-12})<1.2,
  judge:r=>{const d=flat(npc(r,'g1').pos,{x:2,y:0,z:-12});return {pass:d<1.2,detail:`残り ${d.toFixed(1)}m · ${r.time.toFixed(1)}秒`};}},
 {id:'combat-witness-kill',group:'戦闘',title:'殺害を見た警備は撃ってくる',expect:'警備が目の前の殺害を見ると、追いかけるだけでなく撃ち合いに入る（HITMAN 報告書 G-03）',combat:true,
  npcs:[guard('g1',-14,-8,0)],seconds:6,player:()=>player(-14,-2),
  // What m3.ts does when a guard sees a wire kill: accuse (alert, the outfit is known) and remember the violence.
  start:r=>{const g=npc(r,'g1');g.perceive(r.player,arena().boxes,rules);r.director.accuse(g,r.player);g.sawViolence=true;r.log.push('殺害を目撃');},
  done:r=>npc(r,'g1').state==='combat',
  judge:r=>{const g=npc(r,'g1');return {pass:g.state==='combat',detail:`警備 ${g.state}`};}},
 {id:'post-near',group:'検問',title:'近くにいると検問の担当は振り向くだけ',expect:'1人の検問担当は、プレイヤーが近くにいるとコインに振り向くだけで持ち場を離れない',
  npcs:[guard('post',-2,-8,0)],seconds:6,player:()=>player(-4,-5),
  start:r=>{const g=npc(r,'post');g.holdsPost=true;g.postAt={...g.pos};g.frisks=true;const at={x:-2,y:0,z:-1};r.marks.push(at);r.director.noise(at,{...r.player,x:-4,z:-5});},
  judge:r=>{const g=npc(r,'post'),d=flat(g.pos,g.postAt!);return {pass:d<.3,detail:`持ち場から ${d.toFixed(1)}m · ${g.state}`};}},
 {id:'post-far',group:'検問',title:'離れていれば検問の担当も見に行く',expect:'プレイヤーが検問から離れていれば、担当もコインを確かめに行く（その間は身体検査なしで通れる）',
  npcs:[guard('post',-2,-8,0)],seconds:6,player:()=>player(-17,12),
  start:r=>{const g=npc(r,'post');g.holdsPost=true;g.postAt={...g.pos};g.frisks=true;const at={x:-2,y:0,z:-1};r.marks.push(at);r.director.noise(at,r.player);},
  judge:r=>{const g=npc(r,'post'),d=flat(g.pos,g.postAt!);return {pass:d>3,detail:`持ち場から ${d.toFixed(1)}m · ${g.state}`};}},
 {id:'post-pair',group:'検問',title:'2人組では相方が見に行き、担当は残る',expect:'2人組の検問では、身体検査をしない相方がコインを見に行き、担当は持ち場に残る',
  npcs:[guard('post',-2,-8,0),guard('mate',0,-8,0)],seconds:6,player:()=>player(-3,-11),
  start:r=>{for(const id of ['post','mate']){const g=npc(r,id);g.holdsPost=true;g.postAt={...g.pos};}npc(r,'post').frisks=true;const at={x:-1.5,y:0,z:-1};r.marks.push(at);r.director.noise(at,r.player);},
  judge:r=>{const a=npc(r,'post'),b=npc(r,'mate'),da=flat(a.pos,a.postAt!),db=flat(b.pos,b.postAt!);return {pass:da<.3&&db>3,detail:`担当 ${da.toFixed(1)}m · 相方 ${db.toFixed(1)}m`};}},
 {id:'post-throw-seen',group:'検問',title:'投げるところを見られると、投げた人に反応する',expect:'コインを投げる瞬間を見ていた人は、音ではなく投げた人を怪しむ',
  npcs:[guard('post',-2,-8,0)],seconds:1,player:()=>player(-2,-4),
  start:r=>{const g=npc(r,'post');g.holdsPost=true;g.postAt={...g.pos};g.perceive(r.player,arena().boxes,rules);r.director.lastThrowSeen=false;r.director.noise({x:-2,y:0,z:-1},r.player);r.log.push(`見ていた：${r.director.lastThrowSeen}`);},
  judge:r=>{const g=npc(r,'post');return {pass:r.director.lastThrowSeen&&g.state==='curious',detail:`${r.log.join(' · ')} · ${g.state}`};}},
 // ---- 2026-11-05: open fixes (close combat heard, P1-C look-round)
 {id:'hear-close-combat',group:'聴覚',title:'近くの格闘の音に気づく',expect:'背後で気絶させる音を、2m以内で見ていない警備は聞いて確かめに来る。3m先の警備は気づかない（HITMAN の Close Combat Heard）',
  npcs:[guard('victim',-10,0,0),guard('near',-11.5,-.5,-Math.PI/2),guard('far',-13,2.5,-Math.PI/2)],seconds:4,player:()=>player(-10,-.8),
  start:r=>{const m3=new M3System(r.director,[],rulesData.m3 as never);const v=npc(r,'victim');v.busy=true;m3.closeCombatNoise({x:-10,y:0,z:-.8},v);r.marks.push({x:-10,y:0,z:-.8});},
  done:r=>npc(r,'near').state!=='patrol',
  judge:r=>{const a=npc(r,'near'),b=npc(r,'far');return {pass:a.state==='investigate'&&b.state==='patrol',detail:`2m以内 ${a.state} · 3m先 ${b.state}`};}},
 {id:'search-look-round',group:'捜索',title:'現場では周りを見回す',expect:'現場に着いた警備は、左右の首振りだけでなく向きを変えて、半周以上を見回す（報告書 P1-C）',
  npcs:[guard('g1',-14,-8,0)],seconds:8,player:()=>player(17,12),
  start:r=>{const at={x:-14,y:0,z:-3};r.marks.push(at);npc(r,'g1').radio(at,rules);},
  step:r=>{const g=npc(r,'g1');if(g.arrived&&g.state==='investigate'){const h=(r as Run&{h?:number[]}).h??=[];h.push(g.heading);}},
  judge:r=>{const h=(r as Run&{h?:number[]}).h??[];let lo=0,hi=0,acc=0;for(let i=1;i<h.length;i++){acc+=Math.atan2(Math.sin(h[i]-h[i-1]),Math.cos(h[i]-h[i-1]));lo=Math.min(lo,acc);hi=Math.max(hi,acc);}const deg=(hi-lo)*180/Math.PI;return {pass:deg>=180,detail:`見回した広さ ${deg.toFixed(0)}°`};}},
 // ---- 2026-11-06: the tranquilizer dart pistol (weapons.json tranq_pistol)
 {id:'tranq-dart',group:'戦闘',title:'鎮静ダーツで眠らせる',expect:'背中にダーツを当てると、相手は騒がずに数秒歩き、それから眠る（気絶。殺しにならない）。離れた警備は気づかない',combat:true,
  npcs:[guard('g1',-12,0,0),guard('g2',8,10,Math.PI)],seconds:5,player:()=>player(-12,-6),
  start:r=>{const c=r.combat!;c.equip('tranq_pistol');c.hand='tranq_pistol';const shot=c.fire(player(-12,-6,{weaponDrawn:true}),{x:-12,y:1.2,z:0},0);r.log.push(shot.hit?`命中：${shot.hit.id}`:'外れ');},
  step:r=>{const g=npc(r,'g1');if(Math.abs(r.time-1)<DT/2)r.log.push(`1秒後 ${g.life}`);if(g.life!=='active'&&!r.log.some(l=>l.startsWith('眠った')))r.log.push(`眠った ${r.time.toFixed(1)}秒`);},
  judge:r=>{const g=npc(r,'g1'),g2=npc(r,'g2');
   return {pass:r.log.includes('1秒後 active')&&g.life==='unconscious'&&!r.events.some(e=>e.npc.id==='g1'&&['alert','arrest'].includes(e.type))&&g2.state==='patrol',detail:`${r.log.join(' · ')} · 今 ${g.life} · g2 ${g2.state}`};}},
 {id:'body-rescue',group:'救助',title:'警備が気絶者を起こす',expect:'警備1人が救助を担当し、もう1人は現場を調べる。救助後、気絶者は行動に戻る。',
  npcs:[guard('g1',-17,0,Math.PI/2),guard('g2',-10,0,-Math.PI/2),guard('guest',-14,0,0,{role:'guest',knowsFaces:[]})],
  seconds:10,player:()=>player(14,12,{hidden:true}),
  start:r=>{
   const body=npc(r,'guest');
   r.m3=new M3System(r.director,[],rulesData.m3);
   r.m3.onFound=()=>r.log.push('気絶者を発見');
   r.m3.down(body,'ko');
  },
  step:r=>{
   const [rescue]=r.m3!.rescue.playing;
   if(rescue?.body===npc(r,'guest')&&rescue.guard===npc(r,'g1')&&npc(r,'g2').state==='investigate'&&!r.log.includes('警備1人が救助を開始')){
    r.log.push('警備1人が救助を開始');
   }
  },
  done:r=>npc(r,'guest').active,
  judge:r=>{
   const body=npc(r,'guest'),revived=body.active&&body.state==='patrol';
   return {pass:revived&&r.log.includes('気絶者を発見')&&r.log.includes('警備1人が救助を開始')&&r.m3!.hotel.level===0,
    detail:[...r.log,revived?'気絶者が行動に復帰':'復帰せず'].join(' → ')};
  }},
 {id:'outfit-recovery',group:'救助',title:'救助された人がロッカーで着替える',expect:'服を取られた人が救助されると、ロッカーへ向かって着替え、元の場所に戻る。',
  npcs:[guard('g1',-17,0,Math.PI/2),guard('guest',-14,0,0,{role:'guest',knowsFaces:[]})],
  seconds:22,player:()=>player(14,12,{hidden:true}),
  start:r=>{
   const locker:HideDef={id:'locker',label:'ロッカー',x:-14,y:0,z:5,heading:0,capacity:1,spareClothes:true,approach:{x:0,z:-.8},size:{w:.65,h:1.9,d:.55}};
   const body=npc(r,'guest'),events=new MissionEvents();
   r.m3=new M3System(r.director,[locker],rulesData.m3);
   r.outfit={m4:new M4System(r.director,[],rulesData.m4,[locker]),
    schedule:new ScheduleSystem({actors:{}},{},r.director,new MissionClock(rulesData.schedule,events),events)};
   r.outfit.m4.taken.add(body.id);
   r.marks.push({x:locker.x,y:locker.y,z:locker.z});
   r.m3.down(body,'ko');
  },
  step:r=>{
   const body=npc(r,'guest'),{m4}=r.outfit!;
   if(body.active&&body.scriptedGoal&&m4.isUndressed(body)&&!r.log.includes('ロッカーへ向かう'))r.log.push('ロッカーへ向かう');
   if(!m4.isUndressed(body)&&!r.log.includes('着替えた'))r.log.push('着替えた');
  },
  done:r=>r.log.includes('着替えた')&&flat(npc(r,'guest').pos,{x:-14,y:0,z:0})<.5,
  judge:r=>({pass:r.log.includes('ロッカーへ向かう')&&r.log.includes('着替えた')&&flat(npc(r,'guest').pos,{x:-14,y:0,z:0})<.5,
   detail:[...r.log,flat(npc(r,'guest').pos,{x:-14,y:0,z:0})<.5?'元の場所に戻った':'まだ移動中'].join(' → ')}),
 },
];

// One scenario, stepped by the caller (the lab page animates it; run() finishes it at once).
export function begin(s:Scenario):Run{
 const {world,nav,boxes}=s.isolated?newArena():arena();
 const director=new Director({...ARENA,npcs:structuredClone(s.npcs)},world,nav,boxes,structuredClone(rules));
 const r:Run={director,events:[],log:[],time:0,player:player(0,0),marks:[]};r.player=s.player(0,r);
 if(s.combat){const m3=new M3System(director,[],rulesData.m3 as never);r.combat=new CombatSystem(director,new MissionEvents(),m3.hotel,combatRules,weapons,[],()=>0);}
 s.start?.(r);
 return r;
}
export const DT=1/60;
export function tick(s:Scenario,r:Run){
 r.player=s.player(r.time,r);
 r.m3?.step(DT,r.player,0,new Set());
 r.outfit?.m4.step(DT,r.player,0,new Set());
 r.outfit?.schedule.sync(DT);
 r.cleaning?.schedule.sync(DT);
 for(const e of r.director.step(DT,r.player)){r.events.push(e);if(['curious','investigate','warn','arrest','alert','search','caught','calm','report'].includes(e.type))r.log.push(`${e.npc.id}:${e.type}`);}
 r.combat?.step(DT,r.player,r.time);
 s.step?.(r);r.time+=DT;
 return r.time>=s.seconds||r.director.caught&&s.id!=='trespass-arrest'||!!s.done?.(r);
}
export function run(s:Scenario){const r=begin(s);if(s.seconds>0)while(!tick(s,r));return {run:r,...s.judge(r)};}

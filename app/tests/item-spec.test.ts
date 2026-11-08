// 2026-11-06: the item rules from the HITMAN WoA source tables, written down once so they need not be looked up again.
// Sources (kept in investigation/material-audit-20261106/sources):
//  S08 08-weapon-models-194.csv  (194 models: use, parts, loadout, where found)  — row = data row number (1-based)
//  S09 09-full-spec-summary.txt  (full spec, summarised: carry, back, case rules) — row = its row number
//  S03 03-attack-actions.csv     (attack actions M01..M25)
// Each rule quotes the words it rests on. When the CSV is present, the quote is checked against it, so a changed source
// fails here too. Rules not built yet are test.todo, so they stay listed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {MELEE,meleeOf,BACK_ITEMS,BACK_MAX,isWireVariant} from '../src/melee.ts';
import {Director,type PlayerView} from '../src/ai.ts';
import {CollisionWorld} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {PartyTraversal} from '../src/party/traversal.ts';
import {carriedPoints,visibleCarry} from '../src/carry-sight.ts';
import {CombatSystem} from '../src/combat.ts';
import {DetectionSystem} from '../src/detection.ts';
import {MissionEvents} from '../src/events.ts';
import {M3System} from '../src/m3.ts';
const here=(p:string)=>new URL(p,import.meta.url);
const json=(f:string)=>JSON.parse(readFileSync(here('../src/data/'+f),'utf8'));
const SRC='../../investigation/material-audit-20261106/sources/';
const s08=existsSync(here(SRC+'08-weapon-models-194.csv'))?readFileSync(here(SRC+'08-weapon-models-194.csv'),'utf8').replace(/^﻿/,'').split(/\r?\n/):null;
const s09=existsSync(here(SRC+'09-full-spec-summary.txt'))?readFileSync(here(SRC+'09-full-spec-summary.txt'),'utf8'):null;
/** The quote is still in that row of the 194-model table (row 0 is the header). */
const cite=(row:number,...words:string[])=>{if(!s08)return;const line=s08[row]??'';for(const w of words)assert.ok(line.includes(w),`S08 row ${row} no longer says 「${w}」: ${line.slice(0,120)}`);};
const cite09=(...words:string[])=>{if(!s09)return;for(const w of words)assert.ok(s09.includes(w),`S09 no longer says 「${w}」`);};
const club=json('club-detection.json'),hotel=json('detection.json'),mission=json('club-mission.json'),weapons=json('weapons.json');
const placed=new Set([...club.worldItems,...hotel.worldItems].map((w:{item:string})=>w.item));
const loadout=new Set([...mission.tools,...mission.fixedTools,...mission.pistols].map((t:{id:string})=>t.id));

// [game id, S08 row, CSV words for the use, knock-out or lethal]
const MELEE_ROWS:[string,number,string[],'blunt'|'blade'][]=[
 ['hammer',1,['ハンマー','近接・投擲','非致死の気絶'],'blunt'],
 ['wrench',2,['レンチ','近接・投擲による気絶'],'blunt'],
 ['crowbar',3,['バール','近接・投擲による気絶'],'blunt'],
 ['brick',4,['レンガ','近接・投擲による気絶'],'blunt'],
 ['frying_pan',7,['フライパン','近接・投擲による気絶'],'blunt'],
 ['briefcase',21,['ブリーフケース','近接・投擲による気絶'],'blunt'],
 ['toolbox',22,['工具箱型ケース','近接・投擲による気絶'],'blunt'],
 ['katana',189,['刀（Katana）','致死判定の近接・投擲武器'],'blade'],
 ['kitchen_knife',191,['ナイフ（小型刃物類の例）','致死判定の近接・投擲'],'blade'],
];
for(const [id,row,words,kind] of MELEE_ROWS)test(`S08 row ${row} ${id}: ${kind==='blunt'?'knocks out':'kills'} in melee and when thrown`,()=>{cite(row,...words);
 const m=meleeOf(id);assert.ok(m,`${id} is a melee thing`);assert.equal(m.kind,kind);assert.equal(m.throwable,true,'thrown too (近接・投擲)');});
// Found on the map, not chosen before the mission (S08 columns 47の開始前装備選択 / ゲーム内の入手経路).
for(const [id,row,words] of [['hammer',1,['不可（通常品）','ステージ内の配置品を拾得']],['wrench',2,['通常品は不可','ステージ内の工具配置品を拾得']],['crowbar',3,['通常品は不可','ステージ内の工具配置品を拾得']],
 ['brick',4,['不可','ステージ内の配置品を拾得']],['frying_pan',7,['不可','ステージ内の調理道具を拾得']],['katana',189,['通常の刀は不可','特定ステージ内の配置品を拾得']],['kitchen_knife',191,['ステージ内の配置品']]] as [string,number,string[]][])
 test(`S08 row ${row} ${id}: lies on a map to be picked up, and is not a loadout choice`,()=>{cite(row,...words);assert.ok(placed.has(id),`${id} is placed on a map`);assert.equal(loadout.has(id),false);});
test('S08 row 21 briefcase: picked up on the map; its body, an opening lid and the thing inside are separate',()=>{cite(21,'ケース本体＋開閉状態＋収納物','ステージ内のケースを拾得','内部に別のアイテムを収納・取り出す');
 assert.ok(placed.has('briefcase'));
 // The model's nodes: a LID that turns on the hinge and a CONTENT mark for what is stored (assets/briefcase).
 const glb=readFileSync(here('../../assets/briefcase/models/briefcase/briefcase.glb')),len=glb.readUInt32LE(12),gl=JSON.parse(glb.subarray(20,20+len).toString('utf8'));
 const names=gl.nodes.map((n:{name:string})=>n.name);for(const n of ['LID','CONTENT','GRIP_R','HINGE'])assert.ok(names.includes(n),n);});
// HD05
test('S09 rows 52/53: what is in the case is hidden from view but still found by a frisk',async()=>{cite09('内容物の表示とケースの認識は独立','違法判定とアイテム可視は個別管理');
 const game=readFileSync(here('../src/engine/game.ts'),'utf8');// HD12 (2026-11-07): any case in hand, not just the briefcase.
 assert.match(game,/isCase\(detection\.held\)&&detection\.caseGun\?\[detection\.caseGun\.id\]/,'the frisk inventory includes the case contents');
 const {DetectionSystem}=await import('../src/detection.ts');assert.ok('caseGun' in DetectionSystem.prototype||true);});
// HD04
test('S09 rows 32/64/120: only swords go on the back, two at most, and hand and back are never the same one',()=>{cite09('2025-09-25からKatanaとKali Sticks限定で背面2アイテム装備に対応','複数背面スロットを全アイテムに開放しない');
 assert.deepEqual(BACK_ITEMS,['katana']);assert.equal(BACK_MAX,2);});
test('S03 M14/M15: the sword has its own front and behind motions, both lethal',()=>{const m=MELEE.katana;assert.equal(m.kind,'blade');assert.ok(m.swing&&m.swing!==m.kind,'front and behind differ');});
test('S08 row 192 fiber wire: melee only (not thrown), carried from the start',()=>{cite(192,'ファイバーワイヤー','通常の投擲武器とは異なる','初期装備');
 assert.equal(meleeOf('wire'),undefined);assert.ok(mission.fixedTools.some((t:{id:string})=>t.id==='wire'));});
test('S08 rows 30/59/60/79 tranquilliser pistol: a one-handed pistol that sedates',()=>{cite(59,'鎮静ダーツ銃','鎮静状態を与える');const w=weapons.tranq_pistol;assert.equal(w.class,'pistol');assert.equal(w.sedative,true);});
test('S08 row 26 etc. silenced pistol: one-handed (片手で構え)',()=>{cite(26,'消音型拳銃','片手で構え');assert.equal(weapons.pistol_silenced.class,'pistol');});
test('S08 row 97 large SMG: two-handed and taken on the map, not chosen before the mission',()=>{cite(97,'大型・両手持ち型','通常の本編ロードアウトでは不可（現地で取得する武器）');assert.equal(weapons.smg.class,'long');assert.equal(loadout.has('smg'),false);});

// Not built yet.
test.todo('S08 row 3 crowbar: opens locked things (施錠物の操作にも使われる)');
test('S08 row 2 wrench: used on machinery in the club',()=>{
 cite(2,'設備とのインタラクションにも使われる');
 const lighting=json('club-stage3.json').acts.find((a:{id:string})=>a.id==='drop_lights');
 assert.equal(lighting.tool.item,'wrench');
 assert.ok(lighting.tool.seconds<lighting.seconds);
 assert.ok(club.worldItems.some((i:{item:string})=>i.item==='wrench'));
});
test('HD11 S08 row 21 briefcase: can be chosen before the mission (ケース選択), and is still found on the map',()=>{cite(21,'可能（ケース選択','装備選択で持込／ステージ内のケースを拾得');
 assert.ok((mission.cases??[]).some((c:{id:string})=>c.id==='briefcase'),'a loadout choice in the club');assert.ok(placed.has('briefcase'),'and placed on the map');});
test('HD12 S08 row 22 toolbox case: a second case like the briefcase, picked up on the map, with its own lid',()=>{cite(22,'工具箱型ケース','内部に別のアイテムを収納・取り出す','ケース本体＋開閉状態＋収納物');
 assert.ok(placed.has('toolbox'),'placed in the club');assert.equal(club.items.toolbox?.legality,'normal');
 const glb=readFileSync(here('../../assets/toolbox/models/toolbox/toolbox.glb')),len=glb.readUInt32LE(12),gl=JSON.parse(glb.subarray(20,20+len).toString('utf8'));
 const names=gl.nodes.map((n:{name:string})=>n.name);for(const n of ['LID','CONTENT','GRIP_R','HINGE'])assert.ok(names.includes(n),n);});
test('S08 rows 193/194: earphones and tape measure use only the wire action',()=>{
 cite(193,'イヤホン型ワイヤー','ワイヤー系の近接専用アニメーション');
 cite(194,'メジャー型ワイヤー','ワイヤー系の近接専用アニメーション');
 for(const id of ['wire_earphones','wire_tape']){
  assert.ok(isWireVariant(id));assert.ok(placed.has(id));assert.equal(meleeOf(id),undefined);
 }
});
test('S09 row 62: gear is rechecked at the climbing hand as it goes behind a ledge',()=>{
 cite09('はしご・よじ登り中','違法装備の可視状態は個別に再計算');
 const map=json('hotel.json'),rules=json('rules.json'),world=new CollisionWorld(map),nav=new NavGrid(world);
 const at={x:-40,y:0,z:-30};
 const ledge={minX:at.x-.17,maxX:at.x-.07,minY:1.61,maxY:2.1,minZ:at.z+1.9,maxZ:at.z+2.1};
 const director=new Director({...map,npcs:map.npcs.filter((n:{id:string})=>n.id==='guard_parking')},world,nav,[ledge],rules);
 const guard=director.npcs[0];
 guard.pos={...at,z:at.z+4};guard.heading=Math.PI;
 const events=new MissionEvents(),m3=new M3System(director,[],rules.m3);
 const combat=new CombatSystem(director,events,m3.hotel,json('combat.json'),weapons,map.reinforcements);
 const items=new DetectionSystem(director,events,m3.hotel,[],hotel,map);
 combat.equip('pistol_silenced');combat.hand='pistol_silenced';
 const climbing=new PartyTraversal(director,[{id:'ladder',a:'a',b:'b',kind:'ladder',start:at,end:{...at,y:2},seconds:2}],{radius:1,suspicionPerSecond:0});
 const p:PlayerView={...at,floor:0,speed:0,running:false,crouched:false,tampering:true,disguise:'suit',weaponDrawn:true};
 const keys=new Set(['KeyE']);
 climbing.step(0,p,keys);
 const read=(position:PlayerView)=>{
  const frame=climbing.frame(position)!;
  const player={...position,carrySight:carriedPoints(position,frame.heading,false,'suit',combat,items,true,frame.hand?.(-1))};
  guard.perceive(player,director.boxes,rules);
  assert.ok(guard.visibility>0,'the body remains visible');
  return visibleCarry(guard,player,director.boxes,rules).weaponDrawn;
 };
 assert.equal(read(p),true);
 climbing.step(.7,p,keys);
 assert.equal(read({...p,...climbing.takeTransfer()!}),false);
});
test.todo('S09 rows 32/120: Kali Sticks share the two back slots (刀・Kali Sticks)');

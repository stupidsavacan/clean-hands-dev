// HD01 (hitman-decisions.json): one gun at most — the user's rule, kept even when aligning with HITMAN.
// HD13: the UI lab can leave a selected tool at the pickup with one gun at most.
// 2026-11-06: the loadout rules (src/loadout.ts). User report: the HITMAN-style planning screen let a gun be carried in
// AND another be left at the pickup — two guns. One gun at most, wherever it waits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanLoadout,choose,blockedReason,defaultLoadout,loadoutGuns,GUN_LIMIT,IN_CASE,type LoadoutMission,type Loadout} from '../src/loadout.ts';

const club=JSON.parse(readFileSync(new URL('../src/data/club-mission.json',import.meta.url),'utf8')) as LoadoutMission;
const party=JSON.parse(readFileSync(new URL('../src/data/party-mission.json',import.meta.url),'utf8')) as LoadoutMission;
const SLOTS=['pistol','pickup','gear0','gear1','start','case'] as const;
const options=(m:LoadoutMission,slot:typeof SLOTS[number])=>slot==='pistol'?m.pistols.map(p=>p.id):slot==='pickup'?['',IN_CASE,...(m.pickups??[]).map(p=>p.id)]:slot==='case'?['',...(m.cases??[]).map(c=>c.id)]:slot==='start'?m.starts.map(s=>s.id):['',...m.tools.map(t=>t.id)];
const valid=(l:Loadout,m:LoadoutMission)=>{
 assert.ok(loadoutGuns(l).length<=GUN_LIMIT,`two guns: ${JSON.stringify(l)}`);
 assert.ok(!l.pickup||l.pistol,'a pickup with no gun');assert.ok(l.pickup!==IN_CASE||l.case,'a gun in a case with no case');
 assert.equal(new Set(l.tools).size,l.tools.length,'the same tool twice');
 assert.ok(l.tools.length<=m.toolSlots);
 assert.ok(m.starts.some(s=>s.id===l.start&&s.open!==false));};

test('club: every sequence of choices (4 steps deep) keeps one gun at most and a valid loadout',()=>{
 let states=[defaultLoadout(club)],seen=0;
 for(let depth=0;depth<4;depth++){const next:Loadout[]=[];
  for(const l of states)for(const slot of SLOTS)for(const id of options(club,slot)){const r=choose(l,club,slot,id);valid(r,club);next.push(r);seen++;}
  states=[...new Map(next.map(l=>[JSON.stringify(l),l])).values()];}
 assert.ok(seen>200,`only ${seen} choices tried`);});

test('club: the pickup holds the one gun (carried in, or waiting at P1–P3), never a second',()=>{
 let l=choose(defaultLoadout(club),club,'pistol','pistol_silenced');
 assert.deepEqual(loadoutGuns(l),[{id:'pistol_silenced',at:'carried'}]);
 l=choose(l,club,'pickup','P1');assert.deepEqual(loadoutGuns(l),[{id:'pistol_silenced',at:'P1'}]);
 l=choose(l,club,'pistol','tranq_pistol');assert.deepEqual(loadoutGuns(l),[{id:'tranq_pistol',at:'P1'}],'changing the gun keeps where it waits');
 l=choose(l,club,'pistol','');assert.deepEqual(loadoutGuns(l),[]);assert.equal(l.pickup,'','no gun, no pickup');});

test('HD13: the lab stashes one selected tool instead of the gun at the same pickup slot',()=>{
 const mission={...club,toolPickupEnabled:true};
 let l=cleanLoadout({tools:['coin'],pistol:'pistol_silenced',pickup:'P1'},mission);
 assert.match(blockedReason(l,mission,'toolPickup','poison_lethal@P2'),/道具枠/);
 l=choose(l,mission,'toolPickup','coin@P2');
 assert.deepEqual(l.toolPickup,{tool:'coin',at:'P2'});
 assert.deepEqual(loadoutGuns(l),[{id:'pistol_silenced',at:'carried'}]);
 assert.equal(choose(l,mission,'gear0','').toolPickup,undefined);
 assert.equal(choose(l,mission,'pickup','P1').toolPickup,undefined);
 assert.equal(cleanLoadout(l,club).toolPickup,undefined,'the current game cannot load the lab-only option');
});

test('club: a pickup cannot be chosen before a gun, and says why',()=>{
 const l=defaultLoadout(club);assert.match(blockedReason(l,club,'pickup','P2'),/先に銃/);assert.deepEqual(choose(l,club,'pickup','P2'),l);
 assert.equal(blockedReason(l,club,'pickup',''),'');});

test('club: the two gear slots never hold the same tool',()=>{
 const l=cleanLoadout({tools:['coin','poison_lethal']},club);
 assert.match(blockedReason(l,club,'gear1','coin'),/もう一方/);assert.deepEqual(choose(l,club,'gear1','coin'),l);
 assert.deepEqual(choose(l,club,'gear1','').tools,['coin']);});

test('a loadout saved by the earlier screen (gun + another gun at the pickup) is cleaned to one gun',()=>{
 assert.deepEqual(cleanLoadout({tools:['coin'],pistol:'pistol_silenced',start:'S1',pickup:'P1',pickupItem:'tranq_pistol'},club),{tools:['coin'],pistol:'pistol_silenced',start:'S1',pickup:'',case:''});
 assert.deepEqual(cleanLoadout({tools:[],pistol:'',start:'S1',pickup:'P3',pickupItem:'tranq_pistol'},club),{tools:[],pistol:'tranq_pistol',start:'S1',pickup:'P3',case:''});
 assert.deepEqual(cleanLoadout({tools:['coin','coin','x','poison_lethal'],pistol:'bazooka',start:'S9',pickup:'P1'},club),{tools:['coin','poison_lethal'],pistol:'',start:'S1',pickup:'',case:''});
 assert.deepEqual(cleanLoadout(null,club),defaultLoadout(club));});

test('party (no pickups): a pickup id is dropped',()=>{
 const gun=party.pistols.find(p=>p.id)?.id;if(!gun)return;
 assert.equal(cleanLoadout({tools:[],pistol:gun,start:party.starts[0].id,pickup:'P1'},party).pickup,'');});

test('the game itself still brings one gun: the pistol is stashed at the pickup or equipped, never both',()=>{
 const src=readFileSync(new URL('../src/engine/game.ts',import.meta.url),'utf8');
 assert.ok(!src.includes('pickupItem'),'the second-gun field is gone from the game');
 assert.match(src,/if\(loadout\.pistol\)\{const at=pickups\.find\(p=>p\.id===loadout\.pickup\);if\(at\)combat\.stash\(loadout\.pistol,[^;]+;else combat\.equip\(loadout\.pistol\);\}/);});

// HD11 (2026-11-07; 194-item table row 21): the briefcase is a loadout choice; the one gun may wait inside it.
test('HD11: the briefcase can be chosen, and the gun can go inside it (still one gun)',()=>{
 assert.ok(club.cases?.some(c=>c.id==='briefcase'),'the club offers the briefcase');
 let l=choose(defaultLoadout(club),club,'pistol','pistol_silenced');
 assert.match(blockedReason(l,club,'pickup',IN_CASE),/ケース/);assert.equal(choose(l,club,'pickup',IN_CASE).pickup,'','no case yet: the gun cannot go in one');
 l=choose(l,club,'case','briefcase');assert.equal(l.case,'briefcase');l=choose(l,club,'pickup',IN_CASE);
 assert.deepEqual(loadoutGuns(l),[{id:'pistol_silenced',at:IN_CASE}]);
 l=choose(l,club,'case','');assert.equal(l.pickup,'','dropping the case takes the gun back onto the body');assert.deepEqual(loadoutGuns(l),[{id:'pistol_silenced',at:'carried'}]);
 assert.equal(cleanLoadout({tools:[],pistol:'',start:'S1',pickup:'',case:'toolbox'},club).case,'','only the cases the mission offers');});

test('HD11: the game starts with the case in hand and the gun inside when chosen',()=>{
 const src=readFileSync(new URL('../src/engine/game.ts',import.meta.url),'utf8');
 assert.match(src,/if\(loadout\.case\)\{detection\.held=loadout\.case;if\(loadout\.pistol&&loadout\.pickup===IN_CASE\)/);
 assert.match(src,/loadout=cleanLoadout\(\{tools:picked\('tool'\),pistol:picked\('pistol'\)\[0\]\?\?'',start:picked\('start'\)\[0\]\?\?firstStart,pickup:picked\('pickup'\)\[0\]\?\?'',case:picked\('case'\)\[0\]\?\?''\},loadoutMission\)/,'the current prep screen goes through the same rules');});

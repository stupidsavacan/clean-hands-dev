// CLEAN_HANDS_M5_8_AI_COMBAT_FIX_SPEC (2026-11-02): the acceptance tests of F01-F12, on the real hotel.
import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type Npc,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {M3System}from '../src/m3.ts';import {M4System,type Checkpoint}from '../src/m4.ts';
import {CombatSystem,kindOf,type CombatRules,type WeaponDef}from '../src/combat.ts';import {evaluateItemLegality,itemMaster}from '../src/items.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),combatRules:CombatRules=json('combat'),weapons:Record<string,WeaponDef>=json('weapons'),detection=json('detection');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel),master=itemMaster(weapons,detection.items,rules.m4.items);
const LOT={x:-40,y:0,z:-30};
function setup(rng=()=>0){const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),e=new MissionEvents(),m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),c=new CombatSystem(d,e,m3.hotel,combatRules,weapons,hotel.reinforcements,rng);
 m4.items=c.items=master;m4.extraInventory=()=>c.guns.map(g=>g.id);for(const n of d.npcs){n.pos={x:200+Math.random(),y:0,z:200};n.state='patrol';n.scheduled=false;}return {d,e,m3,m4,c};}
const view=(p:{x:number;y:number;z:number},disguise='suit',o:Partial<PlayerView>={}):PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise,...o});
const place=(s:ReturnType<typeof setup>,id:string,at:{x:number;y?:number;z:number},facing:number):Npc=>{const n=s.d.npcs.find(n=>n.id===id)!;n.pos={x:at.x,y:at.y??0,z:at.z};n.heading=facing;return n;};

test('F01: one item rule — carrying, seeing and frisking agree for every outfit',()=>{
 const L=(id:string,d:string,mode:'holstered'|'slung'|'drawn'='slung',policy?:'no_long_guns')=>evaluateItemLegality(master,id,d,mode,{weaponPolicy:policy});
 for(const d of ['guard','bodyguard'])assert.deepEqual([L('smg',d).possessionAllowed,L('smg',d).visibleCarryAllowed,L('smg',d).friskContraband],[true,true,false],d);
 assert.deepEqual([L('smg','suit').visibleCarryAllowed,L('smg','suit').friskContraband],[false,true]);
 assert.equal(L('smg','guard','slung','no_long_guns').prohibitedHere,true);assert.match(L('smg','guard','slung','no_long_guns').reason,/検問/);
 assert.equal(L('pistol_silenced','guard','holstered').friskContraband,true);assert.equal(L('wire','suit','holstered').friskContraband,false);
 assert.equal(L('smg','guard','drawn').visibleCarryAllowed,false,'a gun in hand is never fine');
 // The three tables no longer disagree: the frisk table had no allowedFor for the SMG.
 assert.deepEqual(master.smg.allowedFor.sort(),['bodyguard','guard']);assert.equal(master.wire.friskDetect,false);});

test('F01/F04: guard + SMG walks through (exempt here); suit + SMG cannot start a frisk; a pass is voided by picking something up',()=>{
 const s=setup(),c=s.m4.checkpoints[0] as Checkpoint;s.c.guns.push({id:'smg',mag:30,reserve:0});
 s.m4.disguise='guard';assert.equal(s.m4.requiresFrisk(c),false);assert.equal(s.m4.passed(c),true);
 // Playtest 2026-11-02 memo「検査必要やん」: not frisked means not searched — a silenced pistol goes through too.
 s.c.guns.push({id:'pistol_silenced',mag:8,reserve:8});assert.equal(s.m4.passed(c),true);s.c.guns.pop();
 assert.equal(s.m4.passed({...c,weaponPolicy:'no_long_guns'}),false,'a checkpoint can still bar long guns');
 s.m4.disguise='bodyguard';assert.equal(s.m4.requiresFrisk(c),true);assert.equal(s.m4.mayStartFrisk(c),true,'the bodyguard may carry the SMG');
 s.m4.disguise='suit';assert.equal(s.m4.mayStartFrisk(c),false);assert.deepEqual(s.m4.friskFinds(c),['smg']);
 s.c.guns.length=0;assert.equal(s.m4.mayStartFrisk(c),true);s.m4.passes.set(c.id,{until:999,disguise:'suit',carried:'wire'});assert.equal(s.m4.passed(c),true);
 s.c.guns.push({id:'pistol_silenced',mag:8,reserve:8});assert.equal(s.m4.passed(c),false,'carrying something new voids the pass');});

test('F05: a gun drawn, an SMG slung illegally and a legal SMG are told apart, and a drawn gun is fought, not arrested',()=>{
 const s=setup();s.c.guns.push({id:'smg',mag:30,reserve:0});assert.deepEqual([!!s.c.hand,s.c.shown('guard'),s.c.illegalIn('guard')],[false,false,false]);
 assert.deepEqual([s.c.shown('suit'),s.c.illegalIn('suit')],[true,true]);s.c.hand='smg';assert.deepEqual([s.c.shown('guard'),s.c.illegalIn('guard')],[false,true]);
 const g=place(s,'guard_parking',{x:LOT.x,z:LOT.z+1.5},Math.PI),p=view(LOT,'guard',{weaponDrawn:true,illegal:true});g.state='alert';g.arrest=true;g.knownDisguises.add('guard');
 for(let i=0;i<30;i++){s.d.step(.1,p);s.c.step(.1,p,i*.1);}assert.equal(s.d.caught,false);assert.equal(g.state,'combat');});

test('F03: a loud shot indoors is not heard 100 m away on the same floor; one nobody hears changes nothing',()=>{
 const s=setup(),from={x:-30,y:1.4,z:-12},far=place(s,'guard_corridor',{x:60,z:-12},0);far.pos.y=0;far.outdoor=false;
 s.c.noise(from,'loud',view(LOT),0);assert.equal(far.state,'patrol');assert.equal(s.m3.hotel.level,0,'no listener, no uproar');assert.equal(s.d.zoneAlert.size,0);
 const near=place(s,'guard_banquet',{x:-26,z:-12},0);near.outdoor=false;const heard=s.c.noise(from,'loud',view(LOT),1);assert.ok(heard.includes(near));assert.equal(near.state,'investigate');assert.equal(s.m3.hotel.level,2);
 // Two floors apart is out of reach whatever the distance.
 const up=place(s,'guard_heliport',{x:-30,y:7,z:-12},0);assert.equal(s.c.canHearGunshot(up,{x:-30,y:0,z:-12},'loud',false),false);});

test('F02/F06: a guard shot from behind and not killed goes to where the shot came from, without knowing who or where the agent is now',()=>{
 const s=setup();s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';const p=view(LOT),g=place(s,'guard_parking',{x:LOT.x,z:LOT.z+6},0);g.hp=500;
 s.c.fire(p,{x:g.pos.x,y:1.1,z:g.pos.z},1);assert.equal(g.state,'search');assert.equal(s.c.fight,null);assert.equal(s.d.compromised.has('suit'),false);
 assert.ok(Math.hypot(g.goal!.x-LOT.x,g.goal!.z-LOT.z)<.5,'to the firing point');assert.ok(g.knowledge.some(k=>k.eventType==='wounded'&&!k.confirmedActor));
 // Seen with the gun: a fight.
 const s2=setup();s2.c.equip('pistol_silenced');s2.c.hand='pistol_silenced';const g2=place(s2,'guard_parking',{x:LOT.x,z:LOT.z+6},Math.PI);g2.hp=500;s2.c.fire(p,{x:g2.pos.x,y:1.1,z:g2.pos.z},1);assert.equal(g2.state,'combat');
 // A bystander runs.
 const s3=setup();s3.c.equip('pistol_silenced');s3.c.hand='pistol_silenced';const b=place(s3,'driver_1',{x:LOT.x,z:LOT.z+6},Math.PI);b.hp=500;s3.c.fire(p,{x:b.pos.x,y:1.1,z:b.pos.z},1);assert.equal(b.state,'flee');});

test('F07: nobody knows the agent at the start; the security chief sees through the guard uniform, a guard in the same uniform does not',()=>{
 const s=setup();assert.equal(s.d.compromised.size,0);for(const n of s.d.npcs)assert.equal(n.hasConfirmedIdentity({disguise:'guard'}),false,n.id);
 const chief=s.d.npcs.find(n=>n.id==='security_chief')!,plain=s.d.npcs.find(n=>n.id==='guard_front')!;
 assert.equal(chief.isEnforcerFor('guard'),true);assert.equal(plain.isEnforcerFor('guard'),false);assert.equal(s.d.npcs.find(n=>n.id==='monitor_watcher')!.isEnforcerFor('guard'),true);});

test('F08: guests who see an outfit already blown tell a guard, but that is no new incident — the hotel alert does not climb per guest',()=>{
 const s=setup();s.d.compromised.add('guard');const p=view({x:LOT.x,y:0,z:LOT.z},'guard');
 const gs=['guest_stroll_1','guest_stroll_2','guest_stroll_3','guest_stroll_4'].map((id,i)=>place(s,id,{x:LOT.x-1.5+i,z:LOT.z+3},Math.PI));
 for(let i=0;i<20;i++)s.d.step(.1,p);const told=gs.filter(g=>g.witness);assert.ok(told.length>=3,told.map(g=>g.id).join());for(const g of told){assert.equal(g.witness!.what,'suspect');assert.equal(g.witness!.disguise,'guard');}
 assert.equal(s.m3.hotel.level,0);});

test('F09/F10: combat profiles come from the data and match the old ones; the penthouse guard keeps a pistol',()=>{
 for(const n of hotel.npcs){assert.ok(n.combatProfile,n.id);const old=n.id.startsWith('bodyguard')?'bodyguard':n.role==='guard'?'guard':'civilian';assert.equal(kindOf(n),old,n.id);}
 const s=setup(),pent=s.d.npcs.find(n=>n.id==='guard_penthouse')!,cap=s.d.npcs.find(n=>n.id==='bodyguard_captain')!;
 assert.deepEqual([pent.kind,pent.weapon,pent.hp],['guard','pistol_guard',100]);assert.deepEqual([cap.kind,cap.weapon,cap.hp,cap.faction,cap.securityRole],['bodyguard','smg',150,'private_security','captain']);});

test('F11/F12: three waves of four response members, then no more; each is a response profile and drops an SMG',()=>{
 const s=setup();s.m3.hotel.level=3;const p=view({x:0,y:0,z:0});for(let t=0;t<400;t+=1)s.c.step(1,p,t);
 const r=s.d.npcs.filter(n=>n.reinforcement);assert.equal(r.length,12);assert.equal(s.c.snapshot().reinforcementRemaining,0);
 for(const n of r)assert.deepEqual([n.kind,n.weapon,n.hp,n.combatProfile],['response','rifle_npc',200,'response']);
 for(let t=400;t<800;t+=1)s.c.step(1,p,t);assert.equal(s.d.npcs.filter(n=>n.reinforcement).length,12,'no endless waves');
 r[0].life='dead';r[0].fall=1;s.c.step(.1,p,801);assert.equal(s.c.dropped.at(-1)!.gun.id,'smg');assert.equal(r[0].weapon,'');});

test('F11 (playtest「不動の増援」): response members do not deadlock at the parking spawn and keep searching during the lockdown',()=>{
 let seed=7;const rng=()=>(seed=(seed*16807)%2147483647)/2147483647;const s=setup(rng);for(const n of s.d.npcs)n.pos={x:200,y:0,z:200};
 const p=view({x:-10,y:7,z:-12},'bodyguard');Object.assign(s.c,{lastKnown:{x:-4,y:7,z:.7},lastSighted:100});s.m3.hotel.level=3;
 const start=new Map<string,{x:number;z:number}>();for(let i=0;i<30*150;i++){s.d.step(1/30,p);s.c.step(1/30,p,i/30);for(const n of s.d.npcs)if(n.reinforcement&&!start.has(n.id))start.set(n.id,{...n.pos});}
 const r=s.d.npcs.filter(n=>n.reinforcement).slice(0,4);assert.equal(r.length,4);
 for(const n of r){assert.notEqual(n.state,'patrol',n.id);assert.ok(Math.hypot(n.pos.x-start.get(n.id)!.x,n.pos.z-start.get(n.id)!.z)>5,`${n.id} left the spawn`);}});

test('playtest 2026-11-02: a picked-up SMG or pistol can be dropped without drawing it (long gun first), so the frisk can start',()=>{
 const s=setup(),c=s.m4.checkpoints[0] as Checkpoint;s.c.guns.push({id:'pistol_silenced',mag:8,reserve:8},{id:'smg',mag:30,reserve:0});s.m4.disguise='suit';assert.equal(s.m4.mayStartFrisk(c),false);
 assert.equal(s.c.drop(LOT)?.id,'smg');assert.equal(s.c.hand,'');assert.equal(s.c.drop(LOT)?.id,'pistol_silenced');assert.equal(s.c.guns.length,0);assert.equal(s.m4.mayStartFrisk(c),true);});

test('playtest 2026-11-02: a guard drawn upstairs walks back down to his own floor instead of standing there for good',()=>{
 const s=setup(),g=place(s,'guard_front',{x:8,y:3.5,z:-13.5},0);g.state='patrol';const p=view({x:200,y:0,z:200});
 for(let i=0;i<30*90&&g.pos.y>.5;i++)s.d.step(1/30,p);assert.ok(g.pos.y<.5,`still at y ${g.pos.y.toFixed(2)}`);});

test('playtest 2026-11-03「無限に警戒中」: once the agent has not been seen or heard for sweepSeconds, the response team stops searching',()=>{
 let seed=11;const rng=()=>(seed=(seed*16807)%2147483647)/2147483647;const s=setup(rng);const p=view({x:-10,y:7,z:-12},'bodyguard');
 Object.assign(s.c,{lastKnown:{x:-4,y:7,z:.7},lastSighted:0});s.m3.hotel.level=3;const sweep=combatRules.reinforcements.sweepSeconds??120;
 for(let i=0;i<30*(sweep+150);i++){s.d.step(1/30,p);s.c.step(1/30,p,i/30);}
 const r=s.d.npcs.filter(n=>n.reinforcement);assert.ok(r.length>=4);for(const n of r)assert.ok(!['search','investigate','alert'].includes(n.state),`${n.id} still ${n.state}`);});

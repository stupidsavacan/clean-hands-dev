import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,type Npc,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {M3System}from '../src/m3.ts';import {M4System}from '../src/m4.ts';
import {CombatSystem,hitChance,type CombatRules,type WeaponDef}from '../src/combat.ts';import {ScoreLedger,computeResult,type Scoring}from '../src/score.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),combatRules:CombatRules=json('combat'),weapons:Record<string,WeaponDef>=json('weapons'),scoring:Scoring=json('scoring');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel);
// The parking lot is open ground: people are placed there so only the line of fire matters.
const LOT={x:-40,y:0,z:-30};
function setup(rng=()=>0){const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),e=new MissionEvents(),m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),c=new CombatSystem(d,e,m3.hotel,combatRules,weapons,hotel.reinforcements,rng),seen:string[]=[];e.on(x=>seen.push(x.type));
 const ledger=new ScoreLedger(e,id=>{const n=d.npcs.find(n=>n.id===id);return n&&{role:n.role,target:n.target};});d.onSpotted=n=>e.emit({type:'player.spotted',time:0,id:n.id});
 // Everyone else is sent far away, so only the people a test places can see or be hit.
 for(const n of d.npcs){n.pos={x:200+Math.random(),y:0,z:200};n.state='patrol';}return {d,e,m3,m4,c,seen,ledger};}
const view=(p:{x:number;y:number;z:number},disguise='suit',crouched=false):PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched,tampering:false,disguise});
const place=(s:ReturnType<typeof setup>,id:string,at:{x:number;z:number},facing:number):Npc=>{const n=s.d.npcs.find(n=>n.id===id)!;n.pos={x:at.x,y:0,z:at.z};n.heading=facing;n.scheduled=false;return n;};
const AWAY=Math.PI,TOWARD=0; // the player stands south (-z) of the people placed below; heading 0 faces +z

test('M5.5 weapons: the pistol is hidden until drawn; an SMG is always seen; slots, cycling and reload follow weapons.json',()=>{
 const s=setup();s.c.equip('pistol_silenced');assert.equal(s.c.armed,false);assert.equal(s.c.cycle(),'pistol_silenced');assert.equal(s.c.armed,true);assert.equal(s.c.cycle(),'');
 s.c.guns.push({id:'smg',mag:30,reserve:0});assert.equal(s.c.armed,true,'a long gun cannot be concealed');
 s.c.hand='pistol_silenced';const g=s.c.held!;g.mag=3;assert.ok(s.c.reload());s.c.step(combatRules.reloadSeconds+.01,view(LOT),1);assert.deepEqual([g.mag,g.reserve],[8,3]);
 assert.equal(hitChance(combatRules,5),.6);assert.equal(hitChance(combatRules,20),.2);assert.ok(Math.abs(hitChance(combatRules,12.5)-.4)<1e-9);assert.equal(hitChance(combatRules,2),.6);});

test('M5.5 HITMAN rule: an unseen silenced headshot is a quiet kill — no fight, nobody spotted, no penalty but the kill itself',()=>{
 const s=setup();s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';const p=view(LOT),target=place(s,'guard_parking',{x:LOT.x,z:LOT.z+6},AWAY);
 const shot=s.c.fire(p,{x:target.pos.x,y:1.65,z:target.pos.z},1);assert.ok(shot.hit===target&&shot.head&&shot.killed);
 assert.equal(target.life,'dead');assert.equal(target.deathKind,'murder');assert.equal(s.c.fight,null);assert.ok(!s.seen.includes('combat.started'));assert.equal(s.m3.hotel.level,0,'a silenced shot does not raise the hotel');
 for(let i=0;i<20;i++)s.c.step(.1,p,1+i*.1);assert.equal(s.ledger.count('spotted'),0);assert.equal(s.ledger.count('combat'),0);assert.equal(s.ledger.count('loud_shot_once'),0);
 assert.equal(s.c.dropped[0].gun.id,'pistol_guard','the guard drops the pistol');assert.equal(s.c.held!.mag,7);});

test('M5.5 a body shot that does not kill, or being seen with the gun out, starts a fight and blows the outfit',()=>{
 const s=setup();s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';const p=view(LOT),g=place(s,'guard_parking',{x:LOT.x,z:LOT.z+6},AWAY);
 const shot=s.c.fire(p,{x:g.pos.x,y:1.1,z:g.pos.z},2);assert.equal(shot.killed,false);assert.equal(g.hp,50);assert.equal(g.state,'combat');assert.ok(s.c.fight);assert.ok(s.d.compromised.has('suit'));
 const s2=setup();s2.c.equip('pistol_silenced');s2.c.hand='pistol_silenced';const w=place(s2,'guard_dock',{x:LOT.x,z:LOT.z+5},AWAY),guest=place(s2,'driver_1',{x:LOT.x+2,z:LOT.z+5},AWAY);
 for(const n of [w,guest])n.perceive(view(LOT),boxes,s2.d.rules);s2.c.step(.1,view(LOT),3);assert.equal(w.state,'combat');assert.equal(guest.state,'flee');assert.equal(s2.ledger.count('spotted'),2);assert.equal(s2.ledger.count('combat'),1);});

test('M5.5 shots stop at walls; silenced shots are heard within 8 m; a loud shot is an uproar (alert 2) and a panic; a fight that goes on means alert 3 and two exits closed',()=>{
 const s=setup();s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';
 // Kitchen: the agent outside the west wall of the hotel, a person just inside.
 const wall=hotel.walls.find((w:{id:string;h:number;w:number;d:number})=>w.h>=2.5&&w.d>=6&&w.w<.4)!;const p=view({x:wall.x-2,y:0,z:wall.z}),inside=place(s,'guard_parking',{x:wall.x+2,z:wall.z},-Math.PI/2);
 assert.equal(s.c.fire(p,{x:inside.pos.x,y:1.2,z:inside.pos.z},1).hit,null);assert.equal(inside.hp,100);
 const s2=setup();s2.c.equip('pistol_silenced');s2.c.hand='pistol_silenced';const near=place(s2,'guard_parking',{x:LOT.x+6,z:LOT.z},TOWARD),far=place(s2,'guard_dock',{x:LOT.x+12,z:LOT.z},TOWARD);
 s2.c.fire(view(LOT),{x:LOT.x,y:1.4,z:LOT.z-10},1);assert.equal(near.state,'investigate');assert.equal(far.state,'patrol');assert.equal(s2.m3.hotel.level,0);
 const s3=setup();s3.c.guns.push({id:'pistol_guard',mag:12,reserve:0});s3.c.hand='pistol_guard';const bystander=place(s3,'driver_1',{x:LOT.x+30,z:LOT.z},TOWARD);
 s3.c.fire(view(LOT),{x:LOT.x,y:1.4,z:LOT.z-10},1);assert.equal(s3.m3.hotel.level,2);assert.deepEqual(s3.c.closedExits(),[]);assert.equal(bystander.state,'flee');
 // A guard sees the gun: the fight starts, and after alert3After seconds of it the hotel locks down.
 const g=place(s3,'guard_parking',{x:LOT.x,z:LOT.z+8},AWAY);s3.c.engage(g,view(LOT),1);s3.c.step(.1,view(LOT),1+combatRules.alert3After!-1);assert.equal(s3.m3.hotel.level,2);s3.c.step(.1,view(LOT),1+combatRules.alert3After!);assert.equal(s3.m3.hotel.level,3);assert.deepEqual(s3.c.closedExits(),['E1','E2']);
 assert.equal(s3.ledger.count('loud_shot_once'),1);assert.equal(computeResult(scoring,s3.ledger.counts,100,true).lines.find(l=>l.key==='loud_shot_once')!.points,-1000);});

test('M5.5 guards in a fight wait the reaction time, then hit by distance; partial cover halves it; health regenerates after 10 s',()=>{
 const s=setup(()=>0);const p=view(LOT),g=place(s,'guard_parking',{x:LOT.x,z:LOT.z+5},AWAY);s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';g.perceive(p,boxes,s.d.rules);s.c.step(.01,p,0);assert.equal(g.state,'combat');
 for(let t=.1;t<combatRules.reactionTime-.05;t+=.1){g.perceive(p,boxes,s.d.rules);s.c.step(.1,p,t);}assert.equal(s.c.hp,100,'no shot before the reaction time');
 for(let t=.6;t<1.2;t+=.1){g.perceive(p,boxes,s.d.rules);s.c.step(.1,p,t);}assert.ok(s.c.hp<=80,`hit for ${combatRules.enemies.guard.hit}`);const after=s.c.hp;
 g.state='patrol';g.visibility=0;s.c.step(9,p,s.c.lastHit+9);assert.equal(s.c.hp,after,'no regeneration within 10 s of a hit');s.c.step(1,p,s.c.lastHit+11);assert.ok(Math.abs(s.c.hp-after-5)<1e-6);
 // rng 0.35: a hit at 5 m (0.6) in the open, a miss behind partial cover (0.3).
 const open=setup(()=>.35),covered=setup(()=>.35);for(const [x,vis] of [[open,1],[covered,1/3]] as const){const n=place(x,'guard_parking',{x:LOT.x,z:LOT.z+5},AWAY);x.c.equip('pistol_silenced');x.c.hand='pistol_silenced';n.visibility=1;x.c.step(.01,p,0);n.reactT=1;n.fireT=0;n.visibility=vis;x.c.step(.01,p,1);}
 assert.equal(open.c.hp,80);assert.equal(covered.c.hp,100);
 const dying=setup(()=>0);dying.c.hp=10;const k=place(dying,'guard_parking',{x:LOT.x,z:LOT.z+5},AWAY);dying.c.engage(k,p,0);k.visibility=1;k.reactT=1;k.fireT=0;dying.c.equip('pistol_silenced');dying.c.hand='pistol_silenced';dying.c.step(.01,p,1);assert.equal(dying.c.dead,true);assert.equal(dying.c.fights[0].survived,false);});

test('M5.5 alert 3 brings waves of 4 from the parking lot and loading dock every 60 s, three at most; they cannot be worn',()=>{
 const s=setup(),first=combatRules.reinforcements.firstDelay??0;const before=s.d.npcs.length;s.m3.hotel.level=3;const p=view(LOT);s.c.step(.1,p,0);assert.equal(s.d.npcs.length,before,'the first wave needs time to arrive');s.c.step(.1,p,first);assert.equal(s.d.npcs.length,before+4);
 s.c.step(.1,p,first+30);assert.equal(s.d.npcs.length,before+4);s.c.step(.1,p,first+60);s.c.step(.1,p,first+120);s.c.step(.1,p,first+180);assert.equal(s.d.npcs.length,before+12);
 const r=s.d.npcs.at(-1)!;assert.equal(r.kind,'response');assert.equal(r.hp,200);assert.equal(r.weapon,'rifle_npc');assert.ok(r.reinforcement);
 r.life='dead';r.fall=1;r.pos={...LOT};assert.equal(s.m4.source(LOT)?.npc,undefined,'no disguise from a response member');});

test('M5.5 losing sight ends the fight; changing clothes unseen and walking 30 m away returns the agent to infiltration',()=>{
 const s=setup(()=>.99);s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';const p=view(LOT),g=place(s,'guard_parking',{x:LOT.x,z:LOT.z+5},AWAY);
 g.perceive(p,boxes,s.d.rules);s.c.step(.1,p,0);assert.ok(s.c.fight);s.c.holster();
 // Out of sight: the guard gives up and searches; the fight ends a few seconds later.
 let t=.1;for(;t<20&&s.c.fight;t+=.1){g.visibility=0;s.c.step(.1,p,t);}assert.equal(s.c.fight,null);assert.equal(g.state,'search');assert.equal(s.c.fights[0].survived,true);assert.equal(s.c.fights[0].returned,null);
 // Change clothes (the existing M4 rule clears the blown outfit 30 m from where it was dropped, unseen) and the search ends.
 s.m4.disguise='waiter';s.d.compromised.delete('suit');g.state='patrol';s.c.step(.1,view(LOT,'waiter'),t);assert.equal(s.c.fights[0].returned,true);});

test('M5.5 bodies from a gunfight are not "found" for the score or the alert; a dropped gun can be picked up',()=>{
 const s=setup();s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';const p=view(LOT),a=place(s,'guard_parking',{x:LOT.x,z:LOT.z+6},AWAY),b=place(s,'guard_dock',{x:LOT.x+3,z:LOT.z+6},AWAY);
 s.c.fire(p,{x:a.pos.x,y:1.1,z:a.pos.z},0);assert.ok(s.c.fight);s.c.fireT=0;s.c.fire(p,{x:a.pos.x,y:1.65,z:a.pos.z},.5);assert.equal(a.deathKind,'combat');
 a.fall=1;b.state='patrol';b.heading=Math.atan2(a.pos.x-b.pos.x,a.pos.z-b.pos.z);s.m3.discover();assert.equal(s.m3.hotel.level,0);assert.equal(s.ledger.count('body_found'),0);
 const drop=s.c.dropped[0];const got=s.c.pickup(drop.pos);assert.equal(got,'警備の拳銃');assert.deepEqual(s.c.guns.map(g=>g.id),['pistol_guard']);assert.equal(s.c.hand,'pistol_guard');assert.equal(s.c.dropped[0].gun.id,'pistol_silenced','the old pistol is left on the floor');});

test('M5.5 aiming over the shoulder: the crosshair on the head kills with one silenced shot, on the body it wounds, on a wall it stops',()=>{
 // A third-person camera: 2.6 m behind, 0.5 m to the right and 1.7 m up from the agent, looking at the target.
 const shoot=(heightOnTarget:number)=>{const s=setup();s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';const p=view(LOT),t=place(s,'guard_parking',{x:LOT.x,z:LOT.z+8},AWAY);
  const cam={x:LOT.x+.5,y:1.7,z:LOT.z-2.6},look={x:t.pos.x-cam.x,y:heightOnTarget-cam.y,z:t.pos.z-cam.z},aim=s.c.sightHit(cam,look);return {aim,shot:s.c.fire(p,aim.point,1),t};};
 const head=shoot(1.68);assert.equal(head.aim.npc?.id,'guard_parking');assert.equal(head.aim.head,true);assert.ok(head.shot.killed&&head.shot.head,'one silenced headshot kills');
 const body=shoot(1.3);// chest height (a lower line would clip a parked car's roof on the way, as it should)assert.equal(body.aim.npc?.id,'guard_parking');assert.equal(body.shot.hit?.id,'guard_parking');assert.equal(body.t.hp,50);
 // Shooting the parallel line instead (the old way) misses the head from over the shoulder.
 const s=setup();s.c.equip('pistol_silenced');s.c.hand='pistol_silenced';const t=place(s,'guard_parking',{x:LOT.x,z:LOT.z+8},AWAY),cam={x:LOT.x+.5,y:1.7,z:LOT.z-2.6},d={x:t.pos.x-cam.x,y:1.68-cam.y,z:t.pos.z-cam.z},k=60/Math.hypot(d.x,d.y,d.z);
 assert.equal(s.c.fire(view(LOT),{x:cam.x+d.x*k,y:cam.y+d.y*k,z:cam.z+d.z*k},1).head,false);
 const wall=hotel.walls.find((w:{h:number;d:number;w:number})=>w.h>=2.5&&w.d>=6&&w.w<.4)!,w=setup().c.sightHit({x:wall.x-3,y:1.5,z:wall.z},{x:1,y:0,z:0});assert.equal(w.npc,null);assert.ok(Math.abs(w.point.x-(wall.x-wall.w/2))<.01,'the aim stops on the wall face');});

test('M5.5 fix (HITMAN): a long gun on the back is fine in a security uniform; in other clothes the watcher\'s gauge fills fast, then a guard fights and a bystander runs to report',()=>{
 const s=setup();s.c.guns.push({id:'smg',mag:30,reserve:0});
 assert.equal(s.c.shown('guard'),false);assert.equal(s.c.shown('bodyguard'),false);assert.equal(s.c.shown('suit'),true);assert.equal(s.c.illegalIn('guard'),false);
 s.c.hand='smg';assert.equal(s.c.illegalIn('guard'),true,'a gun in hand is illegal in any outfit');s.c.hand='';
 // In the guard uniform the parking guard 6 m away keeps calm.
 const g=place(s,'guard_parking',{x:LOT.x,z:LOT.z+6},AWAY),pg={...view(LOT,'guard'),weaponShown:s.c.shown('guard')};
 for(let i=0;i<30;i++){s.d.step(.1,pg);s.c.step(.1,pg,i*.1);}assert.notEqual(g.state,'combat');assert.equal(s.c.fight,null);
 // In a suit: not at once, but within a few seconds.
 const s2=setup();s2.c.guns.push({id:'smg',mag:30,reserve:0});const g2=place(s2,'guard_parking',{x:LOT.x,z:LOT.z+6},AWAY),ps={...view(LOT,'suit'),weaponShown:s2.c.shown('suit')};
 s2.d.step(.1,ps);s2.c.step(.1,ps,0);assert.notEqual(g2.state,'combat','no instant fight from a gun on the back');
 let t=.1;for(;t<6&&g2.state!=='combat';t+=.1){s2.d.step(.1,ps);s2.c.step(.1,ps,t);}assert.equal(g2.state,'combat');assert.ok(t<4,`noticed in ${t.toFixed(1)} s`);assert.equal(s2.d.caught,false,'a fight, not an arrest');
 const s3=setup();s3.c.guns.push({id:'smg',mag:30,reserve:0});const w=place(s3,'driver_1',{x:LOT.x,z:LOT.z+5},AWAY);w.route.splice(0,w.route.length,[w.pos.x,w.pos.z,600]);w.routeIndex=0;(w as {look?:unknown}).look=undefined;
 for(let i=0;i<60&&!w.witness;i++){s3.d.step(.1,ps);s3.c.step(.1,ps,i*.1);}assert.ok(w.witness,'the bystander runs to tell a guard');});

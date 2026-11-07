import {test}from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';
import {Director,baseRate,permission,type Npc,type PlayerView}from '../src/ai.ts';import {CollisionWorld,floorOf,plateY}from '../src/world.ts';import {NavGrid}from '../src/nav.ts';import {sightBoxes}from '../src/sight.ts';
import {MissionEvents}from '../src/events.ts';import {M3System}from '../src/m3.ts';import {M4System}from '../src/m4.ts';
import {DetectionSystem,type DetectionData,type Camera}from '../src/detection.ts';import {ScoreLedger,computeResult,type Scoring}from '../src/score.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),data:DetectionData=json('detection'),scoring:Scoring=json('scoring');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel);
function setup(){const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),e=new MissionEvents(),m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),det=new DetectionSystem(d,e,m3.hotel,hotel.cameras as Camera[],data,hotel),seen:string[]=[];
 e.on(x=>seen.push(x.type));const ledger=new ScoreLedger(e,id=>{const n=d.npcs.find(n=>n.id===id);return n&&{role:n.role,target:n.target};});
 for(const n of d.npcs){n.pos={x:200+Math.random(),y:0,z:200};n.state='patrol';n.scheduled=false;}return {d,e,m3,m4,det,seen,ledger};}
type S=ReturnType<typeof setup>;
const view=(p:{x:number;y:number;z:number},disguise='suit',o:Partial<PlayerView>={}):PlayerView=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise,...o});
const place=(s:S,id:string,at:{x:number;y?:number;z:number},heading:number):Npc=>{const n=s.d.npcs.find(n=>n.id===id)!;n.pos={x:at.x,y:at.y??0,z:at.z};n.heading=heading;n.route.splice(0,n.route.length,[at.x,at.z,600]);n.routeIndex=0;n.wait=600;return n;};
const idle={illegal:false,trespass:false,carrying:false};

test('M5.6 every BLEND_ spot, item and the recorder stands on walkable floor reachable from the start',()=>{const spawn={...hotel.spawn,y:0};
 const ok=(x:number,z:number,floor:number)=>{const y=plateY(hotel,floor),s=world.surface(x,z,y);if(s===null||world.blocked(x,s,z))return false;const e=nav.find(spawn,{x,y,z})?.at(-1);return !!e&&Math.hypot(e.x-x,e.z-z)<.8&&Math.abs(e.y-y)<.5;};
 assert.ok(data.blend.length>=14);for(const b of data.blend)assert.ok(ok(b.x,b.z,b.floor),b.id);for(const i of data.worldItems)assert.ok(ok(i.x,i.z,i.floor),i.id);assert.ok(ok(data.recorder.x,data.recorder.z,data.recorder.floor),'recorder');
 for(const b of data.blend)for(const d of b.disguises)assert.ok(rules.disguises[d]||d==='beachbar',`${b.id}: ${d}`);});

test('M5.6 items: a wrench is fine on a cleaner and suspicious on a guest; the frisk finds illegal things but not suspicious ones or the wire',()=>{
 const s=setup();s.det.held='wrench';assert.equal(s.det.suspiciousHeld('cleaner'),false);assert.equal(s.det.suspiciousHeld('suit'),true);
 assert.deepEqual(s.det.legality('wrench','suit'),{legality:'suspicious',ok:false});assert.deepEqual(s.det.legality('bottle','waiter'),{legality:'suspicious',ok:true});assert.deepEqual(s.det.legality('coin','suit'),{legality:'normal',ok:true});
 const perm=permission(s.d.rules,'suit',undefined);assert.equal(baseRate(s.d.rules,view({x:0,y:0,z:0}),perm),0);assert.equal(baseRate(s.d.rules,view({x:0,y:0,z:0},'suit',{suspiciousItem:true}),perm),rules.rates.caution);
 s.m4.extraInventory=()=>['poison_lethal','wrench','coin'];assert.deepEqual(s.m4.friskFinds(),['poison_lethal']);
 const first=s.det.floor[0];const label=s.det.pickup(first.pos);assert.equal(label,data.items[first.item].label);assert.equal(s.det.held,first.item);
 const other=s.det.floor.find(f=>f.item!==first.item)!;s.det.pickup(other.pos);assert.equal(s.det.held,other.item);// 2026-11-06 (HITMAN-style inventory): a small old thing goes into a pocket; only a large one is left where the new one was.
 if(s.det.canPocket(first.item))assert.ok(s.det.pocket.includes(first.item),'the old thing is pocketed');
 else assert.ok(s.det.floor.some(f=>f.item===first.item&&Math.hypot(f.pos.x-other.pos.x,f.pos.z-other.pos.z)<1e-9),'swapped: the old thing is left where the new one was');});

test('M5.6 a bystander who sees a crime runs to the nearest guard; the alert only rises on arrival, and a knock-out on the way stops it',()=>{
 for(const stop of [false,true]){// The front drive is open ground: the witness 15 m from the only guard around.
  const s=setup(),p=view({x:0,y:0,z:-33}),w=place(s,'driver_1',{x:0,z:-30},Math.PI),g=place(s,'guard_parking',{x:15,z:-30},0);
  w.perceive(p,boxes,s.d.rules);s.d.accuse(w,p);assert.equal(w.state,'report');assert.equal(w.witness?.what,'act');assert.equal(g.state,'patrol','a bystander cannot radio');
  let t=0;for(;t<20&&w.witness;t+=.1){if(stop&&t>1){w.life='unconscious';}s.d.step(.1,view({x:200,y:0,z:-200}));s.det.step(.1,view({x:200,y:0,z:-200}),idle,t,false,false);}
  if(stop){assert.equal(s.m3.hotel.level,0,'stopped before reaching the guard');assert.ok(!s.seen.includes('witness.reported'));}
  else{assert.equal(s.m3.hotel.level,1);assert.ok(s.seen.includes('witness.started')&&s.seen.includes('witness.reported'));assert.equal(g.state,'investigate');assert.ok(t>2,`took ${t.toFixed(1)} s to run there`);}}});

test('M5.6 cameras record a crime in view; the monitor man at his desk reports it; the recorder erases it (quietly in staff clothes, loudly otherwise)',()=>{
 const cam=(hotel.cameras as Camera[]).find(c=>c.id==='CAM_lobby')!,at={x:cam.x+Math.sin(cam.heading)*6,y:0,z:cam.z+Math.cos(cam.heading)*6};
 const s=setup(),p=view(at),m=place(s,'monitor_watcher',{x:38.6,z:-16.8},Math.PI),near=place(s,'guard_check_lobby',{x:at.x+8,z:at.z},0);
 assert.ok(s.det.sees(cam,p),'the lobby camera covers the spot');s.det.step(.3,p,idle,1,false,false);assert.equal(s.det.recorded,false,'nothing wrong, nothing recorded');
 s.det.step(.3,p,{...idle,illegal:true},2,false,false);assert.equal(s.det.recorded,true);assert.equal(s.ledger.count('recording_left'),1);assert.ok(m.atPost(s.d.mission.zones,0));
 assert.ok(s.d.compromised.has('suit'),'the monitor man saw the outfit');assert.equal(near.state,'investigate');
 assert.equal(computeResult(scoring,s.ledger.counts,100,true).lines.find(l=>l.key==='recording_left')!.points,-2000);assert.equal(s.ledger.ghost(scoring),false);
 // Erase quietly in staff clothes: hold E for the full time at the recorder.
 const r=view({x:data.recorder.x,y:0,z:data.recorder.z},'waiter');assert.ok(s.det.nearRecorder(r));s.det.beginRecorder(permission(s.d.rules,'waiter',{type:'staff'} as never)==='allow');
 for(let t=0;t<data.recorder.eraseSeconds+.2;t+=.1)s.det.step(.1,r,idle,10+t,false,true);assert.equal(s.det.recorded,false);assert.equal(s.ledger.count('recording_left'),0);assert.equal(s.ledger.ghost(scoring),true);
 // Smashing it is quicker but guards nearby hear it.
 const s2=setup(),guard=place(s2,'security_chief',{x:data.recorder.x-6,z:data.recorder.z},0);s2.det.recorded=true;s2.det.beginRecorder(false);for(let t=0;t<data.recorder.breakSeconds+.2;t+=.1)s2.det.step(.1,view({x:data.recorder.x,y:0,z:data.recorder.z}),idle,t,false,true);
 assert.equal(s2.det.recorded,false);assert.equal(guard.state,'investigate');
 // Letting go or moving cancels.
 const s3=setup();s3.det.recorded=true;s3.det.beginRecorder(true);s3.det.step(.5,r,idle,0,false,false);assert.equal(s3.det.action,null);assert.equal(s3.det.recorded,true);});

test('M5.6 a dead or absent monitor man reports nothing; a shot camera stops recording and draws a look',()=>{
 const cam=(hotel.cameras as Camera[]).find(c=>c.id==='CAM_lobby')!,at={x:cam.x+Math.sin(cam.heading)*6,y:0,z:cam.z+Math.cos(cam.heading)*6};
 const s=setup(),p=view(at);place(s,'monitor_watcher',{x:30,z:20},0);s.det.step(.3,p,{...idle,trespass:true},1,false,false);assert.equal(s.det.recorded,true);assert.equal(s.d.compromised.size,0,'nobody at the monitors');
 const s2=setup(),g=place(s2,'guard_check_lobby',{x:cam.x+4,z:cam.z+4},0);const hit=s2.det.shotAt({x:at.x,y:1.4,z:at.z},{x:cam.x-(at.x-cam.x)*.2,y:cam.y+.2,z:cam.z-(at.z-cam.z)*.2},1);
 assert.equal(hit?.id,'CAM_lobby');assert.equal(s2.det.sees(cam,p),false);s2.det.step(.3,p,{...idle,illegal:true},2,false,false);assert.equal(s2.det.recorded,false);assert.equal(g.state,'investigate');});

test('M5.6 blending: at a spot of the right outfit nothing looks suspicious, face-knowers need to come within 2 m, and moving ends it',()=>{
 const s=setup(),spot=data.blend.find(b=>b.id==='BLEND_waiter_lobby')!,p=view({x:spot.x,y:0,z:spot.z},'waiter');
 assert.equal(s.det.startBlend(view({x:spot.x,y:0,z:spot.z},'suit')),null,'a guest cannot serve');assert.equal(s.det.startBlend(p)?.id,spot.id);
 const b=view({x:spot.x,y:0,z:spot.z},'waiter',{blending:true,running:true});assert.equal(baseRate(s.d.rules,b,'deny'),0);
 const knower=place(s,'head_waiter',{x:spot.x,z:spot.z+5},Math.PI);knower.post.splice(0,knower.post.length);
 for(let i=0;i<80;i++){knower.perceive(b,boxes,s.d.rules);knower.watchFace(.1,b,0,s.d.rules,s.d.mission.zones);}assert.equal(knower.face,0,'5 m away: not looked at closely');
 knower.pos={x:spot.x,y:0,z:spot.z+1.5};let blown=false;for(let i=0;i<40&&!blown;i++){knower.perceive(b,boxes,s.d.rules);blown=knower.watchFace(.1,b,0,s.d.rules,s.d.mission.zones).includes('compromised');}assert.ok(blown,'1.5 m: seen through');
 s.det.step(.1,p,idle,0,true,false);assert.equal(s.det.blend,null,'walking off ends it');});

test('M5.6 face-knowers: the twelve from the plan, the harbor master knows the harbor crew outfit, a gun in hand doubles the speed',()=>{
 const knowers=hotel.npcs.filter((n:{knowsFaces?:string[]})=>n.knowsFaces?.length);assert.equal(knowers.length,12);
 assert.deepEqual(hotel.npcs.find((n:{id:string})=>n.id==='harbor_master').knowsFaces,['fisher']);
 const s=setup(),k=place(s,'bartender',{x:20,z:-10},Math.PI),p=view({x:20,y:0,z:-15},'waiter'),q=view({x:20,y:0,z:-15},'waiter',{illegal:true});k.post.splice(0,k.post.length);
 k.perceive(p,boxes,s.d.rules);k.watchFace(.5,p,0,s.d.rules,s.d.mission.zones);const slow=k.face;k.face=0;k.state='patrol';k.watchFace(.5,q,0,s.d.rules,s.d.mission.zones);assert.ok(Math.abs(k.face-2*slow)<1e-9);});

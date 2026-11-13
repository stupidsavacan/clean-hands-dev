// The observatory stage (2026-11-13): its world simulation alone, and with the real people on the real map.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Weather,type WeatherDef} from '../src/sim/weather.ts';
import {Grid} from '../src/sim/power.ts';
import {Air,NORMAL_O2,type AirDef} from '../src/sim/air.ts';
import {ObservatoryWorld,type SystemsDef} from '../src/observatory/world.ts';
import {markUnconscious} from '../src/kills.ts';
import {checkMap} from '../src/map-editor/checks.ts';
import {probeOf,type Doc} from '../src/map-editor/core.ts';
import systems from '../src/data/observatory-systems.json' with {type:'json'};
import layout from '../src/data/observatory-layout.json' with {type:'json'};
import config from '../src/data/observatory-mission.json' with {type:'json'};
import {observatory} from './observatory-harness.ts';

const def=systems as unknown as SystemsDef;
const closed=()=>false;

test('weather: the same seed gives the same night, a different seed another one',()=>{
 const a=new Weather(def.weather),b=new Weather(def.weather),c=new Weather({...def.weather,seed:7} as WeatherDef);
 assert.deepEqual(a.strikes,b.strikes);
 assert.notDeepEqual(a.strikes.map(s=>s.time),c.strikes.map(s=>s.time));
 assert.ok(a.strikes.length>15);
 // No lightning in the lull; rain and thunder shorten hearing, more so outdoors.
 assert.equal(a.strikes.filter(s=>s.time>510&&s.time<640).length,0);
 const s=a.strikes.find(s=>s.kind==='rod')!,boom=s.time+s.delay+.5;
 assert.ok(a.hearing(boom,true)<.3);assert.ok(a.hearing(boom,false)<.5);assert.ok(a.hearing(boom,false)>a.hearing(boom,true));
 assert.equal(a.hearing(560,false),1);
 assert.ok(a.flash(s.time+.02)>.9);assert.equal(a.flash(s.time+1),0);
 // step() hands out each strike once.
 const seen=[...a.step(400),...a.step(400),...a.step(900)];
 assert.deepEqual(seen,a.strikes.filter(s=>s.time<=900));
});

test('power: a struck line starts the generator, which sheds the least important circuits and gives them back',()=>{
 const g=new Grid(def.power);
 g.step(1);assert.equal(g.source,'line');assert.ok(g.powered('heating'));
 g.strikeLine();g.step(1);
 assert.equal(g.live,false);assert.ok(g.powered('safety'),'the UPS holds the safety circuit');assert.equal(g.powered('lights-staff'),false);
 for(let i=0;i<100;i++)g.step(.1);
 assert.equal(g.source,'generator');assert.equal(g.powered('heating'),false,'heating is shed first');assert.ok(g.powered('lights-staff'));
 assert.ok(g.load<=def.power.generator.kw);
 for(let i=0;i<2600;i++)g.step(.1);
 assert.equal(g.source,'line');assert.ok(g.powered('heating'));assert.equal(g.generator,'standby');
});

test('power: with the BMS dead nothing is shed and the generator trips; without fuel it never starts',()=>{
 const g=new Grid(def.power);
 g.setBreaker('it',false);g.cutLine(true);
 for(let i=0;i<300;i++)g.step(.1);
 assert.equal(g.generator,'tripped');assert.equal(g.live,false);
 assert.ok(g.faults().some(f=>f.kind==='generator'));
 const h=new Grid(def.power);h.fuelValve=false;h.cutLine(true);
 for(let i=0;i<300;i++)h.step(.1);
 assert.equal(h.generator,'no-fuel');
 // The UPS runs down, and then the safety circuit is dead too.
 for(let i=0;i<def.power.ups.seconds*10;i++)h.step(.1);
 assert.equal(h.powered('safety'),false);
 h.fuelValve=true;h.restartGenerator();for(let i=0;i<150;i++)h.step(.1);
 assert.equal(h.source,'generator');
});

test('power: an overloaded circuit trips its own breaker and stays off until someone closes it',()=>{
 const g=new Grid(def.power);
 g.extra.set('sockets',6);
 for(let i=0;i<50;i++)g.step(.1);
 assert.equal(g.powered('sockets'),false);assert.ok(g.breakers.get('sockets')!.tripped);
 g.extra.set('sockets',0);g.setBreaker('sockets',true);g.step(.1);
 assert.ok(g.powered('sockets'));
});

test('air: nitrogen in a closed, unventilated room pushes the oxygen out; ventilation or an open door saves it',()=>{
 const run=(ventilation:boolean,door:boolean)=>{
  const air=new Air(def.air as AirDef);
  for(let i=0;i<120;i++)air.step(1,{outdoorTemp:5,ventilation,heating:true,doorOpen:()=>door,sources:[{room:'cryo',flow:def.nitrogen.flow,chill:def.nitrogen.chill}]});
  return air.room('cryo').o2*100;
 };
 const sealed=run(false,false),vented=run(true,false),open=run(false,true);
 assert.ok(sealed<def.oxygen.collapse,'sealed '+sealed);
 assert.ok(vented>def.oxygen.dizzy,'vented '+vented);
 assert.ok(open>sealed+2,'open '+open);
 // The hall next door stays breathable behind the closed door.
 const air=new Air(def.air as AirDef);
 for(let i=0;i<120;i++)air.step(1,{outdoorTemp:5,ventilation:false,heating:true,doorOpen:closed,sources:[{room:'cryo',flow:def.nitrogen.flow,chill:def.nitrogen.chill}]});
 assert.ok(air.room('hall').o2>NORMAL_O2-.01);
});

test('air: without heating rooms cool toward the outdoors, the stove keeps the lounge warmest',()=>{
 const air=new Air(def.air as AirDef);
 for(let i=0;i<600;i++)air.step(1,{outdoorTemp:2,ventilation:true,heating:false,doorOpen:closed});
 assert.ok(air.room('lobby').temp<def.comfort.cold);
 assert.ok(air.room('lounge').temp>air.room('lobby').temp+2);
});

test('world: an untouched night has an outage, shedding, a breaker blown by heaters, and the shutter opened in the lull',()=>{
 const w=new ObservatoryWorld(def);
 let slitMax=0;const power:string[]=[];
 for(let i=0;i<1800*5;i++){w.step(.2,closed);slitMax=Math.max(slitMax,w.slit);for(const e of w.grid.events.splice(0))power.push(e.type+(e.id?':'+e.id:''));}
 for(const need of ['line.lost','generator.started','shed:heating','line.back','breaker.tripped:sockets'])assert.ok(power.includes(need),need);
 assert.equal(slitMax,1);assert.equal(w.slit,0);
 assert.equal(w.o2Alarm,false);assert.equal(w.detectorAlarm,false);
 assert.equal(w.rodLiveAt,-Infinity,'an earthed rod harms nobody');
});

test('world: a strike on an unearthed rod makes the catwalk live and blows the dome breakers',()=>{
 const w=new ObservatoryWorld(def);w.groundCable=false;
 const rod=w.weather.strikes.find(s=>s.kind==='rod')!;
 let live=false;
 for(let t=0;t<rod.time+1;t+=.1){w.step(.1,closed);live||=w.catwalkLive;}
 assert.ok(live);assert.ok(w.grid.breakers.get('dome')!.tripped);
});

test('map: the layout has no problems and every hold spot can be reached',()=>{
 const doc={...layout,devices:[]} as unknown as Doc;
 assert.deepEqual(checkMap(doc,probeOf(doc)).filter(i=>i.level==='error'),[]);
 const g=observatory(),w=g.director.world;
 for(const a of config.acts){
  const y=w.surface(a.at.x,a.at.z,a.at.y);
  assert.ok(y!==null&&!w.blocked(a.at.x,y,a.at.z),a.id+' stands free');
 }
 // Every door in the air model is a door on the map.
 for(const l of def.air.links)if(l.door)assert.ok(layout.doors.some(d=>d.id===l.door),l.door);
});

test('people: left alone, nobody dies, the director keeps his rounds through locked doors, the technician resets the blown breaker',()=>{
 const g=observatory();
 let upstairs=false,inLounge=false;
 g.run(700,()=>{const d=g.npc('director');upstairs||=d.pos.y>3;inLounge||=g.script.zone(d.pos)==='lounge';});
 assert.ok(inLounge,'the director visited the lounge');assert.ok(upstairs,'the director went up to the dome in the lull');
 assert.ok(g.script.flags.has('huddle'),'people went to the stove while the heating was shed');
 g.run(200);
 assert.ok(g.sim.grid.breakers.get('sockets')!.closed,'the technician reset the socket breaker: '+g.notices.filter(n=>n.includes('技師')).join(' / '));
 assert.equal(g.director.npcs.filter(n=>n.life!=='active').length,0);
 assert.equal(g.script.kills.length,0);
});

test('people: bad air in the cryo lab — the alarm sends people out; silenced, the director walks in and does not come out',()=>{
 // With the monitor working: the researcher at the bench leaves when it sounds, and nobody is hurt.
 const safe=observatory();
 safe.run(20);safe.script.operate('brk_vent');safe.script.operate('ln2_valve');
 safe.run(150);
 assert.ok(safe.script.flags.has('o2_alarm'));
 assert.equal(safe.npc('researcher_b').life,'active');
 assert.notEqual(safe.script.zone(safe.npc('researcher_b').pos),'cryo');
 // The assassination: wait until the lab is empty, deal with the technician, cut the fans, pull the monitor's cable,
 // open the valve, then stop the detector's cooler so the director comes to look.
 const g=observatory();
 g.run(300);
 assert.notEqual(g.script.zone(g.npc('researcher_b').pos),'cryo','the researcher has left for the console');
 markUnconscious(g.npc('tech'));
 for(const id of ['brk_vent','o2_sensor','ln2_valve','brk_compressor'])g.script.operate(id);
 const director=g.npc('director');
 for(let i=0;i<260&&director.life!=='dead';i++)g.run(1);
 assert.equal(director.life,'dead',JSON.stringify({pos:director.pos,o2:g.sim.air.room('cryo').o2,notices:g.notices.slice(-6)}));
 assert.equal(director.deathMethod,'asphyxia');assert.equal(director.deathKind,'accident');
 assert.equal(g.script.zone(director.pos),'cryo');
 assert.equal(g.npc('aide').life,'active','the escort waited outside');
 assert.equal(g.sim.o2Alarm,false);
 assert.deepEqual(g.script.kills.map(k=>k.victim),['director']);
 // The air does not care who comes next: the escort who goes in to look for him drops too (the player can prevent
 // it by closing the valve).
 g.run(60);
 assert.notEqual(g.npc('aide').life,'active');
});

test('people: lightning — with the earth cable off and the shutter drive dead, the director cranks on the catwalk when the rod is hit',()=>{
 const g=observatory();
 g.run(540);
 assert.ok(g.sim.slit>.5,'the observers opened the shutter in the lull');
 markUnconscious(g.npc('tech'));
 g.script.operate('ground_cable');g.script.operate('brk_dome');
 const director=g.npc('director');
 for(let i=0;i<260&&director.life!=='dead';i++)g.run(1);
 assert.equal(director.life,'dead',JSON.stringify({pos:director.pos,slit:g.sim.slit,wet:g.sim.domeWet,notices:g.notices.slice(-6)}));
 assert.equal(director.deathMethod,'lightning');assert.equal(director.deathKind,'accident');
 assert.equal(g.script.zone(director.pos),'catwalk');
 assert.equal(g.npc('aide').life,'active');
});

test('people: an earthed rod kills nobody, and the technician closes a tripped dome breaker so the shutter shuts by motor',()=>{
 const g=observatory();
 g.run(540);g.script.operate('brk_dome');
 g.run(330);
 assert.equal(g.npc('director').life,'active');
 assert.ok(g.sim.grid.breakers.get('dome')!.closed);assert.equal(g.sim.slit,0);
});

test('senses: unlit rooms and the storm shorten sight, a flash gives it back; a dead safety circuit opens the electric locks',()=>{
 const g=observatory();
 g.run(5);
 const lock=g.doors.doors.find(d=>d.def.id==='d-control')!;
 assert.ok(lock.locked);
 g.script.operate('brk_lights');g.run(1);
 assert.ok(g.script.darkZones().hall<1);assert.ok(g.npc('guard_hall').visionScale<1);
 assert.equal(g.script.darkZones().lobby,undefined);
 // Cut everything: no line, no generator; the UPS runs out and the locks let go.
 g.script.operate('gen_fuel');g.script.operate('line_switch');markUnconscious(g.npc('tech'));
 g.run(def.power.ups.seconds+15);
 assert.equal(g.sim.grid.powered('safety'),false);assert.equal(lock.locked,false);
 assert.ok(g.script.darkZones().lobby<1);
});

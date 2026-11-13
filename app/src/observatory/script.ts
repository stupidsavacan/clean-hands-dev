// The observatory's mission script (2026-11-13): it joins the world simulation (observatory/world.ts) to the people.
// The world decides what is true (it is dark here, the air there is bad, lightning just hit the rod); this file decides
// what people do about it, and gives the player the switches and valves to change the world with. Nothing here is a
// timed trap: a death happens because someone was standing in the wrong air or on the wrong steel.
//
//  - Switches and valves the player holds E on (engine/hold-actions.ts): breakers, the incoming switch, the generator's
//    fuel cock, the nitrogen valve, the oxygen monitor's cable, the lightning rod's earth cable, the dome console.
//  - The technician repairs what breaks (one fault at a time, after someone has noticed it).
//  - The director looks after his instruments himself: a warming detector takes him into the cryo lab, an open shutter
//    in the rain with a dead drive takes him out on the catwalk to crank it shut by hand.
//  - Cold rooms empty: people go and stand round the lounge's wood stove, guards take turns to warm up, the outside
//    patrol shelters under the porch in the worst of the rain.
//  - Bad air knocks people out and then kills them; a strike on an unearthed rod kills whoever is on the catwalk.
import {zoneAt,type Director,type Npc,type PlayerView} from '../ai.ts';
import type {M3System} from '../m3.ts';
import type {M4System} from '../m4.ts';
import type {MissionClock,ScheduleSystem} from '../schedule.ts';
import type {MissionEvents} from '../events.ts';
import type {DoorSystem} from '../doors.ts';
import {Chances} from '../chances.ts';
import {judgeKill,markDead,markUnconscious,type KillRecord} from '../kills.ts';
import {floorOf,type Position} from '../world.ts';
import {Errands} from '../engine/errands.ts';
import {VipProtection,type AlarmReason,type VipConfig} from '../engine/vip.ts';
import {HoldActions,type HoldSpot} from '../engine/hold-actions.ts';
import {KillEvents,TargetWatch} from '../engine/target-watch.ts';
import type {ObservatoryWorld} from './world.ts';

type Place=Position&{heading:number};
export type ObservatoryConfig={
 vip:VipConfig;radius:number;acts:HoldSpot[];
 repair:{noticeSeconds:number;workSeconds:number;arrival:number;places:Record<string,Place>};
 duties:{detectorDelay:number;detectorStay:number;crankDelay:number};
 comfort:{checkSeconds:number;guardBreakSeconds:number;guardBreakEvery:number;shelterRain:number;shelterEnd:number;warmPlaces:number};
 notes:Record<string,string>;
};
export type ScriptParts={director:Director;m3:M3System;m4:M4System;clock:MissionClock;events:MissionEvents;schedule:ScheduleSystem;doors:DoorSystem;hurt:(amount:number)=>void};
type Fault={key:string;place:string;label:string;fix:()=>void};
type Duty={kind:'detector'|'crank';since:number;arrivedAt:number|null};

const REPAIR='repair',DUTY='duty',WARM='warm',SHELTER='shelter',EVAC='evacuate';
// Breakers the player can reach, by the hold spot that switches them.
const BREAKERS:Record<string,string>={brk_vent:'ventilation',brk_lights:'lights-staff',brk_compressor:'compressor',brk_dome:'dome'};
const SABOTAGE=new Set(['brk_vent','brk_lights','brk_compressor','brk_dome','line_switch','gen_fuel','ln2_valve','o2_sensor','ground_cable','dome_console','keycard']);
const OUTDOOR=new Set(['yard','west','east','north','catwalk']);

export class ObservatoryScript{
 readonly world:ObservatoryWorld;
 readonly chances:Chances;
 readonly flags=new Set<string>();readonly kills:KillRecord[]=[];
 readonly errands:Errands;readonly vip:VipProtection;readonly holds:HoldActions;readonly watch:TargetWatch;
 notices:string[]=[];reactionText='';reactionUntil=0;
 onTargetDown?:(at:Position,time:number)=>void;
 /** What the player's own surroundings are like now (for the HUD and the sound). */
 here={room:'',label:'',temp:21,o2:20.9,lit:true,outdoor:true};
 private readonly d:Director;private readonly m4:M4System;private readonly clock:MissionClock;private readonly events:MissionEvents;
 private readonly doors:DoorSystem;private readonly hurt:(amount:number)=>void;private readonly config:ObservatoryConfig;
 private readonly places:Record<string,Place>;
 private readonly killEvents:KillEvents;
 private readonly target:Npc;private readonly escort:Npc|undefined;private readonly tech:Npc|undefined;
 private lastTime=0;private lastAfter=0;private lastComfort=-Infinity;
 // The technician's work.
 private readonly noticed=new Map<string,number>();
 private repair:{fault:Fault;arrivedAt:number|null}|null=null;
 // The director's own errands.
 private duty:Duty|null=null;private detectorSince:number|null=null;private wetSince:number|null=null;private detectorDone=false;
 // Comfort.
 private readonly warming=new Map<Npc,{place:string;from:string}>();
 private readonly breaks=new Map<Npc,{until:number;next:number}>();
 // Bad air.
 private readonly exposure=new Map<Npc,number>();private readonly dying=new Map<Npc,number>();
 private playerWarned=-Infinity;
 private lastDisguise='';

 constructor(parts:ScriptParts,world:ObservatoryWorld,config:ObservatoryConfig){
  const {director:d,m3,m4,clock,events,schedule,doors}=parts;
  this.d=d;this.m4=m4;this.clock=clock;this.events=events;this.doors=doors;this.hurt=parts.hurt;this.world=world;this.config=config;
  this.places=schedule.places as unknown as Record<string,Place>;
  this.chances=new Chances({},events);
  this.errands=new Errands(schedule);
  this.vip=new VipProtection(d,m3,clock,events,this.errands,config.vip,(id,reason)=>this.flag(id,reason),text=>this.say(text));
  this.vip.onLockdown=()=>this.endDuty();
  this.target=this.vip.target;this.escort=this.vip.escort??undefined;
  this.tech=d.npcs.find(n=>n.id==='tech');
  this.holds=new HoldActions(config.acts,config.radius,()=>d.boxes,clock,events);
  this.holds.heldItem=()=>m3.heldItem?.();
  this.holds.blocked=spot=>this.blocked(spot);
  this.holds.onComplete=spot=>this.complete(spot);
  this.watch=new TargetWatch(d,this.errands,[this.target]);
  this.watch.onGathered=(t,at,time)=>{this.say(`${t.label}が倒れた。周りの人が駆け寄る。`);this.onTargetDown?.(at,time);};
  this.killEvents=new KillEvents(d,events);
  this.killEvents.placeOf=v=>this.zone(v.pos);
  // Everyone here opens doors on their way; the storm and thunder shorten how far sound carries.
  for(const n of d.npcs)n.usesDoors=true;
  d.hearing=listener=>world.hearing(d.outdoorAt(listener));
  world.occupied=room=>d.npcs.some(n=>n.active&&this.airRoom(n.pos)===room);
  m4.extraInventory=()=>this.flags.has('keycard')?['keycard']:[];
  this.relabel();
 }

 // ---- small helpers ------------------------------------------------------------------------------------------
 private flag(id:string,reason?:string){this.flags.add(id);this.events.emit({type:'flag.set',time:this.clock.elapsed,id,reason});}
 private say(text:string,seconds=7){this.reactionText=text;this.reactionUntil=this.clock.elapsed+seconds;}
 /** The map zone (room id) at a position. */
 zone(at:Position){return zoneAt(this.d.mission.zones,at.x,at.z,floorOf(at.y))?.id??'';}
 /** The simulation's room for a position: outdoor zones share one air, the stairs share the hall's. */
 airRoom(at:Position){const z=this.zone(at);return !z||OUTDOOR.has(z)?'out':z==='S1'?'hall':z;}
 private available(n:Npc|undefined):n is Npc{return !!n&&n.active&&n.life==='active'&&!n.busy&&n.state==='patrol';}
 private at(n:Npc,p:Position,r=this.config.repair.arrival){return Math.hypot(n.pos.x-p.x,n.pos.z-p.z)<=r&&Math.abs(n.pos.y-p.y)<1;}
 private send(n:Npc,source:string,place:string|Place,action='idle'){
  const p=typeof place==='string'?this.places[place]:place;
  this.errands.send(n,source,{x:p.x,y:p.y,z:p.z},action,p.heading);
 }

 // ---- what the player can switch -----------------------------------------------------------------------------
 /** The words on each spot follow the state of the thing. */
 private relabel(){
  const w=this.world,g=w.grid;
  const label:Record<string,string>={
   line_switch:g.lineCut?'引込開閉器を入れる（送電線をつなぐ）':'引込開閉器を切る（送電線を切り離す）',
   gen_fuel:g.fuelValve?'発電機の燃料コックを閉じる':'発電機の燃料コックを開ける',
   ln2_valve:w.valveOpen?'液体窒素の放出弁を閉じる':'液体窒素の放出弁を開ける',
   o2_sensor:w.sensorConnected?'酸素濃度計のケーブルを抜く':'酸素濃度計のケーブルを挿す',
   ground_cable:w.groundCable?'避雷針の接地線を外す':'避雷針の接地線をつなぐ',
  };
  for(const [spot,circuit] of Object.entries(BREAKERS)){
   const c=g.circuit(circuit),b=g.breakers.get(circuit)!;
   label[spot]=`${c.label}のブレーカーを${b.closed?'切る':'入れる'}`;
  }
  for(const s of this.holds.spots)if(label[s.id])s.label=label[s.id];
 }
 private blocked(spot:HoldSpot){
  if(spot.id==='dome_console'){
   if(!this.world.grid.powered('it'))return '操作卓に電気が来ていない。';
   if(this.world.slitTarget===1)return 'シャッターはもう開く指令になっている。';
  }
  return '';
 }
 private complete(spot:HoldSpot){
  const w=this.world,g=w.grid,id=spot.id;
  if(BREAKERS[id]){
   const circuit=BREAKERS[id],closed=!g.breakers.get(circuit)!.closed;
   g.setBreaker(circuit,closed);this.flag(id);
   this.notices.push(`${g.circuit(circuit).label}のブレーカーを${closed?'入れた':'切った'}。`);
  }else switch(id){
   case 'line_switch':g.cutLine(!g.lineCut);this.flag(id);this.notices.push(g.lineCut?'送電線を切り離した。発電機が起動するはずだ。':'送電線をつないだ。');break;
   case 'gen_fuel':g.fuelValve=!g.fuelValve;this.flag(id);this.notices.push(g.fuelValve?'燃料コックを開けた。':'燃料コックを閉じた。発電機は動かない。');break;
   case 'ln2_valve':w.valveOpen=!w.valveOpen;this.flag(id);this.notices.push(w.valveOpen?'放出弁を開けた。白い霧が床を這う。長居は危ない。':'放出弁を閉じた。');break;
   case 'o2_sensor':w.sensorConnected=!w.sensorConnected;this.flag(id);this.notices.push(w.sensorConnected?'酸素濃度計をつないだ。':'酸素濃度計のケーブルを抜いた。もう鳴らない。');break;
   case 'ground_cable':w.groundCable=!w.groundCable;this.flag(id);this.notices.push(w.groundCable?'接地線をつないだ。':'接地線を外した。次に避雷針へ落ちた雷はドームの鉄骨を流れる。');break;
   case 'dome_console':w.overrideOpen();this.flag(id);this.notices.push('シャッターを開ける指令を出した。');break;
   case 'keycard':this.flag(id);this.notices.push('予備のカードキーを手に入れた。管制室と所長室の電気錠が開く。');break;
   case 'weather_monitor':{
    this.flag('forecast');
    const t=this.clock.elapsed,rods=w.weather.strikes.filter(s=>s.kind==='rod'&&s.time>t).slice(0,3).map(s=>this.clockText(s.time));
    this.say(rods.length?`雷の予報：避雷針への落雷は ${rods.join('、')} ごろ。`:'雷の予報：しばらく落雷はない。',10);
    break;
   }
   default:if(this.config.notes[id])this.say(this.config.notes[id],10);
  }
  this.relabel();
 }
 /** Do what finishing the hold at a spot does (tests, and the debug console). */
 operate(id:string){const spot=this.holds.spots.find(s=>s.id===id);if(!spot)throw new Error('no spot '+id);this.complete(spot);}
 private clockText(seconds:number){const s=Math.floor(seconds);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
 get action(){return this.holds.action;}
 get locked(){return !!this.holds.action;}
 get tampering(){return !!this.holds.action&&SABOTAGE.has(this.holds.action.id);}
 get escaped(){return this.vip.escaped;}
 prompt(p:PlayerView){return this.holds.prompt(p);}
 step(dt:number,p:PlayerView,keys:Set<string>,suppressed=false){
  this.notices=[];
  if(this.lastDisguise!==this.m4.disguise){this.lastDisguise=this.m4.disguise;this.events.emit({type:'disguise.changed',time:this.clock.elapsed,id:this.m4.disguise});}
  return this.holds.step(dt,p,keys,suppressed);
 }
 alarm(at:Position,reason:AlarmReason,kind:'small'|'loud'='small'){this.vip.alarm(at,reason,kind);}
 bodyFound(body:Npc,witness:Npc){this.vip.bodyFound(body,witness);}
 seek(){this.endDuty();this.reactionUntil=0;}

 // ---- the world moves, then people answer it ---------------------------------------------------------------
 beforeAi(){
  // The world keeps the mission clock's time, also across a jump in time (fast-forward, the debug console).
  const time=this.clock.elapsed;
  let gap=time-this.lastTime;
  this.lastTime=time;
  if(gap>0){
   const open=new Map(this.doors.doors.map(s=>[s.def.id,!s.closed]));
   for(;gap>1e-6;gap-=.5)this.world.step(Math.min(.5,gap),id=>open.get(id)??true);
  }
  for(const e of this.world.drain())this.onWorld(e.type,e.id);
  for(const e of this.world.grid.events.splice(0))this.onPower(e.type,e.id);
  this.locks();
  this.repairs(time);
  this.duties(time);
  if(time-this.lastComfort>=this.config.comfort.checkSeconds){this.lastComfort=time;this.comfort(time);}
 }
 private onWorld(type:string,id?:string){
  switch(type){
   case 'line.struck':this.say('送電線に雷が落ちた。停電だ。');break;
   case 'rod.live':this.say('避雷針に落雷。電流がドームの鉄骨を走った。');this.flag('rod_live');break;
   case 'o2.alarm':this.say('低温実験室の酸素警報が鳴り出した。');this.flag('o2_alarm');break;
   case 'detector.alarm':this.say('検出器の温度警報。所長のポケベルが鳴る。');break;
   case 'dome.opening':this.say('ドームのシャッターが開いていく。');break;
   case 'dome.wet':this.say('開いたシャッターから雨が望遠鏡に吹き込んでいる。');break;
   case 'heater.on':if(id)this.flag('heater_'+id);break;
  }
 }
 private onPower(type:string,id?:string){
  const g=this.world.grid;
  switch(type){
   case 'generator.started':this.notices.push('発電機が起動した。暖房など一部は止まったままだ。');break;
   case 'generator.tripped':this.notices.push('発電機が過負荷で止まった。全館停電。');break;
   case 'generator.no-fuel':this.notices.push('発電機が燃料切れで止まった。');break;
   case 'breaker.tripped':if(id)this.notices.push(`${g.circuit(id).label}のブレーカーが落ちた。`);break;
   case 'line.back':this.notices.push('送電が戻った。');break;
   case 'ups.empty':this.notices.push('無停電電源が空になった。電気錠が開く。');break;
  }
  this.relabel();
 }
 /** Electric locks hold only while the safety circuit has power. */
 private locks(){
  const powered=this.world.grid.powered('safety');
  for(const door of this.doors.doors){
   if(!door.def.key)continue;
   if(!powered)door.locked=false;
   else if(door.closed&&!door.locked)door.locked=true;
  }
 }
 /** What is broken, where to fix it, and how. */
 private faults():Fault[]{
  const w=this.world,g=w.grid,out:Fault[]=[];
  for(const f of g.faults()){
   if(f.kind==='generator'&&!g.lineLive)out.push({key:'generator',place:'generator',label:'発電機',fix:()=>{g.fuelValve=true;g.restartGenerator();}});
   else if(f.kind==='fuel'&&!g.lineLive)out.push({key:'fuel',place:'generator',label:'燃料コック',fix:()=>{g.fuelValve=true;g.restartGenerator();}});
   else if(f.kind==='line-switch')out.push({key:'line',place:'line',label:'引込開閉器',fix:()=>g.cutLine(false)});
   else if(f.kind==='breaker')out.push({key:'breaker:'+f.id,place:f.id==='dome'?'dome':'panel',label:g.circuit(f.id).label+'のブレーカー',fix:()=>g.setBreaker(f.id,true)});
  }
  // An open valve is only a known fault once the alarm has sounded, and nobody walks into air that would drop them.
  if(w.valveOpen&&this.flags.has('o2_alarm')&&w.air.room(w.def.nitrogen.room).o2*100>=w.def.oxygen.dizzy)out.push({key:'valve',place:'valve',label:'液体窒素の弁',fix:()=>{w.valveOpen=false;}});
  return out;
 }
 private repairs(time:number){
  const c=this.config.repair,faults=this.faults(),tech=this.tech;
  for(const key of [...this.noticed.keys()])if(!faults.some(f=>f.key===key))this.noticed.delete(key);
  for(const f of faults)if(!this.noticed.has(f.key))this.noticed.set(f.key,time);
  if(this.repair&&(!faults.some(f=>f.key===this.repair!.fault.key)||!tech||tech.life!=='active')){
   if(tech)this.errands.release(tech,REPAIR);
   this.repair=null;
  }
  if(!tech||tech.life!=='active')return;
  if(!this.repair){
   const due=faults.filter(f=>time-this.noticed.get(f.key)!>=c.noticeSeconds);
   if(!due.length||!this.available(tech))return;
   // The generator first, then the nearest.
   const dist=(f:Fault)=>Math.hypot(tech.pos.x-c.places[f.place].x,tech.pos.z-c.places[f.place].z);
   const fault=due.sort((a,b)=>+(b.key==='generator')-+(a.key==='generator')||dist(a)-dist(b))[0];
   this.repair={fault,arrivedAt:null};
   this.send(tech,REPAIR,c.places[fault.place],'work');
   this.notices.push(`設備技師が${fault.label}を直しに向かった。`);
   return;
  }
  const r=this.repair;
  if(r.arrivedAt===null){if(this.available(tech)&&this.at(tech,c.places[r.fault.place]))r.arrivedAt=time;}
  else if(time-r.arrivedAt>=c.workSeconds){
   r.fault.fix();this.relabel();
   this.notices.push(`設備技師が${r.fault.label}を直した。`);
   this.events.emit({type:'flag.set',time,id:'repaired',reason:r.fault.key});
   this.errands.release(tech,REPAIR);this.repair=null;
  }
 }
 private endDuty(){
  if(!this.duty)return;
  this.duty=null;
  this.errands.releaseAll(DUTY);
 }
 /** The director looks after the telescope and its detector himself. */
 private duties(time:number){
  const w=this.world,c=this.config.duties,n=this.target;
  // The shutter is open in the rain and its drive is dead (or the console cannot tell it to close).
  const stuck=w.domeWet&&(!w.grid.powered('dome')||w.slitTarget===1&&!w.grid.powered('it'));
  this.wetSince=stuck?this.wetSince??time:null;
  this.detectorSince=w.detectorAlarm?this.detectorSince??time:null;
  if(!w.detectorAlarm)this.detectorDone=false;
  const calm=n.active&&n.life==='active'&&!this.vip.lockedDown&&n.state==='patrol';
  if(this.duty&&!calm){this.endDuty();return;}
  if(!this.duty){
   if(!calm||n.busy)return;
   if(this.wetSince!==null&&time-this.wetSince>=c.crankDelay){
    this.duty={kind:'crank',since:time,arrivedAt:null};
    this.send(n,DUTY,'crank','work');if(this.escort)this.send(this.escort,DUTY,'crank_wait');
    this.say('所長「シャッターが閉まらん。私が手で回す」― 所長がキャットウォークへ向かう。',9);this.flag('duty_crank');
   }else if(this.detectorSince!==null&&!this.detectorDone&&!w.o2Alarm&&time-this.detectorSince>=c.detectorDelay){
    this.duty={kind:'detector',since:time,arrivedAt:null};
    this.send(n,DUTY,'detector','work');if(this.escort)this.send(this.escort,DUTY,'detector_wait');
    this.say('所長「検出器が温まっている。見てくる」― 所長が低温実験室へ向かう。護衛は扉の外で待つ。',9);this.flag('duty_detector');
   }
   return;
  }
  const duty=this.duty;
  if(duty.kind==='crank'){
   // He goes on until it is fully shut, unless the motor has taken over.
   if(w.slit===0||w.grid.powered('dome')&&w.slitTarget===0&&w.grid.powered('it')){this.endDuty();return;}
   if(this.at(n,this.places.crank)){duty.arrivedAt??=time;w.crank();n.scheduleAction='work';}
  }else{
   // An alarm that starts while he is on his way turns him back; once inside he does not hear the hall's sounder go.
   if(duty.arrivedAt===null&&w.o2Alarm){this.endDuty();this.say('酸素警報で所長は引き返した。');return;}
   if(duty.arrivedAt===null&&this.at(n,this.places.detector))duty.arrivedAt=time;
   if(!w.detectorAlarm&&duty.arrivedAt===null||duty.arrivedAt!==null&&time-duty.arrivedAt>=c.detectorStay){this.detectorDone=true;this.endDuty();}
  }
 }
 /** Cold rooms empty, guards warm up in turns, the outside patrol shelters. */
 private comfort(time:number){
  const w=this.world,c=this.config.comfort,cold=w.def.comfort.cold;
  const temp=(room:string)=>w.air.rooms.get(room)?.temp??21;
  const takenPlaces=new Set([...this.warming.values()].map(v=>v.place));
  for(const n of this.d.npcs){
   if(n===this.target||n===this.escort||n===this.tech&&this.repair)continue;
   const warming=this.warming.get(n);
   if(n.life!=='active'||!n.active){if(warming){this.warming.delete(n);this.errands.release(n,WARM);}continue;}
   if(n.guard){
    // The outside patrol stands under the porch while the rain is at its worst.
    if(n.id==='guard_yard'){
     const rain=w.weather.at(w.time).rain,sheltering=this.errands.holds(n,SHELTER);
     if(!sheltering&&rain>=c.shelterRain&&this.available(n)){this.send(n,SHELTER,'shelter_yard');this.flag('shelter');}
     else if(sheltering&&rain<c.shelterEnd)this.errands.release(n,SHELTER);
     continue;
    }
    // Post guards leave a cold post for a short while, one visit every few minutes.
    const b=this.breaks.get(n)??{until:-Infinity,next:0};this.breaks.set(n,b);
    if(this.errands.holds(n,WARM)){if(time>=b.until){this.errands.release(n,WARM);this.warming.delete(n);}continue;}
    const room=this.airRoom(n.pos);
    if(room!=='out'&&temp(room)<cold&&time>=b.next&&this.available(n)){
     const spot=this.freeWarm(takenPlaces);if(!spot)continue;
     takenPlaces.add(spot);b.until=time+c.guardBreakSeconds+20;b.next=time+c.guardBreakEvery;
     this.warming.set(n,{place:spot,from:room});this.send(n,WARM,spot);
    }
    continue;
   }
   if(warming){
    // Back to their own business once the room they left is bearable again.
    if(temp(warming.from)>=cold+2){this.warming.delete(n);this.errands.release(n,WARM);}
    continue;
   }
   const room=this.airRoom(n.pos);
   if(room==='out'||room===w.def.comfort.warmRoom||temp(room)>=cold||!this.available(n))continue;
   const spot=this.freeWarm(takenPlaces);if(!spot)continue;
   takenPlaces.add(spot);this.warming.set(n,{place:spot,from:room});this.send(n,WARM,spot);
   if(!this.flags.has('huddle')){this.flag('huddle');this.say('寒さに耐えかねた人たちが、談話室の薪ストーブへ集まり始めた。');}
  }
 }
 private freeWarm(taken:Set<string>){
  for(let i=0;i<this.config.comfort.warmPlaces;i++)if(!taken.has('warm_'+i))return 'warm_'+i;
  return undefined;
 }

 // ---- after everyone has moved: what the world does to them ---------------------------------------------------
 afterAi(p:PlayerView){
  const time=this.clock.elapsed,w=this.world,o=w.def.oxygen;
  this.vip.step(time);
  this.watch.step(time);
  const dt=Math.max(0,Math.min(1,time-this.lastAfter));this.lastAfter=time;
  // Bad air: it gives no warning. Someone who stays in it drops, and someone who lies in it dies.
  for(const n of this.d.npcs){
   if(n.life==='dead'||!n.active&&n.life==='active')continue;
   const o2=(w.air.rooms.get(this.airRoom(n.pos))?.o2??.209)*100;
   if(n.life==='active'){
    // The alarm sends people out of the lab (if they can still walk).
    if(w.o2Alarm&&this.airRoom(n.pos)===w.def.nitrogen.room&&!this.errands.holds(n,EVAC)&&n!==this.target){this.send(n,EVAC,'detector_wait');}
    else if(!w.o2Alarm&&this.errands.holds(n,EVAC))this.errands.release(n,EVAC);
    const t=o2<o.collapse?(this.exposure.get(n)??0)+dt:0;
    this.exposure.set(n,t);
    if(t>=o.collapseSeconds){
     markUnconscious(n);this.errands.clear(n);this.exposure.delete(n);
     this.events.emit({type:'npc.sedated',time,id:n.id,method:'asphyxia'});
     if(n===this.target)this.say('所長がふらつき、音もなく床に崩れた。');
    }
   }else if(n.life==='unconscious'){
    const t=o2<o.collapse?(this.dying.get(n)??0)+dt:0;
    this.dying.set(n,t);
    if(t>=o.deathSeconds)this.kill(n,'asphyxia',p);
   }
  }
  // A strike on the unearthed rod: whoever stands on the catwalk's steel.
  if(w.catwalkLive&&!this.flags.has('rod_done_'+w.rodLiveAt)){
   this.flag('rod_done_'+w.rodLiveAt);
   for(const n of this.d.npcs)if(n.life!=='dead'&&this.zone(n.pos)==='catwalk')this.kill(n,'lightning',p);
   if(this.zone(p)==='catwalk'){this.hurt(1000);this.notices.push('雷がキャットウォークを走った。');}
  }
  // The player breathes the same air.
  const room=this.airRoom(p),zone=this.d.mission.zones.find(z=>z.id===this.zone(p)) as {label?:string}|undefined,air=w.air.rooms.get(room);
  const o2=(air?.o2??.209)*100;
  this.here={room,label:zone?.label??'屋外',temp:air?.temp??w.weather.at(w.time).outdoorTemp,o2,lit:w.lit(this.zone(p)),outdoor:room==='out'};
  if(o2<o.dizzy){
   this.hurt(o.playerDamage*(o2<o.collapse?2.5:1)*dt);
   if(time-this.playerWarned>6){this.playerWarned=time;this.notices.push(o2<o.collapse?'息ができない。すぐ出ろ。':'頭がぼんやりする。この部屋の空気は薄い。');}
  }
  this.killEvents.step(time);
 }
 private kill(n:Npc,method:string,p:PlayerView){
  // The preparation was the player's; at the moment of death nobody is doing anything to anyone.
  const judgement=judgeKill(this.d,p,[],false,[n.id],false);
  markDead(n,method,judgement);this.errands.clear(n);
  this.kills.push({victim:n.id,method,time:this.clock.elapsed,position:{...n.pos},judgement});
  this.flag('accident_'+method);
  if(n===this.target)this.say(method==='lightning'?'閃光。所長はクランクを握ったまま倒れた。落雷事故だ。':'所長は目を覚まさなかった。酸欠事故だ。',10);
 }

 // ---- what the engine and the page read -----------------------------------------------------------------------
 /** Unlit rooms and the storm outdoors shorten sight; a lightning flash gives it back for a moment. */
 darkZones(){
  const out:Record<string,number>={};
  for(const z of this.d.mission.zones){
   if(z.id in out)continue;
   const sight=this.world.sight(z.id,OUTDOOR.has(z.id));
   if(sight<.99)out[z.id]=sight;
  }
  return out;
 }
 chanceSnapshot(){return [];}
 snapshot(){return {flags:[...this.flags],kills:this.kills,action:this.action,duty:this.duty&&{...this.duty},repair:this.repair&&{fault:this.repair.fault.key,arrivedAt:this.repair.arrivedAt},
  warming:[...this.warming].map(([n,v])=>({id:n.id,...v})),here:this.here,world:this.world.snapshot()};}
}

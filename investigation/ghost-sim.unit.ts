// Existing isolated action regression fixtures; walking end-to-end coverage is in ghost-sim.ts.
// Runs every chance and the plain kills on the real systems WITH the crowd left in place (the M5.7 tests clear it),
// then reports who died, the verdict, and what the score ledger counted — i.e. whether a ghost run is possible.
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
// Run from outputs/m5-prototype/app:  node --experimental-strip-types ../investigation/ghost-sim.ts > ../investigation/ghost-sim.json
const APP=new URL('../app/src/',import.meta.url).href;
const {Director}=await import(APP+'ai.ts');const {CollisionWorld,floorOf}=await import(APP+'world.ts');const {NavGrid}=await import(APP+'nav.ts');const {sightBoxes}=await import(APP+'sight.ts');
const {MissionEvents}=await import(APP+'events.ts');const {MissionClock,ScheduleSystem}=await import(APP+'schedule.ts');const {M3System}=await import(APP+'m3.ts');const {M4System}=await import(APP+'m4.ts');
const {M53System}=await import(APP+'m53.ts');const {M57System}=await import(APP+'m57.ts');const {CombatSystem}=await import(APP+'combat.ts');const {MissionFlow}=await import(APP+'mission.ts');
const {ScoreLedger,computeResult}=await import(APP+'score.ts');const {DetectionSystem}=await import(APP+'detection.ts');
const json=(n:string)=>JSON.parse(readFileSync(new URL(APP+`data/${n}.json`),'utf8'));
const hotel=json('hotel'),rules=json('rules'),chances=json('chances'),plans=json('schedule'),mission=json('mission'),scoring=json('scoring'),det=json('detection');
const world=new CollisionWorld(hotel),nav=new NavGrid(world),boxes=sightBoxes(hotel),map=hotel.m57;
type P={x:number;y:number;z:number;floor:number;speed:number;running:boolean;crouched:boolean;tampering:boolean;disguise:string};
const view=(p:{x:number;y:number;z:number},disguise:string):P=>({...p,floor:floorOf(p.y),speed:0,running:false,crouched:false,tampering:false,disguise});
export function game(){
 const d=new Director(hotel,world,nav,boxes,structuredClone(rules)),e=new MissionEvents(),c=new MissionClock(rules.schedule,e),schedule=new ScheduleSystem(plans,hotel.schedulePlaces,d,c,e),
  m3=new M3System(d,hotel.hides,rules.m3),m4=new M4System(d,hotel.checkpoints,rules.m4),f=new M53System(d,m3,m4,c,e,rules.m53,hotel.m53,hotel.cameras,chances),g=new M57System(d,m3,m4,f,c,e,map,hotel.cameras),
  combat=new CombatSystem(d,e,m3.hotel,json('combat'),json('weapons'),hotel.reinforcements,()=>.5),flow=new MissionFlow(mission.targets,d,e),detection=new DetectionSystem(d,e,m3.hotel,hotel.cameras,det,hotel),
  ledger=new ScoreLedger(e,(id:string)=>{const n=d.npcs.find((n:any)=>n.id===id);return n&&{role:n.role,target:n.target};});
 const spottedBy:string[]=[],found:string[]=[];
 d.onSpotted=(n:any)=>{spottedBy.push(n.id);e.emit({type:'player.spotted',time:c.elapsed,id:n.id});};
 m3.onFound=(b:any)=>{found.push(b.id+':'+b.deathKind);e.emit({type:'body.found',time:c.elapsed,id:b.id,life:b.life==='dead'?'dead':'unconscious',judgement:b.deathKind});};
 f.bindDetection(detection);f.illegal=()=>combat.illegalIn(m4.disguise);let hand='';g.held_item=()=>hand;g.illegal=f.illegal;
 const S:any={d,e,c,schedule,m3,m4,f,g,combat,flow,detection,ledger,spottedBy,found,p:view({x:1000,y:0,z:1000},'suit'),heading:0,give:(x:string)=>{hand=x;detection.held=x;}};
 S.tick=(keys:Set<string>=new Set())=>{const p={...S.p,tampering:f.tampering||g.tampering,blending:!!detection.blend||g.inCar,illegal:combat.illegalIn(m4.disguise),weaponDrawn:!!combat.hand,illegalVisibleCarry:combat.shown(m4.disguise),suspiciousItem:detection.suspiciousHeld(m4.disguise)};c.step(.1);schedule.sync(.1);d.step(.1,p);f.step(.1,p,S.heading,keys);g.step(.1,p,keys);m3.step(.1,p,S.heading,keys);combat.step(.1,p,c.elapsed);
  detection.step(.1,p,{illegal:combat.illegalIn(m4.disguise)||!!m3.action||f.tampering||g.tampering,carrying:!!m3.dragged,trespass:false},c.elapsed,false,keys.has('KeyE'));schedule.sync(0);f.afterAi(p);m3.discover();flow.update(c.elapsed);};
 S.at=(pt:{x:number;y:number;z:number})=>{S.p=view(pt,m4.disguise);};
 S.dress=(x:string)=>{m4.disguise=x;S.p={...S.p,disguise:x};e.emit({type:'disguise.changed',time:c.elapsed,id:x});};
 S.hold=(key:string,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*10)+2;i++)S.tick(new Set([key]));S.tick();};
 S.until=(ok:()=>boolean,seconds:number,stay?:()=>void)=>{for(let i=0;i<seconds*10&&!ok();i++){stay?.();S.tick();}return ok();};
 S.npc=(id:string)=>d.npcs.find((n:any)=>n.id===id);
 S.hear=(id:string)=>e.emit({type:'dialogue.heard',time:c.elapsed,id});
 S.beside=(id:string)=>{const n=S.npc(id);S.p=view({x:n.pos.x+Math.sin(n.heading),y:n.pos.y,z:n.pos.z+Math.cos(n.heading)},m4.disguise);};
 S.behind=(id:string)=>{const n=S.npc(id);S.p=view({x:n.pos.x-Math.sin(n.heading)*.8,y:n.pos.y,z:n.pos.z-Math.cos(n.heading)*.8},m4.disguise);S.heading=n.heading;};
 S.away=()=>{S.p=view({x:1000,y:0,z:1000},m4.disguise);};
 S.reach=(id:string,doing:string,seconds:number)=>S.until(()=>{const n=S.npc(id);return n.scheduleAction===doing&&!n.scheduleTarget&&n.state==='patrol';},seconds,S.away);
 return S;}
function hideBody(S:any,id:string,container:string,st:Record<string,boolean>){const n=S.npc(id),h=hotel.hides.find((h:any)=>h.id===container);S.at(n.pos);S.hold('KeyE',.1);st.picked_up=S.m3.dragged===n;
 const goal={x:h.x+h.approach.x,y:h.y,z:h.z+h.approach.z};
 for(let i=0;i<600&&!S.m3.container(S.p);i++){const dx=goal.x-S.p.x,dz=goal.z-S.p.z,len=Math.hypot(dx,dz),step=Math.min(rules.m3.dragSpeed*.1,len),next=world.move(S.p,dx/len*step,dz/len*step,.5);S.p={...S.p,...S.m3.constrainMove(S.p,next,S.heading)};S.tick();}
 st.container_reached=!!S.m3.container(S.p);S.hold('KeyE',rules.m3.hideSeconds+.3);st.hidden=n.bodyMode==='hidden';}
export const act=(id:string)=>map.acts[id].at;
export const results:any[]=[];
function report(name:string,target:string,S:any,steps:Record<string,boolean>,note=''){
 // Let the hotel react for two more minutes from far away (bodies get found, reports land).
 S.away();for(let i=0;i<1200;i++)S.tick();
 const t=S.npc(target),others=S.d.npcs.filter((n:any)=>!n.target&&n.life==='dead').map((n:any)=>n.id),ko=S.d.npcs.filter((n:any)=>n.life==='unconscious').map((n:any)=>n.id);
 const counts=Object.fromEntries(S.ledger.counts),score=computeResult(scoring,S.ledger.counts,S.c.elapsed,t.life==='dead'),broken=score.ghostBrokenBy;
 results.push({name,target:`${t.life}:${t.deathMethod??''}:${t.deathKind??''}`,others,ko,steps,spottedBy:[...new Set(S.spottedBy)],found:S.found,compromised:[...S.d.compromised],recorded:S.detection.recorded?S.detection.recordReason:'',ghostBrokenBy:broken,ghost:score.ghost,score,note,reasons:(S.f.kills??[]).map((k:any)=>k.victim+'='+k.judgement.kind+'<'+k.judgement.reasons.join('/')+'>')});}
export const scenarios:{name:string;target:string;play:(S:any,steps:Record<string,boolean>)=>void}[]=[];
function run(name:string,target:string,play:(S:any,steps:Record<string,boolean>)=>void){scenarios.push({name,target,play});}
export function simulate(scenario:typeof scenarios[number]){const S=game(),steps:Record<string,boolean>={};try{scenario.play(S,steps);}catch(err:any){steps['error:'+String(err.message).slice(0,80)]=false;}report(scenario.name,scenario.target,S,steps);return results.pop();} 

run('A1 試飲会のソムリエ（毒の一杯）','wine_merchant',(S,st)=>{S.hear('pier_sommelier');S.c.jump(400);for(let i=0;i<300;i++){S.away();S.tick();}S.dress('sommelier');
 const hw=S.npc('head_waiter');const fwd={x:Math.sin(hw.heading),z:Math.cos(hw.heading)};let q={x:hw.pos.x+fwd.x*8,y:hw.pos.y,z:hw.pos.z+fwd.z*8};
 for(let i=0;i<120;i++){const dd=Math.hypot(hw.pos.x-q.x,hw.pos.z-q.z);if(dd<=1.3)break;q={x:q.x+(hw.pos.x-q.x)/dd*.165,y:q.y,z:q.z+(hw.pos.z-q.z)/dd*.165};S.p={...view(q,'sommelier'),speed:1.65};S.tick();}
 for(let i=0;i<15;i++)S.tick();st.greet_without_blown=!S.d.compromised.has('sommelier');S.hold('KeyJ',rules.m53.talkSeconds+.3);st.cellar_key=!!S.f.cellarKey;
 S.c.jump(1140);S.until(()=>S.f.wine.scheduleAction==='tasting'&&!S.f.wine.scheduleTarget,150,S.away);S.at(hotel.m53.glass.approach);S.hold('KeyE',rules.m53.serveSeconds+.3);st.served=S.f.wine.life==='dead';});
run('A2 限定ワインの樽（毒）','wine_merchant',(S,st)=>{S.hear('loading_limited_wine');S.dress('waiter');S.at(hotel.m53.barrel.approach);S.hold('KeyE',rules.m53.poisonSeconds+.3);st.armed=S.f.barrel==='armed';
 S.c.jump(1100);st.died=S.until(()=>S.npc('wine_merchant').life==='dead',300,S.away);});
run('A3 プールの照明（感電）','wine_merchant',(S,st)=>{S.hear('pool_exposed_wire');S.c.jump(880);S.give('wrench');S.dress('cleaner');S.at(act('pool_panel'));S.hold('KeyE',3.3);st.armed=S.g.armed.has('pool_light');
 st.came=S.until(()=>S.g.flags.has('wine_at_pool'),150,S.away);S.at(act('pool_light'));S.hold('KeyE',1.8);});
run('A4 テラスの記念撮影（突き落とし）','wine_merchant',(S,st)=>{S.hear('terrace_photo');S.c.jump(370);S.dress('photographer');st.pose=S.reach('wine_merchant','photo',90);S.beside('wine_merchant');S.hold('KeyE',2.3);
 const W=S.npc('wine_merchant');st.posed=S.until(()=>Math.hypot(W.pos.x-map.posed.wine_merchant.x,W.pos.z-map.posed.wine_merchant.z)<.5&&!W.scheduleTarget,40,S.away);for(let i=0;i<150;i++)S.tick();
 S.p=view({x:W.pos.x-.9,y:0,z:W.pos.z},'photographer');S.heading=Math.PI/2;S.hold('KeyP',2);});
run('A5 展示ヨットのクレーン（落下物）','wine_merchant',(S,st)=>{S.hear('marina_crane_loose');S.c.jump(60);S.dress('fisher');S.at({x:12,y:0,z:25.4});S.combat.equip('pistol_silenced');S.combat.hand='pistol_silenced';const camera=S.detection.cameras.find((c:any)=>c.id==='CAM_marina');const shot=S.combat.fire(S.p,camera,S.c.elapsed);S.detection.shotAt(S.combat.tracers.at(-1).from,shot.to,S.c.elapsed);S.combat.holster();st.camera_disabled=S.detection.destroyed.has(camera.id);S.away();for(let i=0;i<200;i++)S.tick();S.at(act('crane_pin'));S.hold('KeyE',5.3);st.armed=S.g.armed.has('yacht_crane');S.c.jump(610);
 st.tour=S.reach('wine_merchant','tour',150);S.at(act('crane_panel'));S.hold('KeyE',1.3);});
run('B1 スピーチとシャンデリア','lawyer',(S,st)=>{S.hear('lobby_chandelier');S.c.jump(330);S.give('wrench');S.dress('waiter');st.speech=S.until(()=>S.npc('lawyer').scheduleAction==='speech'&&!S.npc('lawyer').scheduleTarget,90,S.away);
 S.at(act('chandelier_clamp'));S.tick();S.hold('KeyE',4.3);st.armed=S.g.armed.has('chandelier');S.hold('KeyE',1.3);});
run('B2 料理長の試食会（ガス）','lawyer',(S,st)=>{S.hear('kitchen_tasting');S.c.jump(600);S.dress('chef');S.give('wrench');S.at(act('gas_pipe'));S.hold('KeyE',4.3);st.armed=S.g.armed.has('gas_leak');
 st.cook=S.reach('head_chef','cook',30);S.beside('head_chef');S.hold('KeyE',3.3);st.chef_away=S.g.flags.has('chef_away');st.tasting=S.reach('lawyer','tasting',150);
 // 2026-11-03: the stove is 4 m in front of the sous chef, who knows chef faces. A crowd on the floor above used to
 // count as cover; now a coin to the west draws him off while the stove is lit.
 {const coin=S.d.noise({x:-23,y:0,z:-14.5});st.coin=coin?.id==='sous_chef';for(let i=0;i<10;i++)S.tick();}S.at(act('stove_light'));S.hold('KeyE',1.8);
 S.p=view({x:-30,y:0,z:5},'chef');for(let i=0;i<40;i++)S.tick();});
run('B2 料理長の試食会（毒の皿）','lawyer',(S,st)=>{S.hear('kitchen_tasting');S.c.jump(600);S.dress('chef');st.cook=S.reach('head_chef','cook',30);S.beside('head_chef');S.hold('KeyE',3.3);
 st.tasting=S.reach('lawyer','tasting',150);S.beside('lawyer');S.hold('KeyE',2.3);});
run('B3 護衛の交代（付き添って排除）','lawyer',(S,st)=>{S.hear('bodyguard_change');S.c.jump(965);S.dress('bodyguard');st.wait=S.reach('lawyer','wait',120);
 S.beside('lawyer');for(let i=0;i<20;i++)S.tick();st.not_blown_on_arrival=!S.d.compromised.has('bodyguard');S.hold('KeyE',2.3);st.escorting=!!S.g.escorting;
 for(let i=0;i<80;i++){S.p=view({x:S.p.x-.1,y:S.p.y,z:S.p.z},'bodyguard');S.tick();}const L=S.npc('lawyer');st.followed=Math.hypot(L.pos.x-S.p.x,L.pos.z-S.p.z)<2.5;
 S.at({x:22,y:3.5,z:-17});st.private_room=S.until(()=>Math.hypot(L.pos.x-22,L.pos.z+17)<2,60);S.away();for(let i=0;i<25;i++)S.tick();
 S.behind('lawyer');S.hold('KeyX',3);st.killed=L.life==='dead';});
run('B4 専属運転手（車内）','lawyer',(S,st)=>{S.hear('parking_phone');S.c.jump(1150);S.dress('driver');S.at(act('car_sit'));S.hold('KeyE',1.8);st.in_car=!!S.g.inCar;
 st.got_in=S.until(()=>S.g.flags.has('lawyer_in_car'),200);S.hold('KeyE',3.3);});
run('C1 バルコニーの電話（手すり）','investor',(S,st)=>{S.hear('penthouse_phone_hint');S.c.jump(60);S.dress('waiter');S.at(act('take_keycard'));S.hold('KeyE',1.8);st.keycard=!!S.g.keycard;
 S.dress('bodyguard');S.at(act('rail_bolts'));S.hold('KeyE',4.3);st.armed=S.g.armed.has('balcony_rail');S.c.jump(400);st.died=S.until(()=>S.npc('investor').life==='dead',150,S.away);});
run('C2 避難ボート（燃料・避難誘導）','investor',(S,st)=>{S.hear('marina_escape');S.c.jump(60);S.dress('fisher');S.at(act('boat_fuel'));S.hold('KeyE',4.3);st.armed=S.g.armed.has('boat_fuel');
 S.dress('guard');S.at(act('alarm_bell'));S.hold('KeyE',1.3);st.investor_evacuation=S.g.flags.has('investor_evacuation');st.died=S.until(()=>S.npc('investor').life==='dead'||S.g.escaped.has('investor'),400,S.away);});
run('C3 屋上のヘリ（パイロットで突き落とし）','investor',(S,st)=>{S.hear('investor_helicopter');S.c.jump(1210);S.dress('pilot');st.wait=S.reach('investor','wait',150);S.beside('investor');S.hold('KeyE',2.3);
 const I=S.npc('investor');st.posed=S.until(()=>Math.hypot(I.pos.x-map.posed.investor.x,I.pos.z-map.posed.investor.z)<.5&&!I.scheduleTarget,60,S.away);for(let i=0;i<150;i++)S.tick();
 S.p=view({x:I.pos.x-.9,y:I.pos.y,z:I.pos.z},'pilot');S.heading=Math.PI/2;S.hold('KeyP',2);});
run('C4 出張マッサージ師（ワイヤー）','investor',(S,st)=>{S.hear('reception_massage');S.c.jump(665);S.dress('masseuse');S.at({x:-26,y:7,z:-10});S.tick();st.in=S.g.flags.has('masseuse_in');
 st.massage=S.until(()=>{const n=S.npc('investor');return n.scheduleAction==='massage'&&!n.scheduleTarget&&n.state==='patrol';},150,()=>S.at({x:-26,y:7,z:-10}));S.beside('investor');S.hold('KeyE',3.3);hideBody(S,'investor','locker-penthouse',st);});
run('C5 浜辺の花火','investor',(S,st)=>{S.hear('beach_fireworks');S.c.jump(905);S.dress('beachbar');S.at(act('fireworks_aim'));S.hold('KeyE',3.3);st.armed=S.g.armed.has('fireworks');st.died=S.until(()=>S.npc('investor').life==='dead',200,S.away);});
for(const id of ['wine_merchant','lawyer','investor'])run(`素手 X（背後からワイヤー）：${id}`,id,(S,st)=>{S.c.jump(60);for(let i=0;i<30;i++)S.tick();const n=S.npc(id);for(let i=0;i<40&&n.life==='active';i++){S.behind(id);S.tick(new Set(['KeyX']));}S.tick();st.killed=n.life==='dead';});
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(scenarios.map(simulate),null,1));

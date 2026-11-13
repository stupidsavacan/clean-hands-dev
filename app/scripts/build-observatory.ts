// The observatory's map, written as code (2026-11-13):
//   node --experimental-strip-types --no-warnings scripts/build-observatory.ts
// writes src/data/observatory-layout.json (rooms, walls, doors, furniture, people, places) and
// src/data/observatory-schedule.json (who is where, when). Change the plan here and run it again; the map lab can
// open the result (`npm run map:check -- observatory` checks it).
//
// The plan (x to the east, z to the north, metres). Ground floor:
//
//   z=44 ┌───────────────────── north (cliff side) ──────────────────────┐
//   z=38 │      ┌─ office ─┬──────── pier ────────┬──── plant ───┐       │
//   z=33 │ gen  ├─ control ┼─ cryo ──┬─ server ─┬S┼─ staffroom ──┤       │
//   z=25 │ shed ├──────────┴──── hall ─┴────────┴1┴──────────────┤ east  │
//   z=22 │      ├ lounge ┬──────── lobby ──────────┬─── store ───┤       │
//   z=10 │ west └────────┴───────── front ─────────┴──── wc ─────┘       │
//   z=0  └──────────────────────── yard (gate) ─────────────────────────┘
//        x=0   10       18/20      28           36/38            46     56
//
// Upper floor (y 3.5): the dome room over hall/cryo/server/pier (x 20..36, z 22..38), the upper corridor east of it
// (x 36..46, z 32..38) at the top of the stairs, and the steel catwalk outside the dome's north wall (z 38..40).
import {writeFileSync} from 'node:fs';

type Gap=[at:number,width:number];
type Block={id:string;x:number;z:number;w:number;d:number;h:number;y:number;floor:number;prefab?:string};
const round=(n:number)=>Math.round(n*1000)/1000;
const walls:Block[]=[];
/** A wall along x at `z` from x0 to x1, with gaps (centre, width) left open. */
function wallX(id:string,z:number,x0:number,x1:number,gaps:Gap[]=[],floor=0,h=3.4,d=.2){
 let from=x0,i=0;
 for(const [at,width] of [...gaps].sort((a,b)=>a[0]-b[0])){
  if(at-width/2>from)walls.push({id:`${id}-${i++}`,x:round((from+at-width/2)/2),z,w:round(at-width/2-from),d,h,y:floor*3.5,floor});
  from=at+width/2;
 }
 if(x1>from)walls.push({id:`${id}-${i}`,x:round((from+x1)/2),z,w:round(x1-from),d,h,y:floor*3.5,floor});
}
/** A wall along z at `x` from z0 to z1. */
function wallZ(id:string,x:number,z0:number,z1:number,gaps:Gap[]=[],floor=0,h=3.4,w=.2){
 let from=z0,i=0;
 for(const [at,width] of [...gaps].sort((a,b)=>a[0]-b[0])){
  if(at-width/2>from)walls.push({id:`${id}-${i++}`,x,z:round((from+at-width/2)/2),w,d:round(at-width/2-from),h,y:floor*3.5,floor});
  from=at+width/2;
 }
 if(z1>from)walls.push({id:`${id}-${i}`,x,z:round((from+z1)/2),w,d:round(z1-from),h,y:floor*3.5,floor});
}

const STAFF=['technician','guard','bodyguard','manager','cleaner','bartender'];
const SECURE=['guard','bodyguard','manager'];
const room=(id:string,label:string,floor:number,type:'public'|'staff'|'secure',minX:number,minZ:number,maxX:number,maxZ:number,surface:string,indoor=true,allowedDisguises:string[]=type==='staff'?STAFF:type==='secure'?SECURE:[])=>
 ({id,label,floor,type,minX,minZ,maxX,maxZ,surface,indoor,allowedDisguises});
const rooms=[
 room('yard','前庭',0,'public',0,0,56,10,'asphalt',false),
 room('west','西の裏手',0,'staff',0,10,10,44,'asphalt',false),
 room('east','東の裏手',0,'staff',46,10,56,44,'asphalt',false),
 room('north','崖側の通路',0,'staff',10,38,46,44,'asphalt',false),
 room('lounge','談話室',0,'public',10,10,18,22,'carpet'),
 room('lobby','展示ロビー',0,'public',18,10,38,22,'carpet'),
 room('wc','化粧室',0,'public',38,10,46,16,'service'),
 room('store','倉庫',0,'staff',38,16,46,22,'service'),
 room('hall','職員廊下',0,'staff',10,22,46,25,'service'),
 room('control','管制室',0,'secure',10,25,20,33,'carpet'),
 room('office','所長室',0,'secure',10,33,20,38,'carpet'),
 room('cryo','低温実験室',0,'staff',20,25,28,33,'service',true,['technician','manager','guard','bodyguard']),
 room('server','電気・サーバー室',0,'staff',28,25,36,33,'service',true,['technician','manager','guard','bodyguard']),
 room('S1','階段',0,'staff',36,25,38,32,'service'),
 room('staffroom','職員休憩室',0,'staff',38,25,46,33,'carpet'),
 room('pier','架台室',0,'staff',20,33,36,38,'service',true,['technician','manager','guard','bodyguard']),
 room('plant','機械室',0,'staff',36,33,46,38,'service',true,['technician','guard','bodyguard']),
 // The shed is listed after `west` but is its own room (zone lookups take the smallest match by order: put it first).
 room('obs','観測室（ドーム）',1,'staff',20,22,36,38,'service',true,['technician','manager','guard','bodyguard']),
 room('upper','2階通路',1,'staff',36,32,46,38,'service'),
 room('catwalk','ドーム外のキャットウォーク',1,'staff',20,38,36,40,'service',false,['technician','manager','guard','bodyguard']),
];
// The generator shed sits inside the west yard: it goes first so a point in it is in the shed, not the yard.
rooms.unshift(room('gen','発電機小屋',0,'staff',2,28,8,36,'service',true,['technician','guard','bodyguard']));

// Ground floor shell.
wallX('outer-south',10,10,46,[[28,2.4]]);
wallX('outer-north',38,10,46,[[26,1]]);
wallZ('outer-west',10,10,38,[[23.5,1]]);
wallZ('outer-east',46,10,38);
// Ground floor inside.
wallZ('lounge-lobby',18,10,22,[[16,2.4]]);
wallZ('lobby-east',38,10,22,[[13,1.2]]);
wallX('wc-store',16,38,46);
wallX('hall-south',22,10,46,[[14,1.4],[28,3],[42,1]]);
wallX('hall-north',25,10,46,[[15,1],[24,1],[32,1],[37,1.7],[42,1]]);
wallZ('control-cryo',20,25,38);
wallZ('cryo-server',28,25,33);
wallZ('server-stairs',36,25,38);
wallZ('stairs-staff',38,25,33);
wallX('north-row',33,10,46,[[15,1],[32,1],[43.6,1]]);
// The generator shed.
wallX('shed-south',28,2,8);wallX('shed-north',36,2,8);wallZ('shed-west',2,28,36);wallZ('shed-east',8,28,36,[[32,1]]);
// Upper floor: the dome room's drum wall, the corridor, and the catwalk's rails.
wallX('dome-south',22,20,36,[],1,2.4);
wallZ('dome-west',20,22,38,[],1,2.4);
wallX('dome-north',38,20,36,[[28,1]],1,2.4);
wallZ('dome-east',36,22,38,[[35,1]],1,2.4);
wallX('upper-south',32,38,46,[],1,2.4);
wallZ('upper-east',46,32,38,[],1,2.4);
wallX('upper-north',38,36,46,[],1,2.4);
wallX('rail-catwalk-north',40,20,36,[[34,1]],1,1.05,.08);
wallZ('rail-catwalk-west',20,38,40,[],1,1.05,.08);
wallZ('rail-catwalk-east',36,38,40,[],1,1.05,.08);

const door=(id:string,label:string,x:number,z:number,along:'x'|'z',floor=0,extra:Record<string,unknown>={})=>
 ({id,label,x,z,w:along==='x'?1:.14,d:along==='x'?.14:1,y:floor*3.5,h:2.2,floor,...extra});
const doors=[
 door('d-west','西の通用口',10,23.5,'z',0,{startsClosed:true}),
 door('d-store','倉庫の扉',42,22,'x',0,{startsClosed:true}),
 door('d-control','管制室の電気錠',15,25,'x',0,{key:'keycard',guardAccess:true,access:['director','researcher_b','tech']}),
 door('d-office','所長室の電気錠',15,33,'x',0,{key:'keycard',guardAccess:true,access:['director']}),
 door('d-cryo','低温実験室の気密扉',24,25,'x',0,{startsClosed:true}),
 door('d-server','電気室の扉',32,25,'x',0,{startsClosed:true}),
 door('d-staff','休憩室の扉',42,25,'x',0),
 door('d-pier','架台室の扉',32,33,'x',0,{startsClosed:true}),
 door('d-pier-out','架台室の裏口',26,38,'x',0,{startsClosed:true}),
 door('d-plant','機械室の扉',43.6,33,'x',0,{startsClosed:true}),
 door('d-gen','発電機小屋の扉',8,32,'z',0,{startsClosed:true}),
 door('d-obs','観測室の扉',36,35,'z',1,{startsClosed:true}),
 door('d-catwalk','キャットウォークの扉',28,38,'x',1,{startsClosed:true}),
];

const furniture:Block[]=[];
const prop=(id:string,x:number,z:number,w:number,d:number,h:number,floor=0,prefab?:string)=>{furniture.push({id,x,z,w,d,h,y:floor*3.5,floor,...(prefab?{prefab}:{})});};
// Yard: cars to hide behind, planters by the door.
prop('car-visitor-1',12,4.2,1.9,4.2,1.3);prop('car-visitor-2',16,4.2,1.9,4.2,1.3);prop('car-director',40,4.6,1.9,4.4,1.3);prop('truck-service',47,5,2.3,5.4,2.3);
prop('planter-front-w',24.5,9.2,2.4,.8,.6);prop('planter-front-e',31.5,9.2,2.4,.8,.6);
// West: fuel tank, crates, the pole with the incoming switch.
prop('tank-fuel',5,25.6,2.6,1.4,1.5);prop('crate-west-1',8.8,15,1.2,1.2,1.1);prop('crate-west-2',8.8,16.4,1.2,1.2,1.1);prop('pole-line',9.2,27,.35,.35,3.4);
// East: the bulk nitrogen tank and the weather mast.
prop('tank-nitrogen',47.6,29,1.6,1.6,3);prop('mast-weather',51,36,.4,.4,3.4);prop('crate-east-1',47.2,19,1.2,1.2,1.1);
// North: crates under the catwalk.
prop('crate-north-1',14,39.2,1.2,1.2,1.1);prop('crate-north-2',41,39.2,1.4,1.2,1.1);
// Lounge: the wood stove, sofas, tables, the serving counter.
prop('stove-lounge',10.9,16,1,1.1,1.2);prop('sofa-lounge-a',13.2,13.4,2.4,.9,.8);prop('table-lounge-a',13.2,14.9,1.4,.8,.5);
prop('sofa-lounge-b',13.2,18.6,2.4,.9,.8);prop('table-lounge-b',13.2,17.2,1.4,.8,.5);prop('counter-lounge',16.9,20.3,1.4,2.6,1.1);
// Lobby: reception, the orrery, display cases, benches.
prop('counter-reception',23,12.4,3.6,.8,1.1);prop('orrery-lobby',28,16.5,2.6,2.6,.9);
prop('case-meteorite',33.5,13.2,1.2,1.2,1.2);prop('case-lens',34.5,19,1.6,.8,1.2);prop('sofa-lobby',21.5,20.8,2.6,.8,.8);prop('case-model',20.2,15,.8,2.4,1.2);
// Toilets and store.
prop('toilet-partition',42,11.2,.15,2.2,2);prop('counter-wash-toilet',44.6,14.2,2.4,.7,.9);
prop('shelf-store-1',45.5,19,.6,4.4,1.9);prop('crate-store-1',40.2,17.2,1.2,1.2,1.1);prop('crate-store-2',40.2,20.6,1.2,1.2,1.1);
// Control room and the director's office.
prop('desk-control-a',12,27,2.6,1,.9);prop('desk-control-b',12,30.5,2.6,1,.9);prop('rack-control',19.4,29,.8,2.6,2);prop('table-control',16.8,31.2,1.6,1,.75);
prop('desk-director',13.5,36.4,2.4,1,.85);prop('safe-office',10.5,34,.7,.8,1.3,0,'safe');prop('shelf-office',19.6,35.5,.6,3.4,1.9,0,'bookshelf');
// Cryo lab: the dewar, the detector bench, cylinders.
prop('dewar-cryo',21.3,31.6,1.2,1.2,1.7);prop('bench-cryo',25.5,31.8,2.6,.9,.9);prop('machine-cryostat',27,27.4,1.2,1.4,1.6);prop('rack-cryo',20.5,27.2,.7,1.8,1.9);
// Electrical room: the switchboard, the UPS, server racks.
prop('panel-main',28.5,29.5,.5,3.2,2.1);prop('rack-server-a',33,30.6,2.6,.9,2);prop('rack-server-b',33,28.2,2.6,.9,2);prop('machine-ups',35.3,26,.9,1.2,1.5);
// Staff room: heated table, lockers, the kitchenette.
prop('table-staff',42,29.4,1.8,1.1,.6);prop('sofa-staff',45.3,29.4,.9,2.4,.8);prop('counter-staff',40,32.5,3,.7,.9);
// Pier room: the telescope's concrete pier and the shutter's drive cabinet.
prop('pier-concrete',28,35.6,2.6,2.6,3.4);prop('machine-drive',34.6,36.6,1.4,1.2,1.8);prop('crate-pier',22,36.8,1.4,1.2,1.1);
// Plant room: boiler, air handler.
prop('machine-boiler',44.4,36.4,1.8,1.6,2);prop('machine-airhandler',39.4,36.9,2.8,1.2,1.9);
// Generator shed: the set and the day tank.
prop('machine-generator',4.6,31,2.2,3.4,1.5);prop('tank-day',3.2,34.8,1,1,1.3);
// Upper floor: the telescope's mount in the dome, desks along the wall, the weather desk.
prop('mount-telescope',28,30,2.4,2.4,1.3,1);prop('desk-observer',21.4,26,1,2.6,.9,1);prop('rack-dome',34.9,25,1.2,.8,1.9,1);
prop('desk-weather',44.6,36.6,2,1,.9,1);prop('shelf-upper',40,37.5,2.4,.6,1.9,1);

const hides=[
 {id:'locker-staff',label:'休憩室のロッカー',spareClothes:true,x:38.55,y:0,z:27.5,heading:Math.PI/2,capacity:1,approach:{x:1,z:0},size:{w:.65,d:1.2,h:1.9}},
 {id:'locker-store',label:'倉庫のロッカー',x:38.55,y:0,z:19,heading:Math.PI/2,capacity:1,approach:{x:1,z:0},size:{w:.65,d:1.2,h:1.9}},
 {id:'locker-gen',label:'発電機小屋の物入れ',x:7.45,y:0,z:35,heading:-Math.PI/2,capacity:1,approach:{x:-1,z:0},size:{w:.65,d:1.2,h:1.9}},
 {id:'locker-pier',label:'架台室の物入れ',x:20.55,y:0,z:34.6,heading:Math.PI/2,capacity:1,approach:{x:1,z:0},size:{w:.65,d:1.2,h:1.9}},
];
for(const h of hides)furniture.push({id:h.id,x:h.x,z:h.z,w:h.size.w,d:h.size.d,h:h.size.h,y:h.y,floor:0,prefab:'locker'});

// People. route: where they stand (or the points they walk between); look: where they face from the first point.
type NpcSpec={id:string;label:string;kind:'target'|'escort'|'guard'|'staff'|'guest';model:string;outfit:string;route:number[][];look?:[number,number];securityRole?:string};
const people:NpcSpec[]=[
 {id:'director',label:'所長',kind:'target',model:'investor',outfit:'vip_guest',route:[[13,28.6,0]]},
 {id:'aide',label:'所長の護衛',kind:'escort',model:'bodyguard',outfit:'bodyguard',route:[[14.5,28.6,0]]},
 {id:'guard_gate',label:'玄関の警備員',kind:'guard',securityRole:'gate',model:'bodyguard',outfit:'guard',route:[[26.2,11.6,0]],look:[26.2,5]},
 {id:'guard_hall',label:'廊下の警備員',kind:'guard',securityRole:'patrol',model:'bodyguard',outfit:'guard',route:[[13,23.5,0],[44,23.5,0]]},
 {id:'guard_control',label:'管制室前の警備員',kind:'guard',securityRole:'post',model:'bodyguard',outfit:'guard',route:[[16.6,24.2,0]],look:[16.6,20]},
 {id:'guard_yard',label:'外回りの警備員',kind:'guard',securityRole:'patrol',model:'bodyguard',outfit:'guard',route:[[6,8,0],[5,22,0],[12,41.5,0],[44,41.5,0],[51,22,0],[50,8,0]]},
 {id:'guard_dome',label:'ドームの警備員',kind:'guard',securityRole:'post',model:'bodyguard',outfit:'guard',route:[[40,34,3.5]],look:[36,35]},
 {id:'tech',label:'設備技師',kind:'staff',model:'delivery',outfit:'technician',route:[[41,35,0]]},
 {id:'researcher_a',label:'研究員（観測）',kind:'staff',model:'lawyer',outfit:'manager',route:[[22.6,26,3.5]]},
 {id:'researcher_b',label:'研究員（検出器）',kind:'staff',model:'guest_dress',outfit:'manager',route:[[25.5,30.6,0]]},
 {id:'cook',label:'食堂係',kind:'staff',model:'waiter',outfit:'bartender',route:[[15.8,20.3,0]]},
 {id:'cleaner',label:'清掃員',kind:'staff',model:'cleaner',outfit:'cleaner',route:[[40,13,0]]},
 {id:'donor_a',label:'後援会の客',kind:'guest',model:'guest_suit',outfit:'suit',route:[[14.8,13.6,0]]},
 {id:'donor_b',label:'後援会の客',kind:'guest',model:'guest_dress',outfit:'suit',route:[[14.8,18.4,0]]},
 {id:'donor_c',label:'写真家',kind:'guest',model:'photographer',outfit:'suit',route:[[30.5,16.5,0]]},
 {id:'donor_d',label:'後援会の客',kind:'guest',model:'wine_merchant',outfit:'suit',route:[[32,13.6,0]]},
 {id:'donor_e',label:'後援会の客',kind:'guest',model:'pool_guest_resort',outfit:'suit',route:[[22,19.4,0]]},
];
const npcs=people.map(p=>{
 const [x,z]=p.route[0],guard=p.kind==='guard'||p.kind==='escort';
 return {id:p.id,label:p.label,role:guard?'guard':p.kind==='staff'?'waiter':'guest',outfit:p.outfit,model:p.model,floor:p.route[0][2]?1:0,route:p.route,
  look:p.look??[x+1,z],faction:guard?'club_security':'club',securityRole:p.kind==='escort'?'escort':p.securityRole??'',combatProfile:guard?'guard':'civilian',
  disguiseId:p.outfit,knowsFaces:p.kind==='escort'?['bodyguard']:p.id==='guard_control'?['manager','guard']:p.id==='researcher_a'?['manager']:p.id==='guard_hall'?['technician']:[],
  ...(guard?{loadout:'pistol_guard'}:{}),...(p.kind==='target'?{target:true}:{})};
});

// Places people's plans name. y 0 ground, 3.5 upper.
const places:Record<string,{x:number;y:number;z:number;heading:number;label:string;outdoor:boolean}>={};
const place=(id:string,x:number,z:number,heading:number,label:string,y=0,outdoor=false)=>{places[id]={x,y,z,heading,label,outdoor};return id;};
const N=0,E=Math.PI/2,S=Math.PI,W=-Math.PI/2;
place('dir_console',13,28.6,S,'管制室');place('dir_desk',13.5,35,N,'所長室');place('dir_dome',25.5,27.5,N,'観測室',3.5);place('dir_lounge',15.6,15.9,W,'談話室');place('dir_lobby',26.6,18.2,E,'展示ロビー');
place('tech_plant',41,35,N,'機械室');place('tech_panel',29.6,29.5,W,'電気室');place('tech_staff',42,28.2,N,'休憩室');place('tech_gen',5.2,33.6,S,'発電機小屋');
place('ra_desk',22.6,26,W,'観測室',3.5);place('ra_scope',26,30,E,'観測室',3.5);place('ra_weather',44.6,35.4,N,'2階通路',3.5);
place('rb_bench',25.5,30.6,N,'低温実験室');place('rb_console',13.6,31.4,W,'管制室');place('rb_staff',43.4,29.4,W,'休憩室');
place('cook_counter',15.8,20.3,E,'談話室');place('cook_table',14.6,15,W,'談話室');place('cook_store',41.6,19,W,'倉庫');
place('cl_wc',40,13,E,'化粧室');place('cl_lobby',30,20.4,S,'展示ロビー');place('cl_hall',34,23.5,W,'職員廊下');place('cl_store',41.4,17.4,W,'倉庫');
place('da_sofa',14.8,13.6,W,'談話室');place('da_orrery',26.1,15.6,E,'展示ロビー');place('da_wc',44.8,12.4,E,'化粧室');
place('db_sofa',14.8,18.4,W,'談話室');place('db_case',32.2,14.6,E,'展示ロビー');place('db_stove',12.4,16,W,'談話室');
place('dc_orrery',30.5,16.5,W,'展示ロビー');place('dc_front',28,12,S,'展示ロビー');place('dc_lens',34.4,17.8,N,'展示ロビー');place('dc_lounge',16,12,W,'談話室');
place('dd_meteor',32,13.6,E,'展示ロビー');place('dd_counter',23,13.6,S,'展示ロビー');place('dd_lounge',15.2,17.2,W,'談話室');
place('de_sofa',22,19.4,N,'展示ロビー');place('de_model',21.4,15,W,'展示ロビー');place('de_wc',43.4,12.8,E,'化粧室');
// Where people go to get warm, to shelter from the rain, to crank the shutter, to look at the detector.
const warm=[[11.4,14.4],[11.4,17.6],[14.6,16.1],[15.6,14.2],[15.6,17.8],[16.6,16],[12,12],[12,20],[14,11.6],[16.4,12.4],[14.2,20.6],[11.6,18.8]];
warm.forEach(([x,z],i)=>place('warm_'+i,x,z,Math.atan2(10.9-x,16-z),'談話室'));
place('shelter_yard',26,9,S,'玄関のひさし',0,true);place('crank',28,39.2,S,'キャットウォーク',3.5,true);place('crank_wait',35,36.4,W,'観測室',3.5);
place('detector',26.4,30.6,N,'低温実験室');place('detector_wait',24.6,23.6,N,'職員廊下');place('breakroom',40.2,27,E,'休憩室');

const loop=1800;
type Slot={from:number;to:number;place:string;do:string};
const plan=(...steps:[number,string,string][]):{plan:Slot[]}=>({plan:steps.map(([from,p,act],i)=>({from,to:steps[i+1]?.[0]??loop,place:p,do:act}))});
const actors:Record<string,unknown>={
 // The director: console, the donors in the lounge, his office, the dome in the lull, the lobby, back to the console.
 director:plan([0,'dir_console','work'],[200,'dir_lounge','chat'],[330,'dir_desk','phone'],[520,'dir_dome','work'],[660,'dir_console','work'],[900,'dir_lobby','chat'],[1040,'dir_desk','phone'],[1260,'dir_console','work'],[1500,'dir_lounge','chat'],[1680,'dir_console','work']),
 aide:{plan:[],follow:'director',offset:[1.2,.9]},
 tech:plan([0,'tech_plant','work'],[240,'tech_staff','drink'],[420,'tech_panel','work'],[600,'tech_plant','work'],[960,'tech_gen','work'],[1140,'tech_staff','drink'],[1380,'tech_panel','work'],[1560,'tech_plant','work']),
 researcher_a:plan([0,'ra_desk','work'],[300,'ra_weather','work'],[480,'ra_scope','work'],[700,'ra_desk','work'],[1100,'ra_weather','work'],[1300,'ra_desk','work']),
 researcher_b:plan([0,'rb_bench','work'],[260,'rb_console','work'],[440,'rb_staff','drink'],[620,'rb_bench','work'],[1000,'rb_console','work'],[1200,'rb_staff','drink'],[1400,'rb_bench','work']),
 cook:plan([0,'cook_counter','work'],[360,'cook_table','clean'],[480,'cook_counter','work'],[840,'cook_store','work'],[960,'cook_counter','work'],[1320,'cook_table','clean'],[1440,'cook_counter','work']),
 cleaner:plan([0,'cl_wc','clean'],[300,'cl_lobby','clean'],[600,'cl_hall','clean'],[900,'cl_store','clean'],[1200,'cl_wc','clean'],[1500,'cl_lobby','clean']),
 donor_a:plan([0,'da_sofa','chat'],[400,'da_orrery','idle'],[640,'da_wc','idle'],[760,'da_sofa','drink'],[1300,'da_orrery','idle'],[1520,'da_sofa','chat']),
 donor_b:plan([0,'db_sofa','chat'],[280,'db_stove','idle'],[520,'db_case','idle'],[800,'db_sofa','drink'],[1400,'db_stove','idle']),
 donor_c:plan([0,'dc_orrery','idle'],[220,'dc_front','phone'],[420,'dc_lens','idle'],[700,'dc_lounge','drink'],[1100,'dc_orrery','idle'],[1450,'dc_front','phone']),
 donor_d:plan([0,'dd_meteor','idle'],[340,'dd_counter','chat'],[560,'dd_lounge','drink'],[1000,'dd_meteor','idle'],[1380,'dd_lounge','chat']),
 donor_e:plan([0,'de_sofa','phone'],[380,'de_model','idle'],[600,'de_wc','idle'],[720,'de_sofa','idle'],[1240,'de_model','idle'],[1500,'de_sofa','phone']),
};

const layout={
 version:1,name:'星見岳天文台',ground:{minX:0,minZ:0,maxX:56,maxZ:44},spawn:{x:28,z:2},spawnHeading:0,
 rooms,walls,furniture,doors,
 openings:[{id:'front',axis:'z',at:28,k:10,width:2.4}],
 stairs:[{id:'S1',minX:36,minZ:25,maxX:38,maxZ:32,low:0,high:3.5,rise:'+z',floor:0}],
 traversals:[{id:'L1',a:'north',b:'catwalk',kind:'ladder',users:[],start:{x:34,y:0,z:40.7},via:[{x:34,y:3.5,z:40.7}],end:{x:34,y:3.5,z:39.3},facing:Math.PI}],
 traversalRules:{radius:.8,suspicionPerSecond:6},
 npcs,schedulePlaces:places,hides,markers:[],checkpoints:[],uniformGates:[],platforms:[],
 exits:[{id:'X1',label:'正門',x:28,z:1,floor:0,radius:1.1},{id:'X2',label:'西の登山道',x:1.4,z:14,floor:0,radius:1.1}],
 geometry:{floors:[{floor:1,y:3.5}],shafts:[]},
};
const out=(name:string,data:unknown)=>writeFileSync(new URL(`../src/data/${name}.json`,import.meta.url),JSON.stringify(data,null,1)+'\n');
out('observatory-layout',layout);
out('observatory-schedule',{actors});
console.log(JSON.stringify({rooms:rooms.length,walls:walls.length,furniture:furniture.length,doors:doors.length,npcs:npcs.length,places:Object.keys(places).length}));

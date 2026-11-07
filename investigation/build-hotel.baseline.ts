// Builds src/data/hotel.json, the M5 Grand Marina Hotel blocked out from the canvas floor plan ("ホテル平面計画" v0.3).
// Plan pixels map to metres at 10 px = 1 m around plan pixel (680, 430): x east, z toward the sea.
// Run: node --experimental-strip-types scripts/build-hotel.ts
import {readFileSync,writeFileSync} from 'node:fs';
type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
type Block={id:string;x:number;z:number;w:number;d:number;y:number;h:number;floor?:number};
const R=(minX:number,maxX:number,minZ:number,maxZ:number):Rect=>({minX,maxX,minZ,maxZ});
const round=(v:number)=>Math.round(v*1000)/1000;
// rect minus holes, as a list of non-overlapping rects
function subtract(r:Rect,holes:Rect[]):Rect[]{let parts=[r];for(const h of holes){const next:Rect[]=[];for(const p of parts){if(h.minX>=p.maxX||h.maxX<=p.minX||h.minZ>=p.maxZ||h.maxZ<=p.minZ){next.push(p);continue;}
 const mz0=Math.max(p.minZ,h.minZ),mz1=Math.min(p.maxZ,h.maxZ);if(h.minZ>p.minZ)next.push(R(p.minX,p.maxX,p.minZ,h.minZ));if(h.maxZ<p.maxZ)next.push(R(p.minX,p.maxX,h.maxZ,p.maxZ));
 if(h.minX>p.minX)next.push(R(p.minX,h.minX,mz0,mz1));if(h.maxX<p.maxX)next.push(R(h.maxX,p.maxX,mz0,mz1));}parts=next;}return parts;}
const FLOOR_Y:Record<number,number>={[-1]:-3.5,0:0,1:3.5,2:7};
const walls:Block[]=[],blockers:Block[]=[];let wallCount=0;
// A straight wall from a to b on one axis, leaving the door spans [from,to] (measured on that axis) open under a lintel.
function wall(id:string,floor:number,axis:'x'|'z',fixed:number,from:number,to:number,doors:number[][]=[],h=3,t=.2){const y=FLOOR_Y[floor];let at=from;
 const piece=(a:number,b:number,y0:number,hh:number)=>{if(b-a<.05)return;const mid=(a+b)/2,len=b-a;walls.push(axis==='x'?{id:`${id}-${++wallCount}`,x:round(mid),z:fixed,w:round(len),d:t,y:round(y0),h:round(hh),floor}:{id:`${id}-${++wallCount}`,x:fixed,z:round(mid),w:t,d:round(len),y:round(y0),h:round(hh),floor});};
 for(const [d0,d1] of [...doors].sort((a,b)=>a[0]-b[0])){piece(at,d0,y,h);if(h>2.4)piece(d0,d1,y+2.2,h-2.2);at=d1;}piece(at,to,y,h);}
type Doors={n?:number[][];s?:number[][];e?:number[][];w?:number[][]};
// Four walls around a room; a side set to null is left to the neighbouring room.
function room(id:string,r:Rect,floor:number,doors:Doors={},h=3,skip:('n'|'s'|'e'|'w')[]=[]){
 if(!skip.includes('n'))wall(id+'-n',floor,'x',r.minZ,r.minX,r.maxX,doors.n,h);if(!skip.includes('s'))wall(id+'-s',floor,'x',r.maxZ,r.minX,r.maxX,doors.s,h);
 if(!skip.includes('w'))wall(id+'-w',floor,'z',r.minX,r.minZ,r.maxZ,doors.w,h);if(!skip.includes('e'))wall(id+'-e',floor,'z',r.maxX,r.minZ,r.maxZ,doors.e,h);}
const block=(id:string,x:number,z:number,w:number,d:number,h:number,floor=0,y=FLOOR_Y[floor])=>blockers.push({id,x,z,w,d,y,h,floor});

// ---- Rooms: indoor rooms get walls; their floors are drawn and they count as indoors for sight ranges.
type Room={id:string;label:string;floor:number;surface:string;indoor:boolean}&Rect;
const rooms:Room[]=[];const addRoom=(id:string,label:string,floor:number,r:Rect,surface:string,indoor=true)=>{rooms.push({id,label,floor,surface,indoor,...r});return r;};
const kitchen=addRoom('kitchen','厨房',0,R(-36,-12,-19.2,-3.2),'tile');
const laundry=addRoom('laundry','ランドリー',0,R(-36,-25,-1.6,10.4),'tile');
const service=addRoom('service','裏通路',0,R(-23.4,-12,-1.6,18.4),'service');
const lobby=addRoom('lobby','ロビー',0,R(-10,14,-19.2,-1.2),'marble');
const bar=addRoom('bar','バー',0,R(15.6,31.6,-19.2,-1.2),'wood');
const security=addRoom('security','警備室',0,R(33.2,44,-19.2,-7.2),'service');
const harbor=addRoom('harbor','港湾事務所',0,R(-30,-12,24.6,31),'service');
const barBack=addRoom('beachbar_back','バーの裏',0,R(47.6,60,-7.4,-2.6),'wood');
const banquet=addRoom('banquet','宴会場',1,R(-36,-4.4,-19.2,-3.2),'carpet');
const catwalk=addRoom('catwalk','照明通路',1,R(-36,-4.4,-3.2,3.8),'service');
const corridor=addRoom('corridor','客室廊下',1,R(-4.4,10.6,-19.2,3.8),'carpet');
const suite=addRoom('suite_b','Bの客室',1,R(10.6,24,-19.2,-7.2),'carpet');
const penthouse=addRoom('penthouse','ペントハウス',2,R(-36,-4.4,-19.2,-4.2),'carpet');
const balcony=addRoom('balcony','バルコニー',2,R(-36,-4.4,-4.2,3.8),'wood',false);
const heliport=addRoom('heliport','ヘリポート',2,R(-4.4,24,-19.2,3.8),'paving',false);
const cellar=addRoom('cellar','地下セラー',-1,R(15.6,31.6,-19.2,-1.2),'stone');
// Outdoor floor areas with their own look (not walled).
addRoom('beachbar','ビーチバー',0,R(47.6,60,-17,-8),'wood',false);
addRoom('quay','海沿いの遊歩道',0,R(-38,51,19.6,25),'paving',false);
addRoom('boardwalk','桟橋・マリーナ',0,R(-12,51,25,29),'wood',false);

room('kitchen',kitchen,0,{w:[[-13,-11]],s:[[-31,-29],[-21,-19]],e:[[-11,-9]]});
room('laundry',laundry,0,{n:[[-31,-29]],e:[[3,5]]});
room('service',service,0,{n:[[-21,-19]],w:[[3,5]],e:[[11,13]],s:[[-19,-17]]});
room('lobby',lobby,0,{n:[[0,4]],s:[[0,3]],w:[[-11,-9]],e:[[-11,-9]]});
room('bar',bar,0,{w:[[-11,-9]],s:[[20,23]],n:[[22,24]]});
room('security',security,0,{w:[[-11,-9]],s:[[38,40]]});
room('harbor',harbor,0,{n:[[-22,-20]],e:[[27,29]]});
room('beachbar_back',barBack,0,{n:[[52,54]]},2.6);
room('banquet',banquet,1,{s:[[-14,-12]],e:[[-12,-10]]});
room('catwalk',catwalk,1,{e:[[0,2]]},3,['n']);
room('corridor',corridor,1,{e:[[-14,-12]]},3,['w']);
room('suite_b',suite,1,{},3,['w']);
room('penthouse',penthouse,2,{s:[[-20,-18]],e:[[-12,-10]]});
// Roof parapets
wall('balcony-rail',2,'z',-36,-4.2,3.8,[],1.1,.15);wall('balcony-rail',2,'x',3.8,-36,-4.4,[],1.1,.15);wall('balcony-rail',2,'z',-4.4,-4.2,3.8,[],1.1,.15);
wall('heliport-rail',2,'x',-19.2,-4.4,24,[],1.1,.15);wall('heliport-rail',2,'z',24,-19.2,3.8,[],1.1,.15);wall('heliport-rail',2,'x',3.8,-4.4,24,[],1.1,.15);
room('cellar',cellar,-1,{},3.5);
// The boardwalk is only reached through the harbour office: a railing along the quay edge.
wall('quay-rail',0,'x',25,-12,51,[],1.1,.12);

// ---- Stairs (ramps) with side rails so they are entered only from their ends.
type Stair=Rect&{id:string;low:number;high:number;rise:'+x'|'-x'|'+z'|'-z';floor:number};
const stairs:Stair[]=[
 {id:'stairs-grand',...R(6,10,-12,-4),low:0,high:3.5,rise:'-z',floor:0},
 {id:'stairs-service',...R(-16,-13,-1,7),low:0,high:3.5,rise:'-z',floor:0},
 {id:'stairs-roof',...R(0,3,-5.5,2.5),low:3.5,high:7,rise:'-z',floor:1},
 {id:'stairs-cellar',...R(27,30,-12,-4),low:-3.5,high:0,rise:'+z',floor:-1},
];
for(const s of stairs){const f=s.low<0?0:s.floor;wall(s.id+'-rail',f,'z',s.minX-.05,s.minZ,s.maxZ,[],1.1,.1);wall(s.id+'-rail',f,'z',s.maxX+.05,s.minZ,s.maxZ,[],1.1,.1);}
wall('stairs-cellar-rail',0,'x',-12.05,27,30,[],1.1,.1);
const hole=(id:string)=>stairs.find(s=>s.id===id)!;
const floors=[
 {floor:-1,y:-3.5,areas:subtract(cellar,[hole('stairs-cellar')])},
 {floor:1,y:3.5,areas:[banquet,catwalk,corridor,suite].flatMap(r=>subtract(r,[hole('stairs-grand'),hole('stairs-service')]))},
 {floor:2,y:7,areas:[penthouse,balcony,heliport].flatMap(r=>subtract(r,[hole('stairs-roof')]))},
];

// ---- Ground, sea and pool.
const ground=R(-66,63,-37.4,37);
// The yacht deck and gangway are at quay height so scheduled visitors can board.
const yachtDeck=R(18,38,30.6,36.6),yachtGangway=R(27,29,28.8,31);
const water=[R(-66,-38,22.4,37),R(-38,-30,25,37),R(-30,-12,31,37),R(-12,51,29,37),R(51,63,21,37)].flatMap(r=>subtract(r,[yachtDeck,yachtGangway]));
addRoom('yacht_deck','展示ヨットの甲板',0,yachtDeck,'wood',false);addRoom('yacht_gangway','ヨットの渡り板',0,yachtGangway,'wood',false);
water.forEach((w,i)=>blockers.push({id:`water-${i+1}`,x:(w.minX+w.maxX)/2,z:(w.minZ+w.maxZ)/2,w:w.maxX-w.minX,d:w.maxZ-w.minZ,y:-1.2,h:2.2,floor:0}));
const pool=R(-4,8,5,13);blockers.push({id:'pool',x:2,z:9,w:12,d:8,y:-1,h:2,floor:0});

// ---- Props that block walking and sight (cover for later fights).
for(let i=0;i<8;i++){block(`car-p1-${i}`,-60+i*6,-33,1.9,4.4,1.4);if(i%3!==1)block(`car-p2-${i}`,-57+i*6,-26.5,1.9,4.4,1.4);}
block('car-drive-1',9,-28,4.4,1.9,1.4);block('car-drive-2',-4,-34.5,4.4,1.9,1.4);
block('truck-dock',-50,-15.5,2.6,7,3.2);for(const [i,x,z] of [[1,-42,-19],[2,-40.6,-19],[3,-42,-3],[4,-55,4],[5,-55,5.4]])block(`crate-dock-${i}`,x,z,1.2,1.2,1.2);
block('counter-k1',-24,-11,8,1.2,1);block('counter-k2',-24,-15.5,8,1.2,1);block('stove-k',-33,-18.4,4,1,1);
block('machine-laundry',-30,9.6,7,1,1.3);block('rack-uniform',-34.8,6,1,1.6,1.8);
block('counter-reception',-4,-16.5,6,1,1.1);block('sofa-l1',-4,-8,3,1,.8);block('sofa-l2',2,-8,3,1,.8);block('planter-lobby',12.6,-17.6,1.2,1.2,.9);
block('counter-bar',19,-12,1,9,1.1);block('shelf-bar',16.2,-12,.5,9,2.2);for(const [i,x,z] of [[1,25,-16],[2,25,-8],[3,30,-15.5]])block(`table-bar-${i}`,x,z,1.1,1.1,.75);
block('desk-monitors',38.6,-18.2,6,.9,1.1);block('desk-recorder',43.4,-14,.8,2,1.1);
block('powerpanel',-23.14,14,.32,.9,1.7);
for(const [i,x,z] of [[1,-8,3],[2,12,3],[3,-8,16],[4,12,16]])block(`planter-pool-${i}`,x,z,1.2,1.2,1);
for(let i=0;i<4;i++)for(let j=0;j<2;j++)block(`table-terrace-${i}-${j}`,20+i*6,6+j*6,1.2,1.2,.75);
block('backdrop-photo',42.5,9,.3,5,2.4);for(const [i,x,z] of [[1,17,-24],[2,26,-30],[3,35,-24],[4,41,-32]])block(`planter-garden-${i}`,x,z,3,1.2,1);
block('counter-beachbar',54,-11.5,8,1,1.1);block('tower-beach',53,14,2.6,2.6,4);block('hut-beach',61.4,4,2.4,3,2.4);
block('desk-harbor',-22,29.6,5,.9,1);for(const [i,x] of [[1,-4],[2,8],[3,22],[4,34]])block(`crate-pier-${i}`,x,28.2,1.2,1.2,1.2);
block('tank-fuel',47.5,27,2,2,2.2);block('crate-sommelier-screen',40,25.35,4,.5,2.1);block('yacht-hull',28,33.6,20,6,.8,0,-.8);
for(let i=0;i<3;i++)for(let j=0;j<2;j++)block(`table-banquet-${i}-${j}`,-31+i*8,-14+j*6,1.8,1.8,.75,1);
block('stage-banquet',-20,-18.4,8,1.2,.5,1);block('cart-cleaning',6,-17,1,1.6,1.1,1);
block('desk-penthouse',-30,-17,3,1,.8,2);block('bed-penthouse',-12,-16,2.2,2.4,.6,2);block('massage-table',-26,-8,2,.8,.8,2);block('stairhouse-roof',1.5,-6.6,3.4,2,2.6,2);
for(const [i,x,z] of [[1,18,-17],[2,24,-17],[3,18,-3],[4,30,-3]])block(`barrel-cellar-${i}`,x,z,1.2,1.2,1.2,-1);block('rack-wine',24,-10,1,10,2.2,-1);block('table-tasting',20,-9,2,1,.8,-1);

// ---- Hiding places (all use the locker model for now).
type Hide={id:string;label:string;x:number;y:number;z:number;heading:number;capacity:number;approach:{x:number;z:number};size:{w:number;h:number;d:number}};
const hides:Hide[]=[];
const face:Record<string,{heading:number;approach:{x:number;z:number};size:{w:number;h:number;d:number}}>={
 east:{heading:Math.PI/2,approach:{x:1.1,z:0},size:{w:.65,h:2,d:.9}},west:{heading:-Math.PI/2,approach:{x:-1.1,z:0},size:{w:.65,h:2,d:.9}},
 south:{heading:0,approach:{x:0,z:1.1},size:{w:.9,h:2,d:.65}},north:{heading:Math.PI,approach:{x:0,z:-1.1},size:{w:.9,h:2,d:.65}}};
const hide=(id:string,label:string,x:number,z:number,dir:keyof typeof face,floor=0)=>{const f=face[dir];hides.push({id:'locker-'+id,label,x,y:FLOOR_Y[floor],z,heading:f.heading,capacity:1,approach:f.approach,size:f.size});block('locker-'+id,x,z,f.size.w,f.size.d,f.size.h,floor);};
hide('service','裏通路ロッカー',-22.95,6,'east');hide('laundry','リネンカート',-35.55,2,'east');hide('freezer','厨房の冷凍庫',-35.55,-14,'east');
hide('dumpster','搬入口の大型ゴミ箱',-40.5,-6,'south');hide('lobby','ロビーの花瓶台',-9.55,-17.5,'east');hide('bar','バーの倉庫',31.15,-17,'west');
hide('security','警備室ロッカー',43.55,-10,'west');hide('pool','プールのタオル棚',-10.5,10,'east');hide('terrace','テラスのプランター',44.5,16,'west');
hide('beach','浜辺の更衣小屋',59.5,8,'west');hide('beachbar','バーの裏の箱',59.55,-5,'west');hide('harbor','港湾事務所の物入れ',-29.55,28,'east');
hide('marina','マリーナの木箱',45,28.55,'north');hide('parking','車のトランク',-36,-29.6,'south');hide('corridor','清掃カート',10.15,-2,'west',1);hide('banquet','宴会場の花瓶台',-35.55,-6,'east',1);hide('penthouse','ペントハウスの物入れ',-26,-4.8,'north',2);

// ---- Sections (about 22 in the plan; here 20 ground areas, each spanning all floors above and below).
const sec=(id:string,label:string,r:Rect,surface:string,outdoor:boolean)=>({id,label,...r,surface,outdoor});
const sections=[
 sec('parking','駐車場',R(-66,-14,-37.4,-21),'asphalt',true),sec('front_drive','正面車寄せ',R(-14,20,-37.4,-21),'paving',true),sec('garden','庭',R(20,46,-37.4,-21),'grass',true),sec('beach_north','浜辺北',R(46,63,-37.4,-21),'sand',true),
 sec('loading_dock','搬入口',R(-66,-37,-21,-1.4),'asphalt',true),sec('kitchen','厨房',R(-37,-11,-21,-1.4),'paving',false),sec('lobby','ロビー',R(-11,15,-21,-1.4),'paving',false),sec('bar','バー',R(15,32,-21,-1.4),'paving',false),
 sec('security','警備室',R(32,46,-21,-1.4),'paving',false),sec('beach_bar','ビーチバー',R(46,63,-21,-1.4),'sand',true),
 sec('west_yard','裏庭',R(-66,-37,-1.4,19.6),'asphalt',true),sec('laundry','ランドリー',R(-37,-24.2,-1.4,19.6),'paving',false),sec('service','裏通路',R(-24.2,-11,-1.4,19.6),'paving',false),
 sec('pool','プール',R(-11,15,-1.4,19.6),'poolstone',true),sec('terrace','テラス',R(15,46,-1.4,19.6),'wood',true),sec('beach_south','浜辺南',R(46,63,-1.4,19.6),'sand',true),
 sec('promenade','遊歩道西',R(-66,-11,19.6,37),'paving',true),sec('pier','桟橋',R(-11,15,19.6,37),'paving',true),sec('marina','マリーナ',R(15,41,19.6,37),'paving',true),sec('fuel_dock','燃料所',R(41,63,19.6,37),'paving',true),
];

// ---- Zones: the first match wins, so specific rooms come before the areas around them.
const zone=(id:string,label:string,floor:number,type:string,r:Rect)=>({id,label,floor,type,...r});
const zones=[
 zone('ZONE_staff_beachbar_back','バーの裏',0,'staff',barBack),zone('ZONE_staff_harbor','港湾事務所',0,'staff',harbor),
 zone('ZONE_staff_kitchen','厨房',0,'staff',kitchen),zone('ZONE_staff_laundry','ランドリー',0,'staff',laundry),zone('ZONE_staff_service','裏通路',0,'staff',service),
 zone('ZONE_public_lobby','ロビー',0,'public',lobby),zone('ZONE_public_bar','バー',0,'public',bar),zone('ZONE_staff_security','警備室',0,'staff',security),
 zone('ZONE_public_pool','プール',0,'public',R(-11,15,-1.2,19.6)),zone('ZONE_public_terrace','テラス',0,'public',R(15,46,-1.2,19.6)),
 zone('ZONE_outer_parking','駐車場',0,'outer',R(-66,-14,-37.4,-21)),zone('ZONE_public_drive','正面車寄せ',0,'public',R(-14,20,-37.4,-21)),zone('ZONE_public_garden','庭',0,'public',R(20,46,-37.4,-21)),
 zone('ZONE_outer_dock','搬入口',0,'outer',R(-66,-37,-21,19.6)),zone('ZONE_public_beach','浜辺',0,'public',R(46,63,-37.4,21)),
 zone('ZONE_outer_marina','桟橋・マリーナ',0,'outer',R(-12,51,25,37)),zone('ZONE_public_promenade','海沿いの遊歩道',0,'public',R(-38,51,19.6,25)),
 zone('ZONE_staff_cellar','地下セラー',-1,'staff',cellar),
 zone('ZONE_public_banquet','宴会場',1,'public',banquet),zone('ZONE_staff_catwalk','照明通路',1,'staff',catwalk),zone('ZONE_public_corridor','客室廊下',1,'public',corridor),zone('ZONE_secure_suite','Bの客室',1,'secure',suite),
 zone('ZONE_secure_penthouse','ペントハウス',2,'secure',penthouse),zone('ZONE_secure_balcony','バルコニー',2,'secure',balcony),zone('ZONE_outer_heliport','ヘリポート',2,'outer',heliport),
];

// ---- Points: exits, spawns, reinforcements, checkpoints, cameras.
const exits=[{id:'E1',label:'正面ゲート',x:-14,z:-35.6,floor:0,radius:1.8},{id:'E2',label:'搬入トラック',x:-46.4,z:-15.5,floor:0,radius:1.8},{id:'E3',label:'避難ボート',x:2,z:28,floor:0,radius:1.6},
 {id:'E4',label:'ヘリコプター',x:14,z:-8,floor:2,radius:2.2},{id:'E5',label:'浜辺の小舟',x:58,z:19.4,floor:0,radius:1.8}];
const spawns=[{id:'S1',label:'正面車寄せ',x:14.8,z:-30},{id:'S2',label:'搬入口',x:-44,z:-9},{id:'S3',label:'桟橋',x:-7,z:27}];
const reinforcements=[{id:'REINF_parking',x:-20,z:-36},{id:'REINF_dock',x:-48.4,z:-6}];
const checkpoints=[{id:'check-lobby',label:'大階段の身体検査',x:8,y:0,z:-3.4,normal:{x:0,z:1},width:4,zone:'public',guardId:'guard_check_lobby'},
 {id:'check-marina',label:'マリーナ入口の身体検査',x:-12.6,y:0,z:28,normal:{x:-1,z:0},width:2,zone:'outer',guardId:'guard_check_marina'}];
const cam=(id:string,label:string,x:number,z:number,floor:number,lx:number,lz:number)=>({id:'CAM_'+id,label,x,y:round(FLOOR_Y[floor]+2.7),z,floor,heading:round(Math.atan2(lx-x,lz-z)),fov:70,range:12});
const cameras=[cam('lobby','ロビー',-9.5,-18.6,0,2,-10),cam('bar','バー',31,-18.6,0,22,-10),cam('parking','駐車場',-38,-36.6,0,-40,-26),cam('dock','搬入口',-40,-20.6,0,-48,-12),cam('marina','マリーナ',14,25.4,0,24,27),
 cam('banquet','宴会場',-6,-18.6,1,-20,-10),cam('heliport','ヘリポート',-3.8,-18.6,2,10,-8),cam('penthouse','ペントハウス',-35.4,-18.6,2,-20,-10)];
const palms=[[-10.5,-23],[16,-23],[-12.5,1],[14,1],[-12,18],[14.5,18.4],[45,-22],[48,0],[62,-30],[62,-14],[45,19],[-37,20],[30,21],[-60,-22],[-25,21.5]];
const labels=[...rooms.map(r=>({text:r.label,x:(r.minX+r.maxX)/2,y:FLOOR_Y[r.floor]+.1,z:(r.minZ+r.maxZ)/2,floor:r.floor})),
 ...sections.filter(s=>s.outdoor).map(s=>({text:s.label,x:(s.minX+s.maxX)/2,y:.1,z:(s.minZ+s.maxZ)/2,floor:0})),
 ...stairs.map(s=>({text:s.low<0?'STAIRS ↓ B1':s.low>0?'STAIRS ↑ RF':'STAIRS ↑ 2F',x:(s.minX+s.maxX)/2,y:FLOOR_Y[s.floor<0?0:s.floor]+.1,z:s.rise==='-z'?s.maxZ+.8:s.maxZ+.8,floor:s.floor<0?0:s.floor}))];

// ---- People: about 120. Routes are [x, z, wait seconds, facing degrees]; a single point stands still facing `look`.
let seed=20261029;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const solid=(floor:number)=>[...walls,...blockers].filter(b=>((b.floor??0)===floor||b.id.startsWith('water')||b.id==='pool')&&b.y+b.h>FLOOR_Y[floor]+.27);
const free=(x:number,z:number,floor:number,m=.55)=>inside(ground,x,z,m)&&!stairs.some(s=>inside(s,x,z,-.4))&&!solid(floor).some(b=>x>b.x-b.w/2-m&&x<b.x+b.w/2+m&&z>b.z-b.d/2-m&&z<b.z+b.d/2+m)&&(floor===0||floors.find(f=>f.floor===floor)!.areas.some(a=>inside(a,x,z,m)));
function inside(r:Rect,x:number,z:number,m=0){return x>=r.minX+m&&x<=r.maxX-m&&z>=r.minZ+m&&z<=r.maxZ-m;}
const pick=(r:Rect,floor:number,m=1)=>{for(let i=0;i<400;i++){const x=r.minX+m+rnd()*(r.maxX-r.minX-2*m),z=r.minZ+m+rnd()*(r.maxZ-r.minZ-2*m);if(free(x,z,floor))return [round(x),round(z)];}throw new Error('no free point in '+JSON.stringify(r));};
type Npc={id:string;role:string;label:string;floor:number;model:string;route:number[][];look?:number[];knowsFaces?:string[];post?:string|string[];target?:boolean;outfit?:string};
const npcs:Npc[]=[];
const at=(x:number,z:number,floor:number)=>{if(!free(x,z,floor,.35))throw new Error(`blocked spot ${x},${z} on ${floor}`);return [x,z];};
function stand(id:string,role:string,label:string,model:string,floor:number,x:number,z:number,lx:number,lz:number,extra:Partial<Npc>={}){npcs.push({id,role,label,floor,model,route:[[...at(x,z,floor),0]],look:[lx,lz],...extra});}
function patrol(id:string,role:string,label:string,model:string,floor:number,r:Rect,points=4,extra:Partial<Npc>={}){const route:number[][]=[];
 // Corners of the area in order, so the loop walks its edge instead of zig-zagging.
 const corners=[[r.minX+1,r.minZ+1],[r.maxX-1,r.minZ+1],[r.maxX-1,r.maxZ-1],[r.minX+1,r.maxZ-1]];
 for(let i=0;i<points;i++){let [x,z]=corners[i%4];for(let k=0;k<60&&!free(x,z,floor);k++){x+=(rnd()-.5)*2;z+=(rnd()-.5)*2;x=Math.min(r.maxX-.8,Math.max(r.minX+.8,x));z=Math.min(r.maxZ-.8,Math.max(r.minZ+.8,z));}if(!free(x,z,floor))continue;route.push([round(x),round(z),round(1+rnd()*2.5)]);}
 if(route.length<2)throw new Error('patrol '+id);npcs.push({id,role,label,floor,model,route,...extra});}
function group(prefix:string,role:string,label:string,models:string[],floor:number,cx:number,cz:number,n:number,radius=1.1){for(let i=0;i<n;i++){const a=i/n*Math.PI*2+rnd()*.3;let x=round(cx+Math.sin(a)*radius),z=round(cz+Math.cos(a)*radius);if(!free(x,z,floor,.35))continue;npcs.push({id:`${prefix}_${i+1}`,role,label,floor,model:models[Math.floor(rnd()*models.length)],route:[[x,z,0]],look:[cx,cz]});}}
const SUIT=['guest_suit','guest_dress'],SWIM=['pool_guest_swimsuit','pool_guest_swimshorts','pool_guest_resort','pool_guest_slim','pool_guest_lean'];

// Targets
stand('wine_merchant','guest','A ワイン商','wine_merchant',0,22.5,-14,19.6,-14,{target:true});
stand('lawyer','guest','B 元顧問弁護士','lawyer',0,-2,-11,-2,-14,{target:true,knowsFaces:['bodyguard']});
stand('investor','guest','C 若き投資家','investor',2,-28,-15.5,-30,-17,{target:true});
// The twelve people who know faces (canvas "M5 見つかる仕組み" table). Outfits not yet wearable (harbor, beachbar) arrive in 5.7.
stand('head_waiter','waiter','給仕長','waiter',0,26,-5,22,-10,{knowsFaces:['waiter','sommelier'],post:['ZONE_public_bar','ZONE_public_banquet'],outfit:'waiter'});
stand('bartender','waiter','バーテンダー','waiter',0,17.4,-10,19,-10,{knowsFaces:['waiter'],post:'ZONE_public_bar',outfit:'waiter'});
patrol('head_chef','waiter','料理長','waiter',0,R(-34,-14,-17,-5),3,{knowsFaces:['chef'],post:'ZONE_staff_kitchen',outfit:'chef'});
stand('sous_chef','waiter','副料理長','waiter',0,-20,-13.2,-20,-11,{knowsFaces:['chef'],post:'ZONE_staff_kitchen',outfit:'chef'});
patrol('head_cleaner','waiter','清掃主任','waiter',0,R(-23,-12.5,8,18),3,{knowsFaces:['cleaner'],post:'ZONE_staff_service',outfit:'cleaner'});
stand('security_chief','guard','警備主任','guard',0,11.5,-6,8,-3.4,{knowsFaces:['guard'],post:'ZONE_public_lobby'});
stand('monitor_watcher','guard','警備室の監視員','guard',0,38.6,-16.8,38.6,-19,{knowsFaces:['guard'],post:'ZONE_staff_security'});
stand('bodyguard_captain','guard','護衛隊長','guard',0,-3.2,-9.6,-2,-11,{knowsFaces:['bodyguard'],post:'ZONE_public_lobby',outfit:'bodyguard'});
stand('dock_clerk','waiter','搬入係','waiter',0,-44,-20,-48,-14,{knowsFaces:['delivery'],post:'ZONE_outer_dock',outfit:'delivery'});
stand('harbor_master','waiter','港湾事務所の所長','waiter',0,-22,28.4,-22,26,{knowsFaces:['fisher'],post:['ZONE_staff_harbor','ZONE_outer_marina'],outfit:'fisher'});
stand('beachbar_manager','waiter','ビーチバーの店長','waiter',0,54,-13,54,-10,{knowsFaces:['beachbar'],post:'ZONE_public_beach'});
// Guards
stand('guard_check_lobby','guard','大階段の検問','guard',0,11,-2.6,8,-3.4);
stand('guard_check_marina','guard','マリーナの検問','guard',0,-14,26,-12.6,28);
for(const [i,x,z] of [[1,-0.8,-12],[2,-1.2,-9.2]] as const)stand(`bodyguard_${i}`,'guard','私設護衛','guard',0,x,z,-2,-11,{outfit:'bodyguard'});
const guardAreas:[string,string,number,Rect][]=[['parking','駐車場の警備員',0,R(-62,-18,-36,-22)],['front','車寄せの警備員',0,R(-12,18,-36.5,-22)],['garden','庭の警備員',0,R(21,45,-36,-22)],
 ['dock','搬入口の警備員',0,R(-64,-38,-20,-2)],['yard','裏庭の警備員',0,R(-64,-38,0,18)],['pool','プールの警備員',0,R(-10.5,14.5,-.8,19)],['terrace','テラスの警備員',0,R(16,45,0,18.8)],
 ['beach_n','浜辺の警備員',0,R(46.5,62.5,-36,-19)],['beach_s','浜辺の警備員',0,R(46.5,62.5,0,20.5)],['promenade','遊歩道の警備員',0,R(-36,44,20,24.4)],['boardwalk','桟橋の警備員',0,R(-11,50,25.6,28.4)],
 ['corridor','客室廊下の警備員',1,R(-3.8,10,-18.6,3)],['banquet','宴会場の警備員',1,R(-35,-5,-18.5,-4)],['heliport','屋上の警備員',2,R(-3,23,-18.5,3)],['penthouse','ペントハウスの護衛',2,R(-35,-5.5,-18.5,-5)]];
for(const [id,label,floor,r] of guardAreas)patrol('guard_'+id,'guard',label,'guard',floor,r,4);
// Staff
patrol('cook_1','waiter','料理人','waiter',0,R(-34,-14,-17,-6),3,{outfit:'chef'});stand('cook_2','waiter','料理人','waiter',0,-28,-13.2,-28,-11,{outfit:'chef'});stand('cook_3','waiter','料理人','waiter',0,-33,-17.2,-33,-18.4,{outfit:'chef'});
patrol('cleaner_1','waiter','清掃員','waiter',1,R(-3.6,9.8,-18,2.6),3,{outfit:'cleaner'});patrol('cleaner_2','waiter','清掃員','waiter',0,R(-9,13,-18,-2),3,{outfit:'cleaner'});
patrol('mover_1','waiter','搬入業者','waiter',0,R(-48,-38,-20,-6),3,{outfit:'delivery'});stand('mover_2','waiter','搬入業者','waiter',0,-46,-19,-50,-15.5,{outfit:'delivery'});
patrol('harbor_1','waiter','港湾係','waiter',0,R(-10,49,25.6,28.4),3,{outfit:'fisher'});stand('harbor_2','waiter','港湾係','waiter',0,46,27,47.5,27,{outfit:'fisher'});
stand('beachbar_1','waiter','ビーチバー店員','waiter',0,52,-13,52,-11.5,{outfit:'beachbar'});stand('beachbar_2','waiter','ビーチバー店員','waiter',0,56,-13,56,-11.5,{outfit:'beachbar'});
for(const [i,r] of [[1,R(-9,13,1,4)],[2,R(-9,-5,4,17)],[3,R(16,44,1,4)],[4,R(16,44,15,18)]] as const)patrol(`waiter_${i}`,'waiter','ウェイター','waiter',0,r,3,{outfit:'waiter'});
for(const [i,r] of [[5,R(-35,-6,-11,-9)],[6,R(-35,-6,-5,-4)]] as const)patrol(`waiter_${i}`,'waiter','ウェイター','waiter',1,r,3,{outfit:'waiter'});
stand('receptionist','waiter','受付係','waiter',0,-4,-17.6,-4,-14);stand('photographer','waiter','カメラマン','waiter',0,40,9,42.5,9,{outfit:'photographer'});
stand('driver_1','waiter','運転手','waiter',0,-30,-23.4,-30,-26.5,{outfit:'driver'});stand('driver_2','waiter','運転手','waiter',0,11.6,-27,9,-28,{outfit:'driver'});
patrol('laundry_1','waiter','ランドリー係','waiter',0,R(-35,-26,0,8),3,{outfit:'cleaner'});stand('laundry_2','waiter','ランドリー係','waiter',0,-30,8.4,-30,9.6,{outfit:'cleaner'});
stand('sommelier','waiter','ソムリエ','waiter',-1,21,-7.6,20,-9,{outfit:'sommelier'});stand('masseuse','waiter','マッサージ師','waiter',2,-26,-6.8,-26,-8,{outfit:'masseuse'});
stand('pilot','waiter','パイロット','waiter',2,14,-11,14,-8,{outfit:'pilot'});stand('room_service','waiter','ルームサービス係','waiter',1,9,-15,6,-17,{outfit:'waiter'});
stand('bodyguard_relief','guard','交代の私設護衛','guard',0,36,-10,38,-10,{outfit:'bodyguard'});
// Guests in conversation groups (crowds hide a face beyond 2 m) and a few strollers.
group('guest_lobby_a','guest','招待客',SUIT,0,-6,-5,4);group('guest_lobby_b','guest','招待客',SUIT,0,8,-16,4);
group('guest_bar_a','guest','招待客',SUIT,0,24,-12,4);group('guest_bar_b','guest','招待客',SUIT,0,27,-6,4);
group('guest_pool_a','guest','招待客',SWIM,0,-7,8,3);group('guest_pool_b','guest','招待客',SWIM,0,10.5,9,3);group('guest_pool_c','guest','招待客',SWIM,0,2,16,4);
group('guest_terrace_a','guest','招待客',SUIT,0,23,9,4);group('guest_terrace_b','guest','招待客',SUIT,0,35,9,4);group('guest_terrace_c','guest','招待客',SUIT,0,29,15,3);
group('guest_banquet_a','guest','招待客',SUIT,1,-27,-11,4);group('guest_banquet_b','guest','招待客',SUIT,1,-15,-11,4);
group('guest_beach_a','guest','招待客',SWIM,0,52,-26,4);group('guest_beach_b','guest','招待客',SWIM,0,54,5,4);
for(const [i,r] of [[1,R(21,45,-36,-22)],[2,R(-36,44,20,24.4)],[3,R(47,62,-30,-20)],[4,R(-10,14,1,4)],[5,R(16,44,1,18)],[6,R(-35,-6,-17,-5)]] as const)patrol(`guest_stroll_${i}`,'guest','招待客',i===3?SWIM[i%5]:SUIT[i%2],i===6?1:0,r,3);
// Fill to about 120 with more guests at the beach and terrace.
let extra=0;while(npcs.length<120){const spots:[number,number,number][]=[[50,-30,0],[58,-24,0],[55,12,0],[18,16,0],[41,3,0],[-2,-6,0],[-30,-15,1]];const [cx,cz,f]=spots[extra%spots.length];const [x,z]=pick(R(cx-2.5,cx+2.5,cz-2.5,cz+2.5),f,.4);npcs.push({id:`guest_extra_${++extra}`,role:'guest',label:'招待客',floor:f,model:(cx>45?SWIM:SUIT)[Math.floor(rnd()*5)%(cx>45?5:2)],route:[[x,z,0]],look:[cx,cz]});}
// Staff wear the uniform of the disguise their clothes give (rules.json m4.uniformModels), so a chef looks like a chef.
{const uniforms=(JSON.parse(readFileSync(new URL('../src/data/rules.json',import.meta.url),'utf8')) as {m4:{uniformModels:Record<string,string>}}).m4.uniformModels;for(const n of npcs)if(n.outfit&&uniforms[n.outfit])n.model=uniforms[n.outfit];}

// M5.2 named destinations. Positions, including conversation partners, are generated here.
const schedulePlaces:Record<string,{x:number;y:number;z:number;label:string;outdoor:boolean;heading:number}>={};
function place(id:string,label:string,x:number,z:number,floor=0,outdoor=false,heading=0){at(x,z,floor);schedulePlaces[id]={x,y:FLOOR_Y[floor],z,label,outdoor,heading};}
place('bar_counter','バー',22.5,-14);place('terrace_rail','テラスの撮影場所',40,7,0,true);place('yacht_deck','展示ヨットの甲板',30,33.6,0,true);
place('pool_side','プールサイド',10.5,14,0,true);place('cellar_table','地下セラーの試飲会',21,-7.6,-1);place('lobby_greeting','ロビー',-2,-11);
place('banquet_stage','宴会場の演壇前',-20,-16.8,1);place('kitchen_tasting','厨房の試食場所',-17,-11);place('guard_change','Bの客室前',9,-13,1);
place('parking_car','駐車場の車',-30,-23.4,0,true);place('penthouse_desk','ペントハウス',-28,-15.5,2);place('balcony_phone','バルコニーの手すり際',-21,3.1,2,true);
place('massage_guest','マッサージ台の脇',-26,-6.8,2);place('beach_party','浜辺のパーティー',54,5,0,true);place('heli_wait','ヘリポート',14,-11,2,true);
place('sommelier_arrival','ソムリエの到着桟橋',40,27,0,true);place('massage_arrival','マッサージ師の搬入口',-44,-9,0,true);
place('bartender_work','バーのカウンター内',17.4,-10);place('bar_waiter','バーの給仕',20.6,-10);place('head_waiter_work','給仕長の持ち場',26,-5);
place('sommelier_bar','試飲会の準備',22,-5);place('sommelier_cellar','試飲会の給仕',18.4,-7.6,-1,false,Math.PI/2);
place('chef_work','料理長の調理場',-17,-12.8);place('sous_chef_work','副料理長の調理場',-20,-13.2);
place('loading_clerk','搬入口の受付',-44,-20,0,true);place('loading_worker','搬入口の搬入係',-46,-19,0,true);
place('cleaner_pool_1','プールの清掃',-8.6,12,0,true);place('cleaner_pool_2','プールの清掃',-7,13.5,0,true);
place('lobby_guard_1','ロビーの警備',11.5,-6);place('lobby_guard_2','ロビーの検問',12,-4.6);
place('room_service_work','客室の給仕',9,-15,1);place('room_service_partner','客室の給仕',7.5,-14,1);
place('security_radio','護衛の交代無線',36,-10);place('marina_watch','マリーナの見張り',1,27,0,true);
place('harbor_worker_1','ヨットの港湾係',31,26.6,0,true);place('harbor_worker_2','ヨットの港湾係',32.5,27,0,true);
place('driver_wait_1','駐車場の運転手',-28,-23.4,0,true);place('driver_wait_2','駐車場の運転手',-26.5,-23.5,0,true);
place('beachbar_work_1','ビーチバー',52,-13,0,true);place('beachbar_work_2','ビーチバー',54,-13,0,true);
place('reception_work','受付',-4,-17.6);place('reception_partner','受付',-6,-17.6);
place('photo_work','カメラマン',40,9,0,true);place('massage_work','マッサージ師',-24.5,-6.8,2);place('pilot_work','ヘリの点検',16,-11,2,true);
place("ambient_1",'招待客の立ち話',-5.746,-3.93,0,false);
place("ambient_2",'招待客の立ち話',8.254,-14.93,0,false);
place("ambient_3",'招待客の立ち話',24.064,-10.902,0,false);
place("ambient_5",'招待客の立ち話',-6.954,9.099,0,true);
place("ambient_6",'招待客の立ち話',10.585,10.097,0,true);
place("ambient_7",'招待客の立ち話',2.155,17.089,0,true);
place("ambient_8",'招待客の立ち話',23.061,10.098,0,true);
place("ambient_9",'招待客の立ち話',35.083,10.097,0,true);
place("ambient_10",'招待客の立ち話',29.172,16.087,0,true);
place("ambient_11",'招待客の立ち話',-26.745,-9.93,1,false);
place("ambient_12",'招待客の立ち話',-14.883,-9.906,1,false);
place("ambient_13",'招待客の立ち話',52.201,-24.918,0,true);
place("ambient_14",'招待客の立ち話',54.315,6.054,0,true);
place("ambient_15",'招待客の立ち話',-5.746,-3.93,0,false);
place("ambient_16",'招待客の立ち話',8.254,-14.93,0,false);
place("ambient_17",'招待客の立ち話',24.064,-10.902,0,false);
place("ambient_19",'招待客の立ち話',-6.954,9.099,0,true);
place("ambient_20",'招待客の立ち話',10.585,10.097,0,true);
place("ambient_21",'招待客の立ち話',2.155,17.089,0,true);
place("ambient_22",'招待客の立ち話',23.061,10.098,0,true);
place("ambient_23",'招待客の立ち話',35.083,10.097,0,true);
place("ambient_24",'招待客の立ち話',29.172,16.087,0,true);
place("ambient_25",'招待客の立ち話',-26.745,-9.93,1,false);
place("ambient_26",'招待客の立ち話',-14.883,-9.906,1,false);
place("ambient_27",'招待客の立ち話',52.201,-24.918,0,true);
place("ambient_28",'招待客の立ち話',54.315,6.054,0,true);
place("ambient_29",'招待客の立ち話',-5.746,-3.93,0,false);
place("ambient_30",'招待客の立ち話',8.254,-14.93,0,false);
// Place the supporting cast together so their conversations have real speakers.
const starts:Record<string,string>={bartender:'bartender_work',waiter_1:'bar_waiter',head_waiter:'head_waiter_work',head_chef:'chef_work',sous_chef:'sous_chef_work',dock_clerk:'loading_clerk',mover_2:'loading_worker',cleaner_1:'cleaner_pool_1',cleaner_2:'cleaner_pool_2',security_chief:'lobby_guard_1',guard_check_lobby:'lobby_guard_2',room_service:'room_service_work',waiter_5:'room_service_partner',bodyguard_relief:'security_radio',guard_boardwalk:'marina_watch',harbor_1:'harbor_worker_1',harbor_2:'harbor_worker_2',driver_1:'driver_wait_1',driver_2:'driver_wait_2',beachbar_1:'beachbar_work_1',beachbar_2:'beachbar_work_2',receptionist:'reception_work',laundry_2:'reception_partner',photographer:'photo_work',sommelier:'sommelier_arrival',masseuse:'massage_arrival',pilot:'pilot_work'};
for(const [id,destination]of Object.entries(starts)){const n=npcs.find(n=>n.id===id);if(!n)throw new Error('unknown actor '+id);const p=schedulePlaces[destination];n.floor=Math.round(p.y/3.5);n.route=[[p.x,p.z,0]];}

const m53={
 barrel:{id:'wine_barrel',object:'barrel-cellar-3',position:{x:18,y:-3.5,z:-3},approach:{x:19.2,y:-3.5,z:-3},label:'限定ワインの樽'},
 glass:{position:{x:20,y:-3.5,z:-9},approach:{x:20,y:-3.5,z:-7.8},label:'試飲用の一杯'},
 arrivalBoat:{x:40,y:-.2,z:30.2},
 privatePlace:{x:29.8,y:-3.5,z:-16,label:'セラー奥の試飲室',outdoor:false,heading:Math.PI},
 cellar:{floor:-1,...cellar},
 pushEdges:[
  {id:'balcony_south',floor:2,axis:'x',fixed:3.8,from:-36,to:-4.4,outward:[0,1]},
  {id:'balcony_west',floor:2,axis:'z',fixed:-36,from:-4.2,to:3.8,outward:[-1,0]},
  {id:'heliport_east',floor:2,axis:'z',fixed:24,from:-19.2,to:3.8,outward:[1,0]},
  {id:'heliport_north',floor:2,axis:'x',fixed:-19.2,from:-4.4,to:24,outward:[0,-1]},
  {id:'heliport_south',floor:2,axis:'x',fixed:3.8,from:-4.4,to:24,outward:[0,1]},
  // M5.7 A4: the terrace's sea wall above the beach, where the photographer poses people.
  {id:'terrace_east',floor:0,axis:'z',fixed:46,from:-1.2,to:19.6,outward:[1,0]}
 ]
};
// M5.7: where the remaining chances happen. `at` is where the agent stands to do it; props are drawn by m57-view.ts.
const floorY=(f:number)=>FLOOR_Y[f],floorOf=(y:number)=>Number(Object.entries(FLOOR_Y).find(([,v])=>v===y)?.[0]??0);
const P=(x:number,z:number,floor=0)=>({x,y:floorY(floor),z});
const m57={
 acts:{
  pool_panel:{label:'配電盤をスパナで壊す',at:P(-22.4,14),seconds:3,tamper:true},
  pool_light:{label:'照明スタンドを水に倒す',at:P(8.6,13.9),seconds:1.5,allowedFor:["cleaner", "delivery", "fisher"]},
  photo_pose:{label:'手すり際に立ってもらう',seconds:2},
  crane_pin:{label:'クレーンの固定ピンを抜く',at:P(24,27.2),seconds:5,tamper:true},
  crane_panel:{label:'操作盤で荷を落とす',at:P(8,27.2),seconds:1,allowedFor:["fisher"]},
  chandelier_clamp:{label:'シャンデリアの留め具をスパナで緩める',at:P(-20,-2.4,1),seconds:4,tamper:true},
  chandelier_release:{label:'留め具を外す',at:P(-20,-2.4,1),seconds:1,allowedFor:["waiter", "guard", "cleaner", "delivery"]},
  chef_emetic:{label:'料理長のまかないに吐き気の素を入れる',seconds:3},
  serve_dish:{label:'毒入りの試食を出す',seconds:2},
  gas_pipe:{label:'ガス管をスパナで緩める',at:P(-33,-17.5),seconds:4,tamper:true},
  stove_light:{label:'試食用のコンロに火を付ける（3秒後に爆発）',at:P(-17,-10.2),seconds:1.5},
  escort_start:{label:'交代の護衛として付き添う',seconds:2},
  car_sit:{label:'運転席に座って待つ',at:P(-28.5,-25.4),seconds:1.5},
  car_kill:{label:'車内で排除する',at:P(-28.5,-25.4),seconds:3},
  take_keycard:{label:'ワゴンからカードキーを取る',at:P(8,-15.6,1),seconds:1.5},
  rail_bolts:{label:'手すりのボルトを外す',at:P(-21,2.2,2),seconds:4,tamper:true},
  boat_fuel:{label:'避難ボートの燃料に細工する',at:P(45.8,27),seconds:4,tamper:true},
  alarm_bell:{label:'非常ベルを鳴らす',at:P(34.2,-8.4),seconds:1},
  greet_investor:{label:'パイロットとして出迎え、ヘリの縁へ案内する',seconds:2},
  massage_wire:{label:'施術中にワイヤーで排除する',seconds:3},
  fireworks_aim:{label:'花火の筒を投資家の席へ向ける',at:P(56.6,2),seconds:3,tamper:true}
 },
 props:{
  powerpanel:P(-23.14,14),light_stand:P(9.4,12.8),crane:P(24,29),crane_load:P(30,33.6),crane_panel:P(8,28.2),
  chandelier:{...P(-20,-16.8,1),y:floorY(1)+2.6},clamp:P(-20,-3,1),gas_pipe:P(-33,-17.9),tasting_stove:P(-17,-11.9),
  wagon:P(8.6,-16.3,1),rail:P(-21,3.6,2),evac_boat:{x:44,y:-.2,z:31.4},fuel_tank:P(47.5,27),alarm_bell:P(34,-7.5),fireworks:P(57.4,2.6),car:P(-27,-26.5)
 },
 // Where traps reach (everyone inside dies) and where the targets go when the hotel is alarmed.
 areas:{pool_light:{...P(10.2,13.8),r:2.3},yacht_crane:{...P(30,33.6),r:2.6},chandelier:{...P(-20,-16.8,1),r:2.3},gas_leak:{...P(-17,-11),r:3.2},
  boat_fuel:{...P(44,28.6),r:2.6},fireworks:{...P(54,5),r:.65}},
 posed:{wine_merchant:{...P(45.5,7),heading:Math.PI/2},investor:{...P(23.5,-11,2),heading:Math.PI/2}},
 sick:P(-29,5),inCar:P(-28.5,-27.6),railFall:P(-21,6.6),
 safeRooms:{wine_merchant:{...P(29.8,-16,-1)},lawyer:P(17,-13,1),investor:P(-28,-15.5,2)},
 evacuate:{wine_merchant:P(-30,-23.4),lawyer:P(-30,-23.4),investor:P(44,28.6)},
 clothes:[{disguise:'beachbar',...P(53.5,-5)},{disguise:'fisher',...P(-21,27.6)}],
 // During the photograph the terrace guests give the rail room and look away; the beach watches the sea.
 scenes:{photo:{until:600,cast:Object.fromEntries(npcs.filter(n=>n.id==='guard_terrace'||n.id==='waiter_3'||n.id==='photographer'||n.id==='guest_stroll_5'||n.id.startsWith('guest_terrace_')).map((n,i)=>[n.id,{...P(27+i%4*2,5+Math.floor(i/4)*2),heading:-Math.PI/2}]).concat(
  npcs.filter(n=>n.id==='guard_beach_s'||n.id.startsWith('guest_beach_b_')).map(n=>[n.id,{...P(n.route[0][0],n.route[0][1]),heading:Math.PI/2}]) as [string,{x:number;y:number;z:number;heading:number}][]))},
  heli:{until:1500,cast:{guard_heliport:{...P(5,-14,2),heading:-Math.PI/2}}}},
 signal:1080
};
for(const a of Object.values(m57.acts))if('at' in a&&a.at)at(a.at.x,a.at.z,floorOf(a.at.y));
for(const p of [m57.inCar,m57.sick,m57.railFall,...Object.values(m57.safeRooms),...Object.values(m57.evacuate),...Object.values(m57.posed),...m57.clothes,...Object.values(m57.scenes).flatMap(s=>Object.values(s.cast))])at(p.x,p.z,floorOf(p.y));
for(const p of [m53.barrel.approach,m53.glass.approach,m53.privatePlace])at(p.x,p.z,-1);
const out={
 _note:'M5 5.1 グランド・マリーナ・ホテル（仮の見た目）。scripts/build-hotel.ts が生成する。平面計画 v0.3 の10px＝1m。',
 name:'グランド・マリーナ・ホテル',spawn:{x:spawns[0].x,z:spawns[0].z},spawnHeading:0,ground,floors,stairs,walls,blockers,sections,rooms,zones,
 guide:[[14.8,-28],[2,-24],[2,-16],[8,-2.6],[8,-13],[8,-16],[8,-13],[8,-2.6],[1.5,-2.6],[1.5,2],[-8.5,6],[-8.5,15]],
 objectives:{panel:{x:-22.6,z:14,radius:.9,seconds:3,label:'配電盤'},exit:{x:exits[4].x,z:exits[4].z,radius:exits[4].radius,label:exits[4].label}},
 exits,spawns,reinforcements,checkpoints,cameras,hides,palms,labels,pool,water,npcs,schedulePlaces,m53,m57,
 _routeNote:'route: [x, z, 待ち秒, 待つ間の向き(度)]。向きは0=南（海側）、90=東、180=北、-90=西。'};
writeFileSync(new URL('../src/data/hotel.json',import.meta.url),JSON.stringify(out,null,1));
console.log(`hotel.json: ${walls.length} walls, ${blockers.length} blockers, ${sections.length} sections, ${zones.length} zones, ${npcs.length} people, ${hides.length} hides`);


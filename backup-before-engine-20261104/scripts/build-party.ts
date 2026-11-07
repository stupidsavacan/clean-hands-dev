// Generates the party map only. Geometry and tuning are sourced from party-layout.json.
// Run from app: node --experimental-strip-types scripts/build-party.ts
import {readFileSync,writeFileSync} from 'node:fs';
const read=(n:string)=>JSON.parse(readFileSync(new URL('../src/data/'+n,import.meta.url),'utf8'));
const spec=read('party-layout.json'), hotel=read('hotel.json');
if(spec.version===2){await import('./build-party-v2.ts');process.exit(0);}
const rooms=spec.rooms,byId=Object.fromEntries(rooms.map((r:any)=>[r.id,r]));
const walls:any[]=[],blockers:any[]=[],hides:any[]=[],npcs:any[]=[],places:any={},actors:any={};
let seq=0;
for(const r of rooms){if(['V','G','L'].includes(r.id))continue;
 for(const [axis,fixed,from,to] of [['x',r.minZ,r.minX,r.maxX],['x',r.maxZ,r.minX,r.maxX],['z',r.minX,r.minZ,r.maxZ],['z',r.maxX,r.minZ,r.maxZ]] as [string,number,number,number][]){
 const cuts=spec.openings.filter((e:any)=>[e.a,e.b].includes(r.id)&&e.axis===axis&&e.fixed===fixed).map((e:any)=>[e.at-e.width/2,e.at+e.width/2]);
 // Stairwells crossing a boundary are physically open, not merely connected in metadata.
 for(const s of spec.stairs){if(r.floor*3.5<s.low||r.floor*3.5>s.high)continue;if(axis==='x'&&fixed>=s.minZ&&fixed<=s.maxZ&&(!s.rise.includes('x')||fixed>s.minZ&&fixed<s.maxZ))cuts.push([s.minX-.1,s.maxX+.1]);if(axis==='z'&&fixed>=s.minX&&fixed<=s.maxX&&(!s.rise.includes('z')||fixed>s.minX&&fixed<s.maxX))cuts.push([s.minZ-.1,s.maxZ+.1]);}
 for(const l of spec.traversals){const q=l.a===r.id?l.start:l.b===r.id?l.end:null;if(!q)continue;if(axis==='x'&&Math.abs(q.z-fixed)<1.2)cuts.push([q.x-1,q.x+1]);if(axis==='z'&&Math.abs(q.x-fixed)<1.2)cuts.push([q.z-1,q.z+1]);}
 if(['B','Q','R'].includes(r.id)&&axis==='z'&&fixed===spec.overlook.minX)cuts.push([spec.overlook.minZ,spec.overlook.maxZ]);
 let parts=[[from,to]];for(const [a,b] of cuts)parts=parts.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:[[x,Math.max(x,a)],[Math.min(y,b),y]].filter(([x,y])=>y-x>.01));
 for(const [a,b] of parts)walls.push({id:`wall-${r.id}-${seq++}`,x:axis==='x'?(a+b)/2:fixed,z:axis==='x'?fixed:(a+b)/2,w:axis==='x'?b-a:.18,d:axis==='x'?.18:b-a,y:r.floor*3.5,h:3,floor:r.floor});
 }
}
// Fence is closed except for the inspected front gate and the uniform-only service entrance.
for(const [a,b] of [[-30,-13.3],[-10.7,20.7],[23.3,30]])walls.push({id:`fence-${a}`,x:(a+b)/2,z:-16,w:b-a,d:.25,y:0,h:3,floor:0});
// Close the service gate for unauthorized clothes using its existing checkpoint-like constrain rule in party main.
for(const t of spec.traversals.filter((t:any)=>t.kind==='window')){const r=byId[t.a];blockers.push({id:'window-sill-'+t.id,x:t.start.x,z:r.maxZ,w:2,d:.2,y:r.floor*3.5,h:1,floor:r.floor});}
for(const [floor,h] of [[0,spec.overlook.lowerRailHeight],[1,spec.overlook.railHeight]])blockers.push({id:'overlook-rail-'+floor,x:spec.overlook.minX,z:(spec.overlook.minZ+spec.overlook.maxZ)/2,w:.18,d:spec.overlook.maxZ-spec.overlook.minZ,y:floor*3.5,h,floor});
const zones=rooms.map((r:any)=>({...r,...(r.id==='G'?{minX:spec.ground.minX,maxX:spec.ground.maxX,minZ:-16,maxZ:spec.ground.maxZ}:{}),allowedDisguises:r.id==='Q'?['cleaner']:r.id==='J'?['driver']:[]}));
for(const r of rooms){const x=(r.minX+r.maxX)/2,z=(r.minZ+r.maxZ)/2,y=r.floor*3.5;
 places[r.id]={x,y,z,label:r.label,outdoor:!r.indoor,heading:0};
 // Hides are on the accessible side of each room; wide rooms receive more than one.
 for(let zz=r.minZ+Math.min(2,(r.maxZ-r.minZ)/2);zz<r.maxZ;zz+=8)for(let xx=r.minX+2;xx<r.maxX;xx+=8){hides.push({id:`hide-${r.id}-${xx}-${zz}`,label:r.label+'の収納',x:xx,y,z:zz,heading:0,capacity:3,approach:{x:0,z:-1},size:{w:1,h:1,d:.65}});}
 if(r.maxX-r.minX>15&&r.indoor)for(let xx=r.minX+5;xx<r.maxX-2;xx+=8)blockers.push({id:`shelf-${r.id}-${xx}`,x:xx,z:r.id==='U'?r.minZ+.6:z+2,w:2,d:.6,y,h:2,floor:r.floor});
}
blockers.push({id:'changing-screen',x:10,z:8,w:.3,d:5,y:0,h:2.5,floor:0});
blockers.push({id:'powerpanel',x:16,z:1,w:.3,d:.7,y:0,h:1.5,floor:0});
// Furniture divides the large ballroom into sight pockets without sealing exits.
for(const x of [-14,-3])for(const z of [1,8])blockers.push({id:`pillar-${x}-${z}`,x,z,w:.7,d:.7,y:0,h:3,floor:0});
hides.push({id:'hide-M-south',label:'寝室南の収納',x:16,y:3.5,z:8,heading:0,capacity:3,approach:{x:0,z:-1},size:{w:1,h:1,d:.65}});
hides.push({id:'hide-S-south',label:'使用人室南の収納',x:16,y:0,z:11,heading:0,capacity:3,approach:{x:0,z:-1},size:{w:.65,h:2,d:.9}});
for(const x of [-27,28])for(const z of [-12,-4,4,12])hides.push({id:'hide-G-edge-'+x+'-'+z,label:'庭道の収納',x,z,y:0,heading:0,capacity:3,approach:{x:0,z:-1},size:{w:.65,h:2,d:.9}});hides.push({id:'hide-A-east',label:'屋根裏東の収納',x:12,y:7,z:3,heading:0,capacity:3,approach:{x:0,z:-1},size:{w:.65,h:2,d:.9}});
for(const [id,x,z] of [['B-west',-16,10],['B-east',4,10],...[-16,-8,0,8,16].map(x=>['G-south-'+x,x,21])] as [string,number,number][])hides.push({id:'hide-'+id,label:'庭・舞踏室の収納',x,y:0,z,heading:0,capacity:3,approach:{x:0,z:-1},size:{w:.65,h:2,d:.9}});
for(let i=hides.length-1;i>=0;i--){const h=hides[i];if(spec.traversals.some((t:any)=>[t.start,t.end].some((q:any)=>Math.hypot(h.x-q.x,h.z-q.z,h.y-q.y)<.85))||spec.stairs.some((st:any)=>h.y>=st.low&&h.y<=st.high&&h.x>=st.minX-.6&&h.x<=st.maxX+.6&&h.z>=st.minZ-.6&&h.z<=st.maxZ+.6))hides.splice(i,1);}
for(const h of hides){if(h.id.startsWith('hide-L-')){h.z=10.7;h.approach.z=.9;}if(h.id.startsWith('hide-V--12-'))h.x=-8;h.size={w:.65,h:2,d:.9};blockers.push({id:'locker-'+h.id,x:h.x,y:h.y,z:h.z,w:.65,h:2,d:.9,floor:Math.round(h.y/3.5)});}
const outfits=['suit','waiter','chef','cleaner','guard','bodyguard'];
for(let i=0;i<60;i++){
 const id=i===0?'host':i===1?'captain':i===2?'guard_front':i===3?'guard_monitor':`party-${i}`;
 const role=i<10?'guard':i<30?'waiter':'guest', outfit=i===0?'bodyguard':i===1?'bodyguard':i<10?'guard':i<22?'waiter':i<26?'chef':i<30?'cleaner':'suit';
 const area=i===0?'B':i===1?'O':i===2?'V':i===3?'S':i<10?'C':i<22?'K':i<26?'K':i<30?'U':'B';
 const r=byId[area],x=r.minX+2+(i%3)*2,z=r.minZ+2+(Math.floor(i/3)%3)*2;
 npcs.push({id,label:i===0?'館の主人':i===1?'護衛隊長':i===2?'正門の警備':`夜会の${role==='guest'?'客':role==='guard'?'警備':'スタッフ'}${i}`,role:i===0?'guest':role,floor:r.floor,model:outfit==='bodyguard'?'bodyguard':outfit==='guard'?'guard':outfit==='suit'?'guest_male':outfit==='chef'?'chef':outfit==='cleaner'?'cleaner':'waiter',outfit,target:i===0,route:i===2||i===3?[[x,z,3,180]]:[[x,z,3,0],[Math.min(r.maxX-2,x+2),Math.min(r.maxZ-2,z+3),3,180]],knowsFaces:i===1?['bodyguard']:i===10?['waiter']:[],post:area});
}
npcs.find(n=>n.id==='captain').route=[[-4,2,4,180],[2,2,4,180]];
npcs.find(n=>n.id==='party-4').route=[[-25,-15,4,180],[-25,-8,4,180]];
npcs.find(n=>n.id==='guard_front').route=[[-12,-14.5,0,180]];
npcs.find(n=>n.id==='guard_monitor').route=[[16,2,0,180]];
const plan=[['B',0,240],['G',240,480],['B',480,720],['O',720,1020],['M',1020,1260],['B',1260,1500],['G',1500,1800]];
actors.host={plan:plan.map(([place,from,to])=>({place,from,to,do:'wait'}))};
for(let i=10;i<22;i++)actors[`party-${i}`]={plan:[{place:'K',from:0,to:900,do:'serve'},{place:'B',from:900,to:1800,do:'serve'}]};
for(let i=30;i<60;i++)actors[`party-${i}`]={plan:[{place:i%2?'B':'G',from:0,to:600,do:'chat'},{place:'D',from:600,to:1200,do:'chat'},{place:i%2?'G':'B',from:1200,to:1800,do:'chat'}]};
for(const [id,actor] of Object.entries(actors) as [string,any][]){if(id==='host')continue;const i=Number(id.split('-')[1]);for(const e of actor.plan){const room=byId[e.place],key=e.place+'-'+i;places[key]={...places[e.place],x:room.minX+2+(i%5)*((room.maxX-room.minX-4)/5),z:room.minZ+2+(Math.floor(i/5)%3)*((room.maxZ-room.minZ-4)/3)};e.place=key;}}
const occupied=[...npcs.flatMap(n=>n.route.map((p:number[])=>({x:p[0],z:p[1],y:n.floor*3.5}))),...Object.values(places) as any[]];for(let i=hides.length-1;i>=0;i--){const h=hides[i];if(occupied.some(p=>Math.abs(h.y-p.y)<.3&&Math.hypot(h.x-p.x,h.z-p.z)<1)){const index=blockers.findIndex(b=>b.id==='locker-'+h.id);if(index>=0)blockers.splice(index,1);hides.splice(i,1);}}
const cameras=[{id:'party-camera',label:'玄関カメラ',x:-8,y:2.8,z:-14,floor:0,heading:0,fov:70,range:10}];
const map={...hotel,...spec,rooms,zones,walls,blockers,npcs,hides,stairs:spec.stairs,sections:[{id:'party',label:'夜会の私邸',surface:'grass',...spec.ground,outdoor:true}],floors:[-1,1,2].map(f=>({floor:f,y:f*3.5,areas:rooms.filter((r:any)=>r.floor===f).flatMap((r:any)=>r.id==='Q'?[{minX:spec.overlook.maxX,maxX:r.maxX,minZ:r.minZ,maxZ:r.maxZ},{minX:r.minX,maxX:spec.overlook.maxX,minZ:r.minZ,maxZ:spec.overlook.minZ}]:[{minX:r.minX,maxX:r.maxX,minZ:r.minZ,maxZ:r.maxZ}])})),pool:{minX:100,maxX:101,minZ:100,maxZ:101},water:[],palms:[],labels:rooms.map((r:any)=>({text:r.label,x:(r.minX+r.maxX)/2,y:r.floor*3.5+2.5,z:(r.minZ+r.maxZ)/2,floor:r.floor})),schedulePlaces:places,guide:[[-12,-20],[-12,-18]],cameras,checkpoints:[{id:'party-front',label:'正門の身体検査',x:-12,z:-16,y:0,width:2.6,normal:{x:0,z:1},zone:'public',guardId:'guard_front'}],exits:[{id:'E1',label:'正門前から脱出',x:-12,z:-20,floor:0,radius:2}],reinforcements:[{id:'party-backup',x:22,z:-20}]};
delete map.m53;delete map.m57;
writeFileSync(new URL('../src/data/party.json',import.meta.url),JSON.stringify(map,null,1)+'\n');
writeFileSync(new URL('../src/data/party-schedule.json',import.meta.url),JSON.stringify({actors},null,1)+'\n');
console.log(JSON.stringify({rooms:rooms.length,connections:spec.openings.length+spec.stairs.length+spec.traversals.length,npcs:npcs.length}));


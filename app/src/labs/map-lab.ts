import mission from '../data/club-mission.json' with {type:'json'};
import {DEVICE_KINDS,type DeviceDef} from '../devices.ts';
import club from '../data/club-layout.json' with {type:'json'};
import {assertMapLayout,compileMapGeometry,type MapLayout} from '../map-layout.ts';
import {CollisionWorld,bounds,type Position,type Rect} from '../world.ts';
import {NavGrid} from '../nav.ts';
import {DoorSystem,type DoorDef} from '../doors.ts';
import {sightBoxes,segmentClear} from '../sight.ts';
import {traversalPoints,type Traversal} from '../party/traversal.ts';

type Entity=Record<string,unknown>;
const types={
 rooms:'部屋',walls:'壁',doors:'扉',furniture:'家具',devices:'設備',stairs:'階段',floors:'階層',shafts:'吹き抜け',
 npcs:'NPC・巡回',schedulePlaces:'予定の場所',traversals:'移動経路',
} as const;
type Kind=keyof typeof types;
type Draft=MapLayout&Record<string,unknown>;
type Entry={label:string;value:Entity;save:(value:Entity)=>void;remove:()=>void};
const demo:Draft={
 name:'検証マップ',ground:{minX:0,minZ:0,maxX:12,maxZ:10},spawn:{x:1,z:1},rooms:[],walls:[],furniture:[],
 stairs:[],traversals:[],doors:[],npcs:[],schedulePlaces:{},geometry:{floors:[],shafts:[]},
};
const $=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
$('app').innerHTML=`
 <header><h1>マップ編集・検証</h1><label>元データ <select id="preset"><option value="club">クラブ</option><option value="demo">空の検証マップ</option></select></label>
 <label>JSONを開く <input id="open" type="file" accept=".json,application/json"></label><button id="save">レイアウトを保存</button></header>
 <section id="main"><div id="drawing"><svg id="map" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="平面図"></svg></div>
 <aside><p id="status" role="status"></p>
 <label>階層 <select id="floor"></select></label> <label>種類 <select id="kind"></select></label>
 <label>項目 <select id="entity"></select></label>
 <div class="row"><button id="add">新規</button><button id="remove">削除</button></div>
 <label>選択した項目のJSON <textarea id="editor" rows="12" spellcheck="false"></textarea></label>
 <div class="row"><button id="apply">項目に反映</button><button id="place">地図上に配置</button></div>
 <p id="device-check"></p><h2>衝突・移動経路・視線</h2><label><input id="solid" type="checkbox" checked> 衝突形状</label>
 <button id="probe">始点と終点を選ぶ</button><p id="route" role="status"></p>
 </aside></section>`;
const style=document.createElement('style');
style.textContent=`
 *{box-sizing:border-box}body{margin:0;background:#1b1f26;color:#eee;font:14px system-ui,sans-serif}
 header{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px}h1{margin:0;font-size:20px}h2{font-size:15px}
 #main{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,330px);min-height:85vh}#drawing{background:#11151a}
 #map{width:100%;height:85vh;display:block;touch-action:manipulation}aside{padding:12px}aside>label{display:block;margin:10px 0}
 select,button,input,textarea{background:#292f3a;color:#eee;border:1px solid #596579;border-radius:4px;padding:5px}button{cursor:pointer}
 textarea{width:100%;display:block;font-family:monospace}.row{display:flex;gap:6px;margin:5px 0}#status,#route{color:#ffd08a}
 @media(max-width:750px){#main{grid-template-columns:1fr}#map{height:53vh}}
 `;
document.head.append(style);
const svg=document.querySelector<SVGSVGElement>('#map')!,floor=$<HTMLSelectElement>('floor'),kind=$<HTMLSelectElement>('kind');
const entity=$<HTMLSelectElement>('entity'),editor=$<HTMLTextAreaElement>('editor');
const clubDraft={...club,devices:mission.devices};
let draft=structuredClone(clubDraft) as Draft,entries:Entry[]=[];
let placing=false,probe:Position[]|null=null;
let compiled=compileMapGeometry(draft),world:CollisionWorld,nav:NavGrid|undefined,boxes:ReturnType<typeof sightBoxes>;
let route:Position[]|null=null,ends:Position[]=[];
const status=(message:string)=>{$('status').textContent=message;};
const selectedFloor=()=>Number(floor.value);
const heights=()=>[{floor:0,y:0},...draft.geometry.floors];
const height=()=>heights().find(f=>f.floor===selectedFloor())?.y??0;
const floorOfHeight=(y:number)=>heights().reduce((a,b)=>Math.abs(y-a.y)<Math.abs(y-b.y)?a:b).floor;
const ns='http://www.w3.org/2000/svg';
function shape(tag:string,attrs:Record<string,string|number>){
 const el=document.createElementNS(ns,tag);
 for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
 svg.append(el);return el;
}
function rect(r:Rect,fill:string,stroke=fill){shape('rect',{x:r.minX,y:r.minZ,width:r.maxX-r.minX,height:r.maxZ-r.minZ,fill,stroke,'stroke-width':.045});}
function dot(x:number,z:number,fill:string){shape('circle',{cx:x,cy:z,r:.18,fill});}
function line(points:Position[],stroke:string){
 if(points.length<2)return;
 shape('polyline',{points:points.map(p=>p.x+','+p.z).join(' '),fill:'none',stroke,'stroke-width':.11});
}
const atFloor=(v:Entity)=>v.floor??floorOfHeight(typeof v.y==='number'?v.y:0);
function array(key:string):Entity[]{return Array.isArray(draft[key])?draft[key] as Entity[]:[];}
function draw(){
 svg.replaceChildren();
 const g=draft.ground;
 svg.setAttribute('viewBox',[g.minX-1,g.minZ-1,g.maxX-g.minX+2,g.maxZ-g.minZ+2].join(' '));
 rect(g,'#242c36');
 for(const r of draft.rooms)if(r.floor===selectedFloor())rect(r,'#384553','#75869a');
 if($<HTMLInputElement>('solid').checked)for(const b of [...compiled.walls,...compiled.blockers])
  if(b.y<=height()+1.7&&b.y+b.h>height()+.04)rect(bounds(b),'#94756c');
 for(const d of array('devices') as DeviceDef[])if(d.floor===selectedFloor()){
  dot(d.x,d.z,'#90c9ec');
  line([{x:d.x,y:d.y,z:d.z},{...d.approach,y:height()}],'#90c9ec');
 }
 for(const b of array('doors') as DoorDef[])if(atFloor(b)===selectedFloor())rect(bounds(b),'#e3aa67');
 for(const t of draft.traversals){
  const points=traversalPoints(t);
  if(points.some(p=>floorOfHeight(p.y)===selectedFloor()))line(points,'#d6ae75');
 }
 for(const n of array('npcs'))if(atFloor(n)===selectedFloor()&&Array.isArray(n.route)){
  const p=n.route.map(([x,z]:number[])=>({x,y:height(),z}));if(p.length)dot(p[0].x,p[0].z,'#9cd199');
  line(p,'#6caa8a');
 }
 for(const p of Object.values((draft.schedulePlaces??{}) as Record<string,Position>))
  if(Number.isFinite(p.y)&&floorOfHeight(p.y)===selectedFloor())dot(p.x,p.z,'#bda1e3');
 if(route)line(route,'#55e1cc');
 for(const p of probe??ends)dot(p.x,p.z,'#effd85');
 const current=entries[Number(entity.value)]?.value;
 if(!current||atFloor(current)!==selectedFloor())return;
 if(typeof current.minX==='number')rect(current as Rect,'none','#f9dd77');
 if(typeof current.x==='number'&&typeof current.z==='number')dot(current.x,current.z,'#f9dd77');
}
function refresh(resetFloor=false){
 assertMapLayout(draft);
 if(!array('devices').every(value=>{
  const d=value as DeviceDef;
  return d&&Object.hasOwn(DEVICE_KINDS,d.kind)&&d.approach&&
   [d.x,d.y,d.z,d.floor,d.heading,d.approach.x,d.approach.z].every(Number.isFinite)&&
   (d.responders===undefined||Array.isArray(d.responders)&&d.responders.every(id=>typeof id==='string'));
 }))throw new Error('devices の種類・向き・操作位置を確認してください');
 compiled=compileMapGeometry(draft);
 const level={...draft,...compiled};
 world=new CollisionWorld(level);boxes=sightBoxes({...level,walls:level.walls.filter(w=>!compiled.collisionOnlyIds.includes(w.id))});
 new DoorSystem(world,boxes,array('doors') as DoorDef[]);
 nav=undefined;
 const old=resetFloor?0:selectedFloor();
 floor.replaceChildren(...heights().map(f=>new Option(f.floor+'階 · 高さ '+f.y+' m',String(f.floor))));
 floor.value=String(heights().some(f=>f.floor===old)?old:0);
 route=null;ends=[];probe=null;placing=false;$('route').textContent='';
 list();
}
function collection(key:Kind){
 if(key==='floors'||key==='shafts')return draft.geometry[key] as Entity[];
 if(!Array.isArray(draft[key]))draft[key]=[];
 return draft[key] as Entity[];
}
function places(){return (draft.schedulePlaces??={}) as Record<string,Entity>;}
function list(index=0){
 const key=kind.value as Kind;
 entries=key==='schedulePlaces'?Object.entries(places()).map(([id,value])=>({
  label:id,value,save:v=>{places()[id]=v;},remove:()=>{delete places()[id];},
 })):collection(key).map((value,i)=>({
  value,label:String(value.label??value.id??value.floor??i+1),
  save:v=>{collection(key)[i]=v;},remove:()=>{collection(key).splice(i,1);},
 }));
 entity.replaceChildren(...entries.map(({label},i)=>new Option(label,String(i))));
 entity.selectedIndex=Math.min(index,entries.length-1);
 show();
}
function show(){
 const entry=entries[entity.selectedIndex];
 editor.value=entry?JSON.stringify(entry.value,null,2):'';
 const d=kind.value==='devices'?entry?.value as DeviceDef|undefined:undefined;
 if(d){
  const floorY=heights().find(f=>f.floor===d.floor)?.y??0;
  const {x,z}=d.approach,free=!world.blocked(x,floorY,z)&&Math.abs((world.surface(x,z,floorY)??Infinity)-floorY)<.3;
  const meta=DEVICE_KINDS[d.kind];
  $('device-check').textContent=meta.model+' · '+meta.doing+'（'+meta.radius+' m） / '+(free?'操作位置に床あり':'操作位置に衝突または床なし')+(d.responders?' / 担当 '+(d.responders.join('、')||'なし'):'');
 }else $('device-check').textContent='';
 for(const id of ['apply','remove','place'])$<HTMLButtonElement>(id).disabled=!entry||id==='place'&&kind.value==='floors';
 draw();
}
function transact(change:()=>void){
 const old=structuredClone(draft),i=entity.selectedIndex;
 try{change();refresh();list(Math.max(0,i));status('反映しました');}
 catch(error){draft=old;refresh();list(Math.max(0,i));status(String(error));}
}
for(const [key,label] of Object.entries(types))kind.add(new Option(label,key));
kind.onchange=()=>list();floor.onchange=()=>draw();entity.onchange=show;$('solid').onchange=draw;
$('apply').onclick=()=>transact(()=>{
 const v=JSON.parse(editor.value) as Entity;
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('項目をオブジェクトで指定してください');
 const key=kind.value;

 if(key==='doors'&&(!['x','y','z','w','d','h'].every(k=>Number.isFinite(v[k]))||Number(v.w)<=0||Number(v.d)<=0||Number(v.h)<=0))throw new Error('扉の座標・寸法が無効です');
 if(key==='npcs'&&(!Array.isArray(v.route)||!v.route.length||!v.route.every(p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite))))throw new Error('NPCの経路を確認してください');
 if(key==='schedulePlaces'&&!['x','y','z'].every(k=>Number.isFinite(v[k])))throw new Error('予定場所の座標を確認してください');
 entries[entity.selectedIndex]?.save(v);
});
$('remove').onclick=()=>transact(()=>entries[entity.selectedIndex]?.remove());
$('add').onclick=()=>{
 const key=kind.value as Kind,f=selectedFloor(),x=draft.spawn.x,z=draft.spawn.z,y=height();
 const id=key+'-'+Date.now().toString(36),p={x,y,z};
 const rect={minX:x-1,maxX:x+1,minZ:z-1,maxZ:z+1};
 const seed:Record<Kind,Entity>={
  rooms:{id,label:'部屋',...rect,floor:f,type:'public',indoor:true,allowedDisguises:[]},
  walls:{id,...p,w:2,d:.2,h:2.5,floor:f},doors:{id,label:'扉',...p,w:1,d:.14,h:2.1,floor:f},
  furniture:{id,...p,w:1,d:1,h:1,floor:f},devices:{id,x,y:0,z,kind:'radio',label:'ラジオ',floor:f,heading:0,approach:{x,z:z-1}},stairs:{id,...rect,low:y,high:y+3,rise:'+z',floor:f},
  floors:{floor:Math.max(...heights().map(f=>f.floor))+1,y:y+3},shafts:{...rect,floor:f},
  npcs:{id,label:'NPC',role:'guest',outfit:'suit',floor:f,route:[[x,z,0]]},
  schedulePlaces:{...p,label:'予定場所',heading:0,outdoor:false},
  traversals:{id,a:'',b:'',kind:'ledge',start:p,end:{...p,z:z+2},seconds:2},
 };
 transact(()=>{if(key==='schedulePlaces')places()[id]=seed[key];else collection(key).push(seed[key]);});
 list(entries.length-1);
};
$('place').onclick=()=>{placing=true;probe=null;status('配置先を地図で選んでください');};
$('probe').onclick=()=>{probe=[];placing=false;route=null;ends=[];draw();$('route').textContent='地図で始点と終点を選んでください。階層も切り替えられます。';};
svg.onclick=e=>{
 const ctm=svg.getScreenCTM();if(!ctm)return;
 const local=new DOMPoint(e.clientX,e.clientY).matrixTransform(ctm.inverse());
 const p={x:Math.round(local.x*20)/20,y:height(),z:Math.round(local.y*20)/20};
 if(probe){
  probe.push(p);
  if(probe.length===2){
   ends=probe;probe=null;
   const [a,b]=ends,blocked=ends.some(q=>world.blocked(q.x,q.y,q.z)||Math.abs((world.surface(q.x,q.z,q.y)??Infinity)-q.y)>.3);
   const path=blocked?null:(nav??=new NavGrid(world)).find(a,b);
   const last=path?.at(-1);
   route=last&&Math.hypot(last.x-b.x,last.y-b.y,last.z-b.z)<.3?[a,...path!]:null;
   const sight=segmentClear(boxes,{...a,y:a.y+1.55},{...b,y:b.y+1.55});
   $('route').textContent=(blocked?'端点に衝突または床なし':route?'歩行経路あり':'到達できません')+' / 視線 '+(sight?'通る':'遮断');
  }
  draw();return;
 }
 if(!placing)return;
 const entry=entries[entity.selectedIndex];if(!entry)return;
 transact(()=>{
  const v=structuredClone(entry.value),key=kind.value,f=selectedFloor();
  if(key==='traversals'){
   const t=v as Traversal,dx=p.x-t.start.x,dy=p.y-t.start.y,dz=p.z-t.start.z;
   const move=(q:Position)=>({x:q.x+dx,y:q.y+dy,z:q.z+dz});
   t.start=move(t.start);t.end=move(t.end);if(t.via)t.via=t.via.map(move);
  }else if(key==='devices'){
   const d=v as DeviceDef;
   d.approach={x:d.approach.x+p.x-d.x,z:d.approach.z+p.z-d.z};
   Object.assign(d,{x:p.x,z:p.z,floor:f});
  }else if(key==='npcs'){
   const route=v.route as number[][],dx=p.x-route[0][0],dz=p.z-route[0][1];
   v.route=route.map(([x,z,...rest])=>[x+dx,z+dz,...rest]);v.floor=f;
  }else if(typeof v.minX==='number'&&typeof v.maxX==='number'&&typeof v.minZ==='number'&&typeof v.maxZ==='number'){
   const dx=p.x-(v.minX+v.maxX)/2,dz=p.z-(v.minZ+v.maxZ)/2;
   v.minX+=dx;v.maxX+=dx;v.minZ+=dz;v.maxZ+=dz;v.floor=f;
   if(key==='stairs'){const rise=Number(v.high)-Number(v.low);v.low=p.y;v.high=p.y+rise;}
  }else{Object.assign(v,p);if(key!=='schedulePlaces')v.floor=f;}
  entry.save(v);
 });
};
function replace(value:unknown){
 assertMapLayout(value);
 const old=draft;
 try{draft=value as Draft;refresh(true);status(draft.name);}
 catch(error){draft=old;refresh(true);throw error;}
}
$<HTMLSelectElement>('preset').onchange=e=>replace(structuredClone((e.target as HTMLSelectElement).value==='demo'?demo:clubDraft));
$<HTMLInputElement>('open').onchange=async e=>{
 const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;
 try{replace(JSON.parse(await file.text()));}catch(error){status(String(error));}finally{input.value='';}
};
$('save').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,1)+'\n'],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='map-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
refresh(true);

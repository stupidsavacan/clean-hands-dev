// 2026-11-10: the map lab, rebuilt. A plan you edit with the mouse (draw, drag, resize), a form for the selected item,
// the problems the game would hit (click one to go there), and saving straight into the club's data. Every mouse action
// is an operation of map-editor/core.ts, and window.__mapLab offers the same operations to Claude.
import layoutData from '../data/club-layout.json' with {type:'json'};
import mission from '../data/club-mission.json' with {type:'json'};
import {DRAW_ORDER,KINDS,MapModel,floorHeights,floorOfItem,get,handlesOf,items,moveHandle,moveItem,nameOf,pick,probeOf,rectOf,resizeItem,routeBetween,sameRef,
 type Doc,type KindId,type Probe,type Ref,type RouteResult} from '../map-editor/core.ts';
import {centre,checkMap,type Issue} from '../map-editor/checks.ts';

// --- Page -----------------------------------------------------------------------------------------------------------
const TOOLS:{id:string;label:string;key?:string;kind?:KindId}[]=[
 {id:'select',label:'選ぶ・動かす',key:'V'},{id:'probe',label:'経路と視線を調べる',key:'R'},
 {id:'rooms',label:'部屋',kind:'rooms'},{id:'walls',label:'壁',kind:'walls'},{id:'furniture',label:'家具',kind:'furniture'},
 {id:'doors',label:'扉',kind:'doors'},{id:'stairs',label:'階段',kind:'stairs'},{id:'platforms',label:'台',kind:'platforms'},
 {id:'npcs',label:'NPC',kind:'npcs'},{id:'schedulePlaces',label:'予定の場所',kind:'schedulePlaces'},{id:'hides',label:'隠れ場所',kind:'hides'},
 {id:'exits',label:'出口',kind:'exits'},{id:'devices',label:'設備',kind:'devices'},{id:'traversals',label:'はしご・窓',kind:'traversals'},
];
const LAYERS:[string,string][]=[['rooms','部屋の名前'],['solid','当たり判定'],['walk','歩ける所'],['people','NPC・予定の場所'],['issues','問題の印']];
document.title='マップ編集';
document.getElementById('app')!.innerHTML=`
<header>
 <b class="title">マップ編集</b>
 <select id="map" aria-label="地図"><option value="club">クラブ</option><option value="blank">新しい地図（白紙）</option></select>
 <span id="floors" class="tabs" role="tablist" aria-label="階"></span>
 <span class="sep"></span>
 <button id="undo" title="元に戻す（Ctrl+Z）">↶ 戻す</button><button id="redo" title="やり直す（Ctrl+Y）">↷ 進む</button>
 <button id="fit" title="全体を表示（F）">全体</button>
 <span class="grow"></span>
 <span id="dirty"></span>
 <button id="export" title="編集中の地図をJSONファイルで書き出す">JSONを書き出す</button>
 <button id="save" class="primary" title="クラブの地図データに保存し、ゲームのページも作り直す（Ctrl+S）">保存してゲームに反映</button>
</header>
<div id="body">
 <nav id="tools" aria-label="道具"></nav>
 <div id="stage"><canvas id="plan"></canvas><div id="hint"></div><div id="cursor"></div></div>
 <aside id="side">
  <section id="probe" hidden><h2>経路と視線</h2><p id="probe-text" class="probe"></p></section>
  <section id="selection"></section>
  <section><h2>問題 <span id="issue-count"></span></h2><ol id="issues"></ol></section>
  <section><h2>表示</h2><div id="layers"></div></section>
 </aside>
</div>`;
const style=document.createElement('style');
style.textContent=`
:root{color-scheme:dark;--bg:#14171c;--panel:#1d2229;--line:#343c47;--text:#e8e6e1;--muted:#9aa3ad;--accent:#57c4b0;--warn:#ffcb6b;--err:#ff7a6b}
*{box-sizing:border-box}html,body{height:100%;margin:0}body{background:var(--bg);color:var(--text);font:13px/1.45 system-ui,"Yu Gothic UI",sans-serif}
#app{height:100%;display:flex;flex-direction:column}
header{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--line);background:var(--panel);flex-wrap:wrap}
.title{font-size:15px;margin-right:6px}.grow{flex:1}.sep{width:8px}
button,select,input,textarea{font:inherit;color:var(--text);background:#262d36;border:1px solid #46505d;border-radius:5px;padding:4px 8px}
button{cursor:pointer}button:hover{border-color:var(--accent)}button:disabled{opacity:.4;cursor:default}
button.primary{background:#1f5f55;border-color:var(--accent)}button.on{background:#2c4b47;border-color:var(--accent)}
.tabs button{border-radius:0;margin-left:-1px}.tabs button:first-child{border-radius:5px 0 0 5px}.tabs button:last-child{border-radius:0 5px 5px 0}
#dirty{color:var(--warn)}
#body{flex:1;display:grid;grid-template-columns:132px minmax(0,1fr) 340px;min-height:0}
#tools{display:flex;flex-direction:column;gap:3px;padding:8px;border-right:1px solid var(--line);background:var(--panel);overflow:auto}
#tools button{text-align:left;padding:5px 7px}#tools .group{color:var(--muted);font-size:11px;margin:8px 0 2px}
#tools kbd{float:right;color:var(--muted);font:11px monospace}
#stage{position:relative;min-width:0;overflow:hidden;background:#101317}
#plan{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair}
#hint{position:absolute;left:0;bottom:0;right:0;padding:5px 10px;background:rgba(20,23,28,.88);border-top:1px solid var(--line);color:var(--muted);font-size:12px;pointer-events:none}
#cursor{position:absolute;right:8px;top:8px;color:var(--muted);font:12px monospace;pointer-events:none}
#side{overflow:auto;border-left:1px solid var(--line);background:var(--panel);padding:0 10px 20px}
#side h2{font-size:13px;margin:14px 0 6px;color:var(--muted);font-weight:600}
.field{display:grid;grid-template-columns:96px 1fr;gap:6px;align-items:center;margin:4px 0}.field label{color:var(--muted)}
.field input,.field select,.field textarea{width:100%}.field textarea{font:12px monospace}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:4px}.pair input,.triple input{min-width:0;width:100%}#side{overflow-x:hidden}.triple{display:grid;grid-template-columns:1fr 1fr 1fr 26px;gap:4px;margin:3px 0}
.row{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.list{max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:6px}
.list button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);border-radius:0;background:none;padding:4px 8px}
.list .kind{color:var(--muted);font-size:11px;padding:6px 8px 2px}
#issues{list-style:none;padding:0;margin:0}#issues li{margin:3px 0}#issues button{width:100%;text-align:left;border-color:transparent;background:#262d36}
#issues .error{border-left:3px solid var(--err)}#issues .warning{border-left:3px solid var(--warn)}
.ok{color:var(--accent)}.muted{color:var(--muted)}.probe{white-space:pre-wrap}
`;
document.head.append(style);
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const canvas=$<HTMLCanvasElement>('plan'),ctx=canvas.getContext('2d')!;

// --- State ----------------------------------------------------------------------------------------------------------
const clubDoc=():Doc=>({...structuredClone(layoutData),devices:structuredClone(mission.devices)} as unknown as Doc);
const blankDoc=():Doc=>({version:1,name:'新しい地図',ground:{minX:0,minZ:0,maxX:30,maxZ:20},spawn:{x:2,z:2},spawnHeading:0,rooms:[],walls:[],furniture:[],doors:[],
 stairs:[],platforms:[],traversals:[],npcs:[],actors:{},schedulePlaces:{},hides:[],exits:[],checkpoints:[],devices:[],geometry:{floors:[{floor:1,y:3.5}],shafts:[]}} as unknown as Doc);
let model=new MapModel(clubDoc(),'club');
let floor=0,tool='select',selected:Ref|null=null;
const layers=new Set(['rooms','people','issues']);
let probe:Probe|null=null,probeRevision=-1,issues:Issue[]=[];
let route:{a:{x:number;z:number;floor:number};b?:{x:number;z:number;floor:number};result?:RouteResult}|null=null;
const view={x:0,z:0,scale:12};// metres at the canvas centre, pixels per metre

// --- Coordinates ----------------------------------------------------------------------------------------------------
const dpr=()=>window.devicePixelRatio||1;
// Until the person zooms or pans, the plan keeps filling the window as it is resized.
let framed=true;
function resize(){const r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*dpr());canvas.height=Math.round(r.height*dpr());if(framed)fit();else draw();}
const toScreen=(x:number,z:number)=>{const r=canvas.getBoundingClientRect();return {sx:r.width/2+(x-view.x)*view.scale,sy:r.height/2+(z-view.z)*view.scale};};
const toWorld=(sx:number,sy:number)=>{const r=canvas.getBoundingClientRect();return {x:view.x+(sx-r.width/2)/view.scale,z:view.z+(sy-r.height/2)/view.scale};};
function fit(){const g=model.doc.ground,r=canvas.getBoundingClientRect();view.x=(g.minX+g.maxX)/2;view.z=(g.minZ+g.maxZ)/2;
 view.scale=Math.max(2,Math.min((r.width-40)/(g.maxX-g.minX),(r.height-40)/(g.maxZ-g.minZ)));draw();}
function focus(at:{x:number;z:number;floor?:number}|null){if(!at)return;framed=false;if(at.floor!==undefined&&at.floor!==floor)setFloor(at.floor);view.x=at.x;view.z=at.z;view.scale=Math.max(view.scale,24);draw();}
const snap=(v:number,free:boolean)=>free?Math.round(v*100)/100:Math.round(v*10)/10;

// --- Drawing --------------------------------------------------------------------------------------------------------
function ensureProbe(){if(probeRevision!==model.revision||!probe){probe=probeOf(model.doc);probeRevision=model.revision;}return probe;}
function draw(){
 const w=canvas.width,h=canvas.height,d=model.doc;
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
 ctx.setTransform(dpr(),0,0,dpr(),0,0);
 const S=(x:number,z:number)=>toScreen(x,z);
 const rectPath=(minX:number,minZ:number,maxX:number,maxZ:number)=>{const a=S(minX,minZ),b=S(maxX,maxZ);ctx.beginPath();ctx.rect(a.sx,a.sy,b.sx-a.sx,b.sy-a.sy);};
 // Ground and grid.
 const g=d.ground;rectPath(g.minX,g.minZ,g.maxX,g.maxZ);ctx.fillStyle='#1a2027';ctx.fill();
 ctx.lineWidth=1;
 for(const step of [1,5]){if(step===1&&view.scale<8)continue;ctx.strokeStyle=step===1?'#20272f':'#2b343e';ctx.beginPath();
  for(let x=Math.ceil(g.minX/step)*step;x<=g.maxX;x+=step){const a=S(x,g.minZ),b=S(x,g.maxZ);ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);}
  for(let z=Math.ceil(g.minZ/step)*step;z<=g.maxZ;z+=step){const a=S(g.minX,z),b=S(g.maxX,z);ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);}ctx.stroke();}
 const onFloor=(ref:Ref)=>floorOfItem(d,ref)===floor;
 // Rooms, then floor features, then solids.
 for(const kind of ['rooms','platforms','stairs','shafts'] as KindId[])for(const {ref,value} of items(d,kind)){
  if(!onFloor(ref)&&!(kind==='stairs'&&floorOfItem(d,ref)+1===floor))continue;
  const r=rectOf(d,ref)!;rectPath(r.minX,r.minZ,r.maxX,r.maxZ);
  ctx.fillStyle=kind==='rooms'?(value.type==='staff'?'#2f3a32':value.type==='secure'?'#3d3044':'#283642'):KINDS[kind].color;
  ctx.globalAlpha=kind==='stairs'?.75:1;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#4a5866';ctx.stroke();
  if(kind==='stairs'){const c=S((r.minX+r.maxX)/2,(r.minZ+r.maxZ)/2);ctx.fillStyle='#d9c8ff';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText('階段 '+value.id+' '+value.rise,c.sx,c.sy);}
 }
 if(layers.has('walk')){const p=ensureProbe(),want=floorHeights(d).find(f=>f.floor===floor)?.y??0;ctx.fillStyle='rgba(87,196,176,.28)';const s=Math.max(1.5,view.scale*.18);
  for(const n of p.nav.nodes)if(Math.abs(n.y-want)<1.6){const q=S(n.x,n.z);ctx.fillRect(q.sx-s/2,q.sy-s/2,s,s);}}
 if(layers.has('solid')){const p=ensureProbe();ctx.strokeStyle='rgba(255,122,107,.6)';ctx.setLineDash([3,3]);
  for(const b of [...(p.level.walls as any[]),...(p.level.blockers as any[])]){if((b.floor??0)!==floor)continue;rectPath(b.x-b.w/2,b.z-b.d/2,b.x+b.w/2,b.z+b.d/2);ctx.stroke();}ctx.setLineDash([]);}
 for(const kind of ['furniture','walls','doors'] as KindId[])for(const {ref} of items(d,kind)){if(!onFloor(ref))continue;const r=rectOf(d,ref)!;rectPath(r.minX,r.minZ,r.maxX,r.maxZ);ctx.fillStyle=KINDS[kind].color;ctx.fill();}
 if(layers.has('rooms')){ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle='#c9d3dc';const done=new Set<string>();
  const stairIds=new Set(items(d,'stairs').map(i=>i.value.id));
  for(const {ref,value} of items(d,'rooms')){if(!onFloor(ref)||stairIds.has(value.id))continue;const r=rectOf(d,ref)!;if(done.has(value.label+r.minX))continue;done.add(value.label+r.minX);const c=S((r.minX+r.maxX)/2,(r.minZ+r.maxZ)/2);ctx.fillText(String(value.label),c.sx,c.sy);}}
 // Traversals, people, places, markers.
 for(const {ref,value} of items(d,'traversals')){
  const pts=[value.start,...(value.via??[]),value.end];if(!pts.some((p:any)=>Math.abs(p.y-(floorHeights(d).find(f=>f.floor===floor)?.y??0))<1.8))continue;
  ctx.strokeStyle=KINDS.traversals.color;ctx.lineWidth=2;ctx.beginPath();pts.forEach((p:any,i:number)=>{const q=S(p.x,p.z);i?ctx.lineTo(q.sx,q.sy):ctx.moveTo(q.sx,q.sy);});ctx.stroke();ctx.lineWidth=1;
  const q=S(value.start.x,value.start.z);ctx.fillStyle=KINDS.traversals.color;ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText(String(value.id)+' '+value.kind,q.sx+6,q.sy-6);
  void ref;
 }
 if(layers.has('people')){
  for(const {ref,value} of items(d,'npcs')){if(!onFloor(ref))continue;const pts=value.route as number[][];
   ctx.strokeStyle='rgba(180,156,255,.6)';ctx.beginPath();pts.forEach((p,i)=>{const q=S(p[0],p[1]);i?ctx.lineTo(q.sx,q.sy):ctx.moveTo(q.sx,q.sy);});if(pts.length>2)ctx.closePath();ctx.stroke();
   for(const p of pts)dot(p[0],p[1],KINDS.npcs.color,3.5);}
  for(const {ref} of items(d,'schedulePlaces'))if(onFloor(ref)){const v=get(d,ref)!;diamond(v.x,v.z,KINDS.schedulePlaces.color);}
 }
 for(const kind of ['hides','checkpoints','devices','exits'] as KindId[])for(const {ref,value} of items(d,kind))if(onFloor(ref)){
  dot(value.x,value.z,KINDS[kind].color,kind==='exits'?6:4.5);
  if(kind==='exits'){const q=S(value.x,value.z);ctx.strokeStyle=KINDS.exits.color;ctx.beginPath();ctx.arc(q.sx,q.sy,(value.radius??1)*view.scale,0,Math.PI*2);ctx.stroke();}
  if(kind==='devices'&&value.approach){const a=S(value.x,value.z),b=S(value.approach.x,value.approach.z);ctx.strokeStyle=KINDS.devices.color;ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);ctx.stroke();}
 }
 if(floor===0){const q=S(d.spawn.x,d.spawn.z);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(q.sx,q.sy-8);ctx.lineTo(q.sx+6,q.sy+5);ctx.lineTo(q.sx-6,q.sy+5);ctx.closePath();ctx.fill();
  ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('開始',q.sx+8,q.sy+4);}
 if(layers.has('issues'))for(const i of issues)if(i.at&&i.at.floor===floor){const q=S(i.at.x,i.at.z);ctx.strokeStyle=i.level==='error'?'#ff7a6b':'#ffcb6b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.sx,q.sy,9,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;}
 // The probe's route and sight line.
 if(route){for(const end of [route.a,route.b])if(end&&end.floor===floor)dot(end.x,end.z,'#ffe27a',5);
  const res=route.result;if(res?.path){ctx.strokeStyle='#ffe27a';ctx.lineWidth=2.5;ctx.beginPath();res.path.forEach((p,i)=>{const q=S(p.x,p.z);i?ctx.lineTo(q.sx,q.sy):ctx.moveTo(q.sx,q.sy);});ctx.stroke();ctx.lineWidth=1;}
  if(res&&route.b&&route.a.floor===route.b.floor&&route.a.floor===floor){const a=S(route.a.x,route.a.z),b=S(route.b.x,route.b.z);ctx.strokeStyle=res.sight?'rgba(120,220,255,.8)':'rgba(255,122,107,.8)';ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);ctx.stroke();ctx.setLineDash([]);}}
 // Selection.
 if(selected&&get(d,selected)){
  const r=rectOf(d,selected);ctx.strokeStyle='#57c4b0';ctx.lineWidth=2;
  if(r){rectPath(r.minX,r.minZ,r.maxX,r.maxZ);ctx.stroke();for(const hnd of rectHandles(r)){const q=S(hnd.x,hnd.z);ctx.fillStyle='#57c4b0';ctx.fillRect(q.sx-4,q.sy-4,8,8);}}
  for(const hnd of handlesOf(d,selected)){const q=S(hnd.x,hnd.z);ctx.fillStyle='#14171c';ctx.beginPath();ctx.arc(q.sx,q.sy,6,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.lineWidth=1;
 }
 if(drawing){const a=S(drawing.x0,drawing.z0),b=S(drawing.x1,drawing.z1);ctx.strokeStyle='#57c4b0';ctx.setLineDash([4,3]);ctx.strokeRect(a.sx,a.sy,b.sx-a.sx,b.sy-a.sy);ctx.setLineDash([]);}
 function dot(x:number,z:number,color:string,radius:number){const q=S(x,z);ctx.fillStyle=color;ctx.beginPath();ctx.arc(q.sx,q.sy,radius,0,Math.PI*2);ctx.fill();}
 function diamond(x:number,z:number,color:string){const q=S(x,z),s=4.5;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(q.sx,q.sy-s);ctx.lineTo(q.sx+s,q.sy);ctx.lineTo(q.sx,q.sy+s);ctx.lineTo(q.sx-s,q.sy);ctx.closePath();ctx.fill();}
}
function rectHandles(r:{minX:number;maxX:number;minZ:number;maxZ:number}){
 const mx=(r.minX+r.maxX)/2,mz=(r.minZ+r.maxZ)/2;
 return [{x:r.minX,z:r.minZ,edges:['minX','minZ']},{x:mx,z:r.minZ,edges:['minZ']},{x:r.maxX,z:r.minZ,edges:['maxX','minZ']},{x:r.maxX,z:mz,edges:['maxX']},
  {x:r.maxX,z:r.maxZ,edges:['maxX','maxZ']},{x:mx,z:r.maxZ,edges:['maxZ']},{x:r.minX,z:r.maxZ,edges:['minX','maxZ']},{x:r.minX,z:mz,edges:['minX']}];
}

// --- Mouse ----------------------------------------------------------------------------------------------------------
type Drag={type:'pan';sx:number;sy:number;vx:number;vz:number}|{type:'move';ref:Ref;x:number;z:number;moved:boolean}
 |{type:'handle';ref:Ref;part:string}|{type:'resize';ref:Ref;edges:string[]}|{type:'draw'};
let drag:Drag|null=null,drawing:{x0:number;z0:number;x1:number;z1:number;kind:KindId}|null=null,space=false;
const near=(px:number)=>px/view.scale;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 canvas.setPointerCapture(e.pointerId);const w=toWorld(e.offsetX,e.offsetY),free=e.shiftKey;
 if(e.button===1||e.button===2||space){drag={type:'pan',sx:e.offsetX,sy:e.offsetY,vx:view.x,vz:view.z};return;}
 if(tool==='probe'){const at={x:snap(w.x,true),z:snap(w.z,true),floor};route=!route||route.b?{a:at}:{a:route.a,b:at};
  if(route.b)route.result=routeBetween(model.doc,ensureProbe(),route.a,route.b);renderSide();draw();return;}
 const t=TOOLS.find(x=>x.id===tool);
 if(t?.kind){const shape=KINDS[t.kind].shape;
  if(shape==='rect'||shape==='box'){const x=snap(w.x,free),z=snap(w.z,free);drawing={x0:x,z0:z,x1:x,z1:z,kind:t.kind};drag={type:'draw'};return;}
  const ref=model.add(t.kind,{x:snap(w.x,free),z:snap(w.z,free)},floor);select(ref);setTool('select');changed();return;}
 // Select tool: a handle of the selection first, then whatever is under the pointer.
 if(selected){
  const r=rectOf(model.doc,selected);
  for(const hnd of handlesOf(model.doc,selected))if(Math.hypot(hnd.x-w.x,hnd.z-w.z)<near(8)){model.beginDrag();drag={type:'handle',ref:selected,part:hnd.part};return;}
  if(r)for(const hnd of rectHandles(r))if(Math.hypot(hnd.x-w.x,hnd.z-w.z)<near(7)){model.beginDrag();drag={type:'resize',ref:selected,edges:hnd.edges};return;}
 }
 const hits=pick(model.doc,floor,w.x,w.z,near(4),visibleKinds());
 // Clicking again on the same spot steps down to the item underneath.
 const next=selected&&hits.findIndex(h=>sameRef(h,selected))>=0?hits[(hits.findIndex(h=>sameRef(h,selected))+(e.altKey?1:0))%hits.length]:hits[0];
 select(next??null);
 if(next){model.beginDrag();drag={type:'move',ref:next,x:w.x,z:w.z,moved:false};}
});
canvas.addEventListener('pointermove',e=>{
 const w=toWorld(e.offsetX,e.offsetY),free=e.shiftKey;
 $('cursor').textContent='x '+w.x.toFixed(2)+'  z '+w.z.toFixed(2)+'  '+floorName(floor);
 if(!drag)return;
 if(drag.type==='pan'){framed=false;view.x=drag.vx-(e.offsetX-drag.sx)/view.scale;view.z=drag.vz-(e.offsetY-drag.sy)/view.scale;draw();return;}
 if(drag.type==='draw'&&drawing){drawing.x1=snap(w.x,free);drawing.z1=snap(w.z,free);draw();return;}
 if(drag.type==='move'){const dx=snap(w.x-drag.x,free),dz=snap(w.z-drag.z,free);if(!dx&&!dz)return;const d=drag;model.dragTo(doc=>moveItem(doc,d.ref,dx,dz));drag.x+=dx;drag.z+=dz;drag.moved=true;draw();return;}
 if(drag.type==='handle'){const d=drag;model.dragTo(doc=>moveHandle(doc,d.ref,d.part,snap(w.x,free),snap(w.z,free)));draw();return;}
 if(drag.type==='resize'){const d=drag;model.dragTo(doc=>resizeItem(doc,d.ref,d.edges,snap(w.x,free),snap(w.z,free)));draw();}
});
canvas.addEventListener('pointerup',()=>{
 if(drag?.type==='draw'&&drawing){
  const {x0,z0,x1,z1,kind}=drawing,w=Math.abs(x1-x0),d=Math.abs(z1-z0);drawing=null;
  const at=w<.05&&d<.05?{x:x0,z:z0}:{x:Math.min(x0,x1),z:Math.min(z0,z1),w:Math.max(w,.1),d:Math.max(d,.1)};
  select(model.add(kind,at,floor));setTool('select');
 }
 if(drag&&drag.type!=='pan'&&drag.type!=='draw')model.endDrag();
 drag=null;changed();
});
canvas.addEventListener('wheel',e=>{e.preventDefault();framed=false;const before=toWorld(e.offsetX,e.offsetY);view.scale=Math.max(2,Math.min(200,view.scale*Math.exp(-e.deltaY*.0015)));
 const after=toWorld(e.offsetX,e.offsetY);view.x+=before.x-after.x;view.z+=before.z-after.z;draw();},{passive:false});
window.addEventListener('keydown',e=>{
 const typing=(e.target as HTMLElement).matches('input,textarea,select');
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void save();return;}
 if(typing)return;
 if(e.key===' '){space=true;e.preventDefault();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?model.redo():model.undo();changed();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();model.redo();changed();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'&&selected){e.preventDefault();const r=model.duplicate(selected);if(r)select(r);changed();return;}
 if((e.key==='Delete'||e.key==='Backspace')&&selected){model.remove(selected);select(null);changed();return;}
 if(e.key==='Escape'){select(null);setTool('select');route=null;changed();return;}
 if(e.key.startsWith('Arrow')&&selected){e.preventDefault();const s=e.shiftKey?1:.1,ref=selected;
  model.move(ref,e.key==='ArrowLeft'?-s:e.key==='ArrowRight'?s:0,e.key==='ArrowUp'?-s:e.key==='ArrowDown'?s:0);changed();return;}
 const k=e.key.toUpperCase();if(k==='V')setTool('select');if(k==='R')setTool('probe');if(k==='F'){framed=true;fit();}
});
window.addEventListener('keyup',e=>{if(e.key===' ')space=false;});

// --- Panels ---------------------------------------------------------------------------------------------------------
function floorName(f:number){return f===0?'1階':f+1+'階';}
function setFloor(f:number){floor=f;for(const b of $('floors').querySelectorAll('button'))b.classList.toggle('on',Number(b.dataset.floor)===f);draw();}
function renderFloors(){$('floors').replaceChildren(...floorHeights(model.doc).map(f=>{const b=document.createElement('button');b.dataset.floor=String(f.floor);b.textContent=floorName(f.floor);b.onclick=()=>setFloor(f.floor);return b;}));setFloor(floor);}
function setTool(id:string){tool=id;if(id==='probe'&&selected)select(null);if(id!=='probe'){route=null;renderProbe();}for(const b of $('tools').querySelectorAll('button'))b.classList.toggle('on',b.dataset.tool===id);
 const t=TOOLS.find(x=>x.id===id)!,shape=t.kind&&KINDS[t.kind].shape;
 $('hint').textContent=id==='select'?'クリックで選ぶ・ドラッグで動かす・四角の角や辺で大きさ・丸で点を動かす｜Shift：0.1m刻みにしない｜Alt+クリック：下の項目｜右ドラッグ／Space+ドラッグ：移動｜ホイール：拡大｜Delete 削除・Ctrl+D 複製・矢印 0.1m（Shift 1m）'
  :id==='probe'?'地図の2点をクリックすると、歩いて行けるか・何mか・目の高さで見えるかを調べます（階を切り替えて別の階も選べます）'
  :shape==='rect'||shape==='box'?KINDS[t.kind!].label+'：ドラッグして大きさを決めます（Shift：細かく）':KINDS[t.kind!].label+'：置く場所をクリックします';
 canvas.style.cursor=id==='select'?'default':'crosshair';}
function renderTools(){
 const nav=$('tools');nav.replaceChildren();
 const group=(text:string)=>{const d=document.createElement('div');d.className='group';d.textContent=text;nav.append(d);};
 for(const [i,t] of TOOLS.entries()){
  if(i===0)group('操作');if(i===2)group('描く・置く');
  const b=document.createElement('button');b.dataset.tool=t.id;b.innerHTML=t.label+(t.key?'<kbd>'+t.key+'</kbd>':'');b.onclick=()=>setTool(t.id);nav.append(b);
 }
}
function visibleKinds():KindId[]{return DRAW_ORDER.filter(k=>layers.has('people')||!['npcs','schedulePlaces'].includes(k));}
function renderLayers(){$('layers').replaceChildren(...LAYERS.map(([id,label])=>{const l=document.createElement('label');l.style.display='block';
 const c=document.createElement('input');c.type='checkbox';c.checked=layers.has(id);c.onchange=()=>{c.checked?layers.add(id):layers.delete(id);draw();};l.append(c,' '+label);return l;}));}

// The form for the selected item: a field per value, with the editor's own controls for patrols and traversal points.
const FIELD_LABELS:Record<string,string>={id:'id',label:'名前',type:'区分',floor:'階',minX:'左 x',maxX:'右 x',minZ:'上 z',maxZ:'下 z',x:'中心 x',z:'中心 z',y:'床の高さ',w:'幅（x）',d:'奥行き（z）',h:'高さ',
 low:'下の高さ',high:'上の高さ',rise:'上る向き',role:'役',outfit:'服',model:'モデル',faction:'所属',securityRole:'警備の役',combatProfile:'戦い方',disguiseId:'変装',heading:'向き（ラジアン）',
 radius:'半径',capacity:'入れる人数',kind:'種類',a:'つながる区画 a',b:'つながる区画 b',seconds:'秒',facing:'はしごの向き',surface:'床の材質',indoor:'屋内',outdoor:'屋外',target:'標的',spareClothes:'替えの服',width:'幅',zone:'区画',guardId:'担当の警備',weaponPolicy:'武器の扱い',allowedDisguises:'入れる変装',knowsFaces:'顔を知っている人',look:'見る方向',exempt:'検査しない役',approach:'操作する位置',size:'大きさ',normal:'向き',loadout:'持ち物',responders:'対応する人'};
const CHOICES:Record<string,string[]>={type:['public','staff','secure'],rise:['+x','-x','+z','-z'],role:['guest','staff','guard','bodyguard','target'],combatProfile:['civilian','guard','elite'],
 kind:['ladder','drainpipe','window','ledge'],surface:['carpet','tile','wood','concrete','asphalt']};
function renderProbe(){
 $('probe').hidden=!route;if(!route)return;const r=route.result;
 $('probe-text').textContent=!route.b?'2点目をクリックしてください。':r?.blocked?(r.blocked==='start'?'1点目':'2点目')+'が壁や家具に重なっています。':
  (r?.path?'歩いて行けます：約 '+r.metres+' m':'歩いて行けません。')+'\n'+(route.a.floor===route.b.floor?(r?.sight?'目の高さで見通せます（水色の点線）':'目の高さでは見えません（赤の点線）'):'（階が違うので視線は調べていません）');
}
function renderSide(){
 renderProbe();
 const box=$('selection');box.replaceChildren();
 const v=selected&&get(model.doc,selected);
 if(!selected||!v){renderOverview(box);return;}
 const h=document.createElement('h2');h.textContent=KINDS[selected.kind].label+'：'+nameOf(model.doc,selected);box.append(h);
 const ref=selected;
 if(KINDS[ref.kind].keyed){box.append(field('場所の id',textInput(String(ref.key),key=>{const r=model.rename(ref,key);if(r)select(r);changed();})));}
 for(const [key,value] of Object.entries(v)){
  if(key==='route'||key==='start'||key==='end'||key==='via')continue;
  const label=FIELD_LABELS[key]??key;
  if(typeof value==='number')box.append(field(label,numberInput(value,n=>{model.set(ref,{[key]:n});changed();})));
  else if(typeof value==='boolean'){const c=document.createElement('input');c.type='checkbox';c.checked=value;c.onchange=()=>{model.set(ref,{[key]:c.checked});changed();};box.append(field(label,c));}
  else if(typeof value==='string'){
   if(CHOICES[key]&&(CHOICES[key].includes(value)||!value)){const s=document.createElement('select');for(const o of new Set([...CHOICES[key],value]))s.add(new Option(o||'（なし）',o));s.value=value;s.onchange=()=>{model.set(ref,{[key]:s.value});changed();};box.append(field(label,s));}
   else box.append(field(label,textInput(value,t=>{model.set(ref,{[key]:t});changed();})));
  }
  else if(Array.isArray(value)&&value.length>0&&value.length<=3&&value.every(x=>typeof x==='number')){
   const p=document.createElement('div');p.className='pair';value.forEach((n,j)=>p.append(numberInput(n,m=>{model.set(ref,{[key]:(get(model.doc,ref)![key] as number[]).map((o,k)=>k===j?m:o)});changed();})));box.append(field(label,p));
  }
  else if(Array.isArray(value)&&value.every(x=>typeof x==='string'))box.append(field(label+'（,区切り）',textInput(value.join(','),t=>{model.set(ref,{[key]:t.split(',').map(s=>s.trim()).filter(Boolean)});changed();})));
  else if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(x=>typeof x==='number')){
   const p=document.createElement('div');p.className='pair';for(const [k2,n] of Object.entries(value as Record<string,number>)){const i=numberInput(n,m=>{model.set(ref,{[key]:{...(get(model.doc,ref)![key]),[k2]:m}});changed();});i.title=k2;p.append(i);}
   box.append(field(label+' ('+Object.keys(value).join('/')+')',p));
  }
  else{const t=document.createElement('textarea');t.rows=3;t.value=JSON.stringify(value);t.onchange=()=>{try{model.set(ref,{[key]:JSON.parse(t.value)});changed();}catch{t.style.borderColor='#ff7a6b';}};box.append(field(label,t));}
 }
 if(Array.isArray(v.route)){const t=document.createElement('h2');t.textContent='巡回（x・z・待つ秒）';box.append(t);
  (v.route as number[][]).forEach((p,i)=>{const row=document.createElement('div');row.className='triple';
   p.slice(0,3).forEach((n,j)=>row.append(numberInput(n??0,m=>{model.set(ref,{route:get(model.doc,ref)!.route.map((q:number[],k:number)=>k===i?q.map((o,l)=>l===j?m:o):q)});changed();})));
   const x=document.createElement('button');x.textContent='×';x.title='この点を消す';x.disabled=v.route.length<2;x.onclick=()=>{model.set(ref,{route:v.route.filter((_:unknown,k:number)=>k!==i)});changed();};row.append(x);box.append(row);});
  const add=document.createElement('button');add.textContent='＋ 点を足す';add.onclick=()=>{const last=v.route.at(-1);model.set(ref,{route:[...v.route,[last[0]+1,last[1],0]]});changed();};box.append(add);}
 if(v.start){const t=document.createElement('h2');t.textContent='経路の点（x・高さ・z）';box.append(t);
  const pts:[string,any][]=[['start',v.start],...(v.via??[]).map((p:any,i:number)=>['via.'+i,p] as [string,any]),['end',v.end]];
  for(const [part,p] of pts){const row=document.createElement('div');row.className='triple';
   for(const axis of ['x','y','z'])row.append(numberInput(p[axis],m=>{model.change(doc=>{const o=get(doc,ref)!;const [n,i]=part.split('.');(n==='via'?o.via[Number(i)]:o[n])[axis]=m;});changed();}));
   const tag=document.createElement('span');tag.className='muted';tag.textContent=part==='start'?'始':part==='end'?'終':'経';row.append(tag);box.append(row);}}
 const row=document.createElement('div');row.className='row';
 const btn=(text:string,fn:()=>void,title='')=>{const b=document.createElement('button');b.textContent=text;b.title=title;b.onclick=fn;row.append(b);};
 btn('ここを表示',()=>focus(centre(model.doc,ref)));
 if(!KINDS[ref.kind].single){btn('複製',()=>{const r=model.duplicate(ref);if(r)select(r);changed();},'Ctrl+D');btn('削除',()=>{model.remove(ref);select(null);changed();},'Delete');}
 btn('選ぶのをやめる',()=>{select(null);changed();},'Esc');
 box.append(row);
}
function renderOverview(box:HTMLElement){
 const h=document.createElement('h2');h.textContent='項目を探す';box.append(h);
 const q=document.createElement('input');q.placeholder='名前や id で絞り込む';q.style.width='100%';box.append(q);
 const list=document.createElement('div');list.className='list';box.append(list);
 const fill=()=>{list.replaceChildren();const text=q.value.trim().toLowerCase();
  for(const kind of [...DRAW_ORDER].reverse()){const rows=items(model.doc,kind).filter(({ref})=>!text||nameOf(model.doc,ref).toLowerCase().includes(text)||String(ref.key).toLowerCase().includes(text));
   if(!rows.length)continue;const k=document.createElement('div');k.className='kind';k.textContent=KINDS[kind].label+'（'+rows.length+'）';list.append(k);
   for(const {ref} of rows.slice(0,text?200:40)){const b=document.createElement('button');b.textContent=nameOf(model.doc,ref)+' · '+floorName(floorOfItem(model.doc,ref));b.onclick=()=>{select(ref);focus(centre(model.doc,ref));changed();};list.append(b);}}};
 q.oninput=fill;fill();
}
function field(label:string,input:HTMLElement){const d=document.createElement('div');d.className='field';const l=document.createElement('label');l.textContent=label;d.append(l,input);return d;}
function numberInput(value:number,set:(n:number)=>void){const i=document.createElement('input');i.type='number';i.step='0.05';i.value=String(Math.round(value*1000)/1000);
 i.onchange=()=>{const n=Number(i.value);if(Number.isFinite(n))set(n);};return i;}
function textInput(value:string,set:(t:string)=>void){const i=document.createElement('input');i.value=value;i.onchange=()=>set(i.value);return i;}
function renderIssues(){
 const list=$('issues');list.replaceChildren();const errors=issues.filter(i=>i.level==='error').length,warnings=issues.length-errors;
 $('issue-count').innerHTML=issues.length?`<span style="color:var(--err)">エラー ${errors}</span> · <span style="color:var(--warn)">注意 ${warnings}</span>`:'<span class="ok">なし</span>';
 for(const i of issues.slice(0,200)){const li=document.createElement('li'),b=document.createElement('button');b.className=i.level;b.textContent=i.text;
  b.onclick=()=>{if(i.ref)select(i.ref);focus(i.at??(i.ref?centre(model.doc,i.ref):null));changed();};li.append(b);list.append(li);}
}
function select(ref:Ref|null){selected=ref;renderSide();}

// --- Change, check, save --------------------------------------------------------------------------------------------
let checkTimer=0;
function changed(){
 $<HTMLButtonElement>('undo').disabled=!model.canUndo;$<HTMLButtonElement>('redo').disabled=!model.canRedo;
 $('dirty').textContent=model.dirty?'● 未保存':'';
 if(selected&&!get(model.doc,selected))selected=null;
 renderSide();draw();
 clearTimeout(checkTimer);checkTimer=window.setTimeout(()=>{issues=checkMap(model.doc,ensureProbe());renderIssues();draw();},250);
}
function json(){const {devices,...layout}=model.doc;return {layout,devices:devices??[]};}
async function save(){
 if(model.name!=='club'){exportJson();return;}
 const errors=checkMap(model.doc,ensureProbe()).filter(i=>i.level==='error');
 if(errors.length&&!confirm('エラーが '+errors.length+' 件あります（例：'+errors[0].text+'）。このまま保存しますか？'))return;
 $('dirty').textContent='保存中…';
 try{
  const r=await fetch('/api/map-layout?map=club',{method:'POST',headers:{'Content-Type':'application/json','X-Map-Lab':'1'},body:JSON.stringify(json())});
  const body=await r.json().catch(()=>({ok:false,log:r.statusText}));
  if(!r.ok||!body.ok)throw new Error(body.log||r.statusText);
  model.saved=model.revision;$('dirty').textContent='保存しました（ゲームにも反映）';
 }catch(error){$('dirty').textContent='保存できません';alert('保存できませんでした。\n確認用サーバー（start-dev.bat）の http://127.0.0.1:8795/map-lab から開いてください。\n\n'+String(error).slice(0,600));}
}
function exportJson(){const url=URL.createObjectURL(new Blob([JSON.stringify(json().layout,null,1)+'\n'],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=(model.name==='club'?'club-layout':'map-layout')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function loadMap(name:string){
 if(model.dirty&&!confirm('保存していない変更があります。捨てて開きますか？'))return false;
 let doc=name==='club'?clubDoc():blankDoc();
 // From the server, the club as it is on disk now (the built page may be older than the last save).
 if(name==='club')try{const r=await fetch('/api/map-layout?map=club');if(r.ok){const b=await r.json();doc={...b.layout,devices:b.devices};}}catch{/* opened as a file: use the built-in copy */}
 model=new MapModel(doc,name);selected=null;route=null;floor=0;probe=null;
 renderFloors();fit();changed();return true;
}

// --- Start ----------------------------------------------------------------------------------------------------------
renderTools();renderLayers();setTool('select');
$('undo').onclick=()=>{model.undo();changed();};$('redo').onclick=()=>{model.redo();changed();};$('fit').onclick=()=>{framed=true;fit();};
$('save').onclick=()=>void save();$('export').onclick=exportJson;
const mapSelect=$<HTMLSelectElement>('map');mapSelect.onchange=async()=>{if(!await loadMap(mapSelect.value))mapSelect.value=model.name;$('save').textContent=mapSelect.value==='club'?'保存してゲームに反映':'JSONを書き出す';};
window.addEventListener('beforeunload',e=>{if(model.dirty)e.preventDefault();});
new ResizeObserver(resize).observe($('stage'));
void loadMap('club');

// --- For Claude: the same operations as the mouse, by name -----------------------------------------------------------
const api={
 /** Kinds, their Japanese names and shapes. */
 kinds:()=>Object.fromEntries(Object.entries(KINDS).map(([k,d])=>[k,{label:d.label,shape:d.shape}])),
 doc:()=>model.doc,
 /** Items of a kind (or every kind), as {ref,name,floor}. */
 list:(kind?:KindId)=>(kind?[kind]:DRAW_ORDER).flatMap(k=>items(model.doc,k).map(({ref})=>({ref,name:nameOf(model.doc,ref),floor:floorOfItem(model.doc,ref)}))),
 find:(text:string)=>api.list().filter(i=>i.name.includes(text)||String(i.ref.key).includes(text)),
 get:(ref:Ref)=>get(model.doc,ref),
 select:(ref:Ref|null)=>{select(ref);if(ref)focus(centre(model.doc,ref));changed();},
 selected:()=>selected,
 add:(kind:KindId,at:{x:number;z:number;w?:number;d?:number},onFloor=floor)=>{const r=model.add(kind,at,onFloor);select(r);changed();return r;},
 set:(ref:Ref,patch:Record<string,unknown>)=>{const ok=model.set(ref,patch);changed();return ok;},
 move:(ref:Ref,dx:number,dz:number)=>{const ok=model.move(ref,dx,dz);changed();return ok;},
 remove:(ref:Ref)=>{const ok=model.remove(ref);changed();return ok;},
 undo:()=>{const ok=model.undo();changed();return ok;},redo:()=>{const ok=model.redo();changed();return ok;},
 /** Problems as the panel lists them (computed now). */
 check:()=>checkMap(model.doc,ensureProbe()),
 route:(a:{x:number;z:number;floor:number},b:{x:number;z:number;floor:number})=>{route={a,b,result:routeBetween(model.doc,ensureProbe(),a,b)};renderSide();draw();return route.result;},
 floor:(f:number)=>setFloor(f),view:(v:Partial<typeof view>)=>{Object.assign(view,v);draw();},fit,
 layers:(on:string[])=>{layers.clear();for(const l of on)layers.add(l);renderLayers();draw();},
 load:(name:'club'|'blank')=>{model.saved=model.revision;mapSelect.value=name;return loadMap(name);},
 save,dirty:()=>model.dirty,
 /** The plan as a PNG data URL (post it to 8797 to keep it). */
 picture:()=>{draw();return canvas.toDataURL('image/png');},
};
Object.assign(window,{__mapLab:api});

// Pose editor for Agent 07's one-handed pistol stance (2026-11-08). Part of the animation lab.
// The user shapes the stance by feel: sliders in degrees and centimetres, a handle on the gun to drag it about in the
// view, and a reference photo laid over the view (opacity, size, position, mirror, difference blend) to match against.
// The result is written out as JSON (copy or file) for a developer to build into combat-motion.ts; nothing here
// changes the game by itself.
import * as T from 'three';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import type {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {AGENT_PISTOL_STANCE,AGENT_PISTOL_VARIANTS,type PistolVariant,type Hold} from '../combat-motion';

type V3=[number,number,number];
export type EditorStance={bones:Record<string,V3>;hold:{pos:V3;rot:V3}};
export type PoseEditorHost={
 camera:T.PerspectiveCamera;controls:OrbitControls;canvas:HTMLCanvasElement;scene:T.Scene;
 /** The agent's group (the gun handle rides in it), once loaded. */
 agentGroup():T.Object3D|undefined;
 /** Show this stance on the agent (null: the game's own stance). */
 setStance(v:PistolVariant|null):void;
 /** Play a clip from the start (looping clips loop). */
 play(clipId:string,playing:boolean):void;
 /** Draw now (for the picture export). */
 render():void;
 /** How far the right hand misses the grip (m) and the right elbow's angle (degrees, 180 = straight). */
 measure():{grip:number;elbow:number}|null;
 /** Agent alone, a one-handed gun, the aim clip. */
 prepare():void;
};

const R=Math.PI/180;
// Rest values of the channels the stance can set (combat-motion.ts neutral()).
const REST:Record<string,V3>={chest:[0,0,0],neck:[0,0,0],head:[0,0,0],clavicler:[0,0,0],claviclel:[0,0,0],upperarmr:[-.05,0,1.45],forearmr:[0,.24,0],upperarml:[-.05,0,-1.45],forearml:[0,-.24,0]};
type Slider={id:string;label:string;min:number;max:number;unit:'°'|'cm';get:(s:EditorStance)=>number;set:(s:EditorStance,v:number)=>void;hint?:string};
const bone=(b:string,axis:0|1|2,label:string,min:number,max:number,hint?:string):Slider=>({id:`${b}-${axis}`,label,min,max,unit:'°',hint,
 get:s=>s.bones[b][axis]/R,set:(s,v)=>{s.bones[b][axis]=v*R;}});
const gunPos=(axis:0|1|2,label:string,min:number,max:number,hint?:string):Slider=>({id:`pos-${axis}`,label,min,max,unit:'cm',hint,
 get:s=>s.hold.pos[axis]*100,set:(s,v)=>{s.hold.pos[axis]=v/100;}});
const gunRot=(axis:0|1|2,label:string,min:number,max:number,hint?:string):Slider=>({id:`rot-${axis}`,label,min,max,unit:'°',hint,
 get:s=>s.hold.rot[axis]/R,set:(s,v)=>{s.hold.rot[axis]=v*R;}});
// +X is the character's left, +Y up, +Z forward (toward the target).
const GROUPS:{title:string;open?:boolean;sliders:Slider[]}[]=[
 {title:'銃（右手はここに付いていきます）',open:true,sliders:[
  gunPos(2,'前後（遠く ↔ 近く）',0,100,'大きいほど相手の方へ遠い'),gunPos(1,'高さ',90,180),gunPos(0,'左右（＋で体の左へ）',-50,40),
  gunRot(0,'銃口の上下（＋で下向き）',-60,60),gunRot(1,'銃口の左右（＋で左向き）',-60,60),gunRot(2,'銃を横に寝かせる',-90,90)]},
 {title:'胸',open:true,sliders:[
  bone('chest',1,'ひねり（＋で右肩が相手へ）',-100,100),bone('chest',0,'前かがみ（＋）・反る（－）',-30,40),bone('chest',2,'左右に傾ける',-30,30)]},
 {title:'首と顔',open:true,sliders:[
  bone('neck',1,'首の向き',-90,90),bone('head',1,'顔の向き',-90,90),bone('head',0,'うなずく（＋で下）',-40,40),bone('head',2,'首をかしげる',-30,30)]},
 {title:'右肩・右腕',sliders:[
  bone('clavicler',1,'右肩を前後に',-40,40),bone('clavicler',2,'右肩を上下に',-40,40),
  bone('upperarmr',2,'右肘の張り出し（目安）',-60,120,'右手は銃に付くので、肘の向きの目安だけ変わります'),bone('forearmr',1,'右肘の曲げ（目安）',-30,150)]},
 {title:'左腕（空いている手）',open:true,sliders:[
  bone('upperarml',0,'前後に振る（－で前）',-120,90),bone('upperarml',2,'脇を開く（0に近いほど開く）',-100,0),
  bone('forearml',1,'肘を曲げる（－で曲がる）',-150,10),bone('claviclel',1,'左肩を前後に',-40,40)]},
];
const SLIDERS=GROUPS.flatMap(g=>g.sliders);
const KEY='clean-hands.pose-editor.v1',PHOTO_KEY='clean-hands.pose-editor.photo';

function fromVariant(id:string):EditorStance{
 const v=AGENT_PISTOL_VARIANTS[id],src=v?.hold?{bones:v.bones??{},hold:v.hold}:AGENT_PISTOL_STANCE;
 const bones:Record<string,V3>={};for(const [n,r] of Object.entries(REST))bones[n]=[...((src.bones as Record<string,V3>)[n]??r)] as V3;
 return {bones,hold:{pos:[...src.hold.pos] as V3,rot:[...src.hold.rot] as V3}};
}
const clone=(s:EditorStance):EditorStance=>structuredClone(s);
const round=(v:number,d=3)=>+v.toFixed(d);

export function createPoseEditor(host:PoseEditorHost,mount:HTMLElement){
 const box=document.createElement('details');box.id='pose-edit';
 box.innerHTML=`<summary>構えエディタ（写真に合わせる）</summary>
<p class="pe-help">スライダーか、画面の銃の矢印を引っぱって構えを作ります。写真を重ねて合わせ、最後に「データをコピー」で渡してください。ゲームはまだ変わりません。</p>
<div class="pe-sec"><b>出発点</b><div class="row">${['F','E','A','B','C','D'].map(id=>`<button data-pe-from="${id}" title="${AGENT_PISTOL_VARIANTS[id]?.note??''}">${id==='F'?'ゲーム中(F)':id}</button>`).join('')}</div></div>
<div class="pe-sec"><b>銃を手で動かす</b><div class="row"><button data-pe-gizmo="translate" class="on">移動 (1)</button><button data-pe-gizmo="rotate">回転 (2)</button><button data-pe-gizmo="off">矢印を隠す (3)</button></div>
<div class="row"><button id="pe-undo" title="Ctrl+Z">↶ 戻す</button><button id="pe-redo" title="Ctrl+Y">↷ やり直す</button><label><input id="pe-game" type="checkbox"> ゲームの構えと比べる</label></div>
<p id="pe-check" class="pe-check"></p></div>
<div class="pe-sec"><b>動きで確かめる</b><div class="row"><button data-pe-clip="combat-aim">構え</button><button data-pe-clip="combat-fire">撃つ</button><button data-pe-clip="combat-draw">抜く</button><button data-pe-clip="combat-reload">弾込め</button></div></div>
<details class="pe-sec" open><summary><b>写真を重ねる</b></summary>
<div class="row"><label class="pe-file">写真を選ぶ<input id="pe-photo" type="file" accept="image/*"></label><button id="pe-photo-clear">外す</button></div>
<p class="pe-help">画面にドラッグ＆ドロップ、Ctrl+V の貼り付けでも入ります。</p>
<label class="pe-s"><span>濃さ</span><output id="pe-op-v"></output><input id="pe-op" type="range" min="0" max="100" value="50"></label>
<label class="pe-s"><span>大きさ</span><output id="pe-sc-v"></output><input id="pe-sc" type="range" min="20" max="300" value="100"></label>
<label class="pe-s"><span>左右の位置</span><output id="pe-x-v"></output><input id="pe-x" type="range" min="-100" max="100" value="0"></label>
<label class="pe-s"><span>上下の位置</span><output id="pe-y-v"></output><input id="pe-y" type="range" min="-100" max="100" value="0"></label>
<div class="row"><label><input id="pe-flip" type="checkbox"> 左右反転</label><label><input id="pe-diff" type="checkbox"> 差を見る</label><label><input id="pe-drag" type="checkbox"> 写真をつかんで動かす</label></div>
<p class="pe-help">「写真をつかんで動かす」中は、写真をドラッグで移動、ホイールで拡大縮小します。</p>
<label class="pe-s"><span>カメラの画角（写真のレンズに合わせる）</span><output id="pe-fov-v"></output><input id="pe-fov" type="range" min="10" max="80" value="35"></label>
<div class="row"><label><input id="pe-lock" type="checkbox"> カメラを固定</label><button data-pe-view="0">正面</button><button data-pe-view="60">写真の向き</button><button data-pe-view="-90">横</button></div>
</details>
${GROUPS.map(g=>`<details class="pe-sec"${g.open?' open':''}><summary><b>${g.title}</b></summary>${g.sliders.map(s=>`<label class="pe-s" title="${s.hint??'ダブルクリックで出発点の値に戻す'}"><span>${s.label}</span><output data-pe-v="${s.id}"></output><input data-pe="${s.id}" type="range" min="${s.min}" max="${s.max}" step="${s.unit==='cm'?.5:1}"></label>`).join('')}</details>`).join('')}
<div class="pe-sec"><b>メモ（任意）</b><textarea id="pe-note" rows="2" placeholder="例：もう少し肩を上げたい"></textarea></div>
<div class="row pe-out"><button id="pe-copy" class="pe-main">データをコピー</button><button id="pe-file">ファイルに保存</button><button id="pe-shot">画像も保存</button></div>
<div class="row"><button id="pe-load">データを読み込む</button></div>
<p id="pe-status" role="status" class="pe-help"></p>`;
 mount.after(box);
 const css=document.createElement('style');css.textContent=`
#panel{overflow-x:hidden}#pose-edit{margin-top:12px;padding:10px;border:1px solid #7a6a45;border-radius:8px;background:#2a2822}
#pose-edit>summary{cursor:pointer;color:#f3d28c;font-weight:700;font-size:14px}
#pose-edit .pe-help{margin:4px 0;color:#bdbab0;font-size:12px}#pose-edit .pe-sec{margin:10px 0 0;border-top:1px solid #3d3a33;padding-top:6px}
#pose-edit details.pe-sec>summary{cursor:pointer;color:#e3c989}#pose-edit b{color:#e3c989;font-weight:650}
.pe-s{display:grid;grid-template-columns:1fr auto;margin:4px 0;font-size:12px}.pe-s input{grid-column:1/-1;width:100%;margin:1px 0;accent-color:#e3c989}
.pe-s output{font-variant-numeric:tabular-nums;color:#f3d28c}#pose-edit button.on{background:#e3c989;color:#241f14;border-color:#e3c989}
.pe-check{font-size:12px;margin:4px 0;font-variant-numeric:tabular-nums}.pe-check .bad{color:#ff8a6a}.pe-check .ok{color:#9fd49a}
#pose-edit textarea{width:100%;background:#14171b;color:#eee;border:1px solid #3a404a;border-radius:6px}
.pe-main{background:#e3c989!important;color:#241f14!important;border-color:#e3c989!important;font-weight:700}
.pe-file{display:inline-block;background:#2a2f37;border:1px solid #474e59;border-radius:6px;padding:4px 8px;cursor:pointer}.pe-file input{display:none}
#pe-overlay{position:fixed;left:0;top:0;width:calc(100vw - 320px);height:calc(100vh - 56px);overflow:hidden;pointer-events:none;z-index:2}
#pe-overlay img{position:absolute;max-width:none;user-select:none;-webkit-user-drag:none}
#pe-overlay.drag{pointer-events:auto;cursor:move;outline:2px dashed #e3c989;outline-offset:-2px}
@media (max-width:900px){#pe-overlay{width:100vw;height:55vh}}`;
 document.head.append(css);
 const $=<E extends HTMLElement=HTMLElement>(s:string)=>box.querySelector<E>(s)!;

 // --- state, with undo
 let stance:EditorStance=load()??fromVariant('F');
 const undo:EditorStance[]=[],redo:EditorStance[]=[];
 function commit(){undo.push(clone(stance));if(undo.length>200)undo.shift();redo.length=0;}
 let pending=clone(stance); // the state before the current drag/slide
 function load():EditorStance|null{try{const j=JSON.parse(localStorage.getItem(KEY)??'null');return j?.stance?.bones&&j?.stance?.hold?fill(j.stance):null;}catch{return null;}}
 function fill(s:{bones:Record<string,V3>;hold:{pos:V3;rot:V3}}):EditorStance{const out=fromVariant('F');for(const n of Object.keys(out.bones))if(s.bones[n])out.bones[n]=[...s.bones[n]] as V3;out.hold={pos:[...s.hold.pos] as V3,rot:[...s.hold.rot] as V3};return out;}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(exportData()));}catch{/* private mode: still works this session */}}

 // --- sliders
 const inputs=new Map(SLIDERS.map(s=>[s.id,box.querySelector<HTMLInputElement>(`[data-pe="${s.id}"]`)!]));
 let base=clone(stance); // the starting point (double-click resets a slider to it)
 function syncSliders(){for(const s of SLIDERS){const v=s.get(stance);inputs.get(s.id)!.value=String(v);box.querySelector(`[data-pe-v="${s.id}"]`)!.textContent=`${v>0&&s.unit==='°'?'+':''}${v.toFixed(s.unit==='cm'?1:0)}${s.unit}`;}}
 for(const s of SLIDERS){const el=inputs.get(s.id)!;
  el.addEventListener('pointerdown',()=>{pending=clone(stance);});
  el.oninput=()=>{s.set(stance,el.valueAsNumber);apply();};
  el.onchange=()=>{undo.push(pending);redo.length=0;save();};
  el.ondblclick=()=>{commit();s.set(stance,s.get(base));apply();save();};}

 // --- the gun handle
 const proxy=new T.Object3D();proxy.name='pose-editor-gun';
 const gizmo=new TransformControls(host.camera,host.canvas);gizmo.setSize(.8);gizmo.setSpace('local');
 const helper=gizmo.getHelper();host.scene.add(helper);
 gizmo.addEventListener('dragging-changed',e=>{const d=(e as unknown as {value:boolean}).value;host.controls.enabled=!d&&!$<HTMLInputElement>('#pe-lock').checked;if(d)pending=clone(stance);else{undo.push(pending);redo.length=0;save();}});
 gizmo.addEventListener('objectChange',()=>{stance.hold.pos=proxy.position.toArray() as V3;const e=proxy.rotation;stance.hold.rot=[e.x,e.y,e.z];apply();});
 let mode:'translate'|'rotate'|'off'='translate';
 function setMode(m:typeof mode){mode=m;box.querySelectorAll<HTMLButtonElement>('[data-pe-gizmo]').forEach(b=>b.classList.toggle('on',b.dataset.peGizmo===m));
  if(m==='off')gizmo.detach();else{gizmo.setMode(m);if(active)gizmo.attach(proxy);}}
 box.querySelectorAll<HTMLButtonElement>('[data-pe-gizmo]').forEach(b=>{b.onclick=()=>setMode(b.dataset.peGizmo as typeof mode);});

 // --- applying
 let active=false;
 function variant():PistolVariant{const hold:Hold={anchor:'GRIP_R',pos:[...stance.hold.pos],rot:[...stance.hold.rot]};return {label:'エディタ',note:'',bones:structuredClone(stance.bones),hold};}
 function apply(sync=true){if(sync)syncSliders();if(!active)return;
  host.setStance($<HTMLInputElement>('#pe-game').checked?null:variant());
  if(!gizmo.dragging){proxy.position.set(...stance.hold.pos);proxy.rotation.set(...stance.hold.rot,'XYZ');}}
 function attach(){const g=host.agentGroup();if(!g)return false;if(proxy.parent!==g)g.add(proxy);if(mode!=='off'){gizmo.setMode(mode);gizmo.attach(proxy);}return true;}
 function start(){active=true;host.prepare();const tryAttach=()=>{if(!active)return;if(!attach())setTimeout(tryAttach,200);};tryAttach();apply();}
 function stop(){active=false;gizmo.detach();host.setStance(null);}
 box.ontoggle=()=>{if(box.open)start();else stop();};

 box.querySelectorAll<HTMLButtonElement>('[data-pe-from]').forEach(b=>{b.onclick=()=>{commit();stance=fromVariant(b.dataset.peFrom!);base=clone(stance);apply();save();status(`${b.textContent} から始めます。`);};});
 $('#pe-undo').onclick=()=>{const s=undo.pop();if(!s)return;redo.push(clone(stance));stance=s;apply();save();};
 $('#pe-redo').onclick=()=>{const s=redo.pop();if(!s)return;undo.push(clone(stance));stance=s;apply();save();};
 $<HTMLInputElement>('#pe-game').onchange=()=>apply();
 box.querySelectorAll<HTMLButtonElement>('[data-pe-clip]').forEach(b=>{b.onclick=()=>host.play(b.dataset.peClip!,b.dataset.peClip!=='combat-aim');});
 addEventListener('keydown',e=>{if(!active||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLInputElement&&e.target.type!=='range'&&e.target.type!=='checkbox')return;
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();$('#pe-undo').click();}
  else if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();$('#pe-redo').click();}
  else if(e.code==='Digit1')setMode('translate');else if(e.code==='Digit2')setMode('rotate');else if(e.code==='Digit3')setMode('off');});

 // --- the photo overlay
 const layer=document.createElement('div');layer.id='pe-overlay';const img=document.createElement('img');img.alt='';layer.append(img);document.body.append(layer);img.style.display='none';
 const ov={opacity:50,scale:100,x:0,y:0,flip:false,diff:false,file:''};
 const ovIn=(id:string)=>$<HTMLInputElement>(id);
 function layout(){const w=layer.clientWidth,h=layer.clientHeight;if(!img.naturalWidth)return null;
  const fit=Math.min(w/img.naturalWidth,h/img.naturalHeight)*ov.scale/100,iw=img.naturalWidth*fit,ih=img.naturalHeight*fit;
  return {x:w/2+ov.x/100*w/2-iw/2,y:h/2+ov.y/100*h/2-ih/2,w:iw,h:ih};}
 function drawOverlay(){const g=layout();img.style.display=g&&box.open?'':'none';
  if(g)Object.assign(img.style,{left:g.x+'px',top:g.y+'px',width:g.w+'px',height:g.h+'px',opacity:String(ov.opacity/100),transform:ov.flip?'scaleX(-1)':'',mixBlendMode:ov.diff?'difference':'normal'});
  ovIn('#pe-op').value=String(ov.opacity);ovIn('#pe-sc').value=String(ov.scale);ovIn('#pe-x').value=String(ov.x);ovIn('#pe-y').value=String(ov.y);
  $('#pe-op-v').textContent=ov.opacity+'%';$('#pe-sc-v').textContent=ov.scale+'%';$('#pe-x-v').textContent=String(Math.round(ov.x));$('#pe-y-v').textContent=String(Math.round(ov.y));}
 for(const [id,k] of [['#pe-op','opacity'],['#pe-sc','scale'],['#pe-x','x'],['#pe-y','y']] as const)ovIn(id).oninput=()=>{ov[k]=ovIn(id).valueAsNumber;drawOverlay();saveOv();};
 ovIn('#pe-flip').onchange=()=>{ov.flip=ovIn('#pe-flip').checked;drawOverlay();saveOv();};
 ovIn('#pe-diff').onchange=()=>{ov.diff=ovIn('#pe-diff').checked;drawOverlay();saveOv();};
 ovIn('#pe-drag').onchange=()=>layer.classList.toggle('drag',ovIn('#pe-drag').checked);
 img.onload=()=>drawOverlay();addEventListener('resize',drawOverlay);
 function setPhoto(url:string,name:string,keep=true){ov.file=name;img.src=url;status(`写真「${name}」を重ねました。`);if(keep){try{localStorage.setItem(PHOTO_KEY,JSON.stringify({url,name}));}catch{status(`写真「${name}」を重ねました（大きいので、再読み込みすると消えます）。`);}}}
 function readFile(f:File){if(!f.type.startsWith('image/'))return;const r=new FileReader();r.onload=()=>setPhoto(String(r.result),f.name);r.readAsDataURL(f);}
 ovIn('#pe-photo').onchange=()=>{const f=ovIn('#pe-photo').files?.[0];if(f)readFile(f);};
 $('#pe-photo-clear').onclick=()=>{img.removeAttribute('src');img.style.display='none';ov.file='';try{localStorage.removeItem(PHOTO_KEY);}catch{/* */}};
 addEventListener('dragover',e=>{if(box.open)e.preventDefault();});
 addEventListener('drop',e=>{if(!box.open)return;e.preventDefault();const f=e.dataTransfer?.files?.[0];if(f)readFile(f);});
 addEventListener('paste',e=>{if(!box.open)return;const f=[...(e.clipboardData?.files??[])][0];if(f){e.preventDefault();readFile(f);}});
 {let from:{x:number;y:number;ox:number;oy:number}|null=null;
  layer.addEventListener('pointerdown',e=>{from={x:e.clientX,y:e.clientY,ox:ov.x,oy:ov.y};layer.setPointerCapture(e.pointerId);});
  layer.addEventListener('pointermove',e=>{if(!from)return;ov.x=from.ox+(e.clientX-from.x)/layer.clientWidth*200;ov.y=from.oy+(e.clientY-from.y)/layer.clientHeight*200;drawOverlay();});
  layer.addEventListener('pointerup',()=>{from=null;saveOv();});
  layer.addEventListener('wheel',e=>{e.preventDefault();ov.scale=Math.max(20,Math.min(300,Math.round(ov.scale*(e.deltaY<0?1.05:1/1.05))));drawOverlay();saveOv();},{passive:false});}
 function saveOv(){try{localStorage.setItem(KEY+'.overlay',JSON.stringify({...ov,fov:host.camera.fov}));}catch{/* */}}
 try{const o=JSON.parse(localStorage.getItem(KEY+'.overlay')??'null');if(o){Object.assign(ov,o);ovIn('#pe-flip').checked=ov.flip;ovIn('#pe-diff').checked=ov.diff;if(o.fov){host.camera.fov=o.fov;host.camera.updateProjectionMatrix();}}
  const p=JSON.parse(localStorage.getItem(PHOTO_KEY)??'null');if(p?.url)setPhoto(p.url,p.name,false);}catch{/* */}
 const fov=ovIn('#pe-fov');const syncFov=()=>{fov.value=String(Math.round(host.camera.fov));$('#pe-fov-v').textContent=Math.round(host.camera.fov)+'°';};
 fov.oninput=()=>{host.camera.fov=fov.valueAsNumber;host.camera.updateProjectionMatrix();syncFov();saveOv();};syncFov();
 ovIn('#pe-lock').onchange=()=>{host.controls.enabled=!ovIn('#pe-lock').checked;};
 box.querySelectorAll<HTMLButtonElement>('[data-pe-view]').forEach(b=>{b.onclick=()=>{const g=host.agentGroup(),x=g?.position.x??0,r=Number(b.dataset.peView)*R,d=3.2;
  host.controls.target.set(x,1.15,.2);host.camera.position.set(x+Math.sin(r)*d,1.35,.2+Math.cos(r)*d);host.controls.update();};});

 // --- output
 function exportData(){const m=host.measure(),c=host.camera,t=host.controls.target;
  return {type:'clean-hands/agent-pistol-stance',version:1,savedAt:new Date().toISOString(),
   about:'Agent 07 one-handed pistol aim. Bones: XYZ radians on the shared rig (+X = character left, +Y up, +Z forward). hold: GRIP_R position (m) and XYZ rotation (rad) in the actor space.',
   note:$<HTMLTextAreaElement>('#pe-note').value,
   stance:{bones:Object.fromEntries(Object.entries(stance.bones).map(([n,v])=>[n,v.map(x=>round(x))])),hold:{anchor:'GRIP_R',pos:stance.hold.pos.map(x=>round(x)),rot:stance.hold.rot.map(x=>round(x))}},
   check:m?{gripMissCm:round(m.grip*100,1),rightElbowDeg:round(m.elbow,0)}:null,
   camera:{position:c.position.toArray().map(x=>round(x)),target:t.toArray().map(x=>round(x)),fov:round(c.fov,1)},
   overlay:{file:ov.file,opacity:ov.opacity,scale:ov.scale,x:round(ov.x,1),y:round(ov.y,1),flip:ov.flip}};}
 const text=()=>JSON.stringify(exportData(),null,1);
 $('#pe-copy').onclick=async()=>{try{await navigator.clipboard.writeText(text());status('コピーしました。チャットに貼り付けて渡してください。');}catch{prompt('コピーできませんでした。下の文字を全部選んでコピーしてください。',text());}};
 const stamp=()=>new Date().toISOString().slice(0,16).replace(/[-:T]/g,'');
 const download=(url:string,name:string)=>{const a=document.createElement('a');a.href=url;a.download=name;a.click();};
 $('#pe-file').onclick=()=>{const url=URL.createObjectURL(new Blob([text()],{type:'application/json'}));download(url,`pistol-stance-${stamp()}.json`);setTimeout(()=>URL.revokeObjectURL(url),1000);status('JSON ファイルを保存しました。');};
 $('#pe-shot').onclick=()=>{host.render();const cv=host.canvas,out=document.createElement('canvas');out.width=cv.width;out.height=cv.height;const g=out.getContext('2d')!;g.drawImage(cv,0,0);
  const L=layout();if(L&&img.style.display!=='none'){const k=cv.width/layer.clientWidth;g.save();g.globalAlpha=ov.opacity/100;if(ov.diff)g.globalCompositeOperation='difference';
   if(ov.flip){g.translate((L.x*2+L.w)*k,0);g.scale(-1,1);}g.drawImage(img,L.x*k,L.y*k,L.w*k,L.h*k);g.restore();}
  download(out.toDataURL('image/png'),`pistol-stance-${stamp()}.png`);status('画像を保存しました（写真を重ねた見た目のまま）。');};
 $('#pe-load').onclick=()=>{const t=prompt('「データをコピー」で作った文字を貼り付けてください。');if(!t)return;
  try{const j=JSON.parse(t);commit();stance=fill(j.stance);base=clone(stance);if(j.note)$<HTMLTextAreaElement>('#pe-note').value=j.note;
   if(j.camera){host.camera.position.fromArray(j.camera.position);host.controls.target.fromArray(j.camera.target);host.camera.fov=j.camera.fov;host.camera.updateProjectionMatrix();host.controls.update();syncFov();}
   apply();save();status('読み込みました。');}catch{status('読み込めませんでした。コピーした文字をそのまま貼り付けてください。');}};
 function status(t:string){$('#pe-status').textContent=t;}

 // --- every frame: the overlay follows, and the reach check
 let lastCheck=0;
 function tick(now:number){if(!active)return;if(now-lastCheck<150)return;lastCheck=now;drawOverlay();const m=host.measure();if(!m)return;
  const miss=m.grip*100;$('#pe-check').innerHTML=`右手と銃のずれ <span class="${miss>1.5?'bad':'ok'}">${miss.toFixed(1)} cm${miss>1.5?'（手が届いていません。銃を体に近づけてください）':''}</span>　右肘 ${Math.round(m.elbow)}°${m.elbow>172?'（伸びきり）':''}`;}
 syncSliders();drawOverlay();
 return {tick,get active(){return active;},open(){box.open=true;},data:exportData,gizmo,
  /** For checks from the console: set one slider by id (e.g. 'chest-1', 'pos-2'). */
  set(id:string,v:number){const s=SLIDERS.find(x=>x.id===id);if(!s)return false;commit();s.set(stance,v);apply();save();return true;},
  sliders:SLIDERS.map(s=>s.id)};
}

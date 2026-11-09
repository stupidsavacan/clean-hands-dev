import {traversalPreview} from './traversal-preview';
// Animation Lab (2026-11-04): every character model with every motion the game plays, on one shared clock.
// Speed, frame stepping, a skeleton overlay and several characters side by side (in step, or offset) to compare.
// It drives the same runtime the maps use (rig.ts, locomotion.ts, schedule-motion.ts, motion.ts, combat-motion.ts),
// so a motion fixed there shows here and in every map.
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {PLAYER_BASE64} from '../player-data';
import {NPC_MODELS} from '../npc-data';
import {CHARACTER_MODELS} from '../character-data';
import {GUNS} from './motion-guns';
import {Rig} from '../rig';
import {applyLook} from '../appearance';
import {loadLook} from '../wardrobe';
import {Locomotion} from '../locomotion';
import {GestureProps,type Gesture} from '../gestures';
import {itemModel} from '../item-models';
import type {MotionRole} from '../motion';
import type {CoinPickup} from '../coin-pickup';
import {CLIPS,type Clip} from './motion-clips';
import {poseMotionPreview,SPACING,type PreviewActor} from './motion-preview';
import {AGENT_PISTOL_VARIANTS,type PistolVariant} from '../combat-motion';
import {DEFAULT_PISTOL_TUNING,PISTOL_ADJUSTMENTS,loadPistolTuning,savePistolTuning} from '../pistol-tuning.ts';
import {prepareWeapon,type Weapon} from '../combat-runtime';
import {createPoseEditor} from './pose-editor';
import {ELBOW_CHECKS,runAgentDrawCheck,runAgentHolsterCheck,runSinglePunchCheck,runSolvedClipChecks,runElbowCheck,MOTION_CHECK_CAST,type ClipIssue} from './motion-checks';
import {SURRENDER_ARM} from '../hold-pose';
// The hands-up arm angles, adjustable live from the console while tuning (window.__surrenderArm).
Object.assign(window,{__surrenderArm:SURRENDER_ARM});
import {coinMesh,placePickupCoin,placePickupWeapon} from '../coin-pickup-pose';
import {itemMesh,inHand} from '../detection-view';
import {loadItemModels} from '../item-models';

// --- the models
type ModelDef={id:string;label:string;group:string;b64:string};
const MODELS:ModelDef[]=[
 {id:'agent',label:'エージェント',group:'プレイヤー',b64:PLAYER_BASE64},
 ...Object.entries(NPC_MODELS).map(([id,b64])=>({id:'npc:'+id,label:id,group:'NPC',b64})),
 ...Object.entries(CHARACTER_MODELS).map(([id,b64])=>({id:'character:'+id,label:id,group:'キャラクター',b64})),
];

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<canvas id="view"></canvas><aside id="panel"><header><b>モーション実験ステージ</b><small>全モデルと全モーションを、同じ時計で再生します。ゲームと同じ動きの仕組みを使っています。</small></header>
<section>
<h3>全モーションの自動判定</h3>
<button id="run-elbow-checks" type="button">すべて自動判定</button>
<div id="elbow-results" role="status"></div>
</section>
<details id="pistol-tune">
<summary>07の拳銃を微調整</summary>
<p>「銃」で片手銃を選べます。銃とグリップの位置を固定したまま、07の構えを調整します。調整値はすべての片手銃で共通です。0°が標準です。</p>
<div class="row" aria-label="構えの案">${Object.entries(AGENT_PISTOL_VARIANTS).map(([id,v])=>`<button data-pistol-variant="${id}" title="${v.note}">${v.label}</button>`).join('')}</div>
<p id="pistol-variant-note"></p>
<div class="row" aria-label="見る角度"><button data-pistol-angle="0">正面</button><button data-pistol-angle="-35">斜め</button><button data-pistol-angle="-90">横</button></div>
${PISTOL_ADJUSTMENTS.map(({id,label,limit})=>`<label class="pose-adjust" for="pistol-${id}"><span>${label}</span><output for="pistol-${id}" data-pistol-value="${id}">0°</output><input id="pistol-${id}" type="range" min="${-limit}" max="${limit}" step="1" value="0"></label>`).join('')}
<label><input id="pistol-compare" type="checkbox"> 標準の構えを見る</label>
<div class="row"><button id="pistol-reset">標準に戻す</button><button id="pistol-save">保存してゲームに反映</button></div>
<p id="pistol-status" role="status">保存すると、このブラウザで次に開くゲームに反映されます。</p>
<a href="./club-prototype.html" target="_blank" rel="noopener">クラブで試す ↗</a>
</details>
<h3>モーション</h3><select id="clip" size="10"></select>
<section id="traversal-inspection" hidden aria-label="移動フェーズと接触誤差"></section>
<div class="row"><label>背後アクションの役 <select id="role"><option value="giver">する側</option><option value="receiver">される側</option></select></label><label>銃 <select id="gun"></select></label></div>
<h3>キャラクター <small id="count"></small></h3><div class="row"><button id="all-npc">NPC全員</button><button id="all-char">キャラ全員</button><button id="none">外す</button></div><div id="models"></div>
</aside><footer id="transport"><button id="back" title="1コマ戻る（,）">◀▮</button><button id="play" title="再生／一時停止（Space）">一時停止</button><button id="fwd" title="1コマ進む（.）">▮▶</button>
<input id="timeline" type="range" min="0" max="1000" value="0"><span id="time"></span>
<label>速さ <select id="speed"><option>0.1</option><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option></select></label>
<label>ずらし <input id="offset" type="range" min="0" max="50" value="0"></label>
<label><input id="skeleton" type="checkbox"> 骨格</label><label><input id="ghost" type="checkbox"> 半透明</label><label><input id="loop" type="checkbox" checked> くり返し</label><span id="warn"></span></footer>`;
const style=document.createElement('style');style.textContent=`
*{box-sizing:border-box}body{margin:0;background:#161a1f;color:#e9e6dd;font:13px/1.5 system-ui,sans-serif;overflow:hidden}
#view{position:fixed;left:0;top:0;width:calc(100vw - 320px);height:calc(100vh - 56px);display:block}
#panel{position:fixed;right:0;top:0;width:320px;height:calc(100vh - 56px);overflow:auto;background:#1d2127;border-left:1px solid #343a44;padding:12px}
#panel header b{font-size:16px;display:block}#panel small{color:#a7a399}h3{margin:14px 0 6px;font-size:13px;color:#c9b27a}
#run-elbow-checks{background:#3b6b4f;border-color:#5a9a72}
#elbow-results:not(:empty){margin-top:6px}
#elbow-results .pass{color:#6fd08c}#elbow-results .fail{color:#ffae94}#elbow-results .review{color:#f2c14e}
#elbow-results .motion-issue{display:block;width:100%;margin:4px 0;text-align:left;overflow-wrap:anywhere}
#pistol-tune{margin-top:12px;padding:10px;border:1px solid #5a5141;border-radius:8px;background:#252725}
#pistol-tune summary{cursor:pointer;color:#f3d28c;font-weight:650}#pistol-tune p{margin:6px 0;color:#c6c5bb}
#pistol-tune a{color:#e3c989}#pistol-save{background:#e3c989;color:#241f14;border-color:#e3c989;font-weight:650}
[data-pistol-variant].on{background:#e3c989;color:#241f14;border-color:#e3c989}
#pistol-save:hover{background:#f0d999}.pose-adjust{display:grid;grid-template-columns:1fr auto;margin:5px 0}
.pose-adjust input{grid-column:1/-1;width:100%;margin:2px 0;accent-color:#e3c989}.pose-adjust output{font-variant-numeric:tabular-nums}
#clip{width:100%;background:#14171b;color:#eee;border:1px solid #3a404a;border-radius:6px;height:260px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}select,button{background:#2a2f37;color:#eee;border:1px solid #474e59;border-radius:6px;padding:4px 8px}button{cursor:pointer}button:hover{background:#353b45}
#models{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px}#models label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#models .grp{grid-column:1/-1;color:#8f8b82;margin-top:6px}
#transport{position:fixed;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#1d2127;border-top:1px solid #343a44}
#timeline{flex:1;min-width:120px}#time{font-variant-numeric:tabular-nums;min-width:150px}#warn{color:#f2c14e}#play{min-width:84px}
@media (max-width:900px){#view{width:100vw;height:55vh}#panel{top:55vh;width:100vw;height:calc(45vh - 56px)}}`;
document.head.append(style);
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;

const runElbowChecks=$<HTMLButtonElement>('#run-elbow-checks');
runElbowChecks.onclick=async()=>{
 const result=$('#elbow-results');
 runElbowChecks.disabled=true;
 result.textContent='判定中…';
 const results=ELBOW_CHECKS.map(({label,samples})=>{
  const issue=runElbowCheck({label,samples});
  const angle=issue&&Number.isFinite(issue.degrees)?issue.degrees.toFixed(1)+'°':'無効';
  return {label,detail:issue?`${issue.motion} · ${issue.side}肘 ${angle}`:null};
 });
 let scan:Awaited<ReturnType<typeof runSolvedClipChecks>>|undefined;
 const solvedChecks=[
  ['07・銃を出す（IK後）',runAgentDrawCheck],
  ['07・銃をしまう（IK後）',runAgentHolsterCheck],
  ['素手で殴る（IK後）',runSinglePunchCheck],
 ] as const;
 try{
  for(const [label,check] of solvedChecks){
   try{results.push({label,detail:await check()});}
   catch(error){console.error(error);results.push({label,detail:'判定用モデルを読み込めません'});}
  }
  try{
   scan=await runSolvedClipChecks(async(checked,total)=>{
    result.textContent='骨格の判定中… '+checked+' / '+total+' モーション';
    await new Promise<void>(resolve=>setTimeout(resolve,0));
   });
   const errors=scan.issues.filter(issue=>issue.kind==='geometry');
   results.push({label:'IK後の骨格（'+scan.clips.length+'モーション）',
    detail:errors.length?errors.length+'件':null});
  }catch(error){console.error(error);results.push({label:'IK後の全モーション',detail:'判定を完了できませんでした'});}
 }finally{
  runElbowChecks.disabled=false;
 }
 const passed=results.filter(({detail})=>!detail).length;
 const summary=document.createElement('div');
 summary.textContent=`合格 ${passed} / ${results.length}${passed===results.length?'':` · 不合格 ${results.length-passed}`}`;
 const rows=results.map(({label,detail})=>{
  const row=document.createElement('div');
  row.className=detail?'fail':'pass';
  row.textContent=detail?`✗ ${label} · ${detail}`:`✓ ${label}`;
  return row;
 });
 result.replaceChildren(summary,...rows);
 const groups=[
  {label:'骨格の不合格',className:'fail',issues:scan?.issues.filter(issue=>issue.kind==='geometry')??[]},
  {label:'要確認',className:'review',issues:scan?.issues.filter(issue=>issue.kind!=='geometry')??[]},
 ];
 for(const {label,className,issues} of groups){
  if(!issues.length)continue;
  const details=document.createElement('details'),heading=document.createElement('summary');
  heading.className=className;
  heading.textContent=label+' '+issues.length+'件';
  details.append(heading);
  for(const issue of issues){
   const row=document.createElement('button');
   row.type='button';
   row.className='motion-issue';
   row.textContent=issue.where+' · '+issue.detail;
   row.onclick=()=>showIssueFrame(issue);
   details.append(row);
  }
  result.append(details);
 }
};

// --- scene
const canvas=$<HTMLCanvasElement>('#view'),renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#283139');scene.add(new T.HemisphereLight('#fff0dc','#5d6a70',2));
for(const [x,y,z,p] of [[-3,5,3,2.6],[3,3,-2,1.6]]){const l=new T.DirectionalLight('#fff2df',p);l.position.set(x,y,z);scene.add(l);}
const floor=new T.Mesh(new T.PlaneGeometry(60,20),new T.MeshStandardMaterial({color:'#34424a',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;scene.add(floor);
const grid=new T.GridHelper(60,120,'#5d6a72','#3f4b53');grid.position.y=0;scene.add(grid);
const camera=new T.PerspectiveCamera(35,1,.01,200);camera.position.set(0,1.8,5.5);const controls=new OrbitControls(camera,canvas);controls.target.set(0,.9,0);controls.enableDamping=true;
function viewActor(deg=30,dist=2.2,height=1.3,targetY=1.1,targetZ=0){
 const x=actors[0]?.group.position.x??0,r=deg*Math.PI/180;
 controls.target.set(x,targetY,targetZ);camera.position.set(x+Math.sin(r)*dist,height,targetZ+Math.cos(r)*dist);controls.update();
}

// --- actors
type Actor=PreviewActor&{def:ModelDef;held?:{id:string;object:T.Object3D};props:GestureProps;scenery?:{id:string;object:T.Object3D};skeleton:T.SkeletonHelper;label:T.Sprite;ok:boolean};
const loader=new GLTFLoader(),bytes=(b64:string)=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer;
const actors:Actor[]=[];const loading=new Set<string>();
let pistolTuning=loadPistolTuning();
let pistolVariant:string|PistolVariant=new URLSearchParams(location.search).get('pistol')??'F';
// The pose editor's stance while it is open (it overrides the variant buttons and the saved tuning).
let editorStance:PistolVariant|null=null,agentGripMiss=0;
let inspection:ClipIssue|undefined;
const pistolCompare=$<HTMLInputElement>('#pistol-compare');
const NEED=['pelvis','spine','chest','neck','head','thighl','shinl','footl','thighr','shinr','footr','upperarml','forearml','handl','upperarmr','forearmr','handr'];
async function addActor(def:ModelDef){
 if(loading.has(def.id)||actors.some(a=>a.def.id===def.id))return;loading.add(def.id);
 try{
  const model=(await loader.parseAsync(bytes(def.b64),'')).scene,group=new T.Group();group.add(model);scene.add(group);
  if(def.id==='agent')applyLook(model,loadLook());
  model.traverse(o=>{o.frustumCulled=false;});
  const rig=new Rig(model),skeleton=new T.SkeletonHelper(model);skeleton.visible=$<HTMLInputElement>('#skeleton').checked;scene.add(skeleton);
  const weapons:Actor['weapons']={};
  // Guns load when first chosen (loadGun); the chosen one now.
  await loadGunInto(weapons,gunSel().id);
  const c=document.createElement('canvas');c.width=256;c.height=48;const g=c.getContext('2d')!;g.fillStyle='rgba(0,0,0,.55)';g.fillRect(0,0,256,48);g.fillStyle='#fff';g.font='24px sans-serif';g.textAlign='center';g.fillText(def.label,128,33);
  const label=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),depthTest:false}));label.scale.set(.9,.17,1);label.position.set(0,-.12,.5);group.add(label);
  const ok=rig.has(NEED);
  actors.push({def,group,model,rig,loco:new Locomotion(),sim:-1,skeleton,weapons,label,ok,props:new GestureProps()});
  if(!loading.has(def.id)){remove(def.id);return;}
  // The gun can change while a model and its initial gun are loading.
  void loadGunInto(weapons,gunSel().id);
  applyGhost();layout();
 }catch(e){console.error('model failed',def.id,e);}
 finally{loading.delete(def.id);}
}
function remove(id:string){const i=actors.findIndex(a=>a.def.id===id);if(i<0){loading.delete(id);return;}const a=actors[i];actors.splice(i,1);a.group.removeFromParent();a.skeleton.removeFromParent();for(const w of Object.values(a.weapons))w?.object.removeFromParent();layout();}
function layout(){
 const order=MODELS.filter(m=>actors.some(a=>a.def===m));actors.sort((a,b)=>order.indexOf(a.def)-order.indexOf(b.def));
 actors.forEach((a,i)=>{a.group.position.set((i-(actors.length-1)/2)*SPACING,0,0);a.sim=-1;});
 $('#count').textContent=`${actors.length}人`;
 const bad=actors.filter(a=>!a.ok).map(a=>a.def.label);$('#warn').textContent=bad.length?`骨が足りないモデル：${bad.join('、')}`:'';
 syncChecks();
}
function applyGhost(){const on=$<HTMLInputElement>('#ghost').checked;for(const a of actors)a.model.traverse(o=>{const m=(o as T.Mesh).material as T.Material|T.Material[]|undefined;if(!m)return;for(const x of Array.isArray(m)?m:[m]){x.transparent=on;x.opacity=on?.3:1;x.depthWrite=!on;}});}

// The tool rides on the right hand bone, drawn the way the game draws it (detection-view.ts itemMesh).
function hold(a:Actor,item?:string){
 if(a.held?.id===(item??''))return;
 a.held?.object.removeFromParent();a.held=undefined;
 const hand=a.rig.joints.get('handr')?.bone;if(!item||!hand)return;
 const o=inHand(hand,itemMesh(item),item);a.held={id:item,object:o};
}
// What the gesture is done at, in front of the person (the game has its own furniture there): a standing desk with a PC
// (assets/props desk_pc), a counter, a massage table, the club's button panel.
function scenery(a:Actor,gesture?:string){
 const want=gesture&&['work','cook','clean','massage_work','club_press','coin-pickup'].includes(gesture)?gesture:'';
 if(a.scenery?.id===want)return;a.scenery?.object.removeFromParent();a.scenery=undefined;if(!want)return;
 const m=new T.MeshStandardMaterial({color:'#6d5a48',roughness:.9}),boxAt=(w:number,h:number,d:number,z:number,y=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(0,y+h/2,z+d/2);return o;};
 const o=want==='coin-pickup'?coinMesh():want==='work'?(()=>{const g=new T.Group(),pc=itemModel('desk_pc');if(pc){pc.position.z=.2;g.add(pc);}return g;})()
  :want==='massage_work'?boxAt(.8,.78,1.9,.25):want==='club_press'?boxAt(.3,.3,.08,.54,1.05):boxAt(1.0,.94,.6,.22);
 a.group.add(o);a.scenery={id:want,object:o};
}
// --- guns
{const sel=$<HTMLSelectElement>('#gun');for(const g of GUNS){const o=document.createElement('option');o.value=g.id;o.textContent=`${g.label} · ${g.cls==='pistol'?'片手':'両手'}`;sel.append(o);}}
function gunSel(){return GUNS.find(g=>g.id===$<HTMLSelectElement>('#gun').value)??GUNS[0];}
const gunLoads=new WeakMap<object,Set<string>>();
async function loadGunInto(store:Partial<Record<string,Weapon>>,id:string){
 const busy=gunLoads.get(store)??new Set<string>();gunLoads.set(store,busy);if(store[id]||busy.has(id))return;busy.add(id);
 const g=GUNS.find(x=>x.id===id);if(!g)return;const w=await loader.parseAsync(bytes(g.b64),'');scene.add(w.scene);store[id]=prepareWeapon(w.scene,g.cls);w.scene.visible=false;
}
// --- one pose at time t (seconds into the clip) for one actor
const visuals={
 clearPickup(a:Actor,clip:Clip){if(a.scenery?.id==='coin-pickup'&&!clip.coinPickup)scenery(a);},
 hold,scenery,
 gesture(a:Actor,g:Gesture|null){a.props.update(a.rig,a.group,g);},
 pickup(a:Actor,pickup:CoinPickup,clip:Clip,gunId:string){
  if(clip.coinPickup)placePickupCoin(a.scenery!.object as T.Mesh,a.rig,pickup);
  else{
   const weapon=a.weapons[gunId];
   if(weapon)placePickupWeapon(weapon.object,a.rig,pickup,1.7);
  }
 },
};
function previewCast(clip:Clip){
 if(inspection?.clip!==clip.id||!clip.pair)return actors;
 // Pair solvers use the first two actors. Put the test cast first even if other NPCs are selected.
 return [...MOTION_CHECK_CAST.flatMap(id=>actors.filter(a=>a.def.id===id)),
  ...actors.filter(a=>!MOTION_CHECK_CAST.some(id=>id===a.def.id))];
}
function poseActor(a:Actor,clip:Clip,t:number,cast=previewCast(clip)){
 const inspecting=inspection?.clip===clip.id;
 const miss=poseMotionPreview(a,cast,clip,t,{
  role:$<HTMLSelectElement>('#role').value as MotionRole,gun:gunSel(),
  tuning:inspecting||pistolCompare.checked||poseEditor?.active?undefined:pistolTuning,
  variant:inspecting?'F':poseEditor?.active?editorStance??'F':pistolVariant,visuals,
 });
 if(miss!==undefined&&a.def.id==='agent')agentGripMiss=miss;
}

// --- UI
const clipSel=$<HTMLSelectElement>('#clip');
{let group='',og:HTMLOptGroupElement|null=null;for(const c of CLIPS){if(c.group!==group){group=c.group;og=document.createElement('optgroup');og.label=group;clipSel.append(og);}const o=document.createElement('option');o.value=c.id;o.textContent=`${c.label}（${c.seconds}秒${c.loop?'・くり返し':''}）`;og!.append(o);}}
clipSel.value='loco-walk';
let clip=CLIPS.find(c=>c.id===clipSel.value)!,time=0,playing=true;
clipSel.onchange=()=>{
 inspection=undefined;clip=CLIPS.find(c=>c.id===clipSel.value)!;time=0;for(const a of actors)a.sim=-1;
 if(clip.pair==='rescue'){
  const selected=new Set([...loading,...actors.map(a=>a.def.id)]);
  for(const id of ['npc:guard','npc:waiter']){
   if(selected.size>=2)break;
   if(!selected.has(id)){selected.add(id);void addActor(MODELS.find(m=>m.id===id)!);}
  }
 }
};
$('#role').onchange=()=>{inspection=undefined;for(const a of actors)a.sim=-1;};
$('#gun').onchange=()=>{inspection=undefined;for(const a of actors){a.sim=-1;void loadGunInto(a.weapons,gunSel().id);}};
{const box=$('#models');let group='';for(const m of MODELS){if(m.group!==group){group=m.group;const h=document.createElement('div');h.className='grp';h.textContent=group;box.append(h);}
 const l=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.dataset.model=m.id;cb.onchange=()=>{if(cb.checked)void addActor(m);else remove(m.id);};l.append(cb,' '+m.label);l.title=m.label;box.append(l);}}
function syncChecks(){document.querySelectorAll<HTMLInputElement>('[data-model]').forEach(cb=>{cb.checked=actors.some(a=>a.def.id===cb.dataset.model)||loading.has(cb.dataset.model!);});}
const pick=(group:string)=>{for(const m of MODELS.filter(m=>m.group===group))void addActor(m);};
$('#all-npc').onclick=()=>pick('NPC');$('#all-char').onclick=()=>pick('キャラクター');$('#none').onclick=()=>{for(const a of [...actors])remove(a.def.id);loading.clear();syncChecks();};
const setPlaying=(v:boolean)=>{playing=v;$('#play').textContent=v?'一時停止':'再生';};
function showIssueFrame(issue:ClipIssue){
 setPlaying(false);
 if(issue.gunId){
  const gun=$<HTMLSelectElement>('#gun');
  gun.value=issue.gunId;gun.dispatchEvent(new Event('change'));
 }
 if(issue.role){
  const role=$<HTMLSelectElement>('#role');
  role.value=issue.role;role.dispatchEvent(new Event('change'));
 }
 clipSel.value=issue.clip;clipSel.dispatchEvent(new Event('change'));
 $<HTMLInputElement>('#offset').value='0';
 inspection=issue;
 time=issue.seconds;
 for(const id of clip.pair?MOTION_CHECK_CAST:[issue.actorId]){
  const def=MODELS.find(model=>model.id===id);
  if(def)void addActor(def);
 }
}
const traversal=traversalPreview(scene,$('#traversal-inspection'),seconds=>{setPlaying(false);time=seconds;});
const pistolPanel=$<HTMLDetailsElement>('#pistol-tune'),pistolStatus=$('#pistol-status');
function syncPistolSliders(){
 for(const {id} of PISTOL_ADJUSTMENTS){
  const value=pistolTuning[id];
  $<HTMLInputElement>(`#pistol-${id}`).value=String(value);
  $(`[data-pistol-value="${id}"]`).textContent=`${value>0?'+':''}${value}°`;
 }
}
function previewPistol(){
 if(gunSel().cls!=='pistol'){
  const gun=$<HTMLSelectElement>('#gun');
  gun.value='m55:pistol_silenced';gun.dispatchEvent(new Event('change'));
 }
 for(const a of [...actors])if(a.def.id!=='agent')remove(a.def.id);
 void addActor(MODELS[0]);
 clipSel.value='combat-aim';clipSel.dispatchEvent(new Event('change'));setPlaying(false);
 viewActor(-35,2.9,1.25,1.13,.1);
}
pistolPanel.ontoggle=()=>{if(pistolPanel.open)previewPistol();};
for(const {id} of PISTOL_ADJUSTMENTS){
 const input=$<HTMLInputElement>(`#pistol-${id}`);
 input.oninput=()=>{
  inspection=undefined;
  pistolTuning[id]=input.valueAsNumber;
  pistolCompare.checked=false;syncPistolSliders();
  pistolStatus.textContent='プレビュー中。ゲームに反映するには保存してください。';
 };
}
syncPistolSliders();
function setPistolVariant(id:string){
 if(!AGENT_PISTOL_VARIANTS[id])return;inspection=undefined;pistolVariant=id;
 document.querySelectorAll<HTMLButtonElement>('[data-pistol-variant]').forEach(b=>b.classList.toggle('on',b.dataset.pistolVariant===id));
 const v=AGENT_PISTOL_VARIANTS[id];$('#pistol-variant-note').textContent=`${v.label}：${v.note}`;
}
document.querySelectorAll<HTMLButtonElement>('[data-pistol-variant]').forEach(b=>{b.onclick=()=>setPistolVariant(b.dataset.pistolVariant!);});
setPistolVariant(pistolVariant);
document.querySelectorAll<HTMLButtonElement>('[data-pistol-angle]').forEach(button=>{
 button.onclick=()=>viewActor(Number(button.dataset.pistolAngle),2.9,1.25,1.13,.1);
});
pistolCompare.onchange=()=>{inspection=undefined;};
$('#pistol-reset').onclick=()=>{
 inspection=undefined;
 pistolTuning={...DEFAULT_PISTOL_TUNING};pistolCompare.checked=false;syncPistolSliders();
 pistolStatus.textContent='標準に戻しました。ゲームに反映するには保存してください。';
};
$('#pistol-save').onclick=()=>{
 pistolStatus.textContent=savePistolTuning(pistolTuning)
  ?'保存しました。クラブを開いて試せます。開いている場合は再読み込みしてください。'
  :'このブラウザでは保存できません。ローカルサーバーから開いてください。';
};
const FRAME=1/30;
$('#play').onclick=()=>setPlaying(!playing);
$('#back').onclick=()=>{setPlaying(false);time=Math.max(0,time-FRAME);};
$('#fwd').onclick=()=>{setPlaying(false);time=Math.min(clip.seconds,time+FRAME);};
$<HTMLInputElement>('#timeline').oninput=()=>{setPlaying(false);time=Number($<HTMLInputElement>('#timeline').value)/1000*clip.seconds;};
$<HTMLInputElement>('#skeleton').onchange=()=>{for(const a of actors)a.skeleton.visible=$<HTMLInputElement>('#skeleton').checked;};
$<HTMLInputElement>('#ghost').onchange=applyGhost;
addEventListener('keydown',e=>{if(e.target instanceof HTMLElement&&e.target.closest('#pistol-tune,#pose-edit,.motion-issue')||e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement&&e.target.type!=='range')return;
 if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}if(e.code==='Comma')$('#back').click();if(e.code==='Period')$('#fwd').click();});

let last=performance.now();
function frame(now:number){const dt=Math.min(.1,(now-last)/1000);last=now;
 if(playing){time+=dt*Number($<HTMLSelectElement>('#speed').value);if(time>clip.seconds){if($<HTMLInputElement>('#loop').checked){time%=clip.seconds;for(const a of actors)a.sim=-1;}else{time=clip.seconds;setPlaying(false);}}}
 // In step: every character at the same time. ずらし offsets each one by a share of the clip (0-50%).
 const offset=Number($<HTMLInputElement>('#offset').value)/100*clip.seconds;
 // The inspected cast order also determines which actor is posed first in a paired action.
 const cast=previewCast(clip);
 cast.forEach((a,i)=>{
  const t=time+i*offset;
  poseActor(a,clip,clip.loop&&t>clip.seconds?t%clip.seconds:Math.min(t,clip.seconds),cast);
 });
 floor.visible=grid.visible=!clip.traversal;
 traversal.update(clip,time,cast[0]);
 $<HTMLInputElement>('#timeline').value=String(Math.round(time/clip.seconds*1000));
 $('#time').textContent=`${time.toFixed(2)} / ${clip.seconds.toFixed(2)} 秒 · ${inspection?.seconds===time?inspection.frame:Math.round(time*30)}コマ`;
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 poseEditor.tick(now);controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}
const poseEditor=createPoseEditor({camera,controls,canvas,scene,
 agentGroup:()=>actors.find(a=>a.def.id==='agent')?.group,
 setStance:v=>{editorStance=v;},
 play:(id,play)=>{clipSel.value=id;clipSel.dispatchEvent(new Event('change'));setPlaying(play);},
 render:()=>{actors.forEach(a=>poseActor(a,clip,time));renderer.render(scene,camera);},
 measure:()=>{const a=actors.find(x=>x.def.id==='agent');if(!a||!clip.combat)return null;
  const p=(n:string)=>a.rig.joints.get(n)!.bone.getWorldPosition(new T.Vector3()),e=p('forearmr');
  return {grip:agentGripMiss,elbow:T.MathUtils.radToDeg(p('upperarmr').sub(e).angleTo(p('handr').sub(e)))};},
 prepare:()=>{if(pistolPanel.open)pistolPanel.open=false;previewPistol();viewActor(60,3.2,1.35,1.15,.2);},
},$('#panel header'));
requestAnimationFrame(frame);
// Start with the agent and a guard walking side by side (item GLBs first, so tools in hand are the real models).
await loadItemModels();
if(location.hash==='#pistol-tune')pistolPanel.open=true;
else if(location.hash==='#pose-edit')poseEditor.open();
else{void addActor(MODELS[0]);const guard=MODELS.find(m=>m.id==='npc:guard');if(guard)void addActor(guard);}
Object.assign(window,{__animLab:{
 // Look at the first character from an angle (degrees round them, 0 = in front), at a distance and height.
 // Where the first character's joints are, in their own space (x: + is their left, z: + is forward), metres.
 joints:(...names:string[])=>{const a=actors[0];if(!a)return null;a.group.updateMatrixWorld(true);return Object.fromEntries(names.map(n=>{const b=a.rig.joints.get(n)?.bone;return [n,b?a.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray().map(v=>+v.toFixed(3)):null];}));},
 // Pose every character at time t of a clip and draw once, without the frame loop (works while the page is hidden).
 poseAt:(clipId:string,t:number)=>{clipSel.value=clipId;clipSel.dispatchEvent(new Event('change'));setPlaying(false);time=t;actors.forEach(a=>poseActor(a,clip,t));floor.visible=grid.visible=!clip.traversal;traversal.update(clip,t,previewCast(clip)[0]);controls.update();renderer.render(scene,camera);return t;},
 // A contact sheet: each clip posed at time t and drawn into one picture over the page (cols per row; close with
 // sheet([])). For reviewing many gestures at once.
 sheet:(ids:string[],t=1,cols=6,cell=260)=>{document.querySelector('#sheet')?.remove();if(!ids.length)return 0;
  const c=document.createElement('canvas');c.id='sheet';c.width=cols*cell;c.height=Math.ceil(ids.length/cols)*cell;c.style.cssText='position:fixed;left:0;top:0;z-index:9;background:#222;max-width:100vw;max-height:100vh';
  const g=c.getContext('2d')!;g.font='15px sans-serif';g.fillStyle='#fff';
  ids.forEach((id,i)=>{actors.forEach(a=>poseActor(a,CLIPS.find(k=>k.id===id)!,t));clip=CLIPS.find(k=>k.id===id)!;actors.forEach(a=>poseActor(a,clip,t));controls.update();renderer.render(scene,camera);
   const w=canvas.width,h=canvas.height,side=Math.min(w,h);g.drawImage(canvas,(w-side)/2,(h-side)/2,side,side,(i%cols)*cell,Math.floor(i/cols)*cell,cell,cell);g.fillText(clip.label,(i%cols)*cell+6,Math.floor(i/cols)*cell+18);});
  document.body.append(c);return ids.length;},
 // targetZ: look at a point ahead of the first actor (pair clips: half the gap, between the two).
 view:viewActor,
 // Set the drawing size directly (the frame loop does this, but it does not run while the page is hidden).
 size:(w:number,h:number)=>{renderer.setPixelRatio(1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();},
 // Agent 07's one-handed pistol A/B candidates (HD15): pistol('B') switches; pistolVariants lists them.
 pistol:(id:string)=>setPistolVariant(id),editor:()=>poseEditor,pistolVariants:Object.keys(AGENT_PISTOL_VARIANTS),
clips:CLIPS.map(c=>c.id),models:MODELS.map(m=>m.id),actors:()=>actors.map(a=>({id:a.def.id,ok:a.ok})),
 set:(clipId:string,t:number)=>{clipSel.value=clipId;clipSel.dispatchEvent(new Event('change'));setPlaying(false);time=t;}}});

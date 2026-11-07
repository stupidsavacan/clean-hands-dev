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
import {COMBAT_MODELS} from '../combat-data';
import {Rig} from '../rig';
import {applyLook} from '../appearance';
import {loadLook} from '../wardrobe';
import {Locomotion,WALK_SPEED,RUN_SPEED,CROUCH_SPEED,type Pose} from '../locomotion';
import {schedulePose} from '../schedule-motion';
import {sampleMotion,type MotionKind,type MotionRole} from '../motion';
import {applyMotion,neutral,plantedFeet,groundBody,PICKUP_SECONDS} from '../motion-runtime';
import {sampleCombat,weaponVisible,COMBAT_SECONDS,COMBAT_LOOPS,type CombatKind,type WeaponClass} from '../combat-motion';
import {poseCombat,prepareWeapon,type Weapon} from '../combat-runtime';
import {holdPose,holdKind} from '../hold-pose';
import {itemMesh,inHand} from '../detection-view';
import {loadItemModels} from '../item-models';

// --- the motions
type Clip={id:string;group:string;label:string;seconds:number;loop:boolean;
 loco?:{speed:number;crouch:number};gesture?:string;m3?:MotionKind;combat?:CombatKind;
 // A tool in the right hand (hold-pose.ts), with the walk in `loco`.
 item?:string};
const LOCO:[string,string,number,number][]=[['idle','立ち',0,0],['walk','歩き',WALK_SPEED,0],['run','走り',RUN_SPEED,0],['crouch','しゃがみ歩き',CROUCH_SPEED,1],['crouch-idle','しゃがみ',0,1]];
const GESTURES:[string,string][]=[['phone','電話'],['radio','無線'],['drink','飲む'],['tasting','試飲'],['speech','スピーチ'],['chat','談笑'],['camera','撮影'],['photo','記念撮影'],['tour','見学'],['inspect','点検'],['cook','料理'],['clean','掃除'],['massage_work','施術'],['work','仕事'],['serve','給仕'],['club_press','ボタンを押す'],['dance','ダンス'],['massage','マッサージを受ける']];
const M3:[MotionKind,string,number][]=[['ko','気絶させる',2],['kill','ワイヤー',2.5],['fall','倒れる',.9],['pickup','持ち上げる',PICKUP_SECONDS],['drag','引きずる',1.2],['drop','置く',.65],['hide','収納',2]];
const COMBAT:[CombatKind,string][]=[['draw','銃を出す'],['holster','しまう'],['aim','構える'],['fire','撃つ'],['reload','弾を込める'],['hit','撃たれる'],['cover','隠れる'],['coverAim','隠れて構える'],['flee','逃げる'],['duck','伏せる']];
const CLIPS:Clip[]=[
 ...LOCO.map(([id,label,speed,crouch])=>({id:'loco-'+id,group:'移動',label,seconds:2,loop:true,loco:{speed,crouch}})),
 // 2026-11-05: carrying a tool (HITMAN WoA carry research): the same walk, the right arm holds it.
 ...[['wrench','スパナ'],['bottle','ボトル'],['mop','モップ']].flatMap(([item,name])=>LOCO.map(([id,label,speed,crouch])=>({id:`item-${item}-${id}`,group:'持ち物',label:`${name}・${label}`,seconds:2,loop:true,loco:{speed,crouch},item}))),
 ...GESTURES.map(([id,label])=>({id:'gesture-'+id,group:'予定の仕草',label,seconds:8,loop:true,gesture:id})),
 ...M3.map(([id,label,seconds])=>({id:'m3-'+id,group:'背後アクション',label,seconds,loop:id==='drag',m3:id})),
 ...COMBAT.map(([id,label])=>({id:'combat-'+id,group:'戦闘',label,seconds:COMBAT_SECONDS[id],loop:COMBAT_LOOPS.includes(id),combat:id})),
];

// --- the models
type ModelDef={id:string;label:string;group:string;b64:string};
const MODELS:ModelDef[]=[
 {id:'agent',label:'エージェント',group:'プレイヤー',b64:PLAYER_BASE64},
 ...Object.entries(NPC_MODELS).map(([id,b64])=>({id:'npc:'+id,label:id,group:'NPC',b64})),
 ...Object.entries(CHARACTER_MODELS).map(([id,b64])=>({id:'character:'+id,label:id,group:'キャラクター',b64})),
];

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<canvas id="view"></canvas><aside id="panel"><header><b>モーション実験ステージ</b><small>全モデルと全モーションを、同じ時計で再生します。ゲームと同じ動きの仕組みを使っています。</small></header>
<h3>モーション</h3><select id="clip" size="10"></select>
<div class="row"><label>背後アクションの役 <select id="role"><option value="giver">する側</option><option value="receiver">される側</option></select></label><label>銃 <select id="cls"><option value="pistol">拳銃</option><option value="long">長物</option></select></label></div>
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
#clip{width:100%;background:#14171b;color:#eee;border:1px solid #3a404a;border-radius:6px;height:260px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}select,button{background:#2a2f37;color:#eee;border:1px solid #474e59;border-radius:6px;padding:4px 8px}button{cursor:pointer}button:hover{background:#353b45}
#models{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px}#models label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#models .grp{grid-column:1/-1;color:#8f8b82;margin-top:6px}
#transport{position:fixed;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#1d2127;border-top:1px solid #343a44}
#timeline{flex:1;min-width:120px}#time{font-variant-numeric:tabular-nums;min-width:150px}#warn{color:#f2c14e}#play{min-width:84px}
@media (max-width:900px){#view{width:100vw;height:55vh}#panel{top:55vh;width:100vw;height:calc(45vh - 56px)}}`;
document.head.append(style);
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;

// --- scene
const canvas=$<HTMLCanvasElement>('#view'),renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#283139');scene.add(new T.HemisphereLight('#fff0dc','#5d6a70',2));
for(const [x,y,z,p] of [[-3,5,3,2.6],[3,3,-2,1.6]]){const l=new T.DirectionalLight('#fff2df',p);l.position.set(x,y,z);scene.add(l);}
const floor=new T.Mesh(new T.PlaneGeometry(60,20),new T.MeshStandardMaterial({color:'#34424a',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;scene.add(floor);
const grid=new T.GridHelper(60,120,'#5d6a72','#3f4b53');grid.position.y=0;scene.add(grid);
const camera=new T.PerspectiveCamera(35,1,.01,200);camera.position.set(0,1.8,5.5);const controls=new OrbitControls(camera,canvas);controls.target.set(0,.9,0);controls.enableDamping=true;

// --- actors
type Actor={def:ModelDef;group:T.Group;model:T.Object3D;rig:Rig;loco:Locomotion;sim:number;pose?:Pose;held?:{id:string;object:T.Object3D};skeleton:T.SkeletonHelper;weapons:Partial<Record<WeaponClass,Weapon>>;label:T.Sprite;ok:boolean};
const loader=new GLTFLoader(),bytes=(b64:string)=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer;
const actors:Actor[]=[];const loading=new Set<string>();
const NEED=['pelvis','spine','chest','neck','head','thighl','shinl','footl','thighr','shinr','footr','upperarml','forearml','handl','upperarmr','forearmr','handr'];
async function addActor(def:ModelDef){
 if(loading.has(def.id)||actors.some(a=>a.def.id===def.id))return;loading.add(def.id);
 try{
  const model=(await loader.parseAsync(bytes(def.b64),'')).scene,group=new T.Group();group.add(model);scene.add(group);
  if(def.id==='agent')applyLook(model,loadLook());
  model.traverse(o=>{o.frustumCulled=false;});
  const rig=new Rig(model),skeleton=new T.SkeletonHelper(model);skeleton.visible=$<HTMLInputElement>('#skeleton').checked;scene.add(skeleton);
  const weapons:Actor['weapons']={};
  for(const [cls,id] of [['pistol','pistol_guard'],['long','smg']] as const){const w=await loader.parseAsync(bytes(COMBAT_MODELS[id]),'');scene.add(w.scene);weapons[cls]=prepareWeapon(w.scene,cls);w.scene.visible=false;}
  const c=document.createElement('canvas');c.width=256;c.height=48;const g=c.getContext('2d')!;g.fillStyle='rgba(0,0,0,.55)';g.fillRect(0,0,256,48);g.fillStyle='#fff';g.font='24px sans-serif';g.textAlign='center';g.fillText(def.label,128,33);
  const label=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),depthTest:false}));label.scale.set(.9,.17,1);label.position.set(0,-.12,.5);group.add(label);
  const ok=rig.has(NEED);
  actors.push({def,group,model,rig,loco:new Locomotion(),sim:-1,skeleton,weapons,label,ok});
  if(!loading.has(def.id)){remove(def.id);return;}
  applyGhost();layout();
 }catch(e){console.error('model failed',def.id,e);}
 finally{loading.delete(def.id);}
}
function remove(id:string){const i=actors.findIndex(a=>a.def.id===id);if(i<0){loading.delete(id);return;}const a=actors[i];actors.splice(i,1);a.group.removeFromParent();a.skeleton.removeFromParent();for(const w of Object.values(a.weapons))w?.object.removeFromParent();layout();}
const SPACING=1.15;
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
// --- one pose at time t (seconds into the clip) for one actor
const DT=1/60;
function poseActor(a:Actor,clip:Clip,t:number){
 const {rig,model,group}=a,role=$<HTMLSelectElement>('#role').value as MotionRole,cls=$<HTMLSelectElement>('#cls').value as WeaponClass;
 neutral(rig);model.position.set(0,0,0);model.rotation.set(0,0,0);
 for(const w of Object.values(a.weapons))if(w)w.object.visible=false;
 const progress=clip.seconds>0?T.MathUtils.clamp(t/clip.seconds,0,1):0;
 // Procedural parts (walking, idle) are simulated from the start of the clip so scrubbing back gives the same pose.
 const gait=(speed:number,crouch:number):Pose=>{const step=()=>{a.pose=a.loco.update(DT,{speed,crouch,slope:0,turn:0,distance:speed*DT});a.sim+=DT;};if(t<a.sim||a.sim<0){a.loco.reset();a.loco.time=0;a.sim=0;step();}while(a.sim+DT<=t)step();return structuredClone(a.pose!);};
 hold(a,clip.item);
 if(clip.loco){const p=gait(clip.loco.speed,clip.loco.crouch);if(clip.item)holdPose(p,holdKind(clip.item));rig.apply(p);return;}
 if(clip.gesture){const p=gait(0,0);rig.apply(schedulePose(p,clip.gesture,t));return;}
 if(clip.m3){applyMotion(rig,model,sampleMotion(clip.m3,role,progress));
  if(role==='giver'&&clip.m3!=='fall')plantedFeet(rig,group,()=>0);
  if(role==='receiver'){if(['drag','drop','pickup'].includes(clip.m3))groundBody(model,0);if(clip.m3==='fall')groundBody(model,0,T.MathUtils.smoothstep(progress,.65,1));}
  return;}
 if(clip.combat){const frame=sampleCombat(clip.combat,cls,progress),wp=a.weapons[cls]??null;
  if(frame.upperOnly){const speed=clip.combat==='flee'?RUN_SPEED:0;rig.apply(gait(speed,0));}else a.sim=-1;
  if(wp)wp.object.visible=weaponVisible(clip.combat,cls,progress,false);
  poseCombat(rig,group,model,frame,wp,0);
  if(clip.combat==='hit')plantedFeet(rig,group,()=>0);}
}

// --- UI
const clipSel=$<HTMLSelectElement>('#clip');
{let group='',og:HTMLOptGroupElement|null=null;for(const c of CLIPS){if(c.group!==group){group=c.group;og=document.createElement('optgroup');og.label=group;clipSel.append(og);}const o=document.createElement('option');o.value=c.id;o.textContent=`${c.label}（${c.seconds}秒${c.loop?'・くり返し':''}）`;og!.append(o);}}
clipSel.value='loco-walk';
let clip=CLIPS.find(c=>c.id===clipSel.value)!,time=0,playing=true;
clipSel.onchange=()=>{clip=CLIPS.find(c=>c.id===clipSel.value)!;time=0;for(const a of actors)a.sim=-1;};
for(const id of ['role','cls'])$(`#${id}`).onchange=()=>{for(const a of actors)a.sim=-1;};
{const box=$('#models');let group='';for(const m of MODELS){if(m.group!==group){group=m.group;const h=document.createElement('div');h.className='grp';h.textContent=group;box.append(h);}
 const l=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.dataset.model=m.id;cb.onchange=()=>{if(cb.checked)void addActor(m);else remove(m.id);};l.append(cb,' '+m.label);l.title=m.label;box.append(l);}}
function syncChecks(){document.querySelectorAll<HTMLInputElement>('[data-model]').forEach(cb=>{cb.checked=actors.some(a=>a.def.id===cb.dataset.model)||loading.has(cb.dataset.model!);});}
const pick=(group:string)=>{for(const m of MODELS.filter(m=>m.group===group))void addActor(m);};
$('#all-npc').onclick=()=>pick('NPC');$('#all-char').onclick=()=>pick('キャラクター');$('#none').onclick=()=>{for(const a of [...actors])remove(a.def.id);loading.clear();syncChecks();};
const setPlaying=(v:boolean)=>{playing=v;$('#play').textContent=v?'一時停止':'再生';};
const FRAME=1/30;
$('#play').onclick=()=>setPlaying(!playing);
$('#back').onclick=()=>{setPlaying(false);time=Math.max(0,time-FRAME);};
$('#fwd').onclick=()=>{setPlaying(false);time=Math.min(clip.seconds,time+FRAME);};
$<HTMLInputElement>('#timeline').oninput=()=>{setPlaying(false);time=Number($<HTMLInputElement>('#timeline').value)/1000*clip.seconds;};
$<HTMLInputElement>('#skeleton').onchange=()=>{for(const a of actors)a.skeleton.visible=$<HTMLInputElement>('#skeleton').checked;};
$<HTMLInputElement>('#ghost').onchange=applyGhost;
addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement&&e.target.type!=='range')return;
 if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}if(e.code==='Comma')$('#back').click();if(e.code==='Period')$('#fwd').click();});

let last=performance.now();
function frame(now:number){const dt=Math.min(.1,(now-last)/1000);last=now;
 if(playing){time+=dt*Number($<HTMLSelectElement>('#speed').value);if(time>clip.seconds){if($<HTMLInputElement>('#loop').checked){time%=clip.seconds;for(const a of actors)a.sim=-1;}else{time=clip.seconds;setPlaying(false);}}}
 // In step: every character at the same time. ずらし offsets each one by a share of the clip (0-50%).
 const offset=Number($<HTMLInputElement>('#offset').value)/100*clip.seconds;
 actors.forEach((a,i)=>{let t=time+i*offset;if(clip.loop)t%=clip.seconds;else t=Math.min(t,clip.seconds);poseActor(a,clip,t);});
 $<HTMLInputElement>('#timeline').value=String(Math.round(time/clip.seconds*1000));
 $('#time').textContent=`${time.toFixed(2)} / ${clip.seconds.toFixed(2)} 秒 · ${Math.round(time*30)}コマ`;
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
// Start with the agent and a guard walking side by side (item GLBs first, so tools in hand are the real models).
await loadItemModels();
void addActor(MODELS[0]);const guard=MODELS.find(m=>m.id==='npc:guard');if(guard)void addActor(guard);
Object.assign(window,{__animLab:{clips:CLIPS.map(c=>c.id),models:MODELS.map(m=>m.id),actors:()=>actors.map(a=>({id:a.def.id,ok:a.ok})),
 set:(clipId:string,t:number)=>{clipSel.value=clipId;clipSel.dispatchEvent(new Event('change'));setPlaying(false);time=t;}}});

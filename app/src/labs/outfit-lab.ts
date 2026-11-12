// 服装ラボ (2026-11-12, Claude): a character-creator screen over the recipe pipeline (assets/characters).
// Every change is built by Blender at once through /api/outfit/preview (a Blender kept running; ~0.3 s), so the
// preview is the real model. "保存して作る" still saves a new character through /api/outfit/jobs.
// window.__outfitLab (for Codex / Claude Code) keeps the same functions and behaviour as before.
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Rig} from '../rig';
import {Locomotion} from '../locomotion';
import {applyLook} from '../appearance';
import {DEFAULT_LOOK} from '../wardrobe';
import {CLIPS} from './motion-clips';
import {poseMotionPreview,type PreviewActor} from './motion-preview';
import {projectMark,placementFromHit,isClothFace} from './outfit-decal';
import {defaultMark,defaults,parseRecipe as parseOld,type Mark,MAX_PNG_BYTES} from './outfit-design';
import inventory from './outfit-inventory.json';
import {available,selectPiece,migrateLegacy,partLabel,bodyLabels,postBuild,type CharacterRecipe,type OutfitCatalog,type PartDef} from './outfit-recipes';
import './outfit-lab.css';

// --- what the screen shows
const PALETTE:[string,string][]=[['#2b2e35','墨'],['#efeadf','生成り'],['#c22f21','赤'],['#f2c14e','山吹'],['#17776c','深緑'],['#3b5b8a','藍'],['#4fb8c9','水色'],['#d9b39a','肌・明'],
 ['#9b7053','肌・中'],['#503f35','焦茶'],['#8b9c88','セージ'],['#c8d7cf','薄緑'],['#ddd0b8','砂'],['#a9bcc9','薄藍'],['#f2d7c4','肌・淡'],['#737a82','灰']];
type Cat={id:string;label:string;slots:string[];hint:string;icon:string};
const ICON={
 body:'<circle cx="12" cy="5" r="2.5"/><path d="M8 21v-6l-2-5h12l-2 5v6"/>',
 head:'<circle cx="12" cy="10" r="6"/><path d="M6 9c2-5 10-5 12 0"/>',
 top:'<path d="M8 4 3 7l2 4 2-1v10h10V10l2 1 2-4-5-3a4 4 0 0 1-8 0Z"/>',
 pants:'<path d="M7 3h10l1 18h-4l-2-11-2 11H6Z"/>',
 outer:'<path d="M8 3 3 6v14h5V9l4 5 4-5v11h5V6l-5-3-4 5Z"/>',
 shoes:'<path d="M3 16v-5h6l2 2h4l6 2v3H3Z"/>',
 accessories:'<circle cx="7" cy="13" r="3.5"/><circle cx="17" cy="13" r="3.5"/><path d="M10.5 13h3M3.5 12 3 9M20.5 12l.5-3"/>',
 mark:'<path d="M4 4h16v16H4Z"/><path d="M8 9h8M8 13h5"/>'};
const CATS:Cat[]=[
 {id:'body',label:'体型',slots:[],hint:'服はこの体型に合う物だけが出ます',icon:ICON.body},
 {id:'head',label:'顔・髪',slots:['head','face','hair'],hint:'頭・顔・髪',icon:ICON.head},
 {id:'top',label:'トップス',slots:['top'],hint:'上着の下に着る物',icon:ICON.top},
 {id:'pants',label:'パンツ',slots:['pants'],hint:'パンツ・裾',icon:ICON.pants},
 {id:'outer',label:'上着',slots:['outer'],hint:'襟と丈は下で選べます',icon:ICON.outer},
 {id:'shoes',label:'靴',slots:['shoes'],hint:'靴',icon:ICON.shoes},
 {id:'accessories',label:'小物',slots:['accessories'],hint:'衣装の飾りもここにあります',icon:ICON.accessories},
 {id:'mark',label:'模様・マーク',slots:['patterns'],hint:'文字や画像は服をクリックして置けます',icon:ICON.mark}];
const SLOT_TITLE:Record<string,string>={head:'頭',face:'顔',hair:'髪',top:'トップス',pants:'パンツ',outer:'上着',shoes:'靴',accessories:'小物',patterns:'模様'};
const ROLES:[string,string][]=[['skin','肌'],['hair','髪'],['top','トップス'],['pants','パンツ'],['outer','上着'],['shoes','靴'],['accessories','小物']];
const CAT_ROLE:Record<string,string>={head:'hair',top:'top',pants:'pants',outer:'outer',shoes:'shoes',accessories:'accessories'};
const modelLabels:Record<string,string>={Jacket:'フィールド・標準丈',JacketCollar:'フィールド・襟付き',JacketLong:'フィールド・長め',JacketLongCollar:'フィールド・襟付き長め',Bomber:'フライト・標準丈',BomberCollar:'フライト・襟付き',BomberLong:'フライト・長め',BomberLongCollar:'フライト・襟付き長め',Blazer:'ブレザー',TShirt:'半袖Tシャツ',Shirt:'襟付きシャツ',Jeans:'ジーンズ',WideJeans:'ワイドデニム',Trousers:'スラックス',Sunglasses:'サングラス',Cap:'キャップ',Tie:'ネクタイ',swept:'流し',parted:'七三',short:'短髪',bob:'ボブ',resort:'リゾート',swimsuit:'水着',shorts:'スイムショーツ'};
Object.assign(modelLabels,{waiter:'給仕',suit:'スーツ',guard:'警備',guest:'客',dress:'ドレス',wide:'つば広','0.474':'半袖','0.28':'袖なし',false:'男性用',true:'女性用'});
const paramTitle=(key:string)=>({model:'種類・襟・丈',kind:'形',cut:'袖の長さ',female:'形'} as Record<string,string>)[key]??'仕立て';
// Plain names for the cards (the ids stay as they are in recipes and in window.__outfitLab).
const PART_NAMES:Record<string,string>={
 'cast.head.male.v1':'男性の頭','cast.head.female.v1':'女性の頭','pool.head.v1':'プール客の頭','cast.face.male.v1':'男性の顔','cast.face.female.v1':'女性の顔','pool.face.v1':'プール客の顔',
 'cast.hair.v1':'髪型','pool.hair.v1':'プール客の髪','uniform.bald.v1':'スキンヘッド','uniform.slick.v1':'オールバック','uniform.spiky.v1':'つんつん頭',
 'cast.torso.v1':'長袖（共通）','uniform.torso.v1':'制服の長袖','pool.torso.v1':'水着・リゾート服','legacy.top.v1':'Tシャツ・シャツ','response.torso.v1':'特殊部隊の上着',
 'cast.legs.v1':'スラックス','pool.legs.v1':'プール客の脚','legacy.pants.v1':'ジーンズ・パンツ','cast.dress-legs.v1':'ドレスの裾','response.legs.v1':'特殊部隊のパンツ',
 'outer.layer.v1':'ジャケット','uniform.feet.v1':'素足','uniform.boots.v1':'ブーツ',
 'cast.chest-details.v1':'襟元','photographer.vest-inlay.v1':'カメラマンのベスト','pool.details.v1':'水着の飾り','uniform.delivery-inlay.v1':'配達のベスト',
 'uniform.collar.v1':'襟','uniform.camera.v1':'カメラ','legacy.accessories.v1':'サングラス・帽子・ネクタイ','cast.glasses.v1':'眼鏡','cast.hat.v1':'帽子',
 'uniform.dress.chef.v1':'料理人の衣装','uniform.dress.cleaner.v1':'清掃員の衣装','uniform.dress.delivery.v1':'配達員の衣装','uniform.dress.fisher.v1':'漁師の衣装','uniform.dress.bodyguard.v1':'護衛の衣装',
 'uniform.dress.sommelier.v1':'ソムリエの衣装','uniform.dress.driver.v1':'運転手の衣装','uniform.dress.beachbar.v1':'バー係の衣装','uniform.dress.pilot.v1':'操縦士の衣装','uniform.dress.masseuse.v1':'施術師の衣装',
 'uniform.dress.underwear.v1':'下着','uniform.dress.underwear_dark.v1':'下着（濃い肌）','uniform.dress.underwear_female.v1':'下着（女性）','uniform.dress.wine_merchant.v1':'ワイン商の衣装',
 'uniform.dress.lawyer.v1':'弁護士の衣装','uniform.dress.investor.v1':'投資家の衣装','uniform.dress.response.v1':'特殊部隊の装備'};
const partName=(id:string)=>PART_NAMES[id]??partLabel(id);
const svg=(body:string,size=22)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML=`<header class="topbar">
  <div class="brand"><span class="eyebrow">CLEAN HANDS · 開発ラボ</span><h1>服装ラボ</h1></div>
  <span class="divider" aria-hidden="true"></span>
  <label class="field">名前 <input id="character-name" value="新しいキャラ" maxlength="60"></label>
  <label class="field">開く <select id="existing" aria-label="既存キャラ"></select></label>
  <button id="open" hidden>開く</button>
  <span class="spacer"></span>
  <button id="undo" class="icon" aria-label="元に戻す (Ctrl+Z)" title="元に戻す (Ctrl+Z)">${svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>',20)}</button>
  <button id="redo" class="icon" aria-label="やり直す (Ctrl+Y)" title="やり直す (Ctrl+Y)">${svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>',20)}</button>
  <button id="random">${svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/>',18)}おまかせ</button>
  <button id="build" class="primary">保存して作る</button>
 </header>
 <nav class="rail" aria-label="部位">${CATS.map(c=>`<button data-cat="${c.id}">${svg(c.icon,24)}<span>${c.label}</span></button>`).join('')}</nav>
 <section class="stage" aria-label="服装の3Dプレビュー">
  <canvas id="view" aria-label="キャラクター全身。ドラッグで回転、ホイールで拡大"></canvas>
  <div class="chips top-left"><span id="live" class="chip live" role="status"><i></i><b id="live-text">読み込み中…</b></span><span id="match-status" class="chip muted"></span></div>
  <div class="chips top-right"><b id="model-name">服装ラボ</b><span id="model-info"></span></div>
  <p id="preview-status" role="status">作成サーバーへ接続中…</p>
  <div class="controls">
   <div class="segment" role="group" aria-label="動き">${[['loco-idle','立ち'],['loco-walk','歩き'],['loco-crouch','しゃがみ'],['gesture-dance','ダンス'],['gesture-work','仕事']].map(([id,l])=>`<button data-motion="${id}">${l}</button>`).join('')}</div>
   <div class="segment" role="group" aria-label="向き">${[['0','正面'],['35','35°'],['90','横'],['180','背面']].map(([a,l])=>`<button data-view="${a}">${l}</button>`).join('')}</div>
   <div class="segment time"><button id="pause" aria-label="一時停止">${svg('<path d="M8 5v14M16 5v14"/>',18)}</button><input id="time" aria-label="動きの時刻" type="range" min="0" max="8" step=".02" value="0"></div>
  </div>
 </section>
 <aside class="picker" aria-label="選ぶ">
  <div class="picker-head"><h2 id="cat-title"></h2><span id="cat-hint"></span></div>
  <div id="editor" class="picker-body"></div>
  <section class="colors" aria-label="色">
   <div class="colors-head"><h3>色</h3><button id="match-colors" class="small">パンツを上着の色に</button></div>
   <div id="roles" class="roles" role="group" aria-label="色を変える所"></div>
   <div id="swatches" class="swatches" role="group" aria-label="パレット"></div>
   <label class="custom">ほかの色 <input id="custom-color" type="color"></label>
  </section>
  <footer class="summary">
   <span class="label">今の組み合わせ（押すとその部位へ）</span>
   <div id="summary" class="summary-chips"></div>
   <p id="job-status" role="status"></p>
   <details class="more"><summary>ファイル</summary><div class="row">
    <button id="save-recipe">服装JSONを保存</button><label class="file-button">JSONを読み込む<input id="load-recipe" type="file" accept=".json"></label><button id="download" disabled>作成済みGLBを保存</button>
   </div></details>
  </footer>
 </aside>`;
const $=<E extends HTMLElement=HTMLElement>(s:string)=>app.querySelector<E>(s)!;
const apiBase=['8795','8890','8891','8892','8893','8894','8895','8896','8897','8898','8899'].includes(location.port)?location.origin:'http://127.0.0.1:8795';

// --- state
let catalog:OutfitCatalog,recipes:Record<string,CharacterRecipe>={},results:Record<string,string>={};
let draft:CharacterRecipe,sourceId='waiter',cat='outer',role='outer',dirty=false,busy=false,mark:Mark=structuredClone(defaultMark),markMesh='Outfit';
const history:CharacterRecipe[]=[],future:CharacterRecipe[]=[];
let modelUrl='',actor:PreviewActor|undefined,projected:T.SkinnedMesh|null=null,placing=false;
let paused=false,time=0,last=0,request=0,motion='loco-idle',previewTimer=0,previewStamp=0;

// --- the 3D view
const renderer=new T.WebGLRenderer({canvas:$('#view'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#1b2129');scene.add(new T.HemisphereLight('#f5f5f0','#646a72',2.1));
const key=new T.DirectionalLight('#fff8f0',2.1);key.position.set(-2.4,4,3);scene.add(key);
const rim=new T.DirectionalLight('#c3deff',1.25);rim.position.set(3,2,-4);scene.add(rim);
const floor=new T.Mesh(new T.CircleGeometry(.75,48),new T.MeshBasicMaterial({color:'#0f1318',transparent:true,opacity:.55}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
const grid=new T.GridHelper(24,48,'#3c4a55','#2a343d');grid.position.y=-.03;scene.add(grid);
const camera=new T.PerspectiveCamera(30,1,.03,100),controls=new OrbitControls(camera,$('#view'));
controls.target.set(0,.92,0);controls.minDistance=1.6;controls.maxDistance=7;controls.enablePan=false;controls.enableDamping=true;
let view=0;
const aim=(angle:number)=>{const d=4.4;camera.position.set(Math.sin(angle)*d,1.25,Math.cos(angle)*d);controls.update();};
const resize=()=>{const canvas=$<HTMLCanvasElement>('#view');renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);camera.updateProjectionMatrix();};
new ResizeObserver(resize).observe($('#view'));resize();aim(.25);
function resetTime(){time=0;if(actor)actor.sim=-1;}
function tick(now:number){const dt=Math.min(.05,(now-last)/1000||0);last=now;const clip=CLIPS.find(c=>c.id===motion)!;
 if(!paused)time=(time+dt)%clip.seconds;
 if(actor)poseMotionPreview(actor,[actor],clip,time,{role:'giver',gun:{id:'pistol',cls:'pistol'},variant:'standard'});
 $<HTMLInputElement>('#time').max=String(clip.seconds);$<HTMLInputElement>('#time').value=String(time);controls.update();renderer.render(scene,camera);requestAnimationFrame(tick);
}requestAnimationFrame(tick);
function destroy(){projected?.removeFromParent();projected?.geometry.dispose();projected=null;if(actor){scene.remove(actor.group);actor.model.traverse(o=>{const mesh=o as T.Mesh;if(mesh.isMesh){mesh.geometry.dispose();for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){(mat as T.MeshStandardMaterial).map?.dispose();mat.dispose();}}});}actor=undefined;}
// Swaps in a model. A live-preview swap keeps the motion's time, so the figure does not jump back to the start.
async function showModel(url:string,id:string,keepTime=false){const stamp=++request;if(!actor){$('#preview-status').hidden=false;$('#preview-status').textContent='モデルを読み込んでいます…';}
 const gltf=await new GLTFLoader().loadAsync(url);if(stamp!==request)return;destroy();
 const model=gltf.scene;if(id==='wardrobe'||id==='guest_male')applyLook(model,DEFAULT_LOOK);
 let triangles=0;model.traverse(o=>{const m=o as T.Mesh;if(m.isMesh){o.frustumCulled=false;const g=m.geometry;triangles+=(g.index?g.index.count:g.attributes.position.count)/3;}});
 const group=new T.Group();group.add(model);scene.add(group);
 actor={def:{id},group,model,rig:new Rig(model),loco:new Locomotion(),sim:-1,weapons:{}};if(keepTime)actor.sim=-1;else resetTime();
 $('#model-info').textContent=`三角形 ${Math.round(triangles)} · 共通リグ 22 骨`;$('#preview-status').hidden=true;void previewMark().catch(fail);
}

// --- live preview: every change is built by Blender (kept running by the server) and swapped in
function setLive(state:'live'|'building'|'saved'|'fixed'|'error',text:string){const chip=$('#live');chip.dataset.state=state;$('#live-text').textContent=text;}
function schedulePreview(){if(!draft||draft.assetMode!=='generated')return;clearTimeout(previewTimer);setLive('building','組み立て中…');previewTimer=window.setTimeout(()=>void buildPreview(),140);}
async function buildPreview(){const stamp=++previewStamp;try{
 const recipe=structuredClone(draft);delete recipe.mark;delete recipe.surfaceMark;
 const response=await fetch(apiBase+'/api/outfit/preview',{method:'POST',headers:{'Content-Type':'application/json','X-Outfit-Lab':'1'},body:JSON.stringify({recipe})});
 const value=await response.json();if(!response.ok)throw new Error(value.error??'プレビューを作れませんでした。');if(stamp!==previewStamp)return;
 await showModel(apiBase+value.modelUrl,value.id,true);if(stamp!==previewStamp)return;setLive('live','変更はすぐ反映');
}catch(error){if(stamp===previewStamp){setLive('error','プレビューに失敗');fail(error);}}}

// --- recipe changes
function changed(next:CharacterRecipe){history.push(structuredClone(draft));future.length=0;draft=next;dirty=true;refresh();schedulePreview();}
function bodyPreset(profile:string){const preferred=profile==='cast.male.v1'?'waiter':profile==='cast.female.v1'?'guest_dress':'';return recipes[preferred]??Object.values(recipes).find(r=>r.assetMode==='generated'&&r.body?.profile===profile)!;}
async function setBody(profile:string){const base=bodyPreset(profile);if(!base)throw new Error('体型が見つかりません。');sourceId=base.id;$('#job-status').textContent='';$<HTMLInputElement>('#character-name').value='新しいキャラ';
 if(draft)history.push(structuredClone(draft));future.length=0;draft=structuredClone(base);draft.id='draft';draft.appearanceColors={};mark=structuredClone(defaultMark);dirty=true;
 $<HTMLSelectElement>('#existing').value='__new';await showModel(apiBase+'/api/outfit/models/'+base.id,base.id);refresh();schedulePreview();}
function undo(){const previous=history.pop();if(!previous)return;future.push(structuredClone(draft));draft=previous;dirty=true;refresh();schedulePreview();}
function redo(){const next=future.pop();if(!next)return;history.push(structuredClone(draft));draft=next;dirty=true;refresh();schedulePreview();}

function roleColor(name:string){
 if(draft.appearanceColors?.[name])return draft.appearanceColors[name];
 const palette=PALETTE.map(p=>p[0].slice(1));
 const piece=draft.parts?.find(p=>catalog.parts.find(d=>d.id===p.part)?.slot===({skin:'head',hair:'hair',top:'top',pants:'pants'} as Record<string,string>)[name]);
 if(name==='outer')return '#53634b';
 if(piece?.part==='legacy.top.v1')return '#e7e1d3';
 if(piece?.part==='legacy.pants.v1')return '#345880';
 const cell=piece?(piece.colors.skin??piece.colors.color??piece.colors.hc??piece.colors.c??(name==='top'?1:0)):0;
 const override=(draft.palette?.overrides??{}) as Record<string,string>;
 return '#'+(override[String(cell)]??palette[cell]);
}
const editable=()=>draft?.assetMode==='generated';
const djLocked=(slot:string)=>(draft.specialOperations as {operation?:string}[]|undefined)?.some(op=>op.operation?.startsWith('dj.'))&&['hair','top','pants','accessories','patterns'].includes(slot);
const currentPiece=(slot:string)=>draft.parts?.find(p=>catalog.parts.find(d=>d.id===p.part)?.slot===slot);
function setColor(hex:string){if(!editable())return;changed({...draft,appearanceColors:{...draft.appearanceColors,[role]:hex}});}

// --- drawing the panel
function refresh(){
 if(!draft||!catalog)return;
 const name=inventory.find(e=>e.id===sourceId)?.label??draft.label??'新しいキャラ';$('#model-name').textContent=dirty?$<HTMLInputElement>('#character-name').value||'新しいキャラ':name;
 $('#match-status').textContent=dirty?'編集中 · 本番の GLB は「保存して作る」で作ります':results[sourceId]==='byte-match'||sourceId==='guest_male'?'元とバイト一致 · 段階3 PASS':'Blender で作成済み';
 if(!editable())setLive('fixed','固定資産（表示だけ）');else if(!dirty)setLive('saved','保存済みのモデル');
 app.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cat===cat)));
 app.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===motion)));
 app.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.view)===view)));
 $<HTMLButtonElement>('#build').disabled=!editable()||busy;$<HTMLInputElement>('#character-name').disabled=!editable();
 $<HTMLButtonElement>('#download').disabled=!modelUrl||dirty;$<HTMLButtonElement>('#undo').disabled=!history.length;$<HTMLButtonElement>('#redo').disabled=!future.length;$<HTMLButtonElement>('#random').disabled=!editable();
 const c=CATS.find(x=>x.id===cat)!;$('#cat-title').textContent=c.label;$('#cat-hint').textContent=c.hint;
 const editor=$('#editor');editor.replaceChildren();
 if(!editable()){editor.append(note('このキャラは主人公などの固定資産なので、表示だけです。新しく作るには「開く」で「新しいキャラ（白紙）」を選ぶか、体型を選んでください。'));}
 if(cat==='body')renderBodies(editor);
 else if(editable())for(const slot of c.slots)renderSlot(editor,slot,c.slots.length>1);
 if(cat==='mark'&&editable())renderMarks(editor);
 renderColors();renderSummary();
}
function note(text:string){const p=document.createElement('p');p.className='note';p.textContent=text;return p;}
function card(label:string,on:boolean,thumb:string,onClick:()=>void,glyph=''){const b=document.createElement('button');b.className='card';b.setAttribute('aria-pressed',String(on));b.disabled=!editable();
 b.innerHTML=`<span class="thumb" style="--thumb:${thumb}">${glyph}</span><span class="card-label">${esc(label)}</span>${on?`<span class="check">${svg('<path d="M5 12l5 5 9-10"/>',12)}</span>`:''}`;b.onclick=onClick;return b;}
function renderBodies(parent:HTMLElement){const grid=document.createElement('div');grid.className='cards';
 for(const profile of catalog.bodies)grid.append(card(bodyLabels[profile]??profile,draft.body?.profile===profile,profile.includes('female')||profile.includes('swimsuit')||profile.includes('resort')||profile.includes('slim')||profile.includes('strong')?'#f2d7c4':'#d9b39a',()=>void setBody(profile).catch(fail),svg(ICON.body,26)));
 grid.querySelectorAll('button').forEach(b=>b.disabled=false);parent.append(grid);}
function renderSlot(parent:HTMLElement,slot:string,titled:boolean){
 if(titled){const h=document.createElement('h3');h.className='slot-title';h.textContent=SLOT_TITLE[slot];parent.append(h);}
 if(djLocked(slot)){parent.append(note('DJ専用の一体部品です。組み合わせるには、新しいキャラから作ってください。'));return;}
 const defs=available(catalog,draft.body!.profile,slot),current=currentPiece(slot),grid=document.createElement('div');grid.className='cards';
 const tint=CAT_ROLE[cat]?roleColor(CAT_ROLE[cat]):'#8b9c88',glyph=svg(CATS.find(c=>c.slots.includes(slot))?.icon??ICON.mark,26);
 if(!['head','face','top','pants'].includes(slot))grid.append(card('なし',!current,'#232a33',()=>changed(selectPiece(draft,catalog,slot,'')),svg('<path d="M6 6l12 12M18 6 6 18"/>',22)));
 for(const def of defs)grid.append(card(partName(def.id),current?.part===def.id,tint,()=>changed(selectPiece(draft,catalog,slot,def.id)),glyph));
 parent.append(grid);
 if(current){const def=defs.find(d=>d.id===current.part);if(def)renderParams(parent,slot,def,current.parameters);}
}
function renderParams(parent:HTMLElement,slot:string,def:PartDef,params:Record<string,string|number|boolean>){
 for(const [key,values] of Object.entries(def.parameters)){if(values.length<2)continue;const box=document.createElement('div');box.className='params';box.innerHTML=`<span class="params-title">${esc(paramTitle(key))}</span>`;const row=document.createElement('div');row.className='pills';
  for(const value of values){const pool=draft.body!.profile.startsWith('pool.')&&slot==='hair'&&key==='kind';const label=pool?(draft.body!.profile==='pool.variant.strong.v1'?'専用ボブ':({swimsuit:'まとめ髪',resort:'ボブ',shorts:'クロップ'} as Record<string,string>)[String(value)]??String(value)):modelLabels[String(value)]??String(value);
   const b=document.createElement('button');b.className='pill';b.textContent=label;b.setAttribute('aria-pressed',String(params[key]===value));b.onclick=()=>changed(selectPiece(draft,catalog,slot,def.id,{...params,[key]:value}));row.append(b);}
  box.append(row);parent.append(box);}
}
function renderColors(){const roles=$('#roles');roles.replaceChildren();
 for(const [id,label] of ROLES){const b=document.createElement('button');b.className='role';b.setAttribute('aria-pressed',String(role===id));b.disabled=!editable();b.innerHTML=`<i style="--c:${roleColor(id)}"></i>${label}`;b.onclick=()=>{role=id;refresh();};roles.append(b);}
 const sw=$('#swatches');sw.replaceChildren();const now=roleColor(role).toLowerCase();
 for(const [hex,name] of PALETTE){const b=document.createElement('button');b.className='swatch';b.style.setProperty('--c',hex);b.setAttribute('aria-label',name);b.title=name;b.setAttribute('aria-pressed',String(now===hex));b.disabled=!editable();b.onclick=()=>setColor(hex);sw.append(b);}
 const custom=$<HTMLInputElement>('#custom-color');custom.value=now;custom.disabled=!editable();$<HTMLButtonElement>('#match-colors').disabled=!editable();
}
function renderSummary(){const box=$('#summary');box.replaceChildren();
 const items:[string,string,string][]=[['body',bodyLabels[draft.body?.profile??'']??'固定資産','#8b9c88']];
 if(draft.parts)for(const c of CATS.slice(1))for(const slot of c.slots){const p=currentPiece(slot);if(p&&slot!=='face'&&slot!=='head')items.push([c.id,partName(p.part),CAT_ROLE[c.id]?roleColor(CAT_ROLE[c.id]):'#8b9c88']);}
 if(mark.text||mark.png)items.push(['mark','マーク'+(mark.text?'「'+mark.text+'」':''),'#f2c14e']);
 for(const [id,text,color] of items){const b=document.createElement('button');b.className='summary-chip';b.innerHTML=`<i style="--c:${color}"></i>${esc(text)}`;b.onclick=()=>{cat=id;if(CAT_ROLE[id])role=CAT_ROLE[id];refresh();};box.append(b);}
}

// --- marks (text / PNG on the cloth, placed by clicking); shown at once by projecting onto the preview model
function updateMark(patch:Partial<Mark>,rerender=true){mark=parseOld({version:1,pieces:defaults,mark:{...mark,...patch}}).mark;draft.mark=structuredClone(mark);dirty=true;void previewMark().catch(fail);if(rerender)refresh();else renderSummary();}
function setMark(patch:Partial<Mark>){updateMark(patch);}
function renderMarks(parent:HTMLElement){const box=document.createElement('div');box.className='mark-box';box.innerHTML=`<h3 class="slot-title">文字・画像のマーク</h3>
 <div class="mark-grid"><label>文字 <input id="mark-text" maxlength="12" placeholder="例 07"></label><label>文字色 <input id="mark-color" type="color"></label></div>
 <div class="row"><label class="file-button">PNGを選ぶ<input id="mark-image" type="file" accept="image/png"></label><button id="place-mark" class="accent">服の表面に置く</button><button id="reset-mark-position">胸に戻す</button><button id="clear-mark">消す</button></div>
 <label class="slider">大きさ <input id="mark-size" type="range" min="3" max="35" value="12"><output id="mark-size-out"></output></label>
 <label class="slider">回転 <input id="mark-angle" type="range" min="-180" max="180" value="0"><output id="mark-angle-out"></output></label>
 <p class="note">「服の表面に置く」を押してから、モデルの胸・背中・袖などをクリックします。</p>`;parent.append(box);
 $<HTMLInputElement>('#mark-text').value=mark.text;$<HTMLInputElement>('#mark-color').value=mark.color;
 $('#mark-text').oninput=()=>updateMark({text:$<HTMLInputElement>('#mark-text').value,png:undefined},false);$('#mark-color').oninput=()=>updateMark({color:$<HTMLInputElement>('#mark-color').value},false);
 $('#clear-mark').onclick=()=>setMark({...defaultMark,png:undefined,placement:undefined});$('#reset-mark-position').onclick=()=>setMark({placement:undefined});
 $('#place-mark').onclick=()=>{placing=true;controls.enabled=false;motion='loco-idle';resetTime();refresh();$('#job-status').textContent='服の表面をクリックしてください。';};
 const size=$<HTMLInputElement>('#mark-size'),angle=$<HTMLInputElement>('#mark-angle');
 const show=()=>{$('#mark-size-out').textContent=size.value+' cm';$('#mark-angle-out').textContent=angle.value+'°';};
 size.value=String(Math.round((mark.placement?.size??.12)*100));angle.value=String(mark.placement?.angle??0);show();
 const adjust=()=>setMark({placement:{...(mark.placement??defaultPlacement()),size:Number(size.value)/100,angle:Number(angle.value)}});
 size.oninput=show;angle.oninput=show;size.onchange=adjust;angle.onchange=adjust;
 $<HTMLInputElement>('#mark-image').onchange=async()=>{const file=$<HTMLInputElement>('#mark-image').files?.[0];if(!file)return;try{if(file.type!=='image/png'||file.size>MAX_PNG_BYTES)throw new Error('256 KB以内のPNGを選んでください。');const bytes=new Uint8Array(await file.arrayBuffer());setMark({png:'data:image/png;base64,'+btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))});}catch(error){fail(error);}};
}
function defaultPlacement(){return {slot:'TShirt' as const,point:[.10,1.31,.12] as [number,number,number],normal:[0,0,1] as [number,number,number],size:.12,angle:0};}
// Where the mark goes when nobody has placed it: the left chest of the outermost garment, found on the mesh itself
// (a jacket sits further out than the shirt, so a fixed depth would miss it).
function frontPlacement(mesh:T.SkinnedMesh){const g=mesh.geometry,p=g.getAttribute('position'),n=g.index?g.index.count:p.count,at=(i:number)=>g.index?.getX(i)??i;
 const ray=new T.Ray(new T.Vector3(.10,1.31,1),new T.Vector3(0,0,-1)),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3();let best:{z:number;normal:T.Vector3}|null=null;
 for(let i=0;i<n;i+=3){a.fromBufferAttribute(p,at(i));b.fromBufferAttribute(p,at(i+1));c.fromBufferAttribute(p,at(i+2));if(!ray.intersectTriangle(a,b,c,false,hit))continue;if(!isClothFace(mesh,[at(i),at(i+1),at(i+2)]))continue;
  if(!best||hit.z>best.z){const normal=T.Triangle.getNormal(a,b,c,new T.Vector3());if(normal.z<0)normal.negate();best={z:hit.z,normal};}}
 const base=defaultPlacement();if(!best)return base;return {...base,slot:mesh.name==='Outer'?'Jacket' as const:'TShirt' as const,point:[.10,1.31,best.z] as [number,number,number],normal:best.normal.toArray() as [number,number,number],size:mark.placement?.size??base.size,angle:mark.placement?.angle??base.angle};}
function markTarget(){const name=!mark.placement&&actor?.model.getObjectByName('Outer')?'Outer':markMesh;return actor?.model.getObjectByName(name) as T.SkinnedMesh|undefined;}
async function markImage(){const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d')!;if(mark.png){const img=new Image();img.src=mark.png;await img.decode();const scale=230/Math.max(img.width,img.height);g.drawImage(img,(256-img.width*scale)/2,(256-img.height*scale)/2,img.width*scale,img.height*scale);}else {g.fillStyle=mark.color;g.font='700 104px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(mark.text,128,128,228);}return cv;}
async function previewMark(){const baked=actor?.model.getObjectByName('Mark_Surface') as T.SkinnedMesh|undefined;if(baked&&baked!==projected){baked.removeFromParent();baked.geometry.dispose();}projected?.removeFromParent();projected?.geometry.dispose();projected=null;if(!actor||(!mark.text&&!mark.png))return;const source=markTarget();if(!source?.isSkinnedMesh)return;const cv=await markImage();const texture=new T.CanvasTexture(cv);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;projected=projectMark(source,mark.placement??frontPlacement(source),new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false,side:T.DoubleSide}));}
const ray=new T.Raycaster();$('#view').onpointerdown=event=>{if(!placing||!actor)return;const box=$('#view').getBoundingClientRect();ray.setFromCamera(new T.Vector2((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2),camera);
 const meshes:T.SkinnedMesh[]=[];actor.model.traverse(o=>{const m=o as T.SkinnedMesh;if(m.isSkinnedMesh&&m.visible&&!['Face','Head','Hair','Hands','Mark_Surface'].includes(m.name)&&(m.name!=='Body'||draft.body?.profile.startsWith('pool.')))meshes.push(m);});const hit=ray.intersectObjects(meshes,false)[0];if(hit){const mesh=hit.object as T.SkinnedMesh;const placement=placementFromHit(mesh,hit,mesh.name==='Outer'?'Jacket':'TShirt',mark.placement?.size??.12,mark.placement?.angle??0,ray.ray.direction);if(placement){markMesh=mesh.name;setMark({placement});$('#job-status').textContent='';}}placing=false;controls.enabled=true;};

// --- open, save, files
function fail(error:unknown){$('#job-status').textContent=(error as Error).message??String(error);}
async function openExisting(id:string){const recipe=recipes[id];if(!recipe)throw new Error('キャラが見つかりません。');sourceId=id;$<HTMLSelectElement>('#existing').value=id;$('#job-status').textContent='';$<HTMLInputElement>('#character-name').value=recipe.label??inventory.find(e=>e.id===id)?.label??id;
 draft=structuredClone(recipe);mark=structuredClone((recipe.mark as Mark|undefined)??defaultMark);markMesh=(recipe.surfaceMark as {mesh?:string}|undefined)?.mesh??'Outfit';dirty=false;history.length=0;future.length=0;clearTimeout(previewTimer);previewStamp++;
 modelUrl=apiBase+'/api/outfit/models/'+id;await showModel(modelUrl,id);$<HTMLButtonElement>('#download').disabled=false;refresh();}
async function saveAndBuild(name=$<HTMLInputElement>('#character-name').value){if(busy)throw new Error('作成中です。');if(draft.assetMode!=='generated')throw new Error('固定資産は保存できません。');busy=true;refresh();try{
 const recipe=structuredClone(draft);recipe.mark=structuredClone(mark);
 if(mark.text||mark.png){const source=markTarget();const placement=mark.placement??(source?.isSkinnedMesh?frontPlacement(source):defaultPlacement());const legacy=recipe.parts?.find(p=>p.part==='legacy.top.v1');const target=mark.placement?markMesh:recipe.parts?.some(p=>p.part==='outer.layer.v1')?'Outer':legacy?String(legacy.parameters.model):markMesh;recipe.surfaceMark={...placement,mesh:target,png:(await markImage()).toDataURL('image/png')};}else delete recipe.surfaceMark;
 const job=await postBuild(apiBase,recipe,name);$('#job-status').textContent='保存しました · 作成を待っています…';let value:{state:string;error?:string;modelUrl?:string;sha256?:string;id:string};
 do {await new Promise(resolve=>setTimeout(resolve,400));const response=await fetch(apiBase+'/api/outfit/jobs/'+job.id);value=await response.json();if(!response.ok)throw new Error(value.error??'生成ジョブを確認できません。');$('#job-status').textContent=value.state==='running'?'Blender で作成しています…':'作成待ち…';if(value.state==='error')throw new Error(value.error??'作成に失敗しました。');}while(value.state!=='complete');
 modelUrl=apiBase+value.modelUrl!;await showModel(modelUrl,job.id);draft={...recipe,id:job.id,label:name};sourceId=job.id;dirty=false;recipes[job.id]=structuredClone(draft);
 if(![...$<HTMLSelectElement>('#existing').options].some(o=>o.value===job.id))$<HTMLSelectElement>('#existing').add(new Option('作ったキャラ · '+name,job.id));$<HTMLSelectElement>('#existing').value=job.id;
 try{localStorage.setItem('clean-hands.outfit-lab.last',job.id);}catch{}
 $('#job-status').textContent='作成完了 · '+name+' · SHA-256 '+value.sha256?.slice(0,12)+'…';$<HTMLButtonElement>('#download').disabled=false;return value;
 }finally{busy=false;refresh();}}
function download(data:Blob,name:string){const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function setRecipe(value:unknown){const raw=(value as {version?:number})?.version===1?migrateLegacy(value,catalog,recipes.waiter):value as CharacterRecipe;if(raw.schemaVersion!==1||!['generated','fixed','alias'].includes(raw.assetMode))throw new Error('レシピの形式が違います。');if(raw.assetMode==='generated'&&(!raw.body||!catalog.bodies.includes(raw.body.profile)||!Array.isArray(raw.parts)||!raw.output||raw.parts.some(p=>!catalog.parts.some(d=>d.id===p.part&&d.bodies.includes(raw.body!.profile)))))throw new Error('体型・部品の形式が違います。');
 if(draft)history.push(structuredClone(draft));future.length=0;draft=structuredClone(raw);mark=structuredClone((raw.mark as Mark|undefined)??defaultMark);markMesh=(raw.surfaceMark as {mesh?:string}|undefined)?.mesh??'Outfit';dirty=true;refresh();schedulePreview();}
// おまかせ: a random piece (and setting) for each slot this body offers, and random top / pants / outer colours.
function randomize(){if(!editable())return;const pick=<V>(a:readonly V[])=>a[Math.floor(Math.random()*a.length)];let next=structuredClone(draft);
 for(const slot of ['hair','top','pants','outer','shoes','accessories']){if(djLocked(slot))continue;const defs=available(catalog,next.body!.profile,slot);if(!defs.length)continue;
  const optional=!['top','pants'].includes(slot);if(optional&&Math.random()<(slot==='accessories'?.5:.3)){next=selectPiece(next,catalog,slot,'');continue;}
  const def=pick(defs);next=selectPiece(next,catalog,slot,def.id,Object.fromEntries(Object.entries(def.parameters).map(([k,v])=>[k,pick(v)])));}
 const colors=PALETTE.map(p=>p[0]);next.appearanceColors={...next.appearanceColors,top:pick(colors),pants:pick(colors),outer:pick(colors)};changed(next);}

// --- wiring
app.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach(b=>b.onclick=()=>{cat=b.dataset.cat!;if(CAT_ROLE[cat])role=CAT_ROLE[cat];refresh();});
app.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b=>b.onclick=()=>{motion=b.dataset.motion!;resetTime();refresh();});
app.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>{view=Number(b.dataset.view);aim(T.MathUtils.degToRad(view));refresh();});
$('#pause').onclick=()=>{paused=!paused;$('#pause').setAttribute('aria-label',paused?'再生':'一時停止');$('#pause').innerHTML=paused?svg('<path d="M7 4l12 8-12 8Z"/>',18):svg('<path d="M8 5v14M16 5v14"/>',18);};
$<HTMLInputElement>('#time').oninput=()=>{time=Number($<HTMLInputElement>('#time').value);paused=true;$('#pause').innerHTML=svg('<path d="M7 4l12 8-12 8Z"/>',18);if(actor)actor.sim=-1;};
$('#undo').onclick=undo;$('#redo').onclick=redo;$('#random').onclick=randomize;
$('#build').onclick=()=>void saveAndBuild().catch(fail);
$('#open').onclick=()=>void openExisting($<HTMLSelectElement>('#existing').value).catch(fail);
$<HTMLSelectElement>('#existing').onchange=()=>{const id=$<HTMLSelectElement>('#existing').value;void (id==='__new'?setBody('cast.male.v1'):openExisting(id)).catch(fail);};
$('#match-colors').onclick=()=>{if(editable())changed({...draft,appearanceColors:{...draft.appearanceColors,pants:roleColor('outer')}});};
$<HTMLInputElement>('#custom-color').onchange=()=>setColor($<HTMLInputElement>('#custom-color').value);
$<HTMLInputElement>('#character-name').oninput=()=>{if(dirty)$('#model-name').textContent=$<HTMLInputElement>('#character-name').value||'新しいキャラ';};
$('#save-recipe').onclick=()=>download(new Blob([JSON.stringify({...draft,mark},null,2)],{type:'application/json'}),'character-recipe.json');
$('#download').onclick=async()=>{try{const response=await fetch(modelUrl);download(await response.blob(),(draft.id??'character')+'.glb');}catch(error){fail(error);}};
$<HTMLInputElement>('#load-recipe').onchange=async()=>{try{const file=$<HTMLInputElement>('#load-recipe').files?.[0];if(file)setRecipe(JSON.parse(await file.text()));}catch(error){fail(error);}};
addEventListener('keydown',e=>{const typing=(e.target as HTMLElement)?.closest?.('input,select,textarea');if(typing||!(e.ctrlKey||e.metaKey))return;const k=e.key.toLowerCase();if(k==='z'&&!e.shiftKey){e.preventDefault();undo();}else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();redo();}});

const ready=(async()=>{try{const response=await fetch(apiBase+'/api/outfit/catalog');if(!response.ok)throw new Error('作成サーバーへ接続できません。');const data=await response.json();catalog=data.catalog;recipes={...data.recipes,...data.newRecipes};results=data.results;
 const select=$<HTMLSelectElement>('#existing');select.add(new Option('新しいキャラ（白紙）','__new'));const groups=new Map<string,HTMLOptGroupElement>();
 for(const entry of inventory){const g=groups.get(entry.group)??Object.assign(document.createElement('optgroup'),{label:entry.group});groups.set(entry.group,g);g.append(new Option(entry.label+' · '+entry.id,entry.id));}
 for(const g of groups.values())select.append(g);const made=Object.entries(data.newRecipes??{}) as [string,CharacterRecipe][];if(made.length){const g=Object.assign(document.createElement('optgroup'),{label:'作ったキャラ'});for(const [id,r] of made)g.append(new Option(r.label??id,id));select.append(g);}
 let last:string|null=null;try{last=localStorage.getItem('clean-hands.outfit-lab.last');}catch{}
 await openExisting(last&&recipes[last]?last:'waiter');}catch(error){$('#preview-status').textContent='作成サーバー（8795 または確認用ポート）から開いてください。';fail(error);}})();
const stepOf=()=>CATS.findIndex(c=>c.id===cat);
// For looking inside while developing (not part of window.__outfitLab).
Object.assign(window,{__outfitLabView:{scene,actor:()=>actor,projected:()=>projected,mark:()=>mark}});
Object.assign(window,{__outfitLab:{ready,getRecipe:()=>structuredClone({...draft,mark}),setRecipe,loadRecipe:async(value:string|CharacterRecipe)=>{await ready;if(typeof value==='string')await openExisting(value);else setRecipe(value);},setBody,selectPart:(slot:string,id:string,params={})=>changed(selectPiece(draft,catalog,slot,id,params)),
 setPart:(slot:string,patch:{model?:string;part?:string;color?:string;collar?:boolean;long?:boolean})=>{const translated=({TShirt:'top',Jeans:'pants',Jacket:'outer',Sunglasses:'accessories'} as Record<string,string>)[slot]??slot;if(patch.part)changed(selectPiece(draft,catalog,translated,patch.part));else if(patch.model!==undefined||patch.collar!==undefined||patch.long!==undefined){let model=patch.model??String(draft.parts?.find(p=>p.part==='outer.layer.v1')?.parameters.model??'Jacket');if(translated==='outer'&&model&&(model.startsWith('Jacket')||model.startsWith('Bomber'))){const base=model.startsWith('Bomber')?'Bomber':'Jacket';model=base+((patch.long??model.includes('Long'))?'Long':'')+((patch.collar??model.includes('Collar'))?'Collar':'');}const id=({top:'legacy.top.v1',pants:'legacy.pants.v1',outer:'outer.layer.v1',accessories:'legacy.accessories.v1'} as Record<string,string>)[translated];changed(selectPiece(draft,catalog,translated,model?id:'',{model}));}if(patch.color)changed({...draft,appearanceColors:{...draft.appearanceColors,[translated]:patch.color}});},
 setMark,getInventory:()=>structuredClone(inventory),findInventory:(q:string)=>structuredClone(inventory.filter(e=>JSON.stringify(e).toLocaleLowerCase().includes(q.toLocaleLowerCase()))),listParts:()=>structuredClone(catalog.parts),saveAndBuild,exportGLB:async()=>{if(!modelUrl||dirty)throw new Error('先に保存して作ってください。');return (await fetch(modelUrl)).arrayBuffer();},
 setMotion:(id:string,at=0)=>{if(!CLIPS.some(c=>c.id===id))throw new Error('不明な動きです。');motion=id;time=at;paused=true;$('#pause').innerHTML=svg('<path d="M7 4l12 8-12 8Z"/>',18);if(actor)actor.sim=-1;refresh();},status:()=>({dirty,busy,sourceId,modelUrl,step:stepOf()})}});

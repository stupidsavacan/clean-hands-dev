import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Rig} from '../rig';
import {Locomotion} from '../locomotion';
import {applyLook} from '../appearance';
import {DEFAULT_LOOK} from '../wardrobe';
import {CLIPS} from './motion-clips';
import {poseMotionPreview,type PreviewActor} from './motion-preview';
import {projectMark,placementFromHit} from './outfit-decal';
import {defaultMark,defaults,parseRecipe as parseOld,type Mark,MAX_PNG_BYTES} from './outfit-design';
import inventory from './outfit-inventory.json';
import {available,selectPiece,migrateLegacy,partLabel,slotLabels,bodyLabels,postBuild,type CharacterRecipe,type OutfitCatalog} from './outfit-recipes';
import './outfit-lab.css';

const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML=`<section class="preview" aria-label="服装の3Dプレビュー"><canvas id="view" aria-label="キャラクター全身"></canvas>
 <div class="preview-tag"><b id="model-name">服装ラボ</b><span id="match-status">レシピを読み込んでいます…</span></div>
 <div class="camera row"><button data-view="0">正面</button><button data-view="35">35°</button><button data-view="90">横</button><button data-view="180">背面</button></div>
 <div class="motion-bar"><label>動き <select id="motion"><option value="loco-idle">立ち</option><option value="loco-walk">歩き</option><option value="loco-crouch">しゃがみ</option><option value="gesture-dance">ダンス</option><option value="gesture-work">仕事</option></select></label><button id="pause">一時停止</button><input id="time" aria-label="動きの時刻" type="range" min="0" max="8" step=".02" value="0"></div>
 <p id="preview-status" role="status">作成サーバーへ接続中…</p></section>
 <aside class="panel" aria-label="服装の編集"><header><span class="eyebrow">CLEAN HANDS / 開発補助ラボ</span><h1>服装ラボ</h1><p>体型と部品を選び、保存して作成します。</p></header>
 <section class="group"><h2>既存キャラを開く</h2><div class="row"><select id="existing" aria-label="既存キャラ"></select><button id="open">開く</button><button id="new">新しいキャラ</button></div><p id="source-note"></p></section>
 <nav class="steps" aria-label="作成の手順">${['体型','頭・顔・髪','服の部品','色・マーク','保存・確認'].map((s,i)=>`<button data-step="${i}">${i+1}. ${s}</button>`).join('')}</nav>
 <section class="group" id="editor"></section>
 <div class="row navigation"><button id="prev">前へ</button><button id="next" class="primary">次へ</button></div>
 <section class="group"><h2>保存と作成</h2><label class="name-label">名前 <input id="character-name" value="新しいキャラ" maxlength="60"></label><div class="row"><button id="build" class="primary">保存して作る</button><button id="undo">元に戻す</button></div>
 <p id="job-status" role="status"></p><div class="row"><button id="save-recipe">服装JSONを保存</button><label class="file-button">JSONを読み込む<input id="load-recipe" type="file" accept=".json"></label><button id="download" disabled>作成済みGLBを保存</button></div></section></aside>`;
const $=<E extends HTMLElement=HTMLElement>(s:string)=>app.querySelector<E>(s)!;
const apiBase=['8795','8890','8891','8892','8893','8894','8895','8896','8897','8898','8899'].includes(location.port)?location.origin:'http://127.0.0.1:8795';
let catalog:OutfitCatalog,recipes:Record<string,CharacterRecipe>={},results:Record<string,string>={};
let draft:CharacterRecipe,sourceId='waiter',step=0,dirty=false,busy=false,mark:Mark=structuredClone(defaultMark),markMesh='Outfit';
const history:CharacterRecipe[]=[];
let modelUrl='',actor:PreviewActor|undefined,projected:T.SkinnedMesh|null=null,placing=false;
let paused=false,time=0,last=0,request=0;
const renderer=new T.WebGLRenderer({canvas:$('#view'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#283139');scene.add(new T.HemisphereLight('#f5f5f0','#646a72',2.1));
const key=new T.DirectionalLight('#fff8f0',2.1);key.position.set(-2.4,4,3);scene.add(key);
const rim=new T.DirectionalLight('#c3deff',1.25);rim.position.set(3,2,-4);scene.add(rim);
const grid=new T.GridHelper(24,48,'#536570','#394750');grid.position.y=-.03;scene.add(grid);
const camera=new T.PerspectiveCamera(34,1,.03,100),controls=new OrbitControls(camera,$('#view'));
controls.target.set(0,.92,0);controls.minDistance=1.8;controls.maxDistance=7;controls.enablePan=false;
const aim=(angle:number)=>{const d=4.2;camera.position.set(Math.sin(angle)*d,1.2,Math.cos(angle)*d);controls.update();};
app.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>aim(T.MathUtils.degToRad(Number(b.dataset.view))));
const resize=()=>{const canvas=$<HTMLCanvasElement>('#view');renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();};
new ResizeObserver(resize).observe($('#view'));resize();aim(.25);
function resetTime(){time=0;if(actor)actor.sim=-1;}
$('#motion').onchange=resetTime;
$('#pause').onclick=()=>{paused=!paused;$('#pause').textContent=paused?'再生':'一時停止';};
$<HTMLInputElement>('#time').oninput=()=>{time=Number($<HTMLInputElement>('#time').value);paused=true;$('#pause').textContent='再生';if(actor)actor.sim=-1;};
function tick(now:number){const dt=Math.min(.05,(now-last)/1000||0);last=now;const clip=CLIPS.find(c=>c.id===$<HTMLSelectElement>('#motion').value)!;
 if(!paused)time=(time+dt)%clip.seconds;
 if(actor)poseMotionPreview(actor,[actor],clip,time,{role:'giver',gun:{id:'pistol',cls:'pistol'},variant:'standard'});
 $<HTMLInputElement>('#time').max=String(clip.seconds);$<HTMLInputElement>('#time').value=String(time);renderer.render(scene,camera);requestAnimationFrame(tick);
}requestAnimationFrame(tick);
function destroy(){projected?.removeFromParent();projected?.geometry.dispose();projected=null;if(actor){scene.remove(actor.group);actor.model.traverse(o=>{const mesh=o as T.Mesh;if(mesh.isMesh){mesh.geometry.dispose();for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){(mat as T.MeshStandardMaterial).map?.dispose();mat.dispose();}}});}actor=undefined;}
async function showModel(url:string,id:string){const stamp=++request;$('#preview-status').hidden=false;$('#preview-status').textContent='モデルを読み込んでいます…';
 const gltf=await new GLTFLoader().loadAsync(url);if(stamp!==request)return;destroy();
 const model=gltf.scene;if(id==='wardrobe'||id==='guest_male')applyLook(model,DEFAULT_LOOK);
 model.traverse(o=>{if((o as T.Mesh).isMesh)o.frustumCulled=false;});const group=new T.Group();group.add(model);scene.add(group);
 actor={def:{id},group,model,rig:new Rig(model),loco:new Locomotion(),sim:-1,weapons:{}};resetTime();$('#preview-status').hidden=true;
}
function changed(next:CharacterRecipe){history.push(structuredClone(draft));draft=next;dirty=true;refresh();}
function bodyPreset(profile:string){const preferred=profile==='cast.male.v1'?'waiter':profile==='cast.female.v1'?'guest_dress':'';return recipes[preferred]??Object.values(recipes).find(r=>r.assetMode==='generated'&&r.body?.profile===profile)!;}
async function setBody(profile:string){const base=bodyPreset(profile);if(!base)throw new Error('体型が見つかりません。');sourceId=base.id;$('#job-status').textContent='';$<HTMLInputElement>('#character-name').value='新しいキャラ';draft=structuredClone(base);draft.id='draft';draft.appearanceColors={};mark=structuredClone(defaultMark);dirty=true;history.length=0;await showModel(apiBase+'/api/outfit/models/'+base.id,base.id);refresh();}

function roleColor(role:string){
 if(draft.appearanceColors?.[role])return draft.appearanceColors[role];
 const palette=['2b2e35','efeadf','c22f21','f2c14e','17776c','3b5b8a','4fb8c9','d9b39a','9b7053','503f35','8b9c88','c8d7cf','ddd0b8','a9bcc9','f2d7c4','737a82'];
 const piece=draft.parts?.find(p=>catalog.parts.find(d=>d.id===p.part)?.slot===({skin:'head',hair:'hair',top:'top',pants:'pants'} as Record<string,string>)[role]);
 if(role==='outer')return '#53634b';
 if(piece?.part==='legacy.top.v1')return '#e7e1d3';
 if(piece?.part==='legacy.pants.v1')return '#345880';
 const cell=piece?(piece.colors.skin??piece.colors.color??piece.colors.hc??piece.colors.c??(role==='top'?1:0)):0;
 const override=(draft.palette?.overrides??{}) as Record<string,string>;
 return '#'+(override[String(cell)]??palette[cell]);
}

function refresh(){
 const editable=draft?.assetMode==='generated';$('#model-name').textContent=inventory.find(e=>e.id===sourceId)?.label??draft?.label??'新しいキャラ';
 $('#match-status').textContent=dirty?'編集中 · 変更は「保存して作る」で反映':results[sourceId]==='byte-match'||sourceId==='guest_male'?'元とバイト一致 · 段階3 PASS':'Blenderで作成済み';
 $('#source-note').textContent=editable?'既存レシピは保護されています。変更は新しいキャラとして保存します。':'固定資産です。編集するには「新しいキャラ」を選んでください。';
 app.querySelectorAll('[data-step]').forEach((b,i)=>b.setAttribute('aria-current',String(i===step?'step':'false')));
 $<HTMLButtonElement>('#prev').disabled=step===0;$<HTMLButtonElement>('#next').disabled=step===4;
 $<HTMLButtonElement>('#build').disabled=!editable||busy;$<HTMLInputElement>('#character-name').disabled=!editable;$<HTMLButtonElement>('#download').disabled=!modelUrl||dirty;$<HTMLButtonElement>('#undo').disabled=!history.length;
 const editor=$('#editor');editor.replaceChildren();const heading=document.createElement('h2');heading.textContent=['体型を選ぶ','頭・顔・髪','部品を順に選ぶ','部位ごとの色とマーク','保存して動きを確かめる'][step];editor.append(heading);
 if(step===0){const label=document.createElement('label');label.textContent='体型 ';const select=document.createElement('select');select.id='body';select.setAttribute('aria-label','体型');for(const profile of catalog.bodies)select.add(new Option(bodyLabels[profile]??profile,profile));select.value=draft.body?.profile??'cast.male.v1';select.onchange=()=>void setBody(select.value).catch(fail);label.append(select);editor.append(label);}
 else if(!editable){const p=document.createElement('p');p.textContent='元のモデルをそのまま表示しています。';editor.append(p);}
 else if(step===1||step===2){for(const slot of step===1?['head','face','hair']:['top','pants','outer','shoes','accessories','patterns'])renderSlot(editor,slot);}
 else if(step===3){for(const role of ['skin','hair','top','pants','outer','shoes','accessories']){const label=document.createElement('label');label.className='role-color';label.textContent=({skin:'肌',hair:'髪',top:'トップス',pants:'パンツ',outer:'上着',shoes:'靴',accessories:'小物'} as Record<string,string>)[role];const input=document.createElement('input');input.type='color';input.setAttribute('aria-label',label.textContent+'の色');input.value=roleColor(role);input.onchange=()=>changed({...draft,appearanceColors:{...draft.appearanceColors,[role]:input.value}});label.append(input);editor.append(label);}
 renderMarks(editor);}
 else {const p=document.createElement('p');p.textContent='名前を決めて「保存して作る」を押します。完成後、左の「動き」で歩き・しゃがみ・ダンス・仕事を確認できます。';editor.append(p);}
}
function renderSlot(parent:HTMLElement,slot:string){if((draft.specialOperations as {operation?:string}[]|undefined)?.some(op=>op.operation?.startsWith('dj.'))&&['hair','top','pants','accessories','patterns'].includes(slot)){const note=document.createElement('p');note.textContent=slotLabels[slot]+'：DJ専用の一体部品';parent.append(note);return;}const label=document.createElement('label');label.className='piece-select';label.textContent=slotLabels[slot];const select=document.createElement('select');select.setAttribute('aria-label',slotLabels[slot]);select.dataset.slot=slot;
 const defs=available(catalog,draft.body!.profile,slot);if(!['head','face','top','pants'].includes(slot))select.add(new Option('なし',''));
 for(const def of defs)select.add(new Option(partLabel(def.id),def.id));const current=draft.parts!.find(p=>catalog.parts.find(d=>d.id===p.part)?.slot===slot);select.value=current?.part??'';
 select.onchange=()=>changed(selectPiece(draft,catalog,slot,select.value));label.append(select);parent.append(label);
 if(current){const def=defs.find(d=>d.id===current.part);for(const [key,values] of Object.entries(def?.parameters??{})){const row=document.createElement('label');row.className='piece-select';row.textContent=key==='model'?'種類・襟・丈':key==='kind'?'形':'仕立て';const options=document.createElement('select');options.setAttribute('aria-label',slotLabels[slot]+'の'+key);for(const value of values)options.add(new Option(slot==='hair'&&key==='kind'&&draft.body!.profile.startsWith('pool.')?(draft.body!.profile==='pool.variant.strong.v1'?'専用ボブ':({swimsuit:'まとめ髪',resort:'ボブ',shorts:'クロップ'} as Record<string,string>)[String(value)]??String(value)):modelLabels[String(value)]??String(value),String(value)));options.value=String(current.parameters[key]);options.onchange=()=>{const value=values.find(v=>String(v)===options.value)!;changed(selectPiece(draft,catalog,slot,current.part,{...current.parameters,[key]:value}));};row.append(options);parent.append(row);}}
}
const modelLabels:Record<string,string>={Jacket:'フィールド・標準丈',JacketCollar:'フィールド・襟付き',JacketLong:'フィールド・長め',JacketLongCollar:'フィールド・襟付き長め',Bomber:'フライト・標準丈',BomberCollar:'フライト・襟付き',BomberLong:'フライト・長め',BomberLongCollar:'フライト・襟付き長め',Blazer:'ブレザー',TShirt:'半袖Tシャツ',Shirt:'襟付きシャツ',Jeans:'ジーンズ',WideJeans:'ワイドデニム',Trousers:'スラックス',Sunglasses:'サングラス',Cap:'キャップ',Tie:'ネクタイ',swept:'流し',parted:'七三',short:'短髪',bob:'ボブ',resort:'リゾート',swimsuit:'水着',shorts:'スイムショーツ'};
function updateMark(patch:Partial<Mark>,rerender=true){mark=parseOld({version:1,pieces:defaults,mark:{...mark,...patch}}).mark;draft.mark=structuredClone(mark);dirty=true;void previewMark().catch(fail);$('#match-status').textContent='編集中 · 変更は「保存して作る」で反映';if(rerender)refresh();}
function setMark(patch:Partial<Mark>){updateMark(patch);}
function renderMarks(parent:HTMLElement){const box=document.createElement('div');box.className='mark-box';box.innerHTML='<h3>服のマーク</h3><label>文字 <input id="mark-text" maxlength="12"></label><label>文字色 <input id="mark-color" type="color"></label><div class="row"><label class="file-button">PNGを選ぶ<input id="mark-image" type="file" accept="image/png"></label><button id="clear-mark">消す</button><button id="place-mark">服の表面に置く</button><button id="reset-mark-position">胸に戻す</button></div><label>大きさ <input id="mark-size" type="range" min="3" max="35" value="12"></label><label>回転 <input id="mark-angle" type="range" min="-180" max="180" value="0"></label><p>正面・横・背面から、服をクリックして配置できます。</p>';parent.append(box);
 $<HTMLInputElement>('#mark-text').value=mark.text;$<HTMLInputElement>('#mark-color').value=mark.color;
 $('#mark-text').oninput=()=>updateMark({text:$<HTMLInputElement>('#mark-text').value,png:undefined},false);$('#mark-color').oninput=()=>updateMark({color:$<HTMLInputElement>('#mark-color').value},false);
 $('#clear-mark').onclick=()=>setMark({...defaultMark,png:undefined,placement:undefined});$('#reset-mark-position').onclick=()=>setMark({placement:undefined});
 $('#place-mark').onclick=()=>{placing=true;controls.enabled=false;$<HTMLSelectElement>('#motion').value='loco-idle';resetTime();$('#job-status').textContent='服の表面をクリックしてください。';};
 const adjust=()=>setMark({placement:{...(mark.placement??defaultPlacement()),size:Number($<HTMLInputElement>('#mark-size').value)/100,angle:Number($<HTMLInputElement>('#mark-angle').value)}});
 $<HTMLInputElement>('#mark-size').value=String((mark.placement?.size??.12)*100);$<HTMLInputElement>('#mark-angle').value=String(mark.placement?.angle??0);$('#mark-size').onchange=adjust;$('#mark-angle').onchange=adjust;
 $<HTMLInputElement>('#mark-image').onchange=async()=>{const file=$<HTMLInputElement>('#mark-image').files?.[0];if(!file)return;try{if(file.type!=='image/png'||file.size>MAX_PNG_BYTES)throw new Error('256 KB以内のPNGを選んでください。');const bytes=new Uint8Array(await file.arrayBuffer());setMark({png:'data:image/png;base64,'+btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))});}catch(error){fail(error);}};
}
function defaultPlacement(){return {slot:'TShirt' as const,point:[.10,1.31,.12] as [number,number,number],normal:[0,0,1] as [number,number,number],size:.12,angle:0};}
async function markImage(){const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d')!;if(mark.png){const img=new Image();img.src=mark.png;await img.decode();const scale=230/Math.max(img.width,img.height);g.drawImage(img,(256-img.width*scale)/2,(256-img.height*scale)/2,img.width*scale,img.height*scale);}else {g.fillStyle=mark.color;g.font='700 104px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(mark.text,128,128,228);}return cv;}
async function previewMark(){const baked=actor?.model.getObjectByName('Mark_Surface') as T.SkinnedMesh|undefined;if(baked&&baked!==projected){baked.removeFromParent();baked.geometry.dispose();}projected?.removeFromParent();projected?.geometry.dispose();projected=null;if(!actor||(!mark.text&&!mark.png))return;const source=actor.model.getObjectByName(markMesh) as T.SkinnedMesh|undefined;if(!source?.isSkinnedMesh)return;const cv=await markImage();const texture=new T.CanvasTexture(cv);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;projected=projectMark(source,mark.placement??defaultPlacement(),new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false,side:T.DoubleSide}));}
const ray=new T.Raycaster();$('#view').onpointerdown=event=>{if(!placing||!actor)return;const box=$('#view').getBoundingClientRect();ray.setFromCamera(new T.Vector2((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2),camera);
 const meshes:T.SkinnedMesh[]=[];actor.model.traverse(o=>{const m=o as T.SkinnedMesh;if(m.isSkinnedMesh&&m.visible&&!['Face','Head','Hair','Hands','Mark_Surface'].includes(m.name)&&(m.name!=='Body'||draft.body?.profile.startsWith('pool.')))meshes.push(m);});const hit=ray.intersectObjects(meshes,false)[0];if(hit){const mesh=hit.object as T.SkinnedMesh;const placement=placementFromHit(mesh,hit,mesh.name==='Outer'?'Jacket':'TShirt',mark.placement?.size??.12,mark.placement?.angle??0,ray.ray.direction);if(placement){markMesh=mesh.name;setMark({placement});}}placing=false;controls.enabled=true;};
function fail(error:unknown){$('#job-status').textContent=(error as Error).message??String(error);}
async function openExisting(id:string){const recipe=recipes[id];if(!recipe)throw new Error('キャラが見つかりません。');sourceId=id;$<HTMLSelectElement>('#existing').value=id;$('#job-status').textContent='';$<HTMLInputElement>('#character-name').value=recipe.label??inventory.find(e=>e.id===id)?.label??id;draft=structuredClone(recipe);mark=structuredClone((recipe.mark as Mark|undefined)??defaultMark);markMesh=(recipe.surfaceMark as {mesh?:string}|undefined)?.mesh??'Outfit';dirty=false;history.length=0;modelUrl=apiBase+'/api/outfit/models/'+id;await showModel(modelUrl,id);$<HTMLButtonElement>('#download').disabled=false;refresh();}
async function saveAndBuild(name=$<HTMLInputElement>('#character-name').value){if(busy)throw new Error('作成中です。');if(draft.assetMode!=='generated')throw new Error('固定資産は保存できません。');busy=true;refresh();try{
 const recipe=structuredClone(draft);recipe.mark=structuredClone(mark);
 if(mark.text||mark.png){const placement=mark.placement??defaultPlacement();const legacy=recipe.parts?.find(p=>p.part==='legacy.top.v1');const target=mark.placement?markMesh:recipe.parts?.some(p=>p.part==='outer.layer.v1')?'Outer':legacy?String(legacy.parameters.model):markMesh;recipe.surfaceMark={...placement,mesh:target,png:(await markImage()).toDataURL('image/png')};}else delete recipe.surfaceMark;
 const job=await postBuild(apiBase,recipe,name);$('#job-status').textContent='保存済み · 作成を待っています…';let value:{state:string;error?:string;modelUrl?:string;sha256?:string;id:string};
 do {await new Promise(resolve=>setTimeout(resolve,400));const response=await fetch(apiBase+'/api/outfit/jobs/'+job.id);value=await response.json();if(!response.ok)throw new Error(value.error??'生成ジョブを確認できません。');$('#job-status').textContent=value.state==='running'?'Blenderで作成しています…':'作成待ち…';if(value.state==='error')throw new Error(value.error??'作成に失敗しました。');}while(value.state!=='complete');
 modelUrl=apiBase+value.modelUrl!;await showModel(modelUrl,job.id);draft={...recipe,id:job.id,label:name};sourceId=job.id;dirty=false;localStorage.setItem('clean-hands.outfit-lab.last',job.id);$('#job-status').textContent='作成完了 · '+name+'\nSHA-256 '+value.sha256;$('#model-name').textContent=name;$<HTMLButtonElement>('#download').disabled=false;return value;
 }finally{busy=false;refresh();}}
$('#build').onclick=()=>void saveAndBuild().catch(fail);$('#open').onclick=()=>void openExisting($<HTMLSelectElement>('#existing').value).catch(fail);$('#new').onclick=()=>void setBody('cast.male.v1').catch(fail);
app.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b,i)=>b.onclick=()=>{step=i;refresh();});$('#prev').onclick=()=>{step--;refresh();};$('#next').onclick=()=>{step++;refresh();};$('#undo').onclick=()=>{const previous=history.pop();if(previous){draft=previous;dirty=true;refresh();}};
function download(data:Blob,name:string){const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#save-recipe').onclick=()=>download(new Blob([JSON.stringify({...draft,mark},null,2)],{type:'application/json'}),'character-recipe.json');
$('#download').onclick=async()=>{try{const response=await fetch(modelUrl);download(await response.blob(),(draft.id??'character')+'.glb');}catch(error){fail(error);}};
function setRecipe(value:unknown){const raw=(value as {version?:number})?.version===1?migrateLegacy(value,catalog,recipes.waiter):value as CharacterRecipe;if(raw.schemaVersion!==1||!['generated','fixed','alias'].includes(raw.assetMode))throw new Error('レシピの形式が違います。');if(raw.assetMode==='generated'&&(!raw.body||!catalog.bodies.includes(raw.body.profile)||!Array.isArray(raw.parts)||!raw.output||raw.parts.some(p=>!catalog.parts.some(d=>d.id===p.part&&d.bodies.includes(raw.body!.profile)))))throw new Error('体型・部品の形式が違います。');draft=structuredClone(raw);mark=structuredClone((raw.mark as Mark|undefined)??defaultMark);markMesh=(raw.surfaceMark as {mesh?:string}|undefined)?.mesh??'Outfit';dirty=true;refresh();}
$<HTMLInputElement>('#load-recipe').onchange=async()=>{try{const file=$<HTMLInputElement>('#load-recipe').files?.[0];if(file)setRecipe(JSON.parse(await file.text()));}catch(error){fail(error);}};
const ready=(async()=>{try{const response=await fetch(apiBase+'/api/outfit/catalog');if(!response.ok)throw new Error('作成サーバーへ接続できません。');const data=await response.json();catalog=data.catalog;recipes={...data.recipes,...data.newRecipes};results=data.results;for(const entry of inventory)$<HTMLSelectElement>('#existing').add(new Option(entry.label+' · '+entry.id,entry.id));for(const [id,r] of Object.entries(data.newRecipes??{}) as [string,CharacterRecipe][])$<HTMLSelectElement>('#existing').add(new Option('作ったキャラ · '+(r.label??id),id));const last=localStorage.getItem('clean-hands.outfit-lab.last');await openExisting(last&&recipes[last]?last:'waiter');}catch(error){$('#preview-status').textContent='作成サーバー（8795 または確認用ポート）から開いてください。';fail(error);}})();
Object.assign(window,{__outfitLab:{ready,getRecipe:()=>structuredClone({...draft,mark}),setRecipe,loadRecipe:async(value:string|CharacterRecipe)=>{await ready;if(typeof value==='string')await openExisting(value);else setRecipe(value);},setBody,selectPart:(slot:string,id:string,params={})=>changed(selectPiece(draft,catalog,slot,id,params)),
 setPart:(slot:string,patch:{model?:string;part?:string;color?:string;collar?:boolean;long?:boolean})=>{const translated=({TShirt:'top',Jeans:'pants',Jacket:'outer',Sunglasses:'accessories'} as Record<string,string>)[slot]??slot;if(patch.part)changed(selectPiece(draft,catalog,translated,patch.part));else if(patch.model!==undefined||patch.collar!==undefined||patch.long!==undefined){let model=patch.model??String(draft.parts?.find(p=>p.part==='outer.layer.v1')?.parameters.model??'Jacket');if(translated==='outer'&&model&&(model.startsWith('Jacket')||model.startsWith('Bomber'))){const base=model.startsWith('Bomber')?'Bomber':'Jacket';model=base+((patch.long??model.includes('Long'))?'Long':'')+((patch.collar??model.includes('Collar'))?'Collar':'');}const id=({top:'legacy.top.v1',pants:'legacy.pants.v1',outer:'outer.layer.v1',accessories:'legacy.accessories.v1'} as Record<string,string>)[translated];changed(selectPiece(draft,catalog,translated,model?id:'',{model}));}if(patch.color)changed({...draft,appearanceColors:{...draft.appearanceColors,[translated]:patch.color}});},
 setMark,getInventory:()=>structuredClone(inventory),findInventory:(q:string)=>structuredClone(inventory.filter(e=>JSON.stringify(e).toLocaleLowerCase().includes(q.toLocaleLowerCase()))),listParts:()=>structuredClone(catalog.parts),saveAndBuild,exportGLB:async()=>{if(!modelUrl||dirty)throw new Error('先に保存して作ってください。');return (await fetch(modelUrl)).arrayBuffer();},
 setMotion:(id:string,at=0)=>{if(!CLIPS.some(c=>c.id===id))throw new Error('不明な動きです。');$<HTMLSelectElement>('#motion').value=id;time=at;paused=true;$('#pause').textContent='再生';if(actor)actor.sim=-1;},status:()=>({dirty,busy,sourceId,modelUrl,step})}});

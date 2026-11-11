/// <reference types="vite/client" />
import * as T from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Locomotion} from '../locomotion';
import {Rig} from '../rig';
import {NPC_MODELS} from '../npc-data';
import {CHARACTER_MODELS} from '../character-data';
import {PLAYER_BASE64} from '../player-data';
import {applyLook} from '../appearance';
import {DEFAULT_LOOK} from '../wardrobe';
import inventory from './outfit-inventory.json';
import modelUrl from './assets/agent07-outfit.glb?url&inline';
import './outfit-lab.css';

import {parts, defaults, defaultMark, fittedModel, jacketModels, parseRecipe, MAX_PNG_BYTES,
 type Part, type Choice, type Outfit, type Mark, type MarkPlacement, type Recipe} from './outfit-design';
import {placementFromHit,projectMark} from './outfit-decal';
const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML=`
 <section class="preview" aria-label="服装の3Dプレビュー">
  <canvas id="view" aria-label="AGENT 07の全身"></canvas>
  <div class="preview-tag"><b>AGENT 07 · 標準体型</b><span>ドラッグで回転 · スクロールで拡大</span></div>
  <div class="camera row" aria-label="プレビュー操作">
   <button data-view="0">正面</button><button data-view="90">横</button><button data-view="180">背面</button>
   <button id="walk" aria-pressed="false" disabled>歩行</button>
   <button id="back-to-design" hidden>編集に戻る</button>
  </div>
  <p id="preview-status" role="status">モデルを読み込んでいます…</p>
 </section>
 <aside class="panel" aria-label="服装の編集">
  <header><span class="eyebrow">CLEAN HANDS / 開発補助ラボ</span><h1>服装ラボ</h1>
   <p>部品を順に選び、配色を決めてモデルを書き出せます。</p><a class="catalog-link" href="#catalog-heading">既存衣装を調べる ↓</a></header>
  <nav class="steps" aria-label="服装作成の手順">
   ${parts.map(({label},i)=>`<button data-step="${i}"><small>0${i+1}</small> ${label}</button>`).join('')}
  </nav>
  <section class="group part-editor" aria-labelledby="part-heading">
   <h2 id="part-heading"></h2>
   <div id="options"></div>
   <div class="row navigation"><button id="prev">前の部位</button><button id="next" class="primary">次の部位</button></div>
  </section>
  <section class="group" aria-labelledby="colors-heading">
   <h2 id="colors-heading"><span>一括配色</span></h2>
   <div class="unify">
    <label>統一色 <input id="unify-color" type="color" value="#53634b" aria-label="統一する色"></label>
    <button id="unify">この色で統一</button>
    <button id="match-shirt">トップス色で統一</button>
   </div>
  </section>
  <section class="group" aria-labelledby="mark-heading">
   <h2 id="mark-heading"><span>服のマーク</span></h2>
   <div class="row"><label>文字 <input id="mark-text" maxlength="12" placeholder="例 07"></label>
    <label>文字色 <input id="mark-color" type="color"></label></div>
   <div class="row mark-actions"><label class="file-button">PNGを選ぶ<input id="mark-image" type="file" accept="image/png"></label>
    <button id="clear-mark">消す</button></div>
   <div class="row mark-actions">
    <label>配置先 <select id="mark-target"><option value="auto">自動</option><option value="TShirt">トップス</option><option value="Jacket">上着</option></select></label>
    <button id="place-mark" aria-pressed="false" disabled>服の表面に置く</button>
    <button id="reset-mark-position" disabled>胸に戻す</button>
   </div>
   <div class="mark-adjust">
    <label>大きさ <input id="mark-size" type="range" min="3" max="35" step="1" value="8"><output id="mark-size-readout">8 cm</output></label>
    <label>回転 <input id="mark-angle" type="range" min="-180" max="180" step="5" value="0"><output id="mark-angle-readout">0°</output></label>
   </div>
   <p id="mark-note" role="status">初期位置は胸です。背中や袖に置くには、モデルを回して服の表面を選びます。</p>
  </section>
  <section class="group finish" aria-labelledby="result-heading">
   <h2 id="result-heading"><span>いまの組み合わせ</span></h2>
   <ul id="summary"></ul>
   <div class="row"><button id="undo" disabled>元に戻す</button><button id="download" class="primary" disabled>GLBを書き出す</button></div>
   <div class="row recipe-actions"><button id="save-recipe">服装JSONを保存</button>
    <label class="file-button">服装JSONを読み込む<input id="load-recipe" type="file" accept=".json,application/json"></label></div>
   <p id="feedback" role="status">選んだ服と共通骨格・歩行を1つのGLBに保存します。</p>
  </section>
  <section class="group catalog" aria-labelledby="catalog-heading">
   <h2 id="catalog-heading"><span>既存キャラクターの衣装</span></h2>
   <p>ゲームで使うモデルと登場キャラクターを分類しました。</p>
   <div class="catalog-filters">
    <input id="catalog-search" type="search" placeholder="名前・役割・服で検索" aria-label="既存衣装を検索">
    <select id="catalog-filter" aria-label="衣装の分類"></select>
   </div>
   <label class="catalog-select">モデル <select id="catalog-model"></select></label>
   <div id="catalog-detail" aria-live="polite"></div>
   <div class="row"><button id="show-reference" disabled>元モデルを見る</button><button id="load-template" disabled>近い構成を試す</button></div>
   <p id="catalog-status" role="status"></p><button id="save-inventory">衣装台帳JSONを保存</button>
  </section>
 </aside>`;

const $=<E extends HTMLElement>(selector:string)=>app.querySelector<E>(selector)!;
const buttons=Array.from(app.querySelectorAll<HTMLButtonElement>('[data-step]'));
const canvas=$<HTMLCanvasElement>('#view'),status=$('#preview-status'),feedback=$('#feedback');
const previous=$<HTMLButtonElement>('#prev'),next=$<HTMLButtonElement>('#next');
const undo=$<HTMLButtonElement>('#undo'),download=$<HTMLButtonElement>('#download');
let outfit=defaults,mark=defaultMark,step=0;
const history:{pieces:Outfit;mark:Mark}[]=[];
const markText=$<HTMLInputElement>('#mark-text'),markColor=$<HTMLInputElement>('#mark-color');
const markNote=$('#mark-note'),markInput=$<HTMLInputElement>('#mark-image');
const markTarget=$<HTMLSelectElement>('#mark-target'),placeMark=$<HTMLButtonElement>('#place-mark');
const markSize=$<HTMLInputElement>('#mark-size'),markAngle=$<HTMLInputElement>('#mark-angle');
const resetMarkPosition=$<HTMLButtonElement>('#reset-mark-position');
let placing=false;
function setPlacing(value:boolean){
 placing=value;
 placeMark.setAttribute('aria-pressed',String(value));
 canvas.classList.toggle('placing-mark',value);
 placeMark.textContent=value?'配置をやめる':'服の表面に置く';
}

let applyOutfit:((current:Outfit)=>void)|undefined;

function refresh(){
 const part=parts[step],choice=outfit[part.id];
 buttons.forEach((button,i)=>button.setAttribute('aria-current',i===step?'step':'false'));
 previous.disabled=step===0;
 next.disabled=step===parts.length-1;
 next.textContent=next.disabled?'部位の選択完了':'次の部位';
 undo.disabled=history.length===0;
 markText.value=mark.text;
 markColor.value=mark.color;
 resetMarkPosition.disabled=!mark.placement;
 if(mark.placement){markSize.value=String(Math.round(mark.placement.size*100));markAngle.value=String(mark.placement.angle);}
 $('#mark-size-readout').textContent=markSize.value+' cm';
 $('#mark-angle-readout').textContent=markAngle.value+'°';
 markNote.textContent=mark.placement?'指定した位置に配置。服をクリックすると移動できます。':'初期位置は胸です。背中や袖に置くには、モデルを回して服の表面を選びます。';
 $<HTMLButtonElement>('#clear-mark').disabled=!mark.text&&!mark.png;
 $('#part-heading').textContent=`${step+1} / ${parts.length}　${part.label}`;
 const options=$('#options');
 options.innerHTML=`
  <div class="row part-choice">
   ${part.variants.map(([model,name])=>`<button data-model="${model}" aria-pressed="${model===choice.model}">${name}</button>`).join('')}
  </div>
  ${jacketModels[choice.model]?`<div class="field-options">
   <fieldset><legend>襟</legend><div class="row">
    <button data-field-option="collar" data-enabled="false" aria-pressed="${!choice.collar}">襟なし</button>
    <button data-field-option="collar" data-enabled="true" aria-pressed="${!!choice.collar}">襟付き</button>
   </div></fieldset>
   <fieldset><legend>丈</legend><div class="row">
    <button data-field-option="long" data-enabled="false" aria-pressed="${!choice.long}">標準丈</button>
    <button data-field-option="long" data-enabled="true" aria-pressed="${!!choice.long}">長め</button>
   </div></fieldset>
  </div>`:''}
  <fieldset ${choice.model?'':'disabled'}>
   <legend>${part.label}の色</legend>
   <div class="colors">${part.colors.map(color=>`<button class="swatch" style="--swatch:${color}" data-color="${color}" aria-label="${part.label} ${color.toUpperCase()}" aria-pressed="${choice.color===color}" title="${color.toUpperCase()}"></button>`).join('')}
    <input id="part-color" type="color" value="${choice.color}" aria-label="${part.label}の色を自由に選ぶ">
   </div>
   <output class="hex">${choice.model?choice.color.toUpperCase():'着用すると色を変更できます'}</output>
  </fieldset>`;
 const setPart=(value:Choice)=>change({...outfit,[part.id]:value});
 options.querySelectorAll<HTMLButtonElement>('[data-model]').forEach(b=>b.onclick=()=>setPart({...choice,model:b.dataset.model!}));
 options.querySelectorAll<HTMLButtonElement>('[data-field-option]').forEach(b=>b.onclick=()=>{
  const key=b.dataset.fieldOption as 'collar'|'long';
  setPart({...choice,[key]:b.dataset.enabled==='true'});
 });
 const setColor=(color:string)=>setPart({...choice,color});
 $<HTMLInputElement>('#part-color').onchange=event=>setColor((event.currentTarget as HTMLInputElement).value);
 options.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(b=>b.onclick=()=>setColor(b.dataset.color!));
 $('#summary').innerHTML=parts.map(({id,label,variants})=>{
  const choice=outfit[id],name=variants.find(([model])=>model===choice.model)?.[1];
  const variant=jacketModels[choice.model]?` · ${choice.collar?'襟付き':'襟なし'} · ${choice.long?'長め':'標準丈'}`:'';
  return `<li><span>${label}</span><b>${name}${variant}</b>${choice.model?`<i style="--swatch:${choice.color}" title="${choice.color}"></i>`:''}</li>`;
 }).join('');
}
function change(value:Outfit,nextMark=mark){
 hideReference?.();
 history.push({pieces:outfit,mark});
 outfit=value;
 mark=nextMark;
 refresh();
 applyOutfit?.(outfit);
}
function select(i:number){
 step=i;
 refresh();
}
function unify(color:string){
 change(Object.fromEntries(parts.map(({id})=>[id,{...outfit[id],color}])) as Outfit);
}
buttons.forEach((button,i)=>button.onclick=()=>select(i));
previous.onclick=()=>select(step-1);
next.onclick=()=>select(step+1);
$<HTMLButtonElement>('#unify').onclick=()=>unify($<HTMLInputElement>('#unify-color').value);
$<HTMLButtonElement>('#match-shirt').onclick=()=>unify(outfit.TShirt.color);
undo.onclick=()=>{
 const saved=history.pop();
 if(!saved)return;
 hideReference?.();
 outfit=saved.pieces;
 mark=saved.mark;
 refresh();
 applyOutfit?.(outfit);
};

function downloadFile(data:Blob,name:string){
 const url=URL.createObjectURL(data);
 const link=document.createElement('a');
 link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadJson(value:unknown,name:string){
 downloadFile(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}),name);
}
const getRecipe=():Recipe=>structuredClone({version:1,pieces:outfit,mark});
function setRecipe(value:unknown){
 const next=parseRecipe(value);
 change(next.pieces,next.mark);
}
markText.onchange=()=>change(outfit,{...mark,text:markText.value,png:undefined});
markColor.onchange=()=>change(outfit,{...mark,color:markColor.value});
$<HTMLButtonElement>('#clear-mark').onclick=()=>change(outfit,defaultMark);
resetMarkPosition.onclick=()=>{
 markSize.value='8';markAngle.value='0';
 change(outfit,{...mark,placement:undefined});
};
for(const input of [markSize,markAngle]){
 input.oninput=()=>{
  $('#mark-size-readout').textContent=markSize.value+' cm';
  $('#mark-angle-readout').textContent=markAngle.value+'°';
 };
 input.onchange=()=>{
  if(mark.placement)change(outfit,{...mark,placement:{...mark.placement,size:Number(markSize.value)/100,angle:Number(markAngle.value)}});
 };
}
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&placing)setPlacing(false);});
markInput.onchange=async()=>{
 const file=markInput.files?.[0];
 markInput.value='';
 if(!file)return;
 try{
  if(file.type!=='image/png'||file.size>MAX_PNG_BYTES)throw new Error('256 KB以内のPNGを選んでください。');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const png='data:image/png;base64,'+btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
  setRecipe({...getRecipe(),mark:{...mark,png}});
 }catch(error){markNote.textContent=(error as Error).message;}
};
$<HTMLButtonElement>('#save-recipe').onclick=()=>downloadJson(getRecipe(),'outfit-recipe.json');
$<HTMLButtonElement>('#save-inventory').onclick=()=>downloadJson(inventory,'outfit-inventory.json');
const recipeInput=$<HTMLInputElement>('#load-recipe');
recipeInput.onchange=async()=>{
 const file=recipeInput.files?.[0];
 recipeInput.value='';
 if(!file)return;
 try{setRecipe(JSON.parse(await file.text()));feedback.textContent='服装JSONを読み込みました。';}
 catch(error){feedback.textContent=(error as Error).message;}
};
let exportGLB:(()=>Promise<ArrayBuffer>)|undefined;
Object.assign(window,{__outfitLab:{
 getRecipe,setRecipe,
 setPart:(slot:Part['id'],patch:Partial<Choice>)=>{
  if(!parts.some(part=>part.id===slot))throw new Error('不明な服の部位です。');
  setRecipe({...getRecipe(),pieces:{...outfit,[slot]:{...outfit[slot],...patch}}});
 },
 setMark:(patch:Partial<Mark>)=>setRecipe({...getRecipe(),mark:{...mark,...patch}}),
 getInventory:()=>structuredClone(inventory),
 findInventory:(query:string)=>structuredClone(inventory.filter(entry=>matchesCatalog(entry,query.trim().toLocaleLowerCase()))),
 listParts:()=>structuredClone(parts),
 exportGLB:()=>exportGLB?.()??Promise.reject(new Error('3Dモデルを読み込み中です。')),
}});

type CatalogEntry=(typeof inventory)[number];
const catalogSearch=$<HTMLInputElement>('#catalog-search'),catalogFilter=$<HTMLSelectElement>('#catalog-filter');
const catalogModel=$<HTMLSelectElement>('#catalog-model'),catalogDetail=$('#catalog-detail'),catalogStatus=$('#catalog-status');
const templateButton=$<HTMLButtonElement>('#load-template'),referenceButton=$<HTMLButtonElement>('#show-reference');
catalogFilter.add(new Option('すべての分類',''));
for(const group of new Set(inventory.map(entry=>entry.group)))catalogFilter.add(new Option(group,group));
const selected=()=>inventory.find(entry=>entry.id===catalogModel.value);
function showEntry(entry:CatalogEntry|undefined){
 catalogDetail.replaceChildren();
 templateButton.disabled=!entry?.template;
 referenceButton.disabled=!entry||!showReference;
 if(!entry)return;
 const fields=document.createElement('dl');
 for(const [label,value] of [['トップス',entry.top],['上着',entry.jacket],['ボトムス',entry.bottom],['靴',entry.shoes],['装飾',entry.extras]]){
  const term=document.createElement('dt'),description=document.createElement('dd');
  term.textContent=label;description.textContent=value;fields.append(term,description);
 }
 catalogDetail.append(fields);
 if(entry.cast?.length){
  const detail=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('p');
  summary.textContent=`登場キャラクター ${entry.cast.length}件`;
  list.textContent=entry.cast.map(({map,label,id})=>`${map} · ${label} [${id}]`).join(' / ');
  detail.append(summary,list);catalogDetail.append(detail);
 }
}
function matchesCatalog(entry:CatalogEntry,term:string){
 return [entry.id,entry.label,entry.group,entry.top,entry.jacket,entry.bottom,entry.shoes,entry.extras,
  ...(entry.cast??[]).flatMap(({map,id,label})=>[map,id,label])].some(s=>s.toLocaleLowerCase().includes(term));
}
function searchCatalog(){
 const term=catalogSearch.value.trim().toLocaleLowerCase(),group=catalogFilter.value;
 const matches=inventory.filter(entry=>(!group||entry.group===group)&&matchesCatalog(entry,term));
 catalogModel.replaceChildren(...matches.map(entry=>new Option(`${entry.label} · ${entry.id}`,entry.id)));
 catalogModel.disabled=matches.length===0;
 showEntry(selected());
 catalogStatus.textContent=`${matches.length} / ${inventory.length} 衣装モデル`;
}
let showReference:((id:string)=>Promise<void>)|undefined;
let hideReference:(()=>void)|undefined;
catalogSearch.oninput=searchCatalog;
catalogFilter.onchange=searchCatalog;
catalogModel.onchange=()=>showEntry(selected());
referenceButton.onclick=async()=>{
 const entry=selected();
 if(!entry||!showReference)return;
 try{await showReference(entry.id);catalogStatus.textContent=`元モデルを表示 · ${entry.label}`;}
 catch(error){console.error(error);catalogStatus.textContent='元モデルを読み込めませんでした。';}
};
templateButton.onclick=()=>{
 const entry=selected();
 if(!entry?.template)return;
 const suit=entry.template==='suit',bomber=entry.template==='bomber';
 const jacket=suit?'Blazer':bomber?'Bomber':'Jacket';
 const color=entry.id==='wine_merchant'?'#6b2a2a':entry.id==='dj_experiment'?'#17776c':suit?'#2b2e35':defaults.Jacket.color;
 change({
  TShirt:{model:suit?'Shirt':'TShirt',color:bomber?'#2b2e35':defaults.TShirt.color},
  Jeans:{model:suit||bomber?'Trousers':'Jeans',color:suit||bomber?'#2b2e35':defaults.Jeans.color},
  Jacket:{model:jacket,color},
  Sunglasses:{model:suit?'Tie':entry.id==='investor'?'Sunglasses':'',color:suit?'#2b2e35':defaults.Sunglasses.color},
 });
 catalogStatus.textContent=`${entry.label}に近い試作用の構成を読み込みました。`;
};

function paletteFor(mesh:T.SkinnedMesh,part:Part){
 const material=(mesh.material as T.MeshStandardMaterial).clone();
 const source=material.map!;
 const image=source.image as ImageBitmap;
 const surface=document.createElement('canvas');
 surface.width=image.width;surface.height=image.height;
 const ctx=surface.getContext('2d')!;
 ctx.drawImage(image,0,0);
 const texture=new T.CanvasTexture(surface);
 texture.colorSpace=source.colorSpace;
 texture.flipY=source.flipY;
 texture.magFilter=source.magFilter;
 texture.minFilter=source.minFilter;
 material.map=texture;mesh.material=material;
 let last=part.base as string;
 return (color:string)=>{
  if(color===last)return;
  last=color;
  ctx.drawImage(image,0,0);
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  if(color!==part.base)for(const [cell,tone] of part.cells){
   ctx.fillStyle=`rgb(${rgb.map(v=>Math.round(tone>=0?v+(255-v)*tone:v*(1+tone))).join(',')})`;
   ctx.fillRect((cell%4)*surface.width/4,Math.floor(cell/4)*surface.height/4,surface.width/4,surface.height/4);
  }
  texture.needsUpdate=true;
 };
}

async function startPreview(){
 const renderer=new T.WebGLRenderer({canvas,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;
 const scene=new T.Scene();
 scene.background=new T.Color('#283139');
 scene.add(new T.HemisphereLight('#f5f5f0','#646a72',2.1));
 const key=new T.DirectionalLight('#fff8f0',2.1);
 key.position.set(-2.4,4,3);scene.add(key);
 const rim=new T.DirectionalLight('#c3deff',1.25);
 rim.position.set(3,2,-4);scene.add(rim);
 const platform=new T.Mesh(new T.CylinderGeometry(.8,.86,.09,64),new T.MeshStandardMaterial({color:'#3a4750',roughness:.9}));
 platform.position.y=-.045;scene.add(platform);
 const grid=new T.GridHelper(24,48,'#536570','#394750');
 grid.position.y=-.1;scene.add(grid);
 const camera=new T.PerspectiveCamera(34,1,.03,100);
 const controls=new OrbitControls(camera,canvas);
 controls.target.set(0,.92,0);controls.minDistance=1.6;controls.maxDistance=7;
 controls.enablePan=false;controls.maxPolarAngle=Math.PI*.51;
 const render=()=>renderer.render(scene,camera);
 const aim=(angle:number)=>{
  const radius=Math.max(3.8,3.4/Math.max(.5,camera.aspect));
  camera.position.set(Math.sin(angle)*radius,1.17,Math.cos(angle)*radius);
  controls.update();render();
 };
 controls.addEventListener('change',render);
 app.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>aim(T.MathUtils.degToRad(Number(b.dataset.view))));
 const resize=()=>{
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w||!h)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();
 };
 new ResizeObserver(resize).observe(canvas);
 resize();aim(.25);

 const {scene:model,animations}=await new GLTFLoader().loadAsync(modelUrl);
 scene.add(model);
 const rig=new Rig(model);
 const stand=new Locomotion().update(0,{speed:0,crouch:0,slope:0,turn:0,distance:0});
 const fittings=parts.flatMap(part=>{
  const ids=part.variants.map(([id]):string=>id);
  if(part.id==='Jacket')ids.push(...Object.values(jacketModels).flatMap(models=>models.slice(1)));
  return ids.flatMap(id=>{
   if(!id)return [];
   const mesh=model.getObjectByName(id) as T.SkinnedMesh|undefined;
   if(!mesh?.isSkinnedMesh)throw new Error(`Missing wardrobe part: ${id}`);
   mesh.frustumCulled=false;
   return [{id,part,mesh,recolor:paletteFor(mesh,part)}];
  });
 });
 const markSurfaces=fittings.flatMap(({id})=>{
  const mesh=model.getObjectByName('Mark_'+id) as T.SkinnedMesh|undefined;
  return mesh?[{id,mesh}]:[];
 });
 const markCanvas=document.createElement('canvas');
 markCanvas.width=markCanvas.height=256;
 const markCtx=markCanvas.getContext('2d')!;
 const markTexture=new T.CanvasTexture(markCanvas);
 markTexture.colorSpace=T.SRGBColorSpace;markTexture.flipY=false;
 const markMaterial=new T.MeshStandardMaterial({map:markTexture,transparent:true,alphaTest:.025,depthWrite:false,
  side:T.DoubleSide,roughness:1});
 for(const {mesh} of markSurfaces){
  mesh.material=markMaterial;
  mesh.frustumCulled=false;
  mesh.renderOrder=1;
 }
 let projected:T.SkinnedMesh|null=null;
 let projectionKey='';
 function updateMarkSurface(current:Outfit){
  const placement=mark.placement,active=!!(mark.text||mark.png);
  const markPart=fittedModel(current.Jacket)||current.TShirt.model;
  for(const {id,mesh} of markSurfaces)mesh.visible=!placement&&id===markPart&&active;
  const modelId=placement&&fittedModel(current[placement.slot]);
  const key=placement&&modelId&&active?JSON.stringify([modelId,placement]):'';
  if(key===projectionKey)return;
  projectionKey=key;
  projected?.removeFromParent();projected?.geometry.dispose();projected=null;
  if(!key||!placement)return;
  const source=fittings.find(fitting=>fitting.id===modelId)?.mesh;
  if(source)projected=projectMark(source,placement,markMaterial);
  if(!projected)markNote.textContent='今の服では指定位置に置けません。表面を選び直してください。';
 }
 let markReady=Promise.resolve(),drawnMark:Mark|undefined,markRevision=0;
 async function drawMark(value:Mark,revision:number){
  markCtx.clearRect(0,0,256,256);
  markTexture.needsUpdate=true;
  if(value.png){
   const image=new Image();
   image.src=value.png;
   await image.decode();
   if(revision!==markRevision)return;
   const scale=230/Math.max(image.width,image.height);
   const w=image.width*scale,h=image.height*scale;
   markCtx.drawImage(image,(256-w)/2,(256-h)/2,w,h);
  }else if(value.text){
   markCtx.font='700 104px system-ui, sans-serif';
   markCtx.fillStyle=value.color;
   markCtx.textAlign='center';
   markCtx.textBaseline='middle';
   markCtx.fillText(value.text,128,128,228);
  }
  markTexture.needsUpdate=true;
  render();
 }
 const updateOutfit=(current:Outfit)=>{
  for(const {id,part,mesh,recolor} of fittings){
   const choice=current[part.id];
   mesh.visible=fittedModel(choice)===id;
   recolor(choice.color);
  }
  updateMarkSurface(current);
  if(!drawnMark||mark.text!==drawnMark.text||mark.color!==drawnMark.color||mark.png!==drawnMark.png){
   drawnMark=mark;
   const revision=++markRevision;
   markReady=drawMark(mark,revision);
   void markReady.catch(()=>{if(revision===markRevision)markNote.textContent='PNG画像を開けませんでした。';});
  }
  render();
 };
 applyOutfit=updateOutfit;
 const mixer=new T.AnimationMixer(model),walkClip=animations.find(clip=>clip.name==='walk1');
 const walk=walkClip&&mixer.clipAction(walkClip);
 const walkButton=$<HTMLButtonElement>('#walk');
 let walking=false,exporting=false;
 let frameId=0,last=0;
 const tick=(now:number)=>{
  mixer.update(Math.min(.05,(now-last)/1000));last=now;render();
  frameId=requestAnimationFrame(tick);
 };
 function showMotion(value:boolean){
  walking=value;
  walkButton.setAttribute('aria-pressed',String(value));
  if(value){walk?.reset().play();last=performance.now();frameId=requestAnimationFrame(tick);}
  else{cancelAnimationFrame(frameId);walk?.stop();rig.apply(stand);render();}
 }
 let reference:T.Object3D|undefined,request=0;
 hideReference=()=>{
  request++;
  if(!reference)return;
  reference.removeFromParent();
  const textures=new Set<T.Texture>(),materials=new Set<T.Material>();
  reference.traverse(o=>{
   const mesh=o as T.Mesh;
   if(!mesh.isMesh)return;
   mesh.geometry.dispose();
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    materials.add(material);
    const map=(material as T.MeshStandardMaterial).map;
    if(map)textures.add(map);
   }
  });
  for(const texture of textures)texture.dispose();
  for(const material of materials)material.dispose();
  reference=undefined;
  model.visible=true;
  walkButton.disabled=!walk||exporting;
  download.disabled=exporting;
  $('#back-to-design').setAttribute('hidden','');
  render();
 };
 showReference=async(id)=>{
  if(exporting)return;
  const stamp=++request;
  const wardrobe=id==='wardrobe'||id==='guest_male';
  const b64=wardrobe?PLAYER_BASE64:NPC_MODELS[id]??(CHARACTER_MODELS as Record<string,string>)[id];
  if(!b64)throw new Error(`Unknown reference model: ${id}`);
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const {scene:original}=await new GLTFLoader().parseAsync(bytes.buffer,'');
  if(stamp!==request)return;
  hideReference?.();
  showMotion(false);
  setPlacing(false);
  if(wardrobe)applyLook(original,DEFAULT_LOOK);
  new Rig(original).apply(stand);
  reference=original;
  scene.add(reference);model.visible=false;
  walkButton.disabled=download.disabled=true;
  $('#back-to-design').removeAttribute('hidden');
  render();
 };
 $<HTMLButtonElement>('#back-to-design').onclick=()=>{hideReference?.();catalogStatus.textContent='編集中の服装に戻りました。';};
 const ray=new T.Raycaster();
 const pointer=new T.Vector2();
 let pressedAt:T.Vector2|undefined;
 placeMark.disabled=false;
 placeMark.onclick=()=>{
  hideReference?.();
  setPlacing(!placing);
  if(placing)markNote.textContent='服の表面をクリックしてください。ドラッグで回転できます。';
 };
 canvas.addEventListener('pointerdown',event=>{pressedAt=new T.Vector2(event.clientX,event.clientY);});
 canvas.addEventListener('pointerup',event=>{
  if(!placing||!pressedAt||pressedAt.distanceTo(new T.Vector2(event.clientX,event.clientY))>5||exporting||reference)return;
  const slot=(markTarget.value==='auto'?(outfit.Jacket.model?'Jacket':'TShirt'):markTarget.value) as MarkPlacement['slot'];
  const target=fittings.find(fitting=>fitting.id===fittedModel(outfit[slot]))?.mesh;
  if(!target){markNote.textContent='配置する上着を選んでください。';return;}
  const bounds=canvas.getBoundingClientRect();
  pointer.set((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2);
  ray.setFromCamera(pointer,camera);
  // Raycast bounds depend on the current skeletal pose.
  target.computeBoundingSphere();
  target.computeBoundingBox();
  const hit=ray.intersectObject(target,false)[0];
  const placement=hit&&placementFromHit(target,hit,slot,Number(markSize.value)/100,Number(markAngle.value),ray.ray.direction);
  if(!placement){markNote.textContent='選んだ服の布地をクリックしてください。';return;}
  change(outfit,{...mark,placement});
  setPlacing(false);
 });
 showEntry(selected());
 walkButton.disabled=!walk;
 walkButton.onclick=()=>showMotion(!walking);
 rig.apply(stand);
 applyOutfit(outfit);
 status.hidden=true;
 download.disabled=false;
 exportGLB=async()=>{
  if(exporting||reference)throw new Error('服装の編集画面から書き出してください。');
  exporting=true;download.disabled=true;walkButton.disabled=true;
  const resume=walking;
  showMotion(false);
  // Export the shared bind pose so the first frame and walking tracks use the original rig.
  model.traverse(o=>{const mesh=o as T.SkinnedMesh;if(mesh.isSkinnedMesh)mesh.skeleton.pose();});
  const snapshot=outfit,savedMark=mark;
  applyOutfit=undefined;
  try{
   await markReady;
   const buffer=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true,animations});
   if(!(buffer instanceof ArrayBuffer))throw new Error('GLB export returned JSON');
   return buffer;
  }finally{
   applyOutfit=updateOutfit;
   if(outfit!==snapshot||mark!==savedMark)applyOutfit(outfit);
   showMotion(resume);
   exporting=false;download.disabled=false;walkButton.disabled=!walk;
  }
 };
 download.onclick=async()=>{
  try{
   const buffer=await exportGLB!();
   downloadFile(new Blob([buffer],{type:'model/gltf-binary'}),'agent07-outfit.glb');
   feedback.textContent='agent07-outfit.glb を書き出しました。';
  }catch(error){
   console.error(error);feedback.textContent='GLBを書き出せませんでした。マークの画像と設定を確認してください。';
  }
 };

}
refresh();
searchCatalog();
void startPreview().catch(error=>{
 console.error(error);
 status.textContent='3Dモデルを読み込めませんでした。ページを再読み込みしてください。';
});

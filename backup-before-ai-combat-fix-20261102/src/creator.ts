import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Locomotion } from './locomotion';
import { Rig } from './rig';
import { applyLook } from './appearance';
import { CHARACTERS, DEFAULT_GAIT, DEFAULT_LOOK, GAITS, HAIRS, OUTFITS, SWATCHES, bodyScales, decodeLook, encodeLook, gaitStyleOf, heightScale, loadSlots, randomLook, sanitizeLook, saveSlots, type Look, type Slot } from './wardrobe';
import { AMBER, DIM, JP, LATIN, PAPER, RED } from './hud';
type Focus='body'|'face'|'chest';type Tab='character'|'face'|'body'|'outfit'|'gait'|'save';type Motion='idle'|'walk'|'run'|'crouch'|'hide';
const FOCUS:Record<Focus,{y:number;dist:number;fov:number}>={body:{y:.92,dist:4.6,fov:32},face:{y:1.64,dist:1.25,fov:30},chest:{y:1.4,dist:1.55,fov:30}};
const TABS:{id:Tab;label:string;focus:Focus}[]=[{id:'character',label:'キャラ',focus:'body'},{id:'face',label:'顔・髪',focus:'face'},{id:'body',label:'体型',focus:'body'},{id:'outfit',label:'服装',focus:'body'},{id:'gait',label:'歩き方',focus:'body'},{id:'save',label:'保存・共有',focus:'body'}];
const MOTIONS:{id:Motion;label:string;speed:number;crouch:number}[]=[{id:'idle',label:'待機',speed:0,crouch:0},{id:'walk',label:'歩く',speed:1.65,crouch:0},{id:'run',label:'走る',speed:4.8,crouch:0},{id:'crouch',label:'しゃがみ歩き',speed:1.2,crouch:1},{id:'hide',label:'しゃがみ待機',speed:0,crouch:1}];
type ColorKey='hairColor'|'skin'|'suitColor'|'shirtColor'|'tieColor'|'frameColor'|'gloveColor';
type SliderKey='height'|'shoulders'|'build'|'head';type GaitKey='stride'|'arm'|'lean'|'sway'|'bounce';
// The opening character creator: a live turntable of the wardrobe model (idle / walking / running / sneaking, so the
// chosen gait can be judged), tabs for face & hair, body proportions, outfit & colours, gait and saved looks, option
// cards with thumbnails rendered from the same model, free colour pickers, sliders, six save slots and share codes.
export function openCreator(template:T.Object3D,initial:Look,onDone:(look:Look)=>void,templates?:Map<string,T.Object3D>){
 const look:Look=sanitizeLook(initial),root=document.createElement('div');root.id='creator';
 root.innerHTML=`<canvas class="cc-bg"></canvas><canvas class="cc-view" aria-label="キャラクターのプレビュー。ドラッグで回転"></canvas>
<header class="cc-head"><small>CLEAN HANDS · AGENT PROFILE</small><h1>潜入する姿を、決める。</h1><p>グランド・マリーナ・ホテル / プール区画。顔と服は記憶に残る。</p></header>
<div class="cc-tag"><small>CODENAME</small><b id="cc-tag-name"></b><span id="cc-tag-sub"></span></div>
<div class="cc-motion" role="group" aria-label="プレビューの動作"></div>
<aside class="cc-panel">
 <div class="cc-name"><label for="cc-name">コードネーム</label><input id="cc-name" maxlength="16" spellcheck="false" autocomplete="off"></div>
 <nav class="cc-tabs" role="tablist" aria-label="カスタマイズ項目"></nav><div class="cc-pages"></div>
</aside>
<footer class="cc-foot"><button id="cc-reset">初期化</button><button id="cc-random">ランダム</button><button id="cc-go">この姿で潜入する<kbd>Enter</kbd></button></footer>
<div class="cc-drag">ドラッグで回転 · 項目にカーソルを合わせると寄る</div>`;
 document.body.append(root);const q=<E extends HTMLElement>(s:string)=>root.querySelector<E>(s)!;
 // --- 3D preview
 const view=q<HTMLCanvasElement>('.cc-view'),renderer=new T.WebGLRenderer({canvas:view,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.05,30);scene.add(new T.HemisphereLight('#fff2e0','#3a3f44',1.6));
 const key=new T.DirectionalLight('#ffe9cf',3.2);key.position.set(-2.2,3.4,2.6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.near=.5;key.shadow.camera.far=10;key.shadow.normalBias=.03;scene.add(key);
 const rim=new T.DirectionalLight('#9fd7ff',2.2);rim.position.set(2.4,2.6,-3);scene.add(rim);const fill=new T.DirectionalLight('#ff9a80',.7);fill.position.set(3,1,2);scene.add(fill);
 const floor=new T.Mesh(new T.CircleGeometry(1.1,48),new T.ShadowMaterial({opacity:.45}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 const ring=new T.Mesh(new T.RingGeometry(.98,1.0,96),new T.MeshBasicMaterial({color:'#e2362b',transparent:true,opacity:.7}));ring.rotation.x=-Math.PI/2;ring.position.y=.002;scene.add(ring);
 let shownCharacter=look.character;let body=clone(templates?.get(shownCharacter)??template);const turn=new T.Group();turn.add(body);scene.add(turn);body.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=true;o.frustumCulled=false;}});
 let rig=new Rig(body);const loco=new Locomotion();
 function ensureCharacter(id:string){if(id===shownCharacter)return;turn.remove(body);body=clone(templates?.get(id)??template);turn.add(body);rig=new Rig(body);shownCharacter=id;body.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=true;o.frustumCulled=false;}});}
 // --- thumbnails come from a second, fixed-size renderer pointed at the same scene
 const thumbs=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});thumbs.setPixelRatio(1);thumbs.setSize(160,160,false);thumbs.outputColorSpace=T.SRGBColorSpace;thumbs.toneMapping=T.ACESFilmicToneMapping;thumbs.toneMappingExposure=1.15;
 const thumbCam=new T.PerspectiveCamera(26,1,.05,30);let motion:Motion='idle',crouchBlend=0,gaitSpeed=0;
 // Thumbnails are taken from a calm standing pose, whatever the live preview is doing.
 function snap(target:HTMLCanvasElement,variant:Look,focus:Focus,angle=.45){ensureCharacter(variant.character);applyLook(body,variant);const hs=heightScale(variant),f=FOCUS[focus],y=(focus==='body'?.95:f.y)*hs,d=(focus==='body'?3.9:focus==='chest'?1.2:.95)*(focus==='body'?1:hs);
  const saved=turn.rotation.y,ringOn=ring.visible,sh=floor.visible;turn.rotation.y=angle;ring.visible=false;floor.visible=false;thumbCam.position.set(Math.sin(.15)*d,y+.04,Math.cos(.15)*d);thumbCam.lookAt(0,y,0);
  const pose=loco.update(0,{speed:0,crouch:0,slope:0,turn:0,distance:0});rig.apply(pose);thumbs.render(scene,thumbCam);
  const c=target.getContext('2d')!;c.clearRect(0,0,target.width,target.height);c.drawImage(thumbs.domElement,0,0,target.width,target.height);turn.rotation.y=saved;ring.visible=ringOn;floor.visible=sh;}
 // --- UI building blocks
 const tabs=q('.cc-tabs'),pages=q('.cc-pages');let tab:Tab='character';const pageEls=new Map<Tab,HTMLElement>(),syncers:(()=>void)[]=[];
 for(const t of TABS){const b=document.createElement('button');b.role='tab';b.id='cc-tab-'+t.id;b.textContent=t.label;b.dataset.tab=t.id;b.onclick=()=>setTab(t.id);tabs.append(b);const p=document.createElement('div');p.className='cc-page';p.dataset.page=t.id;p.role='tabpanel';p.setAttribute('aria-labelledby','cc-tab-'+t.id);pages.append(p);pageEls.set(t.id,p);}
 function section(page:Tab,num:string,title:string,focus:Focus,note=''){const s=document.createElement('section');s.dataset.focus=focus;s.innerHTML=`<h3><b>${num}</b>${title}<em>${note}</em></h3><div class="cc-body"></div>`;pageEls.get(page)!.append(s);return s.querySelector<HTMLElement>('.cc-body')!;}
 type Card={el:HTMLButtonElement;canvas:HTMLCanvasElement|null;draw:(()=>void)|null;active:()=>boolean;page:Tab};const cards:Card[]=[];
 function card(page:Tab,parent:HTMLElement,label:string,sub:string,pick:()=>void,active:()=>boolean,draw:((c:HTMLCanvasElement)=>void)|null){const el=document.createElement('button');el.className='cc-card'+(draw?'':' text');el.innerHTML=`${draw?'<canvas width="160" height="160"></canvas>':''}<span>${label}</span>${sub?`<small>${sub}</small>`:''}`;
  const canvas=el.querySelector('canvas');el.onclick=()=>{pick();refresh();};parent.append(el);cards.push({el,canvas,draw:draw&&canvas?()=>draw(canvas):null,active,page});}
 const hex=(s:string)=>s.toLowerCase();
 function colorRow(page:Tab,num:string,title:string,keyName:ColorKey,list:readonly string[],focus:Focus,note=''){const body=section(page,num,title,focus,note);body.classList.add('cc-sw-row');const set:HTMLButtonElement[]=[];
  for(const c of list){const b=document.createElement('button');b.className='cc-sw';b.style.setProperty('--c',c);b.title=c;b.setAttribute('aria-label',`${title} ${c}`);b.onclick=()=>{look[keyName]=c;refresh(false);scheduleThumbs();};body.append(b);set.push(b);}
  const lab=document.createElement('label');lab.className='cc-pick';lab.title='好きな色を選ぶ';lab.innerHTML=`<input type="color" aria-label="${title}を自由に選ぶ"><span>自由</span>`;const inp=lab.querySelector('input')!;inp.oninput=()=>{look[keyName]=hex(inp.value);refresh(false);scheduleThumbs();};body.append(lab);
  const code=document.createElement('code');code.className='cc-hex';body.append(code);
  syncers.push(()=>{set.forEach((b,i)=>b.classList.toggle('active',hex(list[i])===hex(look[keyName])));lab.classList.toggle('active',!list.some(c=>hex(c)===hex(look[keyName])));lab.style.setProperty('--c',look[keyName]);inp.value=look[keyName];code.textContent=look[keyName].toUpperCase();});}
 function slider(parent:HTMLElement,label:string,get:()=>number,set:(v:number)=>void,fmt:(v:number)=>string,left='',right=''){const row=document.createElement('label');row.className='cc-slider';row.innerHTML=`<span class="cc-sl-name">${label}</span><span class="cc-sl-end">${left}</span><input type="range" min="-1" max="1" step="0.05"><span class="cc-sl-end r">${right}</span><output></output>`;
  const inp=row.querySelector('input')!,out=row.querySelector('output')!;inp.oninput=()=>{set(Number(inp.value));refresh(false);};inp.onchange=()=>scheduleThumbs();inp.ondblclick=()=>{set(0);refresh(false);scheduleThumbs();};parent.append(row);
  syncers.push(()=>{inp.value=String(get());out.textContent=fmt(get());});}
 const characterBody=section('character','01','主人公モデル','body','見た目の選択。変装の権限とは別です');characterBody.classList.add('cc-grid','two');for(const c of CHARACTERS)card('character',characterBody,c.label,c.note,()=>{look.character=c.id;yaw=.35;},()=>look.character===c.id,cv=>snap(cv,{...look,character:c.id},'body'));
 for(const page of ['face','outfit']as const){const note=document.createElement('p');note.className='fixed-note';note.textContent='専用モデルは顔・髪・服の形と配色を保持します。標準エージェントでは自由に変更できます。';pageEls.get(page)!.append(note);}
 // --- 顔・髪
 const hairBody=section('face','01','髪型','face');hairBody.classList.add('cc-grid','four');for(const h of HAIRS)card('face',hairBody,h.label,'',()=>look.hair=h.id,()=>look.hair===h.id,c=>snap(c,{...look,hair:h.id},'face'));
 colorRow('face','02','髪の色','hairColor',SWATCHES.hair,'face','眉の色も追従');
 const browBody=section('face','03','眉の角度','face');const brow=document.createElement('canvas');brow.id='cc-brow';brow.tabIndex=0;brow.setAttribute('aria-label','眉の角度。左右キーで調整');browBody.append(brow);
 colorRow('face','04','肌の色','skin',SWATCHES.skin,'face');
 const glassBody=section('face','05','眼鏡','face');glassBody.classList.add('cc-grid','two');for(const [v,label] of [[true,'かける'],[false,'かけない']] as const)card('face',glassBody,label,'',()=>look.glasses=v,()=>look.glasses===v,c=>snap(c,{...look,glasses:v},'face',.2));
 colorRow('face','06','フレームの色','frameColor',SWATCHES.frame,'face');
 // --- 体型
 const prop=section('body','01','プロポーション','body','ダブルクリックで中央に戻る');
 const cm=()=>`${Math.round(178*heightScale(look))} cm`,pct=(v:number)=>`${v>0?'+':''}${Math.round(v*12)}%`;
 slider(prop,'身長',()=>look.height,v=>look.height=v,()=>cm(),'低い','高い');slider(prop,'肩幅',()=>look.shoulders,v=>look.shoulders=v,pct,'狭い','広い');
 slider(prop,'体格',()=>look.build,v=>look.build=v,pct,'細い','がっしり');slider(prop,'頭の大きさ',()=>look.head,v=>look.head=v,pct,'小さい','大きい');
 const presets=section('body','02','体型プリセット','body');presets.classList.add('cc-grid','four');
 for(const [label,v] of [['標準',{height:0,shoulders:0,build:0,head:0}],['長身痩せ',{height:.8,shoulders:-.2,build:-.6,head:-.2}],['屈強',{height:.3,shoulders:.7,build:.7,head:0}],['小柄',{height:-.7,shoulders:-.3,build:-.2,head:.2}]] as [string,Pick<Look,SliderKey>][])
  card('body',presets,label,'',()=>Object.assign(look,v),()=>(Object.keys(v) as SliderKey[]).every(k=>Math.abs(look[k]-v[k])<.01),null);
 // --- 服装
 const outBody=section('outfit','01','服装','body');outBody.classList.add('cc-grid','two');for(const o of OUTFITS)card('outfit',outBody,o.label,o.note,()=>look.outfit=o.id,()=>look.outfit===o.id,c=>snap(c,{...look,outfit:o.id},'body',.25));
 colorRow('outfit','02','スーツの色','suitColor',SWATCHES.suit,'body');colorRow('outfit','03','シャツの色','shirtColor',SWATCHES.shirt,'chest');
 colorRow('outfit','04','ネクタイの色','tieColor',SWATCHES.tie,'chest','ネクタイ服のみ');colorRow('outfit','05','手袋の色','gloveColor',SWATCHES.glove,'body');
 // --- 歩き方
 const gaitBody=section('gait','01','歩き方のタイプ','body','右のプレビューで動きを見られる');gaitBody.classList.add('cc-grid','two');
 for(const g of GAITS)card('gait',gaitBody,g.label,g.note,()=>{look.gait={...DEFAULT_GAIT,style:g.id};if(motion==='idle')setMotion('walk');},()=>look.gait.style===g.id,null);
 const fine=section('gait','02','細かい調整','body','ダブルクリックで戻る');const gk=(k:GaitKey)=>({get:()=>look.gait[k],set:(v:number)=>{look.gait[k]=v;}});
 slider(fine,'歩幅',gk('stride').get,gk('stride').set,v=>`${v>0?'+':''}${Math.round(v*20)}%`,'ちょこちょこ','大股');slider(fine,'腕の振り',gk('arm').get,gk('arm').set,v=>`${v>0?'+':''}${Math.round(v*50)}%`,'小さく','大きく');
 slider(fine,'姿勢',gk('lean').get,gk('lean').set,v=>v>.05?'前かがみ':v<-.05?'胸を張る':'自然','胸を張る','前かがみ');slider(fine,'腰の揺れ',gk('sway').get,gk('sway').set,v=>`${v>0?'+':''}${Math.round(v*60)}%`,'ぶれない','ゆらゆら');slider(fine,'弾み',gk('bounce').get,gk('bounce').set,v=>`${v>0?'+':''}${Math.round(v*50)}%`,'すり足','弾む');
 const note=section('gait','03','動きについて','body');note.innerHTML='<p class="cc-note">見た目だけの個性です。移動速度・足音・見つかりやすさは変わりません。</p>';
 // --- 保存・共有
 const slotBody=section('save','01','保存した姿','body','6枠');slotBody.classList.add('cc-slots');let slots:(Slot|null)[]=loadSlots();
 function drawSlots(){slotBody.textContent='';slots.forEach((s,i)=>{const el=document.createElement('div');el.className='cc-slot'+(s?' full':'');el.innerHTML=`<canvas width="160" height="160"></canvas><b>${s?s.name.replace(/</g,'&lt;'):'空き'}</b><div><button data-a="save">保存</button><button data-a="load"${s?'':' disabled'}>呼び出す</button><button data-a="del"${s?'':' disabled'} aria-label="削除">✕</button></div>`;
   const cv=el.querySelector('canvas')!;if(s?.thumb){const im=new Image();im.onload=()=>cv.getContext('2d')!.drawImage(im,0,0,cv.width,cv.height);im.src=s.thumb;}
   el.querySelector<HTMLButtonElement>('[data-a=save]')!.onclick=()=>{const t=document.createElement('canvas');t.width=t.height=160;snap(t,look,'body',.35);applyLook(body,look);slots[i]={name:look.codename,look:sanitizeLook(look),thumb:t.toDataURL('image/png')};saveSlots(slots);drawSlots();};
   el.querySelector<HTMLButtonElement>('[data-a=load]')!.onclick=()=>{if(!slots[i])return;const keep=look.codename;Object.assign(look,sanitizeLook(slots[i]!.look));look.codename=slots[i]!.look.codename||keep;name.value=look.codename;refresh();};
   el.querySelector<HTMLButtonElement>('[data-a=del]')!.onclick=()=>{slots[i]=null;saveSlots(slots);drawSlots();};slotBody.append(el);});}
 const share=section('save','02','コードで共有','body','友達に送れる');share.innerHTML=`<textarea id="cc-code" readonly rows="3" aria-label="共有コード"></textarea><div class="cc-row"><button id="cc-copy">コピー</button></div><input id="cc-import" placeholder="CH1. で始まるコードを貼り付け" spellcheck="false" autocomplete="off"><div class="cc-row"><button id="cc-load">コードから読み込む</button><span id="cc-msg" role="status"></span></div>`;
 const code=share.querySelector<HTMLTextAreaElement>('#cc-code')!,msg=share.querySelector<HTMLElement>('#cc-msg')!,imp=share.querySelector<HTMLInputElement>('#cc-import')!;
 share.querySelector<HTMLButtonElement>('#cc-copy')!.onclick=async()=>{code.select();try{await navigator.clipboard.writeText(code.value);msg.textContent='コピーしました';}catch{document.execCommand?.('copy');msg.textContent='選択しました。Ctrl+Cでコピーできます';}};
 share.querySelector<HTMLButtonElement>('#cc-load')!.onclick=()=>{const l=decodeLook(imp.value);if(!l){msg.textContent='読み込めません。コードを確認してください';return;}Object.assign(look,l);name.value=look.codename;imp.value='';msg.textContent='読み込みました';refresh();};
 // --- tabs, motion bar
 function setTab(t:Tab){tab=t;tabs.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{const on=b.dataset.tab===t;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});pageEls.forEach((p,k)=>p.classList.toggle('open',k===t));
  focus=TABS.find(x=>x.id===t)!.focus;pages.scrollTop=0;if(t==='save'){code.value=encodeLook(look);drawSlots();}scheduleThumbs(0);}
 tabs.addEventListener('keydown',e=>{if(e.code!=='ArrowRight'&&e.code!=='ArrowLeft')return;e.preventDefault();const i=TABS.findIndex(x=>x.id===tab),n=TABS[(i+(e.code==='ArrowRight'?1:TABS.length-1))%TABS.length].id;setTab(n);q<HTMLButtonElement>('#cc-tab-'+n).focus();});
 const motionBar=q('.cc-motion');for(const m of MOTIONS){const b=document.createElement('button');b.textContent=m.label;b.dataset.m=m.id;b.onclick=()=>setMotion(m.id);motionBar.append(b);}
 const spinBtn=document.createElement('button');spinBtn.textContent='回転';spinBtn.className='spin on';spinBtn.setAttribute('aria-pressed','true');spinBtn.onclick=()=>{spin=!spin;spinBtn.classList.toggle('on',spin);spinBtn.setAttribute('aria-pressed',String(spin));};motionBar.append(spinBtn);
 function setMotion(m:Motion){motion=m;motionBar.querySelectorAll<HTMLButtonElement>('button[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===m));}
 // --- brow dial: the two brows drawn at the chosen angle above a notched track
 function drawBrow(){const dpr=Math.min(devicePixelRatio,2),w=brow.clientWidth||300,h=86;if(brow.width!==Math.round(w*dpr)){brow.width=w*dpr;brow.height=h*dpr;}const g=brow.getContext('2d')!;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const a=look.brow*.36,cx=w/2;g.lineCap='round';g.strokeStyle=PAPER;g.lineWidth=5;
  // Sharp lowers the inner ends (towards the centre), soft raises them.
  for(const s of [-1,1]){const x=cx+s*34,d=Math.tan(a)*18;g.beginPath();g.moveTo(x-s*18,26+d);g.lineTo(x+s*18,26-d);g.stroke();}
  g.fillStyle=DIM;g.font=`11px ${JP}`;g.textAlign='left';g.fillText('やさしい',8,30);g.textAlign='right';g.fillText('鋭い',w-8,30);
  const x0=14,x1=w-14,ty=62;g.strokeStyle='rgba(243,239,230,.25)';g.lineWidth=2;g.beginPath();g.moveTo(x0,ty);g.lineTo(x1,ty);g.stroke();
  for(let i=0;i<=20;i++){const x=x0+(x1-x0)*i/20;g.strokeStyle=i===10?'rgba(243,239,230,.7)':'rgba(243,239,230,.25)';g.lineWidth=1;g.beginPath();g.moveTo(x,ty-(i%5===0?8:4));g.lineTo(x,ty+(i%5===0?8:4));g.stroke();}
  const kx=x0+(x1-x0)*(look.brow+1)/2;g.strokeStyle=look.brow>0?RED:look.brow<0?'#7fc8e8':AMBER;g.lineWidth=3;g.beginPath();g.moveTo(x0+(x1-x0)/2,ty);g.lineTo(kx,ty);g.stroke();
  g.fillStyle=PAPER;g.beginPath();g.moveTo(kx,ty-9);g.lineTo(kx+7,ty);g.lineTo(kx,ty+9);g.lineTo(kx-7,ty);g.closePath();g.fill();
  g.fillStyle=PAPER;g.font=`600 12px ${LATIN}`;g.textAlign='center';g.fillText(`${look.brow>0?'+':''}${Math.round(look.brow*20)}°`,cx,82);}
 const browAt=(e:PointerEvent)=>{const r=brow.getBoundingClientRect();look.brow=Math.round(Math.max(-1,Math.min(1,((e.clientX-r.left-14)/(r.width-28))*2-1))*10)/10;refresh(false);};
 brow.addEventListener('pointerdown',e=>{brow.setPointerCapture(e.pointerId);browAt(e);});brow.addEventListener('pointermove',e=>{if(e.buttons&1)browAt(e);});brow.addEventListener('pointerup',()=>scheduleThumbs());
 brow.addEventListener('keydown',e=>{if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();look.brow=Math.round(Math.max(-1,Math.min(1,look.brow+(e.code==='ArrowRight'?.1:-.1)))*10)/10;refresh(false);scheduleThumbs();}});
 // --- state
 const name=q<HTMLInputElement>('#cc-name');name.value=look.codename;name.oninput=()=>{look.codename=name.value.trim()||'AGENT';tag();};
 function tag(){q('#cc-tag-name').textContent=look.codename.toUpperCase();q('#cc-tag-sub').textContent=`${CHARACTERS.find(c=>c.id===look.character)!.label} · ${look.character==='wardrobe'?HAIRS.find(h=>h.id===look.hair)!.label+' · '+OUTFITS.find(o=>o.id===look.outfit)!.label:'専用モデル'} · ${GAITS.find(g=>g.id===look.gait.style)!.label}の歩き方`;}
 function placeBody(){ensureCharacter(look.character);applyLook(body,look);rig.setBody(bodyScales(look));body.scale.setScalar(heightScale(look));loco.style=gaitStyleOf(look.gait);}
 let thumbTimer=0;function scheduleThumbs(delay=160){clearTimeout(thumbTimer);thumbTimer=window.setTimeout(drawThumbs,delay);}
 function drawThumbs(){const motionNow=motion;void motionNow;for(const c of cards)if(c.page===tab&&c.draw)c.draw();placeBody();}
 function refresh(thumbsToo=true){placeBody();const fixed=look.character!=='wardrobe';root.classList.toggle('fixed-character',fixed);for(const k of ['face','outfit']as const)pageEls.get(k)!.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input').forEach(e=>e.disabled=fixed);for(const s of syncers)s();for(const c of cards)c.el.classList.toggle('active',c.active());drawBrow();tag();if(tab==='save')code.value=encodeLook(look);if(thumbsToo)scheduleThumbs(0);}
 let focus:Focus='face';root.querySelectorAll<HTMLElement>('section[data-focus]').forEach(s=>{const f=s.dataset.focus as Focus;s.addEventListener('pointerenter',()=>focus=f);s.addEventListener('focusin',()=>focus=f);});
 q('.cc-panel').addEventListener('pointerleave',()=>focus=TABS.find(x=>x.id===tab)!.focus);
 q('#cc-random').onclick=()=>{Object.assign(look,randomLook(look.codename));refresh();};
 q('#cc-reset').onclick=()=>{Object.assign(look,sanitizeLook({...DEFAULT_LOOK,codename:look.codename}));refresh();};
 let yaw=.5,spin=true,dragX:number|null=null;view.addEventListener('pointerdown',e=>{dragX=e.clientX;view.setPointerCapture(e.pointerId);});view.addEventListener('pointermove',e=>{if(dragX!==null){yaw+=(e.clientX-dragX)*.01;dragX=e.clientX;}});view.addEventListener('pointerup',()=>dragX=null);
 // --- backdrop
 const bg=q<HTMLCanvasElement>('.cc-bg'),bgc=bg.getContext('2d')!;
 function backdrop(t:number){const dpr=Math.min(devicePixelRatio,2),w=innerWidth,h=innerHeight;if(bg.width!==Math.round(w*dpr)){bg.width=Math.round(w*dpr);bg.height=Math.round(h*dpr);}const g=bgc;g.setTransform(dpr,0,0,dpr,0,0);
  const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#0c1013');grad.addColorStop(1,'#1b2023');g.fillStyle=grad;g.fillRect(0,0,w,h);
  const sx=w*.34,spot=g.createRadialGradient(sx,h*.55,10,sx,h*.55,h*.62);spot.addColorStop(0,'rgba(243,239,230,.13)');spot.addColorStop(1,'rgba(243,239,230,0)');g.fillStyle=spot;g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(243,239,230,.045)';g.lineWidth=1;for(let x=(t*6)%48;x<w;x+=48){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}for(let y=0;y<h;y+=48){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  g.save();g.font=`700 ${Math.round(h*.22)}px ${LATIN}`;g.strokeStyle='rgba(243,239,230,.05)';g.lineWidth=1.5;g.textBaseline='bottom';g.strokeText('CLEAN HANDS',-8,h+h*.03);g.restore();
  g.fillStyle=RED;g.fillRect(0,0,6,h);g.fillRect(28,h*.2,1,h*.6);const scan=(t*.12%1)*h;g.fillStyle='rgba(226,54,43,.08)';g.fillRect(0,scan,w*.62,2);
  g.fillStyle='rgba(243,239,230,.35)';g.font=`10px ${LATIN}`;for(let i=0;i<6;i++)g.fillText(`${(Math.sin(t*.3+i)*90+90).toFixed(2).padStart(6,'0')}  N${(i*7.3+t).toFixed(1)}`,40,h*.3+i*16);}
 // --- loop
 let last=performance.now(),alive=true,camY=FOCUS.body.y,camD=FOCUS.body.dist;
 function frame(now:number){if(!alive)return;const dt=Math.min(.05,(now-last)/1000);last=now;const w=view.clientWidth,h=view.clientHeight;
  if(view.width!==Math.round(w*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  if(spin)yaw+=dt*.25;turn.rotation.y=yaw;
  // The figure walks on the spot: the gait advances by the distance it would have covered.
  const m=MOTIONS.find(x=>x.id===motion)!;crouchBlend=T.MathUtils.damp(crouchBlend,m.crouch,8,dt);gaitSpeed=T.MathUtils.damp(gaitSpeed,m.speed,10,dt);
  rig.apply(loco.update(dt,{speed:gaitSpeed,crouch:crouchBlend,slope:0,turn:0,distance:gaitSpeed*dt,actual:m.speed}));
  const hs=heightScale(look),f=FOCUS[motion==='idle'?focus:'body'];camY=T.MathUtils.damp(camY,f.y*hs*(crouchBlend>.5&&f===FOCUS.body?.8:1),5,dt);camD=T.MathUtils.damp(camD,f.dist*(f===FOCUS.body?1:hs),5,dt);// Look slightly left of the model so it stands right of centre, clear of the codename block.
  camera.position.set(-.3,camY+.05,camD);camera.lookAt(-.3,camY,0);
  ring.material.opacity=.45+.25*Math.sin(now/600);renderer.render(scene,camera);backdrop(now/1000);requestAnimationFrame(frame);}
 const typing=()=>{const a=document.activeElement as HTMLElement|null;return !!a&&(a.tagName==='TEXTAREA'||(a.tagName==='INPUT'&&['text',''].includes((a as HTMLInputElement).type)));};
 const onKey=(e:KeyboardEvent)=>{if(e.code==='Enter'&&!typing()){e.preventDefault();e.stopPropagation();finish();}};
 function finish(){if(!alive)return;alive=false;clearTimeout(thumbTimer);removeEventListener('keydown',onKey,true);root.classList.add('leaving');setTimeout(()=>{renderer.dispose();thumbs.dispose();root.remove();},420);onDone(sanitizeLook(look));}
 q('#cc-go').onclick=finish;addEventListener('keydown',onKey,true);
 setMotion('idle');setTab('character');requestAnimationFrame(()=>{refresh();requestAnimationFrame(frame);});q<HTMLButtonElement>('#cc-go').focus();
}

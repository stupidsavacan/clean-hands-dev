import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {PLAYER_BASE64} from './player-data';
import {NPC_MODELS} from './npc-data';
import {COMBAT_MODELS} from './combat-data';
import {Rig} from './rig';
import {applyLook} from './appearance';
import {loadLook} from './wardrobe';
import {Locomotion,WALK_SPEED,RUN_SPEED} from './locomotion';
import {neutral,plantedFeet} from './motion-runtime';
import {sampleCombat,weaponVisible,COMBAT_SECONDS,COMBAT_LOOPS,type CombatKind} from './combat-motion';
import {poseCombat,prepareWeapon,muzzle,type Weapon} from './combat-runtime';

// Who performs: the agent with the silenced pistol, a guard with the service pistol, a bodyguard (SMG),
// a response-team member (rifle) and a guest for the bystander reactions.
const CAST=[['agent','主人公・消音ピストル'],['guard','警備員・拳銃'],['bodyguard','私設護衛・短機関銃'],['response','増援・突撃銃'],['guest','客（逃げる・伏せる）']] as const;
type Who=typeof CAST[number][0];
const KINDS:[CombatKind,string][]=[['draw','銃を出す'],['holster','しまう'],['aim','構え'],['fire','撃つ'],['reload','弾を込める'],['hit','被弾のよろけ'],['cover','遮蔽に隠れる'],['coverAim','遮蔽から構える'],['flee','逃げる'],['duck','伏せる']];
document.querySelector('#app')!.innerHTML=`<header><b>M5.5 / 撃ち合いモーション</b><a href="../index.html">ゲームに戻る ↗</a></header><main><canvas id="view"></canvas><p class="legend">ドラッグで回転、ホイールで拡大</p></main><footer><div class="row" id="cast">${CAST.map(([k,t])=>`<button data-who="${k}">${t}</button>`).join('')}</div><div class="row" id="kinds">${KINDS.map(([k,t])=>`<button data-kind="${k}">${t}</button>`).join('')}</div><div class="row"><button id="play">一時停止</button><input id="timeline" aria-label="モーションの進行" type="range" min="0" max="1000" value="0"><output id="progress">0%</output><select id="speed" aria-label="再生速度"><option value=".25">0.25倍</option><option value=".5">0.5倍</option><option value="1" selected>1倍</option></select><label><input type="checkbox" id="walk"> 歩きながら</label></div><div class="row"><button data-angle="0">正面</button><button data-angle="1.0">斜め</button><button data-angle="1.57079632679">横</button><button data-angle="3.14159265359">後ろ</button><span id="phase"></span></div><output id="qa" aria-label="モーション検証"></output></footer>`;
const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}body{margin:0;background:#11191e;color:#e9e4da;font:13px 'Yu Gothic UI',sans-serif}header{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;letter-spacing:.1em;border-bottom:1px solid #34424b}a{color:#e6b78c;text-decoration:none}main{position:relative;height:calc(100dvh - 268px);min-height:240px}canvas{display:block;width:100%;height:100%}.legend{position:absolute;bottom:8px;width:100%;text-align:center;color:#b4b9b8;font-size:11px;pointer-events:none}footer{padding:12px 24px}.row{display:flex;gap:7px;align-items:center;margin-bottom:9px;flex-wrap:wrap}button,select{border:1px solid #45525a;background:#253139;color:#e9e4da;padding:8px 12px;border-radius:6px;cursor:pointer}button.active{background:#d9b394;color:#142027;border-color:#d9b394}button:disabled{opacity:.35;cursor:default}#timeline{flex:1;min-width:120px;accent-color:#dfb895}#progress{width:40px}#phase{color:#dfb895;margin-left:auto}#qa{font:11px monospace;color:#95a8af}@media(max-width:760px){header{padding:0 12px;font-size:11px}footer{padding:8px}button,select{padding:6px 8px;font-size:12px}main{height:calc(100dvh - 330px)}}`;document.head.append(style);
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;
const canvas=$<HTMLCanvasElement>('#view'),renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new T.Scene();scene.background=new T.Color('#28343c');scene.add(new T.HemisphereLight('#fff0dc','#65747a',2));for(const [x,y,z,p]of [[-3,5,3,2.8],[3,3,-2,1.8]]){const l=new T.DirectionalLight('#fff2df',p);l.position.set(x,y,z);scene.add(l);}
const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:'#35444d',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);const grid=new T.GridHelper(10,20,'#65727a','#43515a');grid.position.y=-.02;scene.add(grid);
const camera=new T.PerspectiveCamera(32,1,.01,100);const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.05,.15);controls.enableDamping=true;
const view=(a:number)=>{camera.position.copy(controls.target).add(new T.Vector3(Math.sin(a)*3.6,.55,Math.cos(a)*3.6));controls.update();};view(1.0);
type Actor={group:T.Group;model:T.Object3D;rig:Rig;loco:Locomotion};
const actors={} as Record<Who,Actor>,weapons={} as Record<string,Weapon>;let flash:T.Object3D,crate:T.Object3D;
let who:Who='agent',kind:CombatKind='draw',progress=0,playing=true,last=performance.now(),ready=false;
const weaponOf:Record<Who,string|null>={agent:'pistol_silenced',guard:'pistol_guard',bodyguard:'smg',response:'rifle_npc',guest:null};
const bystander=(k:CombatKind)=>k==='flee'||k==='duck';
function refresh(){document.querySelectorAll<HTMLButtonElement>('[data-who]').forEach(b=>b.classList.toggle('active',b.dataset.who===who));
 document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(b=>{const k=b.dataset.kind as CombatKind;b.disabled=(who==='guest')!==bystander(k);b.classList.toggle('active',k===kind);});}
function select(w:Who,k:CombatKind){who=w;if((who==='guest')!==bystander(k))k=who==='guest'?'flee':'draw';kind=k;progress=0;for(const [id,a] of Object.entries(actors))a.group.visible=id===who;for(const [id,wp] of Object.entries(weapons))wp.object.visible=id===weaponOf[who];refresh();}
document.querySelectorAll<HTMLButtonElement>('[data-who]').forEach(b=>b.onclick=()=>select(b.dataset.who as Who,kind));
document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(b=>b.onclick=()=>select(who,b.dataset.kind as CombatKind));
$('#play').onclick=()=>{playing=!playing;$('#play').textContent=playing?'一時停止':'再生';};$<HTMLInputElement>('#timeline').oninput=()=>{playing=false;$('#play').textContent='再生';progress=Number($<HTMLInputElement>('#timeline').value)/1000;};
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.onclick=()=>view(Number(b.dataset.angle)));
async function init(){const loader=new GLTFLoader(),parse=async(b:string)=>(await loader.parseAsync(Uint8Array.from(atob(b),c=>c.charCodeAt(0)).buffer,'')).scene;
 const actor=async(b:string)=>{const model=await parse(b),group=new T.Group();group.add(model);scene.add(group);return {model,group,rig:new Rig(model),loco:new Locomotion()};};
 actors.agent=await actor(PLAYER_BASE64);applyLook(actors.agent.model,loadLook());actors.guard=await actor(NPC_MODELS.guard);actors.bodyguard=await actor(NPC_MODELS.guard);actors.response=await actor(NPC_MODELS.guard);actors.guest=await actor(NPC_MODELS.guest_suit);
 for(const [id,cls] of [['pistol_silenced','pistol'],['pistol_guard','pistol'],['smg','long'],['rifle_npc','long']] as const){const s=await parse(COMBAT_MODELS[id]);scene.add(s);weapons[id]=prepareWeapon(s,cls);}
 flash=await parse(COMBAT_MODELS.muzzle_flash);scene.add(flash);crate=await parse(COMBAT_MODELS.crate);crate.position.set(0,0,.95);scene.add(crate);
 ready=true;select('agent','draw');}
function render(dt:number){const a=actors[who],wid=weaponOf[who],wp=wid?weapons[wid]:null,frame=sampleCombat(kind,wp?.cls??'pistol',progress);
 const walk=$<HTMLInputElement>('#walk').checked&&frame.upperOnly,speed=kind==='flee'?RUN_SPEED:walk?WALK_SPEED*.7:0;
 neutral(a.rig);a.model.position.set(0,0,0);a.model.rotation.set(0,0,0);
 if(frame.upperOnly)a.rig.apply(a.loco.update(dt,{speed,crouch:0,slope:0,turn:0,distance:speed*dt}));
 let error=0;if(wp)wp.object.visible=weaponVisible(kind,wp.cls,progress,who==='agent');
 error=poseCombat(a.rig,a.group,a.model,frame,wp);
 if(kind==='hit')plantedFeet(a.rig,a.group,()=>0);
 crate.visible=kind==='cover'||kind==='coverAim';
 const shot=kind==='fire'&&progress<.24&&!!wp;flash.visible=shot;if(shot&&wp){flash.position.copy(muzzle(wp));flash.quaternion.copy(wp.object.quaternion);flash.scale.setScalar(wp.cls==='long'?1.4:1);}
 $('#phase').textContent=`${KINDS.find(k=>k[0]===kind)![1]}　${(progress*COMBAT_SECONDS[kind]).toFixed(2)} / ${COMBAT_SECONDS[kind]} 秒`;
 $('#qa').textContent=`${who} ${kind} t=${progress.toFixed(3)} | hand error ${(error*100).toFixed(1)} cm`;$('#qa').dataset.error=String(error);}
function frame(now:number){const dt=Math.min(.1,(now-last)/1000);last=now;
 if(ready){if(playing){progress+=dt*Number($<HTMLSelectElement>('#speed').value)/COMBAT_SECONDS[kind];if(progress>(COMBAT_LOOPS.includes(kind)?1:1.3))progress=0;}
  const saved=progress;progress=Math.min(1,progress);render(dt);$('#progress').textContent=Math.round(progress*100)+'%';$<HTMLInputElement>('#timeline').value=String(Math.round(progress*1000));progress=saved;}
 const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}
// Automation hook for the screenshot/QA script: pose a given moment and report the hand error.
Object.assign(window,{__combat:{ready:()=>ready,show:(w:Who,k:CombatKind,t:number,walk=false,angle=1.0)=>{select(w,k);playing=false;progress=t;$<HTMLInputElement>('#walk').checked=walk;view(angle);for(let i=0;i<(walk||k==='flee'?24:1);i++)render(1/60);return Number($('#qa').dataset.error);}}});
void init();requestAnimationFrame(frame);

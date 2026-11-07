import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {NPC_MODELS} from './npc-data';
import {PLAYER_BASE64} from './player-data';
import {applyLook} from './appearance';
import {loadLook} from './wardrobe';
import {Rig} from './rig';
import {Locomotion,WALK_SPEED,RUN_SPEED,CROUCH_SPEED,type Pose} from './locomotion';
import {sampleM4Motion} from './m4-motion';
import {applyMotion,neutral} from './motion-runtime';
import {schedulePose} from './schedule-motion';

const movement=[['idle','立ち止まる'],['walk','歩く'],['run','走る'],['crouch','しゃがみ歩き']];
const day=[['phone','電話'],['radio','無線'],['drink','飲む'],['tasting','試飲'],['speech','スピーチ'],['chat','会話'],['camera','撮影'],['photo','撮られる'],['tour','見学'],['inspect','点検'],['cook','料理'],['clean','清掃'],['massage_work','施術'],['work','仕事'],['serve','給仕'],['dance','ダンス'],['massage','マッサージを受ける']];
const m4=[['change','着替え'],['frisk','身体検査']];
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;
const renderer=new T.WebGLRenderer({canvas:$<HTMLCanvasElement>('#scene'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const scene=new T.Scene();scene.background=new T.Color('#202c35');scene.add(new T.HemisphereLight(0xffffff,0x465b65,2));
for(const [x,y,z,p]of [[-3,5,3,2.6],[3,4,-2,1.6]]){const l=new T.DirectionalLight('#fff4e5',p);l.position.set(x,y,z);scene.add(l);}
const ground=new T.Mesh(new T.PlaneGeometry(15,15),new T.MeshStandardMaterial({color:'#344652',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.018;scene.add(ground);
const grid=new T.GridHelper(10,20,0x5b727d,0x3b5260);scene.add(grid);
const camera=new T.PerspectiveCamera(35,1,.01,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,.95,0);
const setView=(a:number)=>{camera.position.copy(controls.target).add(new T.Vector3(Math.sin(a)*3.8,.45,Math.cos(a)*3.8));controls.update();};
setView(.42);
let actor:{group:T.Group;model:T.Object3D;rig:Rig;loco:Locomotion}|undefined;
let partner:{group:T.Group;model:T.Object3D;rig:Rig}|undefined;
const loader=new GLTFLoader();
async function load(id:string){const data=NPC_MODELS[id];if(!data)throw Error('Missing model '+id);return (await loader.parseAsync(Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer,'')).scene;}
async function init(){const model=(await loader.parseAsync(Uint8Array.from(atob(PLAYER_BASE64),c=>c.charCodeAt(0)).buffer,'')).scene,second=await load('guard');const group=new T.Group(),group2=new T.Group();group.add(model);group2.add(second);scene.add(group,group2);applyLook(model,loadLook());actor={group,model,rig:new Rig(model),loco:new Locomotion()};partner={group:group2,model:second,rig:new Rig(second)};select('walk');$('#loading').textContent='';}
let selected='walk',clock=0,paused=false,speed=1,last=performance.now();
function select(k:string){selected=k;clock=0;actor?.loco.reset();document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(b=>b.classList.toggle('active',b.dataset.kind===k));$('#selected').textContent=[...movement,...day,...m4].find(x=>x[0]===k)?.[1]||k;}
for(const [title,values] of [['移動・基本動作',movement],['M4 変装',m4],['NPCの日常動作',day]] as const){
 const section=document.createElement('section');const h=document.createElement('h3');h.textContent=title;section.append(h);
 for(const [id,label]of values){const b=document.createElement('button');b.dataset.kind=id;b.textContent=label;b.onclick=()=>select(id);section.append(b);}
 $('#items').append(section);
}
$('#play').onclick=()=>{paused=!paused;$('#play').textContent=paused?'再生':'一時停止';};
$<HTMLInputElement>('#timeline').oninput=()=>{clock=Number($<HTMLInputElement>('#timeline').value)/1000*3;paused=true;$('#play').textContent='再生';};
$<HTMLSelectElement>('#speed').onchange=()=>{speed=Number($<HTMLSelectElement>('#speed').value);};
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>setView(Number(b.dataset.view)));
function pose(dt:number){
 if(!actor||!partner)return;
 const {model,rig,loco}=actor;partner.group.visible=selected==='frisk';
 actor.group.position.set(0,0,-.48);actor.group.rotation.y=0;partner.group.position.set(0,0,.52);partner.group.rotation.y=Math.PI;model.position.set(0,0,0);model.rotation.set(0,0,0);partner.model.position.set(0,0,0);partner.model.rotation.y=0;
 neutral(rig);neutral(partner.rig);
 if(selected==='change'||selected==='frisk'){
  const p=(clock%3)/3;applyMotion(rig,model,sampleM4Motion(selected,'giver',p));
  if(selected==='frisk')applyMotion(partner.rig,partner.model,sampleM4Motion('frisk','receiver',p));
 }else{
  const s=selected==='walk'?WALK_SPEED:selected==='run'?RUN_SPEED:selected==='crouch'?CROUCH_SPEED:0;
  const crouch=selected==='crouch'?1:0;
  let p:Pose;
  if(selected==='idle'||selected==='walk'||selected==='run'||selected==='crouch'){
    p=loco.update(dt,{speed:s,crouch,slope:0,turn:0,distance:s*dt,actual:s});
  }else{
    p=loco.update(dt,{speed:0,crouch:0,slope:0,turn:0,distance:0,actual:0});
    schedulePose(p,selected,clock);
  }
  rig.apply(p);
 }
}
function loop(now:number){const dt=Math.min(.06,(now-last)/1000);last=now;if(actor){if(!paused)clock+=dt*speed;pose(paused?0:dt);if(!paused)$<HTMLInputElement>('#timeline').value=String(Math.floor((clock%3)/3*1000));$('#time').textContent=(clock%3).toFixed(2)+'s';}
 const c=renderer.domElement,w=c.clientWidth,h=c.clientHeight;if(w>0&&h>0){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();controls.update();renderer.render(scene,camera);}requestAnimationFrame(loop);}
void init().catch(e=>{$('#loading').textContent=String(e);console.error(e);});requestAnimationFrame(loop);

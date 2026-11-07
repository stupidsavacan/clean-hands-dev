import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MODEL_MANIFEST} from './model-gallery-manifest';

type ModelEntry=(typeof MODEL_MANIFEST)[number];
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;
const canvas=$<HTMLCanvasElement>('#view');
const renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
const scene=new T.Scene();
scene.background=new T.Color('#28343e');
scene.add(new T.HemisphereLight('#fff0df','#58717c',2));
for(const [x,y,z,power] of [[-4,5,4,2.5],[4,4,-3,1.5]]) {
 const light=new T.DirectionalLight('#fff4eb',power);
 light.position.set(x,y,z);scene.add(light);
}
const camera=new T.PerspectiveCamera(36,1,.01,2000);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.enablePan=true;
const loader=new GLTFLoader();
const ground=new T.Mesh(new T.PlaneGeometry(1000,1000),new T.MeshStandardMaterial({color:'#30424e',roughness:1}));
ground.rotation.x=-Math.PI/2;scene.add(ground);
const grid=new T.GridHelper(10,20,0x617b86,0x405561);scene.add(grid);
let current:T.Object3D|null=null;
let selected:ModelEntry|null=null;
let mixer:T.AnimationMixer|null=null;
let animations:T.AnimationClip[]=[];
let clip:T.AnimationAction|null=null;
let loading=0;
let autoSpin=false,playing=true,last=performance.now();
let wire=false;
let lastGroup='',showing:ModelEntry[]=[];
const labelGroup=(name:string)=>name.substring(5);
const groups=[...new Set(MODEL_MANIFEST.map(x=>x.group))].sort();
const groupSelect=$<HTMLSelectElement>('#category');
const grp=document.createElement('option');grp.value='';grp.textContent='すべての分類';groupSelect.append(grp);
for(const name of groups){const opt=document.createElement('option');opt.value=name;opt.textContent=labelGroup(name);groupSelect.append(opt);}
$('#total').textContent='全'+MODEL_MANIFEST.length+'モデル';
const active=$<HTMLSelectElement>('#models'),search=$<HTMLInputElement>('#search');
function populate(){
 const query=search.value.toLowerCase().trim(),group=groupSelect.value;
 showing=MODEL_MANIFEST.filter(m=>(!group||m.group===group)&&(!query||(m.label+' '+m.url+' '+m.group).toLowerCase().includes(query)));
 active.replaceChildren();
 lastGroup='';
 for(const m of showing){
  if(m.group!==lastGroup){const hdr=document.createElement('optgroup');hdr.label=labelGroup(m.group);active.append(hdr);lastGroup=m.group;}
  const opt=document.createElement('option');opt.value=m.id;opt.textContent=m.label+'  ·  '+m.url.split('/').slice(-2,-1).join('');active.lastElementChild!.append(opt);
 }
 $('#count').textContent=showing.length+'件';
 if(showing.length){
  const first=showing.some(m=>m.id===selected?.id)?selected:showing[0];
  active.value=first!.id;
  if(first!==selected)void load(first!);
 }
 else $('#message').textContent='該当するモデルはありません';
}
search.addEventListener('input',populate);
groupSelect.addEventListener('change',populate);
active.addEventListener('change',()=>{const m=MODEL_MANIFEST.find(x=>x.id===active.value);if(m)void load(m);});
function frameView(angle=.55){
 if(!current)return;
 const box=new T.Box3().setFromObject(current,true);
 if(box.isEmpty())return;
 const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
 const height=Math.max(size.y,.15),extent=Math.max(size.x,size.y,size.z,.15);
 controls.target.copy(center);
 const d=extent*1.5/Math.tan(T.MathUtils.degToRad(camera.fov/2));
 camera.position.copy(center).add(new T.Vector3(Math.sin(angle)*d*.65,d*.12,Math.cos(angle)*d*.65));
 camera.near=Math.max(.001,extent/3000);camera.far=Math.max(300,d*10);
 camera.updateProjectionMatrix();controls.update();
 ground.position.y=box.min.y-.015*height;
 grid.position.set(center.x,ground.position.y+.001,center.z);
 grid.scale.setScalar(Math.max(.05,extent/4));
}
function wireframe(enable:boolean){
 if(!current)return;
 current.traverse(x=>{if((x as T.Mesh).isMesh){const materials=(x as T.Mesh).material;for(const m of Array.isArray(materials)?materials:[materials])if(m instanceof T.MeshStandardMaterial)m.wireframe=enable;}});
}
async function load(m:ModelEntry){
 const request=++loading;
 $('#message').textContent='読み込み中…';
 try{
  const path=new URL(m.url,window.location.href).href;
  const gltf=await loader.loadAsync(path);
  if(request!==loading)return;
  if(current)scene.remove(current);
  current=gltf.scene;scene.add(current);selected=m;
  mixer?.stopAllAction();
  mixer=gltf.animations.length?new T.AnimationMixer(current):null;
  animations=gltf.animations;
  const select=$<HTMLSelectElement>('#clip');select.replaceChildren();
  const off=document.createElement('option');off.value='';off.textContent='静止（Tポーズ）';select.append(off);
  animations.forEach((c,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=c.name||'Animation '+(i+1);select.append(o);});
  select.disabled=!animations.length;
  if(animations.length){select.value='0';startClip(0);}
  else{clip=null;select.value='';}
  wireframe(wire);frameView();
  let bones=0,tri=0,meshes=0,morphs=0;
  current.traverse(x=>{
   if((x as T.Bone).isBone)bones++;
   if((x as T.Mesh).isMesh){const xmesh=x as T.Mesh;meshes++;const g=xmesh.geometry;tri+=g.index?g.index.count/3:g.getAttribute('position')?.count/3||0;if(xmesh.morphTargetDictionary)morphs=Math.max(morphs,Object.keys(xmesh.morphTargetDictionary).length);}
  });
  $('#modelName').textContent=m.label;
  $('#modelInfo').textContent='三角形 '+Math.round(tri).toLocaleString()+' · メッシュ '+meshes+' · 骨 '+bones+' · モーフ '+morphs+' · アニメ '+animations.length;
  $('#source').textContent=m.url.replace('../../','outputs/');
  $('#message').textContent='表示中 · ドラッグで回転 / ホイールで拡大';
 }catch(e){if(request===loading){$('#message').textContent='読み込み失敗: '+String(e);console.error(m.url,e);}}
}
function startClip(i:number){
 mixer?.stopAllAction();
 if(!mixer||!animations[i]){clip=null;return;}
 clip=mixer.clipAction(animations[i]);clip.reset().play();clip.paused=!playing;
}
$<HTMLSelectElement>('#clip').addEventListener('change',e=>{
 const v=(e.target as HTMLSelectElement).value;startClip(v===''?-1:Number(v));
});
$('#play').addEventListener('click',()=>{
 playing=!playing;$('#play').textContent=playing?'一時停止':'再生';
 if(clip)clip.paused=!playing;
});
$<HTMLInputElement>('#spin').addEventListener('change',e=>{autoSpin=(e.target as HTMLInputElement).checked;});
$<HTMLInputElement>('#wire').addEventListener('change',e=>{wire=(e.target as HTMLInputElement).checked;wireframe(wire);});
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.onclick=()=>frameView(Number(b.dataset.angle)));
function tick(now:number){
 requestAnimationFrame(tick);
 const dt=Math.min(.05,(now-last)/1000);last=now;
 if(playing&&mixer)mixer.update(dt);
 controls.autoRotate=autoSpin;controls.autoRotateSpeed=1.4;
 controls.update();
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(w>0&&h>0){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);}
}
(window as unknown as {__modelGallery:object}).__modelGallery={count:MODEL_MANIFEST.length,selected:()=>selected?.label,loadByName:(name:string)=>{const m=MODEL_MANIFEST.find(m=>m.label===name&&m.group.startsWith('01'));if(m){groupSelect.value=m.group;search.value='';populate();active.value=m.id;return load(m);}return null;}};
populate();requestAnimationFrame(tick);

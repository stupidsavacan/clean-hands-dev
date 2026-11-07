// Item Lab (2026-11-05): every hand-held item GLB in the agent's hand (walking, running, crouching), on the floor and
// on its own with its anchors, plus automatic checks. The hand, the hold pose and the floor placement are the game's own
// (detection-view.ts inHand/floorItem, hold-pose.ts, item-models.ts), so a pass here is what the game shows.
// Re-run it after rebuilding the models (assets/items/source/build_items.py, scripts/embed-items.mjs).
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {PLAYER_BASE64} from '../player-data';
import {Rig} from '../rig';
import {applyLook} from '../appearance';
import {loadLook} from '../wardrobe';
import {Locomotion,WALK_SPEED,RUN_SPEED,CROUCH_SPEED,type Pose} from '../locomotion';
import {holdPose,holdKind} from '../hold-pose';
import {inHand,floorItem} from '../detection-view';
import {loadItemModels,itemModel} from '../item-models';
import {ITEM_INFO} from '../item-data';
import clubDetection from '../data/club-detection.json';
import hotelDetection from '../data/detection.json';

const KIND_LABEL={tool:'道具',melee:'近接武器',throw:'投げる物'} as const;
const POSES:[string,string,number,number][]=[['idle','立ち',0,0],['walk','歩き',WALK_SPEED,0],['run','走り',RUN_SPEED,0],['crouch','しゃがみ歩き',CROUCH_SPEED,1]];

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<canvas id="view"></canvas><aside id="panel"><header><b>持ち物ラボ</b><small>持てる物のモデルを、手・床・単体で見て、自動で確かめます。手への付け方と持った時の腕はゲームと同じです。</small></header>
<div class="row"><button id="check">すべて自動判定</button><label>姿勢 <select id="pose">${POSES.map(([id,l])=>`<option value="${id}">${l}</option>`).join('')}</select></label><label><input id="pause" type="checkbox"> 止める</label></div>
<div id="summary"></div><table id="list"></table><section id="detail"></section></aside>`;
const style=document.createElement('style');style.textContent=`
*{box-sizing:border-box}body{margin:0;background:#161a1f;color:#e9e6dd;font:13px/1.5 system-ui,sans-serif;overflow:hidden}
#view{position:fixed;left:0;top:0;width:calc(100vw - 400px);height:100vh;display:block}
#panel{position:fixed;right:0;top:0;width:400px;height:100vh;overflow:auto;background:#1d2127;border-left:1px solid #343a44;padding:12px}
#panel header b{font-size:16px;display:block}#panel small{color:#a7a399}.row{display:flex;gap:10px;align-items:center;margin:10px 0;flex-wrap:wrap}
button,select{background:#2a2f37;color:#eee;border:1px solid #474e59;border-radius:6px;padding:4px 8px}button{cursor:pointer}#check{background:#3b6b4f;border-color:#5a9a72}
table{width:100%;border-collapse:collapse}td{padding:3px 4px;border-bottom:1px solid #2c323a;vertical-align:top}tr.on td{background:#2b3240}tr{cursor:pointer}
.pass{color:#6fd08c}.fail{color:#ff6b5e}.warn{color:#f2c14e}#detail{margin-top:10px;padding:10px;background:#15171b;border-radius:6px;white-space:pre-wrap;min-height:80px}
@media (max-width:900px){#view{width:100vw;height:55vh}#panel{top:55vh;width:100vw;height:45vh}}`;
document.head.append(style);
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;

const canvas=$<HTMLCanvasElement>('#view'),renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene();scene.background=new T.Color('#283139');scene.add(new T.HemisphereLight('#fff0dc','#5d6a70',2.2));
{const l=new T.DirectionalLight('#fff2df',2.4);l.position.set(-3,5,3);scene.add(l);}
const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:'#34424a',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;scene.add(floor);scene.add(new T.GridHelper(20,80,'#5d6a72','#3f4b53'));
const camera=new T.PerspectiveCamera(35,1,.01,100);camera.position.set(-1.5,1.35,1.9);const controls=new OrbitControls(camera,canvas);controls.target.set(-.35,.85,.2);controls.enableDamping=true;

// The agent holding the item, the item on the floor beside them, and the item alone (enlarged) with its anchors.
let agent:{group:T.Group;model:T.Object3D;rig:Rig;loco:Locomotion}|undefined;
let held:T.Object3D|undefined,onGround:T.Object3D|undefined,alone:T.Group|undefined,current=ITEM_INFO[0].id;
function marker(color:string){return new T.Mesh(new T.SphereGeometry(.012,10,8),new T.MeshBasicMaterial({color,depthTest:false}));}
function show(id:string){
 current=id;held?.removeFromParent();onGround?.removeFromParent();alone?.removeFromParent();
 const hand=agent?.rig.joints.get('handr')?.bone;const m=itemModel(id);if(hand&&m)held=inHand(hand,m,id);
 onGround=floorItem(id);onGround.position.set(-.85,0,.75);scene.add(onGround);
 const solo=itemModel(id);if(solo){alone=new T.Group();alone.add(solo);const info=ITEM_INFO.find(i=>i.id===id)!;
  for(const [name,p] of Object.entries(info.anchors)){const k=marker(name==='GRIP_R'?'#ff4a3d':'#4aa3ff');k.position.set(p[0],p[1],p[2]);alone.add(k);}
  const size=Math.max(...info.size_m);alone.scale.setScalar(.5/Math.max(.05,size));alone.position.set(-1.05,1.15,-.1);scene.add(alone);}
 if(agent)agent.loco.reset();
 render();
}

// --- checks
type Check={name:string;ok:boolean|'warn';note:string};
const legal={...hotelDetection.items,...clubDetection.items} as Record<string,{label?:string;allowedFor?:string[]}>;
const placed=new Set([...hotelDetection.worldItems,...clubDetection.worldItems].map(w=>w.item));
function checkItem(id:string):Check[]{
 const info=ITEM_INFO.find(i=>i.id===id)!,out:Check[]=[],m=itemModel(id);
 out.push({name:'モデル読込',ok:!!m,note:m?'GLB を読めた':'読めない'});if(!m)return out;
 m.updateMatrixWorld(true);
 const grip=m.getObjectByName('GRIP_R'),g=grip?grip.getWorldPosition(new T.Vector3()):null;
 out.push({name:'握る点',ok:!!g&&g.length()<.001,note:g?`原点から ${(g.length()*1000).toFixed(1)}mm`:'GRIP_R が無い'});
 const b=new T.Box3();m.traverse(o=>{if((o as T.Mesh).isMesh)b.expandByObject(o);});const s=b.getSize(new T.Vector3());
 const d=Math.max(Math.abs(s.x-info.size_m[0]),Math.abs(s.y-info.size_m[1]),Math.abs(s.z-info.size_m[2]));
 out.push({name:'大きさ',ok:d<.005,note:`${s.x.toFixed(3)}×${s.y.toFixed(3)}×${s.z.toFixed(3)} m（作成時との差 ${(d*1000).toFixed(1)}mm）`});
 out.push({name:'三角形',ok:info.triangles<=300,note:`${info.triangles}（上限300）`});
 const f=onFloorCheck(id);out.push({name:'床に置く',ok:Math.abs(f)<.005,note:`いちばん低い所 ${(f*1000).toFixed(1)}mm`});
 for(const [pid,label] of POSES.map(p=>[p[0],p[1]])){const low=handCheck(id,pid);out.push({name:`手（${label}）`,ok:low===null?false:low>.01?true:'warn',note:low===null?'手が無い':`いちばん低い所 床から ${(low*100).toFixed(0)}cm${low<=.01?' · 床に触れる':''}`});}
 const known=!!legal[id];
 out.push({name:'持ち物の決まり',ok:known?true:'warn',note:known?`${legal[id].label??id} · 持ってよい服：${(legal[id].allowedFor??[]).join('、')||'決まりなし（どの服でも普通）'}`:'detection.json の items に無い（まだゲームで使っていない）'});
 out.push({name:'マップに置かれているか',ok:placed.has(id)?true:'warn',note:placed.has(id)?'置かれている':'どのマップにも置かれていない'});
 return out;
}
function onFloorCheck(id:string){const o=floorItem(id);o.updateMatrixWorld(true);return new T.Box3().setFromObject(o).min.y;}
// The lowest point of the item in the agent's hand over a full cycle of the pose (null without the agent).
function handCheck(id:string,pose:string){
 if(!agent)return null;const hand=agent.rig.joints.get('handr')?.bone,m=itemModel(id);if(!hand||!m)return null;
 const o=inHand(hand,m,id),loco=new Locomotion(),[, ,speed,crouch]=POSES.find(p=>p[0]===pose)!;let low=Infinity;
 for(let i=0;i<120;i++){const p=loco.update(1/60,{speed,crouch,slope:0,turn:0,distance:speed/60});agent.rig.apply(holdPose(structuredClone(p),holdKind(id)));agent.group.updateMatrixWorld(true);if(i>=60)low=Math.min(low,new T.Box3().setFromObject(o).min.y);}
 o.removeFromParent();return low;
}
const results=new Map<string,Check[]>();
const verdict=(c:Check[])=>c.some(x=>x.ok===false)?'fail':c.some(x=>x.ok==='warn')?'warn':'pass';
function renderList(){
 const t=$('#list');t.replaceChildren();
 for(const info of ITEM_INFO){const tr=document.createElement('tr'),c=results.get(info.id),v=c?verdict(c):'';tr.className=info.id===current?'on':'';
  tr.innerHTML=`<td class="${v}">${v==='pass'?'✓':v==='fail'?'✗':v==='warn'?'!':'・'}</td><td>${info.label}</td><td>${KIND_LABEL[info.kind]}</td><td>${info.triangles}△</td>`;tr.onclick=()=>{show(info.id);renderList();};t.append(tr);}
 const all=[...results.values()];$('#summary').textContent=all.length?`合格 ${all.filter(c=>verdict(c)==='pass').length} · 注意 ${all.filter(c=>verdict(c)==='warn').length} · 不合格 ${all.filter(c=>verdict(c)==='fail').length}（全 ${all.length}）`:'物を選ぶと手・床・単体で表示します。';
}
function render(){
 const info=ITEM_INFO.find(i=>i.id===current)!,c=results.get(current);
 $('#detail').textContent=`${info.label}（${info.id}） · ${KIND_LABEL[info.kind]}\n大きさ ${info.size_m.join(' × ')} m · 三角形 ${info.triangles}\n赤い点：握る点（GRIP_R）　青い点：先端（TIP）\n\n`+(c?c.map(x=>`${x.ok===true?'✓':x.ok==='warn'?'!':'✗'} ${x.name}：${x.note}`).join('\n'):'「すべて自動判定」で確かめます。');
}
$('#check').onclick=()=>{for(const i of ITEM_INFO)results.set(i.id,checkItem(i.id));show(current);renderList();};

// --- loop: the agent plays the chosen pose holding the item
let last=performance.now();
function frame(now:number){const dt=Math.min(.1,(now-last)/1000);last=now;
 if(agent&&!$<HTMLInputElement>('#pause').checked){const [, ,speed,crouch]=POSES.find(p=>p[0]===$<HTMLSelectElement>('#pose').value)!;const p:Pose=agent.loco.update(dt,{speed,crouch,slope:0,turn:0,distance:speed*dt});agent.rig.apply(holdPose(structuredClone(p),holdKind(current)));}
 if(alone)alone.rotation.y+=dt*.6;
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}
await loadItemModels();
{const model=(await new GLTFLoader().parseAsync(Uint8Array.from(atob(PLAYER_BASE64),c=>c.charCodeAt(0)).buffer,'')).scene,group=new T.Group();group.add(model);scene.add(group);applyLook(model,loadLook());model.traverse(o=>{o.frustumCulled=false;});agent={group,model,rig:new Rig(model),loco:new Locomotion()};}
show(current);renderList();requestAnimationFrame(frame);
Object.assign(window,{__itemLab:{
 // Debug: the hand bone's local axes in world space (which way a held thing points), with the agent standing.
 handAxes:()=>{if(!agent)return null;const hand=agent.rig.joints.get('handr')!.bone;agent.group.updateMatrixWorld(true);const q=hand.getWorldQuaternion(new T.Quaternion()),f=(v:T.Vector3)=>v.applyQuaternion(q).toArray().map(n=>+n.toFixed(2));return {x:f(new T.Vector3(1,0,0)),y:f(new T.Vector3(0,1,0)),z:f(new T.Vector3(0,0,1)),at:hand.getWorldPosition(new T.Vector3()).toArray().map(n=>+n.toFixed(2)),scale:+hand.getWorldScale(new T.Vector3()).x.toFixed(4)};},
 heldTip:()=>{if(!held)return null;const t=held.getObjectByName('TIP'),g=held.getObjectByName('GRIP_R');return t&&g?{grip:g.getWorldPosition(new T.Vector3()).toArray().map(n=>+n.toFixed(2)),tip:t.getWorldPosition(new T.Vector3()).toArray().map(n=>+n.toFixed(2))}:null;},
check:()=>{$('#check').click();return Object.fromEntries([...results].map(([k,v])=>[k,{verdict:verdict(v),checks:v}]));}}});

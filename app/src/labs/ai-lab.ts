// AI Test Lab page (2026-11-04): the scenarios of labs/ai-scenarios.ts in 3D, each judged pass/fail automatically.
// It runs the same AI the maps run, so what passes here is how guards behave in the game.
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {STATE_COLOR} from '../npc-view';
import {ARENA,SCENARIOS,begin,tick,rules,run,DT,type Run,type Scenario} from './ai-scenarios';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<canvas id="lab-view"></canvas><aside id="lab-panel"><header><b>AI 実験ステージ</b><small>警備の視認・聴覚・無線・戦闘・捜索・救助・経路探索・立入禁止。実際のゲームと同じAIで動かし、自動で合否を出します。</small></header>
<div class="lab-row"><button id="all">すべて自動判定</button><label>速さ <select id="speed"><option value="1">×1</option><option value="2">×2</option><option value="4" selected>×4</option></select></label></div>
<div id="summary"></div><div id="list"></div><section id="detail"></section></aside>`;
const style=document.createElement('style');style.textContent=`
body{margin:0;background:#15171b;color:#e9e6dd;font:14px/1.5 system-ui,sans-serif;overflow:hidden}
#lab-view{position:fixed;inset:0 380px 0 0;width:calc(100vw - 380px);height:100vh;display:block}
#lab-panel{position:fixed;top:0;right:0;width:380px;height:100vh;overflow:auto;background:#1d2026;border-left:1px solid #333;padding:14px;box-sizing:border-box}
#lab-panel header b{font-size:17px;display:block}#lab-panel small{color:#a9a69d}
.lab-row{display:flex;gap:10px;align-items:center;margin:12px 0}button{background:#2c313a;color:#eee;border:1px solid #4a505b;border-radius:6px;padding:6px 10px;cursor:pointer}button:hover{background:#3a404b}
#all{background:#3b6b4f;border-color:#5a9a72}select{background:#2c313a;color:#eee;border:1px solid #4a505b;border-radius:4px}
.grp{margin-top:10px;color:#c9b27a;font-size:12px;letter-spacing:.08em}.sc{display:flex;gap:8px;align-items:center;width:100%;text-align:left;margin:3px 0}
.sc i{font-style:normal;width:18px;text-align:center}.sc.on{outline:2px solid #c9b27a}.pass{color:#6fd08c}.fail{color:#ff6b5e}.known{color:#f2c14e}
#detail{margin-top:12px;padding:10px;background:#15171b;border-radius:6px;min-height:80px;white-space:pre-wrap;font-size:13px}#summary{font-size:13px;color:#cfcac0}
@media (max-width:900px){#lab-view{inset:0 0 45vh 0;width:100vw;height:55vh}#lab-panel{top:55vh;width:100vw;height:45vh}}`;
document.head.append(style);
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;

// --- the arena
const canvas=$<HTMLCanvasElement>('#lab-view'),renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new T.Scene();scene.background=new T.Color('#202329');
const camera=new T.PerspectiveCamera(45,1,.1,200);camera.position.set(0,44,-20);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,0);controls.update();
scene.add(new T.HemisphereLight('#ffffff','#40444c',2.2));const sun=new T.DirectionalLight('#fff',1.4);sun.position.set(10,30,-10);scene.add(sun);
const zoneColor:Record<string,string>={public:'#3a4048',staff:'#5b4a2c'};
for(const z of [...ARENA.zones].reverse()){const m=new T.Mesh(new T.PlaneGeometry(z.maxX-z.minX,z.maxZ-z.minZ),new T.MeshStandardMaterial({color:zoneColor[z.type]??'#333'}));m.rotation.x=-Math.PI/2;m.position.set((z.minX+z.maxX)/2,z.type==='staff'?.005:0,(z.minZ+z.maxZ)/2);scene.add(m);}
const wallMat=new T.MeshStandardMaterial({color:'#b9b2a2'});
for(const w of ARENA.walls){const m=new T.Mesh(new T.BoxGeometry(w.w,w.id.startsWith('outer')?.6:w.h,w.d),wallMat);m.position.set(w.x,(w.id.startsWith('outer')?.6:w.h)/2,w.z);scene.add(m);}
scene.add(new T.GridHelper(40,40,'#2e333b','#2e333b'));
// Labels painted on the floor.
function label(text:string,x:number,z:number){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d')!;g.fillStyle='rgba(255,255,255,.55)';g.font='bold 34px sans-serif';g.textAlign='center';g.fillText(text,128,44);const m=new T.Mesh(new T.PlaneGeometry(4,1),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.rotation.z=Math.PI;m.position.set(x,.02,z);scene.add(m);}
label('ホール',-12,12);label('職員室',13,-13.5);label('迷路',13,13.5);label('衝立',-6,4.8);

// --- people
const visionRange=rules.vision.guard.range,half=rules.vision.guard.half*Math.PI/180;
type Body={root:T.Group;figure:T.Group;mat:T.MeshStandardMaterial;cone:T.Mesh;tag:T.Sprite;tagCtx:CanvasRenderingContext2D;tagTex:T.CanvasTexture};
const bodies=new Map<string,Body>();
function body(id:string):Body{let b=bodies.get(id);if(b)return b;
 const root=new T.Group(),figure=new T.Group(),mat=new T.MeshStandardMaterial({color:'#efeadf'});
 root.add(figure);
 const capsule=new T.Mesh(new T.CapsuleGeometry(.28,1.1,4,10),mat);capsule.position.y=.83;figure.add(capsule);
 const nose=new T.Mesh(new T.BoxGeometry(.12,.12,.35),new T.MeshStandardMaterial({color:'#222'}));nose.position.set(0,1.5,.3);figure.add(nose);
 const cone=new T.Mesh(new T.CircleGeometry(visionRange,32,Math.PI*1.5-half,half*2),new T.MeshBasicMaterial({color:'#f2e6b0',transparent:true,opacity:.12,depthWrite:false,side:T.DoubleSide}));cone.rotation.x=-Math.PI/2;cone.position.y=.03;root.add(cone);
 const c=document.createElement('canvas');c.width=256;c.height=64;const tagTex=new T.CanvasTexture(c);const tag=new T.Sprite(new T.SpriteMaterial({map:tagTex,depthTest:false}));tag.scale.set(3,.75,1);tag.position.y=2.4;root.add(tag);
 scene.add(root);b={root,figure,mat,cone,tag,tagCtx:c.getContext('2d')!,tagTex};bodies.set(id,b);return b;}
const playerMesh=new T.Mesh(new T.CapsuleGeometry(.28,1.1,4,10),new T.MeshStandardMaterial({color:'#4f8cff'}));scene.add(playerMesh);
const marks:T.Mesh[]=[],doorLeaves:T.Mesh[]=[];
function clearMarks(){
 for(const m of marks.splice(0))m.removeFromParent();
 for(const m of doorLeaves.splice(0)){m.removeFromParent();m.geometry.dispose();}
}
function drawRun(r:Run){
 for(const [i,door] of (r.doors?.doors??[]).entries()){
  const d=door.def;
  if(!doorLeaves[i]){
   const mesh=new T.Mesh(new T.BoxGeometry(d.w,d.h,d.d),wallMat);
   mesh.position.set(d.x,d.y+d.h/2,d.z);scene.add(mesh);doorLeaves.push(mesh);
  }
  doorLeaves[i].visible=door.closed;
 }
 const live=new Set(r.director.npcs.map(n=>n.id));
 const rescues=r.m3?.rescue.playing??[];
 for(const [id,b] of bodies)b.root.visible=live.has(id);
 for(const n of r.director.npcs){const b=body(n.id);b.root.position.set(n.pos.x,n.pos.y,n.pos.z);b.root.rotation.y=n.heading;b.mat.color.set(STATE_COLOR[n.state]??'#efeadf');b.cone.visible=n.active;
  const down=n.life!=='active',rescuing=rescues.some(x=>x.guard===n),pickingUp=!!n.coinPickup;
  b.figure.rotation.x=down ? Math.PI/2 : rescuing||pickingUp ? .24 : 0;
  b.figure.position.set(0,down ? .28 : 0,down ? -.83 : 0);
  b.figure.scale.y=rescuing||pickingUp ? .72 : 1;
  b.tag.position.y=down ? .95 : 2.4;
  b.tag.scale.set(r.m3 ? 1.55 : 3,r.m3 ? .39 : .75,1);
  const status=r.m3
   ? (down?'気絶':rescuing?'救助中':r.outfit?.m4.isUndressed(n)?'着替えへ':n.state==='investigate'?'調査中':n.guard?'待機':'復帰')
   : pickingUp?'拾う':down?(n.life==='unconscious'?'気絶':'死亡'):`${n.state} ${Math.round(n.suspicion)}`;
  const g=b.tagCtx;g.clearRect(0,0,256,64);g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,0,256,64);g.fillStyle='#fff';g.font='26px sans-serif';g.textAlign='center';g.fillText(`${n.id} ${status}`,128,42);b.tagTex.needsUpdate=true;}
 playerMesh.position.set(r.player.x,r.player.y+.83,r.player.z);(playerMesh.material as T.MeshStandardMaterial).color.set(r.player.weaponDrawn?'#ff5a4a':'#4f8cff');playerMesh.visible=!r.player.hidden&&r.director.npcs.length!==0;
 while(marks.length<r.marks.length){const p=r.marks[marks.length],m=new T.Mesh(new T.CylinderGeometry(.18,.18,.06,12),new T.MeshBasicMaterial({color:'#ffd34d'}));m.position.set(p.x,.05,p.z);scene.add(m);marks.push(m);}
 if(r.coin)marks[0].visible=!!r.coin.mesh.parent;
}

// --- running
const results=new Map<string,{pass:boolean;detail:string}>();
let current:{s:Scenario;r:Run;over:boolean}|null=null;
function start(s:Scenario){clearMarks();const r=begin(s);current={s,r,over:s.seconds<=0};if(current.over)finish();renderList();showDetail();}
function finish(){if(!current)return;current.over=true;results.set(current.s.id,current.s.judge(current.r));renderList();showDetail();}
function verdict(s:Scenario){const v=results.get(s.id);if(!v)return {icon:'・',cls:''};if(v.pass)return {icon:'✓',cls:'pass'};return s.known?{icon:'!',cls:'known'}:{icon:'✗',cls:'fail'};}
function renderList(){
 const list=$('#list');list.replaceChildren();let group='';
 for(const s of SCENARIOS){if(s.group!==group){group=s.group;const h=document.createElement('div');h.className='grp';h.textContent=group;list.append(h);}
  const b=document.createElement('button'),v=verdict(s);b.className='sc'+(current?.s===s?' on':'');b.innerHTML=`<i class="${v.cls}">${v.icon}</i><span>${s.title}</span>`;b.onclick=()=>start(s);list.append(b);}
 const done=[...results.entries()],pass=done.filter(([,v])=>v.pass).length,known=done.filter(([id,v])=>!v.pass&&SCENARIOS.find(s=>s.id===id)?.known).length;
 $('#summary').textContent=done.length?`合格 ${pass} / ${done.length}${known?` · 既知の不具合 ${known}`:''}${done.length-pass-known?` · 不合格 ${done.length-pass-known}`:''}`:'シナリオを選ぶと3Dで再生します。';
}
function showDetail(){
 if(!current){$('#detail').textContent='';return;}
 const {s,r,over}=current,v=results.get(s.id);
 $('#detail').innerHTML='';const t=document.createElement('div');
 t.textContent=`【${s.group}】${s.title}\n期待：${s.expect}\n\n${over?(v?.pass?'✓ 合格':s.known?'! 既知の不具合':'✗ 不合格'):`再生中 ${r.time.toFixed(1)} / ${s.seconds}秒`}\n${over?v?.detail??'':r.log.slice(-6).join('\n')}${s.known&&over&&!v?.pass?`\n\n${s.known}`:''}`;
 $('#detail').append(t);
}
$('#all').onclick=()=>{for(const s of SCENARIOS)results.set(s.id,run(s));renderList();if(current)showDetail();};
const speed=$<HTMLSelectElement>('#speed');
let last=performance.now(),acc=0,lastDetail=0;
function frame(now:number){const dt=Math.min(.1,(now-last)/1000);last=now;
 if(current&&!current.over){acc+=dt*Number(speed.value);while(acc>=DT&&!current.over){acc-=DT;if(tick(current.s,current.r))finish();}if(now-lastDetail>200){lastDetail=now;showDetail();}}
 if(current)drawRun(current.r);
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}
renderList();requestAnimationFrame(frame);
Object.assign(window,{__aiLab:{results:()=>Object.fromEntries(results),runAll:()=>{$('#all').click();return Object.fromEntries(results);}}});

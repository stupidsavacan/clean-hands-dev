import {carriedPoints} from './carry-sight';
import * as T from 'three';
import {LandedCoinPickups} from './coin-pickup.ts';
import {coinMesh,renderHeldCoins} from './coin-pickup-pose.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import hotelData from './data/hotel.json';
import { PLAYER_BASE64 } from './player-data';
import { bodyScales, gaitStyleOf, heightScale, loadLook, saveLook, type Look } from './wardrobe';
import { applyLook } from './appearance';
import { openCreator } from './creator';
import { Hud, type HudMark, type HudState, type Perm } from './hud';
import { NPC_MODELS } from './npc-data';
import { CollisionWorld, bounds, floorAt, floorLabel, floorOf, inside, plateY, screenMovement, stairProgress, type Block, type Position, type Stair } from './world';
import { CROUCH_SPEED, Locomotion, RUN_SPEED, WALK_SPEED, type Pose } from './locomotion';
import { Rig } from './rig';
import rulesData from './data/rules.json';
import { Director, permission, zoneAt, type AiEvent, type Mission, type PlayerView, type Rules } from './ai';
import { NavGrid } from './nav';
import { sightBoxes } from './sight';
import { NpcView, STATE_COLOR } from './npc-view';
import { PITCH_LIMIT, SHOULDER, THIRD_DISTANCE, VIEW_LABEL, VIEW_ORDER, cameraMovement, cameraRight, lookDirection, type ViewMode } from './camera';
import { M3System, type HideDef } from './m3';
import { M3View } from './m3-view';
import {CHARACTER_MODELS} from './character-data';
import {M4System,type Checkpoint} from './m4';
import {M4View} from './m4-view';
import {MissionEvents} from './events';
import {MissionClock,ScheduleSystem} from './schedule';
import {DialogueSystem} from './dialogue';
import scheduleData from './data/schedule.json';
import dialogueData from './data/dialogue.json';
import {M53System,type M53Map} from './m53';
import {batchScenery} from './static-batches';
import {npcLayerVisible} from './npc-culling';
import {M53View} from './m53-view';
import {M57System,type M57Map} from './m57';
import {M57View} from './m57-view';
import chancesData from './data/chances.json';
import killsData from './data/kills.json';
import scoringData from './data/scoring.json';
import missionData from './data/mission.json';
import {ScoreLedger,computeResult,type MissionResult} from './score';
import {MissionFlow,FAIL_TEXT,venueText} from './mission';
import combatData from './data/combat.json';
import weaponsData from './data/weapons.json';
import {CombatSystem,type CombatRules,type WeaponDef} from './combat';
import {itemMaster} from './items';
import {CombatView} from './combat-view';
import {buildCover,coveredIds} from './cover-props';
import detectionData from './data/detection.json';
import {DetectionSystem,type Camera,type DetectionData} from './detection';
import {DetectionView} from './detection-view';
import {schedulePose} from './schedule-motion';
import {RestartHold} from './restart-hold';
// 2026-11-05: the gesture props and item models the shared NPC view and detection view use.
import {loadItemModels} from './item-models';
import './style.css';
const restartHold=new RestartHold(rulesData.controls.restartHoldSeconds);
// The M5 hotel (scripts/build-hotel.ts). JSON widens the stair direction to string, so it is narrowed here.
const map=hotelData as unknown as Omit<typeof hotelData,'stairs'>&{stairs:Stair[]};

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<canvas id="view" tabindex="0" aria-label="CLEAN HANDS ゲーム画面。WASDで移動"></canvas><canvas id="hud" aria-hidden="true"></canvas>
<div id="overlay"><span id="m3-status"></span><div id="m4-status" role="status"></div><nav class="top-actions"><button id="view-mode">視点 三人称 · V</button><button id="help">操作</button><button id="pause">一時停止 · Esc</button></nav><div id="aim"></div><div id="mission-clock" aria-label="ミッション時計"></div><div id="chance-hud"></div><div id="field-status"></div><div id="combat-status" role="status"></div><div id="gun-reticle" aria-hidden="true"><i></i><b></b></div><div id="rec-status" role="status"></div><div id="dialogue-subtitle" role="status" aria-live="polite"></div>
<details id="debug"><summary>練習・動作記録</summary><button id="m4-training">M4 変装・検査の練習</button><button id="m3-training">M3 背後アクション練習</button><button id="m3-discover">練習：発見者を向かせる</button><button id="m3-normal">通常ミッションへ</button><a class="motion-link" href="./motions/index.html" target="_blank">モーションを見る ↗</a><button id="guide">M1 案内ルートを歩く</button><label>時間 <select id="time-rate"><option value="1">×1</option><option value="4">×4</option></select></label><label>指定の分 <input id="time-minute" type="number" min="0" max="180" step="1" value="0"></label><button id="time-jump">指定時刻へ</button><pre id="schedule-status"></pre><pre id="metrics">読み込み中</pre><pre id="qa-result">案内ルートはカメラ・透過・階切替の確認にも使えます。</pre></details>
<div id="pause-modal" class="modal" role="dialog" aria-modal="true" aria-label="一時停止"><section class="dialog"><div class="eyebrow">PAUSED</div><h2>少し、作戦を練る。</h2><p>ホテルと屋外で約120人が動いています。Fで気絶、Xで排除、Eで運搬・収納。Tで着替え、Bで検査、Hでワイヤーを置く・回収。</p><footer><button id="to-prep">準備画面へ</button><button id="change-look">姿を変える</button><button id="reset">最初からやり直す</button><button id="resume">続ける · Esc</button></footer></section></div>
<div id="help-modal" class="modal" role="dialog" aria-modal="true" aria-label="操作方法"><section class="dialog"><div class="eyebrow">FIELD NOTES</div><h2>見られなければ、何もなかったのと同じ。</h2><p>目的：ターゲット3人（ワイン商・元顧問弁護士・若き投資家）を排除し、出口（E1〜E5）から脱出する。脱出すると点数とランクが出る。見つからず、死体も見つからず、ターゲット以外を倒さなければゴースト。バーか搬入口で会話を最初から最後まで聞き、チャンスを発見する。ソムリエは５分に桟橋へ到着。Tで服を奪い、Jで給仕長に挨拶するとセラーの鍵をもらえる。１９〜２４分の試飲会でEを長押しして毒入りの一杯を出すか、Jでセラー奥へ誘ってXで排除する。別ルートでは、スタッフの服で１９分までに限定ワインの樽へ毒を仕込む。致死毒は１回分。Tabで追跡するチャンスを選ぶ。高所の縁では背後からP長押しで突き落とせる。</p><p>スーツ姿で裏通路にいるところを見られると疑惑が上がり（近いほど速い）、30%で立ち止まって振り向き、60%で確かめに来て、100%で警戒・追跡されます。捕まると失敗。走る（+15/秒）、公共の場でしゃがむ（+5/秒）、細工する（+20/秒）も怪しまれます。視界から外れると毎秒10%ずつ下がり、招待客3人以上の輪の中では上がり方が0.4倍、物陰で一部しか見えない・立ち止まると半分。Gで前方にコインを投げると、近くの1人が音を確かめに行きます（3枚）。</p><p>画面をクリックするとマウスで視点を動かせます（Escで解除して一時停止）。WASDはカメラの向きが基準で、Wで見ている方向へ直進、Aで左、Dで右。歩きながらマウスを動かすと進行方向も曲がります。Shiftを押す間は走り、Cでしゃがみ。</p><p>Vで視点を切り替えます：三人称（肩越し）→ 一人称（実験）→ 俯瞰（旧・固定45°）。三人称ではカメラが壁に当たると手前に寄ります。ズームはZまたは右下の3段階。</p><p>M4：Tを長押しで倒れた人や置いた服から着替えます。Bを長押しで身体検査（ロビーの大階段の手前と、港湾事務所のマリーナ入口）。ワイヤーは検査で見つかりません（Hで置く・回収もできます）。白い印の人はその服の顔を知っていて、正面の近くにいると見破られ、服がバレます。バレた服は着替えて見られずに30m離れると解除されます。</p><p>M3：背後へ1.1m以内に近づき、Fを長押しで気絶、Xを長押しでワイヤー排除（致死）。Eで身体を運ぶ・置く、ロッカーの前でEを長押しすると収納。運搬や犯行を見られると即警戒。身体だけの発見では犯人は特定されません。左上の「練習・動作記録」から安全に練習できます。</p><p>M5.5 銃：Qで銃を出す／しまう（長押しで銃を捨てる。手に何もなければ、しまったまま長物から捨てる）。左クリックかスペースで撃つ、Rで弾を込める、倒れた警備のそばに落ちた銃はEで拾う。銃を出した姿を見られると警備は撃ってきて、客は逃げる。消音ピストルで見られずに一撃で仕留めれば撃ち合いにはならない。通常の銃声で警戒度2になり、撃ち合いが${combatData.alert3After}秒続くと警戒度3（出口E1・E2が閉じる・増援）になる。体力は最後に撃たれてから10秒で回復を始める。撃ち合いで見られた服はバレた服になるので、視界を切って逃げ、見られずに着替えて30m離れれば潜入に戻れる。</p><p>M5.6 見つかる仕組み：客やスタッフが犯行や死体を見ると頭上に赤い「！」が出て、いちばん近い警備員へ知らせに走る（着く前に気絶させれば通報されない。警備員が見たら無線で即通報）。床の青い扇形は監視カメラの視界で、違法行為・立入禁止区域・身体の運搬が映ると「記録あり」になり、警備室の監視員がモニターの前にいれば通報される。記録は警備室の録画機でE長押し（スタッフの服なら静かに消す、それ以外は壊すので音が出る）。カメラは撃つと壊れる。記録を残したまま脱出すると−2,000点でゴーストにならない。スパナ・ワインボトル・モップ・カメラは疑わしい物で、決まった服なら持っていてよい（Eで拾う、Uで置く）。光る輪の場所でEを押すと、その服の仕事をして溶け込む（疑われず、顔を知っている人も2m以内でないと見破れない。Eか移動でやめる）。</p><p>M5.7 チャンス14件：会話を聞くと右上で追える。仕掛けはE長押し（配電盤・クレーン・シャンデリアの留め具・ガス管・手すり・避難ボートの燃料・花火の筒・非常ベル）。作動の瞬間を人かカメラに見られなければ事故。仕掛けは範囲内の全員を巻き込む。警戒度2でターゲットは安全な部屋へ、3で避難し、車やボートに乗り込まれたら失敗。</p><p>右下の「動作記録」に、M1の案内ルート（自動確認）があります。</p><footer><button id="close-help">始める</button></footer></section></div>
<div id="map-modal" class="modal" role="dialog" aria-modal="true" aria-label="マップ"><section class="dialog map-dialog"><nav><span><b>GRAND MARINA</b> · 区画図</span><button data-map-floor="-1">B1</button><button data-map-floor="0" class="active">1F</button><button data-map-floor="1">2F</button><button data-map-floor="2">RF</button><button id="close-map">閉じる · Tab</button></nav><div id="chance-list"></div><div id="target-schedules"></div><canvas id="big-map" width="1200" height="800" aria-label="ホテル全体図"></canvas><p>▲ 現在位置　● 警備員（扇形は視線の向き）　・ 招待客　○ 出口E1〜E5（ターゲットを倒すと開く）　■ 検問　▪ 監視カメラ　黄：スタッフ　赤：厳重　灰：外周</p></section></div>
<div id="result-modal" class="modal" role="dialog" aria-modal="true" aria-label="結果"><section class="dialog result"><div class="eyebrow" id="result-eyebrow">RESULT</div><div class="result-head"><h2 id="result-title"></h2><div id="result-rank" aria-label="ランク"></div></div><p id="result-text"></p><table id="result-lines"></table><dl id="result-stats"></dl><footer><button id="result-prep">準備画面へ</button><button id="retry">同じ準備でもう一度 · R</button></footer></section></div>
<div id="prep-modal" class="modal" role="dialog" aria-modal="true" aria-label="準備"><section class="dialog prep"><div class="eyebrow">BRIEFING · M5.4</div><h2 id="prep-title"></h2><div id="prep-targets"></div><div class="prep-cols"><div><h3>持ち込み道具</h3><div id="prep-tools"></div><h3>拳銃</h3><div id="prep-pistol"></div></div><div><h3>開始地点</h3><div id="prep-starts"></div><p id="prep-agent"></p></div></div><footer><button id="prep-look">姿を変える</button><button id="prep-go">作戦開始</button></footer></section></div></div>
<div id="load"><div><small>M5.4 · 最後の一杯</small><strong>CLEAN HANDS</strong><p id="load-text">グランド・マリーナ・ホテルを準備しています。</p><progress></progress></div></div>`;
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;
const canvas=$<HTMLCanvasElement>('#view');
let renderer:T.WebGLRenderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});}catch(e){$('#load-text').textContent='WebGLの初期化に失敗しました。ブラウザのハードウェアアクセラレーションを確認してください。';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new T.Scene();scene.background=new T.Color('#93b4ad');scene.fog=new T.Fog('#93b4ad',70,140);
const camera=new T.PerspectiveCamera(30,1,.1,150);
const hemi=new T.HemisphereLight('#fff3d9','#677c68',2.5);scene.add(hemi);
const sun=new T.DirectionalLight('#ffe1ad',3.0);sun.position.set(-12,23,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;sun.shadow.normalBias=.045;sun.shadow.bias=-.0002;scene.add(sun);
// One group per floor (B1, 1F with everything outdoors, 2F, RF); in the overhead view floors above the agent are hidden.
const floorGroups=new Map<number,T.Group>([-1,0,1,2].map(f=>{const g=new T.Group();g.name=`FLOOR_${floorLabel(f)}`;scene.add(g);return [f,g];}));
const group=(floor:number)=>floorGroups.get(floor)??scene;
const mats=new Map<string,T.MeshStandardMaterial>();
function material(color:string){if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.93,flatShading:true}));return mats.get(color)!;}
const occluders:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]=[];
// A mesh the camera ray can fade (walls, roofs, palms, the watchtower, sails) gets its own transparent material.
function fadeable(ob:T.Mesh,floor:number){const m=(ob.material as T.MeshStandardMaterial).clone();m.transparent=true;m.opacity=1;ob.material=m;occluders.push(ob as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>);ob.userData.fadeFloor=floor;}
function box(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,parent:T.Object3D=scene,fade=false){const ob=new T.Mesh(new T.BoxGeometry(w,h,d),material(color));ob.name=name;ob.position.set(x,y+h/2,z);ob.castShadow=true;ob.receiveShadow=true;parent.add(ob);if(fade)fadeable(ob,[...floorGroups].find(([,g])=>g===parent)?.[0]??0);return ob;}
function cylinder(name:string,a:T.Vector3,b:T.Vector3,r:number,color:string,parent:T.Object3D=scene){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,a.distanceTo(b),6),material(color));mesh.name=name;mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());mesh.castShadow=true;parent.add(mesh);return mesh;}
type Area={minX:number;maxX:number;minZ:number;maxZ:number};
const centre=(r:Area)=>({x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2,w:r.maxX-r.minX,d:r.maxZ-r.minZ});
function cut(r:Area,holes:Area[]):Area[]{let parts=[r];for(const h of holes){const next:Area[]=[];for(const p of parts){if(h.minX>=p.maxX||h.maxX<=p.minX||h.minZ>=p.maxZ||h.maxZ<=p.minZ){next.push(p);continue;}const z0=Math.max(p.minZ,h.minZ),z1=Math.min(p.maxZ,h.maxZ);
 if(h.minZ>p.minZ)next.push({...p,maxZ:h.minZ});if(h.maxZ<p.maxZ)next.push({...p,minZ:h.maxZ});if(h.minX>p.minX)next.push({minX:p.minX,maxX:h.minX,minZ:z0,maxZ:z1});if(h.maxX<p.maxX)next.push({minX:h.maxX,maxX:p.maxX,minZ:z0,maxZ:z1});}parts=next;}return parts;}
const SURFACE:Record<string,string>={asphalt:'#86887f',paving:'#c9c8af',grass:'#8fa77e',sand:'#e3d3a6',poolstone:'#e8e0cc',wood:'#b59b78',marble:'#dfd8c6',tile:'#d2d4ca',service:'#bbbd9e',carpet:'#a07a6c',stone:'#8f8a7e'};
// Ground: one slab per section, open where the sea, the pool basin and the cellar stairs are.
const groundHoles=[...map.water,map.pool,...map.stairs.filter(s=>s.low<0)];
for(const s of map.sections)for(const r of cut(s,groundHoles)){const c=centre(r);box('NAV_ground',c.x,-.5,c.z,c.w,.5,c.d,SURFACE[s.surface]??'#c9c8af');}
box('road',-1.5,-.5,-42,129,.5,9.2,'#55575a');// The sea lies only south of the shore, so nothing shows through under the land (the cellar looks up at the ground slab).
box('sea',-1.5,-.64,(map.ground.maxZ+120)/2-8,260,.06,120-map.ground.maxZ+16,'#4f9da7');
for(const r of map.rooms.filter(r=>r.floor===0))for(const p of cut(r,groundHoles)){const c=centre(p);box('floor-'+r.id,c.x,.004,c.z,c.w,.012,c.d,SURFACE[r.surface]??'#ddd');}
// Floor plates: 2F and RF slabs (their undersides are the ceilings below) and the cellar floor.
for(const f of map.floors)for(const a of f.areas){const c=centre(a),room=map.rooms.find(r=>r.floor===f.floor&&c.x>=r.minX&&c.x<=r.maxX&&c.z>=r.minZ&&c.z<=r.maxZ);box('NAV_plate',c.x,f.y-.5,c.z,c.w,.5,c.d,SURFACE[room?.surface??'paving']??'#ddd3ba',group(f.floor));}
// Pool: a recessed basin ringed with stone.
{const p=centre(map.pool);box('pool-basin',p.x,-.58,p.z,p.w,.08,p.d,'#d2e5db');box('pool-water',p.x,-.14,p.z,p.w-.4,.04,p.d-.4,'#4fb8c9');
 for(const [x,z,w,d] of [[p.x-p.w/2-.6,p.z,1.2,p.d+2.4],[p.x+p.w/2+.6,p.z,1.2,p.d+2.4],[p.x,p.z-p.d/2-.6,p.w,1.2],[p.x,p.z+p.d/2+.6,p.w,1.2]])box('pool-stone',x,.005,z,w,.025,d,'#efeadf');}
for(const wall of map.walls){const rail=wall.id.includes('rail');box(rail?'rail-'+wall.id:'FADE_'+wall.id,wall.x,wall.y,wall.z,wall.w,wall.h,wall.d,rail?'#718b7c':wall.floor>0?'#d6cdb4':wall.floor<0?'#a69a86':'#e4dcc8',group(wall.floor??0),!rail);}
// Stairs: 32 treads per flight, solid underneath, built along the direction of climb.
const STAIR_STEPS=32;
for(const s of map.stairs){const geos:T.BufferGeometry[]=[],along=s.rise==='-z'||s.rise==='+z',len=(along?s.maxZ-s.minZ:s.maxX-s.minX)/STAIR_STEPS;
 for(let i=0;i<STAIR_STEPS;i++){const h=(i+1)*(s.high-s.low)/STAIR_STEPS,g=new T.BoxGeometry(along?s.maxX-s.minX:len,h,along?len:s.maxZ-s.minZ);const k=(i+.5)*len;
  const x=s.rise==='+x'?s.minX+k:s.rise==='-x'?s.maxX-k:(s.minX+s.maxX)/2,z=s.rise==='+z'?s.minZ+k:s.rise==='-z'?s.maxZ-k:(s.minZ+s.maxZ)/2;g.translate(x,s.low+h/2,z);geos.push(g);}
 const steps=new T.Mesh(mergeGeometries(geos),material(s.low<0?'#9b9585':'#bcbca5'));steps.name='stair-steps';steps.castShadow=true;steps.receiveShadow=true;group(s.low<0?0:s.floor??0).add(steps);geos.forEach(g=>g.dispose());}
// Props by id prefix. Water, the pool fence, lockers and the panel are drawn elsewhere.
const PROP:[string,string][]=[['car','#5d6b78'],['truck','#d8d4c8'],['crate','#a2835c'],['counter','#8b9c88'],['stove','#7b8783'],['machine','#d9dcd6'],['rack','#6f7c86'],['sofa','#7a5a4f'],['planter','#b8b698'],['table','#efeadf'],['shelf','#6b5644'],['desk','#5d5f5a'],['backdrop','#c46a4f'],['tower','#d7cbb0'],['hut','#c9b48c'],['tank','#c74d3a'],['yacht','#f4f1ea'],['stage','#6d4c3d'],['cart','#9fb0b8'],['bed','#e4ddd0'],['massage','#e4ddd0'],['stairhouse','#cfc8b8'],['barrel','#7a4f33']];
// Cars, crates, planters and counters are drawn by their M5.5 models once those load (buildCover); only the rest are boxes.
const coverIds=coveredIds(map.blockers as Block[]);
for(const b of map.blockers){if(b.id==='pool'||b.id.startsWith('water')||b.id==='powerpanel'||b.id.startsWith('locker-')||coverIds.has(b.id))continue;const color=PROP.find(([k])=>b.id.startsWith(k))?.[1]??'#8b9c88',parent=group(b.floor??0);
 const ob=box('COL_'+b.id,b.x,b.y,b.z,b.w,b.h,b.d,color,parent,b.id.startsWith('tower')||b.id.startsWith('stairhouse'));
 if(b.id.startsWith('planter'))box('hedge',b.x,b.y+b.h,b.z,b.w*.9,.65,b.d*.94,'#6c8976',parent);
 if(b.id.startsWith('car'))box('car-cabin',b.x,b.y+b.h,b.z,b.w*.86,.55,b.d*.86,'#2f3a44',parent);
 if(b.id.startsWith('yacht')){cylinder('yacht-mast',new T.Vector3(b.x-2,b.y+b.h,b.z),new T.Vector3(b.x-2,b.y+b.h+9,b.z),.08,'#bdb7a8',parent);const sail=new T.Mesh(new T.ConeGeometry(2.6,8,3),material('#fbf8f0'));sail.position.set(b.x+.6,b.y+b.h+4.6,b.z);sail.scale.set(1,1,.08);sail.castShadow=true;parent.add(sail);fadeable(sail,0);}
 void ob;}
// Palms (they fade like walls when they stand between the camera and the agent).
for(const [x,z] of map.palms){const trunk=cylinder('palm-trunk',new T.Vector3(x,0,z),new T.Vector3(x+.35,4.2,z),.14,'#98836a');fadeable(trunk,0);for(let j=0;j<6;j++){const a=j*Math.PI/3;const g=new T.ConeGeometry(.65,2.7,3);g.rotateZ(Math.PI*.45);const m=new T.Mesh(g,material('#6d8c70'));m.rotation.y=a;m.position.set(x+.35+Math.cos(a)*.7,4.2,z+Math.sin(a)*.7);m.castShadow=true;scene.add(m);fadeable(m,0);}}
// Deck chairs and parasols at the pool, the terrace and the beach (scenery only).
for(const [x,z] of [[-7.5,11],[-7.5,13],[11,11],[11,13],[50,-33],[53,-33],[56,-33],[50,0],[53,0],[56,0]]){box('deckchair',x,0,z,.7,.18,1.6,'#d7cbb0');const back=box('deckchair-back',x,.18,z-.55,.7,.65,.12,'#efeadf');back.rotation.x=-.35;}
for(const [x,z] of [[23,9],[35,9],[52,-29],[55,3]]){cylinder('umbrella-stem',new T.Vector3(x,0,z),new T.Vector3(x,2.4,z),.04,'#8b8d73');const u=new T.Mesh(new T.ConeGeometry(1.6,.5,8),material('#c6caaa'));u.position.set(x,2.4,z);u.castShadow=true;scene.add(u);}
const pp=map.blockers.find(b=>b.id==='powerpanel')!;box('powerpanel',pp.x,0,pp.z,pp.w,pp.h,pp.d,'#7b8783');box('powerpanel-door',pp.x+pp.w/2+.01,.25,pp.z,.03,1.2,pp.d*.86,'#93a09b');box('powerpanel-stripe',pp.x+pp.w/2+.03,1.5,pp.z,.02,.08,pp.d*.86,'#e2b93b');
const panelLamp=new T.Mesh(new T.BoxGeometry(.03,.07,.07),new T.MeshStandardMaterial({color:'#3fdc8c',emissive:'#3fdc8c',emissiveIntensity:1.6}));panelLamp.position.set(pp.x+pp.w/2+.035,1.32,pp.z-.3);scene.add(panelLamp);
// Exits E1-E5: a frame and a ring that lights once the panel is done.
const exitRings=map.exits.map(e=>{const y=plateY(map,e.floor),parent=group(e.floor);for(const dx of [-1.35,1.35])box('exit-post',e.x+dx,y,e.z,.18,2.3,.18,'#8a7a62',parent);box('exit-beam',e.x,y+2.3,e.z,2.9,.16,.2,'#8a7a62',parent);
 const ring=new T.Mesh(new T.RingGeometry(e.radius-.12,e.radius,40),new T.MeshBasicMaterial({color:'#9fe0c8',transparent:true,opacity:0,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(e.x,y+.03,e.z);parent.add(ring);return ring;});
// Security cameras (CAM_): a small housing on the wall, turned toward what it watches.
for(const c of map.cameras){const cam=new T.Group();cam.position.set(c.x,c.y,c.z);cam.rotation.y=c.heading;const body=new T.Mesh(new T.BoxGeometry(.22,.18,.38),material('#2c3034'));body.position.z=.12;body.rotation.x=.35;const lens=new T.Mesh(new T.CylinderGeometry(.05,.05,.04,10),new T.MeshStandardMaterial({color:'#1b4d6b',emissive:'#1b4d6b',emissiveIntensity:.6}));lens.rotation.x=Math.PI/2;lens.position.set(0,-.06,.32);cam.add(body,lens);cam.name=c.id;group(c.floor).add(cam);}
const navLabels:{text:string;x:number;y:number;z:number;floor:number}[]=[...map.labels,...map.exits.map(e=>({text:`${e.id} ${e.label}`,x:e.x,y:plateY(map,e.floor)+2.7,z:e.z,floor:e.floor}))];
// Static meshes belong to the map sections they overlap; a section outside the view frustum is skipped as a whole.
const sections=(map.sections??[]).map(s=>({id:s.id,box:new T.Box3(new T.Vector3(s.minX,-5,s.minZ),new T.Vector3(s.maxX,12,s.maxZ)),seen:true}));
let sectionMeshes:{mesh:T.Object3D;in:number[]}[]=[];{scene.updateMatrixWorld(true);const b=new T.Box3();scene.traverse(o=>{if(!(o as T.Mesh).isMesh)return;b.setFromObject(o);const hit=sections.flatMap((s,i)=>s.box.intersectsBox(b)?[i]:[]);if(hit.length&&hit.length<sections.length)sectionMeshes.push({mesh:o,in:hit});});}
sectionMeshes=batchScenery(sectionMeshes,new Set(mats.values()));
// Everything built so far is static: compute its matrices once instead of every frame.
scene.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});scene.matrixAutoUpdate=true;sun.matrixAutoUpdate=true;sun.target.matrixAutoUpdate=true;
const frustum=new T.Frustum(),viewProjection=new T.Matrix4(),npcSphere=new T.Sphere(new T.Vector3(),1.3),npcShadowSphere=new T.Sphere(new T.Vector3(),rulesData.render.npcShadowCullRadius);
function cullSections(){camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
 for(const s of sections)s.seen=frustum.intersectsBox(s.box)&&s.box.distanceToPoint(camera.position)<camera.far;for(const m of sectionMeshes)m.mesh.visible=m.in.some(i=>sections[i].seen);}
const hud=new Hud($<HTMLCanvasElement>('#hud'),map);let agentLook:Look=loadLook(),creatorOpen=true,toastText='',toastAt=-1e9,lastNow=0;const hudState={} as HudState;let playerScene:T.Object3D|undefined,creatorTemplate:T.Object3D|undefined;const characterTemplates=new Map<string,T.Object3D>(),npcTemplates=new Map<string,T.Object3D>();

// Dev aid: ?spawn=x,z starts the agent elsewhere (used to check stairs and corners).
const spawnParam=new URLSearchParams(location.search).get('spawn')?.split(',').map(Number);if(spawnParam?.length===2&&spawnParam.every(Number.isFinite))map.spawn={x:spawnParam[0],z:spawnParam[1]};
const hides=map.hides as HideDef[];
const world=new CollisionWorld(map);const mission=map as unknown as Mission,rules=rulesData as Rules,nav=new NavGrid(world),boxes=sightBoxes(map);let director=new Director(mission,world,nav,boxes,rules);
let events=new MissionEvents(),clock=new MissionClock(rulesData.schedule,events),schedule=new ScheduleSystem(scheduleData,map.schedulePlaces,director,clock,events),dialogue=new DialogueSystem(dialogueData,map.schedulePlaces,director,clock,rulesData.dialogue,events);
let lastAlert=0;
let m3=new M3System(director,hides,rulesData.m3);const m3View=new M3View(scene);let m4=new M4System(director,map.checkpoints as Checkpoint[],rulesData.m4,hides);const m4View=new M4View(scene);let training=false,m4Training=false,enteredStaff=false;
let m53=new M53System(director,m3,m4,clock,events,rulesData.m53,map.m53 as M53Map,map.cameras,chancesData);const m53View=new M53View(scene,m53);
const newM57=()=>{const s=new M57System(director,m3,m4,m53,clock,events,map.m57 as M57Map,map.cameras);s.held_item=()=>detection.held;s.illegal=()=>combat.illegalIn(m4.disguise);return s;};let m57=newM57();const m57View=new M57View(scene,map.m57 as M57Map,group);
// The mission flow and the score ledger are rebuilt with every mission; the loadout is what the briefing chose.
type Loadout={tools:string[];pistol:string;start:string};let loadout:Loadout={tools:missionData.tools.map(t=>t.id),pistol:'',start:'S1'},prepOpen=false;
let flow=new MissionFlow(missionData.targets,director,events),ledger=new ScoreLedger(events,()=>undefined),lastResult:MissionResult|null=null;
const combatRules=combatData as unknown as CombatRules,weaponDefs=weaponsData as unknown as Record<string,WeaponDef>;
const detData=detectionData as unknown as DetectionData;let detection=new DetectionSystem(director,events,m3.hotel,map.cameras as Camera[],detData,map);const itemTable=itemMaster(weaponDefs,detData.items,rulesData.m4.items);detection.items=itemTable;m4.items=itemTable;const detectionView=new DetectionView(scene,detection,map,group);
let combat=new CombatSystem(director,events,m3.hotel,combatRules,weaponDefs,map.reinforcements).stock(),wasFighting=false,qDown=-1,fireHeld=false,firePressed=false;const combatView=new CombatView(scene);combat.items=itemTable;
if(killsData.wine_barrel.object!==map.m53.barrel.object||!map.blockers.some(b=>b.id===killsData.wine_barrel.object))throw new Error('仕掛けの参照がありません');
let npcViews:NpcView[]=[],panelProgress=0,panelDone=false,coins=rules.noise.coins,tampering=false,missionOver:''|'win'|'caught'='',missionTime=0,peakSuspicion=0;
const coinPickups=new LandedCoinPickups();
const coinsInFlight:{mesh:T.Mesh;from:T.Vector3;to:T.Vector3;t:number}[]=[],landedCoins:T.Mesh[]=[],ripples:T.Mesh[]=[];let position:Position={...map.spawn,y:0},previous={...position},currentFloor=0;
let unlockedAt=-Infinity,viewMode:ViewMode='third',camYaw=map.spawnHeading,camPitch=.3,camReach=THIRD_DISTANCE[1],pointerLocked=false;
let heading=map.spawnHeading,previousHeading=map.spawnHeading,targetHeading=map.spawnHeading,turnRate=0,zoom=1,crouched=false,crouchBlend=0,paused=false,mapOpen=false,helpOpen=false,mapFloor=0;
let guideIndex=-1,guideStarted=0,guideFrames=0,guideStall=0;let velocity={x:0,z:0},slope=0,forwardAccel=0,gaitSpeed=0;let keys=new Set<string>();const actionPresses=new Set<string>();let travelled=0,sawFade=false,visitedUpper=false,returned=false;
const guideTrace:{floor:number;y:number;fade:number}[]=[];
let lastPointer=-Infinity;const pointer=new T.Vector2();const aimRay=new T.Raycaster();let cursorPoint:T.Vector3|null=null;
const avatar=new T.Group();avatar.name='player';scene.add(avatar);const leanGroup=new T.Group();leanGroup.rotation.order='YXZ';avatar.add(leanGroup);
let modelReady=false,modelError='';
let rig:Rig|undefined;const locomotion=new Locomotion();let lastPose:Pose|undefined;
const applyPose=(p:Pose)=>rig?.apply(p);
// The chosen proportions (whole-body scale about the feet plus bone scales) and personal gait.
let bodyHeight=1;
function applyAgent(){if(!playerScene||!rig)return;applyLook(playerScene,agentLook);rig.setBody(bodyScales(agentLook));bodyHeight=heightScale(agentLook);leanGroup.scale.setScalar(bodyHeight);locomotion.style=gaitStyleOf(agentLook.gait);}
async function loadPlayer(){try{const bytes=Uint8Array.from(atob(PLAYER_BASE64),c=>c.charCodeAt(0));const g=await new GLTFLoader().parseAsync(bytes.buffer,'');leanGroup.add(g.scene);playerScene=g.scene;g.scene.userData.characterId='wardrobe';creatorTemplate=clone(g.scene);characterTemplates.set('wardrobe',creatorTemplate);g.scene.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;}});applyLook(g.scene,agentLook);const loader=new GLTFLoader(),models=npcTemplates;await Promise.all(Object.entries(NPC_MODELS).map(async([id,b64])=>{try{models.set(id,(await loader.parseAsync(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer,'')).scene);}catch(e){console.error('NPC model failed',id,e);}}));
 await Promise.all(Object.entries(CHARACTER_MODELS).map(async([id,b64])=>{const gltf=await loader.parseAsync(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer,'');gltf.scene.userData.characterId=id;characterTemplates.set(id,gltf.scene);}));
 await m3View.load(m3);await loadItemModels();await combatView.load();combatView.warm(()=>renderer.compile(scene,camera));for(const c of await buildCover(map.blockers as Block[]))group(c.floor).add(c.mesh);for(const c of map.checkpoints){box('CHK_'+c.id,c.x,c.y+.01,c.z,c.width,.025,.08,'#d9b55c');navLabels.push({text:'検査 B',x:c.x,y:c.y+2.4,z:c.z,floor:0});}
 npcViews=director.npcs.map((n,i)=>new NpcView(models.get(mission.npcs[i].model??'')??g.scene,n,scene));npcViews.forEach((v,i)=>v.model=mission.npcs[i].model??'');for(const v of npcViews)v.onPosed=view=>combatView.npc(view,clock.elapsed);rig=new Rig(g.scene);applyAgent();
 // walk1 is a two-pose sketch whose stride is half the travel speed; the procedural gait replaces it.
 if(!rig.has(['pelvis','thighl','shinl','footl','upperarml','forearml']))throw new Error('リグの骨が不足しています');modelReady=true;
 // The briefing opens first; the saved look is applied now since the creator is no longer the first screen.
 chooseCharacter();creatorOpen=false;openPrep();}catch(e){modelError=String(e);const replacement=new T.Mesh(new T.CapsuleGeometry(.24,1.18,4,8),material('#2b2e35'));replacement.position.y=.85;leanGroup.add(replacement);console.error('Player load failed',e);creatorOpen=false;toast('モデル読込失敗：代替表示です。');}$('#load').classList.add('gone');}
function chooseCharacter(){if(playerScene)leanGroup.remove(playerScene);playerScene=clone(characterTemplates.get(agentLook.character)??creatorTemplate!);leanGroup.add(playerScene);playerScene.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});rig=new Rig(playerScene);applyAgent();m4View.refresh(playerScene,rig,m4,agentLook,npcTemplates);}
// The character creator opens first, and again from the pause menu (which restarts the mission).
function showCreator(restart:boolean,after?:()=>void){if(!playerScene||!creatorTemplate)return;creatorOpen=true;keys.clear();actionPresses.clear();unlockPointer();$('#pause-modal').classList.remove('open');paused=false;
 // The creator gets a copy taken before the game ever posed the skeleton, so its rest pose is the true one.
 openCreator(creatorTemplate,agentLook,chosen=>{agentLook=chosen;saveLook(agentLook);chooseCharacter();creatorOpen=false;if(after){after();return;}if(restart)reset();toast(`${agentLook.codename}、ターゲット3人を排除して出口へ。`);focusGame();lockPointer();},characterTemplates);}
function toast(text:string){toastText=text;toastAt=lastNow;}

function focusGame(){canvas.focus({preventScroll:true});}
function lockPointer(){if(viewMode!=='overhead'&&!pointerLocked&&canvas.requestPointerLock)Promise.resolve(canvas.requestPointerLock()).catch(()=>{});}
function unlockPointer(){if(pointerLocked)document.exitPointerLock();}
function setPause(value:boolean){paused=value;keys.clear();actionPresses.clear();$('#pause-modal').classList.toggle('open',value);if(value){unlockPointer();$('#resume').focus();}else{focusGame();lockPointer();}}
function setMap(value:boolean){mapOpen=value;keys.clear();actionPresses.clear();mapFloor=currentFloor;$('#map-modal').classList.toggle('open',value);if(value){unlockPointer();$('#close-map').focus();}else{focusGame();lockPointer();}}
function setView(mode:ViewMode){viewMode=mode;hemi.groundColor.set(mode==='overhead'?'#677c68':'#a7a58e');camera.fov=mode==='overhead'?30:mode==='first'?72:55;camera.near=mode==='overhead'?.1:.04;camera.updateProjectionMatrix();setZoom(mode==='overhead'?0:1);camPitch=mode==='first'?.1:.3;camYaw=heading;
 document.body.dataset.view=mode;$('#view-mode').textContent=`視点 ${VIEW_LABEL[mode]} · V`;if(mode==='overhead')unlockPointer();snapCamera();}
function reset(){restartHold.clear();training=false;m4Training=false;enteredStaff=false;position={...map.spawn,y:0};previous={...position};currentFloor=0;guideIndex=-1;heading=previousHeading=targetHeading=camYaw=map.spawnHeading;turnRate=0;velocity={x:0,z:0};slope=forwardAccel=gaitSpeed=0;locomotion.reset();crouched=false;crouchBlend=0;travelled=0;sawFade=false;visitedUpper=false;returned=false;guideTrace.length=0;keys.clear();actionPresses.clear();startMission();snapCamera();}
function startMission(){director=new Director(mission,world,nav,boxes,rules);events=new MissionEvents();clock=new MissionClock(rulesData.schedule,events);schedule=new ScheduleSystem(scheduleData,map.schedulePlaces,director,clock,events);dialogue=new DialogueSystem(dialogueData,map.schedulePlaces,director,clock,rulesData.dialogue,events);lastAlert=0;$<HTMLSelectElement>('#time-rate').value='1';m3=new M3System(director,hides,rulesData.m3);m4=new M4System(director,map.checkpoints as Checkpoint[],rulesData.m4,hides);m53=new M53System(director,m3,m4,clock,events,rulesData.m53,map.m53 as M53Map,map.cameras,chancesData);m57=newM57();m57View.reset();
 flow=new MissionFlow(missionData.targets,director,events);ledger=new ScoreLedger(events,id=>{const n=director.npcs.find(n=>n.id===id);return n&&{role:n.role,target:n.target};});lastResult=null;
 director.onSpotted=n=>events.emit({type:'player.spotted',time:clock.elapsed,id:n.id});m3.onFound=body=>events.emit({type:'body.found',time:clock.elapsed,id:body.id,life:body.life==='dead'?'dead':'unconscious',judgement:body.deathKind});
 if(!loadout.tools.includes('poison_lethal'))m53.poison=0;const carried=m4.extraInventory;m4.extraInventory=()=>[...(carried?.()??[]),...combat.guns.map(g=>g.id),...(detection.held?[detection.held]:[])];
 combat=new CombatSystem(director,events,m3.hotel,combatRules,weaponDefs,map.reinforcements).stock();if(loadout.pistol)combat.equip(loadout.pistol);combatView.reset();detection=new DetectionSystem(director,events,m3.hotel,map.cameras as Camera[],detData,map);combat.items=itemTable;detection.items=itemTable;m4.items=itemTable;detectionView.reset();m53.bindDetection(detection);m53.illegal=()=>combat.illegalIn(m4.disguise);wasFighting=false;fireHeld=false;firePressed=false;
 for(const v of npcViews.splice(director.npcs.length))v.group.removeFromParent();npcViews.forEach((v,i)=>v.bind(director.npcs[i]));panelProgress=0;panelDone=false;coins=loadout.tools.includes('coin')?rules.noise.coins:0;tampering=false;missionOver='';missionTime=0;peakSuspicion=0;clearCoinProps();(panelLamp.material as T.MeshStandardMaterial).color.set('#3fdc8c');(panelLamp.material as T.MeshStandardMaterial).emissive.set('#3fdc8c');$('#result-modal').classList.remove('open');}
function setZoom(value:number){zoom=value;}
function startGuide(){if(guideIndex>=0){guideIndex=-1;toast('案内ルートを中断しました。');return;}reset();guideIndex=0;guideStarted=performance.now();guideFrames=0;guideStall=0;$('#qa-result').textContent='案内ルート実行中。通常と同じ固定ステップ・衝突・カメラを使用。';toast('ロビーを抜け、大階段から2Fへ。移動キーで中断できます。');focusGame();}
function startTraining(){reset();training=true;for(const n of director.npcs){n.scheduled=false;n.scheduledAway=false;n.scheduleAction='';n.talking=false;n.life='unconscious';n.bodyMode='hidden';}const target=director.npcs.find(n=>n.id==='guard_pool')!,observer=director.npcs.find(n=>n.id==='guard_terrace')!;for(const [n,x,z,h] of [[target,-2,15.6,Math.PI],[observer,2,15.6,Math.PI/2]] as const){n.life='active';n.bodyMode='ground';n.pos={x,y:0,z};n.heading=h;n.route.splice(0,n.route.length,[x,z,600]);n.routeIndex=0;n.wait=600;n.look?.splice(0,2,x+Math.sin(h),z+Math.cos(h));}position={x:-2,y:0,z:16.5};previous={...position};heading=previousHeading=targetHeading=camYaw=Math.PI;currentFloor=0;npcViews.forEach((v,i)=>v.bind(director.npcs[i]));snapCamera();$('#debug').removeAttribute('open');toast('練習：F長押しで気絶／X長押しで排除。左（プール西側）にタオル棚。');focusGame();}
function startM4Training(){startTraining();m4Training=true;const victim=director.npcs.find(n=>n.id==='guard_terrace')!,attendant=director.npcs.find(n=>n.id==='guard_check_lobby')!;victim.life='unconscious';victim.fall=1;victim.bodyMode='ground';victim.pos={x:-2,y:0,z:15.6};const post=attendant.route[0];attendant.life='active';attendant.bodyMode='ground';attendant.pos={x:post[0],y:0,z:post[1]};attendant.heading=Math.atan2(8-post[0],-3.4-post[1]);attendant.wait=600;m4.clothes.push({id:'practice-waiter',disguise:'waiter',pos:{x:-.8,y:0,z:16.3}});const expert=director.npcs.find(n=>n.id==='head_waiter')!;expert.life='active';expert.bodyMode='ground';expert.pos={x:1,y:0,z:14.6};expert.heading=Math.PI/2;expert.route.splice(0,expert.route.length,[1,14.6,600]);expert.look?.splice(0,2,2,14.6);expert.wait=600;expert.post.splice(0,expert.post.length,'ZONE_public_pool');for(const v of npcViews)v.bind(v.npc);toast('T長押しで制服へ。ロビーの大階段の手前でB長押し検査。Hでワイヤーを預けられます。');}
$('#m4-training').onclick=startM4Training;$('#m3-training').onclick=startTraining;$('#m3-discover').onclick=()=>{if(!training){toast('先に背後アクション練習を開始してください。');return;}const n=director.npcs.find(n=>n.id==='guard_terrace')!;n.heading=-Math.PI/2;n.look?.splice(0,2,-2,15.6);toast('警備員が倒れた人の方を向いた。');focusGame();};$('#m3-normal').onclick=()=>{training=false;reset();focusGame();};
$('#guide').onclick=startGuide;$('#change-look').onclick=()=>showCreator(true);$('#retry').onclick=()=>{reset();focusGame();lockPointer();};$('#result-prep').onclick=()=>openPrep();$('#to-prep').onclick=()=>{setPause(false);openPrep();};$('#prep-go').onclick=()=>startFromPrep();$('#prep-look').onclick=()=>{prepOpen=false;$('#prep-modal').classList.remove('open');showCreator(false,()=>openPrep());};$('#pause').onclick=()=>setPause(true);$('#resume').onclick=()=>setPause(false);$('#reset').onclick=()=>{reset();setPause(false);};$('#view-mode').onclick=()=>{cycleView();focusGame();};$('#help').onclick=()=>{helpOpen=true;keys.clear();actionPresses.clear();unlockPointer();$('#help-modal').classList.add('open');$('#close-help').focus();};$('#close-help').onclick=()=>{helpOpen=false;$('#help-modal').classList.remove('open');focusGame();lockPointer();};$('#close-map').onclick=()=>setMap(false);
document.querySelectorAll<HTMLButtonElement>('[data-map-floor]').forEach(b=>b.onclick=()=>{mapFloor=Number(b.dataset.mapFloor);});
window.addEventListener('keydown',e=>{if(creatorOpen||prepOpen||(e.target instanceof HTMLElement&&e.target.closest('input,select,textarea')))return;if(['Tab','Escape','AltLeft','AltRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;
 if(e.code==='Escape'){if(performance.now()-unlockedAt<350)return;if(helpOpen){helpOpen=false;$('#help-modal').classList.remove('open');focusGame();}else if(mapOpen)setMap(false);else setPause(!paused);return;}
 if(missionOver){if(e.code==='KeyR'||e.code==='Enter'){reset();toast('最初からやり直します。');}return;}
 if(e.code==='Tab'&&!paused&&!helpOpen){setMap(!mapOpen);return;}if(paused||mapOpen||helpOpen)return;
 if(e.code==='KeyG'){if(!m53.locked)throwCoin();return;}
 if(e.code==='KeyQ'){qDown=performance.now();return;}if(e.code==='KeyR'&&combat.hand){if(combat.reload()){combatView.play('reload',performance.now(),combat.hand);toast('弾を込める。');}return;}
 if(e.code==='KeyE'&&!training&&combat.nearestDrop(position)&&!m3.body(position)&&!m3.dragged){const got=combat.pickup(position);if(got)toast(`${got}を拾った。`);return;}
 if(e.code==='Space'){firePressed=true;fireHeld=true;return;}
 if(e.code==='KeyU'&&!training){const put=detection.putDown(position);if(put)toast(`${put}を置いた。`);return;}
 if(e.code==='KeyE'&&!training&&!m3.body(position)&&!m3.dragged&&!m3.locked&&!m53.locked&&!m53.prompt(playerView(),heading)&&!m57.locked&&!m57.prompt(playerView())){
  if(detection.blend){detection.stopBlend();toast('溶け込みをやめた。');return;}
  if(detection.nearestItem(position)){const got=detection.pickup(position)!,l=detection.legality(detection.held,m4.disguise);toast(l.legality==='suspicious'?(l.ok?`${got}を持った。この服なら怪しまれない。`:`${got}を持った。この服では怪しまれる。`):`${got}を持った。`);return;}
  const spot=detection.startBlend(playerView());if(spot){targetHeading=spot.heading;toast(`${spot.label}（溶け込み中）。Eか移動でやめる。`);return;}
  if(detection.nearRecorder(position))detection.beginRecorder(permission(rules,m4.disguise,zoneAt(mission.zones,position.x,position.z,currentFloor))==='allow');}
 if(e.code==='KeyZ'){setZoom((zoom+1)%3);return;}if(e.code==='KeyV'){cycleView();return;}if(e.code==='KeyC'){if(!crouched||!world.blocked(position.x,position.y,position.z,1.8))crouched=!crouched;return;}
 keys.add(e.code);if(['KeyE','KeyF','KeyX','KeyJ','KeyP'].includes(e.code))actionPresses.add(e.code);if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))guideIndex=-1;
});window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyR')restartHold.clear();if(e.code==='Space')fireHeld=false;if(e.code==='KeyQ'&&qDown>=0){const held=performance.now()-qDown;qDown=-1;if(missionOver||paused||mapOpen||helpOpen||creatorOpen||prepOpen||training)return;
  if(held>=700){const g=combat.drop(position);if(g)toast(`${weaponDefs[g.id].label}を捨てた。`);return;}const was=combat.hand,now=combat.cycle();if(now)combat.hand=now;combatView.play(now?'draw':'holster',performance.now(),now||was);if(now)toast(`${weaponDefs[now].label}を構えた。見られると撃ち合いになる。`);}});window.addEventListener('blur',()=>{keys.clear();actionPresses.clear();if(modelReady&&!mapOpen&&!helpOpen&&!creatorOpen&&!prepOpen&&!missionOver)setPause(true);});document.addEventListener('visibilitychange',()=>{keys.clear();actionPresses.clear();});
function cycleView(){setView(VIEW_ORDER[(VIEW_ORDER.indexOf(viewMode)+1)%VIEW_ORDER.length]);toast(`視点：${VIEW_LABEL[viewMode]}`+(viewMode==='overhead'?'':' · クリックでマウス視点'));}
function look(dx:number,dy:number){if(viewMode==='overhead'||paused||mapOpen||helpOpen)return;const [lo,hi]=PITCH_LIMIT[viewMode];camYaw=Math.atan2(Math.sin(camYaw-dx*.0024),Math.cos(camYaw-dx*.0024));camPitch=T.MathUtils.clamp(camPitch+dy*.0022,lo,hi);}
// 2026-11-06: what the one-file mobile page (mobile.ts, touch.ts) needs from inside the game; keys go in as key events.
Object.assign(window,{__mobile:{look,aim:(x:number,y:number)=>{pointer.set(x/innerWidth*2-1,-y/innerHeight*2+1);lastPointer=performance.now();},blocked:()=>creatorOpen||prepOpen||paused||mapOpen||helpOpen||!modelReady||!!missionOver,state:()=>({crouched,hasWire:m4.hasWire,armed:!!combat.hand}),drop:()=>{const g=combat.drop(position);if(g)toast(`${weaponDefs[g.id].label}を捨てた。`);}}});
document.addEventListener('pointerlockchange',()=>{const was=pointerLocked;pointerLocked=document.pointerLockElement===canvas;if(was&&!pointerLocked)unlockedAt=performance.now();if(was&&!pointerLocked&&viewMode!=='overhead'&&!paused&&!mapOpen&&!helpOpen&&modelReady&&!creatorOpen&&!missionOver)setPause(true);});
document.addEventListener('mousemove',e=>{if(pointerLocked)look(e.movementX,e.movementY);});
// Without pointer lock (denied or embedded), dragging with the left button still turns the view.
canvas.addEventListener('pointermove',e=>{if(!pointerLocked&&e.buttons&1)look(e.movementX,e.movementY);});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);lastPointer=performance.now();if(viewMode==='overhead')$('#aim').style.cssText=`display:block;left:${e.clientX-4}px;top:${e.clientY-4}px`;});canvas.addEventListener('pointerleave',()=>{$('#aim').style.display='none';lastPointer=-Infinity;});canvas.addEventListener('pointerdown',e=>{if(combat.hand&&e.button===0&&(pointerLocked||viewMode==='overhead')&&!paused&&!mapOpen&&!helpOpen&&!missionOver&&!creatorOpen&&!prepOpen){firePressed=true;fireHeld=true;}focusGame();lockPointer();});addEventListener('pointerup',e=>{if(e.button===0)fireHeld=false;});

const camTarget=new T.Vector3(position.x,.8,position.z),camDesired=new T.Vector3();const azimuth=Math.PI/4,elevation=50*Math.PI/180;
const ACTION_LABEL:Record<string,string>={chat:'談笑',photo:'記念撮影',tour:'ヨット見学',lounge:'休憩',tasting:'試飲・試食',drink:'飲む',speech:'スピーチ',wait:'待機',phone:'電話',work:'仕事',massage:'マッサージ',dance:'ダンス',escort:'付き添い',serve:'給仕',cook:'料理',clean:'掃除',inspect:'点検',camera:'撮影',radio:'無線',massage_work:'施術',absent:'到着前'};
const PHASE_LABEL:Record<string,string>={moving:'移動中',acting:'行動中',paused:'中断',inactive:'行動不能',away:'到着前'};
const timeText=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
function jumpTime(seconds:number){clock.jump(seconds);schedule.sync(0);dialogue.seek();missionTime=clock.elapsed;}
$('#time-rate').onchange=()=>{clock.setRate(Number($<HTMLSelectElement>('#time-rate').value));keys.clear();};
$('#time-jump').onclick=()=>{const minutes=Number($<HTMLInputElement>('#time-minute').value);if(Number.isFinite(minutes)&&minutes>=0){jumpTime(minutes*60);toast(`${timeText(clock.time)}へ。人は現在地から予定先へ移動します。`);}};
// Each thing carried, coloured for this outfit: red illegal, yellow suspicious here, white fine.
function inventoryHtml(){const d=m4.disguise,tag=(id:string,label:string,hidden:boolean)=>{const l=detection.legality(id,d),inHand=combat.hand===id;return `<span class="leg-${l.ok&&!inHand?'ok':l.legality==='illegal'?'illegal':'susp'}">${label}${hidden?'':'（手）'}</span>`;};
 return [...(m4.hasWire?[tag('wire','ワイヤー',true)]:[]),...(m53.poison>0?[tag('poison_lethal',`致死毒 ×${m53.poison}`,true)]:[]),...(m53.cellarKey?[tag('cellar_key','セラーの鍵',true)]:[]),...(m57.keycard?[tag('keycard','カードキー',true)]:[]),
  ...combat.guns.map(g=>tag(g.id,weaponDefs[g.id].label,combat.hand!==g.id&&weaponDefs[g.id].concealable)),...(detection.held?[tag(detection.held,detection.data.items[detection.held]?.label??detection.held,false)]:[]),...(coins>0?[tag('coin',`コイン ×${coins}`,true)]:[])].join(' · ');}
function updateCombatUi(){const rec=$('#rec-status'),watch=training?[]:detection.watching(playerView());rec.className=detection.recorded?'rec':watch.length?'watch':'';rec.textContent=training?'':detection.recorded?`● 記録あり（${detection.recordReason}）`:watch.length?'◎ カメラに映っている':'';const c=combat,g=c.held,hp=Math.round(c.hp),max=combatRules.player.health,el=$('#combat-status');if(training){el.innerHTML='';return;}
 const bar=c.fight||hp<max?`<div class="hp"><span style="width:${Math.max(0,hp)/max*100}%"></span><b>体力 ${Math.max(0,hp)}</b></div>`:'';
 const gun=g?`<div class="gun">${weaponDefs[g.id].label}　<b>${g.mag}</b> / ${g.reserve}${c.reloadT>0?'　装填中…':''}</div>`:c.guns.length?`<div class="gun dim">銃はしまっている（Q）${c.guns.some(x=>!weaponDefs[x.id].concealable)?' · 短機関銃は背中に見えている':''}</div>`:'';
 const fight=c.fight?'<div class="fight">撃ち合い中 — 視界を切って逃げろ</div>':'',closed=c.closedExits().length?`<div class="closed">封鎖中：出口${c.closedExits().join('・')}は使えない${c.waves?` · 増援 ${c.waves}波`:''}</div>`:'';
 el.innerHTML=fight+bar+gun+closed;}
function updateScheduleUi(){updateCombatUi();
 const chances=m53.chances.snapshot(clock.time,clock.rules.loop),tracked=chances.find(c=>c.tracked),field=$('#field-status');
 field.innerHTML=training?'':inventoryHtml();
 $('#chance-hud').textContent=training?'':tracked?`${tracked.title} · ${tracked.status==='complete'?'達成':tracked.status==='lost'?'消滅':`${tracked.stage}/3 ${tracked.step}`}${tracked.status==='active'&&tracked.waitSeconds>0?` · 次の機会まで${Math.ceil(tracked.waitSeconds/60)}分`:''}`:'会話を聞いてチャンスを発見する';
 if(mapOpen)$('#chance-list').replaceChildren(...chances.map(c=>{const b=document.createElement('button');b.textContent=`${c.tracked?'▶ ':''}${c.title} · ${c.status==='undiscovered'?'未発見':c.status==='complete'?'達成':c.status==='lost'?'消滅':c.stage+'/3'}`;b.disabled=c.status==='undiscovered';b.onclick=()=>m53.chances.track(c.id);return b;}));

 $('#mission-clock').textContent=training?'練習中':`MISSION ${timeText(clock.time)} / 30:00 · ${clock.cycle+1}周目${clock.rate>1?' · ×4':''}`;
 const sub=!training&&!paused&&!mapOpen&&!helpOpen&&!missionOver&&!creatorOpen?dialogue.subtitle:null;
 $('#dialogue-subtitle').textContent=m53.reactionUntil>clock.elapsed&&!training?m53.reactionText:sub?`${sub.speaker}「${sub.text}」  ${sub.line+1}/${sub.total}`:'';
 $('#dialogue-subtitle').classList.toggle('visible',!!sub||!training&&m53.reactionUntil>clock.elapsed);
 if($('#debug').hasAttribute('open')||mapOpen){const states=schedule.snapshot().filter(s=>director.npcs.find(n=>n.id===s.id)?.target);
 $('#schedule-status').textContent=states.map(s=>`${s.id}: ${map.schedulePlaces[s.place as keyof typeof map.schedulePlaces].label} · ${PHASE_LABEL[s.phase]}${s.timedOut?'（移動制限時間）':''}`).join('\n')+`\n聞いた会話 ${dialogue.heard.size} / ${Object.keys(dialogueData).length}`;
 if(mapOpen)$('#target-schedules').replaceChildren(...states.map(s=>{const card=document.createElement('div'),name=document.createElement('b'),plan=document.createElement('span');name.textContent=director.npcs.find(n=>n.id===s.id)!.label+` · ${PHASE_LABEL[s.phase]}`;plan.textContent=scheduleData.actors[s.id as keyof typeof scheduleData.actors].plan.map(e=>`${timeText(e.from)} ${map.schedulePlaces[e.place as keyof typeof map.schedulePlaces].label}（${ACTION_LABEL[e.do]??e.do}）`).join(' → ');card.append(name,plan);return card;}));
 }
}
function offset(distance:number){return new T.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)).multiplyScalar(distance);}
function distanceForZoom(){return [36,28,20][zoom]*Math.max(1,1.6/camera.aspect);}
function snapCamera(){camReach=THIRD_DISTANCE[zoom];if(viewMode!=='overhead'){placeViewCamera(0);return;}camTarget.set(position.x+(zoom===0?3:0),position.y+.8,position.z-(zoom===0?1:0));camera.position.copy(camTarget).add(offset(distanceForZoom()));camera.lookAt(camTarget);camera.updateMatrixWorld();}
const solids:T.Object3D[]=[];scene.traverse(o=>{const m=o as T.Mesh;if(m.isMesh&&(m.geometry.type==='BoxGeometry'||m.name==='stair-steps')&&!['sea','pool-water','pool-basin'].includes(m.name))solids.push(m);});
const camRay=new T.Raycaster(),pivot=new T.Vector3(),camWanted=new T.Vector3();
// Over-the-shoulder orbit (third) or eye camera (first). The third-person boom shortens instantly when geometry blocks it and eases back out.
function placeViewCamera(dt:number){const d=lookDirection(camYaw,camPitch),r=cameraRight(camYaw);
 if(viewMode==='first'){const bob=lastPose?(lastPose.hip-.795)*.8:0;camera.position.set(avatar.position.x+Math.sin(camYaw)*.2,avatar.position.y+T.MathUtils.lerp(1.64,1.0,crouchBlend)*bodyHeight+bob*bodyHeight,avatar.position.z+Math.cos(camYaw)*.2);}
 else{pivot.set(avatar.position.x,avatar.position.y+T.MathUtils.lerp(1.58,.98,crouchBlend)*bodyHeight,avatar.position.z);camWanted.set(pivot.x+r.x*SHOULDER-d.x*THIRD_DISTANCE[zoom],pivot.y-d.y*THIRD_DISTANCE[zoom],pivot.z+r.z*SHOULDER-d.z*THIRD_DISTANCE[zoom]);
  const ray=camWanted.clone().sub(pivot),full=ray.length();ray.normalize();camRay.set(pivot,ray);camRay.far=full+.25;const hit=camRay.intersectObjects(solids,false)[0];const allowed=hit?Math.max(.35,hit.distance-.25):full;
  if(allowed<camReach||dt===0)camReach=allowed;else camReach=T.MathUtils.damp(camReach,allowed,5,dt);if(full-camReach>.6)sawFade=true;
  camera.position.copy(pivot).addScaledVector(ray,camReach);}
 camera.lookAt(camera.position.x+d.x,camera.position.y+d.y,camera.position.z+d.z);camera.updateMatrixWorld();}
setView('third');
const fadeRay=new T.Raycaster();let faded=0,moving=0,currentSpeed=0,lastUi=0,frameCost=0,frameMs=16.7;
function finishGuide(){guideIndex=-1;const result={passed:travelled>5&&sawFade&&visitedUpper&&returned,walkedMetres:Math.round(travelled*10)/10,wallFade:sawFade,upperFloor:visitedUpper,returnedToGround:returned,collisionEnabled:true,modelReady,seconds:+((performance.now()-guideStarted)/1000).toFixed(1),trace:guideTrace};$('#qa-result').textContent=JSON.stringify(result,null,2);toast(result.passed?'案内ルート完了。透過と上下階の切替を確認しました。':'案内ルート完了。動作記録を確認してください。');}
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
function fixedUpdate(dt:number){if(restartHold.step(dt/(training?1:clock.rate),keys.has('KeyR'),!!combat.hand)){reset();toast('最初からやり直します。');return;}previous={...position};previousHeading=heading;let direction={x:0,z:0};for(const v of npcViews)v.snapshot();
 const actionKeys=new Set([...keys,...actionPresses]);actionPresses.clear();if(!m4.hasWire)actionKeys.delete('KeyX');
 const e53=!training&&m53.step(dt,playerView(),heading,actionKeys,m3.locked||m4.locked||!!m3.dragged||m3View.transferBusy),e57=!training&&m57.step(dt,playerView(),actionKeys,m3.locked||m4.locked||!!m3.dragged||m3View.transferBusy||m53.locked),fieldE=e53||e57;
 const m3Keys=fieldE?new Set([...actionKeys].filter(k=>k!=='KeyE')):actionKeys;
 const usedE=m3.step(dt,playerView(),heading,m3Keys,m3View.transferBusy||m4.locked||m53.locked);m4.step(dt,playerView(),heading,keys,!!m3.action||!!m3.dragged||m3View.transferBusy||m53.locked);
 for(const notice of [...m3.notices,...m4.notices,...m53.notices,...m57.notices])toast(notice);
 if(m57.action?.npc)targetHeading=Math.atan2(m57.action.npc.pos.x-position.x,m57.action.npc.pos.z-position.z);
 if(m53.action?.npc)targetHeading=Math.atan2(m53.action.npc.pos.x-position.x,m53.action.npc.pos.z-position.z);
 if(m4.action?.guard)targetHeading=Math.atan2(m4.action.guard.pos.x-position.x,m4.action.guard.pos.z-position.z);if(m3.action){const target=m3.action.container??m3.action.npc.pos;targetHeading=Math.atan2(target.x-position.x,target.z-position.z);}
 void usedE;tampering=false;let speed=m3.dragged?rulesData.m3.dragSpeed:crouched?CROUCH_SPEED:keys.has('ShiftLeft')||keys.has('ShiftRight')?RUN_SPEED:WALK_SPEED;
 if(guideIndex>=0){const point=map.guide[guideIndex],last=guideIndex===map.guide.length-1,dx=point[0]-position.x,dz=point[1]-position.z,len=Math.hypot(dx,dz);
  if(len<(last?.06:.3)){guideIndex++;if(guideIndex>=map.guide.length){finishGuide();velocity={x:0,z:0};}return;}
  // Slow into each corner so the smoothed velocity turns on the route instead of drifting wide.
  direction={x:dx/len,z:dz/len};speed=Math.min(4.8,last?len*3.2:1.5+len*1.6);guideFrames++;if(guideFrames%30===0)guideTrace.push({floor:currentFloor,y:+position.y.toFixed(2),fade:faded});}
 else{const ix=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),iy=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));direction=viewMode==='overhead'?screenMovement(ix,iy):cameraMovement(ix,iy,camYaw);if(tampering||m3.locked||m3View.transferBusy||m4.locked||m53.locked||m57.locked)direction={x:0,z:0};}
 const tx=direction.x*speed,tz=direction.z*speed,dvx=tx-velocity.x,dvz=tz-velocity.z,dv=Math.hypot(dvx,dvz),oldSpeed=Math.hypot(velocity.x,velocity.z);
 const rate=(Math.hypot(tx,tz)>oldSpeed+.01?15:22)*dt;if(dv>rate){velocity.x+=dvx/dv*rate;velocity.z+=dvz/dv*rate;}else velocity={x:tx,z:tz};
 const stepped=m3.constrainMove(position,world.move(position,(m3.locked||m3View.transferBusy||m4.locked||m53.locked||m57.locked)?0:velocity.x*dt,(m3.locked||m3View.transferBusy||m4.locked||m53.locked||m57.locked)?0:velocity.z*dt,crouched?1.45:1.8),heading);const next=guideIndex<0?m4.constrain(position,stepped):stepped,mx=next.x-position.x,mz=next.z-position.z;moving=Math.hypot(mx,mz);if(detection.blend&&moving>1e-3){detection.stopBlend();toast('溶け込みをやめた。');}
 // Keep only the velocity the collider allowed, so pushing into a wall does not store speed.
 velocity={x:mx/dt,z:mz/dt};currentSpeed=moving/dt;travelled+=moving;
 // NPC bodies are solid: the agent is pushed out of them rather than walking through.
 if(guideIndex<0)for(const n of director.npcs){if(!n.active||n.busy)continue;const dx=next.x-n.pos.x,dz=next.z-n.pos.z,d=Math.hypot(dx,dz);if(d>1e-3&&d<.55&&Math.abs(n.pos.y-next.y)<1){const q=world.move(next,dx/d*(.55-d),dz/d*(.55-d),crouched?1.45:1.8);next.x=q.x;next.y=q.y;next.z=q.z;}}
 forwardAccel=T.MathUtils.damp(forwardAccel,(currentSpeed-oldSpeed)/dt,8,dt);slope=T.MathUtils.damp(slope,moving>1e-4?(next.y-position.y)/moving:slope,10,dt);position=next;
 if(guideIndex>=0){guideStall=moving<.002?guideStall+dt:0;if(guideStall>2.5){guideIndex=-1;toast('案内ルートが進めませんでした。');}}
 const oldFloor=currentFloor;currentFloor=floorAt(position.y,currentFloor);if(currentFloor!==oldFloor)toast(currentFloor===1?'2F 回廊 · 上階の表示を切り替えました。':currentFloor===0?'1F 中庭 · 上階を自動で隠しました。':`${floorLabel(currentFloor)} · 表示を切り替えました。`);if(currentFloor===1)visitedUpper=true;if(visitedUpper&&currentFloor===0)returned=true;
 // Face the direction of travel (first person: the view); in overhead the cursor turns the agent only while standing.
 if(m3.dragged&&!m3.action)targetHeading=Math.atan2(m3.dragged.pos.x-position.x,m3.dragged.pos.z-position.z);
 else if((viewMode==='first'||viewMode==='third'&&!!combat.hand)&&guideIndex<0)targetHeading=camYaw;
 else if(currentSpeed>.35)targetHeading=Math.atan2(velocity.x,velocity.z);
 else if(viewMode==='overhead'&&guideIndex<0&&performance.now()-lastPointer<=1600&&cursorPoint){const dx=cursorPoint.x-position.x,dz=cursorPoint.z-position.z;if(Math.hypot(dx,dz)>.35)targetHeading=Math.atan2(dx,dz);}
 const turn=angleDelta(heading,targetHeading),step=viewMode==='first'&&guideIndex<0?turn:Math.sign(turn)*Math.min(Math.abs(turn),Math.min(11*dt,Math.abs(turn)*(1-Math.exp(-(currentSpeed>.35?13:9)*dt))+.6*dt));heading=angleDelta(0,heading+step);
 turnRate=T.MathUtils.damp(turnRate,step/dt,12,dt);
 if(m4.stats.frisks&&currentFloor===1)enteredStaff=true;
 if(guideIndex<0)stepAi(dt);
}
function playerView():PlayerView{return {x:position.x,y:position.y,z:position.z,floor:currentFloor,speed:currentSpeed,running:currentSpeed>2.6,crouched,tampering:tampering||m53.tampering||m57.tampering,disguise:m4.disguise,outfitOwner:m4.outfitOwner,carrySight:training?undefined:carriedPoints(position,heading,crouched,m4.disguise,combat,detection),restricted:!training&&m53.isRestricted(position),blending:!training&&(!!detection.blend||m57.inCar),illegal:!training&&combat.illegalIn(m4.disguise),weaponDrawn:!training&&!!combat.hand,illegalVisibleCarry:!training&&combat.shown(m4.disguise),suspiciousItem:!training&&detection.suspiciousHeld(m4.disguise)};}
const EVENT_TEXT:Partial<Record<AiEvent['type'],(n:string)=>string>>={curious:n=>`${n}が振り向いた。`,investigate:n=>`${n}が確かめに来る。`,alert:n=>`${n}に見つかった。逃げろ。`,search:n=>`${n}が見失った。捜索している。`,report:n=>`${n}が警備に知らせに行く。`,warn:n=>`${n}「ここは立入禁止だ。出ていけ」`,arrest:n=>`${n}が取り押さえに来る。逃げろ。`};
// Warned for acting oddly where the outfit is merely out of place (a guest in the parking lot), not for trespassing.
const WARN_ODD=(n:string)=>`${n}「おい、何をしている。ここから離れろ」`;
function stepAi(dt:number){if(!training){clock.step(dt);schedule.sync(dt);}const aiEvents=director.step(dt,playerView());coinPickups.step(dt,director.boxes);missionTime+=dt;if(!training){schedule.sync(0);if(lastAlert!==m3.hotel.level){lastAlert=m3.hotel.level;events.emit({type:'alert.level',time:clock.elapsed,value:lastAlert});}dialogue.step(dt,position,m3.hotel.level);m57.afterAi();m53.afterAi(playerView());for(const notice of m53.notices)toast(notice);}const hot=director.hottest();if(hot)peakSuspicion=Math.max(peakSuspicion,hot.suspicion);
 for(const e of aiEvents){if(e.type==='caught'){flow.fail('caught',clock.elapsed);endMission();return;}const text=e.type==='warn'&&e.npc.cause!=='trespass'?WARN_ODD:EVENT_TEXT[e.type];if(text)toast(text(e.npc.label));}
 if(training)return;stepCombat(dt);stepDetection(dt);if(combat.dead){if(flow.fail('killed',clock.elapsed))endMission();return;}
 if(m57.escaped.size){if(flow.fail('target_escaped',clock.elapsed))endMission();return;}
 if(flow.update(clock.elapsed))toast('ターゲットを排除した。出口（E1〜E5）から脱出する。');
 const exit=flow.phase==='escape'?atExit():undefined;if(exit&&flow.exit(exit.id,clock.elapsed))endMission();}
function atExit(){const closed=combat.closedExits();return map.exits.find(e=>!closed.includes(e.id)&&e.floor===currentFloor&&Math.hypot(position.x-e.x,position.z-e.z)<e.radius);}
// Shots land where the crosshair (first/third person) or the cursor (overhead) is: the first person or solid on that view ray.
function aimHit(){if(viewMode==='overhead'&&cursorPoint){const r=aimRay.ray;return combat.sightHit(r.origin,r.direction);}
 if(viewMode==='overhead'){const q={x:position.x+Math.sin(heading),y:0,z:position.z+Math.cos(heading)};return combat.sightHit({x:position.x,y:position.y+1.3,z:position.z},{x:q.x-position.x,y:0,z:q.z-position.z});}
 return combat.sightHit(camera.position,camera.getWorldDirection(new T.Vector3()));}
function aimPoint():Position{return aimHit().point;}
function stepDetection(dt:number){const here=zoneAt(mission.zones,position.x,position.z,currentFloor),before=detection.recorded,was=detection.action;
 detection.step(dt,playerView(),{illegal:combat.illegalIn(m4.disguise)||!!m3.action||m53.tampering||m57.tampering,carrying:!!m3.dragged,trespass:!!here&&permission(rules,m4.disguise,here)==='deny'},clock.elapsed,moving>1e-3,keys.has('KeyE'));
 if(!before&&detection.recorded)toast(`監視カメラに映った（${detection.recordReason}）。警備室の録画機で消せる。`);if(before&&!detection.recorded)toast(was?.kind==='break'?'録画機を壊した。音で人が来る。':'記録を消した。');
 if(detection.blend)targetHeading=detection.blend.heading;}
function stepCombat(dt:number){const g=combat.held,auto=!!g&&weaponDefs[g.id].rate>=6;
 if(g&&(firePressed||auto&&fireHeld)&&!m3.locked&&!m4.locked&&!m53.locked){if(g.mag<=0){if(firePressed&&!combat.reload())toast('弾がない。');else if(firePressed)combatView.play('reload',performance.now(),g.id);}else{const r=combat.fire(playerView(),aimPoint(),clock.elapsed);if(r.fired){combatView.play('fire',performance.now(),g.id);const tr=combat.tracers.at(-1);const cam=tr&&detection.shotAt(tr.from,tr.to,clock.elapsed);if(cam)toast(`${cam.label}のカメラを壊した。警備が調べに来る。`);if(r.killed)toast(`${r.hit!.label}を倒した${r.head?'（頭部）':''}。`);}}}
 firePressed=false;if(!g)fireHeld=false;const before=m3.hotel.level;combat.step(dt,playerView(),clock.elapsed);
 if(before<3&&m3.hotel.level>=3)toast('ホテルが封鎖された。出口E1・E2が閉じ、増援が来る。');
 if(!!combat.fight!==wasFighting){wasFighting=!!combat.fight;toast(wasFighting?'撃ち合いになった。視界を切って逃げろ。':'見失わせた。見られずに着替えれば潜入に戻れる。');}
 for(let i=npcViews.length;i<director.npcs.length;i++){const n=director.npcs[i],model=n.reinforcement?combatRules.reinforcements.model??'guard':n.role==='guard'?'guard':'guest_suit',v=new NpcView(npcTemplates.get(model)??playerScene!,n,scene);v.model=model;v.onPosed=view=>combatView.npc(view,clock.elapsed);npcViews.push(v);}}
function endMission(){const o=flow.outcome;if(!o)return;missionOver=o.success?'win':'caught';keys.clear();actionPresses.clear();unlockPointer();
 const r=computeResult(scoringData,ledger.counts,clock.elapsed,o.success);lastResult=r;const t=Math.round(r.seconds),clock2=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`,exit=o.exit?map.exits.find(e=>e.id===o.exit):undefined;
 $('#result-eyebrow').textContent=o.success?'MISSION COMPLETE':'MISSION FAILED';
 $('#result-title').textContent=o.success?(r.ghost?'ゴースト。誰にも気づかれなかった。':r.rank==='A'?'静かに終わらせた。':r.rank==='B'?'痕跡は残った。':'騒ぎの中を抜けた。'):FAIL_TEXT[o.reason!].title;
 $('#result-rank').textContent=r.rank;$('#result-rank').dataset.rank=r.rank;
 $('#result-text').textContent=o.success?`${exit?`${exit.id} ${exit.label}`:'出口'}から脱出した。ミッション時間 ${clock2}。${r.ghost?'ゴーストの条件をすべて満たした。':`ゴースト不成立：${r.ghostBrokenBy.map(k=>r.lines.find(l=>l.key===k)?.label??k).join('、')}。`}`:`${venueText(FAIL_TEXT[o.reason!].text)}（${clock2}）`;
 const row=(label:string,count:string,points:number|string,cls='')=>`<tr class="${cls}"><th>${label}</th><td>${count}</td><td>${typeof points==='number'?(points>0&&cls!=='total'?'+':'')+points.toLocaleString():points}</td></tr>`;
 $('#result-lines').innerHTML=row('基本点','',scoringData.base,'base')+r.lines.filter(l=>l.count).map(l=>row(l.label,l.key==='loud_shot_once'?'あり':`${l.count}`,l.points)).join('')+(o.success?row(`時間ボーナス（${Math.round(scoringData.timeBonus.under/60)}分未満）`,'',r.timeBonus?r.timeBonus:'—'):'')+row('合計','',o.success?r.total:'—','total');
 $('#result-stats').innerHTML=[['ターゲット',missionData.targets.map(id=>{const n=director.npcs.find(n=>n.id===id)!;return `${n.label}：${n.life!=='dead'?'生存':n.deathKind==='accident'?'事故死':'排除'}`;}).join(' / ')],['チャンス',m53.chances.snapshot(clock.time,clock.rules.loop).filter(c=>c.status!=='undiscovered').map(c=>`${c.title} ${c.status==='complete'?'達成':c.status==='lost'?'消滅':c.stage+'/3'}`).join(' / ')||'発見なし'],['監視カメラ',detection.recorded?`記録が残った（${detection.recordReason}）`:detection.destroyed.size?`記録なし · 壊したカメラ${detection.destroyed.size}台`:'記録なし'],['撃ち合い',combat.fights.length?`${combat.fights.length}回 · 被弾${combat.fights.reduce((s,f)=>s+f.hits,0)}発 · 潜入に戻れた ${combat.fights.filter(f=>f.returned).length}回`:'なし'],['持ち込み',[...loadout.tools.map(id=>missionData.tools.find(x=>x.id===id)?.label??id),...(loadout.pistol?[weaponDefs[loadout.pistol].label]:[])].join('、')||'なし']].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
 $('#result-modal').classList.add('open');$('#retry').focus();}
// The briefing: targets, loadout and start point. Starting from it always begins a fresh mission with that loadout.
function openPrep(){clearCoinProps();prepOpen=true;keys.clear();actionPresses.clear();unlockPointer();paused=false;$('#pause-modal').classList.remove('open');$('#result-modal').classList.remove('open');
 $('#prep-title').textContent=`作戦「${missionData.title}」`;
 $('#prep-targets').innerHTML=missionData.briefing.map(b=>{const on=missionData.targets.includes(b.id);return `<article class="${on?'on':'off'}"><b>${b.label}</b><span>${on?'今回のターゲット':'この版では対象外'}</span><p>${b.text}</p></article>`;}).join('');
 const choice=(name:string,items:{id:string;label:string;note?:string;open?:boolean}[],checked:(id:string)=>boolean,type:'checkbox'|'radio')=>items.map(i=>`<label class="${i.open===false?'locked':''}"><input type="${type}" name="${name}" value="${i.id}" ${checked(i.id)?'checked':''} ${i.open===false?'disabled':''}><span>${i.label}</span>${i.note?`<small>${i.note}</small>`:''}</label>`).join('');
 $('#prep-tools').innerHTML=missionData.fixedTools.map(i=>`<label class="fixed"><input type="checkbox" checked disabled><span>${i.label}</span><small>${i.note}</small></label>`).join('')+choice('tool',missionData.tools,id=>loadout.tools.includes(id),'checkbox')+`<small class="slots">道具の枠 ${missionData.toolSlots}</small>`;
 $('#prep-pistol').innerHTML=choice('pistol',missionData.pistols,id=>loadout.pistol===id,'radio');
 $('#prep-starts').innerHTML=choice('start',missionData.starts,id=>loadout.start===id,'radio');
 $('#prep-agent').textContent=`エージェント：${agentLook.codename}`;
 $('#prep-modal').classList.add('open');$('#prep-go').focus();}
function startFromPrep(){const picked=(name:string)=>[...document.querySelectorAll<HTMLInputElement>(`#prep-modal input[name="${name}"]:checked`)].map(i=>i.value);
 loadout={tools:picked('tool').slice(0,missionData.toolSlots),pistol:picked('pistol')[0]??'',start:picked('start')[0]??'S1'};
 prepOpen=false;$('#prep-modal').classList.remove('open');reset();toast(`${agentLook.codename}、ターゲット3人を排除して出口へ。`);focusGame();lockPointer();}
// The coin flies along the view (overhead: toward the cursor) and lands where the throw first meets a wall or the edge of the floor.
function throwCoin(){if(m3.locked||m3.dragged){toast('運搬・アクション中は投げられません。');return;}if(coins<=0){toast('コインはもうない。');return;}let yaw=viewMode==='overhead'?heading:camYaw;if(viewMode==='overhead'&&cursorPoint)yaw=Math.atan2(cursorPoint.x-position.x,cursorPoint.z-position.z);
 const max=viewMode==='overhead'&&cursorPoint?Math.min(rules.noise.throw,Math.hypot(cursorPoint.x-position.x,cursorPoint.z-position.z)):rules.noise.throw;let land={x:position.x,y:position.y,z:position.z};
 for(let d=.3;d<=max;d+=.25){const q={x:position.x+Math.sin(yaw)*d,y:position.y,z:position.z+Math.cos(yaw)*d};const hs=nav.heights(q.x,q.z),y=hs.reduce((m,v)=>Math.abs(v-position.y)<Math.abs(m-position.y)?v:m,hs[0]);if(Math.abs(y-land.y)>.35||!nav.clear(land,{...q,y}))break;land={...q,y};}
 coins--;const mesh=coinMesh();scene.add(mesh);coinsInFlight.push({mesh,from:new T.Vector3(position.x,position.y+1.3,position.z),to:new T.Vector3(land.x,land.y+.01,land.z),t:0});}
function landCoin(mesh:T.Mesh){const at=mesh.position;const n=director.noise({x:at.x,y:at.y,z:at.z});coinPickups.watch(mesh,n);toast(n?`コインの音。${n.label}が確かめに行く。`:'コインの音。誰にも聞こえなかった。');const ring=new T.Mesh(new T.RingGeometry(.2,.28,32),new T.MeshBasicMaterial({color:'#f2c14e',transparent:true,opacity:.9,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(at.x,at.y+.03,at.z);ring.userData.age=0;scene.add(ring);ripples.push(ring);}
let renderPrev:{x:number;z:number}|null=null;
// Visual ground under a foot: the collider is a smooth ramp, but the feet should land on the drawn treads.
function visualGround(x:number,z:number,baseY:number){for(const st of map.stairs){if(!inside(st,x,z))continue;const k=Math.min(STAIR_STEPS-1,Math.floor(stairProgress(st,x,z)*STAIR_STEPS)),y=st.low+(k+1)*(st.high-st.low)/STAIR_STEPS;if(Math.abs(y-baseY)<1.2)return y;}
 // Called for every foot probe of 120 people, so no arrays: the nearest of the ground and the plates over this point.
 let best=0,gap=Math.abs(baseY);for(const f of map.floors){const d=Math.abs(f.y-baseY);if(d<gap&&f.areas.some(a=>x>=a.minX&&x<=a.maxX&&z>=a.minZ&&z<=a.maxZ)){best=f.y;gap=d;}}return best;}
function animateActor(dt:number){crouchBlend=T.MathUtils.damp(crouchBlend,crouched?1:0,8,dt);if(!modelReady||dt<=0){if(lastPose)applyPose(lastPose);return;}
 const here={x:avatar.position.x,z:avatar.position.z};let distance=renderPrev?Math.hypot(here.x-renderPrev.x,here.z-renderPrev.z):0;if(distance>1)distance=0;renderPrev=here;
 gaitSpeed=T.MathUtils.damp(gaitSpeed,currentSpeed,10,dt);const baseY=avatar.position.y+.025,h=avatar.rotation.y,ground=(z:number)=>visualGround(here.x+Math.sin(h)*z,here.z+Math.cos(h)*z,baseY)-baseY;
 lastPose=locomotion.update(dt,{speed:gaitSpeed,crouch:m3.dragged?Math.max(.35,crouchBlend):crouchBlend,slope:T.MathUtils.clamp(slope,-.6,.6),turn:turnRate,distance,ground,actual:currentSpeed,reverse:!!m3.dragged});applyPose(lastPose);
 if(detection.blend&&rig){schedulePose(lastPose,detection.blend.action,performance.now()/1000);applyPose(lastPose);}
 if(rig&&playerScene&&!training)combatView.player(rig,leanGroup,playerScene,combat,performance.now(),crouchBlend,1-T.MathUtils.smoothstep(gaitSpeed,.15,.9));
 // Whole-body lean pivots at the feet: forward under acceleration, inward through turns.
 leanGroup.rotation.x=T.MathUtils.damp(leanGroup.rotation.x,T.MathUtils.clamp(forwardAccel*.018,-.1,.12),10,dt);leanGroup.rotation.z=T.MathUtils.damp(leanGroup.rotation.z,T.MathUtils.clamp(-turnRate*gaitSpeed*.022,-.16,.16),10,dt);}
function fadeWalls(dt:number){const hit=new Set<T.Mesh>();if(viewMode!=='first'){const target=new T.Vector3(avatar.position.x,avatar.position.y+1.05,avatar.position.z);for(const dx of [-.22,0,.22]){const end=target.clone();end.x+=dx;const dir=end.sub(camera.position);fadeRay.set(camera.position,dir.clone().normalize());fadeRay.far=dir.length()-.15;for(const h of fadeRay.intersectObjects(occluders,false)){const m=h.object as T.Mesh;if(m.userData.fadeFloor<=currentFloor)hit.add(m);}}}
 faded=0;for(const m of occluders){const target=hit.has(m)?.16:1;m.material.opacity=T.MathUtils.damp(m.material.opacity,target,12,dt);m.material.depthWrite=m.material.opacity>.99;if(m.userData.fadeFloor<=currentFloor&&m.material.opacity<.8)faded++;}if(faded)sawFade=true;}
function drawMap(canvas:HTMLCanvasElement,floor:number){const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,g=map.ground;c.clearRect(0,0,w,h);c.fillStyle='#0d1316';c.fillRect(0,0,w,h);
 // Whole hotel and grounds fitted to the canvas; one floor at a time (B1, 1F with outdoors, 2F, RF).
 const scale=Math.min((w-30)/(g.maxX-g.minX),(h-30)/(g.maxZ-g.minZ)),ox=w/2-(g.minX+g.maxX)/2*scale,oy=h/2-(g.minZ+g.maxZ)/2*scale;
 const fill=(r:{minX:number;maxX:number;minZ:number;maxZ:number},color:string)=>{c.fillStyle=color;c.fillRect(ox+r.minX*scale,oy+r.minZ*scale,(r.maxX-r.minX)*scale,(r.maxZ-r.minZ)*scale);};
 const ZONE_TINT:Record<string,string>={staff:'rgba(240,180,60,.26)',secure:'rgba(226,54,43,.26)',outer:'rgba(150,150,140,.22)'};
 if(floor===0){for(const s of map.sections)fill(s,s.outdoor?'#1f292c':'#29373c');for(const wt of map.water)fill(wt,'#173c44');fill(map.pool,'#2b6d68');}else for(const f of map.floors.filter(f=>f.floor===floor))for(const a of f.areas)fill(a,'#2c373b');
 for(const r of map.rooms.filter(r=>r.floor===floor&&r.indoor))fill(r,'#33434a');for(const z of map.zones.filter(z=>z.floor===floor&&ZONE_TINT[z.type]))fill(z,ZONE_TINT[z.type]);
 for(const st of map.stairs.filter(st=>(st.floor??0)===floor||st.low<0&&floor===0||plateY(map,floor)===st.high)){c.strokeStyle='#8a9a95';c.setLineDash([3,3]);c.strokeRect(ox+st.minX*scale,oy+st.minZ*scale,(st.maxX-st.minX)*scale,(st.maxZ-st.minZ)*scale);c.setLineDash([]);}
 for(const b of map.walls.filter(b=>(b.floor??0)===floor)){const r=bounds(b);fill({minX:r.minX-.04,maxX:r.maxX+.04,minZ:r.minZ-.04,maxZ:r.maxZ+.04},b.id.includes('rail')?'#718b7c':'#d9d4c7');}
 for(const b of map.blockers.filter(b=>(b.floor??0)===floor&&!b.id.startsWith('water')&&b.id!=='pool'))fill(bounds(b),'#59655f');
 for(const k of map.checkpoints.filter(()=>floor===0)){c.fillStyle='#e2362b';c.fillRect(ox+k.x*scale-5,oy+k.z*scale-5,10,10);}
 for(const cm of map.cameras.filter(cm=>cm.floor===floor)){c.fillStyle='#5b8fd6';c.fillRect(ox+cm.x*scale-3,oy+cm.z*scale-3,6,6);}
 for(const e of map.exits.filter(e=>e.floor===floor)){c.beginPath();c.arc(ox+e.x*scale,oy+e.z*scale,8,0,Math.PI*2);c.strokeStyle=combat.closedExits().includes(e.id)?'#e2362b':flow.phase==='escape'?'#5fc7b0':'#8a9a95';c.lineWidth=3;c.stroke();c.fillStyle='#d9d4c7';c.font='13px system-ui';c.fillText(e.id,ox+e.x*scale+10,oy+e.z*scale+4);}
 for(const n of director.npcs){if(!n.active)continue;if(floorOf(n.pos.y)!==floor)continue;const x=ox+n.pos.x*scale,y=oy+n.pos.z*scale,color=STATE_COLOR[n.state];
  if(n.guard){const a=Math.atan2(Math.cos(n.heading),Math.sin(n.heading)),half=rules.vision.guard.half*Math.PI/180;c.beginPath();c.moveTo(x,y);c.arc(x,y,4.2*scale,a-half,a+half);c.closePath();c.fillStyle=n.state==='patrol'?'#efeadf30':color+'66';c.fill();}
  c.beginPath();c.arc(x,y,n.guard?5:3.2,0,Math.PI*2);c.fillStyle=n.guard?(n.state==='patrol'?'#33508f':color):'#c9c4b8';c.fill();c.strokeStyle='#0b0f12';c.lineWidth=1.2;c.stroke();}
 if(floor===currentFloor){c.save();c.translate(ox+position.x*scale,oy+position.z*scale);c.rotate(Math.PI-heading);c.beginPath();c.moveTo(0,-9);c.lineTo(6,6);c.lineTo(0,3);c.lineTo(-6,6);c.closePath();c.fillStyle='#f3efe6';c.fill();c.strokeStyle='#0b0f12';c.lineWidth=1.5;c.stroke();c.restore();}c.fillStyle='#8a9a95';c.font=`${Math.max(9,w/65)}px system-ui`;c.fillText('N ↑',w-38,18);if(w>500){c.font='12px system-ui';c.textAlign='center';for(const l of [...map.rooms.filter(r=>r.floor===floor).map(r=>({text:r.label,x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2})),...map.sections.filter(sc=>floor===0&&sc.outdoor).map(sc=>({text:sc.label,x:(sc.minX+sc.maxX)/2,z:(sc.minZ+sc.maxZ)/2}))]){c.fillStyle='#a9b8b2';c.fillText(l.text,ox+l.x*scale,oy+l.z*scale);}c.textAlign='left';}}
function updateUi(now:number){if(now-lastUi<100)return;lastUi=now;updateScheduleUi();if(mapOpen){drawMap($<HTMLCanvasElement>('#big-map'),mapFloor);document.querySelectorAll<HTMLButtonElement>('[data-map-floor]').forEach(b=>b.classList.toggle('active',Number(b.dataset.mapFloor)===mapFloor));}
 $('#guide').textContent=guideIndex>=0?'案内を中断':'M1 案内ルートを歩く';if(!$('#debug').hasAttribute('open'))return;
 const poseBox=new T.Box3().setFromObject(avatar,true);$('#metrics').textContent=JSON.stringify({poseBounds:{minY:+poseBox.min.y.toFixed(4),maxY:+poseBox.max.y.toFixed(4),height:+(poseBox.max.y-poseBox.min.y).toFixed(4)},position:{x:+position.x.toFixed(2),y:+position.y.toFixed(2),z:+position.z.toFixed(2)},floor:currentFloor+1,mode:crouched?'crouch':currentSpeed>2.6?'run':'walk',speed:+currentSpeed.toFixed(2),heading:+(heading*180/Math.PI).toFixed(1),wallFadeCount:faded,upperVisible:floorGroups.get(1)!.visible,zoom:zoom+1,camera:viewMode==='overhead'?{mode:viewMode,azimuth:45,elevation:50,fov:camera.fov}:{mode:viewMode,yaw:+(camYaw*180/Math.PI).toFixed(1),pitch:+(camPitch*180/Math.PI).toFixed(1),fov:camera.fov,boom:+camReach.toFixed(2),pointerLocked},character:agentLook.character,m4:{disguise:m4.disguise,wire:m4.hasWire,action:m4.action?.kind,progress:m4.progress,stats:m4.stats,passes:[...m4.passes.keys()],compromised:[...director.compromised]},lod:Object.fromEntries((['near','mid','far'] as const).map(t=>[t,director.npcs.filter(n=>n.active&&n.tier===t).length])),sectionsDrawn:sections.filter(s=>s.seen).map(s=>s.id),motion:m3View.metrics,m3:{training,action:m3.action?.kind??null,progress:+m3.progress.toFixed(2),dragged:m3.dragged?.id??null,hotel:m3.hotel.level,stats:m3.stats,bodies:director.npcs.filter(n=>n.life!=='active').map(n=>({id:n.id,life:n.life,mode:n.bodyMode,pos:n.pos})),slots:Object.fromEntries(m3.slots)},npcs:director.npcs.map(n=>`${n.id}:${n.state}:${Math.round(n.suspicion)}`),mission:{panel:+panelProgress.toFixed(2),over:missionOver,alerts:director.alerts,coins},model:modelReady?'GLB / procedural gait':modelError||'loading',gait:lastPose?{phase:+lastPose.phase.toFixed(3),amount:+lastPose.gait.toFixed(2),hip:+lastPose.hip.toFixed(3)}:null,fps:Math.round(1000/frameMs),jsFrameMs:+frameCost.toFixed(2),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webglError:renderer.getContext().getError()},null,2);
}
function clearCoinProps(){coinPickups.clear();for(const mesh of [...coinsInFlight.map(c=>c.mesh),...landedCoins,...ripples]){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as T.Material).dispose();}coinsInFlight.length=0;landedCoins.length=0;ripples.length=0;}
function animateProps(dt:number){for(let i=coinsInFlight.length-1;i>=0;i--){const c=coinsInFlight[i];c.t=Math.min(1,c.t+dt/.55);c.mesh.position.lerpVectors(c.from,c.to,c.t);c.mesh.position.y+=Math.sin(Math.PI*c.t)*1.1;c.mesh.rotation.x+=dt*18;if(c.t>=1){c.mesh.position.copy(c.to);c.mesh.rotation.set(0,0,0);coinsInFlight.splice(i,1);landedCoins.push(c.mesh);landCoin(c.mesh);}}
 for(let i=ripples.length-1;i>=0;i--){const r=ripples[i];r.userData.age+=dt;const a=r.userData.age/1.4;r.scale.setScalar(1+a*14);(r.material as T.MeshBasicMaterial).opacity=.9*(1-a);if(a>=1){scene.remove(r);ripples.splice(i,1);}}
 exitRings.forEach((r,i)=>{(r.material as T.MeshBasicMaterial).opacity=flow.phase==='escape'&&!combat.closedExits().includes(map.exits[i].id)?.55+.25*Math.sin(performance.now()/260):0;});}
// Over-head meters: a ring that fills with suspicion and a ? or ! for the state; off screen they cling to the edge and point the way.
const markPos=new T.Vector3();
const ZONE_LABEL={public:'公共',staff:'スタッフ',secure:'厳重',outer:'外周'} as const,HINTS:[string,string][]=[['WASD','移動'],['Shift','走る'],['C','しゃがむ'],['F / X','気絶 / 排除'],['E','運ぶ・隠す'],['T','着替え'],['B','検査'],['H','道具を置く'],['G','コイン'],['V','視点'],['Z','ズーム'],['Q','銃を出す・長押しで捨てる'],['クリック','撃つ'],['R','弾込め'],['R長押し','やり直し'],['U','手の物を置く']];
// Everything the canvas HUD shows, gathered once per frame.
function drawHud(now:number){const w=innerWidth,h=innerHeight,s=hudState,t=now/1000;
 const zone=map.zones.find(z=>z.floor===currentFloor&&position.x>=z.minX&&position.x<=z.maxX&&position.z>=z.minZ&&position.z<=z.maxZ),here=zoneAt(mission.zones,position.x,position.z,currentFloor),perm=permission(rules,m4.disguise,here) as Perm;
 $('#m4-status').textContent=`M4 · ${m4.label} · ワイヤー${m4.hasWire?'所持':'なし'}${m4.compromised?' · バレた服（着替えて見られずに30m離れると解除）':''}${director.npcs.some(n=>n.active&&n.knowsFace(m4.disguise,m4.outfitOwner))?' · 白い印はこの服の顔を知っている人':''}`;s.time=t;s.codename=agentLook.codename;s.floor=floorLabel(currentFloor);s.zone=map.stairs.some(st=>inside(st,position.x,position.z)&&position.y>st.low+.08&&position.y<st.high-.08)?'階段':zone?.label||map.sections.find(sc=>inside(sc,position.x,position.z))?.label||'屋外';$('#m3-status').textContent=`M3 · ホテル警戒度 ${m3.hotel.level}/3${m3.dragged?' · 運搬中':''}`;s.perm=perm;s.disguise=m4.compromised?`${m4.label} ✕バレた`:m4.label;
 s.perms=(['public','staff','secure','outer'] as const).map(k=>({label:ZONE_LABEL[k],perm:rules.disguises[m4.disguise][k] as Perm,here:(here?.type??'public')===k}));
 const hot=director.hottest(),watchers=director.npcs.filter(n=>n.suspicion>1).length;s.suspicion=hot?.suspicion??0;s.suspicionColor=hot?STATE_COLOR[hot.state]:'#f3efe6';s.who=s.suspicion>.5&&hot?`${hot.label}${watchers>1?` ほか${watchers-1}名`:''}`:'誰にも注目されていない';s.alerts=director.alerts;s.coins=coins;
 const states=new Set(director.npcs.filter(n=>n.active).map(n=>n.state));s.alarm={text:states.has('alert')?'警戒 — 追跡されている':states.has('search')?'捜索中 — 視界の外へ':states.has('investigate')||states.has('report')?'確認に来ている':'',level:states.has('alert')?2:1};
 s.objectives=m4Training?[{text:'Tで制服に着替える',state:m4.stats.changes?'done':'todo'},{text:'Bで大階段の検査を通過',state:m4.stats.frisks?'done':'todo'},{text:'検査を通って2Fへ上がる',state:enteredStaff?'done':'todo'}]:training?[{text:'背後から気絶または排除する',state:m3.stats.knockouts+m3.stats.kills>0?'done':'todo'},{text:'Eで運び、プール西側のタオル棚へ隠す',state:m3.stats.hidden>0?'done':'todo'}]:[...missionData.targets.map(id=>{const n=director.npcs.find(n=>n.id===id)!;return {text:`${n.label}を排除する`,state:n.life==='dead'?'done' as const:'todo' as const};}),{text:'出口（E1〜E5）から脱出する',state:missionOver==='win'?'done':'todo'},{text:'ゴースト（見つからない・死体を見つけられない・ターゲット以外を倒さない）',state:ledger.ghost(scoringData)?(missionOver==='win'?'done':'todo'):'failed',bonus:true}];
 s.hint=guideIndex>=0?'M1 案内ルート：ロビー → 大階段で2F → プール':flow.phase==='escape'?'出口E1〜E5のどれかへ。走ると目立つ。':(m4Training?'制服を着たらロビーの大階段の検査へ。白い印の人（顔を知っている人）の正面に近づき過ぎない。':'裏通路など黄色のスタッフ区画はスーツでは立入不可。');
 s.mode=`${crouched?'しゃがみ':currentSpeed>2.6?'走行':'歩行'} · ${VIEW_LABEL[viewMode]}`;s.hints=HINTS;s.reticle=viewMode!=='overhead'&&!missionOver;
 const age=(now-toastAt)/1000;s.toast=age<3.4&&toastText?{text:toastText,age}:null;
 const m3Prompt=m3.prompt(position),drop=!training&&!m3Prompt?combat.nearestDrop(position):undefined,detPrompt=training||m3Prompt||drop?null:detectionPrompt();s.prompt=m4.prompt(position)??(m3View.transferKind==='pickup'?{text:'身体をつかんで持ち上げる…',progress:m3View.transferProgress}:m3Prompt?{text:m3Prompt,progress:m3.progress}:drop?{text:`E 拾う：${weaponDefs[drop.gun.id].label}（${drop.gun.mag}発）`,progress:0}:detPrompt);
 s.radar={x:avatar.position.x,z:avatar.position.z,heading,yaw:viewMode==='overhead'?-Math.PI*.75:camYaw,floor:currentFloor,npcs:director.npcs.filter(n=>n.active&&floorOf(n.pos.y)===currentFloor).map(n=>({x:n.pos.x,z:n.pos.z,heading:n.heading,guard:n.guard,color:STATE_COLOR[n.state],active:n.state!=='patrol'})),
  targets:flow.phase==='escape'?map.exits.filter(e=>e.floor===currentFloor).map(e=>({x:e.x,z:e.z,kind:'exit' as const})):[]};
 const marks:HudMark[]=[];if(!missionOver)for(const v of npcViews){const n=v.npc;if(!n.active)continue;if(!(n.knowsFace(m4.disguise,m4.outfitOwner)||n.suspicion>1||!['patrol','distracted'].includes(n.state)))continue;
  markPos.set(v.group.position.x,v.group.position.y+2.15,v.group.position.z).project(camera);let x=markPos.x,y=markPos.y;const behind=markPos.z>1;if(behind){x=-x;y=-y;}
  const edge=behind||Math.abs(x)>.9||Math.abs(y)>.84;if(edge){const k=1/Math.max(Math.abs(x)/.9,Math.abs(y)/.84,1e-6);x*=k;y*=k;}
  marks.push({x:(x*.5+.5)*w,y:(-y*.5+.5)*h,edge,angle:Math.atan2(-y,x),pct:n.suspicion,glyph:n.state==='alert'||n.state==='report'?'!':n.state==='search'?'…':n.state==='patrol'?'':'?',color:STATE_COLOR[n.state]??'#f3efe6',hot:n.state==='alert',face:n.knowsFace(m4.disguise,m4.outfitOwner)&&!director.compromised.has(m4.disguise)?n.face:undefined});}
 s.marks=marks;s.labels=[];for(const l of navLabels){if(l.floor!==currentFloor)continue;const p=new T.Vector3(l.x,l.y,l.z),d=camera.position.distanceTo(p);p.project(camera);if(p.z<1&&(viewMode==='overhead'||d<16)&&Math.abs(p.x)<.9&&Math.abs(p.y)<.85)s.labels.push({x:(p.x*.5+.5)*w,y:(-p.y*.5+.5)*h,text:l.text});}
 for(const v of npcViews){const n=v.npc;if(!n.target||!n.active||floorOf(n.pos.y)!==currentFloor)continue;markPos.set(v.group.position.x,v.group.position.y+2.55,v.group.position.z).project(camera);if(markPos.z<1&&Math.abs(markPos.x)<.9&&Math.abs(markPos.y)<.8)s.labels.push({x:(markPos.x*.5+.5)*w,y:(-markPos.y*.5+.5)*h,text:'TARGET · '+n.label});}
 if(!training){const field=m53.prompt(playerView(),heading)??m57.prompt(playerView());if(field)s.prompt=field;if(m53.isRestricted(position)){s.perm='deny';s.hint='事故現場は立入禁止。黄色い線の外へ。';}}
 if(restartHold.progress>0)s.prompt={text:'R 長押し 最初からやり直す…',progress:restartHold.progress};
 hud.draw(s);gunReticle();}
function detectionPrompt():{text:string;progress:number}|null{const p=playerView(),d=detection;if(d.action)return {text:d.action.kind==='erase'?'記録を消している…':'録画機を壊している…',progress:d.action.elapsed/d.action.duration};
 if(d.blend)return {text:`溶け込み中：${d.blend.label} — E か移動でやめる`,progress:0};const f=d.nearestItem(position);if(f){const l=d.legality(f.item,p.disguise),it=d.data.items[f.item];return {text:`E 拾う：${it?.label??f.item}（${l.legality==='suspicious'?(l.ok?'この服なら持っていてよい':'この服では疑われる'):l.legality==='illegal'?'違法':'普通'}）`,progress:0};}
 const b=d.blendSpot(p);if(b)return {text:`E ${b.label}（溶け込む）`,progress:0};const o=d.otherBlend(p);if(o)return {text:`${o.label}：${o.disguises.map(x=>rules.disguises[x]?.label??x).join('・')}の服で溶け込める`,progress:0};
 if(d.nearRecorder(position)){const here=zoneAt(mission.zones,position.x,position.z,currentFloor);return {text:permission(rules,p.disguise,here)==='allow'?'E 長押し 録画の記録を消す（静か）':'E 長押し 録画機を壊す（音が出る）',progress:0};}return null;}
function gunReticle(){const el=$('#gun-reticle'),on=!!combat.hand&&!missionOver&&!paused&&!training;el.classList.toggle('on',on);if(!on)return;const h=aimHit();
 el.classList.toggle('person',!!h.npc);el.classList.toggle('head',!!h.npc&&h.head);el.querySelector('b')!.textContent=h.npc?(h.head?'頭':h.npc.label):'';
 const at=viewMode==='overhead'?{x:(pointer.x*.5+.5)*innerWidth,y:(-pointer.y*.5+.5)*innerHeight}:{x:innerWidth/2,y:innerHeight/2};el.style.left=at.x+'px';el.style.top=at.y+'px';}
function resize(){const w=innerWidth,h=innerHeight;hud.resize();renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
let last=performance.now(),accumulator=0;const dt=1/60;
function tick(now:number){lastNow=now;const start=performance.now(),elapsed=Math.min((now-last)/1000,.1);last=now;frameMs=T.MathUtils.lerp(frameMs,elapsed*1000,.05);const frozen=paused||mapOpen||helpOpen||!modelReady||document.hidden||!!missionOver||creatorOpen||prepOpen;if(frozen){restartHold.clear();accumulator=0;previous={...position};}else{accumulator+=elapsed*(training?1:clock.rate);while(accumulator>=dt){fixedUpdate(dt);accumulator-=dt;}}
 const blend=accumulator/dt;avatar.position.set(T.MathUtils.lerp(previous.x,position.x,blend),T.MathUtils.lerp(previous.y,position.y,blend)-.025,T.MathUtils.lerp(previous.z,position.z,blend));avatar.rotation.y=frozen?heading:previousHeading+angleDelta(previousHeading,heading)*blend;animateActor(frozen?0:elapsed);for(const v of npcViews){const n=v.npc,o=n.fallOrigin,t=n.fall;const px=o&&t<1?T.MathUtils.lerp(o.x,n.pos.x,t):n.pos.x,py=o&&t<1?T.MathUtils.lerp(o.y,n.pos.y,t):n.pos.y,pz=o&&t<1?T.MathUtils.lerp(o.z,n.pos.z,t):n.pos.z;npcSphere.center.set(px,py+.9,pz);v.offscreen=!frustum.intersectsSphere(npcSphere);npcShadowSphere.center.copy(npcSphere.center);v.culled=!frustum.intersectsSphere(npcShadowSphere)||viewMode==='overhead'&&!npcLayerVisible(map,o&&t<1?{x:px,y:py,z:pz}:n.pos,currentFloor,camera.position,npcSphere.radius,rulesData.render.npcOcclusionMargin);v.render(frozen?0:elapsed*(training?1:clock.rate),frozen?1:blend,visualGround);}m3View.render(m3,rig,avatar,playerScene,npcViews,visualGround);if(!training){m53View.render(m53);if(!training)m57View.render(m57,clock.elapsed);combatView.render(combat,clock.elapsed,npcViews);if(!training)detectionView.render(detection,m4.disguise,scene,rig,performance.now());if(m53.locked&&rig){rig.rotate('upperarmr',-.75,0,1.1);rig.rotate('forearmr',0,1.4);}}else m53View.root.visible=false;if(playerScene&&rig){m4View.refresh(playerScene,rig,m4,agentLook,npcTemplates);m4View.bodies(m4,npcViews,npcTemplates);m4View.render(m4,rig,npcViews);}renderHeldCoins(coinPickups.held,npcViews);if(!frozen)animateProps(elapsed);
 if(viewMode==='overhead'){for(const [f,g] of floorGroups)g.visible=f<=Math.max(0,currentFloor);const desiredTarget=new T.Vector3(avatar.position.x+(zoom===0?3:0),avatar.position.y+.8,avatar.position.z-(zoom===0?1:0));camTarget.lerp(desiredTarget,1-Math.exp(-9*elapsed));camDesired.copy(camTarget).add(offset(distanceForZoom()));camera.position.lerp(camDesired,1-Math.exp(-9*elapsed));camera.lookAt(camTarget);camera.updateMatrixWorld();}
 else{for(const g of floorGroups.values())g.visible=true;if(guideIndex>=0&&viewMode==='third'&&!frozen)camYaw+=angleDelta(camYaw,heading)*(1-Math.exp(-2.5*elapsed));placeViewCamera(frozen?0:elapsed);}
 // In first person the head collapses so the eye camera can sit inside it while the body stays visible.
 avatar.visible=viewMode!=='third'||camReach>.7;const head=rig?.joints.get('head');if(head)head.bone.scale.setScalar(viewMode==='first'?.001:rig!.headScale);
 aimRay.setFromCamera(pointer,camera);cursorPoint=aimRay.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-position.y),new T.Vector3());scene.updateMatrixWorld(true);fadeWalls(elapsed);
 // The game view is not drawn behind the loading screen or the creator.
 if(modelReady&&!creatorOpen){sun.position.set(avatar.position.x-12,avatar.position.y+23,avatar.position.z+10);sun.target.position.set(avatar.position.x,avatar.position.y,avatar.position.z);sun.target.updateMatrixWorld();cullSections();renderer.render(scene,camera);drawHud(now);}frameCost=T.MathUtils.lerp(frameCost,performance.now()-start,.08);updateUi(now);requestAnimationFrame(tick);
}
Object.assign(window,{__cleanHands:{director:()=>director,aiDebug:()=>({npcs:director.debug(),zoneAlert:Object.fromEntries(director.zoneAlert),hotelAlert:m3.hotel.level,weaponDrawn:!!combat.hand,illegalVisibleCarry:combat.shown(m4.disguise),reinforcementWave:combat.waves,reinforcementRemaining:combat.snapshot().reinforcementRemaining}),teleport:(x:number,z:number,y=0)=>{position={x,y,z};previous={...position};currentFloor=floorAt(y,floorOf(y));snapCamera();},view:(yaw:number,pitch=.3)=>{camYaw=yaw;camPitch=pitch;},faces:()=>npcViews.map(v=>v.face?.morphTargetInfluences?.map(x=>+x.toFixed(2))),state:()=>({position,panelProgress,panelDone,missionOver,coins,coinProps:{flying:coinsInFlight.filter(c=>c.mesh.parent===scene).length,landed:landedCoins.filter(c=>c.parent===scene).length,ripples:ripples.filter(c=>c.parent===scene).length},currentFloor,paused,mapOpen,helpOpen,creatorOpen,modelReady,clock:clock.snapshot(),schedule:schedule.snapshot(),dialogue:dialogue.snapshot(),alert:m3.hotel.level}),clock:()=>clock.snapshot(),schedule:()=>schedule.snapshot(),dialogue:()=>dialogue.snapshot(),events:()=>events.recent.map(e=>({...e})),eventBus:()=>events,timeScale:(rate:number)=>clock.setRate(rate),jumpTime:(seconds:number)=>jumpTime(seconds),disguise:(id:string)=>{if(!rules.disguises[id])throw new Error('未知の変装');m4.disguise=id;m4.revision++;},performance:()=>({fps:1000/frameMs,jsFrameMs:frameCost,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,visibleNpcModels:npcViews.filter(v=>v.group.visible).length}),m57:()=>m57.snapshot(),m57System:()=>m57,m53:()=>m53.snapshot(),combat:()=>combat.snapshot(),detection:()=>detection.snapshot(playerView()),detectionSystem:()=>detection,combatSystem:()=>combat,aim:()=>{const h=aimHit();return {npc:h.npc?.id??null,head:h.head,point:h.point};},shoot:(x:number,y:number,z:number)=>{const r=combat.fire(playerView(),{x,y,z},clock.elapsed);if(r.fired)combatView.play('fire',performance.now(),combat.hand);return {fired:r.fired,hit:r.hit?.id??null,head:r.head,killed:r.killed};},mission:()=>({phase:flow.phase,outcome:flow.outcome,targets:flow.targets,remaining:flow.remaining(),loadout,prepOpen,counts:Object.fromEntries(ledger.counts),ghost:ledger.ghost(scoringData),result:lastResult}),score:()=>computeResult(scoringData,ledger.counts,clock.elapsed,true),chances:()=>m53.chances.snapshot(clock.time,clock.rules.loop),traps:()=>({barrel:m53.barrel,definitions:killsData}),killLog:()=>m53.snapshot().kills,field:()=>m53,hotel:()=>m3.hotel}});
void loadPlayer();requestAnimationFrame(tick);

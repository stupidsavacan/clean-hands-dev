// The observatory's movie camera (2026-11-13): observatory-trailer.html runs the real game and films it.
// The people, the storm, the power and the air in every shot are the game's own, running as they do in play; the
// film chooses where the camera is, lets the mission clock run to the moments worth seeing, flips the same switches
// the player can, walks Agent 07 with the player's keys, and dresses the outside of the buildings (film-set.ts).
//
// How a frame is made: the page owns the clock (requestAnimationFrame and performance.now are replaced before the
// engine starts), so each frame advances the game by exactly 1/30 s however long drawing takes. After the engine's own
// frame, the scene is drawn again at a larger size with shadows, depth of field and bloom, and the picture is posted to
// tools/stage-server.py, which saves it under movie/frames/<take>/. scripts/make-movie.py cuts the takes together.
//
//   observatory-trailer.html?run=1      the storm, the outage and the lightning takes
//   observatory-trailer.html?run=2      the cryo lab takes
//   &only=aerial,strike                 just these takes     &scale=1  the picture size factor (default 1.5)
import * as T from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/examples/jsm/postprocessing/BokehPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {buildFilmSet} from './film-set';
import {filmHandles} from './scenery';
import type {ObservatoryWorld} from './world';

type V=[number,number,number];
type Shot={eye:V;target:V;fov?:number;
 /** 1: roofs on (an exterior), 0: the game's open rooms. */
 roof?:number;
 /** Depth of field: how far the sharp plane is (m) and how strong the blur. */
 focus?:number;blur?:number};
type Take={
 name:string;
 /** The room the shot is lit for, and whether it is a wide outdoor shot (more rain, further out). */
 room:string;wide?:boolean;
 /** Mission second the take starts at. */
 at:number;frames:number;
 /** Flip switches, move the player (called once the clock is at `at`). */
 before?:(c:Game)=>void;
 /** Keys held during the take (the player walks, or works a switch). */
 keys?:string[];
 /** Staged takes: move the actors for frame k (called before the game steps). */
 direct?:(k:number,c:Game)=>void;
 /** The camera for frame k of the take (u = 0..1 through the take). */
 camera:(u:number,c:Game)=>Shot;
};
type Game={
 gfx:()=>{renderer:T.WebGLRenderer;scene:T.Scene;camera:T.PerspectiveCamera;sun:T.DirectionalLight};
 inspectionCamera:(eye:{x:number;y:number;z:number},target:{x:number;y:number;z:number})=>void;
 teleport:(x:number,z:number,y?:number)=>void;view:(yaw:number,pitch?:number)=>void;disguise:(id:string)=>void;
 timeScale:(rate:number)=>void;state:()=>{position:{x:number;y:number;z:number}};
 director:()=>{npcs:Actor[]};
};
// What the film touches on a person: where they are, which way they face, how fast they move (that picks the walk),
// and `busy`, which takes them out of the game's AI so the film can lead them.
type Actor={id:string;life:string;bodyMode:string;pos:{x:number;y:number;z:number};heading:number;speed:number;busy:boolean;scriptedAction:string;actionTime:number};
type Stage={operate:(id:string)=>void;world:()=>ObservatoryWorld|undefined;focus:(room:string)=>void;snapshot:()=>{duty:unknown;flags:string[]};
 rain:{count:number;box:number;top:number;width:number;length:number;opacity:number}};

// ---- the clock --------------------------------------------------------------------------------------------------
const realRaf=window.requestAnimationFrame.bind(window),realNow=performance.now.bind(performance);
let virtual:number|null=null;
const queue:FrameRequestCallback[]=[];
window.requestAnimationFrame=cb=>{if(virtual===null)return realRaf(cb);queue.push(cb);return queue.length;};
performance.now=()=>virtual??realNow();
function advance(ms:number){virtual!+=ms;for(const cb of queue.splice(0))cb(virtual!);}

const params=new URLSearchParams(location.search);
const RUN=params.get('run')??'1',ONLY=params.get('only')?.split(','),SCALE=Number(params.get('scale')??1.5);
const smooth=(u:number)=>u*u*(3-2*u);
const mix=(a:V,b:V,u:number):V=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];
const npc=(c:Game,id:string)=>c.director().npcs.find(n=>n.id===id)!;
// The technician sleeps in the generator shed, where nobody goes: found, he would be woken and mend what was broken.
const knockOut=(c:Game,id:string)=>{const n=npc(c,id);n.life='unconscious';n.bodyMode='ground';Object.assign(n.pos,{x:3.3,y:0,z:29.5});};
const stage=()=>(window as unknown as {__observatory:Stage}).__observatory;
// Leading an actor: a path to walk (x, z points on their floor), then what they do and which way they face there.
const leads=new Map<string,{path:number[][];heading:number;action:string;at:number;startFrame:number}>();
function lead(c:Game,id:string,path:number[][],heading:number,action:string){
 const n=npc(c,id);n.busy=true;n.pos.x=path[0][0];n.pos.z=path[0][1];n.speed=0;n.scriptedAction=action;
 leads.set(id,{path,heading,action,at:0,startFrame:-1});
}
function walk(c:Game,id:string,k:number,pace=1.25){
 const n=npc(c,id),l=leads.get(id);
 if(!l||n.life!=='active')return;
 if(l.startFrame<0)l.startFrame=k;
 n.busy=true;
 const next=l.path[l.at+1];
 if(!next){n.speed=0;n.heading+=Math.atan2(Math.sin(l.heading-n.heading),Math.cos(l.heading-n.heading))*.15;n.scriptedAction=l.action;return;}
 const dx=next[0]-n.pos.x,dz=next[1]-n.pos.z,d=Math.hypot(dx,dz),step=pace/30;
 const want=Math.atan2(dx,dz);n.heading+=Math.atan2(Math.sin(want-n.heading),Math.cos(want-n.heading))*.3;
 if(d<=step){n.pos.x=next[0];n.pos.z=next[1];l.at++;}else{n.pos.x+=dx/d*step;n.pos.z+=dz/d*step;}
 n.speed=pace;
}

// ---- the takes, in mission order for each run ---------------------------------------------------------------------
const RUNS:Record<string,Take[]>={
 '1':[
  // Agent 07 walks up from the gate toward the lit building.
  {name:'approach',room:'yard',at:3,frames:200,keys:['KeyW'],before:c=>{c.teleport(28,.9,0);c.view(0,.1);},
   camera:(u,c)=>{const p=c.state().position;return {eye:[p.x-1.5+u*.5,.55+u*.25,p.z-3.6+u*.5],target:[p.x+.35,2.3,p.z+7],fov:38,roof:1,focus:4.2,blur:.6};}},
  // The director at his console.
  {name:'target',room:'control',at:40,frames:210,
   camera:u=>({eye:mix([17.9,3.1,25.9],[17.2,2.5,26.6],smooth(u)),target:[13.3,1.35,28.7],fov:30,focus:5,blur:.7})},
  // The lobby and its orrery.
  {name:'lobby',room:'lobby',at:60,frames:200,
   camera:u=>{const a=-2.2+smooth(u)*.75;return {eye:[28+Math.cos(a)*6.2,2.1+u*.5,16.5+Math.sin(a)*6.2],target:[28,1.45,16.5],fov:36,focus:6.2,blur:.5};}},
  // The whole mountain top as the storm peaks: a closed building first, then it opens up (a strike on the rod at 255).
  {name:'aerial',room:'yard',wide:true,at:243,frames:540,
   camera:u=>{const a=-2.05+smooth(u)*.95,r=66-u*12;return {eye:[28+Math.cos(a)*r,30-u*9,27+Math.sin(a)*r],target:[28,4.5,27],fov:30,roof:1-smooth(Math.max(0,Math.min(1,(u-.5)/.12)))};}},
  // Lightning takes the line (375).
  {name:'pole',room:'west',at:371.4,frames:138,
   camera:u=>({eye:mix([3.2,1.4,17.6],[3.8,1.6,18.4],u),target:[9,6.6,27],fov:50,roof:1})},
  // The front of the building on emergency power, until the generator catches (383).
  {name:'facade',room:'yard',at:376.2,frames:300,
   camera:u=>({eye:mix([16.5,1.1,1.6],[18,1.3,2.6],smooth(u)),target:[27,3.6,13],fov:40,roof:1})},
  {name:'generator',room:'gen',at:386.4,frames:110,
   camera:u=>({eye:mix([7.3,2.7,35.3],[7.0,2.4,34.9],u),target:[4.3,1.0,31.2],fov:52,focus:4.6,blur:.4})},
  // Cold rooms empty: people round the stove. The rod's earth cable and the shutter drive are dealt with here.
  {name:'stove',room:'lounge',at:548,frames:210,before:c=>{knockOut(c,'tech');stage().operate('ground_cable');stage().operate('brk_dome');},
   camera:u=>({eye:mix([17.4,4.6,10.9],[16.8,3.6,11.8],smooth(u)),target:[12.4,1,16],fov:38,focus:7.2,blur:.5})},
  // The lull: the dome stands open.
  {name:'dome',room:'north',wide:true,at:604,frames:210,
   camera:u=>{const a=1.25+smooth(u)*.35;return {eye:[28+Math.cos(a)*30,17-u*2,30+Math.sin(a)*30],target:[28,9.5,31],fov:30,roof:1};}},
  // The rain is back and the shutter will not close: the director cranks it by hand.
  {name:'crank',room:'catwalk',at:704,frames:240,
   camera:u=>({eye:mix([31.6,4.6,41.6],[30.9,4.9,41.2],smooth(u)),target:[28,4.9,39.2],fov:36,roof:1,focus:3.6,blur:.55})},
  // 13:03.
  {name:'strike',room:'north',wide:true,at:778.6,frames:260,
   camera:u=>({eye:mix([42,10.5,51],[40.5,11.5,49.5],u),target:[28,7.5,36],fov:34,roof:1})},
  // Agent 07 walks out through the gate as the rod is hit again (808).
  {name:'exit',room:'yard',at:800.5,frames:290,keys:['KeyS'],before:c=>{c.teleport(29.5,8.6,0);c.view(0,.1);},
   camera:(u,c)=>{const p=c.state().position;return {eye:[p.x+1.1-u*.5,.75+u*.2,p.z-4.4],target:[p.x-.2,2.9,p.z+6],fov:40,roof:1,focus:4.6,blur:.5};}},
 ],
 '2':[
  // Agent 07, dressed as the technician, opens the nitrogen valve himself. The fans are off, the monitor is
  // unplugged, the detector's cooler is stopped.
  {name:'valve',room:'cryo',at:300,frames:230,keys:['KeyE'],
   before:c=>{knockOut(c,'tech');c.disguise('technician');c.teleport(22.75,31.55,0);c.view(-Math.PI/2,.1);for(const id of ['brk_vent','o2_sensor','brk_compressor'])stage().operate(id);},
   camera:u=>({eye:mix([25.6,1.75,29.2],[25.1,1.55,29.6],smooth(u)),target:[22.1,1.15,31.5],fov:38,focus:3.9,blur:.6})},
  // He leaves; the fog stays.
  {name:'fog',room:'cryo',at:340,frames:160,before:c=>{c.disguise('suit');c.teleport(28,8.6,0);},
   camera:u=>({eye:mix([24.8,1.3,27],[24.4,1.1,27.4],u),target:[22.3,.7,31.5],fov:44,focus:4.5,blur:.5})},
  // The director comes to look at his detector.
  // (The line is struck at 375: the lab goes to emergency light, then the generator brings it back.)
  {name:'enter',room:'cryo',at:378,frames:1400,
   camera:u=>({eye:mix([21.8,2.6,26.2],[22.2,2.3,26.5],smooth(Math.min(1,u*1.6))),target:[26.1,1,30.2],fov:42})},
 ],
 // The staged takes: no waiting for the night to get there. The film sets the air and leads the actors itself.
 '4':[
  // The director comes in to look at his detector; the air in the lab is already thin (the valve is open, the fans
  // are off). He works at the bench, and the room does the rest: the fall is the game's own.
  {name:'enter',room:'cryo',at:2,frames:330,
   before:c=>{
    for(const id of ['brk_vent','o2_sensor','ln2_valve'])stage().operate(id);
    stage().world()!.air.room('cryo').o2=.112;
    lead(c,'researcher_b',[[43.4,29.4]],0,'drink');
    // His escort waits in the corridor, as he does in the game.
    lead(c,'aide',[[24.7,23.6]],0,'idle');
    lead(c,'director',[[24.3,25.7],[24.6,27.6],[26.3,30.5]],0,'work');
   },
   direct:(k,c)=>{walk(c,'director',k);walk(c,'aide',k);walk(c,'researcher_b',k);},
   camera:u=>({eye:mix([21.7,2.5,26.1],[22.3,2.1,26.7],smooth(u)),target:[25.9,1,30.1],fov:44})},
  // The same, from the floor.
  {name:'fall',room:'cryo',at:15,frames:270,
   before:c=>{
    const d=npc(c,'director');Object.assign(d,{life:'active',bodyMode:'ground'});
    stage().world()!.air.room('cryo').o2=.1108;
    lead(c,'director',[[25.2,28.2],[26.3,30.5]],0,'work');
   },
   direct:(k,c)=>{walk(c,'director',k);walk(c,'aide',k);walk(c,'researcher_b',k);},
   camera:u=>({eye:mix([24.1,.45,31.9],[24.4,.55,31.6],smooth(u)),target:[26.3,1.0,30.4],fov:40,focus:2.4,blur:.5})},
 ],
 '3':[
  // The lobby when the line is struck: emergency light.
  {name:'blackout',room:'lobby',at:378.2,frames:230,
   camera:u=>({eye:mix([29.6,2.5,11],[28.8,2.2,12.2],smooth(u)),target:[27.6,1.25,18.5],fov:46})},
 ],
};

// ---- filming ------------------------------------------------------------------------------------------------------
const post=(path:string,body:Blob|string)=>fetch(path,{method:'POST',body}).then(r=>{if(!r.ok)throw new Error(path+' '+r.status);});
const log=(text:string)=>post('/movie/log',`[run ${RUN}] ${text}`).catch(()=>{});
const real=(ms:number)=>new Promise<void>(done=>setTimeout(done,ms));

async function film(){
 // Wait for the game, then start the mission the way a player does.
 for(;;){
  const start=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('作戦開始'));
  const game=(window as unknown as {__cleanHands?:Game}).__cleanHands;
  if(start&&game&&!document.querySelector('#loading:not([hidden])')){await real(1500);start.click();break;}
  await real(250);
 }
 await real(1500);
 const c=(window as unknown as {__cleanHands:Game}).__cleanHands,{renderer,scene,camera,sun}=c.gfx();
 const canvas=renderer.domElement,W=Math.round(1920*SCALE),H=Math.round(1080*SCALE);
 await log(`start ${W}x${H}`);
 const world=()=>stage().world()!.time;
 // The models load in real time: the page takes over the clock only once the mission is running.
 for(let waited=0;!stage().world()||world()<.4;waited+=200){
  await real(200);
  // The start button did nothing if it was pressed before the page was ready: press it again.
  if(waited>60000)throw new Error('Mission did not start: '+JSON.stringify(c.state()));
  if(waited%4000===3800)await log('loading '+JSON.stringify(c.state()));
  if(waited%4000===3800)[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('作戦開始')&&b.offsetParent)?.click();
 }
 // The film's picture: moonlight and room lamps that cast shadows, depth of field, and bloom on everything that glows.
 const set=buildFilmSet(scene,filmHandles.domeShell);
 renderer.setPixelRatio(1);renderer.setSize(W,H,false);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
 Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:120});sun.shadow.camera.updateProjectionMatrix();
 sun.shadow.map?.dispose();sun.shadow.map=null as unknown as T.WebGLRenderTarget;
 scene.traverse(o=>{const l=o as T.PointLight;if(l.isPointLight&&l.distance===16){l.castShadow=true;l.shadow.mapSize.set(1024,1024);l.shadow.bias=-.004;l.shadow.radius=4;}});
 scene.traverse(o=>{const m=(o as T.Mesh).material;for(const x of Array.isArray(m)?m:m?[m]:[])x.needsUpdate=true;});
 const target=new T.WebGLRenderTarget(W,H,{type:T.HalfFloatType,samples:4});
 const composer=new EffectComposer(renderer,target);
 composer.setPixelRatio(1);composer.setSize(W,H);
 composer.addPass(new RenderPass(scene,camera));
 const bokeh=new BokehPass(scene,camera,{focus:10,aperture:0,maxblur:.008});
 composer.addPass(bokeh);
 composer.addPass(new UnrealBloomPass(new T.Vector2(W,H),.55,.7,.82));
 composer.addPass(new OutputPass());
 const uniforms=bokeh.uniforms as Record<string,{value:number}>;
 const draw=(shot:Shot)=>{
  const w=stage().world()!;
  // Thunder overhead shakes the camera for a moment.
  let shake=0;
  for(const s of w.weather.strikes){const dt=w.time-s.time-s.delay;if(dt<-.05)break;if(s.kind!=='far'&&dt<1.5)shake=Math.max(shake,.05*Math.exp(-Math.max(0,dt)*3));}
  const sx=Math.sin(w.time*63)*shake,sy=Math.sin(w.time*47+1)*shake*.7;
  camera.position.set(shot.eye[0]+sx,shot.eye[1]+sy,shot.eye[2]);camera.fov=shot.fov??30;camera.aspect=W/H;camera.updateProjectionMatrix();
  camera.lookAt(shot.target[0]+sx*.6,shot.target[1]+sy*.6,shot.target[2]);camera.updateMatrixWorld();
  // The moon's shadow box stays over the buildings instead of following the player.
  sun.position.set(28-22,42,24+18);sun.target.position.set(28,0,24);sun.target.updateMatrixWorld();sun.updateMatrixWorld();
  set.roof(shot.roof??0);set.update(w);
  bokeh.enabled=!!shot.blur;
  if(shot.blur){uniforms.focus.value=shot.focus??8;uniforms.aperture.value=shot.blur*.00005;uniforms.maxblur.value=.006;}
  renderer.render=renderScene;composer.render();renderer.render=()=>{};
 };
 // Simulation-only frames need no GPU draw; the engine still updates the scene.
 const renderScene=renderer.render.bind(renderer);
 renderer.render=()=>{};
 virtual=realNow();
 await log('simulation ready');
 for(const take of RUNS[RUN]){
  // Run the clock to the take (four times as fast, without filming).
  c.timeScale(4);
  let guard=0,lastWorld=world(),stalled=0;
  while(world()<take.at-.3){advance(1000/30);if(++guard%40===0)await real(0);if(guard%1200===0){stalled=world()<=lastWorld?stalled+1:0;lastWorld=world();if(stalled>=2)throw new Error(`Clock stalled before ${take.name}: ${JSON.stringify(c.state())}`);}if(guard%1200===0)await log(`… ${take.name} waits, clock ${world().toFixed(0)}`);}
  c.timeScale(1);
  while(world()<take.at)advance(1000/60);
  take.before?.(c);
  if(ONLY&&!ONLY.includes(take.name)){
   // Reproduce skipped takes, including walking and operating switches. Otherwise
   // the player stays at the exit and the mission ends before the later take.
   for(const code of take.keys??[])window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));
   for(let k=0;k<take.frames;k++){advance(1000/30);if(k%40===0)await real(0);}
   for(const code of take.keys??[])window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
   continue;
  }
  stage().focus(take.room);
  Object.assign(stage().rain,take.wide?{count:12000,box:130,top:44,width:.022,length:2.4,opacity:.42}:{count:12000,box:34,top:15,width:.007,length:.95,opacity:.6});
  {const d=npc(c,'director'),snap=stage().snapshot();
   await log(`take ${take.name} at ${world().toFixed(1)} director ${d.life} ${d.pos.x.toFixed(1)},${d.pos.y.toFixed(1)},${d.pos.z.toFixed(1)} duty ${JSON.stringify(snap.duty)} flags ${snap.flags.join(' ')}`);}
  for(let k=0;k<take.frames;k++){
   const u=take.frames>1?k/(take.frames-1):0,shot=take.camera(u,c);
   c.inspectionCamera({x:shot.eye[0],y:shot.eye[1],z:shot.eye[2]},{x:shot.target[0],y:shot.target[1],z:shot.target[2]});
   for(const code of take.keys??[])window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));
   take.direct?.(k,c);
   advance(1000/30);
   draw(take.camera(u,c));
   const blob=await new Promise<Blob>(done=>canvas.toBlob(b=>done(b!),'image/jpeg',.95));
   await post(`/movie/frame?take=${take.name}&n=${String(k).padStart(5,'0')}`,blob);
  }
  for(const code of take.keys??[])window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
  await log(`took ${take.name} clock ${world().toFixed(2)} director ${JSON.stringify(npc(c,'director'))}`);
 }
 await log('done');
 document.title='TRAILER DONE';
}
film().catch(e=>log('ERROR '+(e as Error).stack));

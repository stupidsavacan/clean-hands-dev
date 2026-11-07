import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AGENT_BASE64 } from './agent-data';
import { Locomotion, type Pose } from './locomotion';
import { Rig } from './rig';
// Side-by-side gait strip: one cycle of each gait sampled at eight phases, viewed side-on and from the front.
const gaits={idle:[0,0],walk:[1.65,0],run:[4.8,0],crouch:[1.2,1],crouchIdle:[0,1]} as Record<string,[number,number]>;
const params=new URLSearchParams(location.search);let gait=params.get('gait')||'walk';const view=params.get('view')||'side';
const canvas=document.querySelector<HTMLCanvasElement>('#c')!,renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio);renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#e9e4d4');scene.add(new T.HemisphereLight('#fff','#887',2.4));const sun=new T.DirectionalLight('#fff',2);sun.position.set(4,6,3);scene.add(sun);
const aspect=innerWidth/innerHeight,camera=new T.OrthographicCamera(-8.4,8.4,8.4/aspect,-8.4/aspect,.1,100);
if(view==='side')camera.position.set(30,1.1,0);else camera.position.set(0,1.1,30);camera.lookAt(view==='side'?0:0,1.1,0);camera.position.y=1.1+ (8.4/aspect-1.1)*.0;
const ground=new T.Mesh(new T.BoxGeometry(40,.02,40),new T.MeshStandardMaterial({color:'#bdb59b'}));ground.position.y=-.01;scene.add(ground);
const g=await new GLTFLoader().parseAsync(Uint8Array.from(atob(AGENT_BASE64),c=>c.charCodeAt(0)).buffer,'');
const actors=Array.from({length:8},(_,i)=>{const o=clone(g.scene);scene.add(o);const x=(i-3.5)*2;if(view==='side'){o.position.z=-x;}else o.position.x=x;return {o,rig:new Rig(o)};});
function samples(name:string){const [speed,crouch]=gaits[name],l=new Locomotion();for(let i=0;i<240;i++)l.update(1/60,{speed,crouch,slope:0,turn:0,distance:speed/60});
 const out:Pose[]=[];let want=0;for(let i=0;i<600&&out.length<8;i++){const before=l.phase;const p=l.update(1/120,{speed,crouch,slope:0,turn:0,distance:speed/120});const wrapped=p.phase<before;if(speed===0?i%40===0:(out.length===0?wrapped:p.phase>=want)){out.push(structuredClone(p));want=(out.length/8);}}while(out.length<8)out.push(out[out.length-1]);return out;}
function show(name:string){gait=name;const s=samples(name);actors.forEach((a,i)=>a.rig.apply(s[i]));document.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.textContent===name));renderer.render(scene,camera);}
const nav=document.querySelector('#nav')!;for(const k of Object.keys(gaits)){const b=document.createElement('button');b.textContent=k;b.onclick=()=>show(k);nav.append(b);}
show(gait);(window as unknown as {labReady:boolean}).labReady=true;

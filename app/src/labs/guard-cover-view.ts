import * as T from 'three';
import {Director,type Mission,type PlayerView} from '../ai.ts';
import {CollisionWorld} from '../world.ts';
import {NavGrid} from '../nav.ts';
import {sightBoxes} from '../sight.ts';
import {hiddenFrom,shootsFrom} from '../cover-spots.ts';
import {CombatSystem} from '../combat.ts';
import {MissionEvents} from '../events.ts';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#171e27');const camera=new T.PerspectiveCamera(45,innerWidth/innerHeight,.1,300);
scene.add(new T.HemisphereLight(0xffffff,0x495c75,2));const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(5,20,4);scene.add(sun);
const group=new T.Group();scene.add(group);let saved:{c:CombatSystem;p:PlayerView;d:Director;frames:Map<string,{pos:T.Vector3;posture:string;phase:string}>;block:string;guard:T.Mesh;agent:T.Mesh}|undefined;
const json=async(n:string)=>(await fetch('/src/data/'+n+'.json')).json();
function box(x:number,y:number,z:number,w:number,h:number,d:number,color:string){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color}));m.position.set(x,y,z);group.add(m);return m;}
function show(phase:string){if(!saved)return;const f=saved.frames.get(phase);if(!f)return;saved.guard.position.copy(f.pos);saved.guard.scale.y=f.posture==='cover'?.62:1;document.querySelector('#status')!.textContent=`${saved.block} / ${phase} / posture=${f.posture} / 同じゲームAIで採取したフレーム（簡易人物表示）`;renderer.render(scene,camera);}
async function load(name:string){while(group.children.length)group.remove(group.children[0]);const file=name==='hotel'?'hotel':name==='party'?'party':'club-map',l=await json(file) as Mission,w=new CollisionWorld(l),nav=new NavGrid(w),boxes=sightBoxes(l),rules=await json(name==='hotel'?'rules':name+'-rules'),cr=await json(name==='club'?'club-combat':'combat');
 const d=new Director({...l,npcs:[]},w,nav,boxes,rules),c=new CombatSystem(d,new MissionEvents(),{level:0,quiet:0} as never,cr,await json('weapons'),[],()=>0);
 let pair;search:for(const s of [...c.spots].sort((a,b)=>Number(a.kind==='edge')-Number(b.kind==='edge')))for(const angle of [0,.2,-.2,.4,-.4,.7,-.7])for(const distance of [8,12,16]){const nx=s.nx*Math.cos(angle)-s.nz*Math.sin(angle),nz=s.nz*Math.cos(angle)+s.nx*Math.sin(angle);const p={x:s.x+nx*distance,y:s.y,z:s.z+nz*distance,floor:s.floor,speed:0,running:false,crouched:false,tampering:false,disguise:'suit',weaponDrawn:true};if(!w.blocked(p.x,p.y,p.z)&&nav.nearest(p)>=0&&hiddenFrom(s,p,false,boxes)&&shootsFrom(s,p,false,boxes,rules.vision.eye)){pair={s,p};break search;}}
 if(!pair)throw new Error('no sample');const {s,p}=pair;
 const n=d.addNpc({id:'audit-guard',role:'guard',label:'警備',floor:s.floor,model:'guard',route:[[s.x,s.z]]});n.pos={x:s.x,y:s.y,z:s.z};n.weapon='pistol_guard';c.equip('pistol_silenced');c.hand='pistol_silenced';c.engage(n,p,0);
 const frames=new Map();for(let k=0;k<600;k++){d.step(1/60,p);c.step(1/60,p,k/60);if(n.tactic?.phase==='hide'||n.tactic?.phase==='peek')if(!frames.has(n.tactic.phase))frames.set(n.tactic.phase,{pos:new T.Vector3(n.pos.x,n.pos.y+.83,n.pos.z),posture:n.posture,phase:n.tactic.phase});}
 for(const b of [...l.walls,...l.blockers].filter(b=>Math.hypot(b.x-s.x,b.z-s.z)<18&&Math.abs(b.y-s.y)<2))box(b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,b.id===s.block?'#947a50':'#596573');
 box(s.x,s.y-.12,s.z,40,.2,40,'#35414e');
 const guard=new T.Mesh(new T.CapsuleGeometry(.28,1.1,5,12),new T.MeshStandardMaterial({color:'#f5c564'}));group.add(guard);const agent=new T.Mesh(new T.CapsuleGeometry(.28,1.1,5,12),new T.MeshStandardMaterial({color:'#599cf4'}));agent.position.set(p.x,p.y+.83,p.z);group.add(agent);
 saved={c,p,d,frames,block:s.block,guard,agent};camera.position.set(s.x-s.nx*4+s.nz*9,s.y+6,s.z-s.nz*4-s.nx*9);camera.lookAt(s.x+s.nx*3,s.y+.7,s.z+s.nz*3);show('hide');}
for(const name of ['hotel','party','club'])document.querySelector('#'+name)!.addEventListener('click',()=>load(name));for(const phase of ['hide','peek'])document.querySelector('#'+phase)!.addEventListener('click',()=>show(phase));await load('hotel');

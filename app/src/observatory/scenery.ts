// What the observatory looks like, and how the picture follows the world simulation (2026-11-13).
// Everything is built here from boxes, cylinders and a few lathed shapes (no model files): the dome with its shutter
// and telescope, the generator, the nitrogen dewar, the wood stove, the orrery, the switchboard, the weather mast and
// the power line, room lights that follow their circuits, rain, lightning and the nitrogen fog.
// The engine calls build() once (engine/types.ts Decor); step() reads the live world each frame and never changes it.
import * as T from 'three';
import type {Decor,DecorContext} from '../engine/types';
import type {Position} from '../world';
import type {ObservatoryWorld} from './world';
import type {Strike} from '../sim/weather';

type Rect={id:string;floor:number;minX:number;minZ:number;maxX:number;maxZ:number;indoor?:boolean};
export type Live={world:ObservatoryWorld;here:{room:string;outdoor:boolean}}|undefined;
type Spot={id:string;at:Position};

const DOME={x:28,z:30,base:5.9,radius:8.4};
const BUILDING={minX:10,maxX:46,minZ:10,maxZ:38},SHED={minX:2,maxX:8,minZ:28,maxZ:36};
const inside=(r:{minX:number;maxX:number;minZ:number;maxZ:number},x:number,z:number)=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ;

const std=(color:string,extra:T.MeshStandardMaterialParameters={})=>new T.MeshStandardMaterial({color,roughness:.8,flatShading:true,...extra});
const glow=(color:string,intensity=1.4)=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.6});
function mesh(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0,parent?:T.Object3D){
 const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent?.add(m);return m;
}
function tube(a:T.Vector3,b:T.Vector3,radius:number,material:T.Material,parent:T.Object3D,sides=6){
 const m=new T.Mesh(new T.CylinderGeometry(radius,radius,a.distanceTo(b),sides),material);
 m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());parent.add(m);return m;
}
/** A soft round patch of light for the floor. */
function poolTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;
 const g=c.getContext('2d')!,grad=g.createRadialGradient(64,64,4,64,64,64);
 grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.55,'rgba(255,255,255,.55)');grad.addColorStop(1,'rgba(255,255,255,0)');
 g.fillStyle=grad;g.fillRect(0,0,128,128);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

export function buildScenery(ctx:DecorContext,rooms:Rect[],spots:Spot[],live:()=>Live):Decor{
 const {scene,hemi,group}=ctx;
 const baseAmbient=hemi.intensity,skyColor=new T.Color(ctx.look.background),flashColor=new T.Color('#b9c8ee');
 const background=scene.background as T.Color,fog=scene.fog as T.Fog;
 fog.near=45;fog.far=110;
 const g0=group(0),g1=group(1);
 const steel=std('#8c98a3',{metalness:.5,roughness:.45}),dark=std('#22272d'),white=std('#dfe6ea',{roughness:.5});

 // ---- the mountain around the map: dark slopes so the yard does not end in nothing --------------------------
 {
  const rock=std('#11161d',{roughness:1});
  for(const [x,z,r,h] of [[-40,72,30,26],[28,96,40,34],[98,70,32,28],[-44,8,24,14],[102,2,26,16]] as number[][]){
   const cone=mesh(new T.ConeGeometry(r,h,7),rock,x,h/2-6,z,scene);cone.rotation.y=x*.37;
  }
 }

 // ---- the dome ---------------------------------------------------------------------------------------------
 const shell=new T.MeshStandardMaterial({color:'#d8e1e6',roughness:.35,metalness:.3,transparent:true,opacity:.2,depthWrite:false,side:T.DoubleSide});
 // The shutter's opening runs from the zenith down the north side; the shell leaves it out.
 const slitHalf=.2;
 mesh(new T.SphereGeometry(DOME.radius,28,10,Math.PI/2+slitHalf,Math.PI*2-slitHalf*2,0,Math.PI/2),shell,DOME.x,DOME.base,DOME.z,g1);
 const ribs=std('#aeb9c1',{metalness:.5,roughness:.4});
 for(let i=0;i<10;i++){
  const a=Math.PI/2+slitHalf+i*(Math.PI*2-slitHalf*2)/9;
  const rib=mesh(new T.TorusGeometry(DOME.radius,.06,5,14,Math.PI/2),ribs,DOME.x,DOME.base,DOME.z,g1);
  rib.rotation.y=-a;
 }
 const ring=mesh(new T.TorusGeometry(DOME.radius,.16,6,36),ribs,DOME.x,DOME.base,DOME.z,g1);ring.rotation.x=Math.PI/2;
 // The drum's top edge, so the square room reads as carrying a round dome.
 for(const [x,z,w,d] of [[28,22,16,.3],[28,38,16,.3],[20,30,.3,16],[36,30,.3,16]])mesh(new T.BoxGeometry(w,.25,d),ribs,x,DOME.base-.12,z,g1);
 // The lightning rod on the crown, and its earth cable down the north wall.
 tube(new T.Vector3(DOME.x,DOME.base+DOME.radius-.1,DOME.z),new T.Vector3(DOME.x,DOME.base+DOME.radius+2.6,DOME.z),.04,steel,g1,5);
 mesh(new T.SphereGeometry(.09,8,6),glow('#cfd8dd',.4),DOME.x,DOME.base+DOME.radius+2.6,DOME.z,g1);
 const copper=std('#b87333',{metalness:.6,roughness:.4});
 tube(new T.Vector3(30,5.9,38.14),new T.Vector3(30,1.2,38.14),.025,copper,g0,5);
 mesh(new T.BoxGeometry(.4,.5,.16),std('#3f474e'),30,.9,38.2,g0);

 // ---- the telescope ----------------------------------------------------------------------------------------
 {
  const base=3.5,mount=new T.Group();mount.position.set(28,base,30);g1.add(mount);
  mesh(new T.CylinderGeometry(1,1.2,1.3,10),std('#48525c'),0,.65,0,mount);
  for(const side of [-1,1])mesh(new T.BoxGeometry(.28,2.3,.9),std('#5d6975'),side*.95,2.3,0,mount);
  const tubeGroup=new T.Group();tubeGroup.position.set(0,2.9,0);tubeGroup.rotation.x=-.55;mount.add(tubeGroup);
  mesh(new T.CylinderGeometry(.62,.62,4.2,14),white,0,.9,0,tubeGroup);
  mesh(new T.CylinderGeometry(.66,.66,.3,14),std('#2b3238'),0,3.0,0,tubeGroup);
  mesh(new T.CylinderGeometry(.5,.62,.5,14),std('#2b3238'),0,-1.35,0,tubeGroup);
  // The detector on the back end (the thing the cryo lab keeps cold).
  mesh(new T.BoxGeometry(.5,.5,.5),std('#b7892b',{metalness:.6,roughness:.4}),0,-1.8,0,tubeGroup);
  mesh(new T.CylinderGeometry(.12,.12,1.4,8),std('#2b3238'),.72,2.2,0,tubeGroup);
 }

 // ---- ground-floor props the engine does not draw (main.ts lists their blocker ids) ---------------------------
 // Generator: engine block, radiator, exhaust through the roof line.
 const generator=new T.Group();generator.position.set(4.6,0,31);g0.add(generator);
 mesh(new T.BoxGeometry(2,1.1,3.2),std('#c9a227'),0,.75,0,generator);
 mesh(new T.BoxGeometry(2.2,.2,3.4),dark,0,.1,0,generator);
 mesh(new T.BoxGeometry(1.8,1,.25),dark,0,.8,-1.72,generator);
 mesh(new T.BoxGeometry(.5,.35,.5),std('#2f6d3a'),.5,1.45,.9,generator);
 tube(new T.Vector3(-.6,1.3,1),new T.Vector3(-.6,3.2,1),.09,dark,generator);
 mesh(new T.CylinderGeometry(.5,.5,1.3,10),std('#a33b2d'),3.2,.65,34.8,g0);
 // Fuel tank and the bulk nitrogen tank outside.
 {const t=mesh(new T.CylinderGeometry(.7,.7,2.6,12),std('#a33b2d'),5,.9,25.6,g0);t.rotation.z=Math.PI/2;
  for(const x of [4,6])mesh(new T.BoxGeometry(.2,.5,1.2),dark,x,.25,25.6,g0);}
 mesh(new T.CylinderGeometry(.8,.8,2.6,14),white,47.6,1.5,29,g0);mesh(new T.SphereGeometry(.8,14,6,0,Math.PI*2,0,Math.PI/2),white,47.6,2.8,29,g0);
 tube(new T.Vector3(47,1,29),new T.Vector3(46.1,1,29),.05,steel,g0);
 // The dewar in the lab: a fat flask with a frosted neck, and its vent pipe.
 mesh(new T.CylinderGeometry(.55,.55,1.2,14),std('#cfd6da',{metalness:.6,roughness:.3}),21.3,.6,31.6,g0);
 mesh(new T.SphereGeometry(.55,14,6,0,Math.PI*2,0,Math.PI/2),std('#cfd6da',{metalness:.6,roughness:.3}),21.3,1.2,31.6,g0);
 mesh(new T.CylinderGeometry(.12,.12,.35,8),std('#eef3f5'),21.3,1.85,31.6,g0);
 const valveWheel=mesh(new T.TorusGeometry(.13,.03,5,10),std('#c0392b'),21.95,1.25,31.6,g0);valveWheel.rotation.y=Math.PI/2;
 // The wood stove.
 mesh(new T.BoxGeometry(.8,.9,.9),std('#1c1c1e',{roughness:.6}),10.9,.55,16,g0);
 for(const [x,z] of [[10.6,15.65],[10.6,16.35],[11.2,15.65],[11.2,16.35]])mesh(new T.BoxGeometry(.08,.12,.08),dark,x,.06,z,g0);
 tube(new T.Vector3(10.7,1,16),new T.Vector3(10.7,3.3,16),.1,dark,g0,8);
 const fire=mesh(new T.BoxGeometry(.04,.34,.5),glow('#ff8a3c',2.2),11.32,.55,16,g0);
 // The orrery in the lobby: a plinth, a sun, planets on arms.
 mesh(new T.CylinderGeometry(1.25,1.3,.9,16),std('#27313c'),28,.45,16.5,g0);
 mesh(new T.CylinderGeometry(.04,.04,1.2,6),steel,28,1.5,16.5,g0);
 const orrery=new T.Group();orrery.position.set(28,1.7,16.5);
 mesh(new T.SphereGeometry(.24,12,8),glow('#ffd27a',1.6),0,0,0,orrery);
 const planets=[[.55,.07,'#b9a58a',4.1],[.85,.1,'#6d9bd1',1.6],[1.15,.085,'#c8643c',.85],[1.5,.17,'#d9b98a',.3]].map(([r,size,color,speed])=>{
  const arm=new T.Group();orrery.add(arm);
  tube(new T.Vector3(0,0,0),new T.Vector3(r as number,0,0),.012,steel,arm,4);
  mesh(new T.SphereGeometry(size as number,10,6),std(color as string,{roughness:.5}),r as number,0,0,arm);
  return {arm,speed:speed as number};
 });
 // The switchboard: a grey cabinet with one lamp per circuit.
 mesh(new T.BoxGeometry(.5,2.1,3.2),std('#7d8890'),28.5,1.05,29.5,g0);
 const lampOff=std('#20262b'),lampOn=glow('#58d68d',1.6),lampTrip=glow('#e74c3c',1.8),lampShed=glow('#f5b041',1.4);
 const circuitIds=['lights-public','lights-staff','lights-dome','heating','ventilation','dome','compressor','sockets','safety','it'];
 const lamps=circuitIds.map((id,i)=>({id,mesh:mesh(new T.BoxGeometry(.03,.09,.09),lampOff,28.77,1.55-(i%2)*.3,28.3+Math.floor(i/2)*.6,g0)}));
 // The shutter's drive cabinet in the pier room.
 const driveLamp=mesh(new T.BoxGeometry(.09,.09,.03),lampOn,34.6,1.5,35.98,g0);
 // The weather mast and the line's pole, with the wires to the building.
 tube(new T.Vector3(51,0,36),new T.Vector3(51,7,36),.07,steel,g0);
 tube(new T.Vector3(9.2,0,27),new T.Vector3(9.2,6.5,27),.11,std('#4a3b2c'),g0);
 mesh(new T.BoxGeometry(1.6,.1,.1),std('#4a3b2c'),9.2,6.2,27,g0);
 mesh(new T.BoxGeometry(.3,.45,.2),std('#59626a'),9.2,1.3,26.72,g0);
 const wire=std('#0d0f12');
 for(const dz of [-.6,.6]){tube(new T.Vector3(9.2,6.25,27+dz),new T.Vector3(-6,9,27+dz*6),.015,wire,scene,3);tube(new T.Vector3(9.2,6.25,27+dz),new T.Vector3(10.1,3.3,25.4+dz),.015,wire,g0,3);}
 // The oxygen monitor by the lab door, the crank on the catwalk, the weather monitor.
 const o2Lamp=mesh(new T.BoxGeometry(.2,.28,.06),lampOn,26.4,1.6,25.14,g0);
 mesh(new T.BoxGeometry(.3,.5,.3),std('#59626a'),28,3.5+.25,39.75,g1);
 const crankWheel=mesh(new T.TorusGeometry(.22,.035,5,12),std('#c0392b'),28,3.5+.75,39.55,g1);
 const monitor=mesh(new T.BoxGeometry(.7,.45,.05),glow('#3fa7d6',1.1),44.6,3.5+1.25,36.9,g1);monitor.rotation.x=-.2;
 // A small amber marker at every place the player can work on something.
 const beacon=new T.MeshBasicMaterial({color:'#ffcf5a',transparent:true,opacity:.75,depthWrite:false});
 for(const s of spots){const b=mesh(new T.RingGeometry(.2,.26,20),beacon,s.at.x,s.at.y+.035,s.at.z,s.at.y>1?g1:g0);b.rotation.x=-Math.PI/2;}

 // ---- built after the static freeze: everything that moves or changes ---------------------------------------
 let rain:T.LineSegments|undefined,rainData:Float32Array,rainSeeds:Float32Array;
 let bolt:T.Line|undefined,boltUntil=0,lastStrike:Strike|undefined;
 let shutters:T.Mesh[]=[],cups:T.Group|undefined,fog0:T.Mesh|undefined,fogHall:T.Mesh|undefined,plume:T.Mesh|undefined,exhaust:T.Mesh|undefined,cableLoose:T.Mesh|undefined,cableOn:T.Mesh|undefined;
 const pools:{room:Rect;mesh:T.Mesh;lamp:T.Mesh;level:number}[]=[];
 let roomLight:T.PointLight|undefined,stoveLight:T.PointLight|undefined;
 const warm=new T.Color('#ffdcae'),cool=new T.Color('#cfe2ff'),red=new T.Color('#ff4a3a');
 const RAIN=1400;

 function afterFreeze(){
  // Light pools and ceiling lamps, one per room.
  const tex=poolTexture(),lampGeo=new T.BoxGeometry(1.6,.05,.3);
  for(const r of rooms){
   const w=r.maxX-r.minX,d=r.maxZ-r.minZ,y=r.floor*3.5,cx=(r.minX+r.maxX)/2,cz=(r.minZ+r.maxZ)/2,parent=r.floor?g1:g0;
   const outdoor=!r.indoor;
   // Outdoors a floodlight lights a patch near the building, not the whole yard.
   const pw=outdoor?Math.min(w,14):w*1.25,pd=outdoor?Math.min(d,12):d*1.25;
   const m=mesh(new T.PlaneGeometry(pw,pd),new T.MeshBasicMaterial({map:tex,color:outdoor?cool:warm,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}),
    r.id==='yard'?28:r.id==='west'?7:r.id==='east'?49:cx,y+.04,r.id==='yard'?6:r.id==='north'?40.5:cz,parent);
   m.rotation.x=-Math.PI/2;m.renderOrder=2;
   const lamp=mesh(lampGeo,glow('#fff1d0',1.8),cx,y+(outdoor?4.6:r.id==='obs'?2.3:3.2),outdoor?(r.id==='yard'?10.3:r.id==='north'?38.3:cz):cz,parent);
   if(outdoor&&(r.id==='west'||r.id==='east'))lamp.position.x=r.id==='west'?9.7:46.3;
   if(r.id==='catwalk'){lamp.position.set(28,3.5+2.6,38.25);}
   pools.push({room:r,mesh:m,lamp,level:1});
  }
  // One real light for the room the player is in, and the stove's glow.
  roomLight=new T.PointLight('#ffe2b8',0,16,1.6);scene.add(roomLight);
  stoveLight=new T.PointLight('#ff8a3c',6,7,1.8);stoveLight.position.set(11.6,.9,16);scene.add(stoveLight);
  g0.add(orrery);
  // The shutter: two leaves over the opening that slide apart along the ring.
  const leaf=new T.MeshStandardMaterial({color:'#c4ced5',roughness:.4,metalness:.4,side:T.DoubleSide});
  shutters=[-1,1].map(side=>{
   const m=mesh(new T.SphereGeometry(DOME.radius+.06,4,10,side<0?Math.PI/2-slitHalf:Math.PI/2,slitHalf,0,Math.PI/2),leaf,DOME.x,DOME.base,DOME.z,g1);
   return m;
  });
  // Anemometer cups on the mast.
  cups=new T.Group();cups.position.set(51,7,36);g0.add(cups);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;tube(new T.Vector3(0,0,0),new T.Vector3(Math.cos(a)*.45,0,Math.sin(a)*.45),.015,steel,cups,4);mesh(new T.SphereGeometry(.09,8,5),dark,Math.cos(a)*.45,0,Math.sin(a)*.45,cups);}
  // Nitrogen: fog lying on the lab floor (and leaking into the hall), and the plume at the valve.
  const fogMat=()=>new T.MeshBasicMaterial({color:'#e9f3f7',transparent:true,opacity:0,depthWrite:false});
  fog0=mesh(new T.BoxGeometry(7.7,.5,7.7),fogMat(),24,.27,29,g0);
  fogHall=mesh(new T.BoxGeometry(5,.25,2.6),fogMat(),24,.14,23.5,g0);
  plume=mesh(new T.ConeGeometry(.5,1.4,8,1,true),fogMat(),22.3,.7,31.6,g0);plume.rotation.z=-Math.PI/2;
  exhaust=mesh(new T.SphereGeometry(.35,7,5),new T.MeshBasicMaterial({color:'#8d9499',transparent:true,opacity:0,depthWrite:false}),4,3.6,32,g0);
  // The earth cable's last metre: on its clamp, or hanging loose.
  cableOn=tube(new T.Vector3(30,1.2,38.14),new T.Vector3(30,.2,38.3),.025,copper,g0,5);
  cableLoose=tube(new T.Vector3(30,1.2,38.14),new T.Vector3(30.7,.75,38.5),.025,copper,g0,5);cableLoose.visible=false;
  // Rain: short streaks in a box that follows the player. None falls inside the building's outline.
  rainData=new Float32Array(RAIN*6);rainSeeds=new Float32Array(RAIN*3);
  for(let i=0;i<RAIN*3;i++)rainSeeds[i]=Math.random();
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(rainData,3));
  rain=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#b9c7dc',transparent:true,opacity:.35,depthWrite:false}));
  rain.frustumCulled=false;scene.add(rain);
  // Lightning: a jagged line, redrawn for each strike.
  bolt=new T.Line(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(14*3),3)),new T.LineBasicMaterial({color:'#f2f6ff'}));
  bolt.frustumCulled=false;bolt.visible=false;scene.add(bolt);
 }

 function drawBolt(s:Strike){
  if(!bolt)return;
  const end=s.kind==='rod'?new T.Vector3(DOME.x,DOME.base+DOME.radius+2.6,DOME.z):s.kind==='line'?new T.Vector3(-6,9,27):new T.Vector3(28+Math.cos(s.bearing)*70,6,26+Math.sin(s.bearing)*70);
  const start=end.clone().add(new T.Vector3((Math.random()-.5)*14,42,(Math.random()-.5)*14)),p=bolt.geometry.getAttribute('position') as T.BufferAttribute;
  for(let i=0;i<14;i++){
   const k=i/13,v=start.clone().lerp(end,k),j=i&&i<13?(s.kind==='far'?5:2.2):0;
   p.setXYZ(i,v.x+(Math.random()-.5)*j,v.y,v.z+(Math.random()-.5)*j);
  }
  p.needsUpdate=true;bolt.visible=true;
 }

 function step(seconds:number,frame:number,_dark:boolean,_mission:number,view?:{camera:T.Camera;player:Position;floor:number}){
  const l=live();if(!l||!rain)return;
  const w=l.world,t=w.time,weather=w.weather.at(t),flash=w.weather.flash(t),g=w.grid;
  // Sky and ambient: darker as the storm builds, white for the blink of a flash.
  const gloom=1-.3*weather.intensity;
  background.copy(skyColor).multiplyScalar(gloom).lerp(flashColor,flash*.8);fog.color.copy(background);
  const here=pools.find(p=>p.room.id===l.here.room);
  const lit=here?w.lit(here.room.id):false;
  hemi.intensity=baseAmbient*(gloom*(l.here.outdoor?1:lit?1.25:.72))+flash*2.2;
  // Strikes.
  let last:Strike|undefined;for(const s of w.weather.strikes){if(s.time>t)break;last=s;}
  if(last&&last!==lastStrike&&t-last.time<.4){lastStrike=last;drawBolt(last);boltUntil=seconds+.22;}
  if(bolt&&bolt.visible&&seconds>boltUntil)bolt.visible=false;
  // Room lights follow their circuits; an unlit room under emergency power gets a dim red pool.
  const emergency=g.powered('safety');
  for(const p of pools){
   const on=w.lit(p.room.id),target=on?1:0;
   p.level+=(target-p.level)*Math.min(1,frame*6);
   const mat=p.mesh.material as T.MeshBasicMaterial,outdoor=!p.room.indoor;
   const dim=!on&&emergency&&!outdoor;
   mat.color.copy(dim?red:outdoor?cool:warm);
   mat.opacity=dim?.12:p.level*(outdoor?.24:.42);
   (p.lamp.material as T.MeshStandardMaterial).emissiveIntensity=.05+p.level*1.8;
  }
  if(roomLight){
   const r=here?.room;
   if(r&&!l.here.outdoor){roomLight.position.set((r.minX+r.maxX)/2,r.floor*3.5+2.9,(r.minZ+r.maxZ)/2);roomLight.color.copy(lit?warm:red);roomLight.intensity+=((lit?22:emergency?5:0)-roomLight.intensity)*Math.min(1,frame*6);}
   else roomLight.intensity+=(0-roomLight.intensity)*Math.min(1,frame*6);
  }
  if(stoveLight)stoveLight.intensity=5.5+Math.sin(seconds*9)*.8+Math.sin(seconds*23)*.5;
  (fire.material as T.MeshStandardMaterial).emissiveIntensity=2+Math.sin(seconds*11)*.5;
  // The switchboard's lamps.
  for(const lamp of lamps){const b=g.breakers.get(lamp.id)!;lamp.mesh.material=b.tripped?lampTrip:!b.closed?lampOff:g.shed.has(lamp.id)?lampShed:g.powered(lamp.id)?lampOn:lampOff;}
  driveLamp.material=g.powered('dome')?lampOn:g.breakers.get('dome')!.closed?lampOff:lampTrip;
  o2Lamp.material=w.o2Alarm&&Math.sin(seconds*12)>0?lampTrip:w.sensorConnected&&g.powered('safety')?lampOn:lampOff;
  monitor.visible=g.powered('it');
  // Machines.
  for(const p of planets)p.arm.rotation.y+=frame*p.speed*.25;
  if(cups)cups.rotation.y+=frame*(1+weather.wind*14);
  shutters.forEach((m,i)=>{m.rotation.y=(i?-1:1)*w.slit*slitHalf*1.02;});
  crankWheel.rotation.z=w.slit>0&&w.slit<1&&!g.powered('dome')?seconds*3:0;
  const running=g.generator==='running';
  generator.position.y=running?Math.sin(seconds*47)*.006:0;
  if(exhaust){const k=seconds*.9%1;(exhaust.material as T.MeshBasicMaterial).opacity=running?.35*(1-k):0;exhaust.position.y=3.5+k*1.6;exhaust.scale.setScalar(.6+k*1.6);}
  // Nitrogen.
  const air=w.air.rooms,lack=(room:string)=>Math.max(0,Math.min(1,(20.9-(air.get(room)?.o2??.209)*100)/9));
  if(fog0)(fog0.material as T.MeshBasicMaterial).opacity=lack('cryo')*.5;
  if(fogHall)(fogHall.material as T.MeshBasicMaterial).opacity=lack('hall')*.5;
  if(plume){const venting=w.valveOpen&&w.gasLeft>0;(plume.material as T.MeshBasicMaterial).opacity=venting?.55+Math.sin(seconds*17)*.1:0;plume.scale.setScalar(1+Math.sin(seconds*5)*.08);}
  valveWheel.rotation.x=w.valveOpen?Math.PI/2:0;
  if(cableOn&&cableLoose){cableOn.visible=w.groundCable;cableLoose.visible=!w.groundCable;}
  // Rain.
  const centre=view?.player??{x:28,y:0,z:20},count=Math.floor(RAIN*Math.min(1,weather.rain*1.15)),tilt=weather.wind*5.5,speed=17+weather.rain*8;
  const upstairs=(view?.floor??0)>=1;
  for(let i=0;i<RAIN;i++){
   const o=i*6;
   if(i>=count){rainData[o+1]=rainData[o+4]=-50;continue;}
   const x=centre.x+(rainSeeds[i*3]-.5)*46,z=centre.z+(rainSeeds[i*3+1]-.5)*46;
   const y=16-((seconds*speed+rainSeeds[i*3+2]*16)%16);
   // The picture has no roofs, so rain over a room would fall on the people in it: keep it outside the walls.
   const roof=inside(BUILDING,x+tilt*.02*y,z)||inside(SHED,x,z);
   if(roof&&!(upstairs&&z>38)){rainData[o+1]=rainData[o+4]=-50;continue;}
   const lean=tilt*(16-y)/17;
   rainData[o]=x+lean;rainData[o+1]=y;rainData[o+2]=z;
   rainData[o+3]=x+lean+tilt*.035;rainData[o+4]=y+.55;rainData[o+5]=z;
  }
  (rain.geometry.getAttribute('position') as T.BufferAttribute).needsUpdate=true;
  (rain.material as T.LineBasicMaterial).opacity=.22+.25*weather.rain+flash*.4;
 }
 return {afterFreeze,step};
}

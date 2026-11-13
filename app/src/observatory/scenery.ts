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
/** How much rain is drawn and how far round the camera (the movie page raises these for wide shots). */
/** Parts the movie page dresses differently (film-set.ts). */
export const filmHandles:{domeShell?:T.MeshStandardMaterial}={};
export const rainSettings={count:1600,box:46,top:16,width:.012,length:.7,opacity:1};
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
 const screens:T.Mesh[]=[],rackLeds:T.Mesh[]=[],ledMats=new Map<string,T.MeshStandardMaterial>();
 const lampOnFor=(color:string)=>{let m=ledMats.get(color);if(!m){m=glow(color,1.5);ledMats.set(color,m);}return m;};
 const steel=std('#8c98a3',{metalness:.5,roughness:.45}),dark=std('#22272d'),white=std('#dfe6ea',{roughness:.5});

 // ---- the night sky and the mountain top: a sky that is a little lighter at the horizon, so the slopes read ------
 const skyMaterial=new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,depthWrite:false});
 {
  const geo=new T.SphereGeometry(140,24,12),pos=geo.getAttribute('position'),colors=new Float32Array(pos.count*3);
  const low=new T.Color('#2a3650'),high=new T.Color('#05070c'),c=new T.Color();
  for(let i=0;i<pos.count;i++){const k=Math.max(0,Math.min(1,pos.getY(i)/140*2.2+.08));c.copy(low).lerp(high,Math.sqrt(k));colors.set([c.r,c.g,c.b],i*3);}
  geo.setAttribute('color',new T.BufferAttribute(colors,3));
  const sky=mesh(geo,skyMaterial,28,-4,24,scene);sky.renderOrder=-10;
  // Bare rock round the buildings, falling away at the edge.
  const rockTop=mesh(new T.CylinderGeometry(78,96,6,20),std('#171c23',{roughness:1}),28,-3.06,22,scene);rockTop.receiveShadow=true;
 }
 {
  // Unlit, so the slopes stay silhouettes against the sky when lightning lights it.
  const rock=new T.MeshBasicMaterial({color:'#090c11'});
  for(const [x,z,r,h] of [[-40,72,30,26],[28,96,40,34],[98,70,32,28],[-44,8,24,14],[102,2,26,16]] as number[][]){
   const cone=mesh(new T.ConeGeometry(r,h,7),rock,x,h/2-6,z,scene);cone.rotation.y=x*.37;
  }
 }

 // ---- the dome ---------------------------------------------------------------------------------------------
 const shell=new T.MeshStandardMaterial({color:'#d8e1e6',roughness:.35,metalness:.3,transparent:true,opacity:.2,depthWrite:false,side:T.DoubleSide});
 // The shutter's opening runs from the zenith down the north side; the shell leaves it out.
 filmHandles.domeShell=shell;
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
 // Screens on the control desks, lamps on the racks, a lamp on the reception desk.
 const screen=glow('#4fb3e8',1.3),screenAlt=glow('#7fe0b0',1.1),bezel=std('#14181d');
 for(const [dz,z] of [[0,27],[1,30.5]] as number[][])for(let i=0;i<3;i++){
  const m=mesh(new T.BoxGeometry(.62,.4,.04),bezel,11.2+i*.8,1.2,z-.25,g0);m.rotation.x=-.12;
  const face=mesh(new T.BoxGeometry(.56,.34,.02),(i+dz)%2?screenAlt:screen,11.2+i*.8,1.2,z-.22,g0);face.rotation.x=-.12;screens.push(face);
  mesh(new T.BoxGeometry(.06,.2,.06),bezel,11.2+i*.8,.98,z-.28,g0);
  mesh(new T.BoxGeometry(.4,.02,.15),bezel,11.2+i*.8,.91,z+.15,g0);
 }
 for(const z of [28.2,30.6])for(let i=0;i<7;i++)for(let j=0;j<5;j++)
  rackLeds.push(mesh(new T.BoxGeometry(.05,.03,.02),(i*3+j)%4?lampOnFor('#58d68d'):lampOnFor('#f5b041'),31.95+i*.35,.5+j*.3,z+.46,g0));
 {const m=mesh(new T.BoxGeometry(.7,.42,.04),bezel,23.6,1.42,12.2,g0);m.rotation.x=.1;const f=mesh(new T.BoxGeometry(.64,.36,.02),screen,23.6,1.42,12.23,g0);f.rotation.x=.1;screens.push(f);}
 mesh(new T.CylinderGeometry(.09,.14,.22,8),glow('#ffd9a0',1.6),21.8,1.3,12.4,g0);
 // The director's desk lamp and the staff room's.
 mesh(new T.CylinderGeometry(.08,.13,.2,8),glow('#ffd9a0',1.6),12.7,1.05,36.4,g0);
 mesh(new T.CylinderGeometry(.08,.13,.2,8),glow('#ffd9a0',1.4),42.6,.8,29.4,g0);
 // A small amber marker at every place the player can work on something.
 const beacon=new T.MeshBasicMaterial({color:'#ffcf5a',transparent:true,opacity:.75,depthWrite:false});
 for(const s of spots){const b=mesh(new T.RingGeometry(.2,.26,20),beacon,s.at.x,s.at.y+.035,s.at.z,s.at.y>1?g1:g0);b.rotation.x=-Math.PI/2;}

 // ---- built after the static freeze: everything that moves or changes ---------------------------------------
 let rain:T.Mesh|undefined,rainData:Float32Array,rainSeeds:Float32Array;
 let bolt:T.Mesh|undefined,boltUntil=0,lastStrike:Strike|undefined;
 const BOLT=13;
 let shutters:T.Mesh[]=[],cups:T.Group|undefined,fog0:T.Mesh|undefined,fogHall:T.Mesh|undefined,plume:T.Group|undefined,exhaust:T.Mesh|undefined,cableLoose:T.Mesh|undefined,cableOn:T.Mesh|undefined;
 const pools:{room:Rect;mesh:T.Mesh;lamp:T.Mesh;level:number}[]=[];
 let roomLight:T.PointLight|undefined,stoveLight:T.PointLight|undefined;
 const warm=new T.Color('#ffdcae'),cool=new T.Color('#cfe2ff'),red=new T.Color('#ff4a3a');
 const RAIN_MAX=12000;

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
  const fogMat=()=>new T.MeshBasicMaterial({color:'#b9c9d3',transparent:true,opacity:0,depthWrite:false});
  fog0=mesh(new T.BoxGeometry(7.7,.5,7.7),fogMat(),24,.27,29,g0);
  fogHall=mesh(new T.BoxGeometry(5,.25,2.6),fogMat(),24,.14,23.5,g0);
  // The jet at the valve: soft puffs that swell, sink and fade as they leave it.
  plume=new T.Group();g0.add(plume);
  for(let i=0;i<9;i++)mesh(new T.SphereGeometry(.5,10,7),fogMat(),0,0,0,plume);
  exhaust=mesh(new T.SphereGeometry(.35,7,5),new T.MeshBasicMaterial({color:'#8d9499',transparent:true,opacity:0,depthWrite:false}),4,3.6,32,g0);
  // The earth cable's last metre: on its clamp, or hanging loose.
  cableOn=tube(new T.Vector3(30,1.2,38.14),new T.Vector3(30,.2,38.3),.025,copper,g0,5);
  cableLoose=tube(new T.Vector3(30,1.2,38.14),new T.Vector3(30.7,.75,38.5),.025,copper,g0,5);cableLoose.visible=false;
  // Rain: thin streaks (two crossed quads each) in a box round the camera. None falls inside the building's outline.
  rainData=new Float32Array(RAIN_MAX*24);rainSeeds=new Float32Array(RAIN_MAX*3);
  for(let i=0;i<RAIN_MAX*3;i++)rainSeeds[i]=Math.random();
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(rainData,3));
  const index=new Uint32Array(RAIN_MAX*12);
  for(let i=0;i<RAIN_MAX*2;i++){const v=i*4,o=i*6;index.set([v,v+1,v+2,v+2,v+1,v+3],o);}
  geo.setIndex(new T.BufferAttribute(index,1));
  rain=new T.Mesh(geo,new T.MeshBasicMaterial({color:'#c3d0e4',transparent:true,opacity:.35,depthWrite:false,side:T.DoubleSide}));
  rain.frustumCulled=false;scene.add(rain);
  // Lightning: a jagged ribbon (two crossed strips), redrawn for each strike.
  const boltGeo=new T.BufferGeometry();boltGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(BOLT*2*4*3),3));
  const boltIndex:number[]=[];for(let i=0;i<BOLT*2;i++){const v=i*4;boltIndex.push(v,v+1,v+2,v+2,v+1,v+3);}
  boltGeo.setIndex(boltIndex);
  bolt=new T.Mesh(boltGeo,new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,fog:false}));
  bolt.frustumCulled=false;bolt.visible=false;scene.add(bolt);
 }

 function drawBolt(s:Strike){
  if(!bolt)return;
  const end=s.kind==='rod'?new T.Vector3(DOME.x,DOME.base+DOME.radius+2.6,DOME.z):s.kind==='line'?new T.Vector3(9.2,6.4,27):new T.Vector3(28+Math.cos(s.bearing)*70,6,26+Math.sin(s.bearing)*70);
  const start=end.clone().add(new T.Vector3((Math.random()-.5)*16,46,(Math.random()-.5)*16)),p=bolt.geometry.getAttribute('position') as T.BufferAttribute;
  const jitter=s.kind==='far'?5:2.4,half=s.kind==='far'?.3:.09;
  const points=Array.from({length:BOLT+1},(_,i)=>{const v=start.clone().lerp(end,i/BOLT),j=i&&i<BOLT?jitter:0;v.x+=(Math.random()-.5)*j;v.z+=(Math.random()-.5)*j;return v;});
  for(let i=0;i<BOLT;i++){
   const a=points[i],b=points[i+1],o=i*8;
   p.setXYZ(o,a.x-half,a.y,a.z);p.setXYZ(o+1,a.x+half,a.y,a.z);p.setXYZ(o+2,b.x-half,b.y,b.z);p.setXYZ(o+3,b.x+half,b.y,b.z);
   p.setXYZ(o+4,a.x,a.y,a.z-half);p.setXYZ(o+5,a.x,a.y,a.z+half);p.setXYZ(o+6,b.x,b.y,b.z-half);p.setXYZ(o+7,b.x,b.y,b.z+half);
  }
  p.needsUpdate=true;bolt.visible=true;
 }

 function step(seconds:number,frame:number,_dark:boolean,_mission:number,view?:{camera:T.Camera;player:Position;floor:number}){
  const l=live();if(!l||!rain)return;
  const w=l.world,t=w.time,weather=w.weather.at(t),flash=w.weather.flash(t),g=w.grid;
  // Sky and ambient: darker as the storm builds, white for the blink of a flash.
  const gloom=1-.3*weather.intensity;
  background.copy(skyColor).multiplyScalar(gloom).lerp(flashColor,flash*.12);fog.color.copy(background);
  skyMaterial.color.setScalar(gloom*(1+flash*5));
  const here=pools.find(p=>p.room.id===l.here.room);
  const lit=here?w.lit(here.room.id):false;
  hemi.intensity=baseAmbient*(gloom*(l.here.outdoor?1:lit?1.25:.72))+flash*1.3;
  // Strikes.
  let last:Strike|undefined;for(const s of w.weather.strikes){if(s.time>t)break;last=s;}
  if(last&&last!==lastStrike&&t-last.time<.4){lastStrike=last;drawBolt(last);boltUntil=seconds+.26;}
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
  const it=g.powered('it');
  for(const m of screens)m.visible=it;
  for(let i=0;i<rackLeds.length;i++)rackLeds[i].visible=it&&(i*7+Math.floor(seconds*3))%11!==0;
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
  if(fog0)(fog0.material as T.MeshBasicMaterial).opacity=lack('cryo')*.3;
  if(fogHall)(fogHall.material as T.MeshBasicMaterial).opacity=lack('hall')*.5;
  if(plume){
   const venting=w.valveOpen&&w.gasLeft>0;plume.visible=venting;
   if(venting)plume.children.forEach((puff,i)=>{
    const k=(seconds*.55+i/9)%1,wob=Math.sin(seconds*3+i*2.1)*.08;
    puff.position.set(22.05+k*1.9,1.22-k*k*1.05,31.6+wob+(i%3-1)*.12*k);
    puff.scale.setScalar(.22+k*1.25);
    ((puff as T.Mesh).material as T.MeshBasicMaterial).opacity=.34*(1-k)*Math.min(1,k*8);
   });
  }
  valveWheel.rotation.x=w.valveOpen?Math.PI/2:0;
  if(cableOn&&cableLoose){cableOn.visible=w.groundCable;cableLoose.visible=!w.groundCable;}
  // Rain.
  const cam=view?.camera.position,centre=cam?{x:cam.x,z:cam.z}:{x:28,z:20},box=rainSettings.box,top=rainSettings.top,half=rainSettings.width/2;
  const count=Math.floor(Math.min(RAIN_MAX,rainSettings.count)*Math.min(1,weather.rain*1.15)),tilt=weather.wind*5.5,speed=17+weather.rain*8;
  const upstairs=(view?.floor??0)>=1;
  for(let i=0;i<RAIN_MAX;i++){
   const o=i*24;
   if(i>=count){if(rainData[o+1]>-40)for(let k=1;k<24;k+=3)rainData[o+k]=-50;continue;}
   // Streaks keep their place in the world while the box moves with the camera.
   const x=centre.x+(((rainSeeds[i*3]*box-centre.x)%box+box)%box)-box/2,z=centre.z+(((rainSeeds[i*3+1]*box-centre.z)%box+box)%box)-box/2;
   const y=top-((seconds*speed+rainSeeds[i*3+2]*top)%top);
   // The picture has no roofs, so rain over a room would fall on the people in it: keep it outside the walls.
   const lean=tilt*(top-y)/17,dx=tilt*.035*rainSettings.length/.7,len=rainSettings.length*(.8+weather.rain*.4);
   const roof=inside(BUILDING,x+lean,z)||inside(SHED,x+lean,z);
   // Nor right in front of the lens.
   const close=cam?(x+lean-cam.x)**2+(z-cam.z)**2<9&&Math.abs(y-cam.y)<4:false;
   if(close||roof&&!(upstairs&&z>38)){for(let k=1;k<24;k+=3)rainData[o+k]=-50;continue;}
   // Two quads at right angles: bottom-left, bottom-right, top-left, top-right.
   rainData.set([x+lean-half,y,z, x+lean+half,y,z, x+lean+dx-half,y+len,z, x+lean+dx+half,y+len,z,
    x+lean,y,z-half, x+lean,y,z+half, x+lean+dx,y+len,z-half, x+lean+dx,y+len,z+half],o);
  }
  (rain.geometry.getAttribute('position') as T.BufferAttribute).needsUpdate=true;
  (rain.material as T.MeshBasicMaterial).opacity=(.2+.22*weather.rain+flash*.4)*rainSettings.opacity;
 }
 return {afterFreeze,step};
}

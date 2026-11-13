// The film set (2026-11-13): things only the movie page adds to the observatory, for shots from outside.
// The game draws its buildings without roofs so the player can see in; a film's exterior needs a building. So the set
// adds roofs, a porch, windows that glow with the circuits behind them (and go dark, or emergency red, with them),
// beams under the floodlights, and a wet sheen on the yard. `roof(0..1)` fades the roofs and the dome's skin in and
// out, so a shot can start on the building and open it up. Nothing here changes the simulation.
import * as T from 'three';
import type {ObservatoryWorld} from './world';

type Window={pane:T.MeshStandardMaterial;circuit:string};

export function buildFilmSet(scene:T.Scene,domeShell:T.MeshStandardMaterial|undefined){
 const root=new T.Group();root.name='film-set';scene.add(root);
 const roofs=new T.Group();root.add(roofs);
 const roofMaterial=new T.MeshStandardMaterial({color:'#2c343d',roughness:.42,metalness:.25,transparent:true});
 const trim=new T.MeshStandardMaterial({color:'#566270',roughness:.5,metalness:.3,transparent:true});
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,material:T.Material,parent:T.Object3D=roofs)=>{
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 // Roof slabs over everything but the dome's drum, each with a raised edge.
 const slab=(minX:number,maxX:number,minZ:number,maxZ:number,y:number)=>{
  const w=maxX-minX+.5,d=maxZ-minZ+.5,x=(minX+maxX)/2,z=(minZ+maxZ)/2;
  box(w,.28,d,x,y,z,roofMaterial);
  box(w,.22,.18,x,y+.25,minZ-.16,trim);box(w,.22,.18,x,y+.25,maxZ+.16,trim);
  box(.18,.22,d,minX-.16,y+.25,z,trim);box(.18,.22,d,maxX+.16,y+.25,z,trim);
 };
 slab(10,46,10,22,3.56);slab(10,20,22,38,3.56);slab(36,46,22,32,3.56);slab(36,46,32,38,6.04);slab(2,8,28,36,3.56);
 // Roof clutter: air handlers, a vent stack, the lounge's chimney.
 box(2.2,.9,1.4,40,4.15,14,trim);box(1.6,.7,1.2,33,4.05,13.2,trim);box(.5,1.6,.5,10.7,4.4,16,trim);box(1.2,.6,1.2,14,4,30,trim);
 // The porch over the front door, with a strip of light under it.
 box(5.4,.2,2.4,28,3.05,8.9,roofMaterial);box(.14,3,.14,25.5,1.5,7.9,trim);box(.14,3,.14,30.5,1.5,7.9,trim);
 const porchLight=new T.MeshStandardMaterial({color:'#fff1d0',emissive:'#fff1d0',emissiveIntensity:1.6});
 box(3.6,.05,.25,28,2.93,8.9,porchLight,root);

 // Windows: a glowing pane in a dark frame, a little proud of the wall. `face` is the outward direction.
 const windows:Window[]=[];
 const frame=new T.MeshStandardMaterial({color:'#12161b',roughness:.6});
 const windowAt=(x:number,y:number,z:number,face:'s'|'n'|'e'|'w',circuit:string,w=1.9,h=1.45)=>{
  const pane=new T.MeshStandardMaterial({color:'#2a2418',emissive:'#ffd29a',emissiveIntensity:1.0,roughness:.3});
  const g=new T.Group();g.position.set(x,y,z);g.rotation.y=face==='s'?Math.PI:face==='e'?Math.PI/2:face==='w'?-Math.PI/2:0;root.add(g);
  box(w+.16,h+.16,.06,0,0,.0,frame,g);box(w,h,.04,0,0,.03,pane,g);
  box(.06,h,.05,0,0,.05,frame,g);box(w,.06,.05,0,.1,.05,frame,g);
  windows.push({pane,circuit});
 };
 for(const x of [12.2,15.8,20.6,23.6,32.4,35.4,40.6,43.6])windowAt(x,1.95,9.86,'s','lights-public');
 for(const z of [13,17])windowAt(9.86,1.95,z,'w','lights-public');
 for(const z of [28,31,35.5])windowAt(9.86,1.95,z,'w','lights-staff');
 windowAt(46.14,1.95,13,'e','lights-public');
 for(const z of [19,28,31,35.5])windowAt(46.14,1.95,z,'e','lights-staff');
 for(const x of [13,17,39,43])windowAt(x,1.95,38.14,'n','lights-staff');
 for(const x of [39,43])windowAt(x,4.85,38.14,'n','lights-dome',1.6,1.1);
 windowAt(46.14,4.85,35,'e','lights-dome',1.6,1.1);
 windowAt(8.14,1.9,30.2,'e','lights-staff',1.2,1);

 // Beams under the floodlights (they show in the rain).
 const beam=new T.MeshBasicMaterial({color:'#bcd3ff',transparent:true,opacity:.055,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
 const beams=([[28,10.6],[9.4,27],[46.6,27],[28,38.6]] as number[][]).map(([x,z])=>{
  const m=new T.Mesh(new T.ConeGeometry(4.6,4.5,20,1,true),beam);m.position.set(x,2.3,z);root.add(m);return m;
 });
 // Rain on the yard: a dark, glossy sheet just above the ground.
 const wet=new T.Mesh(new T.PlaneGeometry(120,70),new T.MeshStandardMaterial({color:'#0a0d12',roughness:.16,metalness:.75,transparent:true,opacity:.5,depthWrite:false}));
 wet.rotation.x=-Math.PI/2;wet.position.set(28,.022,-8);wet.receiveShadow=true;root.add(wet);
 const wetBack=wet.clone();wetBack.position.set(28,.022,74);root.add(wetBack);

 const shellBase=domeShell?.opacity??.2;
 let alpha=1;
 return {
  /** 1: a closed building seen from outside; 0: the game's open rooms. */
  roof(value:number){
   alpha=Math.max(0,Math.min(1,value));
   roofs.visible=alpha>.01;
   for(const m of [roofMaterial,trim]){m.opacity=alpha;m.depthWrite=alpha>.6;}
   if(domeShell){domeShell.opacity=shellBase+(.86-shellBase)*alpha;domeShell.depthWrite=alpha>.6;}
  },
  update(w:ObservatoryWorld){
   const emergency=w.grid.powered('safety');
   for(const win of windows){
    const lit=w.grid.powered(win.circuit);
    win.pane.emissive.set(lit?'#ffd29a':'#ff3a2a');
    win.pane.emissiveIntensity=lit?1.0:emergency?.3:.02;
   }
   const floods=w.grid.powered('lights-dome');
   for(const b of beams)b.visible=floods;
   porchLight.emissiveIntensity=w.grid.powered('lights-public')?1.6:.03;
  },
 };
}

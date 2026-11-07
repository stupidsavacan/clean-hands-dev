import * as T from 'three';
import type {M57Map,M57System} from './m57';
import {floorOf,type Position} from './world';
/** What M5.7 draws (placeholder look, as M5 allows): the trap props and how they change when prepared and set off —
 * the pool light stand, the yacht crane and its load, the chandelier, the tasting stove, the loose balcony rail, the
 * escape boat, the firework tubes and the alarm bell — plus a short fireball for the explosions. */
const mat=(c:string,e?:string)=>new T.MeshStandardMaterial({color:c,roughness:.6,metalness:.2,...(e?{emissive:e,emissiveIntensity:.8}:{})});
function boxAt(w:number,h:number,d:number,c:string,e?:string){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c,e));m.castShadow=true;return m;}
function cyl(r:number,h:number,c:string,e?:string){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,10),mat(c,e));m.castShadow=true;return m;}
export class M57View{
 private readonly parts:Record<string,T.Object3D>={};private readonly blasts=new Map<string,T.Mesh>();private readonly spark:T.Mesh;
 private readonly root=new T.Group();private readonly map:M57Map;
 constructor(scene:T.Scene,map:M57Map,groupOf:(floor:number)=>T.Object3D){this.map=map;scene.add(this.root);this.root.name='m57';const P=map.props;
  const put=(id:string,o:T.Object3D,at:Position)=>{o.position.set(at.x,at.y,at.z);o.name='m57-'+id;groupOf(floorOf(at.y)).add(o);this.parts[id]=o;};
  // Pool light: a stand with a lamp head; it falls into the water.
  const stand=new T.Group(),pole=cyl(.04,2.2,'#2b2e35');pole.position.y=1.1;const head=boxAt(.5,.32,.3,'#e9e4d4','#fff2b0');head.position.y=2.25;stand.add(pole,head);put('light_stand',stand,P.light_stand);
  // Yacht crane: mast on the quay, jib over the deck, a load hanging from it.
  const crane=new T.Group(),mast=boxAt(.4,7,.4,'#d9a400');mast.position.y=3.5;crane.add(mast);const L=P.crane_load,dx=L.x-P.crane.x,dz=L.z-P.crane.z,len=Math.hypot(dx,dz);
  const jib=boxAt(.25,.25,len+1,'#d9a400');jib.position.set(dx/2,6.9,dz/2);jib.rotation.y=Math.atan2(dx,dz);crane.add(jib);put('crane',crane,P.crane);
  const load=new T.Group(),crate=boxAt(1.8,1.2,1.8,'#7a5a3c');crate.position.y=.6;const rope=cyl(.02,2.6,'#2b2e35');rope.position.y=2.5;rope.name='rope';load.add(crate,rope);put('crane_load',load,{...L,y:L.y+3.9});
  put('crane_panel',boxAt(.5,1.1,.35,'#3b5b8a','#225'),P.crane_panel);
  // Chandelier over the banquet stage.
  const ch=new T.Group(),ring=new T.Mesh(new T.TorusGeometry(.9,.06,6,18),mat('#c9a95a','#7a5a20'));ring.rotation.x=Math.PI/2;ch.add(ring);for(let i=0;i<8;i++){const g=cyl(.05,.35,'#f6f2e2','#fff2c0');g.position.set(Math.sin(i*.785)*.9,-.2,Math.cos(i*.785)*.9);ch.add(g);}
  put('chandelier',ch,P.chandelier);put('clamp',boxAt(.3,.3,.3,'#8d969c'),{...P.clamp,y:P.clamp.y+1.1});
  put('gas_pipe',cyl(.05,1.6,'#b36b2a'),{...P.gas_pipe,y:P.gas_pipe.y+.8});put('tasting_stove',boxAt(.9,.9,.6,'#d6d8d2'),P.tasting_stove);
  put('wagon',boxAt(.9,.85,.55,'#efeadf'),P.wagon);
  put('rail',boxAt(2.4,.1,.08,'#c9c3b6'),{...P.rail,y:P.rail.y+1.05});
  const boat=new T.Group(),hull=boxAt(1.8,.7,4.2,'#efeadf');hull.position.y=.35;const cabin=boxAt(1.2,.6,1.4,'#3b5b8a');cabin.position.set(0,.95,-.4);boat.add(hull,cabin);put('evac_boat',boat,P.evac_boat);
  put('alarm_bell',new T.Mesh(new T.CylinderGeometry(.22,.22,.1,16),mat('#c22f21','#400')),{...P.alarm_bell,y:P.alarm_bell.y+1.6});this.parts.alarm_bell.rotation.x=Math.PI/2;
  const tubes=new T.Group();for(let i=0;i<3;i++){const t=cyl(.09,.9,'#c22f21');t.position.set(i*.3-.3,.45,0);tubes.add(t);}put('fireworks',tubes,P.fireworks);
  this.spark=new T.Mesh(new T.SphereGeometry(.12,8,6),new T.MeshBasicMaterial({color:'#ffe680'}));this.spark.visible=false;put('spark',this.spark,{...P.powerpanel,y:P.powerpanel.y+1.3});}
 reset(){for(const b of this.blasts.values())b.removeFromParent();this.blasts.clear();}
 render(s:M57System,time:number){const P=this.map.props,armed=(id:string)=>s.armed.has(id),fired=(id:string)=>s.fired.has(id);
  this.spark.visible=armed('pool_light')&&!fired('pool_light')&&Math.sin(time*23)>0;
  const stand=this.parts.light_stand;stand.rotation.z=fired('pool_light')?-1.35:0;
  const load=this.parts.crane_load;load.position.y=fired('yacht_crane')?P.crane_load.y+.05:P.crane_load.y+3.9+(armed('yacht_crane')?Math.sin(time*2.4)*.15:0);load.getObjectByName('rope')!.visible=!fired('yacht_crane');
  const ch=this.parts.chandelier;ch.position.y=fired('chandelier')?P.chandelier.y-2.4:P.chandelier.y+(armed('chandelier')?Math.sin(time*5)*.03:0);ch.rotation.z=fired('chandelier')?.25:0;
  const rail=this.parts.rail;rail.rotation.x=fired('balcony_rail')?.9:armed('balcony_rail')?.05:0;
  this.parts.fireworks.rotation.z=armed('fireworks')?1.2:0;this.parts.evac_boat.visible=!fired('boat_fuel')&&!s.escaped.has('investor');
  const bell=this.parts.alarm_bell as T.Mesh;(bell.material as T.MeshStandardMaterial).emissiveIntensity=s.flags.has('alarm')?(Math.sin(time*12)>0?3:.2):.3;
  // Fireballs grow and fade over a second and a half.
  for(const b of s.blasts){if(!['gas_leak','boat_fuel','fireworks','pool_light'].includes(b.trap))continue;let m=this.blasts.get(b.trap);const age=time-b.time;
   if(!m){m=new T.Mesh(new T.SphereGeometry(1,16,10),new T.MeshBasicMaterial({color:b.trap==='pool_light'?'#bfe3ff':'#ff8a2a',transparent:true,depthWrite:false}));m.position.set(b.at.x,b.at.y+1,b.at.z);this.root.add(m);this.blasts.set(b.trap,m);}
   m.visible=age<1.5;if(m.visible){m.scale.setScalar(.6+age*2.2);(m.material as T.MeshBasicMaterial).opacity=Math.max(0,.85-age*.55);}}}
}

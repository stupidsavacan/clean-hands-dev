import * as T from 'three';
import type {M53System} from './m53';
export class M53View{
 readonly root=new T.Group();private boat:T.Mesh;private wine:T.Mesh;private glass:T.Mesh;private rings:T.Mesh[]=[];
 constructor(scene:T.Scene,system:M53System){scene.add(this.root);this.boat=new T.Mesh(new T.BoxGeometry(3,.4,1.3),new T.MeshStandardMaterial({color:'#d6dfd7',roughness:.8}));const b=system.map.arrivalBoat;this.boat.position.set(b.x,b.y,b.z);this.root.add(this.boat);const p=system.map.barrel.position;this.wine=new T.Mesh(new T.TorusGeometry(.38,.025,4,20),new T.MeshBasicMaterial({color:'#9b4671'}));this.wine.rotation.x=Math.PI/2;this.wine.position.set(p.x,p.y+1.22,p.z);this.root.add(this.wine);
  this.glass=new T.Mesh(new T.CylinderGeometry(.07,.025,.16,6),new T.MeshStandardMaterial({color:'#e0c7b8',roughness:.4}));const g=system.map.glass.position;this.glass.position.set(g.x,g.y+.85,g.z);this.root.add(this.glass);}
 render(system:M53System){this.root.visible=true;this.boat.visible=system.clock.time>=300;this.wine.visible=system.barrel==='armed';this.wine.rotation.z=Math.sin(system.clock.elapsed*2)*.025;
  const cordons=system.cordons.filter(c=>c.until>system.clock.elapsed);while(this.rings.length<cordons.length){const m=new T.Mesh(new T.RingGeometry(system.rules.cordonRadius-.07,system.rules.cordonRadius,48),new T.MeshBasicMaterial({color:'#e3b34d',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));m.rotation.x=-Math.PI/2;this.root.add(m);this.rings.push(m);}
  this.rings.forEach((m,i)=>{m.visible=i<cordons.length;if(m.visible){const p=cordons[i].position;m.position.set(p.x,p.y+.025,p.z);}});
 }
}

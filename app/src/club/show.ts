import * as T from 'three';

// The light show over the dance floor (2026-11-03, asked for "fairly hard" flashes and lasers): laser fans from the
// stage, moving-head beams from the catwalk and strobe bursts. Look only: no light sources, no effect on sight, so it
// costs a few additive meshes on the iPad. Strobe bursts stay under three flashes a second (the usual photosensitivity
// limit) and everything goes dark with the drop's blackout.
const LASER_COLORS=['#00ff3c','#ff0a2a','#00b8ff','#ff00c8'];
const BEAM_COLORS=['#f4f1ff','#7a8dff','#c46bff','#f4f1ff','#5fd6ff','#ff7ad1'];
// One bar of the set is 0.48 s (125 BPM); patterns change every 16 bars.
const BAR=.48,SECTION=16*BAR;
// Off for now (playtest 2026-11-03: the whole-scene flash wrecked the picture). Turn back on to try it again.
const STROBE=false;

type Laser={mesh:T.Mesh;fan:number;emitter:number};
type MovingHead={yoke:T.Object3D;head:T.Object3D;anchor:T.Object3D};
type Beam={mesh:T.Mesh;phase:number;speed:number;rig?:MovingHead};

// Not tone-mapped, so a green laser stays green instead of washing out to white.
const additive=(color:string,opacity:number)=>new T.MeshBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});

export class ClubShow {
 readonly root=new T.Group();
 private readonly lasers:Laser[]=[];
 private readonly beams:Beam[]=[];
 private readonly strobes:T.Mesh[]=[];
 private readonly beamDirection=new T.Vector3();
 private readonly laserMaterials=LASER_COLORS.map(c=>additive(c,.9));
 private readonly hemi:T.HemisphereLight;
 private readonly base:number;
 constructor(scene:T.Scene,hemi:T.HemisphereLight,fixture:T.Object3D|null){
  this.hemi=hemi;this.base=hemi.intensity;
  scene.add(this.root);
  // Laser emitters on the back of the stage, three beams each, fanning out over the floor (toward -z).
  const laser=new T.BoxGeometry(.022,.022,1).translate(0,0,.5);
  for(const [e,x] of [19.5,22.5,25.5,28.5].entries())for(let fan=-1;fan<=1;fan++){
   const mesh=new T.Mesh(laser,this.laserMaterials[0]);mesh.position.set(x,2.7,33.4);mesh.scale.z=24;
   this.root.add(mesh);this.lasers.push({mesh,fan,emitter:e});
   const head=new T.Mesh(new T.BoxGeometry(.3,.18,.3),new T.MeshStandardMaterial({color:'#18181b',roughness:.5}));head.position.set(x,2.7,33.6);this.root.add(head);
  }
  // Moving heads hung under the catwalk, each throwing a soft cone onto the floor.
  const cone=new T.ConeGeometry(1.1,6.2,18,1,true).translate(0,-3.1,0);
  for(let i=0;i<6;i++){
   const x=16.5+i*3.4,z=28.4;
   const mesh=new T.Mesh(cone,additive(BEAM_COLORS[i],.16));
   mesh.name='moving-head-cone';mesh.position.set(x,3.35,z);
   const beam:Beam={mesh,phase:i*1.1,speed:.55+i%3*.12};
   this.root.add(mesh);this.beams.push(beam);
   const model=fixture?.clone(true);
   if(!model)continue;
   const hang=model.getObjectByName('HANG'),anchor=model.getObjectByName('BEAM');
   const yoke=model.getObjectByName('yoke'),head=model.getObjectByName('head');
   if(!hang||!anchor||!yoke||!head)continue;
   // The 2F deck is at 3.50 m and its rendered floor plate is 0.50 m thick.
   const mount=hang.getWorldPosition(new T.Vector3());
   model.position.set(x,3,z).sub(mount);
   this.root.add(model);beam.rig={yoke,head,anchor};
   this.root.worldToLocal(anchor.getWorldPosition(mesh.position));
  }
  // Strobe bars along the stage front and over the floor.
  const bar=new T.BoxGeometry(1.4,.12,.18);
  for(const [x,y,z] of [[20,2.6,30.15],[24,2.6,30.15],[28,2.6,30.15],[18,6.6,18],[24,6.6,18],[30,6.6,18],[18,6.6,24],[30,6.6,24]]){
   const mesh=new T.Mesh(bar,new T.MeshBasicMaterial({color:'#ffffff'}));mesh.position.set(x,y,z);mesh.visible=false;this.root.add(mesh);this.strobes.push(mesh);
  }
 }
 step(t:number,dark:boolean){
  this.root.visible=!dark;
  if(dark){this.hemi.intensity=this.base;return;}
  const section=Math.floor(t/SECTION),inSection=t-section*SECTION,mode=section%4,beat=t/BAR;
  // Lasers: 0 sweeping fans, 1 scissors, 2 a low tunnel over the heads, 3 chopped on the beat.
  const color=this.laserMaterials[section%this.laserMaterials.length];
  const chopped=mode===3&&Math.floor(beat*2)%2===1;
  for(const l of this.lasers){
   l.mesh.material=color;l.mesh.visible=!chopped;
   const side=l.emitter%2?1:-1;
   const sweep=mode===1?Math.sin(t*1.3)*.55*side:mode===2?Math.sin(t*.7+l.emitter)*.25:Math.sin(t*.9+l.emitter*.6)*.45;
   const yaw=Math.PI+sweep+l.fan*(mode===2?.12:.22);
   // Mostly over the heads; the tunnel dips to just above them (~2 m at mid-floor).
   const pitch=mode===2?.045+.01*Math.sin(t*2+l.fan):.01+.035*Math.sin(t*1.7+l.emitter);
   l.mesh.rotation.set(pitch,yaw,0,'YXZ');
  }
  for(const b of this.beams){
   const a=t*b.speed+b.phase;
   b.mesh.rotation.set(Math.sin(a)*.55,0,Math.cos(a*1.3)*.45);
   if(b.rig){
    const {yoke,head,anchor}=b.rig;
    const {x,y,z}=this.beamDirection.set(0,-1,0).applyQuaternion(b.mesh.quaternion);
    const horizontal=Math.hypot(x,z);
    let tilt=Math.atan2(horizontal,-y);
    if(horizontal>1e-8){
     let pan=Math.atan2(-x,-z);
     // Use the equivalent signed tilt to keep the yoke from flipping as the beam crosses vertical.
     if(Math.cos(pan-yoke.rotation.y)<0){pan+=Math.PI;tilt=-tilt;}
     yoke.rotation.y=pan;
    }
    head.rotation.x=tilt;
    this.root.worldToLocal(anchor.getWorldPosition(b.mesh.position));
   }
   (b.mesh.material as T.MeshBasicMaterial).opacity=mode===3?(Math.floor(beat)%2?.26:.06):.16;
  }
  // Strobe: the last four bars of every section, 2.5 flashes a second, 60 ms each.
  const burst=inSection>SECTION-4*BAR,flash=STROBE&&burst&&(t*2.5)%1<.15;
  for(const s of this.strobes)s.visible=flash;
  this.hemi.intensity=flash?this.base*2.6:this.base;
 }
}

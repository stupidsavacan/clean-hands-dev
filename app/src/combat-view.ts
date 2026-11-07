import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {COMBAT_MODELS} from './combat-data.ts';
import {sampleCombat,weaponVisible,COMBAT_SECONDS,type CombatKind,type WeaponClass} from './combat-motion.ts';
import {poseCombat,prepareWeapon,muzzle,layerUpper,type Weapon} from './combat-runtime.ts';
import {applyMotion} from './motion-runtime.ts';
import type {CombatSystem} from './combat.ts';
import type {Rig} from './rig.ts';
import type {NpcView} from './npc-view.ts';
const CLASS:Record<string,WeaponClass>={tranq_pistol:'pistol',pistol_silenced:'pistol',pistol_guard:'pistol',smg:'long',rifle_npc:'long'};
/** Everything of the gunfight that is drawn: the agent's and the guards' guns and gunfight poses, bystanders running
 * and cowering, muzzle flashes, tracers and guns lying on the floor. Simulation lives in CombatSystem. */
export class CombatView{
 readonly root=new T.Group();private templates=new Map<string,T.Object3D>();private mine=new Map<string,Weapon>();private npcGuns=new Map<NpcView,Weapon>();
 private stowed=new Map<NpcView,{id:string;object:T.Object3D}>();
 private flash?:T.Object3D;private npcFlashes:T.Object3D[]=[];private tracers:T.LineSegments;private floor=new Map<number,T.Object3D>();
 private anim:{kind:CombatKind;start:number;gun:string}={kind:'aim',start:-1e9,gun:''};
 constructor(scene:T.Scene){scene.add(this.root);this.root.name='combat';
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(64*6),3));g.setDrawRange(0,0);
  this.tracers=new T.LineSegments(g,new T.LineBasicMaterial({color:'#ffd27a',transparent:true,opacity:.85}));this.tracers.frustumCulled=false;this.root.add(this.tracers);}
 async load(){const loader=new GLTFLoader();for(const id of Object.keys(CLASS).concat('muzzle_flash')){const b=COMBAT_MODELS[id];if(!b)continue;
   const s=(await loader.parseAsync(Uint8Array.from(atob(b),c=>c.charCodeAt(0)).buffer,'')).scene;s.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=true;});this.templates.set(id,s);}
  this.flash=this.make('muzzle_flash');if(this.flash){this.flash.visible=false;this.root.add(this.flash);}
  for(let i=0;i<6;i++){const f=this.make('muzzle_flash');if(f){f.visible=false;this.root.add(f);this.npcFlashes.push(f);}}}
 /** Flashes and the agent's guns shown for one compile, so the first shot does not stall on building their shaders. */
 warm(compile:()=>void){const shown=[this.flash,...this.npcFlashes,...Object.keys(CLASS).filter(id=>id!=='rifle_npc').map(id=>this.mineFor(id)?.object)].filter((o):o is T.Object3D=>!!o);for(const o of shown)o.visible=true;compile();for(const o of shown)o.visible=false;}
 private make(id:string){const t=this.templates.get(id);return t?t.clone(true):undefined;}
 private weapon(id:string,parent:T.Object3D){const s=this.make(id);if(!s)return undefined;parent.add(s);return prepareWeapon(s,CLASS[id]??'pistol');}
 reset(){for(const s of this.stowed.values())s.object.removeFromParent();this.stowed.clear();for(const w of this.mine.values())w.object.visible=false;for(const [v,w] of this.npcGuns){w.object.removeFromParent();this.npcGuns.delete(v);}for(const o of this.floor.values())o.removeFromParent();this.floor.clear();this.anim={kind:'aim',start:-1e9,gun:''};}
 /** The agent's moves: draw, holster, a shot and a reload start their short clips. */
 play(kind:CombatKind,now:number,gun:string){this.anim={kind,start:now,gun};}
 private mineFor(id:string){let w=this.mine.get(id);if(!w){w=this.weapon(id,this.root);if(w)this.mine.set(id,w);}return w;}
 player(rig:Rig,actor:T.Object3D,model:T.Object3D,c:CombatSystem,now:number,crouch=0){for(const w of this.mine.values())w.object.visible=false;if(this.flash)this.flash.visible=false;
  const a=this.anim,since=(now-a.start)/1000,holstering=!c.hand&&a.kind==='holster'&&since<COMBAT_SECONDS.holster,id=c.hand||(holstering?a.gun:'');
  // A long gun that is carried but not in hand hangs across the back, in plain view.
  const slung=c.guns.find(g=>CLASS[g.id]==='long'&&g.id!==id);if(slung){const w=this.mineFor(slung.id);if(w){w.object.visible=true;actor.updateMatrixWorld(true);w.object.position.copy(actor.localToWorld(new T.Vector3(-.02,1.18,-.17)));w.object.quaternion.copy(actor.getWorldQuaternion(new T.Quaternion())).multiply(new T.Quaternion().setFromEuler(new T.Euler(-1.15,0,.6)));}}
  if(!id)return;const w=this.mineFor(id),cls=CLASS[id]??'pistol';if(!w)return;
  let kind:CombatKind='aim',t=(now/1000/COMBAT_SECONDS.aim)%1;
  if(holstering){kind='holster';t=since/COMBAT_SECONDS.holster;}
  else if(c.reloadT>0){kind='reload';t=1-c.reloadT/c.rules.reloadSeconds;}
  else if(a.kind==='draw'&&since<COMBAT_SECONDS.draw){kind='draw';t=since/COMBAT_SECONDS.draw;}
  else if(a.kind==='fire'&&since<COMBAT_SECONDS.fire){kind='fire';t=since/COMBAT_SECONDS.fire;}
  poseCombat(rig,actor,model,sampleCombat(kind,cls,t),w,crouch);w.object.visible=weaponVisible(kind,cls,t,true);
  if(this.flash&&a.kind==='fire'&&since<.06){this.flash.visible=true;this.flash.position.copy(muzzle(w));this.flash.quaternion.copy(w.object.quaternion);this.flash.scale.setScalar(cls==='long'?1.4:1);}}
 /** Hooked into NpcView: guards in a fight aim their own gun; bystanders run with their arms over their heads, then cower. */
 npc(view:NpcView,time:number){const n=view.npc;let w=this.npcGuns.get(view);
  if(n.active&&!n.busy&&n.state==='combat'&&n.weapon){if(!w){w=this.weapon(n.weapon,view.group);if(w)this.npcGuns.set(view,w);}if(!w)return;const since=time-n.shotAt;
   poseCombat(view.rig,view.group,view.body,since<COMBAT_SECONDS.fire?sampleCombat('fire',w.cls,since/COMBAT_SECONDS.fire):sampleCombat('aim',w.cls,(time/COMBAT_SECONDS.aim)%1),w);w.object.visible=true;return;}
  if(w)w.object.visible=false;
  if(n.active&&n.state==='flee'){if(!n.arrived)layerUpper(view.rig,sampleCombat('flee','pistol',(performance.now()/800)%1).pose);else applyMotion(view.rig,view.body,sampleCombat('duck','pistol',1).pose);}}
 /** A gun an armed NPC carries while not fighting, in the actor's own space: a pistol muzzle-down in a holster on the
  * right hip (actor -X), a long gun slung across the back the way the agent carries one. */
 private carried(id:string){const cls=CLASS[id]??'pistol',made=this.make(id);if(!made)return undefined;const w=prepareWeapon(made,cls),g=new T.Group();g.name='stowed-'+id;g.add(w.object);
  if(cls==='long'){w.object.position.set(-.02,1.18,-.17);w.object.rotation.set(-1.15,0,.6);return g;}
  // Weapon space is +Z muzzle, +Y slide: turn the muzzle down and the trigger guard forward, then hang it by the grip.
  const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2)),hip=new T.Vector3(-.205,.99,-.01);
  w.object.quaternion.copy(q);w.object.position.copy(hip).sub((w.anchors.GRIP_R??new T.Vector3()).clone().applyQuaternion(q));
  const tip=(w.anchors.MUZZLE??new T.Vector3(0,0,.18)).clone().applyQuaternion(q).add(w.object.position),top=hip.y-.035,bottom=tip.y-.015;
  const holster=new T.Mesh(new T.BoxGeometry(.042,top-bottom,.075),new T.MeshStandardMaterial({color:'#1f2126',roughness:1,flatShading:true}));holster.position.set(hip.x,(top+bottom)/2,hip.z+.006);holster.castShadow=true;g.add(holster);
  return g;}
 /** Tracers and flashes of the last instants, and guns lying where they fell. */
 render(c:CombatSystem,time:number,npcViews:NpcView[]){
  // NpcView can skip posing down, hidden, busy or distant people; clear their last held gun every frame.
  for(const [v,w] of this.npcGuns)if(!v.npc.active||v.npc.busy||v.npc.state!=='combat'||!v.npc.weapon||!v.group.visible)w.object.visible=false;
  const live=c.tracers.filter(t=>time-t.time<=.12),pos=this.tracers.geometry.getAttribute('position') as T.BufferAttribute;let k=0;
  for(const t of live.slice(-64)){pos.setXYZ(k++,t.from.x,t.from.y,t.from.z);pos.setXYZ(k++,t.to.x,t.to.y,t.to.z);}pos.needsUpdate=true;this.tracers.geometry.setDrawRange(0,k);
  this.npcFlashes.forEach(f=>f.visible=false);let i=0;for(const t of live)if(t.npc&&i<this.npcFlashes.length){const v=npcViews.find(v=>v.npc.active&&v.npc.state==='combat'&&Math.hypot(v.npc.pos.x-t.from.x,v.npc.pos.z-t.from.z)<.05);const w=v&&this.npcGuns.get(v);if(!w)continue;const f=this.npcFlashes[i++];f.visible=true;f.position.copy(muzzle(w));f.quaternion.copy(w.object.getWorldQuaternion(new T.Quaternion()));f.scale.setScalar(w.cls==='long'?1.4:1);}
  // Holstered and slung guns of the armed people not in a fight; gone once they are down (CombatSystem drops the gun).
  for(const v of npcViews){const n=v.npc,id=n.weapon,show=!!id&&n.active&&n.life==='active'&&n.state!=='combat'&&v.group.visible;let s=this.stowed.get(v);
   if(s&&s.id!==id){s.object.removeFromParent();this.stowed.delete(v);s=undefined;}
   if(!show){if(s)s.object.visible=false;continue;}
   if(!s){const o=this.carried(id);if(!o)continue;v.group.add(o);s={id,object:o};this.stowed.set(v,s);}s.object.visible=true;}
  const keys=new Set(c.dropped.map(d=>d.key));for(const [key,o] of this.floor)if(!keys.has(key)){o.removeFromParent();this.floor.delete(key);}
  for(const d of c.dropped)if(!this.floor.has(d.key)){const o=this.make(d.gun.id);if(!o)continue;o.position.set(d.pos.x,d.pos.y+.03,d.pos.z);o.rotation.set(0,d.key*1.7,Math.PI/2);this.root.add(o);this.floor.set(d.key,o);}}
}

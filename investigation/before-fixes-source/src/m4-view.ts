import * as T from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {Rig,canonical} from './rig';
import type {M4System} from './m4';
import type {NpcView} from './npc-view';
import {sampleM4Motion} from './m4-motion';
import {applyLook} from './appearance';
import type {Look} from './wardrobe';
// Palette cells of character-revision (build_characters.py COLORS), for the folded clothes on the floor.
const P=['#2b2e35','#efeadf','#c22f21','#f2c14e','#17776c','#3b5b8a','#4fb8c9','#d9b39a','#9b7053','#503f35','#8b9c88','#c8d7cf','#ddd0b8','#a9bcc9','#f2d7c4','#737a82'];
// A folded uniform: [jacket, trousers, the role's mark, hat or -1], the same cells build_uniforms.py dresses it in.
const FOLDED:Record<string,[number,number,number,number]>={guard:[5,5,3,5],waiter:[1,0,0,-1],chef:[1,15,2,1],cleaner:[10,15,1,-1],delivery:[15,0,3,0],fisher:[4,0,3,2],
 bodyguard:[0,0,1,-1],sommelier:[0,9,3,-1],photographer:[10,12,0,-1],driver:[15,15,1,0],beachbar:[6,12,0,-1],pilot:[9,0,12,0],masseuse:[1,10,4,-1]};
// Hands in a uniform: the agent's own gloves come off, except for the driver's white ones.
const UNIFORM_HANDS:Record<string,string>={driver:P[1]};
/** Moves the clothing meshes of `template` onto `model`, skinned to its rig (the cast shares one 22-bone skeleton). */
function dressIn(model:T.Object3D,rig:Rig,template:T.Object3D,names:string[],tag:string,flag:string){const worn=clone(template),meshes:T.SkinnedMesh[]=[];
 worn.traverse(o=>{const m=o as T.SkinnedMesh;if(m.isSkinnedMesh&&names.includes(m.name))meshes.push(m);});
 for(const m of meshes){const bones=m.skeleton.bones.map(b=>rig.joints.get(canonical(b.name))?.bone);if(bones.some(b=>!b))throw new Error('制服の骨格が一致しません');
  const bind=m.bindMatrix.clone(),skeleton=new T.Skeleton(bones as T.Bone[],m.skeleton.boneInverses.map(i=>i.clone()));m.removeFromParent();m.name=tag+'_'+m.name;m.userData[flag]=true;m.frustumCulled=false;m.castShadow=true;model.add(m);m.bind(skeleton,bind);}}
function foldedClothes(disguise:string,look:Look){const [top,bottom,mark,hat]=FOLDED[disguise]?.map(c=>c<0?'':P[c])??[look.suitColor,look.suitColor,look.shirtColor,''];
 const g=new T.Group(),slab=(w:number,h:number,d:number,c:string,y:number,turn:number)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:1,flatShading:true}));m.position.y=y;m.rotation.y=turn;m.castShadow=true;g.add(m);return m;};
 slab(.40,.05,.28,bottom,.025,0);slab(.36,.055,.25,top,.077,.12);slab(.12,.012,.2,mark,.11,.12).position.x=.02;
 if(hat){const h=new T.Mesh(new T.CylinderGeometry(.1,.11,.06,8),new T.MeshStandardMaterial({color:hat,roughness:1,flatShading:true}));h.position.set(.13,.035,.1);h.castShadow=true;g.add(h);}
 return g;}
export class M4View{
 private signature='';private owner?:M4System;private objects=new Map<string,T.Object3D>();readonly root=new T.Group();
 constructor(scene:T.Scene){scene.add(this.root);}
 refresh(model:T.Object3D,rig:Rig,system:M4System,look:Look,templates:Map<string,T.Object3D>){const key=model.uuid+':'+system.disguise;
  if(key!==this.signature){this.signature=key;for(const o of [...model.children])if(o.userData.uniform)o.removeFromParent();
   const template=system.disguise!=='suit'?templates.get(system.rules.uniformModels[system.disguise]):undefined;
   applyLook(model,template?{...look,gloveColor:UNIFORM_HANDS[system.disguise]??look.skin}:look);
   if(template){const hides=system.rules.uniformHides?.[system.disguise]??[];model.traverse(o=>{if((o as T.Mesh).isMesh&&(/^(Outfit|Details|Tie)/.test(o.name)||hides.some(h=>o.name.startsWith(h))))o.visible=false;});dressIn(model,rig,template,['Outfit','Accessories','Details'],'Uniform_'+system.disguise,'uniform');}}
  if(this.owner!==system){this.owner=system;this.objects.forEach(o=>o.removeFromParent());this.objects.clear();}
  const live=new Set<string>();for(const c of system.clothes){live.add(c.id);let item=this.objects.get(c.id);if(!item){item=foldedClothes(c.disguise,look);item.rotation.y=(c.id.length*1.7)%Math.PI;this.root.add(item);this.objects.set(c.id,item);}item.position.set(c.pos.x,c.pos.y+.005,c.pos.z);}
  for(const s of system.stashes){const id='wire-'+s.id;live.add(id);let item=this.objects.get(id);if(!item){item=new T.Mesh(new T.TorusGeometry(.08,.012,4,12),new T.MeshStandardMaterial({color:'#c4c5c3'}));item.rotation.x=Math.PI/2;this.root.add(item);this.objects.set(id,item);}item.position.set(s.pos.x,s.pos.y+.03,s.pos.z);}
  for(const [id,o]of this.objects)if(!live.has(id)){o.removeFromParent();this.objects.delete(id);}
 }
 /** A body whose clothes were taken lies in its underwear (rules.json m4.undressed; pool guests are already in swimwear). */
 bodies(system:M4System,views:NpcView[],templates:Map<string,T.Object3D>){const u=system.rules.undressed;if(!u)return;
  for(const v of views){const want=system.taken.has(v.npc.id)?(v.model in u.byModel?u.byModel[v.model]:u.default)??'':'',body=v.body;if((body.userData.undressed??'')===want)continue;
   for(const o of [...body.children])if(o.userData.undressed)o.removeFromParent();body.traverse(o=>{if(o.userData.hiddenByUndress){o.visible=true;delete o.userData.hiddenByUndress;}});
   const template=want?templates.get(want):undefined;body.userData.undressed=template?want:'';if(!template)continue;
   body.traverse(o=>{if((o as T.Mesh).isMesh&&!o.userData.undressed&&/^(Outfit|Accessories|Details)$/.test(o.name)&&o.visible){o.visible=false;o.userData.hiddenByUndress=true;}});
   dressIn(body,v.rig,template,['Outfit'],'Undressed','undressed');}}
 render(system:M4System,rig:Rig|undefined,views:NpcView[]){const a=system.action;if(!a||!rig)return;const p=system.progress,kind=a.kind==='change'?'change':'frisk',pose=sampleM4Motion(kind,a.kind==='change'?'giver':'receiver',p);for(const [name,xyz]of Object.entries(pose.bones))if(/^(spine|chest|neck|head|clavicle|upperarm|forearm|hand)/.test(name))rig.rotate(name,...xyz);
  if(a.guard){const guard=views.find(v=>v.npc===a.guard);if(guard){const pose=sampleM4Motion('frisk','giver',p);for(const [name,xyz]of Object.entries(pose.bones))guard.rig.rotate(name,...xyz);}}
 }
}

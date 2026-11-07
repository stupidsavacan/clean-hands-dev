import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARM_DROP, Rig } from '../rig';
import type { ClubCrowd, Extra } from './crowd';

const pixels=new WeakMap<T.Texture,ImageData>();
function palettePixels(texture:T.Texture){
 let data=pixels.get(texture);
 if(!data){
  const canvas=document.createElement('canvas'),image=texture.image as ImageBitmap;
  canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d')!;
  context.drawImage(image,0,0);
  data=context.getImageData(0,0,canvas.width,canvas.height);
  pixels.set(texture,data);
 }
 return data;
}

function bakedGeometry(template:T.Object3D,pose:string){
 const model=clone(template),rig=new Rig(model);
 const poses:Record<string,number[]> = {
  bounce:[-.45,.42,.9,-.25,-.18,.65,.03,0],
  twist:[.28,.05,.26,-.65,-.28,1.12,.07,.30],
  raise:[-2.26,.76,.32,.08,-.02,.18,-.06,-.10],
  // Both fists up for jumping in the front rows (2026-11-03).
  jump:[-2.5,.5,.55,-2.5,-.5,.55,-.04,0],
  glass:[-.37,.06,1.25,.03,-.02,.16,0,.05],
  chat:[.08,.19,.3,-.45,-.32,.75,.06,.12],
  phone:[-.63,.06,1.18,-.08,-.08,.16,.08,0],
  lean:[.36,.24,.35,.31,-.15,.45,-.16,-.09],
  sit:[-.2,.14,.46,-.21,-.12,.41,.11,0],
  crouch:[-1.9,.45,1.55,-1.9,-.45,1.55,.44,0],
 };
 const [rSwing,rLift,rBend,lSwing,lLift,lBend,spine,twist]=poses[pose];
 rig.rotate('spine',spine);rig.rotate('chest',0,twist);
 rig.rotate('upperarmr',rSwing,0,ARM_DROP-rLift);
 rig.rotate('forearmr',0,rBend);
 rig.rotate('upperarml',lSwing,0,-ARM_DROP-lLift);
 rig.rotate('forearml',0,-lBend);
 if(pose==='phone')rig.rotate('head',.32);
 if(pose==='glass'||pose==='phone'){
  const glass=pose==='glass';
  const prop=new T.Mesh(glass?new T.CylinderGeometry(.032,.025,.08,7):new T.BoxGeometry(.055,.105,.014),
                       new T.MeshStandardMaterial({color:glass?'#b68a5e':'#22232b'}));
  prop.position.set(.013,.046,.025);
  rig.joints.get('handr')?.bone.add(prop);
 }
 if(pose==='sit')for(const side of ['l','r']){
  rig.rotate('thigh'+side,-1.15);rig.rotate('shin'+side,1.2);
 }
 if(pose==='crouch'){
  rig.rotate('head',.21);
  for(const side of ['l','r']){
   rig.rotate('thigh'+side,-1.18,0,side==='l'?-.13:.13);
   rig.rotate('shin'+side,1.62);
   rig.rotate('foot'+side,-.44);
  }
 }
 model.updateMatrixWorld(true);
 const positions:number[]=[],colors:number[]=[],v=new T.Vector3(),uv=new T.Vector2(),sample=new T.Color(),texel=new T.Color();
 let ground=Infinity;
 model.traverse(o=>{
  const mesh=o as T.Mesh;
  if(!mesh.isMesh)return;
  if((mesh as T.SkinnedMesh).isSkinnedMesh)(mesh as T.SkinnedMesh).skeleton.update();
  const g=mesh.geometry,index=g.index,count=index?.count??g.getAttribute('position').count;
  const palette=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const groups=Array.isArray(mesh.material)&&g.groups.length?g.groups:[{start:0,count,materialIndex:0}];
  for(const group of groups){
   const material=palette[group.materialIndex??0] as T.MeshStandardMaterial;
   const color=material.color??new T.Color('#c9b9ae'),texture=material.map;
   const texCoord=texture&&g.getAttribute(texture.channel?'uv'+texture.channel:'uv');
   const texels=texture&&texCoord?palettePixels(texture):null;
   const vertexColors=g.getAttribute('color');
   for(let i=group.start;i<Math.min(group.start+group.count,count);i++){
    const j=index?index.getX(i):i;
    mesh.getVertexPosition(j,v).applyMatrix4(mesh.matrixWorld);
    positions.push(v.x,v.y,v.z);
    ground=Math.min(ground,v.y);
    sample.copy(color);
    if(texture&&texCoord&&texels){
     texture.transformUv(uv.set(texCoord.getX(j),texCoord.getY(j)));
     const x=Math.max(0,Math.min(texels.width-1,Math.floor(uv.x*texels.width)));
     const y=Math.max(0,Math.min(texels.height-1,Math.floor(uv.y*texels.height)));
     const offset=(y*texels.width+x)*4;
     sample.multiply(texel.setRGB(texels.data[offset]/255,texels.data[offset+1]/255,texels.data[offset+2]/255,texture.colorSpace));
    }
    colors.push(sample.r*(vertexColors?.getX(j)??1),sample.g*(vertexColors?.getY(j)??1),sample.b*(vertexColors?.getZ(j)??1));
   }
  }
 });
 const geometry=new T.BufferGeometry();
 if(Number.isFinite(ground))for(let i=1;i<positions.length;i+=3)positions[i]-=ground;
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 // Preserve flat faces and palette edges while sharing identical vertex inputs.
 return mergeVertices(geometry);
}

type Batch={indices:number[];mesh:T.InstancedMesh;panic:boolean};
export class CrowdView {
 readonly root=new T.Group();
 private readonly time={value:0};
 private readonly material=new T.MeshLambertMaterial({vertexColors:true});
 private readonly panicMaterial=new T.MeshLambertMaterial({vertexColors:true});
 private batches:Batch[]=[];
 private snapshots:Pick<Extra,'x'|'z'|'crouch'>[]=[];
 private readonly matrix=new T.Matrix4();
 private readonly position=new T.Vector3();
 private readonly scale=new T.Vector3();
 private readonly rotation=new T.Quaternion();
 private readonly up=new T.Vector3(0,1,0);
 constructor(scene:T.Scene,models:Map<string,T.Object3D>,crowd:ClubCrowd){
  scene.add(this.root);
  this.material.onBeforeCompile=shader=>{
   shader.uniforms.crowdTime=this.time;
   shader.vertexShader='attribute vec4 crowdMotion;\nuniform float crowdTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    float sway=sin(crowdTime*crowdMotion.y+crowdMotion.x);
    float upper=smoothstep(0.15,1.45,position.y);
    float angle=sway*crowdMotion.z*upper;
    float turnSin=sin(angle), turnCos=cos(angle);
    transformed.xz=mat2(turnCos,turnSin,-turnSin,turnCos)*transformed.xz;
    transformed.x+=sway*upper*.025;
    transformed.y+=abs(sway)*crowdMotion.w;
   `);
  };
  const wardrobe:Record<string,string[]> = {
   bounce:['photographer','guest_dress'], twist:['wine_merchant','pool_guest_resort'],
   raise:['guest_dress','lawyer'], jump:['photographer','guest_dress','lawyer','pool_guest_resort'], glass:['guest_suit','lawyer','wine_merchant'],
   chat:['photographer','pool_guest_resort','guest_dress'], phone:['lawyer','guest_dress'],
   lean:['wine_merchant','guest_suit'], sit:['guest_dress','photographer'],
  };
  const groups=new Map<string,{pose:string;model:string;indices:number[]}>();
  const panicGroups=new Map<string,number[]>();
  crowd.people.forEach((n,i)=>{
   const pose=n.pose,variants=wardrobe[pose];
   const model=variants[Math.floor(n.phase/(2*Math.PI)*variants.length)%variants.length],key=pose+model;
   let g=groups.get(key);if(!g){g={pose,model,indices:[]};groups.set(key,g);}g.indices.push(i);
   const panicking=panicGroups.get(model)??[];
   panicking.push(i);panicGroups.set(model,panicking);
  });
  for(const g of groups.values()){
   const template=models.get(g.model);if(!template)throw new Error('Crowd model missing: '+g.model);
   const geom=bakedGeometry(template,g.pose);
   geom.setAttribute('crowdMotion',new T.InstancedBufferAttribute(new Float32Array(g.indices.length*4),4).setUsage(T.DynamicDrawUsage));
   const mesh=new T.InstancedMesh(geom,this.material,g.indices.length);
   mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   this.root.add(mesh);this.batches.push({mesh,indices:g.indices,panic:false});
  }
  for(const [model,indices] of panicGroups){
   const mesh=new T.InstancedMesh(bakedGeometry(models.get(model)!,'crouch'),this.panicMaterial,indices.length);
   mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   this.root.add(mesh);this.batches.push({mesh,indices,panic:true});
  }
  this.sync(crowd);
 }
 sync(crowd:ClubCrowd){
  for(const {mesh,indices,panic} of this.batches){
   if(!indices.some(i=>{
    const n=crowd.people[i],previous=this.snapshots[i];
    return !previous||n.crouch!==previous.crouch||n.crouch===panic&&(n.x!==previous.x||n.z!==previous.z);
   }))continue;
   let count=0;
   const motion=mesh.geometry.getAttribute('crowdMotion') as T.InstancedBufferAttribute|undefined;
   for(const i of indices){
    const n=crowd.people[i];
    if(n.crouch!==panic)continue;
    mesh.setMatrixAt(count,this.transform(n,i));
    if(motion){
     const dancing=['bounce','twist','raise','jump'].includes(n.pose),jumping=n.pose==='jump';
     // Jumpers leave the floor by up to 28 cm on the beat (two jumps a second); the others bob and sway as before.
     motion.setXYZW(count,n.phase,jumping?6.5:n.speed*(dancing?4.3:1.2),jumping?.05:n.pose==='twist'?.28:dancing?.12:.045,jumping?.28:n.pose==='bounce'?.065:dancing?.027:.006);
    }
    count++;
   }
   mesh.count=count;
   mesh.visible=count>0;
   if(count){
    mesh.instanceMatrix.needsUpdate=true;
    if(motion)motion.needsUpdate=true;
    mesh.computeBoundingSphere();mesh.boundingSphere!.radius+=.18;
   }
  }
  this.snapshots=crowd.people.map(({x,z,crouch})=>({x,z,crouch}));
  crowd.changed=false;
 }
 private transform(n:Extra,i:number){
  const seated=n.seat&&!n.crouch;
  this.position.set(n.x-(seated?.67:0),n.y+(seated?.31:0),n.z);
  const build=.95+((i*13)%17)*.006;
  this.scale.set(build,n.height,build);
  this.rotation.setFromAxisAngle(this.up,n.heading);
  return this.matrix.compose(this.position,this.rotation,this.scale);
 }
 step(time:number,crowd:ClubCrowd){this.time.value=time;if(crowd.changed)this.sync(crowd);}
}

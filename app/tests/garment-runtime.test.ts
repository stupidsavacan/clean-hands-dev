import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Rig} from '../src/rig.ts';
import {Locomotion,NEUTRAL} from '../src/locomotion.ts';
import {poseMotionPreview,type PreviewActor} from '../src/labs/motion-preview.ts';
import {CLIPS} from '../src/labs/motion-clips.ts';
import {GarmentRuntime,DRAPE_STYLES,rayCapsuleExit,segmentTriangleDistance} from '../src/garment-runtime.ts';

async function load(id:string){
 const bytes=readFileSync(new URL(`../../assets/characters/models/${id}/${id}.glb`,import.meta.url));
 const model=(await new GLTFLoader().register(()=>({name:'test-no-textures',loadTexture:async()=>null})).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const group=new T.Group();group.add(model);group.updateMatrixWorld(true);
 const actor:PreviewActor={def:{id},model,group,rig:new Rig(model),loco:new Locomotion(),sim:-1,weapons:{}};
 const pose=(clip:string,time:number)=>{actor.sim=-1;poseMotionPreview(actor,[actor],CLIPS.find(c=>c.id===clip)!,time,{role:'giver',gun:{id:'pistol',cls:'pistol'},variant:'standard'});group.updateMatrixWorld(true);};
 return {model,pose,actor};
}
const cloak=(model:T.Object3D)=>model.getObjectByName('Garment_Bisht') as T.SkinnedMesh;
const snapshot=(mesh:T.SkinnedMesh)=>Array.from(mesh.geometry.getAttribute('position').array as Float32Array);

test('ray leaves a capsule at its far side, and misses report no exit',()=>{
 const a=new T.Vector3(0,0,0),b=new T.Vector3(0,1,0);
 assert.ok(Math.abs(rayCapsuleExit(new T.Vector3(-1,.5,0),new T.Vector3(1,0,0),a,b,.2)-1.2)<1e-9);
 assert.ok(Math.abs(rayCapsuleExit(new T.Vector3(0,-1,0),new T.Vector3(0,1,0),a,b,.2)-2.2)<1e-9);
 assert.ok(Math.abs(rayCapsuleExit(new T.Vector3(-1,1.1,0),new T.Vector3(1,0,0),a,b,.2)-(1+Math.sqrt(.03)))<1e-9);
 assert.equal(rayCapsuleExit(new T.Vector3(-1,.5,.3),new T.Vector3(1,0,0),a,b,.2),-Infinity);
});
test('segment to triangle distance covers piercing, edges and corners',()=>{
 const p=new T.Vector3(0,0,0),q=new T.Vector3(1,0,0),r=new T.Vector3(0,1,0);
 assert.equal(segmentTriangleDistance(new T.Vector3(.2,.2,-1),new T.Vector3(.2,.2,1),p,q,r),0);
 assert.ok(Math.abs(segmentTriangleDistance(new T.Vector3(.2,.2,.5),new T.Vector3(.3,.3,.7),p,q,r)-.5)<1e-9);
 assert.ok(Math.abs(segmentTriangleDistance(new T.Vector3(2,0,0),new T.Vector3(3,0,0),p,q,r)-1)<1e-9);
});
test('the bind pose of a draped garment is left exactly as authored',async()=>{
 const {model}=await load('oil_magnate'),before=snapshot(cloak(model)),runtime=new GarmentRuntime(model);
 runtime.verify=true;runtime.update();
 assert.equal(runtime.diagnostics.garments,1);assert.equal(runtime.diagnostics.maxCorrection,0);assert.equal(runtime.diagnostics.remainingIntersections,0);
 assert.deepEqual(snapshot(cloak(model)),before);
});
test('limb capsules contain the leg vertices they were sized from',async()=>{
 const {model}=await load('oil_magnate'),runtime=new GarmentRuntime(model),outfit=model.getObjectByName('Outfit') as T.SkinnedMesh;
 const pos=outfit.geometry.getAttribute('position'),si=outfit.geometry.getAttribute('skinIndex'),sw=outfit.geometry.getAttribute('skinWeight'),line=new T.Line3(),near=new T.Vector3();
 const capsules=runtime.capsules().filter(c=>!c.outer);assert.equal(capsules.length,6);
 for(const capsule of capsules){let checked=0;for(let i=0;i<pos.count;i++){let weight=0;for(let k=0;k<4;k++)if(outfit.skeleton.bones[si.getComponent(i,k)].name===capsule.name)weight+=sw.getComponent(i,k);if(weight<.4)continue;
  const point=new T.Vector3().fromBufferAttribute(pos,i);line.set(capsule.a,capsule.b).closestPointToPoint(point,true,near);assert.ok(near.distanceTo(point)<=capsule.r+1e-6,capsule.name);checked++;}
  assert.ok(checked>3,capsule.name);}
});
test('walking and crouching leave nothing inside the leg capsules, and stay finite',async()=>{
 const {model,pose}=await load('oil_magnate'),runtime=new GarmentRuntime(model);runtime.verify=true;runtime.style='dynamic';
 for(const [clip,time] of [['loco-walk',.4],['loco-walk',.8],['loco-idle',1.2],['gesture-dance',.8]] as const){pose(clip,time);runtime.update();
  assert.equal(runtime.diagnostics.remainingIntersections,0,`${clip} ${time}`);assert.equal(runtime.diagnostics.capped,0,`${clip} ${time}`);
  assert.ok(runtime.diagnostics.maxCorrection>.02&&runtime.diagnostics.maxCorrection<.4,`${clip} ${time}`);
  assert.ok(snapshot(cloak(model)).every(Number.isFinite));}
});
test('dynamic style: the same pose gives the same cloth whatever came before it',async()=>{
 const {model,pose}=await load('oil_magnate'),runtime=new GarmentRuntime(model);runtime.style='dynamic';
 pose('loco-walk',.4);runtime.update();const first=snapshot(cloak(model));
 pose('loco-crouch',.8);runtime.update();assert.notDeepEqual(snapshot(cloak(model)),first);
 pose('loco-walk',.4);runtime.update();assert.deepEqual(snapshot(cloak(model)),first);
});
test('turning the runtime off or disposing it shows the authored garment again',async()=>{
 const {model,pose}=await load('oil_magnate'),original=cloak(model).geometry,before=snapshot(cloak(model)),runtime=new GarmentRuntime(model);
 assert.notEqual(cloak(model).geometry,original);
 pose('loco-walk',.4);runtime.update();assert.notDeepEqual(snapshot(cloak(model)),before);
 runtime.enabled=false;runtime.update();assert.deepEqual(snapshot(cloak(model)),before);
 runtime.dispose();assert.equal(cloak(model).geometry,original);assert.deepEqual(snapshot(cloak(model)),before);
});
test('a character without a draped garment is not touched',async()=>{
 const {model,pose}=await load('ferry_captain'),meshes:T.SkinnedMesh[]=[];model.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)meshes.push(o as T.SkinnedMesh);});
 const geometries=meshes.map(m=>m.geometry),runtime=new GarmentRuntime(model);pose('loco-walk',.4);runtime.update();
 assert.equal(runtime.diagnostics.garments,0);assert.deepEqual(meshes.map(m=>m.geometry),geometries);
});
test('calm style is the default, clears the legs through a played walk, and moves less than dynamic',async()=>{
 const {model,pose,actor}=await load('oil_magnate'),runtime=new GarmentRuntime(model);assert.equal(runtime.style,'calm');runtime.verify=true;
 const activity:Record<string,number>={};
 for(const style of ['dynamic','calm'] as const){runtime.style=style;runtime.reset();actor.loco.style={...NEUTRAL,...runtime.gait!};let before:number[]|undefined,total=0;
  for(let frame=0;frame<=180;frame++){pose('loco-walk',frame/60);runtime.update(1/60);assert.equal(runtime.diagnostics.remainingIntersections,0,`${style} frame ${frame}`);
   const now=snapshot(cloak(model));if(before&&frame>90)for(let i=0;i<now.length;i++)total+=Math.abs(now[i]-before[i]);before=now;}
  activity[style]=total;}
 assert.ok(activity.calm<activity.dynamic*.75,JSON.stringify(activity));
 assert.deepEqual(runtime.gait,DRAPE_STYLES.calm.gait);assert.ok(runtime.gait!.stride<1);
});
test('calm style: a held pose settles onto the dynamic shape, and reset forgets the past',async()=>{
 const {model,pose}=await load('oil_magnate'),runtime=new GarmentRuntime(model);
 for(let frame=0;frame<=60;frame++){pose('loco-walk',frame/60);runtime.update(1/60);}
 pose('loco-idle',0);runtime.update(1/60);const carried=snapshot(cloak(model));
 for(let i=0;i<600;i++)runtime.update(1/60);const settled=snapshot(cloak(model));
 runtime.reset();runtime.update(1/60);const fresh=snapshot(cloak(model));
 assert.notDeepEqual(carried,settled);
 assert.ok(settled.every((v,i)=>Math.abs(v-fresh[i])<2e-3));
});

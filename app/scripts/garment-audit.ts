/**
 * Garment audit: counts real triangle crossings between each drape garment and the meshes under it,
 * with the drape runtime off (plain skinning) and on. Independent of the runtime's own capsules.
 * Run from app/:  node --experimental-strip-types scripts/garment-audit.ts [character id]
 */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {Rig} from '../src/rig.ts';
import {Locomotion,NEUTRAL} from '../src/locomotion.ts';
import {poseMotionPreview,type PreviewActor} from '../src/labs/motion-preview.ts';
import {CLIPS} from '../src/labs/motion-clips.ts';
import {GarmentRuntime} from '../src/garment-runtime.ts';

type Tri={p:T.Vector3[];box:T.Box3;limb:string;bone:string};
const LEG=/^(thigh|shin|foot)/i;
function triangles(mesh:T.SkinnedMesh):Tri[]{
 mesh.skeleton.update();const g=mesh.geometry,pos=g.getAttribute('position'),si=g.getAttribute('skinIndex'),sw=g.getAttribute('skinWeight');
 const points=Array.from({length:pos.count},(_,i)=>mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(pos,i)).applyMatrix4(mesh.matrixWorld));
 const count=g.index?.count??pos.count,result:Tri[]=[];
 for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>g.index?.getX(i+j)??i+j),weight=new Map<number,number>();
  for(const v of ids)for(let k=0;k<4;k++)weight.set(si.getComponent(v,k),(weight.get(si.getComponent(v,k))??0)+sw.getComponent(v,k));
  const bone=mesh.skeleton.bones[[...weight].sort((a,b)=>b[1]-a[1])[0][0]].name,p=ids.map(v=>points[v]);
  result.push({p,box:new T.Box3().setFromPoints(p),limb:LEG.test(bone)?'legs':'other',bone});}
 return result;
}
const direction=new T.Vector3(),hit=new T.Vector3(),bary=new T.Vector3(),ray=new T.Ray(),triangle=new T.Triangle();
/** True when an edge of one triangle passes through the inside of the other. Touching edges do not count. */
function crosses(a:Tri,b:Tri){
 if(!a.box.intersectsBox(b.box))return false;
 for(const [x,y] of [[a,b],[b,a]])for(let i=0;i<3;i++){
  direction.subVectors(x.p[(i+1)%3],x.p[i]);const length=direction.length();if(length<1e-8)continue;
  ray.set(x.p[i],direction.multiplyScalar(1/length));
  if(!ray.intersectTriangle(y.p[0],y.p[1],y.p[2],false,hit))continue;
  const distance=hit.distanceTo(x.p[i]);if(distance<.0001||distance>length-.0001)continue;
  triangle.set(y.p[0],y.p[1],y.p[2]).getBarycoord(hit,bary);
  if(Math.min(bary.x,bary.y,bary.z)>1e-5)return true;
 }
 return false;
}
const id=process.argv[2]??'oil_magnate',bytes=readFileSync(new URL(`../../assets/characters/models/${id}/${id}.glb`,import.meta.url));
const loader=new GLTFLoader().register(()=>({name:'audit-no-textures',loadTexture:async()=>null}));
const model=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const group=new T.Group();group.add(model);group.updateMatrixWorld(true);
const meshes:T.SkinnedMesh[]=[];model.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)meshes.push(o as T.SkinnedMesh);});
const cloth=meshes.filter(m=>m.userData.garment?.version===2);
const runtime=new GarmentRuntime(model);runtime.verify=true;runtime.style='dynamic'; // the pose table is the stateless style
const actor:PreviewActor={def:{id},model,group,rig:new Rig(model),loco:new Locomotion(),sim:-1,weapons:{}};
function count(){const result={legs:0,other:0,bones:{} as Record<string,number>};
 for(const garment of cloth){const a=triangles(garment);for(const body of meshes.filter(m=>garment.userData.garment.colliders.includes(m.name)))for(const y of triangles(body))for(const x of a)if(crosses(x,y)){result[y.limb as 'legs'|'other']++;result.bones[y.bone]=(result.bones[y.bone]??0)+1;}}
 return result;}
function measure(){group.updateMatrixWorld(true);
 runtime.enabled=false;runtime.update();const off=count();
 runtime.enabled=true;runtime.update();const on=count(),d={...runtime.diagnostics};
 runtime.verify=false;let total=0;const runs=200;for(let i=0;i<runs;i++){runtime.update();total+=runtime.diagnostics.milliseconds;}
 runtime.verify=true;return {off,on,maxCorrection:+d.maxCorrection.toFixed(4),maxEdgeRatio:+d.maxEdgeRatio.toFixed(3),remaining:d.remainingIntersections,capped:d.capped,milliseconds:+(total/runs).toFixed(3)};}
const rows:Record<string,unknown>[]=[{pose:'bind',time:0,...measure()}];
for(const clip of ['loco-idle','loco-walk','loco-crouch','gesture-dance','gesture-work'])for(const time of [0,.4,.8,1.2,2]){
 actor.sim=-1;poseMotionPreview(actor,[actor],CLIPS.find(c=>c.id===clip)!,time,{role:'giver',gun:{id:'pistol',cls:'pistol'},variant:'standard'});
 rows.push({pose:clip,time,...measure()});}
// Motion: play each clip at 60 fps for 4 seconds in both styles. `activity` is how far a cloth point moves per
// frame on average beyond what plain skinning would move it (m): the smaller, the calmer. `maxStepCloth` against
// `maxStepLimbs` shows popping. Leg crossings are counted on every 5th frame of the last 2 seconds.
function positions(list:T.SkinnedMesh[]){const out:T.Vector3[]=[];for(const m of list){const pos=m.geometry.getAttribute('position');m.skeleton.update();for(let i=0;i<pos.count;i++)out.push(m.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(pos,i)));}return out;}
const bodies=meshes.filter(m=>cloth.some(g=>g.userData.garment.colliders.includes(m.name))),smooth:Record<string,unknown>[]=[];runtime.enabled=true;
for(const style of ['dynamic','calm'] as const)for(const clip of ['loco-walk','loco-crouch','gesture-dance']){
 // Each style brings its own walk (calm: shorter, lower steps). Plain skinning first, for the same frames.
 runtime.style=style;actor.loco.style={...NEUTRAL,...runtime.gait!};
 const plain:T.Vector3[][]=[];runtime.enabled=false;for(let frame=0;frame<=240;frame++){actor.sim=-1;poseMotionPreview(actor,[actor],CLIPS.find(c=>c.id===clip)!,frame/60,{role:'giver',gun:{id:'pistol',cls:'pistol'},variant:'standard'});group.updateMatrixWorld(true);runtime.update(1/60);plain.push(positions(cloth));}
 runtime.enabled=true;runtime.style=style;runtime.reset();runtime.verify=true;
 let draped=0,limbs=0,activity=0,samples=0,legs=0,remaining=0,widest=0,before:T.Vector3[][]|undefined;
 for(let frame=0;frame<=240;frame++){actor.sim=-1;poseMotionPreview(actor,[actor],CLIPS.find(c=>c.id===clip)!,frame/60,{role:'giver',gun:{id:'pistol',cls:'pistol'},variant:'standard'});group.updateMatrixWorld(true);
  runtime.update(1/60);const a=positions(bodies),b=positions(cloth);widest=Math.max(widest,runtime.diagnostics.maxCorrection);
  if(frame>=120){remaining+=runtime.diagnostics.remainingIntersections;if(frame%5===0)legs+=count().legs;}
  if(before){for(let i=0;i<a.length;i++)limbs=Math.max(limbs,a[i].distanceTo(before[0][i]));
   for(let i=0;i<b.length;i++){const step=b[i].distanceTo(before[1][i]);draped=Math.max(draped,step);if(frame>120){activity+=b[i].clone().sub(plain[frame][i]).distanceTo(before[1][i].clone().sub(plain[frame-1][i]));samples++;}}}
  before=[a,b];}
 smooth.push({style,pose:clip,legCrossings:legs,remaining,maxCorrection:+widest.toFixed(3),maxStepLimbs:+limbs.toFixed(4),maxStepCloth:+draped.toFixed(4),activity:+(activity/samples).toFixed(5)});}
runtime.style='dynamic';actor.loco.style=NEUTRAL;
for(const r of [...rows,...smooth])console.log(JSON.stringify(r));
console.log(JSON.stringify({capsules:runtime.capsules().map(c=>({bone:c.name,outer:c.outer,r:+c.r.toFixed(3),a:c.a.toArray().map(x=>+x.toFixed(3)),b:c.b.toArray().map(x=>+x.toFixed(3))}))}));
writeFileSync(new URL(`../../investigation/garment-system-review/garment-audit-${id}.json`,import.meta.url),JSON.stringify({poses:rows,motion:smooth},null,2));
runtime.dispose();

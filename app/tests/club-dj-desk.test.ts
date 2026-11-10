import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {gesturePose,applyGesture} from '../src/gestures.ts';
import {Locomotion} from '../src/locomotion.ts';
import {Rig} from '../src/rig.ts';
import {NPC_MODELS} from '../src/npc-data.ts';
import {PROP_MODELS} from '../src/prop-data.ts';
import map from '../src/data/club-map.json' with {type:'json'};

test('the club DJ desk fits its envelope and meets both work palms',async()=>{
 const loader=new GLTFLoader();
 loader.register(()=>({name:'TestTexture',loadTexture:async()=>new T.Texture()}));
 const model=async(data:string)=>(await loader.parseAsync(Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer,'')).scene;
 const desk=await model(PROP_MODELS.dj_desk);
 const block=map.blockers.find(b=>b.id==='desk-dj')!;
 desk.position.set(block.x,block.y,block.z);
 desk.updateMatrixWorld(true);
 let triangles=0;
 desk.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  const positions=o.geometry.getAttribute('position');
  triangles+=(o.geometry.index?.count??positions.count)/3;
  const p=new T.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);
   const height=p.y-block.y;
   const back=height>.7?32.35:32.1+.02;
   assert.ok(p.x>=21.5-.02&&p.x<=26.5+.02&&p.z>=31.1-.02&&p.z<=back);
   assert.ok(height>=-.02&&height<=1+.02);
  }
 });
 assert.ok(triangles>0&&triangles<=3000);

 const place=map.schedulePlaces.dj_0,actor=new T.Group();
 actor.position.set(place.x,place.y-.025,place.z);
 actor.rotation.y=place.heading;
 const dj=await model(NPC_MODELS.photographer);
 actor.add(dj);
 const rig=new Rig(dj),loco=new Locomotion();
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
 let close=0,minGap=Infinity,maxGap=-Infinity;
 const frames=600; // work() uses a 10-second cycle.
 for(let i=0;i<frames;i++){
  const pose=loco.update(1/60,{speed:0,crouch:0,slope:0,turn:0,distance:0,actual:0});
  const gesture=gesturePose(pose,'work',i/60);
  rig.apply(pose);
  applyGesture(rig,actor,gesture);
  const gaps=['l','r'].map(side=>{
   // Same local grip point as the game uses for fist-held objects (detection-view.ts).
   const palm=rig.joints.get('hand'+side)!.bone.localToWorld(new T.Vector3(0,.075,-.025));
   ray.set(new T.Vector3(palm.x,block.y+2,palm.z),down);
   const top=ray.intersectObject(desk,true)[0];
   assert.ok(top,'a work palm is over the desk');
   return palm.y-top.point.y;
  });
  minGap=Math.min(minGap,...gaps);
  maxGap=Math.max(maxGap,...gaps);
  if(gaps.every(gap=>gap>=0&&gap<=.04))close++;
 }
 console.log('DJ desk: %s triangles, %s/%s frames, palm gap %s to %s m',triangles,close,frames,minGap,maxGap);
 assert.ok(minGap>=-.01,'no palm penetrates the surface more than 1 cm');
 assert.ok(close/frames>=.7,'both palms are within 0–4 cm above the surface for at least 70% of the cycle');
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ClubShow} from '../src/club/show.ts';
import map from '../src/data/club-map.json' with {type:'json'};
import {PROP_MODELS} from '../src/prop-data.ts';

test('the six club fixtures hang under the catwalk and follow their beams for 60 seconds',async()=>{
 const loader=new GLTFLoader();
 // The embedded GLB supplies the geometry and transforms. Node doesn't decode browser textures.
 loader.register(()=>({name:'TestTexture',loadTexture:async()=>new T.Texture()}));
 const bytes=Uint8Array.from(atob(PROP_MODELS.moving_head),c=>c.charCodeAt(0));
 const fixture=(await loader.parseAsync(bytes.buffer,'')).scene;
 const scene=new T.Scene(),hemi=new T.HemisphereLight();
 const show=new ClubShow(scene,hemi,fixture);
 const cones=show.root.children.filter(o=>o.name==='moving-head-cone') as T.Mesh[];
 const rigs=show.root.children.flatMap(o=>{
  const hang=o.getObjectByName('HANG'),lens=o.getObjectByName('BEAM'),head=o.getObjectByName('head');
  return hang&&lens&&head?[{model:o,hang,lens,head}]:[];
 });
 assert.equal(cones.length,6);
 assert.equal(rigs.length,6);

 const floor=map.floors.find(f=>f.areas.some(a=>'label' in a&&a.label==='キャットウォーク'))!;
 const area=floor.areas.find(a=>'label' in a&&a.label==='キャットウォーク')!;
 const vector=()=>new T.Vector3();
 let maxMountGap=0;
 for(const {model,hang,lens,head} of rigs){
  const p=hang.getWorldPosition(vector());
  assert.ok(p.x>=area.minX&&p.x<=area.maxX&&p.z>=area.minZ&&p.z<=area.maxZ);
  // The engine renders the catwalk plate 0.50 m thick below the map's floor height.
  const underside=floor.y-.5;
  const mountGap=Math.abs(p.y-underside);
  assert.ok(mountGap<=.02,'mount touches the catwalk underside');
  assert.ok(Math.abs(new T.Box3().setFromObject(model).max.y-underside)<=.02,'clamp reaches the underside');
  maxMountGap=Math.max(maxMountGap,mountGap);
  const neutral=lens.getWorldPosition(vector()).sub(head.getWorldPosition(vector())).normalize();
  assert.ok(neutral.distanceTo(new T.Vector3(0,-1,0))<1e-8,'lens faces straight down at rest');
 }

 const geometry=cones[0].geometry;
 geometry.computeBoundingBox();
 const box=geometry.boundingBox!;
 const base=box.getCenter(vector()).setY(box.min.y);
 const positions=geometry.getAttribute('position');
 const tip=new T.Vector3(0,-Infinity,0);
 for(let i=0;i<positions.count;i++){
  if(positions.getY(i)>tip.y)tip.fromBufferAttribute(positions,i);
 }
 let maxAngle=0,maxGap=0;
 for(let sample=0;sample<=600;sample++){
  const t=sample/10;
  show.step(t,false);
  for(const [i,cone] of cones.entries()){
   const {lens,head}=rigs[i];
   const lensPoint=lens.getWorldPosition(vector());
   const apex=cone.localToWorld(tip.clone());
   const ray=cone.localToWorld(base.clone()).sub(apex);
   const forward=lensPoint.clone().sub(head.getWorldPosition(vector()));
   const angle=T.MathUtils.radToDeg(ray.angleTo(forward)),gap=apex.distanceTo(lensPoint);
   assert.ok(angle<=3,'fixture '+(i+1)+' at '+t+' s: '+angle+'°');
   assert.ok(gap<=.01,'fixture '+(i+1)+' at '+t+' s: '+gap+' m');
   maxAngle=Math.max(maxAngle,angle);maxGap=Math.max(maxGap,gap);
  }
 }
 console.log('moving heads: maximum direction error %s°, apex gap %s m, mount gap %s m',maxAngle,maxGap,maxMountGap);
 show.step(60,true);
 assert.equal(show.root.visible,false);
 show.step(60,false);
 assert.equal(show.root.visible,true);
});

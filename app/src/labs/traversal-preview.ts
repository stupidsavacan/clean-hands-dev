import {traversalContacts} from '../traversal-pose.ts';
import * as T from 'three';
import {ladderGeometry,sampleTraversal,traversalPoints,traversalSill,type TraversalPhase} from '../party/traversal.ts';
import {clipTraversalProgress,type Clip} from './motion-clips.ts';
import type {PreviewActor} from './motion-preview.ts';

const labels:Record<TraversalPhase,string>={
 mount:'取り付く（下）',climb:'登る','exit-top':'上で降りる','mount-top':'取り付く（上）',descend:'降りる','exit-bottom':'下で離れる',
 enter:'進入',ledge:'縁を渡る',vault:'窓を越える','exit-window':'窓から降りる',walk:'移動',
};
const point=({x,y,z}:{x:number;y:number;z:number})=>new T.Vector3(x,y,z);

export function traversalPreview(scene:T.Scene,panel:HTMLElement,seek:(seconds:number)=>void){
 const root=new T.Group(),fixture=new T.Group();
 root.add(fixture);scene.add(root);
 const phase=document.createElement('p'),buttons=document.createElement('div'),readout=document.createElement('p');
 buttons.className='row';panel.append(phase,buttons,readout);
 const material=new T.LineBasicMaterial({color:0xf1c387}),debugMaterial=new T.LineBasicMaterial({color:0x63e5cb});
 const debug=new T.LineSegments(new T.BufferGeometry(),debugMaterial);
 const markerGeometry=new T.SphereGeometry(.035,8,6),markerMaterial=new T.MeshBasicMaterial({color:0x63e5cb});
 const markers=Array.from({length:4},()=>new T.Mesh(markerGeometry,markerMaterial));
 scene.add(debug,...markers);
 const positions=new T.BufferAttribute(new Float32Array(24),3);
 debug.geometry.setAttribute('position',positions);debug.frustumCulled=false;
 let active:Clip['traversal'];
 function select(clip:Clip){
  active=clip.traversal;panel.hidden=!active;
  for(const child of [...fixture.children]){(child as T.Line).geometry.dispose();fixture.remove(child);}
  buttons.replaceChildren();
  if(!active)return;
  const {link,reverse}=active,points=traversalPoints(link);
  const add=(vertices:T.Vector3[])=>fixture.add(new T.Line(new T.BufferGeometry().setFromPoints(vertices),material));
  add(points.map(point));
  for(const [i,b] of points.slice(1).entries()){
   const a=points[i];
   if(link.kind==='window'||Math.abs(a.y-b.y)>.01)continue;
   const across=new T.Vector3(b.z-a.z,0,a.x-b.x).normalize().multiplyScalar(.4);
   const edges=[point(a).add(across),point(b).add(across),point(b).sub(across),point(a).sub(across)];
   add([...edges,edges[0]]);
  }
  const ladder=ladderGeometry(link);
  for(const [a,b] of [...ladder?.rails??[],...ladder?.rungs??[]])add([point(a),point(b)]);
  if(link.kind==='window'){
   const sill=point(traversalSill(link));
   const delta=point(link.end).sub(point(link.start)).setY(0).normalize();
   const width=new T.Vector3(delta.z,0,-delta.x).multiplyScalar(.5);
   add([sill.clone().sub(width),sill.clone().add(width)]);
  }
  const seen=new Set<TraversalPhase>();
  for(let frame=0;frame<=Math.ceil(clip.seconds*30);frame++){
   const t=Math.min(clip.seconds,frame/30),{phase}=sampleTraversal(link,reverse,clipTraversalProgress(clip,t));
   if(seen.has(phase))continue;
   seen.add(phase);
   const button=document.createElement('button');button.type='button';button.textContent=labels[phase];button.onclick=()=>seek(t);
   buttons.append(button);
  }
 }
 function update(clip:Clip,t:number,actor?:PreviewActor){
  if(active!==clip.traversal)select(clip);
  root.visible=!!active;debug.visible=false;for(const m of markers)m.visible=false;
  if(!active)return;
  const frame=sampleTraversal(active.link,active.reverse,clipTraversalProgress(clip,t)),p=frame.position;
  const offset=actor?.group.position.x??0;
  root.position.set(offset-p.x,-p.y,-p.z);
  phase.textContent=labels[frame.phase]+' · 手 '+Math.round(frame.hands*100)+'% · 足 '+Math.round(frame.feet*100)+'%';
  const lines:string[]=[];
  const contacts=actor?traversalContacts(actor.rig,frame,p=>p.add(root.position)):[];
  for(const [index,{kind,side,target,actual,error}] of contacts.entries()){
   const marker=markers[index];marker.position.copy(target);marker.visible=true;
   positions.setXYZ(index*2,target.x,target.y,target.z);positions.setXYZ(index*2+1,actual.x,actual.y,actual.z);
   lines.push((side==='l'?'左':'右')+(kind==='hand'?'手':'足')+' '+(error*100).toFixed(1)+' cm');
  }
  positions.needsUpdate=true;debug.geometry.setDrawRange(0,contacts.length*2);debug.visible=contacts.length>0;
  readout.textContent=lines.length?'目標までの距離 · '+lines.join(' / '):'接触なし';
 }
 return {update};
}

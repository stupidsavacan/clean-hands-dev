import test from 'node:test';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {PLAYER_BASE64} from '../src/player-data.ts';
import {Rig} from '../src/rig.ts';
import {neutral} from '../src/motion-runtime.ts';
import {applyTraversalPose} from '../src/traversal-pose.ts';
import assert from 'node:assert/strict';
import club from '../src/data/club-map.json' with {type:'json'};
import layout from '../src/data/club-layout.json' with {type:'json'};
import party from '../src/data/party.json' with {type:'json'};
import {ladderGeometry,ladderOf,sampleTraversal,traversalParts,traversalPoints,traversalSeconds,RUNG,type Traversal} from '../src/party/traversal.ts';
import {LADDER,LADDER_MOVES,ladderClimb,sampleLadderMove} from '../src/ladder-motion.ts';
import {CLIPS,SAMPLE_LADDER} from '../src/labs/motion-clips.ts';
import {assertMapLayout,compileMapGeometry} from '../src/map-layout.ts';

const ladders=[...club.traversals,...party.traversals].filter(link=>ladderOf(link as Traversal)) as Traversal[];

test('every ladder and drainpipe in every map plays the same generic ladder motion',()=>{
 assert.deepEqual(ladders.map(l=>l.id),['X1','X2','X3','X4']);
 // The same height above each ladder's foot gives the same hands and feet relative to that foot, on every map.
 const relative=(link:Traversal,y:number)=>{
  const ladder=ladderOf(link)!,parts=traversalParts(link,false)!,climb=parts.find(p=>p.kind==='climb'||p.kind==='descend')!;
  const up=climb.kind==='climb',progress=(climb.start+climb.seconds*(up?y/ladder.height:1-y/ladder.height))/traversalSeconds(link);
  const frame=sampleTraversal(link,false,progress);
  return [frame.hand!(1),frame.hand!(-1),frame.foot!(1),frame.foot!(-1)].map(p=>[p.x-ladder.foot.x,p.y-ladder.foot.y,p.z-ladder.foot.z].map(v=>+v.toFixed(6)));
 };
 for(const y of [.4,1.1,1.75,2.3])for(const link of ladders)assert.deepEqual(relative(link,y),relative(SAMPLE_LADDER,y),link.id+' at '+y);
 // Resting hands and feet stand on rungs (the ankle .07 above the rung).
 for(let y=0;y<=3.5;y+=.05){
  const pose=ladderClimb(y,3.5);
  for(const side of [1,-1] as const){
   const hand=pose.hand(side),foot=pose.foot(side);
   if(hand.z===LADDER.standoff)assert.ok(Math.abs(hand.y/RUNG-Math.round(hand.y/RUNG))<1e-6,'hand off a rung at '+y);
   if(foot.z===LADDER.standoff-.1)assert.ok(Math.abs((foot.y-.07)/RUNG-Math.round((foot.y-.07)/RUNG))<1e-6,'foot off a rung at '+y);
   assert.ok(hand.y-y>1.15&&hand.y-y<2.05,'hand within reach at '+y);
  }
 }
 // The lab shows only the generic moves on a sample ladder, never one map's ladder.
 const clips=CLIPS.filter(c=>c.group==='はしご');
 assert.deepEqual(clips.map(c=>c.id),['ladder-mount','ladder-climb','ladder-exit-top','ladder-mount-top','ladder-descend','ladder-exit-bottom','ladder-up','ladder-down']);
 assert.ok(clips.every(c=>c.traversal?.link===SAMPLE_LADDER));
 assert.ok(!CLIPS.some(c=>c.traversal&&c.traversal.link!==SAMPLE_LADDER&&ladderOf(c.traversal.link)));
 for(const move of LADDER_MOVES)assert.ok(sampleLadderMove(move,.5).hands>=0);
});

test('a ladder traversal runs without jumps or snaps and ends turned the way it goes on',()=>{
 for(const link of [...ladders,SAMPLE_LADDER])for(const reverse of [false,true]){
  const seconds=traversalSeconds(link),count=Math.ceil(seconds*120);
  let last=sampleTraversal(link,reverse,0);
  assert.deepEqual(last.position,reverse?link.end:link.start);
  assert.equal(last.weight+last.hands+last.feet,0);
  for(let i=1;i<=count;i++){
   const frame=sampleTraversal(link,reverse,i/count),id=link.id+(reverse?' reverse':'')+' at '+(i/120).toFixed(2);
   const moved=Math.hypot(frame.position.x-last.position.x,frame.position.y-last.position.y,frame.position.z-last.position.z);
   assert.ok(moved<.04,id+' jumped '+moved);
   assert.ok(Math.abs(Math.atan2(Math.sin(frame.heading-last.heading),Math.cos(frame.heading-last.heading)))<.08,id+' snapped round');
   for(const key of ['weight','hands','feet'] as const)assert.ok(Math.abs(frame[key]-last[key])<.06,id+' '+key);
   if(frame.hands>0&&last.hands>0)for(const side of [1,-1] as const){
    const a=frame.hand!(side),b=last.hand!(side);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.06,id+' hand jumped');
   }
   if(frame.feet>0&&last.feet>0)for(const side of [1,-1] as const){
    const a=frame.foot!(side),b=last.foot!(side);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.06,id+' foot jumped');
   }
   last=frame;
  }
  assert.deepEqual(last.position,reverse?link.start:link.end);
  assert.equal(last.weight+last.hands+last.feet,0);
  // Off the ladder the climber faces the way the path goes on (no turn left for the game to snap).
  const points=traversalPoints(link),path=reverse?[...points].reverse():points,a=path.at(-2)!,b=path.at(-1)!;
  if(Math.hypot(b.x-a.x,b.z-a.z)>.5)assert.ok(Math.abs(Math.atan2(Math.sin(last.heading-Math.atan2(b.x-a.x,b.z-a.z)),Math.cos(last.heading-Math.atan2(b.x-a.x,b.z-a.z))))<1e-6,link.id);
 }
 // The length follows from the height: a higher ladder takes longer, whatever its data says.
 const tall={...SAMPLE_LADDER,via:[{x:0,y:7,z:0}],end:{x:0,y:7,z:-1.4}};
 assert.ok(Math.abs(traversalSeconds(tall)-traversalSeconds(SAMPLE_LADDER)-3.5/LADDER.climbSpeed)<1e-9);
 // A ladder facing +x has its rungs to the +x side of the climber.
 const turned={...SAMPLE_LADDER,facing:Math.PI/2},geometry=ladderGeometry(turned)!;
 assert.ok(geometry.rungs.every(([a,b])=>Math.abs((a.x+b.x)/2-LADDER.standoff)<1e-9&&Math.abs(a.z+b.z)<1e-9));
});

test('windows and ledges stay finite in every frame in both directions',()=>{
 for(const link of party.traversals.filter(l=>!ladderOf(l as Traversal)) as Traversal[]){
  for(const reverse of [false,true]){
   const count=Math.ceil(traversalSeconds(link)*30);
   for(let i=0;i<=count;i++){
    const frame=sampleTraversal(link,reverse,i/count);
    const points=[frame.position,frame.hand?.(1),frame.hand?.(-1),frame.foot?.(1),frame.foot?.(-1)];
    assert.ok(points.every(p=>!p||[p.x,p.y,p.z].every(Number.isFinite)),link.id);
    assert.ok(frame.weight>=0&&frame.weight<=1);
   }
   assert.deepEqual(sampleTraversal(link,reverse,0).position,reverse?link.end:link.start);
   assert.deepEqual(sampleTraversal(link,reverse,1).position,reverse?link.start:link.end);
  }
 }
});

test('the editor and club builder compile the same geometry without any club identifiers',()=>{
 assertMapLayout(layout);
 const geometry=compileMapGeometry(layout);
 for(const key of ['floors','walls','blockers','zones','collisionOnlyIds','traversalShafts'] as const)
  assert.deepEqual(geometry[key],club[key]);
 const small={...layout,geometry:{floors:[{floor:5,y:2}],shafts:[{floor:5,minX:1,maxX:2,minZ:1,maxZ:2}]},
  rooms:[{id:'upper',label:'Upper',floor:5,minX:0,maxX:3,minZ:0,maxZ:3}],walls:[],furniture:[],stairs:[],platforms:[]};
 assert.deepEqual(compileMapGeometry(small).floors.map(f=>[f.floor,f.y,f.areas.length]),[[5,2,4]]);
 assert.throws(()=>assertMapLayout({...small,ground:{minX:2,maxX:1,minZ:0,maxZ:1}}));
});

test('on the ladder the knees bend forward toward the rungs and the elbows stay near 100 degrees',async()=>{
 const scene=(await new GLTFLoader().register(()=>({name:'pose-only-no-textures',loadTexture:()=>Promise.resolve(null)})).parseAsync(Uint8Array.from(atob(PLAYER_BASE64),c=>c.charCodeAt(0)).buffer,'')).scene;
 const avatar=new T.Group(),lean=new T.Group();avatar.add(lean);lean.add(scene);const rig=new Rig(scene);
 const at=(n:string)=>rig.joints.get(n)!.bone.getWorldPosition(new T.Vector3());
 const angle=(a:string,b:string,c:string)=>at(a).sub(at(b)).angleTo(at(c).sub(at(b)))*180/Math.PI;
 const total=traversalSeconds(SAMPLE_LADDER);
 for(const part of traversalParts(SAMPLE_LADDER,false)!)for(let i=0;i<=24;i++){
  const f=sampleTraversal(SAMPLE_LADDER,false,(part.start+part.seconds*i/24)/total),id=part.kind+' '+(i/24).toFixed(2);
  neutral(rig);lean.rotation.x=0;avatar.position.set(f.position.x,f.position.y,f.position.z);avatar.updateMatrixWorld(true);
  applyTraversalPose(rig,avatar,lean,f);
  for(const s of ['l','r']){
   const hip=avatar.worldToLocal(at('thigh'+s)),knee=avatar.worldToLocal(at('shin'+s)),foot=avatar.worldToLocal(at('foot'+s));
   if(angle('thigh'+s,'shin'+s,'foot'+s)<170)assert.ok(knee.z>(hip.z+foot.z)/2,id+' knee '+s+' folds backward');
   if(part.kind==='climb')assert.ok(Math.abs(angle('upperarm'+s,'forearm'+s,'hand'+s)-95)<=22,id+' elbow '+s+' '+angle('upperarm'+s,'forearm'+s,'hand'+s).toFixed(0));
  }
 }
});

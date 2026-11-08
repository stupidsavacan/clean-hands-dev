import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import hotel from '../src/data/hotel.json' with {type:'json'};
import rules from '../src/data/rules.json' with {type:'json'};
import {Npc,type Rules} from '../src/ai.ts';
import {COIN_GRASP,COIN_PICKUP_SECONDS,COIN_STOW,LandedCoinPickups} from '../src/coin-pickup.ts';
import {coinMesh,placePickupCoin,poseCoinPickup} from '../src/coin-pickup-pose.ts';
import {NPC_MODELS} from '../src/npc-data.ts';
import {Rig} from '../src/rig.ts';

const at={x:0,y:.01,z:.55};
function scenario(){
 const npc=new Npc(hotel.npcs[0],hotel);
 npc.pos={x:0,y:0,z:0};
 npc.hear(at,rules as Rules);
 const coin=coinMesh(),scene=new T.Scene(),pickups=new LandedCoinPickups();
 coin.position.copy(at);
 scene.add(coin);
 pickups.watch(coin,npc);
 return {npc,coin,scene,pickups,step:(fraction:number)=>pickups.step(COIN_PICKUP_SECONDS*fraction,[])};
}

test('B02 waits for the assigned responder, then lifts the coin before putting it away',()=>{
 const {npc,coin,scene,pickups,step}=scenario();
 step(.1);
 assert.equal(npc.coinPickup,null);
 npc.arrived=true;
 step(COIN_GRASP-.01);
 assert.equal(coin.parent,scene);
 assert.equal(pickups.held.length,0);
 step(.02);
 assert.equal(pickups.held[0]?.mesh,coin);
 assert.equal(coin.parent,scene);
 step(COIN_STOW-COIN_GRASP);
 assert.equal(coin.parent,null);
 step(.3);
 assert.equal(npc.coinPickup,null);
});

test('B02 leaves the coin when the responder is blocked, on another floor, or retargeted before grasp',()=>{
 const {npc,coin,scene,pickups,step}=scenario();
 npc.arrived=true;
 npc.pos.y=1;
 step(.5);
 assert.equal(npc.coinPickup,null);
 npc.pos.y=0;
 pickups.step(.5,[{minX:-1,maxX:1,minY:0,maxY:2,minZ:.2,maxZ:.35}]);
 assert.equal(npc.coinPickup,null);
 step(.15);
 assert.ok(npc.coinPickup);
 npc.hear(at,rules as Rules);
 step(.5);
 assert.equal(npc.coinPickup,null);
 assert.equal(coin.parent,scene);
});

test('B02 never puts an already grasped coin back on the floor when interrupted',()=>{
 const {npc,coin,pickups,step}=scenario();
 npc.arrived=true;
 step(COIN_GRASP+.01);
 npc.life='unconscious';
 step(.1);
 assert.equal(npc.coinPickup,null);
 assert.equal(pickups.held.length,0);
 assert.equal(coin.parent,null);
});

test('B02 a guard who only turns at a post leaves the coin on the floor',()=>{
 const {npc,coin,scene,pickups,step}=scenario();
 pickups.clear();
 npc.holdsPost=true;
 npc.hear(at,rules as Rules);
 assert.equal(npc.goal,null);
 pickups.watch(coin,npc);
 step(1);
 assert.equal(npc.coinPickup,null);
 assert.equal(coin.parent,scene);
});

test('B02 NPCs keep their feet on the floor and lift the coin with their right hand',async()=>{
 const loader=new GLTFLoader().register(()=>({name:'pose-only',loadTexture:()=>Promise.resolve(null)}));
 for(const id of ['guard','guest_dress']){
  const {scene:model}=await loader.parseAsync(Uint8Array.from(atob(NPC_MODELS[id]),c=>c.charCodeAt(0)).buffer,'');
  const group=new T.Group(),rig=new Rig(model),coin=coinMesh();
  group.add(model,coin);
  for(const z of [.2,.55,.62]){
   const at={x:0,y:.01,z};
   const frame=(progress:number)=>{
    const pickup={at,progress};
    poseCoinPickup({rig,model,group},pickup,()=>0);
    placePickupCoin(coin,rig,pickup);
    model.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.update();});
    assert.ok(Math.abs(new T.Box3().setFromObject(model,true).min.y)<.02,`${id} floor clearance at ${progress}`);
   };
   frame(COIN_GRASP-.01);
   assert.ok(coin.position.distanceTo(at)<.001);
   frame(COIN_GRASP);
   assert.ok(coin.position.distanceTo(at)<.025,`${id} at ${z} m, grip error is ${coin.position.distanceTo(at)} m`);
   frame(.65);
   assert.ok(coin.visible&&coin.position.y>.35);
   frame(COIN_STOW);
   assert.equal(coin.visible,false);
  }
 }
});

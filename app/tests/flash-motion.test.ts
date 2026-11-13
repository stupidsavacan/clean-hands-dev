import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {PLAYER_BASE64} from '../src/player-data.ts';
import {NPC_MODELS} from '../src/npc-data.ts';
import {Rig} from '../src/rig.ts';
import {Locomotion} from '../src/locomotion.ts';
import {flashMesh,flashGrip,poseFlashThrow,placeHeldFlash,FLASH_RELEASE,FLASH_THROW_SECONDS} from '../src/flash-motion.ts';
const loader=new GLTFLoader().register(()=>({name:'flash-test-material',loadMaterial:()=>Promise.resolve(new T.MeshBasicMaterial())}));
for(const [name,b64] of [['agent',PLAYER_BASE64],['guard',NPC_MODELS.guard]])test(`flash throw: ${name} holds the prop at every frame from walking and crouched cover`,async()=>{
 for(const cover of [false,true]){const bytes=Uint8Array.from(Buffer.from(b64,'base64')),model=(await loader.parseAsync(bytes.buffer,'')).scene,actor=new T.Group();actor.position.set(3,0,-2);actor.rotation.y=.7;actor.add(model);const rig=new Rig(model),loco=new Locomotion(),prop=flashMesh();actor.add(prop);
  for(let frame=0;frame<=36;frame++){const seconds=frame/30;loco.reset();rig.apply(loco.update(1/60,{speed:1.4,crouch:0,slope:0,turn:0,distance:1.4/60}));poseFlashThrow(rig,actor,model,seconds/FLASH_THROW_SECONDS,cover);placeHeldFlash(prop,rig,actor,seconds);
   const grip=flashGrip(rig)!;assert.ok(Number.isFinite(grip.x+grip.y+grip.z));if(seconds<FLASH_RELEASE){assert.ok(prop.visible);assert.ok(prop.getWorldPosition(new T.Vector3()).distanceTo(grip)<1e-6);}else assert.equal(prop.visible,false);
  }
 }
});

import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as T from 'three';import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {game} from '../../investigation/ghost-sim.ts';import {walk} from '../../investigation/ghost-walk.ts';
import {PLAYER_BASE64} from '../src/player-data.ts';import {COMBAT_MODELS} from '../src/combat-data.ts';import {Rig} from '../src/rig.ts';import {Locomotion} from '../src/locomotion.ts';import {sampleCombat} from '../src/combat-motion.ts';import {poseCombat,prepareWeapon,muzzle} from '../src/combat-runtime.ts';import {NpcView} from '../src/npc-view.ts';import {CombatView} from '../src/combat-view.ts';
import {GUN_LIST,GUN_MODELS} from '../src/gun-data.ts';
import {Director,type PlayerView} from '../src/ai.ts';import {CollisionWorld} from '../src/world.ts';import {NavGrid} from '../src/nav.ts';import {sightBoxes} from '../src/sight.ts';import {MissionEvents} from '../src/events.ts';import {M3System} from '../src/m3.ts';import {CombatSystem} from '../src/combat.ts';import {ScoreLedger,computeResult} from '../src/score.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8')),hotel=json('hotel'),rules=json('rules'),combatRules=json('combat'),weapons=json('weapons'),scoring=json('scoring'),poseData=json('combat-pose');
const load=async(s:string)=>(await new GLTFLoader().register(()=>({name:'pose-only-no-textures',loadTexture:()=>Promise.resolve(null)})).parseAsync(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer,'')).scene;
function setup(){const world=new CollisionWorld(hotel),d=new Director(hotel,world,new NavGrid(world),sightBoxes(hotel),structuredClone(rules)),e=new MissionEvents(),m3=new M3System(d,hotel.hides,rules.m3),c=new CombatSystem(d,e,m3.hotel,combatRules,weapons,hotel.reinforcements,()=>0),ledger=new ScoreLedger(e,id=>{const n=d.npcs.find(n=>n.id===id);return n&&{role:n.role,target:n.target};});return {world,d,c,ledger};}
test('M5.8 busy hotel NPCs stand or chat with lowered arms instead of the rest pose',async()=>{const {d}=setup(),n=d.npcs.find(n=>n.id==='head_waiter')!,scene=new T.Scene(),v=new NpcView(await load(PLAYER_BASE64),n,scene);n.busy=true;n.speed=0;for(const action of ['', 'chat']){n.scriptedAction=action;v.render(1/60,1,()=>n.pos.y);for(const side of ['l','r']){const j=v.rig.joints.get('upperarm'+side)!;assert.ok(j.bone.quaternion.angleTo(j.q0)>1,'arm must hang below the T pose');}}});
test('M5.8 the held guard gun clears on the next frame when dead or busy; the dropped gun remains',async()=>{const {d,c}=setup(),n=d.npcs.find(n=>n.id==='guard_parking')!,scene=new T.Scene(),v=new NpcView(await load(PLAYER_BASE64),n,scene),cv=new CombatView(scene);(cv as unknown as {templates:Map<string,T.Object3D>}).templates.set('pistol_guard',await load(COMBAT_MODELS.pistol_guard));n.state='combat';cv.npc(v,1);const held=v.group.children.find(o=>o!==v.body.parent)!;assert.ok(held.visible);n.busy=true;cv.render(c,1.1,[v]);assert.equal(held.visible,false);n.busy=false;cv.npc(v,1.2);assert.equal(held.visible,true);n.life='dead';n.state='patrol';n.fall=0;cv.render(c,1.21,[v]);assert.equal(held.visible,false);n.fall=1;c.step(1/60,{...hotel.spawn,y:0,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'},1.3);cv.render(c,1.3,[v]);assert.equal(held.visible,false);const drop=c.dropped.find(g=>Math.hypot(g.pos.x-n.pos.x,g.pos.z-n.pos.z)<1)!;assert.ok(drop);assert.ok(cv.root.children.some(o=>o.visible&&o.position.x===drop.pos.x&&o.position.z===drop.pos.z));});
test('M5.8 crouched aim, shot, reload and draw lower both weapon classes to the shot height and retain their grips',async()=>{const model=await load(PLAYER_BASE64),actor=new T.Group();actor.add(model);const rig=new Rig(model),loco=new Locomotion();for(const cls of ['pistol','long'] as const){const weapon=prepareWeapon(await load(COMBAT_MODELS[cls==='pistol'?'pistol_silenced':'smg']),cls);for(const kind of ['aim','fire','reload','draw','holster'] as const)for(const progress of [0,.18,.4,.7,1]){let pose;for(let j=0;j<80;j++)pose=loco.update(1/60,{speed:0,crouch:1,slope:0,turn:0,distance:0,actual:0});rig.apply(pose!);const frame=sampleCombat(kind,cls,progress,true);const error=poseCombat(rig,actor,model,frame,weapon,1);assert.ok(error<.025,`${kind}/${cls}/${progress}: ${error}`);const hold=weapon.object.localToWorld(weapon.anchors[frame.weapon!.anchor].clone());assert.ok(Math.abs(hold.y-(frame.weapon!.pos[1]-poseData.chest.standing+poseData.chest.crouched))<1e-8);if(kind==='aim')assert.ok(muzzle(weapon).y<rig.joints.get('head')!.bone.getWorldPosition(new T.Vector3()).y);}}});
test('HD15: the agent straightens the elbow at the same grip on every pistol model',async()=>{
 const model=await load(PLAYER_BASE64),actor=new T.Group(),rig=new Rig(model),loco=new Locomotion();
 actor.add(model);
 const pistols=[
  ...Object.entries(weapons as Record<string,{class:string}>).filter(([,def])=>def.class==='pistol').map(([id])=>[id,COMBAT_MODELS[id]] as const),
  ...GUN_LIST.filter(gun=>gun.cls==='pistol').map(({id})=>[id,GUN_MODELS[id]] as const),
 ];
 const idle=loco.update(1/60,{speed:0,crouch:0,slope:0,turn:0,distance:0,actual:0});
 const point=(name:string)=>rig.joints.get(name)!.bone.getWorldPosition(new T.Vector3());
 for(const [id,b64] of pistols){
  const weapon=prepareWeapon(await load(b64),'pistol');
  const aim=(agent:boolean,tuning?:Parameters<typeof sampleCombat>[4])=>{
   rig.apply(idle);
   const error=poseCombat(rig,actor,model,sampleCombat('aim','pistol',0,agent,tuning),weapon);
   assert.ok(error<.01,`${id} grip error: ${error} m`);
   const elbow=point('forearmr'),wrist=point('handr');
   return {wrist,angle:point('upperarmr').sub(elbow).angleTo(wrist.clone().sub(elbow)),muzzle:muzzle(weapon).clone()};
  };
  const twoHands=aim(false),oneHand=aim(true),adjusted=aim(true,{torso:0,shoulder:0,elbow:8,freeArm:5});
  for(const pose of [oneHand,adjusted]){
   assert.ok(pose.wrist.distanceTo(twoHands.wrist)<.01,id);
   assert.ok(pose.angle>twoHands.angle,id);
   assert.ok(pose.muzzle.distanceTo(twoHands.muzzle)<1e-8,id);
  }
 }
});
test('M5.8 a crouched hotel shot after walking from the entrance starts at the configured chest and hits the aimed target',()=>{const S=game();walk(S,JSON.parse(readFileSync(new URL('../../investigation/visual-checks.json',import.meta.url),'utf8')).barApproach);const target=S.npc('wine_merchant');assert.equal(S.flow.outcome,null);assert.equal(computeResult(scoring,S.ledger.counts,S.c.elapsed,true).ghost,true);S.combat.equip('pistol_silenced');S.combat.hand='pistol_silenced';S.p.crouched=true;const shot=S.combat.fire(S.p,{x:target.pos.x,y:target.pos.y+1.65,z:target.pos.z},S.c.elapsed);assert.equal(shot.hit,target);assert.equal(shot.killed,true);assert.equal(S.combat.tracers.at(-1)!.from.y,S.p.y+poseData.chest.crouched);});


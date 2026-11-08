import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleCombat,weaponVisible,COMBAT_LOOPS,COMBAT_SECONDS,type CombatKind,type CombatFrame,type WeaponClass} from '../src/combat-motion.ts';
const KINDS=Object.keys(COMBAT_SECONDS) as CombatKind[],CLASSES:WeaponClass[]=['pistol','long'];
const STANCES=[['pistol',false],['pistol',true],['long',false],['long',true]] as const;
const flat=(f:CombatFrame)=>[...Object.values(f.pose.root),...Object.values(f.pose.bones).flat(),...(f.weapon?[...f.weapon.pos,...f.weapon.rot]:[]),f.right.weight,f.left.weight];
const near=(a:CombatFrame,b:CombatFrame,tol=1e-9)=>{const x=flat(a),y=flat(b);assert.equal(x.length,y.length);x.forEach((v,i)=>assert.ok(Math.abs(v-y[i])<=tol,`channel ${i}: ${v} vs ${y[i]}`));assert.equal(a.right.to,b.right.to);assert.equal(a.left.to,b.left.to);};

test('M5.5 every gunplay motion is finite, bounded and continuous for both weapon classes',()=>{
 for(const k of KINDS)for(const [c,agent] of STANCES){let prev:number[]|null=null;
  for(let i=0;i<=400;i++){const f=sampleCombat(k,c,i/400,agent),v=flat(f);assert.equal(Object.keys(f.pose.bones).length,22);
   for(const x of v)assert.ok(Number.isFinite(x)&&Math.abs(x)<4,`${k}/${c} ${x}`);
   if(prev)v.forEach((x,j)=>assert.ok(Math.abs(x-prev![j])<.08,`${k}/${c} jump at ${i/400}: channel ${j} ${prev![j]} -> ${x}`));prev=v;}}});

test('M5.5 one-shots start and end on the aim (or holster) pose, so they chain without a pop',()=>{
 for(const [c,agent] of STANCES){const aim=sampleCombat('aim',c,0,agent);
  near(sampleCombat('draw',c,1,agent),aim);near(sampleCombat('holster',c,0,agent),aim);near(sampleCombat('holster',c,1,agent),sampleCombat('draw',c,0,agent));
  for(const k of ['fire','reload','hit'] as CombatKind[]){near(sampleCombat(k,c,0,agent),aim,1e-9);near(sampleCombat(k,c,1,agent),aim,1e-9);}
  near(sampleCombat('coverAim',c,0,agent),sampleCombat('cover',c,0,agent));}});

test('M5.5 loops close exactly: aim breathing, cover idle and the fleeing run',()=>{
 for(const k of COMBAT_LOOPS)for(const c of CLASSES)near(sampleCombat(k,c,0),sampleCombat(k,c,1));});

test('M5.5 a hand changing its goal lets go first: the weight passes through zero at the switch',()=>{
 for(const k of ['draw','reload'] as CombatKind[])for(const c of CLASSES){let last=sampleCombat(k,c,0);
  for(let i=1;i<=1000;i++){const f=sampleCombat(k,c,i/1000);for(const side of ['right','left'] as const)if(f[side].to!==last[side].to)assert.ok(f[side].weight<.05&&last[side].weight<.05,`${k}/${c} ${side} ${last[side].to}->${f[side].to}`);last=f;}}});

test('HD15 (S08 rows 26 and 97): only the agent aims and fires a pistol one-handed',()=>{
 for(const [c,agent] of STANCES){
  const oneHanded=agent&&c==='pistol';
  for(const k of ['aim','fire','cover','coverAim'] as const)for(let i=0;i<=20;i++){
   const f=sampleCombat(k,c,i/20,agent);
   assert.deepEqual(f.right,{to:'GRIP_R',weight:1});
   assert.deepEqual(f.left,{to:'GRIP_L',weight:oneHanded?0:1});
  }
  const goals=new Set<string>();
  for(let i=0;i<=100;i++){
   const f=sampleCombat('reload',c,i/100,agent);
   if(f.left.weight>.99)goals.add(f.left.to);
  }
  assert.deepEqual([...goals].sort(),oneHanded?['MAG','POUCH','SLIDE']:['GRIP_L','MAG','POUCH','SLIDE']);
 }
 // The user's reference photo (2026-11-08): the agent's gun is out on the straight right arm, on the right of the
 // face and further forward than the two-handed hold; holstered and kneeling holds stay shared.
 const one=sampleCombat('aim','pistol',0,true).weapon!,two=sampleCombat('aim','pistol',0).weapon!;
 assert.ok(one.pos[0]<-.1&&one.pos[2]>two.pos[2]+.2&&one.pos[1]>two.pos[1],JSON.stringify(one.pos));
 for(const kind of ['cover'] as const)assert.deepEqual(sampleCombat(kind,'pistol',0,true).weapon,sampleCombat(kind,'pistol',0).weapon);
 assert.deepEqual(sampleCombat('draw','pistol',0,true).weapon,sampleCombat('draw','pistol',0).weapon);
 // The lab's A/B candidates: E is the game's stance; the others move the gun.
 assert.deepEqual(sampleCombat('aim','pistol',0,true,undefined,'E'),sampleCombat('aim','pistol',0,true));
 assert.deepEqual(sampleCombat('aim','pistol',0,true,undefined,'A').weapon,two);
 const tuning={torso:6,shoulder:5,elbow:-12,freeArm:10};
 const standard=sampleCombat('aim','pistol',0,true),adjusted=sampleCombat('aim','pistol',0,true,tuning);
 assert.notDeepEqual(adjusted.pose.bones,standard.pose.bones);
 assert.deepEqual(adjusted.weapon,standard.weapon);
 assert.deepEqual(adjusted.right,standard.right);
 near(sampleCombat('aim','pistol',0,false,tuning),sampleCombat('aim','pistol',0));
 near(sampleCombat('aim','long',0,true,tuning),sampleCombat('aim','long',0,true));
});

test('M5.5 the agent pistol is concealed in the holster; long guns and the guard pistol stay visible; bystanders are unarmed',()=>{
 assert.equal(weaponVisible('draw','pistol',0,true),false);assert.equal(weaponVisible('draw','pistol',1,true),true);
 assert.equal(weaponVisible('holster','pistol',1,true),false);assert.equal(weaponVisible('draw','pistol',0,false),true);
 assert.equal(weaponVisible('draw','long',0,true),true);for(const k of ['flee','duck'] as CombatKind[])assert.equal(weaponVisible(k,'pistol',.5,false),false);
 // Upper-only motions layer over the legs; the others pose the whole body.
 for(const k of ['draw','holster','aim','fire','reload','flee'] as CombatKind[])assert.equal(sampleCombat(k,'pistol',.5).upperOnly,true);
 for(const k of ['hit','cover','coverAim','duck'] as CombatKind[])assert.equal(sampleCombat(k,'pistol',.5).upperOnly,false);});

test('M5.5 cover: kneeling lowers the body below a 1.2 m crate; aiming over it raises the weapon above the top',()=>{
 for(const c of CLASSES){const kneel=sampleCombat('cover',c,0),up=sampleCombat('coverAim',c,1);
  assert.ok(kneel.pose.root.y<-.4);assert.ok(kneel.weapon!.pos[1]<1.0,`${c} hidden weapon ${kneel.weapon!.pos[1]}`);
  assert.ok(up.weapon!.pos[1]>1.22,`${c} weapon over cover ${up.weapon!.pos[1]}`);}});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_LOOK,GAITS,HAIRS,SWATCHES,bodyScales,decodeLook,encodeLook,gaitStyleOf,heightScale,randomLook,sanitizeLook,visibleParts} from '../src/wardrobe.ts';
import {Locomotion,NEUTRAL,THIGH,SHIN,type Pose} from '../src/locomotion.ts';
test('old saves and junk are turned into a complete, in-range look',()=>{
 const old=sanitizeLook({codename:'  X ',hair:'bob',brow:.4,outfit:'tie',tie:'black',glasses:false});
 assert.equal(old.codename,'X');assert.equal(old.hair,'bob');assert.equal(old.tieColor,'#2b2e35');assert.equal(old.skin,DEFAULT_LOOK.skin);assert.equal(old.gait.style,'standard');
 const junk=sanitizeLook({hair:'nope',brow:99,skin:'red',hairColor:'#ABCDEF',height:-5,gait:{style:'x',stride:3,arm:'a'}});
 assert.equal(junk.hair,DEFAULT_LOOK.hair);assert.equal(junk.brow,1);assert.equal(junk.skin,DEFAULT_LOOK.skin);assert.equal(junk.hairColor,'#abcdef');assert.equal(junk.height,-1);assert.equal(junk.gait.stride,1);assert.equal(junk.gait.arm,0);
 assert.deepEqual(sanitizeLook(null),DEFAULT_LOOK);});
test('share code round-trips every field and rejects other text',()=>{
 for(let i=0;i<40;i++){const l=randomLook('SHARE '+i);assert.deepEqual(decodeLook(encodeLook(l)),l);}
 const jp=sanitizeLook({codename:'あ'});assert.equal(decodeLook(encodeLook(jp))!.codename,'あ');
 for(const bad of ['','CH1.','CH1.@@@','hello','CH2.abcd','CH1.'+btoa('not json')])assert.equal(decodeLook(bad),null);});
test('random looks stay valid and the visible parts always include body, face and exactly one hair',()=>{
 for(let i=0;i<60;i++){const l=randomLook('R');const parts=visibleParts(l);assert.ok(parts.includes('Body')&&parts.includes('Face'));assert.equal(parts.filter(p=>p.startsWith('Hair_')).length,1);
  assert.ok(HAIRS.some(h=>h.id===l.hair));assert.ok(GAITS.some(g=>g.id===l.gait.style));for(const c of [l.skin,l.hairColor,l.suitColor,l.tieColor])assert.match(c,/^#[0-9a-f]{6}$/);}
 assert.ok(Object.values(SWATCHES).every(list=>list.every(c=>/^#[0-9a-f]{6}$/.test(c))));});
test('proportions and gait presets map to safe ranges',()=>{
 assert.ok(Math.abs(heightScale({...DEFAULT_LOOK,height:1})-1.07)<1e-9);const b=bodyScales({...DEFAULT_LOOK,build:-1,shoulders:1,head:1});assert.ok(b.build<1&&b.shoulders>1&&b.head>1);
 const extreme=[-1,1];for(const g of GAITS)for(const k of ['stride','arm','lean','sway','bounce'] as const)for(const v of extreme){const s=gaitStyleOf({...DEFAULT_LOOK.gait,style:g.id,[k]:v});
  assert.ok(s.stride>.6&&s.stride<1.5&&s.arm>0&&s.arm<2.3&&s.sway>0&&s.bounce>0&&Math.abs(s.lean)<.35,`${g.id}.${k}=${v}`);}
 assert.deepEqual(gaitStyleOf(DEFAULT_LOOK.gait),NEUTRAL);});
// Every gait style, at its extremes, must still plant the feet and keep the legs reachable.
const ankle=(p:Pose,i:number)=>{const l=p.legs[i];return {z:-(THIGH*Math.sin(l.thigh)+SHIN*Math.sin(l.thigh+l.knee)),y:p.hip-(THIGH*Math.cos(l.thigh)+SHIN*Math.cos(l.thigh+l.knee))};};
for(const [name,speed,crouch] of [['walk',1.65,0],['run',4.8,0],['sneak',1.2,1]] as [string,number,number][])
 test(`gait styles keep feet planted and finite while ${name}`,()=>{
  for(const g of GAITS)for(const sign of [-1,1]){const loco=new Locomotion();loco.style=gaitStyleOf({style:g.id,stride:sign,arm:sign,lean:sign,sway:sign,bounce:sign});let body=0,worst=0,stance=0;let prev:Pose|null=null,prevBody=0;
   for(let i=0;i<60*8;i++){body+=speed/60;const p=loco.update(1/60,{speed,crouch,slope:0,turn:0,distance:speed/60});
    for(const v of [p.hip,p.spine,p.chest,p.neck,p.head,p.pelvisYaw,p.pelvisRoll,...p.legs.flatMap(l=>[l.thigh,l.knee,l.foot,l.roll]),...p.arms.flatMap(a=>[a.swing,a.elbow])])assert.ok(Number.isFinite(v));
    if(i>90&&prev)for(const leg of [0,1]){const a=p.legs[leg],b=prev.legs[leg];if(!a.stance||!b.stance||a.ankle.y>.004)continue;stance++;worst=Math.max(worst,Math.abs(body+ankle(p,leg).z-prevBody-ankle(prev,leg).z));}
    prev=p;prevBody=body;}
   assert.ok(stance>40,`${g.id} has stance frames`);assert.ok(worst<.008,`${g.id} ${sign} slips ${worst.toFixed(4)} m/frame at ${name}`);}});

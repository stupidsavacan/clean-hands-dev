// 2026-11-06 (ROADMAP S03 M07/M08/M11/M12/M13/M16): things in hand as weapons, in the shared M3System.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Director,type Mission,type PlayerView,type Rules} from '../src/ai.ts';
import {CollisionWorld,plateY} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {M3System,type HideDef} from '../src/m3.ts';
import {MELEE,meleeOf} from '../src/melee.ts';
const json=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
const map=json('marina.json'),rules=json('rules.json');
const p=(x=-8,z=6.1):PlayerView=>({x,y:0,z,floor:0,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'});
// The target at (-8,7) faces -z, toward a player at (-8,6.1) who faces +z (heading 0).
function setup(item:string,role='guard'){const level=structuredClone(map) as Mission;level.npcs=[{id:'target',role,label:'対象',floor:0,route:[[-8,7,600]],look:[-8,6]},{id:'other',role:'guard',label:'警備',floor:0,route:[[-4,7,600]],look:[-3,7]}];
 const world=new CollisionWorld(level),d=new Director(level,world,new NavGrid(world),sightBoxes(level),rules as Rules),m=new M3System(d,map.hides as HideDef[],rules.m3);
 d.npcs[0].heading=Math.PI;d.npcs[1].heading=Math.PI/2;m.heldItem=()=>item;return {m,d,n:d.npcs[0]};}
function hold(m:M3System,key:string,seconds:number,heading=0,player=p()){for(let t=0;t<seconds;t+=1/60)m.step(1/60,player,heading,new Set([key]));m.step(1/60,player,heading,new Set());}

test('a blunt thing knocks someone out from the front with one quick swing',()=>{const {m,n}=setup('hammer');m.step(1/60,p(),0,new Set());
 assert.match(m.prompt(p()),/ハンマーで殴って気絶/);hold(m,'KeyF',.75);assert.equal(n.life,'unconscious');assert.equal(m.stats.knockouts,1);assert.equal(m.stats.kills,0);});
test('a blade kills from the front with X and is recorded as the method',()=>{const {m,n}=setup('kitchen_knife');hold(m,'KeyX',.65);assert.equal(n.life,'dead');assert.equal(n.deathMethod,'kitchen_knife');assert.equal(m.stats.kills,1);});
test('facing away, nothing happens from the front',()=>{const b=setup('hammer');hold(b.m,'KeyF',1,Math.PI);assert.equal(b.n.life,'active');
 const c=setup('coin','guest');hold(c.m,'KeyF',3,Math.PI);assert.equal(c.n.life,'active');});
test('the wrong key for the thing in hand falls back to the bare-hand take-down from behind',()=>{const {m,n}=setup('kitchen_knife');hold(m,'KeyF',3,Math.PI,p(-8,7.9));assert.equal(n.life,'unconscious');});
test('a swing from the front is cut short by letting go',()=>{const {m,n}=setup('hammer');hold(m,'KeyF',.3);assert.equal(n.life,'active');assert.equal(n.busy,false);assert.equal(m.action,null);});
test('a thrown blunt thing knocks out, a thrown blade kills, and a witness sees the throw',()=>{const a=setup('brick');a.m.thrownHit(a.n,p(),'ko','thrown_brick');assert.equal(a.n.life,'unconscious');
 const b=setup('kitchen_knife');b.d.npcs[1].heading=-Math.PI/2;b.m.thrownHit(b.n,p(),'kill','thrown_kitchen_knife');assert.equal(b.n.life,'dead');assert.equal(b.n.deathMethod,'thrown_kitchen_knife');assert.equal(b.d.npcs[1].state,'alert');assert.equal(b.d.npcs[1].sawViolence,true);});
test('every melee thing has a model and a carry rule in the club',()=>{const det=json('club-detection.json');for(const id of Object.keys(MELEE).filter(id=>!['wrench','bottle'].includes(id)))assert.ok(det.items[id],id);assert.equal(meleeOf('kitchen_knife')?.kind,'blade');});
test('the club tools lie on open floor where their work is',()=>{const det=json('club-detection.json'),club=json('club-map.json'),w=new CollisionWorld(club);
 assert.deepEqual(det.worldItems.map((i:{item:string})=>i.item).sort(),['brick','briefcase','crowbar','frying_pan','hammer','katana','kitchen_knife','toolbox','wire_earphones','wire_tape','wrench']);
 for(const i of det.worldItems){const y=plateY(club,i.floor);assert.equal(w.blocked(i.x,y,i.z,.3),false,i.id);assert.notEqual(w.surface(i.x,i.z,y),null,i.id);}});
test('M14/M15: a sword kills from the front with X; a briefcase knocks out with F (M09/M10)',()=>{const a=setup('katana');hold(a.m,'KeyX',1.05);assert.equal(a.n.life,'dead');assert.equal(a.n.deathMethod,'katana');
 const b=setup('briefcase');hold(b.m,'KeyF',.75);assert.equal(b.n.life,'unconscious');assert.equal(meleeOf('briefcase')?.throwable,true);});

// Bare hands (M01/M02/M04/M05).
const press=(m:M3System,key:string,wait=.3,heading=0,player=p())=>{for(let t=0;t<wait;t+=1/60)m.step(1/60,player,heading,new Set());m.step(1/60,player,heading,new Set([key]));};
test('M01: an unarmed person is punched out from the front by holding F',()=>{const {m,n}=setup('','guest');m.step(1/60,p(),0,new Set());assert.match(m.prompt(p()),/殴って気絶/);
 hold(m,'KeyF',.4);assert.equal(n.life,'active');hold(m,'KeyF',1);assert.equal(n.life,'unconscious');assert.equal(m.stats.knockouts,1);});
test('M02: a guard faced unarmed is a fight won by pressing F, X, F in time',()=>{const {m,n}=setup('');m.step(1/60,p(),0,new Set());assert.match(m.prompt(p()),/格闘/);
 m.step(1/60,p(),0,new Set(['KeyF']));assert.equal(m.action?.mode,'brawl');assert.match(m.prompt(p()),/F を押す（1\/3）/);
 press(m,'KeyF');assert.match(m.prompt(p()),/X を押す（2\/3）/);press(m,'KeyX');press(m,'KeyF');m.step(1/60,p(),0,new Set());
 // The third blow plays out before he goes down (brawl-motion.ts BRAWL_FINISH).
 assert.equal(n.life,'active');assert.equal(m.blows?.blows,3);assert.match(m.prompt(p()),/決まった/);for(let t=0;t<.7;t+=1/60)m.step(1/60,p(),0,new Set());
 assert.equal(n.life,'unconscious');assert.equal(m.action,null);});
test('M02: a wrong key or a late press loses the fight and the guard fights back',()=>{const a=setup('');a.m.step(1/60,p(),0,new Set());a.m.step(1/60,p(),0,new Set(['KeyF']));press(a.m,'KeyX');
 assert.equal(a.n.life,'active');assert.equal(a.m.action,null);assert.equal(a.n.busy,false);assert.equal(a.n.sawViolence,true);assert.equal(a.n.state,'alert');
 const b=setup('');b.m.step(1/60,p(),0,new Set());b.m.step(1/60,p(),0,new Set(['KeyF']));press(b.m,'KeyF',1.3);assert.equal(b.n.life,'active');assert.equal(b.n.sawViolence,true);});
test('S08 rows 193/194: both variants use the rear wire attack and stop if put down',()=>{
 for(const id of ['wire_earphones','wire_tape']){
  const {m,n}=setup(id),back=p(-8,7.9),keys=new Set(['KeyX']);
  m.step(1/60,back,Math.PI,keys);
  assert.equal(m.action?.wireItem,id);
  m.heldItem=()=>'';
  m.step(1/60,back,Math.PI,keys);
  assert.equal(m.action,null);assert.equal(n.life,'active');
  m.step(1/60,back,Math.PI,new Set());
  m.heldItem=()=>id;
  hold(m,'KeyX',3.5,Math.PI,back);
  assert.equal(n.life,'dead');assert.equal(n.deathMethod,'direct');
 }
});

test('M04: X during a bare-hand choke from behind turns it lethal',()=>{const {m,n}=setup('');const back=p(-8,7.9);hold(m,'KeyF',1,Math.PI,back);
 m.step(1/60,back,Math.PI,new Set(['KeyF']));for(let t=0;t<1;t+=1/60)m.step(1/60,back,Math.PI,new Set(['KeyF']));assert.equal(m.action?.kind,'ko');
 m.step(1/60,back,Math.PI,new Set(['KeyF','KeyX']));assert.equal(m.action?.kind,'kill');hold(m,'KeyX',2,Math.PI,back);assert.equal(n.life,'dead');assert.equal(m.stats.kills,1);assert.equal(m.stats.knockouts,0);});
test('M05: X held by someone out cold finishes them where they lie',()=>{const {m,n}=setup('');hold(m,'KeyF',2.5,Math.PI,p(-8,7.9));assert.equal(n.life,'unconscious');n.fall=1;const at=p(-8,7.9);
 assert.match(m.prompt(at),/とどめ/);hold(m,'KeyX',1.4,Math.PI,at);assert.equal(n.life,'dead');assert.equal(n.deathMethod,'finish');assert.equal(n.fall,1);assert.equal(m.stats.kills,1);});
// Full spec rows 13/14/32/64/120 and the 194-item table row 189 (2026-11-06).
test('a sword cuts from the front and stabs from behind, and can be thrown',()=>{const a=setup('katana');a.m.step(1/60,p(),0,new Set());assert.match(a.m.prompt(p()),/刀で斬る/);a.m.step(1/60,p(),0,new Set(['KeyX']));assert.equal(a.m.action?.behind,false);assert.equal(a.m.strike,null,'a whole-body motion (katana-motion.ts), not an arm swing');
 const b=setup('katana');const back=p(-8,7.9);b.m.step(1/60,back,Math.PI,new Set());assert.match(b.m.prompt(back),/刀で刺す/);b.m.step(1/60,back,Math.PI,new Set(['KeyX']));assert.equal(b.m.action?.behind,true);
 assert.equal(meleeOf('katana')?.throwable,true);});
test('swords go on the back, two at most; only swords; one in view is illegal and a frisk finds it',async()=>{const {DetectionSystem}=await import('../src/detection.ts');const {HotelAlert}=await import('../src/m3.ts');const {MissionEvents}=await import('../src/events.ts');
 const det=json('club-detection.json'),club=json('club-map.json'),level=structuredClone(map) as Mission;level.npcs=[];const world=new CollisionWorld(level);const d=new Director(level,world,new NavGrid(world),sightBoxes(level),rules as Rules);
 const s=new DetectionSystem(d,new MissionEvents(),new HotelAlert(),[],{...det,worldItems:[]},club);
 s.held='katana';assert.equal(s.holster(),'on');assert.deepEqual(s.back,['katana']);assert.equal(s.held,'');assert.ok(s.illegalShown('suit'));
 s.held='katana';s.holster();s.held='katana';assert.equal(s.canHolster(),false,'two at most');s.held='hammer';assert.equal(s.canHolster(),false,'swords only');
 s.held='';assert.equal(s.holster(),'off');assert.equal(s.held,'katana');assert.equal(s.back.length,1);
 s.held='';s.back.length=0;assert.equal(s.illegalShown('suit'),false);s.held='kitchen_knife';assert.ok(s.illegalShown('suit'));assert.equal(s.illegalShown('chef'),false);});
test('the sword motion: two hands on the grip, the cut lands mid-way, the one struck ends where the fall begins',async()=>{const k=await import('../src/katana-motion.ts');
 for(const behind of [false,true]){const keys=behind?k.BEHIND:k.FRONT;assert.equal(keys[0].t,0);assert.equal(keys.at(-1)!.t,1);const imp=behind?k.KATANA_IMPACT.behind:k.KATANA_IMPACT.front;assert.ok(imp>.3&&imp<.7);
  const r=k.katanaReceiver(behind,1).pose;assert.deepEqual(r.bones.thighl,[-.52,0,-.07],'ends in collapse()');}
 // Front: the fist starts low, goes above the shoulder, then ends low on the left (a diagonal cut).
 const up=k.katanaGiver(false,.3).fist,end=k.katanaGiver(false,.6).fist;assert.ok(up[1]>1.5&&up[0]<0,'raised over the right shoulder');assert.ok(end[1]<1&&end[0]>0,'down to the lower left');
 // Behind: the left hand is on the target's face while the blade goes in.
 assert.equal(k.katanaGiver(true,.46).leftOnTarget,1);});

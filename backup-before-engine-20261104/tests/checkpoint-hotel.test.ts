import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {game,hotel,rules,scoring,world,nav} from '../../investigation/ghost-sim.ts';
import {walk,wait,behind} from '../../investigation/ghost-walk.ts';
import {computeResult} from '../src/score.ts';import {floorOf} from '../src/world.ts';
const routes=JSON.parse(readFileSync(new URL('../../investigation/checkpoint-walk.routes.json',import.meta.url),'utf8'));
const prior=JSON.parse(readFileSync(new URL('../../investigation/ghost-walk.routes.json',import.meta.url),'utf8'));
function setup(c:any,start?:any){const S=game({poison:false});S.p={...S.p,...(start??(c.id==='check-lobby'?routes.lobbyStart:prior.points.route_02))};if(c.id==='check-marina'){
 walk(S,S.m4.clothes.find((c:any)=>c.disguise==='beachbar').pos);S.hold('KeyT',rules.m4.changeSeconds+prior.simulation.holdSlackSeconds);assert.equal(S.m4.disguise,'beachbar');
 for(const key of ['route_03','route_04','route_10'])walk(S,prior.points[key]);}return S;}
function line(c:any,along=0){return{x:c.x-c.normal.z*along+c.normal.x*routes.lineOffset,y:c.y,z:c.z+c.normal.x*along+c.normal.z*routes.lineOffset};}
function clean(S:any){assert.equal(S.flow.outcome,null);assert.equal(computeResult(scoring,S.ledger.counts,S.c.elapsed,true).ghost,true,JSON.stringify(S.spottedBy));assert.equal(S.d.npcs.length,hotel.npcs.length);}
function go(S:any,to:any){for(let i=0;i<routes.maxSteps;i++){const dx=to.x-S.p.x,dz=to.z-S.p.z,len=Math.hypot(dx,dz);if(len<routes.arrival)break;const step=Math.min(routes.step,len),next=S.m4.constrain(S.p,world.move(S.p,dx/len*step,dz/len*step));if(Math.hypot(next.x-S.p.x,next.z-S.p.z)<prior.simulation.movementEpsilon)break;S.heading=Math.atan2(dx,dz);S.p={...S.p,...next,floor:floorOf(next.y),speed:step/prior.simulation.step};S.tick();}S.p.speed=0;}
for(const c of hotel.checkpoints)for(const along of [-c.width/2,0,c.width/2])test(`Hotel checkpoint ${c.id}: walk to line offset ${along}, frisk, return and cross`,()=>{
 const S=setup(c),p=line(c,along);walk(S,p);S.heading=Math.atan2(-c.normal.x,-c.normal.z);const guard=S.npc(c.guardId),home={...guard.pos};assert.ok(S.m4.checkpoint(S.p));S.tick(new Set(['KeyB']));assert.equal(guard.busy,true);S.tick(new Set(['KeyB']));const moved=Math.hypot(guard.pos.x-home.x,guard.pos.z-home.z);assert.ok(moved>0&&moved<=rules.speeds.walk*prior.simulation.step+prior.simulation.movementEpsilon,'the attendant approaches at walking speed');S.hold('KeyB',routes.holdSeconds);assert.ok(S.m4.passed(c),JSON.stringify({notices:S.m4.notices,action:S.m4.action,p:S.p}));assert.equal(S.m4.stats.found,0);assert.ok(Math.hypot(guard.pos.x-home.x,guard.pos.z-home.z)<=rules.m4.friskArrivalDistance);assert.equal(guard.busy,false);
 walk(S,line(c));walk(S,c.id==='check-lobby'?routes.upstairs:routes.marinaCross);if(c.id==='check-lobby')assert.ok(S.p.y>3);else assert.ok(S.p.x>c.x);clean(S);
});
for(const c of hotel.checkpoints)test(`Hotel checkpoint ${c.id}: straight walking without inspection stops at the line`,()=>{const S=setup(c);walk(S,line(c));go(S,c.id==='check-lobby'?routes.lobbyCross:routes.marinaCross);assert.ok((S.p.x-c.x)*c.normal.x+(S.p.z-c.z)*c.normal.z>=-1e-9);assert.equal(S.m4.stats.frisks,0);clean(S);});
for(const side of [-1,1])for(const z of routes.gapDepths)test(`Hotel grand stairs: no uninspected ${side<0?'west':'east'} gap at z=${z}`,()=>{const c=hotel.checkpoints[0],x=c.x+side*routes.gapSideOffset,S=setup(c,{x,y:c.y,z:routes.gapStartZ});go(S,{x,z});go(S,{x:c.x,z});go(S,{x:c.x,z:routes.upstairs.z});assert.ok(S.p.y<1,JSON.stringify(S.p));assert.equal(S.m4.stats.frisks,0);clean(S);});
test('Hotel checkpoint B away from the line gives the line instruction',()=>{const c=hotel.checkpoints[0],S=setup(c);S.tick(new Set(['KeyB']));assert.deepEqual(S.m4.notices,['検問の線の前に立って B']);clean(S);});

test('Hotel marina: walk behind the attendant, knock out, then B reports no attendant without breaking ghost',()=>{const c=hotel.checkpoints[1],S=setup(c);behind(S,c.guardId);S.hold('KeyF',rules.m3.koSeconds+prior.simulation.holdSlackSeconds);assert.equal(S.npc(c.guardId).life,'unconscious');walk(S,line(c));S.tick(new Set(['KeyB']));assert.equal(S.m4.action,null);assert.deepEqual(S.m4.notices,['検査担当の警備員が近くにいません。']);assert.equal(S.m4.stats.frisks,0);clean(S);});
// A witnessed knockout is intentionally a failure case. After caught, exercise only the checkpoint input;
// the successful routes above, rather than this isolated post-failure check, establish ghost traversal.
test('Hotel lobby: witnessed walking knockout leaves no attendant; isolated B input after caught gives the right message',()=>{const c=hotel.checkpoints[0],S=setup(c),r=routes.lobbyKnockout;
 assert.equal(S.d.noise(r.distractChief)?.id,'security_chief');assert.equal(S.d.noise(r.distractAttendant)?.id,c.guardId);wait(S,r.waitSeconds);behind(S,c.guardId);S.hold('KeyF',rules.m3.koSeconds+prior.simulation.holdSlackSeconds);assert.equal(S.npc(c.guardId).life,'unconscious');
 const path=nav.find(S.p,line(c));assert.ok(path);for(const q of path)go(S,q);assert.equal(S.flow.outcome?.reason,'caught');assert.equal(computeResult(scoring,S.ledger.counts,S.c.elapsed,false).ghost,false);assert.ok(S.ledger.count('spotted')>0);
 S.m4.step(prior.simulation.step,{...S.p,disguise:S.m4.disguise},S.heading,new Set(['KeyB']));assert.equal(S.m4.action,null);assert.deepEqual(S.m4.notices,['検査担当の警備員が近くにいません。']);assert.equal(S.m4.stats.frisks,0);assert.equal(S.d.npcs.length,hotel.npcs.length);
});

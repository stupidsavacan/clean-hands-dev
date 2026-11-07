import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {game,hotel,rules,scoring} from '../../investigation/ghost-sim.ts';
import {walk,wait,safeJump,takeOutfit,behind,hide} from '../../investigation/ghost-walk.ts';
import {permission,zoneAt} from '../src/ai.ts';import {computeResult} from '../src/score.ts';
const fieldRoutes=JSON.parse(readFileSync(new URL('../../investigation/playtest2-field.routes.json',import.meta.url),'utf8'));
const routes=JSON.parse(readFileSync(new URL('../../investigation/ghost-walk.routes.json',import.meta.url),'utf8')),point=(id:string)=>routes.points[id];
for(const method of ['glass','private'])test(`Playtest 2: A1 ${method} walks past the accepting head waiter after 19:00`,()=>{
 const S=game();S.p={...S.p,...fieldRoutes.a1Start};S.hear('bar_sommelier_late');walk(S,fieldRoutes.a1Wait);safeJump(S,routes.timing.safeJump_300);
 assert.ok(S.until(()=>S.npc('sommelier').scheduleAction==='wait'&&!S.npc('sommelier').scheduleTarget,routes.simulation.scheduleTimeout));
 behind(S,'sommelier');S.hold('KeyF',rules.m3.koSeconds+routes.simulation.holdSlackSeconds);assert.equal(S.npc('sommelier').life,'unconscious');S.hold('KeyE',routes.simulation.step);assert.equal(S.m3.dragged,S.npc('sommelier'));walk(S,fieldRoutes.a1HideApproach);S.hold('KeyE',rules.m3.hideSeconds+routes.simulation.holdSlackSeconds);assert.equal(S.npc('sommelier').bodyMode,'hidden');S.hold('KeyT',rules.m4.changeSeconds+routes.simulation.holdSlackSeconds);assert.equal(S.m4.disguise,'sommelier');walk(S,point('route_06'));S.tick(new Set(['KeyJ']));assert.equal(S.npc('head_waiter').scriptedAction,'chat');S.hold('KeyJ',rules.m53.talkSeconds+routes.simulation.holdSlackSeconds);assert.ok(S.f.cellarKey);
 walk(S,point('route_07'));safeJump(S,routes.timing.safeJump_1140);assert.ok(S.until(()=>S.npc('wine_merchant').scheduleAction==='tasting'&&!S.npc('wine_merchant').scheduleTarget,routes.simulation.scheduleTimeout));
 walk(S,point('route_06'));wait(S,rules.m53.scriptedGraceSeconds*2);assert.equal(S.npc('head_waiter').face,0);assert.equal(S.npc('head_waiter').scriptedImmune,true);walk(S,hotel.m53.glass.approach);
 if(method==='glass')S.hold('KeyE',rules.m53.serveSeconds+routes.simulation.holdSlackSeconds);
 else{S.hold('KeyJ',rules.m53.inviteSeconds+routes.simulation.holdSlackSeconds);assert.ok(S.f.invited);assert.ok(S.until(()=>!S.npc('wine_merchant').scheduleTarget,routes.simulation.scheduleTimeout));behind(S,'wine_merchant');S.hold('KeyX',rules.m3.killSeconds+routes.simulation.holdSlackSeconds);}
 wait(S,routes.simulation.reactionSeconds);assert.equal(S.npc('wine_merchant').life,'dead');assert.equal(S.f.chances.states.get('a1').status,'complete');assert.deepEqual([...S.d.compromised],[]);assert.deepEqual(S.spottedBy,[]);assert.equal(S.flow.outcome,null);const result=computeResult(scoring,S.ledger.counts,S.c.elapsed,true);assert.equal(result.ghost,true,JSON.stringify(result));
 // Acceptance does not conceal an outfit that somebody else has identified.
 S.d.compromised.add('sommelier');const host=S.npc('head_waiter');host.visibility=1;host.distance=1;host.think(routes.simulation.step,{...S.p,disguise:'sommelier'},0,0,S.d.rules);assert.equal(host.suspicion,100);
});

test('Playtest 2: a fisher outfit permits only the harbor staff zone',()=>{
 const S=game({poison:false});S.p={...S.p,...point('route_02')};walk(S,S.m4.clothes.find((c:any)=>c.disguise==='beachbar').pos);S.hold('KeyT',rules.m4.changeSeconds+routes.simulation.holdSlackSeconds);walk(S,point('route_03'));walk(S,point('route_04'));const fisher=S.m4.clothes.find((c:any)=>c.disguise==='fisher');walk(S,{...fisher.pos,x:fisher.pos.x+fieldRoutes.fisherPickupOffset.x,z:fisher.pos.z+fieldRoutes.fisherPickupOffset.z});S.hold('KeyT',rules.m4.changeSeconds+routes.simulation.holdSlackSeconds);assert.equal(S.m4.disguise,'fisher',JSON.stringify({p:S.p,source:S.m4.source(S.p)?.id,notices:S.m4.notices,flow:S.flow.outcome,compromised:[...S.d.compromised],counts:[...S.ledger.counts]}));const harbor=zoneAt(hotel.zones,S.p.x,S.p.z,S.p.floor);assert.equal(harbor?.id,'ZONE_staff_harbor');assert.equal(permission(S.d.rules,S.m4.disguise,harbor),'allow');
 const kitchen=hotel.zones.find((z:any)=>z.id.includes('kitchen'));assert.ok(kitchen);assert.equal(permission(S.d.rules,S.m4.disguise,kitchen),'deny');assert.equal(S.flow.outcome,null);assert.equal(computeResult(scoring,S.ledger.counts,S.c.elapsed,true).ghost,true);
});
test('Playtest 2: no guard available reports once then cowers, with a JSON cooldown',()=>{
 const S=game({poison:false}),reports=new Map<string,number[]>();S.e.on((e:any)=>{if(e.type==='witness.reported'&&e.reason==='act'){const list=reports.get(e.id)??[];list.push(e.time);reports.set(e.id,list);}});
 // This regression deliberately removes guards, while retaining every civilian in the real hotel.
 for(const n of S.d.npcs)if(n.guard){n.life='dead';n.deathKind='combat';}
 S.p={...S.p,...point('route_02')};const guest=S.npc('guest_beach_a_3');walk(S,{x:guest.pos.x+Math.sin(guest.heading)*fieldRoutes.guestApproachDistance,y:guest.pos.y,z:guest.pos.z+Math.cos(guest.heading)*fieldRoutes.guestApproachDistance});S.combat.equip('pistol_silenced');S.combat.hand='pistol_silenced';wait(S,fieldRoutes.witnessSeconds);
 assert.ok(reports.size>0);for(const times of reports.values()){assert.equal(times.length,1);for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=S.detection.data.witness.repeatSeconds);}
 assert.ok(S.d.npcs.some((n:any)=>n.state==='flee'&&n.witnessCooldown>0));assert.equal(computeResult(scoring,S.ledger.counts,S.c.elapsed,true).ghost,false,'a witnessed drawn gun is an intentional negative ghost case');
});

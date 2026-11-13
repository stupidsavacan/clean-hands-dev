import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FLASH_DEFAULTS,flashPathClear,flashStrength,flashPosition} from '../src/guard-flash.ts';
import {SCENARIOS,begin,tick,player} from '../src/labs/ai-scenarios.ts';
const wall={minX:-6.2,maxX:-5.8,minY:0,maxY:4,minZ:-12,maxZ:0};
test('flash: walls and closed doors block both the forward line and the arc',()=>{
 const from={x:-12,y:1.5,z:-6},to={x:-1,y:.08,z:-6};assert.ok(flashPathClear([],from,to,1.8));assert.equal(flashPathClear([wall],from,to,1.8),false);
 const ceiling={minX:-20,maxX:20,minY:2,maxY:3,minZ:-20,maxZ:20};assert.equal(flashPathClear([ceiling],from,to,1.8),false);
});
test('flash: distance reduces the effect, a wall blocks it, and the effect expires',()=>{
 const at={x:0,y:.08,z:0};assert.ok(flashStrength([],at,player(0,0),6)>flashStrength([],at,player(4,0),6));assert.equal(flashStrength([],at,player(7,0),6),0);
 assert.equal(flashStrength([{minX:1,maxX:1.2,minY:0,maxY:3,minZ:-2,maxZ:2}],at,player(2,0),6),0);
 const s=SCENARIOS.find(s=>s.id==='flash-camp')!,r=begin(s);let peak=0;for(let i=0;i<1500;i++){tick(s,r);peak=Math.max(peak,r.combat!.flashes.amount(r.time));}assert.ok(peak>0);assert.equal(r.combat!.flashes.amount(r.time),0);
});
test('flash: a door closed during windup cancels the throw without consuming a grenade',()=>{
 const s=SCENARIOS.find(s=>s.id==='flash-camp')!,r=begin(s);while(!r.combat!.flashes.active.length&&r.time<16)tick(s,r);assert.equal(r.combat!.flashes.active.length,1);
 r.director.boxes.push(wall);for(let i=0;i<90;i++)tick(s,r);assert.equal(r.combat!.flashes.thrown,0);assert.equal(r.combat!.flashes.used.size,0);
});
test('flash: a door closed in flight stops the projectile and cannot flash through it',()=>{
 const s=SCENARIOS.find(s=>s.id==='flash-camp')!,r=begin(s);while(!r.combat!.flashes.thrown&&r.time<16)tick(s,r);assert.equal(r.combat!.flashes.thrown,1);r.director.boxes.push(wall);
 for(let i=0;i<160;i++)tick(s,r);assert.equal(r.combat!.flashes.amount(r.time),0);assert.equal(r.combat!.flashes.burst,1);
});
test('flash: a new fight restores one grenade; leaving and rejoining the same fight does not',()=>{
 const s=SCENARIOS.find(s=>s.id==='flash-limit')!,r=begin(s);for(let i=0;i<1400;i++)tick(s,r);const c=r.combat!,n=r.director.npcs[0];assert.equal(c.flashes.used.get(n),1);const fight=c.fight!;
 n.state='search';c.flashes.step(r.player,r.time,fight,c.teams);n.state='combat';c.flashes.step(r.player,r.time+.1,fight,c.teams);assert.equal(c.flashes.used.get(n),1);
 c.flashes.step(r.player,r.time+.2,null,c.teams);c.flashes.step(r.player,r.time+.3,{},c.teams);assert.equal(c.flashes.used.get(n)??0,0);
});
test('flash trajectory has fixed endpoints and never tracks a moving player',()=>{const from={x:0,y:1.5,z:0},to={x:10,y:.08,z:0};assert.deepEqual(flashPosition(from,to,0,FLASH_DEFAULTS.arc),from);assert.deepEqual(flashPosition(from,to,1,FLASH_DEFAULTS.arc),to);});

test('flash: player shots actually sway while affected, then return to the aimed line',()=>{
 const s=SCENARIOS.find(s=>s.id==='flash-camp')!,r=begin(s),c=r.combat!;while(!c.flashes.amount(r.time)&&r.time<18)tick(s,r);assert.ok(c.flashes.amount(r.time)>0);
 const n=r.director.npcs[0],aim={x:n.pos.x,y:n.pos.y+1.65,z:n.pos.z},shot=c.fire(r.player,aim,r.time);assert.ok(shot.fired);assert.ok(Math.abs(shot.to.z-aim.z)>.01);
 c.step(4,r.player,r.time+4);const restored=c.fire(r.player,aim,r.time+4);assert.ok(restored.fired);assert.equal(restored.to.z,aim.z);
});

test('flash: rising from cover uses standing hit height, then returns to cover',()=>{
 const s=SCENARIOS.find(s=>s.id==='flash-camp')!,r=begin(s),c=r.combat!;while(r.time<11.8)tick(s,r);const n=r.director.npcs[0];assert.ok(n.tactic);n.tactic.phase='hide';n.tactic.t=5;n.posture='cover';
 while(!c.flashes.active.length&&r.time<16)tick(s,r);assert.ok(c.flashes.active.length);assert.ok(n.flashThrowCover);assert.equal(n.posture,'stand');while(c.flashes.preparing(n,r.time))tick(s,r);tick(s,r);assert.equal(n.posture,'cover');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import hotel from '../src/data/hotel.json' with {type:'json'};
import rules from '../src/data/rules.json' with {type:'json'};
import {Director,type Mission,type PlayerView,type Rules} from '../src/ai.ts';
import {M3System} from '../src/m3.ts';
import {DetectionSystem} from '../src/detection.ts';
import detectionData from '../src/data/detection.json' with {type:'json'};
import {MissionEvents} from '../src/events.ts';
import type {IncidentEvent} from '../src/incidents.ts';
import {NavGrid} from '../src/nav.ts';
import {CollisionWorld} from '../src/world.ts';
import {sightBoxes} from '../src/sight.ts';
import {sampleRescueMotion,restingMotion} from '../src/motion.ts';

function setup(){
 const level={...hotel,npcs:[
  {id:'body',role:'guest',label:'body',floor:0,route:[[-40,-30]]},
  {id:'first',role:'guard',label:'first',floor:0,route:[[-43,-30]],look:[-40,-30]},
  {id:'second',role:'guard',label:'second',floor:0,route:[[-45,-30]],look:[-40,-30]},
  {id:'guest',role:'guest',label:'guest',floor:0,route:[[-40,-34]],look:[-40,-30]},
 ]} as Mission;
 const world=new CollisionWorld(level),director=new Director(level,world,new NavGrid(world),sightBoxes(level),structuredClone(rules) as Rules);
 const m3=new M3System(director,[],rules.m3),[body,first,second,guest]=director.npcs;
 const detection=new DetectionSystem(director,new MissionEvents(),m3.hotel,[],detectionData);
 const player:PlayerView={x:-49,y:0,z:-33,floor:0,hidden:true,speed:0,running:false,crouched:false,tampering:false,disguise:'suit'};
 m3.down(body,'ko');body.fall=1;
 function tick(){m3.step(1/60,player,0,new Set());director.step(1/60,player);detection.step(1/60,player,{illegal:false,carrying:false,trespass:false},m3.elapsed,false,false);}
 function until(done:()=>boolean){for(let i=0;i<1200&&!done();i++)tick();assert.ok(done());}
 return {m3,body,first,second,guest,tick,until};
}

test('A04–A08: one guard rescues a discovered unconscious person, whose knowledge survives',()=>{
 const {m3,body,first,second,until}=setup();
 body.knownDisguises.add('suit');body.learn({eventType:'sighting',confirmedActor:true,confidence:1,observedAt:0});
 until(()=>m3.rescue.playing.length>0);
 assert.equal(m3.rescue.playing.length,1);
 assert.equal(m3.rescue.playing[0].guard,first);
 assert.equal(second.state,'investigate');
 until(()=>body.active);
 assert.equal(body.state,'patrol');
 assert.equal(body.fall,0);
 assert.equal(body.knowledge.length,1);
 assert.ok(body.hasConfirmedIdentity({disguise:'suit'}));
 assert.equal(m3.hotel.level,0);
});

test('A09: another guard takes over if the rescuer is knocked out, and moving the body interrupts the job',()=>{
 const {m3,body,first,second,until,tick}=setup();
 const records:IncidentEvent[]=[];
 m3.director.incidents.onEvent=e=>{if(e.subject===body.id+':unconscious')records.push(e);};
 until(()=>m3.rescue.playing[0]?.guard===first);
 m3.down(first,'ko');
 until(()=>m3.rescue.playing.some(r=>r.body===body&&r.guard===second));
 body.bodyMode='dragged';
 tick();
 assert.ok(!m3.rescue.playing.some(r=>r.body===body));
 for(let i=0;i<200;i++)tick();
 assert.equal(body.life,'unconscious');
 assert.equal(new Set(records.map(e=>e.incidentId)).size,1);
 assert.deepEqual(records.filter(e=>['assigned','released','cancelled'].includes(e.phase)).map(e=>[e.phase,e.actor]),[
  ['assigned','first'],['released','first'],['assigned','second'],['cancelled','second'],
 ]);
});

test('E05: the same person can be found again after being rescued, as a new incident',()=>{
 const {m3,body,first,until}=setup();
 const discovered:number[]=[];
 m3.director.incidents.onEvent=e=>{if(e.subject===body.id+':unconscious'&&e.phase==='noticed'&&e.actor===first.id)discovered.push(e.incidentId);};
 let calls=0;m3.onFound=(who)=>{if(who===body)calls++;};
 until(()=>body.active);
 first.heading=Math.atan2(body.pos.x-first.pos.x,body.pos.z-first.pos.z);
 m3.down(body,'ko');body.fall=1;
 m3.discover();m3.discover();
 assert.equal(calls,2);
 assert.equal(new Set(discovered).size,2);
});

test('dead and hidden bodies cannot be revived',()=>{
 const {m3,body,tick}=setup();
 body.bodyMode='hidden';
 for(let i=0;i<240;i++)tick();
 assert.equal(body.life,'unconscious');
 body.bodyMode='ground';body.life='dead';
 for(let i=0;i<240;i++)tick();
 assert.equal(body.life,'dead');
 assert.equal(m3.rescue.playing.length,0);
});

test('a civilian reports the unconscious person without identifying the player or raising the murder alert',()=>{
 const {m3,body,first,second,guest,until}=setup();
 first.heading=-Math.PI/2;
 second.life='dead';second.bodyMode='hidden';
 guest.pos={x:-43,y:0,z:-29.4};
 guest.heading=Math.atan2(body.pos.x-guest.pos.x,body.pos.z-guest.pos.z);
 until(()=>first.state==='investigate');
 assert.equal(first.evidenceGoal?.x,body.pos.x);
 assert.equal(first.knowledge.at(-1)?.sourceNpcId,guest.id);
 assert.equal(first.knowledge.at(-1)?.confirmedActor,false);
 assert.equal(typeof first.knowledge.at(-1)?.incidentId,'number');
 assert.equal(m3.hotel.level,0);
});

test('G06: the rescue starts from the resting pose and finishes with both people upright',()=>{
 assert.deepEqual(sampleRescueMotion('receiver',0),restingMotion());
 assert.equal(sampleRescueMotion('receiver',1).root.pitch,0);
 assert.ok(sampleRescueMotion('giver',.4).root.y<-.2);
 assert.deepEqual(sampleRescueMotion('giver',0),sampleRescueMotion('giver',1));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Locomotion,SHIN,THIGH,solveLeg,type Pose} from '../src/locomotion.ts';
// Forward kinematics of the leg chain back to the ankle (relative to the hip's ground point).
const ankle=(p:Pose,i:number)=>{const l=p.legs[i];return {z:-(THIGH*Math.sin(l.thigh)+SHIN*Math.sin(l.thigh+l.knee)),y:p.hip-(THIGH*Math.cos(l.thigh)+SHIN*Math.cos(l.thigh+l.knee))};};
function simulate(speed:number,crouch:number,seconds=4,dt=1/60){const loco=new Locomotion();let body=0;const frames:{body:number;pose:Pose}[]=[];for(let t=0;t<seconds;t+=dt){body+=speed*dt;frames.push({body,pose:loco.update(dt,{speed,crouch,slope:0,turn:0,distance:speed*dt})});}return frames.slice(Math.round(1.5/dt));}
test('IK reaches a reachable ankle target exactly',()=>{for(const [z,drop] of [[.3,.7],[-.45,.62],[0,.5],[.1,.79]]){const s=solveLeg(z,drop);const az=-(THIGH*Math.sin(s.thigh)+SHIN*Math.sin(s.thigh+s.knee)),ay=THIGH*Math.cos(s.thigh)+SHIN*Math.cos(s.thigh+s.knee);assert.ok(Math.abs(az-z)<1e-9&&Math.abs(ay-drop)<1e-9);assert.ok(s.knee>=0);}});
for(const [name,speed,crouch] of [['walk',1.65,0],['run',4.8,0],['crouch walk',1.2,1]] as [string,number,number][])test(`${name}: planted feet do not slide or sink`,()=>{const frames=simulate(speed,crouch,8);let worst=0,sink=0,stanceFrames=0;for(let i=1;i<frames.length;i++)for(const leg of [0,1]){const a=frames[i],b=frames[i-1];if(!a.pose.legs[leg].stance||!b.pose.legs[leg].stance||a.pose.legs[leg].ankle.y>.004)continue;stanceFrames++;worst=Math.max(worst,Math.abs(a.body+ankle(a.pose,leg).z-b.body-ankle(b.pose,leg).z));sink=Math.max(sink,Math.abs(ankle(a.pose,leg).y-a.pose.legs[leg].ankle.y));}
 assert.ok(stanceFrames>50);assert.ok(worst<.006,`slip ${worst.toFixed(4)} m/frame`);assert.ok(sink<.012,`contact error ${sink.toFixed(4)} m`);});
test('gait has walk-like cadence and run has a flight phase',()=>{const walk=simulate(1.65,0,12),run=simulate(4.8,0,12);const cycles=(f:typeof walk)=>{let n=0;for(let i=1;i<f.length;i++)if(f[i].pose.phase<f[i-1].pose.phase)n++;return n/(f.length/60);};
 const w=cycles(walk),r=cycles(run);assert.ok(w>1.05&&w<1.4,`walk ${w}`);assert.ok(r>1.7&&r<2.3,`run ${r}`);assert.ok(run.some(f=>!f.pose.legs[0].stance&&!f.pose.legs[1].stance));assert.ok(walk.every(f=>f.pose.legs[0].stance||f.pose.legs[1].stance));});
test('hip height moves smoothly (no drop when a foot lands) and knees really bend',()=>{for(const [speed,crouch,stanceMin,swingMin] of [[1.65,0,.25,1.1],[4.8,0,.3,1.7],[1.2,1,1.2,1.6]]){const f=simulate(speed,crouch);let jerk=0,stance=9,swing=0,mid=0;for(const x of f)for(const l of x.pose.legs)if(l.stance&&Math.abs(l.ankle.z)<.05)mid=Math.max(mid,l.knee);for(let i=2;i<f.length;i++)jerk=Math.max(jerk,Math.abs(f[i].pose.hip-2*f[i-1].pose.hip+f[i-2].pose.hip));for(const x of f)for(const l of x.pose.legs){if(l.stance)stance=Math.min(stance,l.knee);else swing=Math.max(swing,l.knee);}
 assert.ok(jerk<(speed>3?.01:.006),`hip jerk ${jerk.toFixed(4)} at ${speed}`);if(speed===1.65)assert.ok(mid<.38,`mid-stance knee ${mid}`);assert.ok(swing>swingMin,`swing knee ${swing} at ${speed}`);void stanceMin;void stance;}});
test('crouch lowers the hips and idle settles to a near-straight stance',()=>{const idle=simulate(0,0).at(-1)!.pose,crouch=simulate(0,1).at(-1)!.pose;assert.ok(idle.hip>.77);assert.ok(crouch.hip<.65);assert.ok(Math.min(...idle.legs.map(l=>l.knee))<.3&&idle.legs.every(l=>Math.abs(l.thigh)<.35));
 for(const f of [...simulate(4.8,0),...simulate(1.2,1)])for(const v of Object.values(f.pose).flatMap(x=>typeof x==='number'?[x]:[]))assert.ok(Number.isFinite(v));});
test('on stairs, planted feet stand on the drawn treads rather than sinking to the ramp',()=>{
 // Body climbs the collision ramp (3.5 m over 8 m); treads are 32 steps of 0.25 m.
 const tread=(z:number)=>z<=0?0:z>=8?3.5:(Math.floor(z/.25)+1)*3.5/32,ramp=(z:number)=>Math.min(3.5,Math.max(0,z*3.5/8));
 const loco=new Locomotion();let body=-1,worst=0,frames=0;const dt=1/60,v=1.65;
 for(let i=0;i<400;i++){body+=v*dt;const base=ramp(body),p=loco.update(dt,{speed:v,crouch:0,slope:.4375,turn:0,distance:v*dt,ground:z=>tread(body+z)-base});
  if(body<1.5||body>6.5)continue;for(const leg of [0,1]){const l=p.legs[leg];if(!l.stance||l.ankle.y-(tread(body+l.ankle.z)-base)>.004)continue;frames++;worst=Math.max(worst,Math.abs(ankle(p,leg).y-l.ankle.y));}}
 assert.ok(frames>40);assert.ok(worst<.015,`foot off tread by ${worst.toFixed(3)} m`);});
test('stopping keeps the planted foot in place and brings the feet together one at a time',()=>{const loco=new Locomotion(),dt=1/60;let p!:Pose;for(let i=0;i<150;i++)p=loco.update(dt,{speed:1.65,crouch:0,slope:0,turn:0,distance:1.65*dt});
 const planted=p.legs.findIndex(l=>l.stance&&l.ankle.y<.004),start=p.legs[planted].ankle.z;let speed=1.65,moved=0;const frames:Pose[]=[];
 for(let i=0;i<45;i++){speed=Math.max(0,speed-22*dt);p=loco.update(dt,{speed,crouch:0,slope:0,turn:0,distance:speed*dt});frames.push(p);}
 // While the body decelerates the planted foot only moves back by the distance travelled (~6 cm), then waits its turn.
 for(const f of frames.slice(0,6))moved=Math.max(moved,Math.abs(f.legs[planted].ankle.z-start));assert.ok(moved<.1,`planted foot slid ${moved}`);
 const end=frames.at(-1)!;assert.ok(end.legs.every(l=>Math.abs(l.ankle.z)<.1),'feet settle near the hips');});
test('crouching still is a low lunge: hips low, left foot ahead, right foot behind on its toes, feet above ground',()=>{
 const p=simulate(0,1,6).at(-1)!.pose;assert.ok(p.hip<.5,`hip ${p.hip}`);assert.ok(p.legs[0].ankle.z>p.legs[1].ankle.z+.25,'staggered');assert.ok(p.legs[1].ankle.y>p.legs[0].ankle.y+.02,'rear heel up');
 for(const l of p.legs){assert.ok(l.ankle.y>=-1e-6);assert.ok(Number.isFinite(l.knee)&&l.knee<2.6);}assert.ok(p.arms[0].swing<p.arms[1].swing-.6,'left arm reaches forward');});

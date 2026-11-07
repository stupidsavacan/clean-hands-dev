// What: leg angles of the walking pose on the hotel stairs, using the game's Locomotion and the same visual ground as
// main.ts (treads drawn in 32 steps; plates elsewhere). Why: playtest 2026-11-02 screenshot, legs at extreme angles on
// the grand stairs (player and NPCs). Run: in app, node --experimental-strip-types --no-warnings ../investigation/stairs-legs.ts
import {readFileSync} from 'node:fs';
import {Locomotion} from '../app/src/locomotion.ts';
import {inside,stairProgress,stairY} from '../app/src/world.ts';
const map=JSON.parse(readFileSync(new URL('../app/src/data/hotel.json',import.meta.url),'utf8'));const STAIR_STEPS=32;
function visualGround(x:number,z:number,baseY:number){for(const st of map.stairs){if(!inside(st,x,z))continue;const k=Math.min(STAIR_STEPS-1,Math.floor(stairProgress(st,x,z)*STAIR_STEPS)),y=st.low+(k+1)*(st.high-st.low)/STAIR_STEPS;if(Math.abs(y-baseY)<1.2)return y;}
 let best=0,gap=Math.abs(baseY);for(const f of map.floors){const d=Math.abs(f.y-baseY);if(d<gap&&f.areas.some((a:any)=>x>=a.minX&&x<=a.maxX&&z>=a.minZ&&z<=a.maxZ)){best=f.y;gap=d;}}return best;}
const st=map.stairs.find((s:any)=>s.id==='stairs-grand');
const bodyY=(z:number)=>z<st.minZ?st.high:z>st.maxZ?st.low:stairY(st,8,z);
// Per walk: the worst knee and thigh (degrees), the share of frames on the flight with a knee past 100 degrees (a
// person climbing stairs rarely bends more), a foot target within 0.3 m below the hip, and the lowest hip.
for(const speed of [1.4,2.4,4.2])for(const dir of [-1,1]){const loco=new Locomotion();let z=dir<0?-1:-15,knee=0,thigh=0,bent=0,n=0,high=0,hip=9;const h=dir<0?Math.PI:0;
 for(let t=0;t<14/speed;t+=1/60){z+=dir*speed/60;const y=bodyY(z),ground=(q:number)=>visualGround(8,z+Math.cos(h)*q,y)-y;
  const pose=loco.update(1/60,{speed,crouch:0,slope:0,turn:0,distance:speed/60,ground,actual:speed});if(z>-4.5||z<-11.5)continue;n++;hip=Math.min(hip,pose.hip);
  let k=0;for(const l of pose.legs){k=Math.max(k,l.knee);thigh=Math.max(thigh,Math.abs(l.thigh));if(pose.hip-l.ankle.y<.3)high++;}knee=Math.max(knee,k);if(k>Math.PI*100/180)bent++;}
 const deg=(r:number)=>Math.round(r*180/Math.PI);console.log(JSON.stringify({speed,dir:dir<0?'up':'down',knee:deg(knee),thigh:deg(thigh),over100:+(bent/n).toFixed(2),footNearHip:high,lowestHip:+hip.toFixed(2)}));}
// The probe under the stairwell from the 2F landing beside it.
console.log(JSON.stringify({beside2F:visualGround(8,-3.6,3.5),stairwellFrom2F:visualGround(8,-4.4,3.5)}));

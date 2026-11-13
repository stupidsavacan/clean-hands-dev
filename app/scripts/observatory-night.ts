// Print how one night at the observatory plays out with nobody touching anything (2026-11-13):
//   node --experimental-strip-types --no-warnings scripts/observatory-night.ts
// Use it after changing src/data/observatory-systems.json to see the strikes, the outage, shedding and room temperatures.
import {ObservatoryWorld,type SystemsDef} from '../src/observatory/world.ts';
import def from '../src/data/observatory-systems.json' with {type:'json'};

const w=new ObservatoryWorld(def as unknown as SystemsDef);
console.log('strikes:',w.weather.strikes.map(s=>Math.round(s.time)+s.kind[0]).join(' '));
for(let i=0;i<1800*10;i++){
 w.step(.1,()=>false);
 for(const e of w.drain())if(e.type!=='strike'&&e.type!=='rod.grounded')console.log(Math.round(e.time),e.type,e.id??'');
 if(i%1500===0){
  const s=w.snapshot();
  console.log(String(Math.round(s.time)).padStart(5),'front',s.weather.front.toFixed(2),'src',s.power.source,'load',s.power.load,'slit',s.slit,
   'lobby',s.air.lobby.temp,'obs',s.air.obs.temp,'staff',s.air.staffroom.temp,'lounge',s.air.lounge.temp,'heaters',s.heaters.join());
 }
}
console.log('power:',w.grid.events.map(e=>Math.round(e.time)+' '+e.type+(e.id?':'+e.id:'')).join(' | '));

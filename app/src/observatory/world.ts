// The observatory's world state (2026-11-13): the storm, the electricity and the air, plus the few machines that tie
// them together (the nitrogen valve, the oxygen monitor, the detector's cooler, the dome's shutter, the lightning rod,
// portable heaters). It is stepped with the mission clock and knows nothing about NPCs or drawing: the mission script
// reads it to move people, the page reads it to draw and to play sound, and tests run it alone.
import {Weather,type Strike,type WeatherDef} from '../sim/weather.ts';
import {Grid,type PowerDef} from '../sim/power.ts';
import {Air,type AirDef} from '../sim/air.ts';

export type SystemsDef={
 weather:WeatherDef;power:PowerDef;air:AirDef;
 /** Which rooms each lighting circuit lights. */
 lights:Record<string,string[]>;
 /** How far people see (0..1 of normal) in an unlit room, under emergency lights, outdoors in the storm. */
 sight:{dark:number;emergency:number;stormOutdoor:number;outdoorDark:number};
 nitrogen:{room:string;flow:number;gas:number;chill:number};
 oxygen:{alarm:number;dizzy:number;collapse:number;collapseSeconds:number;deathSeconds:number;playerDamage:number};
 detector:{cold:number;warmRate:number;coolRate:number;alarm:number};
 dome:{motorSeconds:number;crankSeconds:number;motorKw:number;skyFlow:number;lullBelow:number;wetRain:number;overrideSeconds:number};
 heaters:{rooms:string[];kw:number;onBelow:number;offAbove:number;circuit:string};
 comfort:{cold:number;warmRoom:string};
 surge:{trips:string[]};
};
export type WorldEvent={time:number;type:'strike'|'rod.grounded'|'rod.live'|'line.struck'|'o2.alarm'|'o2.clear'|'detector.alarm'|'detector.ok'|'dome.wet'|'dome.dry'|'dome.opening'|'dome.closing'|'heater.on'|'heater.off'|'nitrogen.empty';id?:string;strike?:Strike};

export class ObservatoryWorld{
 readonly def:SystemsDef;
 readonly weather:Weather;readonly grid:Grid;readonly air:Air;
 time=0;
 // The liquid nitrogen valve in the cryo lab and the gas left in the tank (m³ of gas).
 valveOpen=false;gasLeft:number;
 /** The oxygen monitor's cable: pulled, it never sounds. */
 sensorConnected=true;
 o2Alarm=false;
 /** The detector's temperature (°C): it warms up when its cooler has no power. */
 detectorTemp:number;detectorAlarm=false;
 /** The dome's shutter: 0 closed .. 1 open, and where it is told to go. */
 slit=0;slitTarget=0;
 /** Someone told the shutter to open from the console; it stays so until this time. */
 overrideUntil=-Infinity;
 /** Rain is coming in on the telescope. */
 domeWet=false;
 /** The lightning rod's earth cable. */
 groundCable=true;
 /** When lightning last made the catwalk live (-Infinity: never). */
 rodLiveAt=-Infinity;
 readonly heatersOn=new Set<string>();
 /** How many heaters people dare to run at once: one fewer after they have blown the breaker. */
 heaterLimit=3;
 /** Rooms someone is in (the script fills it): heaters are only switched on by people. */
 occupied:(room:string)=>boolean=()=>true;
 private cranking=0;
 readonly events:WorldEvent[]=[];
 constructor(def:SystemsDef){
  this.def=def;this.weather=new Weather(def.weather);this.grid=new Grid(def.power);this.air=new Air(def.air);
  this.gasLeft=def.nitrogen.gas;this.detectorTemp=def.detector.cold;
 }
 private emit(type:WorldEvent['type'],extra:Partial<WorldEvent>={}){this.events.push({time:this.time,type,...extra});}
 /** Events since the last call. */
 drain(){return this.events.splice(0);}
 /** Someone turns the hand crank on the catwalk this step (it moves the shutter toward closed). */
 crank(){this.cranking=2;}
 /** The console's manual override: open the shutter now. */
 overrideOpen(){this.overrideUntil=this.time+this.def.dome.overrideSeconds;}
 step(dt:number,doorOpen:(door:string)=>boolean){
  this.time+=dt;
  const d=this.def,t=this.time,g=this.grid,w=this.weather.at(t);
  // Lightning.
  for(const s of this.weather.step(t)){
   this.emit('strike',{strike:s});
   if(s.kind==='line'){g.strikeLine();this.emit('line.struck');}
   else if(s.kind==='rod'){
    if(this.groundCable)this.emit('rod.grounded');
    else{
     // With the earth cable off, the current finds its way through the dome's steel and its wiring.
     this.rodLiveAt=t;this.emit('rod.live');
     for(const id of d.surge.trips){const b=g.breakers.get(id)!;if(b.closed){b.closed=false;b.tripped=true;g.events.push({time:g.time,type:'breaker.tripped',id});}}
    }
   }
  }
  // The dome's shutter: the observers open it in the lull to test, and close it when the storm comes back.
  const want=t<this.overrideUntil||this.weather.front(t)<d.dome.lullBelow?1:0;
  if(want!==this.slitTarget&&g.powered('it')){this.slitTarget=want;this.emit(want?'dome.opening':'dome.closing');}
  const moving=this.slit!==this.slitTarget&&g.powered('dome');
  g.extra.set('dome',moving?d.dome.motorKw:0);
  if(moving){
   const step=dt/d.dome.motorSeconds;
   this.slit=this.slitTarget>this.slit?Math.min(this.slitTarget,this.slit+step):Math.max(this.slitTarget,this.slit-step);
  }else if(this.cranking>0)this.slit=Math.max(0,this.slit-dt/d.dome.crankSeconds);
  this.cranking=Math.max(0,this.cranking-1);
  const wet=this.slit>.15&&w.rain>d.dome.wetRain;
  if(wet!==this.domeWet){this.domeWet=wet;this.emit(wet?'dome.wet':'dome.dry');}
  // Portable heaters: people switch them on in a cold room and off in a warm one. No power, no heat.
  const h=d.heaters;
  if(g.breakers.get(h.circuit)!.tripped&&this.heatersOn.size){this.heaterLimit=Math.max(1,this.heatersOn.size-1);for(const id of [...this.heatersOn]){this.heatersOn.delete(id);this.emit('heater.off',{id});}}
  for(const room of h.rooms){
   const temp=this.air.room(room).temp,on=this.heatersOn.has(room);
   if(!on&&temp<h.onBelow&&this.heatersOn.size<this.heaterLimit&&this.occupied(room)&&g.powered(h.circuit)){this.heatersOn.add(room);this.emit('heater.on',{id:room});}
   else if(on&&temp>h.offAbove){this.heatersOn.delete(room);this.emit('heater.off',{id:room});}
  }
  g.extra.set(h.circuit,this.heatersOn.size*h.kw);
  g.step(dt);
  // The detector's cooler only works while it has power.
  const cooled=g.powered('compressor');
  this.detectorTemp=cooled?Math.max(d.detector.cold,this.detectorTemp-d.detector.coolRate*dt):Math.min(15,this.detectorTemp+d.detector.warmRate*dt);
  const warm=this.detectorTemp>d.detector.alarm;
  if(warm!==this.detectorAlarm){this.detectorAlarm=warm;this.emit(warm?'detector.alarm':'detector.ok');}
  // The air.
  const venting=this.valveOpen&&this.gasLeft>0;
  if(venting){this.gasLeft=Math.max(0,this.gasLeft-d.nitrogen.flow*dt);if(!this.gasLeft)this.emit('nitrogen.empty');}
  const heaters=g.powered(h.circuit)?Object.fromEntries([...this.heatersOn].map(r=>[r,h.kw])):{};
  this.air.step(dt,{outdoorTemp:w.outdoorTemp,ventilation:g.powered('ventilation'),heating:g.powered('heating'),doorOpen,
   sources:venting?[{room:d.nitrogen.room,flow:d.nitrogen.flow,chill:d.nitrogen.chill}]:[],heaters,open:this.slit>0?{obs:this.slit*d.dome.skyFlow}:{}});
  // The oxygen monitor needs its cable and power.
  const alarm=this.sensorConnected&&g.powered('safety')&&this.air.room(d.nitrogen.room).o2*100<d.oxygen.alarm;
  if(alarm!==this.o2Alarm){this.o2Alarm=alarm;this.emit(alarm?'o2.alarm':'o2.clear');}
 }
 /** Is the room lit by its ceiling lights. */
 lit(room:string){
  const circuit=Object.entries(this.def.lights).find(([,rooms])=>rooms.includes(room))?.[0];
  return circuit?this.grid.powered(circuit):true;
 }
 /** How far people in a room see now (0..1 of normal). Lightning lights everything for a moment. */
 sight(room:string,outdoor:boolean){
  const s=this.def.sight,flash=this.weather.flash(this.time);
  const base=outdoor?(this.lit(room)?1:s.outdoorDark)*(1-(1-s.stormOutdoor)*this.weather.at(this.time).rain)
   :this.lit(room)?1:this.grid.powered('safety')?s.emergency:s.dark;
  return base+(1-base)*flash;
 }
 /** How much of the normal hearing distance is left. */
 hearing(outdoor:boolean){return this.weather.hearing(this.time,outdoor);}
 /** Is the catwalk's steel carrying a lightning strike right now. */
 get catwalkLive(){return this.time-this.rodLiveAt<.6;}
 snapshot(){
  const w=this.weather.at(this.time),next=this.weather.next(this.time);
  return {time:+this.time.toFixed(1),weather:{...w,front:this.weather.front(this.time),thunder:this.weather.thunder(this.time),next:next&&{in:+(next.time-this.time).toFixed(1),kind:next.kind}},
   power:this.grid.snapshot(),air:this.air.snapshot(),
   valveOpen:this.valveOpen,gasLeft:Math.round(this.gasLeft),sensorConnected:this.sensorConnected,o2Alarm:this.o2Alarm,
   detectorTemp:Math.round(this.detectorTemp),detectorAlarm:this.detectorAlarm,slit:+this.slit.toFixed(2),slitTarget:this.slitTarget,domeWet:this.domeWet,
   groundCable:this.groundCable,heaters:[...this.heatersOn]};
 }
}

// World simulation, part 2 of 3: the building's electricity (2026-11-13).
// One bus fed by the power line or, when that is gone, by a diesel generator; a small battery (UPS) that keeps a few
// circuits alive; and a row of circuits, each behind its own breaker. Pure state and rules: no three.js, no NPCs.
//
// The rules, in the order they are applied each step:
//  1. The line is live unless it was struck (it comes back by itself after a while) or cut by hand.
//  2. Without the line the generator starts after a delay, if it is in automatic, has fuel and has not tripped.
//  3. On the generator the building management system (BMS) switches off ("sheds") the least important circuits until
//     the load fits. The BMS is itself a circuit: with it dead nothing is shed.
//  4. A generator that carries more than it can for a few seconds trips. Someone has to restart it by hand.
//  5. A circuit whose load is over its breaker's rating for a few seconds trips its breaker.
//  6. Battery-backed circuits run from the UPS when the bus is dead, until it is empty. It recharges on a live bus.

export type CircuitDef={
 id:string;label:string;
 /** Normal load in kW. */
 kw:number;
 /** The breaker trips above this (kW). Without it, never. */
 rating?:number;
 /** Shed order on the generator: the highest number goes first; 0 is never shed. */
 shed:number;
 /** Kept alive by the UPS. */
 ups?:boolean;
};
export type PowerDef={
 circuits:CircuitDef[];
 /** The circuit the building management system runs on. */
 bms:string;
 line:{outageSeconds:number};
 generator:{kw:number;startSeconds:number;fuelSeconds:number;overloadSeconds:number;stopAfterLine:number};
 ups:{seconds:number;rechargeRate:number};
 breakerTripSeconds:number;
};
export type GeneratorState='standby'|'starting'|'running'|'tripped'|'no-fuel';
export type PowerEvent={time:number;type:'line.lost'|'line.back'|'generator.started'|'generator.stopped'|'generator.tripped'|'generator.no-fuel'|'breaker.tripped'|'breaker.opened'|'breaker.closed'|'shed'|'restored'|'ups.empty'|'blackout';id?:string};
type Breaker={closed:boolean;tripped:boolean;over:number};

export class Grid{
 readonly def:PowerDef;
 /** Seconds until the line comes back after a strike (0: it is up). */
 lineDown=0;
 /** The incoming switch was opened by hand: the line stays off until someone closes it. */
 lineCut=false;
 generator:GeneratorState='standby';
 /** The fuel cock: closed, a running generator dies after a few seconds and cannot start. */
 fuelValve=true;
 fuel:number;
 /** Seconds of battery left. */
 ups:number;
 readonly breakers=new Map<string,Breaker>();
 readonly shed=new Set<string>();
 /** Extra load on a circuit in kW (portable heaters, a moving dome). */
 readonly extra=new Map<string,number>();
 /** Circuits whose normal load is not drawn now (a compressor that is idle, a motor that is not moving). */
 readonly idle=new Set<string>();
 readonly events:PowerEvent[]=[];
 time=0;
 private starting=0;private overload=0;private starved=0;private lineBackFor=0;private wasLive=true;
 constructor(def:PowerDef){
  this.def=def;this.fuel=def.generator.fuelSeconds;this.ups=def.ups.seconds;
  for(const c of def.circuits)this.breakers.set(c.id,{closed:true,tripped:false,over:0});
 }
 private emit(type:PowerEvent['type'],id?:string){this.events.push({time:this.time,type,id});if(this.events.length>200)this.events.shift();}
 get lineLive(){return this.lineDown<=0&&!this.lineCut;}
 /** Is the main bus energized. */
 get live(){return this.lineLive||this.generator==='running';}
 get source():'line'|'generator'|'ups'|'none'{
  return this.lineLive?'line':this.generator==='running'?'generator':this.ups>0&&this.def.circuits.some(c=>c.ups&&this.breakers.get(c.id)!.closed)?'ups':'none';
 }
 circuit(id:string){
  const c=this.def.circuits.find(c=>c.id===id);
  if(!c)throw new Error('no circuit '+id);
  return c;
 }
 /** What a circuit draws when it is on (kW). */
 demand(id:string){return (this.idle.has(id)?0:this.circuit(id).kw)+(this.extra.get(id)??0);}
 /** Is this circuit energized now. */
 powered(id:string){
  const b=this.breakers.get(id);
  if(!b?.closed)return false;
  if(this.live&&!this.shed.has(id))return true;
  return !!this.circuit(id).ups&&this.ups>0;
 }
 /** The load on the main bus in kW. */
 get load(){
  let kw=0;
  for(const c of this.def.circuits)if(this.breakers.get(c.id)!.closed&&!this.shed.has(c.id))kw+=this.demand(c.id);
  return kw;
 }
 /** A lightning strike on the line. */
 strikeLine(){if(this.lineDown<=0&&!this.lineCut)this.emit('line.lost');this.lineDown=this.def.line.outageSeconds;}
 cutLine(cut:boolean){
  if(this.lineCut===cut)return;
  const before=this.lineLive;this.lineCut=cut;
  if(before&&!this.lineLive)this.emit('line.lost');
 }
 /** Open or close a breaker by hand. Closing also clears a trip. */
 setBreaker(id:string,closed:boolean){
  const b=this.breakers.get(id);
  if(!b)throw new Error('no breaker '+id);
  if(b.closed===closed&&!b.tripped)return;
  b.closed=closed;b.tripped=false;b.over=0;
  this.emit(closed?'breaker.closed':'breaker.opened',id);
 }
 /** Restart a tripped or stopped generator by hand (it still needs fuel). */
 restartGenerator(){
  if(this.generator==='tripped'||this.generator==='no-fuel'){this.generator='standby';this.overload=0;this.starved=0;}
 }
 step(dt:number){
  this.time+=dt;
  const g=this.def.generator;
  // 1. The line.
  if(this.lineDown>0){this.lineDown=Math.max(0,this.lineDown-dt);if(this.lineDown===0&&!this.lineCut)this.emit('line.back');}
  // 2. The generator.
  if(this.lineLive){
   this.starting=0;
   if(this.generator==='running'){
    this.lineBackFor+=dt;
    if(this.lineBackFor>=g.stopAfterLine){this.generator='standby';this.emit('generator.stopped');}
   }else if(this.generator==='starting')this.generator='standby';
  }else{
   this.lineBackFor=0;
   if(this.generator==='standby'){this.generator='starting';this.starting=0;}
   if(this.generator==='starting'){
    this.starting+=dt;
    if(this.starting>=g.startSeconds){
     if(this.fuelValve&&this.fuel>0){this.generator='running';this.overload=0;this.starved=0;this.emit('generator.started');}
     else{this.generator='no-fuel';this.emit('generator.no-fuel');}
    }
   }
  }
  if(this.generator==='running'){
   this.fuel=Math.max(0,this.fuel-dt);
   // A closed fuel cock starves the engine in a few seconds.
   this.starved=this.fuelValve&&this.fuel>0?0:this.starved+dt;
   if(this.starved>=4){this.generator='no-fuel';this.emit('generator.no-fuel');}
  }
  // 3. Shedding, by the BMS. On the line everything is restored.
  const onGenerator=!this.lineLive&&this.generator==='running';
  if(this.lineLive){
   if(this.shed.size&&this.powered(this.def.bms)){for(const id of this.shed)this.emit('restored',id);this.shed.clear();}
  }else if(onGenerator&&this.powered(this.def.bms)){
   const order=this.def.circuits.filter(c=>c.shed>0&&!this.shed.has(c.id)&&this.breakers.get(c.id)!.closed).sort((a,b)=>b.shed-a.shed);
   while(this.load>g.kw*.95&&order.length){const c=order.shift()!;this.shed.add(c.id);this.emit('shed',c.id);}
  }
  // 4. Generator overload.
  if(onGenerator){
   this.overload=this.load>g.kw?this.overload+dt:Math.max(0,this.overload-dt);
   if(this.overload>=g.overloadSeconds){this.generator='tripped';this.emit('generator.tripped');}
  }
  // 5. Breakers.
  for(const c of this.def.circuits){
   const b=this.breakers.get(c.id)!;
   if(!b.closed||c.rating===undefined||!this.powered(c.id)){b.over=0;continue;}
   b.over=this.demand(c.id)>c.rating?b.over+dt:0;
   if(b.over>=this.def.breakerTripSeconds){b.closed=false;b.tripped=true;b.over=0;this.emit('breaker.tripped',c.id);}
  }
  // 6. The UPS.
  if(this.live)this.ups=Math.min(this.def.ups.seconds,this.ups+dt*this.def.ups.rechargeRate);
  else if(this.ups>0&&this.def.circuits.some(c=>c.ups&&this.breakers.get(c.id)!.closed)){
   this.ups=Math.max(0,this.ups-dt);
   if(this.ups===0)this.emit('ups.empty');
  }
  if(this.wasLive&&!this.live)this.emit('blackout');
  this.wasLive=this.live;
 }
 /** What is wrong now, for whoever repairs things. */
 faults(){
  const out:{kind:'breaker'|'generator'|'fuel'|'line-switch';id:string}[]=[];
  for(const [id,b] of this.breakers)if(!b.closed)out.push({kind:'breaker',id});
  if(this.lineCut)out.push({kind:'line-switch',id:'line'});
  if(!this.fuelValve)out.push({kind:'fuel',id:'fuel'});
  if(this.generator==='tripped'||this.generator==='no-fuel')out.push({kind:'generator',id:'generator'});
  return out;
 }
 snapshot(){
  return {source:this.source,live:this.live,line:this.lineLive,lineDown:Math.ceil(this.lineDown),lineCut:this.lineCut,generator:this.generator,
   fuelValve:this.fuelValve,load:+this.load.toFixed(1),capacity:this.def.generator.kw,ups:Math.round(this.ups),
   circuits:this.def.circuits.map(c=>({id:c.id,label:c.label,on:this.powered(c.id),closed:this.breakers.get(c.id)!.closed,tripped:this.breakers.get(c.id)!.tripped,shed:this.shed.has(c.id),kw:+this.demand(c.id).toFixed(1)}))};
 }
}

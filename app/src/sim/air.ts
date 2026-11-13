// World simulation, part 3 of 3: the air in each room (2026-11-13).
// Every room is one well-mixed box of air with a temperature and an oxygen share. Air moves between rooms through
// doorways (a lot through an open one, a trickle round a closed door), to and from outdoors through the walls, through
// the ventilation while its fans have power, and through anything opened to the sky. Heat comes from the heating
// while it has power and from stoves and portable heaters. A gas let into a room (liquid nitrogen boiling off) pushes
// the oxygen out. Pure state and rules: no three.js, no NPCs, no particular map.

export const NORMAL_O2=.209;

export type RoomAirDef={
 id:string;
 /** m³ of air. */
 volume:number;
 /** Share of the temperature gap to outdoors lost per second through walls and roof. */
 loss:number;
 /** m³/s of fresh air while the ventilation has power. */
 vent:number;
 /** °C per second the central heating adds at most while it has power (0: not heated). */
 heat:number;
 /** Always-on heat that needs no electricity (a wood stove), °C per second at most. */
 stove?:number;
 outdoor?:boolean;
};
export type AirLinkDef={
 id:string;a:string;b:string;
 /** m³/s exchanged when open. */
 flow:number;
 /** m³/s when closed (default: a tenth of a percent of `flow`... given per link for doors). */
 leak?:number;
 /** The door that closes this link (a map door id). Without it the link is always open. */
 door?:string;
};
export type AirDef={
 rooms:RoomAirDef[];links:AirLinkDef[];
 /** The heating aims for this. */
 setpoint:number;
 /** °C per second one kW of portable heater adds to 100 m³. */
 heaterGain:number;
};
export type AirInputs={
 outdoorTemp:number;
 ventilation:boolean;heating:boolean;
 /** Is this door open. */
 doorOpen:(door:string)=>boolean;
 /** Gas let into rooms: m³/s of an oxygen-free gas, and how cold it makes the room (°C per m³). */
 sources?:{room:string;flow:number;chill:number}[];
 /** Portable heaters running now, in kW per room. */
 heaters?:Record<string,number>;
 /** Rooms open to the sky now and how much (m³/s exchanged with outdoors). */
 open?:Record<string,number>;
};
export type RoomAir={temp:number;o2:number};

export class Air{
 readonly def:AirDef;
 readonly rooms=new Map<string,RoomAir>();
 constructor(def:AirDef,start=def.setpoint){
  this.def=def;
  for(const r of def.rooms)this.rooms.set(r.id,{temp:start,o2:NORMAL_O2});
 }
 room(id:string){
  const r=this.rooms.get(id);
  if(!r)throw new Error('no room '+id);
  return r;
 }
 step(dt:number,input:AirInputs){
  // Large flows into small rooms need short steps to stay stable.
  const parts=Math.max(1,Math.ceil(dt/.25));
  for(let i=0;i<parts;i++)this.advance(dt/parts,input);
 }
 private advance(dt:number,input:AirInputs){
  const dTemp=new Map<string,number>(),dO2=new Map<string,number>();
  const add=(m:Map<string,number>,id:string,v:number)=>m.set(id,(m.get(id)??0)+v);
  const volume=new Map(this.def.rooms.map(r=>[r.id,r.volume]));
  for(const l of this.def.links){
   const open=!l.door||input.doorOpen(l.door),q=open?l.flow:l.leak??0;
   if(!q)continue;
   const a=this.room(l.a),b=this.room(l.b),va=volume.get(l.a)!,vb=volume.get(l.b)!;
   // Never move more than a third of the smaller room in one step.
   const moved=Math.min(q*dt,Math.min(va,vb)/3);
   add(dTemp,l.a,moved*(b.temp-a.temp)/va);add(dTemp,l.b,moved*(a.temp-b.temp)/vb);
   add(dO2,l.a,moved*(b.o2-a.o2)/va);add(dO2,l.b,moved*(a.o2-b.o2)/vb);
  }
  for(const r of this.def.rooms){
   const air=this.room(r.id);
   if(r.outdoor){air.temp=input.outdoorTemp;air.o2=NORMAL_O2;continue;}
   let temp=dTemp.get(r.id)??0,o2=dO2.get(r.id)??0;
   temp+=-r.loss*(air.temp-input.outdoorTemp)*dt;
   // Ventilation brings in fresh air; the heating warms it on the way in, so only its oxygen counts while that runs.
   if(input.ventilation&&r.vent){
    const share=Math.min(.5,r.vent*dt/r.volume);
    o2+=share*(NORMAL_O2-air.o2);
    if(!input.heating)temp+=share*(input.outdoorTemp-air.temp);
   }
   const sky=input.open?.[r.id]??0;
   if(sky){const share=Math.min(.5,sky*dt/r.volume);o2+=share*(NORMAL_O2-air.o2);temp+=share*(input.outdoorTemp-air.temp);}
   const warm=(input.heating?r.heat:0)+(r.stove??0);
   if(warm&&air.temp<this.def.setpoint)temp+=Math.min(warm*dt,this.def.setpoint-air.temp);
   const heater=input.heaters?.[r.id]??0;
   if(heater)temp+=heater*this.def.heaterGain*100/r.volume*dt;
   for(const s of input.sources??[])if(s.room===r.id){
    const gas=Math.min(s.flow*dt,r.volume/3);
    // The gas pushes the same amount of mixed air out.
    o2-=gas*air.o2/r.volume;temp-=gas*s.chill/r.volume*100;
   }
   air.temp+=temp;air.o2=Math.max(0,Math.min(NORMAL_O2,air.o2+o2));
  }
 }
 snapshot(){return Object.fromEntries([...this.rooms].map(([id,r])=>[id,{temp:+r.temp.toFixed(1),o2:+(r.o2*100).toFixed(1)}]));}
}

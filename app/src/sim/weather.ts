// World simulation, part 1 of 3: the storm (2026-11-13).
// A storm front passes over the map during the mission. Everything here is a pure function of the mission time and a
// seed, so the same night plays out the same way every time (a player can learn it, a test can replay it), and nothing
// here knows about three.js, NPCs or a particular map.
//
// What the rest of the game reads from it:
//  - intensity / rain / wind: how hard it is storming now (0..1)
//  - strikes: every lightning strike of the night, with what it hits (the lightning rod, the power line, or far away)
//  - thunder(t): how loud the thunder is now (0..1); hearing(t, outdoor) turns that and the rain into "how far sound carries"
//  - flash(t): how bright the lightning is now (0..1), for the picture and for people who could not see in the dark

export type StrikeKind='rod'|'line'|'far';
export type Strike={
 time:number;kind:StrikeKind;
 /** Seconds from the flash to the thunder. */
 delay:number;
 /** Seconds the thunder rolls. */
 rumble:number;
 /** Direction the flash comes from (radians, for the picture). */
 bearing:number;
};
export type WeatherDef={
 seed:number;
 /** The storm's strength over the mission: [seconds, 0..1] points, joined by straight lines. */
 front:[number,number][];
 /** Outdoor temperature in °C when calm and at full storm. */
 temperature:{calm:number;storm:number};
 lightning:{
  /** No lightning below this strength. */
  threshold:number;
  /** Mean seconds between strikes at full strength. */
  meanGap:number;
  /** Never closer together than this. */
  minGap:number;
  /** Chances of what a strike hits (the rest are far away). */
  rod:number;line:number;
  /** The power line is hit at most this many times a night. */
  maxLine:number;
 };
 /** How much of normal hearing distance is left: outdoors in full rain, and during the loudest thunder. */
 hearing:{rain:number;thunder:number;indoorThunder:number};
};

/** Small seeded generator (mulberry32): the same seed gives the same night. */
export function seeded(seed:number){
 let a=seed>>>0;
 return ()=>{
  a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296;
 };
}

const clamp01=(v:number)=>Math.max(0,Math.min(1,v));

export class Weather{
 readonly def:WeatherDef;
 readonly strikes:Strike[];
 private readonly gusts:number[];
 private cursor=0;
 constructor(def:WeatherDef){
  this.def=def;
  const random=seeded(def.seed),end=def.front.at(-1)![0];
  // Gusts: one random value every 4 s, blended smoothly.
  this.gusts=Array.from({length:Math.ceil(end/4)+2},()=>random());
  this.strikes=[];
  const l=def.lightning;
  let lines=0,t=0;
  while(t<end){
   const strength=this.front(t);
   if(strength<l.threshold){t+=2;continue;}
   // The stronger the storm, the shorter the wait (exponential gaps: a Poisson process whose rate follows the storm).
   const scale=(strength-l.threshold)/(1-l.threshold);
   const gap=Math.max(l.minGap,-Math.log(1-random())*l.meanGap/Math.max(.15,scale*scale));
   t+=gap;
   if(t>=end||this.front(t)<l.threshold)continue;
   const pick=random();
   let kind:StrikeKind=pick<l.rod?'rod':pick<l.rod+l.line&&lines<l.maxLine?'line':'far';
   if(kind==='line')lines++;
   const far=kind==='far';
   this.strikes.push({time:+t.toFixed(2),kind,delay:far?1+random()*3.5:.12+random()*.2,rumble:far?2.5+random()*2:3.2+random()*1.6,bearing:random()*Math.PI*2});
  }
 }
 /** The storm's strength at `t` without gusts. */
 front(t:number){
  const f=this.def.front;
  if(t<=f[0][0])return f[0][1];
  for(let i=1;i<f.length;i++)if(t<=f[i][0]){
   const [t0,v0]=f[i-1],[t1,v1]=f[i];
   return v0+(v1-v0)*(t-t0)/(t1-t0);
  }
  return f.at(-1)![1];
 }
 /** 0..1, a slow wobble on top of the front. */
 gust(t:number){
  const i=Math.max(0,Math.min(this.gusts.length-2,Math.floor(t/4))),k=t/4-i,s=k*k*(3-2*k);
  return this.gusts[i]*(1-s)+this.gusts[i+1]*s;
 }
 at(t:number){
  const front=this.front(t),gust=this.gust(t);
  const intensity=clamp01(front*(.85+.3*gust));
  const {calm,storm}=this.def.temperature;
  return {
   intensity,
   rain:clamp01((intensity-.08)/.8),
   wind:clamp01(front*.6+gust*front*.6),
   outdoorTemp:calm+(storm-calm)*front,
  };
 }
 /** The strikes that fell since the last call (call once per step, with a time that only goes forward). */
 step(t:number){
  const fired:Strike[]=[];
  while(this.cursor<this.strikes.length&&this.strikes[this.cursor].time<=t)fired.push(this.strikes[this.cursor++]);
  return fired;
 }
 /** Start again from `t` (a restart, or a jump in time). */
 seek(t:number){this.cursor=this.strikes.findIndex(s=>s.time>t);if(this.cursor<0)this.cursor=this.strikes.length;}
 /** The next strike after `t` (of one kind, if given). */
 next(t:number,kind?:StrikeKind){return this.strikes.find(s=>s.time>t&&(!kind||s.kind===kind));}
 /** How loud the thunder is at `t` (0..1). A strike on the rod is right overhead. */
 thunder(t:number){
  let loud=0;
  for(const s of this.strikes){
   const start=s.time+s.delay;
   if(start>t)break;
   const k=(t-start)/s.rumble;
   if(k<=1)loud=Math.max(loud,(s.kind==='far'?.7:1)*(k<.12?k/.12:1-(k-.12)/.88));
  }
  return loud;
 }
 /** How bright the lightning is at `t` (0..1): a double flicker for a third of a second. */
 flash(t:number){
  let bright=0;
  for(const s of this.strikes){
   if(s.time>t)break;
   const k=t-s.time;
   if(k<.38)bright=Math.max(bright,(s.kind==='far'?.55:1)*(k<.09?1:k<.15?.25:k<.24?.85:1-(k-.24)/.14));
  }
  return bright;
 }
 /** How much of the normal hearing distance is left at `t` (1 = normal). */
 hearing(t:number,outdoor:boolean){
  const h=this.def.hearing,thunder=this.thunder(t);
  const rain=outdoor?1-(1-h.rain)*this.at(t).rain:1;
  const boom=1-(1-(outdoor?h.thunder:h.indoorThunder))*thunder;
  return Math.min(rain,boom);
 }
}

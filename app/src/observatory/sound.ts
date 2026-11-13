// The observatory's sound, made in the browser from noise and a few oscillators (2026-11-13; no audio files):
// rain and wind that follow the storm and whether the player is indoors, thunder after each flash (later for a
// far strike), the generator's drone near its shed, and the oxygen alarm near the lab. It only reads the world.
// Off until the player turns it on (the panel's button), because a browser may not play sound before a click.
import type {ObservatoryWorld} from './world';
import type {Position} from '../world';

export class Sound{
 private ctx:AudioContext|undefined;
 private master!:GainNode;private rain!:GainNode;private wind!:GainNode;private windFilter!:BiquadFilterNode;
 private hum!:GainNode;private alarm!:GainNode;private noise!:AudioBuffer;
 private readonly played=new Set<number>();
 enabled=false;
 set(on:boolean){
  this.enabled=on;
  if(on&&!this.ctx)this.build();
  if(this.ctx){void this.ctx.resume().catch(()=>{});this.master.gain.setTargetAtTime(on?.7:0,this.ctx.currentTime,.1);}
 }
 private build(){
  const ctx=this.ctx=new AudioContext();
  this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
  // Two seconds of white noise, looped, is the raw material for rain, wind and thunder.
  this.noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
  const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const loop=()=>{const s=ctx.createBufferSource();s.buffer=this.noise;s.loop=true;s.start();return s;};
  const rainFilter=ctx.createBiquadFilter();rainFilter.type='highpass';rainFilter.frequency.value=1400;
  this.rain=ctx.createGain();this.rain.gain.value=0;loop().connect(rainFilter).connect(this.rain).connect(this.master);
  this.windFilter=ctx.createBiquadFilter();this.windFilter.type='bandpass';this.windFilter.frequency.value=320;this.windFilter.Q.value=1.4;
  this.wind=ctx.createGain();this.wind.gain.value=0;loop().connect(this.windFilter).connect(this.wind).connect(this.master);
  this.hum=ctx.createGain();this.hum.gain.value=0;this.hum.connect(this.master);
  for(const [f,type] of [[52,'sawtooth'],[104,'square'],[157,'sawtooth']] as [number,OscillatorType][]){
   const o=ctx.createOscillator(),lp=ctx.createBiquadFilter();o.type=type;o.frequency.value=f;lp.type='lowpass';lp.frequency.value=260;o.connect(lp).connect(this.hum);o.start();
  }
  this.alarm=ctx.createGain();this.alarm.gain.value=0;this.alarm.connect(this.master);
  const beep=ctx.createOscillator();beep.type='square';beep.frequency.value=2100;beep.connect(this.alarm);beep.start();
 }
 private thunder(loud:number,seconds:number,near:boolean){
  const ctx=this.ctx!,now=ctx.currentTime,s=ctx.createBufferSource(),lp=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=this.noise;s.loop=true;lp.type='lowpass';lp.frequency.setValueAtTime(near?900:260,now);lp.frequency.exponentialRampToValueAtTime(70,now+seconds);
  g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(loud,now+(near?.03:.25));g.gain.exponentialRampToValueAtTime(.001,now+seconds);
  s.connect(lp).connect(g).connect(this.master);s.start(now);s.stop(now+seconds+.1);
 }
 step(w:ObservatoryWorld,player:Position,outdoor:boolean,seconds:number){
  const ctx=this.ctx;if(!ctx||!this.enabled)return;
  const now=ctx.currentTime,t=w.time,weather=w.weather.at(t),muffle=outdoor?1:.3;
  this.rain.gain.setTargetAtTime(weather.rain*.16*muffle,now,.3);
  this.wind.gain.setTargetAtTime(weather.wind*.3*(outdoor?1:.45),now,.4);
  this.windFilter.frequency.setTargetAtTime(240+weather.wind*380+Math.sin(seconds*.7)*90,now,.5);
  const near=(x:number,z:number,reach:number)=>Math.max(0,1-Math.hypot(player.x-x,player.z-z)/reach);
  this.hum.gain.setTargetAtTime(w.grid.generator==='running'?.1*near(4.6,31,26)**2:0,now,.3);
  this.alarm.gain.setTargetAtTime(w.o2Alarm&&seconds*2.2%1<.45?.05*near(25,24,22):0,now,.01);
  for(const s of w.weather.strikes){
   const at=s.time+s.delay;
   if(at>t)break;
   if(t-at<.5&&!this.played.has(s.time)){this.played.add(s.time);this.thunder((s.kind==='far'?.55:1)*(outdoor?1:.6),s.rumble*1.6,s.kind!=='far');}
  }
 }
}

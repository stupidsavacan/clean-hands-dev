import type {Director} from './ai.ts';
import type {MissionEvents} from './events.ts';
import type {MissionClock,SchedulePlace} from './schedule.ts';
import {segmentClear} from './sight.ts';
import type {Position} from './world.ts';
export type DialogueRules={indoorRadius:number;outdoorRadius:number;repeat:number;lineSeconds:number;speakerRadius:number};
export type DialogueDef={place:string;speakers:string[];lines:string[][];trigger?:boolean;window?:number[]};
export type DialogueData=Record<string,DialogueDef>;
type Playback={next:number;elapsed:number;playing:boolean;eligible:boolean;cycle:number};
export type Subtitle={id:string;speaker:string;text:string;line:number;total:number;radius:number;trigger:boolean};
export function validateDialogue(data:DialogueData,places:Record<string,SchedulePlace>,director:Director){const errors:string[]=[];for(const [id,d] of Object.entries(data)){
 if(!places[d.place])errors.push(`会話の場所がありません: ${id}`);if(!d.lines.length)errors.push(`会話が空です: ${id}`);
 for(const s of d.speakers)if(!director.npcs.some(n=>n.id===s))errors.push(`話者がありません: ${id} ${s}`);
 for(const line of d.lines)if(line.length!==2||!d.speakers.includes(line[0])||typeof line[1]!=='string'||[...line[1]].length>30)errors.push(`字幕の話者・30文字制限: ${id}`);
 if(d.window&&(d.window.length!==2||d.window[0]<0||d.window[0]>=d.window[1]))errors.push(`会話の時間窓: ${id}`);
 }return errors;}
export class DialogueSystem{
 readonly heard=new Set<string>();readonly playback=new Map<string,Playback>();subtitle:Subtitle|null=null;
 readonly data:DialogueData;readonly places:Record<string,SchedulePlace>;readonly director:Director;readonly clock:MissionClock;readonly rules:DialogueRules;readonly events:MissionEvents;
 constructor(data:DialogueData,places:Record<string,SchedulePlace>,director:Director,clock:MissionClock,rules:DialogueRules,events:MissionEvents){
  this.data=data;this.places=places;this.director=director;this.clock=clock;this.rules=rules;this.events=events;
  const errors=validateDialogue(data,places,director);if(errors.length)throw new Error(errors.join('\n'));
  for(const id of Object.keys(data))this.playback.set(id,{next:0,elapsed:0,playing:false,eligible:false,cycle:clock.cycle});
 }
 // A jump re-evaluates the time windows but cannot count as listening.
 seek(){this.subtitle=null;for(const p of this.playback.values()){p.next=this.clock.elapsed;p.elapsed=0;p.playing=false;p.eligible=false;p.cycle=this.clock.cycle;}}
 step(dt:number,player:Position,alert:number){this.subtitle=null;for(const n of this.director.npcs)n.talking=false;
  const audible:{id:string;distance:number;radius:number;clear:boolean}[]=[];
  for(const [id,d]of Object.entries(this.data)){const p=this.playback.get(id)!,place=this.places[d.place];
   if(p.cycle!==this.clock.cycle){p.cycle=this.clock.cycle;p.playing=false;p.next=this.clock.elapsed;p.eligible=false;}
   const speakers=d.speakers.map(s=>this.director.npcs.find(n=>n.id===s)!);
   const ready=alert<2&&(!d.window||this.clock.time>=d.window[0]&&this.clock.time<d.window[1])&&speakers.every(n=>n.active&&!n.busy&&!n.scheduleTarget&&n.state==='patrol'&&Math.abs(n.pos.y-place.y)<.3&&Math.hypot(n.pos.x-place.x,n.pos.z-place.z)<=this.rules.speakerRadius);
   if(!ready||d.trigger&&this.heard.has(id)){if(p.playing)p.next=this.clock.elapsed+this.rules.repeat;p.playing=false;p.eligible=false;continue;}
   if(!p.playing&&this.clock.elapsed>=p.next){p.playing=true;p.elapsed=0;p.eligible=true;}
   if(!p.playing)continue;
   const line=Math.min(d.lines.length-1,Math.floor(p.elapsed/this.rules.lineSeconds)),speaker=this.director.npcs.find(n=>n.id===d.lines[line][0])!;speaker.talking=true;
   const radius=place.outdoor?this.rules.outdoorRadius:this.rules.indoorRadius,distance=Math.hypot(player.x-speaker.pos.x,player.z-speaker.pos.z);
   const clear=Math.abs(player.y-speaker.pos.y)<.5&&distance<=radius&&segmentClear(this.director.boxes,{...player,y:player.y+1.4},{...speaker.pos,y:speaker.pos.y+1.4});
   audible.push({id,distance,radius,clear});
  }
  const selected=audible.filter(a=>a.clear).sort((a,b)=>a.distance-b.distance)[0];
  for(const a of audible){const p=this.playback.get(a.id)!,d=this.data[a.id],line=Math.min(d.lines.length-1,Math.floor(p.elapsed/this.rules.lineSeconds));
   if(selected?.id===a.id){const [speaker,text]=d.lines[line];this.subtitle={id:a.id,speaker:this.director.npcs.find(n=>n.id===speaker)!.label,text,line,total:d.lines.length,radius:a.radius,trigger:!!d.trigger};}
   else p.eligible=false;
   p.elapsed+=dt;
   if(p.elapsed>=d.lines.length*this.rules.lineSeconds){if(p.eligible&&!this.heard.has(a.id)){this.heard.add(a.id);this.events.emit({type:'dialogue.heard',time:this.clock.elapsed,id:a.id});}p.playing=false;p.eligible=false;p.next=d.trigger?this.clock.elapsed+Math.max(0,this.rules.repeat-d.lines.length*this.rules.lineSeconds):Infinity;}
  }
 }
 snapshot(){return {heard:[...this.heard],subtitle:this.subtitle,playing:[...this.playback].filter(([,p])=>p.playing).map(([id,p])=>({id,...p}))};}
}

import type {MissionEvent,MissionEvents} from './events.ts';
export type Done={disguise?:string;talked?:string;event?:string;armed?:string;flag?:string;killed?:string;by?:string;at?:string;any?:Done[]};
export type ChanceDef={title:string;target:string;trigger:{heard:string};window:number[];steps:{text:string;done:Done}[]};
export type ChancesData=Record<string,ChanceDef>;
export type ChanceState={id:string;stage:number;status:'undiscovered'|'active'|'complete'|'lost'};
export class Chances{
 readonly states=new Map<string,ChanceState>();readonly facts:MissionEvent[]=[];tracked:string|null=null;
 readonly data:ChancesData;readonly events:MissionEvents;
 constructor(data:ChancesData,events:MissionEvents){this.data=data;this.events=events;for(const id of Object.keys(data))this.states.set(id,{id,stage:0,status:'undiscovered'});events.on(e=>this.receive(e));}
 private matches(d:Done,e:MissionEvent):boolean{if(d.any)return d.any.some(c=>this.matches(c,e));
  if(d.disguise)return e.type==='disguise.changed'&&e.id===d.disguise;
  if(d.talked)return e.type==='npc.talked'&&e.id===d.talked;
  if(d.event)return e.type===d.event;
  if(d.armed)return e.type==='trap.armed'&&e.id===d.armed;
  if(d.flag)return e.type==='flag.set'&&e.id===d.flag;
  return !!d.killed&&e.type==='npc.killed'&&e.id===d.killed&&(!d.by||e.method===d.by)&&(!d.at||e.place===d.at);}
 private receive(e:MissionEvent){if(!['dialogue.heard','disguise.changed','npc.talked','cellar.entered','trap.armed','flag.set','npc.killed'].includes(e.type))return;
  this.facts.push({...e});for(const [id,def]of Object.entries(this.data)){const s=this.states.get(id)!;if(s.status==='complete'||s.status==='lost')continue;
   if(s.status==='undiscovered'&&e.type==='dialogue.heard'&&e.id===def.trigger.heard){s.status='active';if(!this.tracked)this.tracked=id;this.changed(s,e.time);}
   if(s.status==='active')while(s.stage<def.steps.length&&this.facts.some(f=>this.matches(def.steps[s.stage].done,f))){s.stage++;if(s.stage===def.steps.length)s.status='complete';this.changed(s,e.time);}
   // Only a discovered chance can be lost; one never heard of stays undiscovered.
   if(e.type==='npc.killed'&&e.id===def.target&&s.status==='active'){s.status='lost';this.changed(s,e.time);}
  }}
 private changed(s:ChanceState,time:number){this.events.emit({type:'chance.updated',time,id:s.id,value:s.stage,reason:s.status});}
 track(id:string){if(this.states.get(id)?.status!=='undiscovered'&&this.states.has(id))this.tracked=id;}
 snapshot(time:number,loop:number){return [...this.states.values()].map(s=>{const def=this.data[s.id],start=def.window[0],end=def.window[1],wait=time<start?start-time:time>=end?loop-time+start:0;return {...s,title:s.status==='undiscovered'?'？？？':def.title,step:s.status==='active'?def.steps[s.stage]?.text:'',window:[...def.window],waitSeconds:wait,tracked:s.id===this.tracked};});}
}

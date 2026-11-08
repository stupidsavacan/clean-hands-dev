import type {Position} from './world.ts';

type IncidentKind='body'|'equipment'|'weapon'|'cleaning'|'noise'|'gunshot'|'report';
type Phase='noticed'|'reported'|'assigned'|'released'|'completed'|'cancelled';
type Sense='sight'|'sound'|'radio'|'none';
export type IncidentRef={id:number;kind:IncidentKind;subject?:string};
export type IncidentEvent={incidentId:number;category:IncidentKind;subject?:string;phase:Phase;at:Position;actor?:string;source?:string;sense:Sense};

/** Correlate reports and job transitions without changing which NPC knows about an incident. */
export class IncidentLog{
 private nextId=1;
 private readonly refs=new WeakMap<object,IncidentRef>();
 onEvent?:(e:IncidentEvent)=>void;

 identify(key:object,kind:IncidentKind,subject?:string):IncidentRef{
  const existing=this.refs.get(key);
  if(existing?.kind===kind&&existing.subject===subject)return existing;
  const incident={id:this.nextId++,kind,subject};
  this.refs.set(key,incident);
  return incident;
 }

 write(incident:IncidentRef,phase:Phase,at:Position,actor?:string,sense:Sense='none',source?:string){
  this.onEvent?.({incidentId:incident.id,category:incident.kind,subject:incident.subject,phase,at:{x:at.x,y:at.y,z:at.z},actor,source,sense});
 }

 end(key:object,phase:'completed'|'cancelled',at:Position,actor?:string,subject?:string){
  const incident=this.refs.get(key);
  if(!incident||subject!==undefined&&incident.subject!==subject)return;
  this.refs.delete(key);
  this.write(incident,phase,at,actor);
 }
}
